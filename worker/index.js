const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REDIS_URL = process.env.REDIS_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || 'recordings';

if (!REDIS_URL) {
  console.error('REDIS_URL is not set. Exiting.');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Exiting.');
  process.exit(1);
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('ai-jobs', { connection });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('Worker starting — connecting to Redis and Supabase...');

const worker = new Worker('ai-jobs', async (job) => {
  const jobId = job.data.jobId;
  console.log('Picked up job', jobId);

  // load ai_job row
  const { data: jobRow, error: jobErr } = await supabase.from('ai_jobs').select('*').eq('id', jobId).single();
  if (jobErr || !jobRow) {
    throw new Error('ai_job not found: ' + jobId);
  }

  await supabase.from('ai_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', jobId);

  try {
    const prompt = jobRow.prompt || (jobRow.parameters && jobRow.parameters.prompt) || buildPrompt(jobRow);
    console.log('Generating script via OpenAI...');
    const script = await generateScript(prompt);

    console.log('Generating TTS via ElevenLabs...');
    const audioBuffer = await generateTTS(script, jobRow.voice_id || 'eleven_standard');

    console.log('Rendering video (ffmpeg)...');
    const mp4Path = await renderVideoFromScript(script, audioBuffer, jobRow.id);

    console.log('Uploading to Supabase Storage...');
    const fileName = `ai_jobs/${jobRow.id}.mp4`;
    const fileStream = fs.createReadStream(mp4Path);
    const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, fileStream, { contentType: 'video/mp4' });
    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const media_url = publicData?.publicUrl || null;

    await supabase.from('ai_jobs').update({ status: 'complete', result_video_url: media_url, updated_at: new Date().toISOString() }).eq('id', jobId);

    // If scheduled payload present, add scheduled_posts
    if (jobRow.parameters && jobRow.parameters.scheduled_for) {
      const scheduledPayload = {
        topic: jobRow.parameters.topic || 'AI Generated Video',
        caption_text: jobRow.parameters.caption || '',
        hashtags: jobRow.parameters.hashtags || '',
        media_url,
        status: 'PENDING',
        scheduled_for: jobRow.parameters.scheduled_for,
        platforms: jobRow.parameters.platforms || '',
        source_job_id: jobRow.id
      };
      await supabase.from('scheduled_posts').insert([scheduledPayload]);
    }

    // cleanup temp
    try { fs.unlinkSync(mp4Path); } catch (e) {}

    console.log('Job complete', jobId);
    return { ok: true };
  } catch (err) {
    console.error('Job failed', jobId, err);
    await supabase.from('ai_jobs').update({ status: 'failed', error_text: String(err), updated_at: new Date().toISOString() }).eq('id', jobId);
    throw err;
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error('Worker: job failed', job?.id, err?.message || err);
});

function buildPrompt(jobRow) {
  const niche = (jobRow.parameters && jobRow.parameters.niche) || 'general creator niche';
  return `Write a short attention-grabbing video script for niche: ${niche}. Keep it concise and divided into 3-5 short scenes or lines.`;
}

async function generateScript(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
  });
  if (!res.ok) throw new Error('OpenAI script generation failed: ' + res.statusText);
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

async function generateTTS(text, voiceId) {
  // ElevenLabs text-to-speech streaming endpoint
  const vid = voiceId || '21m00Tcm4TlvDq8ikWAM'; // fallback voice id
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream`;
  const body = { text };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('ElevenLabs TTS failed: ' + res.status + ' ' + txt);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function renderVideoFromScript(script, audioBuffer, jobId) {
  // write audio to temp file
  const tmpDir = os.tmpdir();
  const audioPath = path.join(tmpDir, `ai_${jobId}.mp3`);
  fs.writeFileSync(audioPath, audioBuffer);

  // get audio duration using ffprobe
  let duration = 5;
  try {
    const out = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
    duration = Math.max(1, Math.ceil(Number(out) || 5));
  } catch (e) {
    console.warn('ffprobe failed, defaulting duration=5s', e?.message);
  }

  // prepare text (truncate)
  const text = script.replace(/\s+/g, ' ').trim().slice(0, 240).replace(/"/g, '\"');

  const videoPath = path.join(tmpDir, `ai_${jobId}.mp4`);

  // build ffmpeg command: color background + drawtext centered + audio overlay
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  const cmd = `ffmpeg -y -f lavfi -i color=c=#0f172a:s=1080x1080:d=${duration} -i "${audioPath}" -vf "drawtext=fontfile=${font}:text='${text}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.4:boxborderw=10" -c:v libx264 -c:a aac -shortest "${videoPath}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error('ffmpeg failed', e?.message);
    throw e;
  }

  // cleanup audio
  try { fs.unlinkSync(audioPath); } catch (e) {}

  return videoPath;
}

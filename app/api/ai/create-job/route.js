import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REDIS_URL = process.env.REDIS_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { parameters = {}, voice_id = null, prompt = null } = body;

    // insert ai_job row
    const insertPayload = {
      voice_id,
      prompt,
      parameters,
      status: 'queued'
    };

    const { data, error } = await supabase.from('ai_jobs').insert([insertPayload]).select().single();
    if (error) {
      console.error('Failed to insert ai_job', error);
      return new Response(JSON.stringify({ error: error.message || error }), { status: 500 });
    }

    const jobId = data.id;

    // push to Redis queue
    if (!REDIS_URL) {
      console.warn('REDIS_URL not configured, job will remain queued for DB-polling worker.');
      return new Response(JSON.stringify({ ok: true, jobId }), { status: 200 });
    }

    const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    const queue = new Queue('ai-jobs', { connection });

    await queue.add('process', { jobId });

    // close Redis connection
    try { await connection.quit(); } catch (e) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, jobId }), { status: 200 });
  } catch (err) {
    console.error('Create-job error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}

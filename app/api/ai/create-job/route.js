import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { parameters = {}, voice_id = null, prompt = null } = body;

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
    return new Response(JSON.stringify({ ok: true, jobId }), { status: 200 });
  } catch (err) {
    console.error('Create-job error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}

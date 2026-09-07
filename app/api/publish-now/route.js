import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side API route to mark a scheduled post as published.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in Vercel (Project > Settings > Environment Variables).

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase service key or URL not found in environment variables for publish-now route.');
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured on server.' }, { status: 500 });
    }

    const body = await request.json();
    const postId = body?.postId;

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId in request body.' }, { status: 400 });
    }

    // Update the scheduled_posts row to PUBLISHED and set published_at
    const { error } = await supabase
      .from('scheduled_posts')
      .update({ status: 'PUBLISHED', published_at: new Date().toISOString() })
      .eq('id', postId);

    if (error) {
      console.error('Supabase update error in publish-now route:', error);
      return NextResponse.json({ error: error.message || error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    console.error('Unexpected error in publish-now route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

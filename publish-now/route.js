import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function POST(req) {
  try {
    const { postId } = await req.json();

    const { data: post, error: fetchErr } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (fetchErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const res = await fetch('https://api.upload-post.com/v1/publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SOCIAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        caption: `${post.caption_text}\n\n${post.hashtags}`,
        media_url: post.media_url,
        platforms: ['instagram', 'tiktok', 'linkedin', 'twitter']
      })
    });

    if (res.ok) {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'PUBLISHED' })
        .eq('id', postId);

      return NextResponse.json({ success: true });
    } else {
      const errData = await res.json();
      return NextResponse.json({ error: errData }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

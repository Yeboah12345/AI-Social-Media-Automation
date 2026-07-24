import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_KEY; // service_role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req) {
  try {
    const { postId } = await req.json();

    // 1. Fetch post details from Supabase
    const { data: post, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found in database' }, { status: 404 });
    }

    // 2. Publish to social networks via Upload-Post API
    const response = await fetch('https://v1.upload-post.com/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SOCIAL_API_KEY}`
      },
      body: JSON.stringify({
        text: `${post.caption_text}\n\n${post.hashtags}`,
        media_url: post.media_url,
        platforms: ["linkedin", "twitter", "instagram", "tiktok"]
      })
    });

    if (response.ok) {
      // 3. Mark post as PUBLISHED
      await supabase
        .from('scheduled_posts')
        .update({ status: 'PUBLISHED', published_at: new Date().toISOString() })
        .eq('id', postId);

      return NextResponse.json({ success: true });
    } else {
      const errData = await response.json();
      return NextResponse.json({ error: errData }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

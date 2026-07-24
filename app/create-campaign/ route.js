import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function POST(req) {
  try {
    const { topic } = await req.json();

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `Generate a social media post about "${topic}". Return JSON ONLY with keys: "caption_text", "hashtags", "image_prompt".`
        }],
        response_format: { type: "json_object" }
      })
    });

    const groqData = await groqRes.json();
    const content = JSON.parse(groqData.choices[0].message.content);

    const encodedPrompt = encodeURIComponent(content.image_prompt || topic);
    const media_url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true`;

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert([{
        topic: topic,
        caption_text: content.caption_text,
        hashtags: content.hashtags,
        media_url: media_url,
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
        status: 'PENDING'
      }]);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

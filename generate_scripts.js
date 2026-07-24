const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

// Standard stable Gemini model
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("❌ Missing required environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runGenerator() {
    const niche = "Artificial Intelligence & Tech News";
    console.log(`🚀 Using Model: ${GEMINI_MODEL}`);
    console.log(`🚀 Generating 30-day posting plan for niche: "${niche}"...`);

    const prompt = `Generate a JSON array with 30 distinct social media post objects for the niche: "${niche}".
Return ONLY a raw valid JSON array. Do NOT wrap in markdown syntax or \`\`\`json.
Each object must have these exact keys:
- "day_number": integer from 1 to 30
- "topic": short catchy title
- "script_text": 45-second voiceover script with hook, body, and call-to-action
- "caption_text": engaging caption
- "hashtags": 5 relevant hashtags separated by spaces`;

    // Updated endpoint to use standard v1 API path
    const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Google API Error:", JSON.stringify(data, null, 2));
            process.exit(1);
        }

        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error("❌ Unexpected response structure:", JSON.stringify(data, null, 2));
            process.exit(1);
        }

        let rawText = data.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const posts = JSON.parse(rawText);
        console.log(`✅ Success! Generated ${posts.length} posts from Gemini in 1 request.`);

        // 1. Create Campaign Record in Supabase
        const { data: campaign, error: campErr } = await supabase
            .from('user_campaigns')
            .insert([{ 
                user_id: "00000000-0000-0000-0000-000000000000", 
                niche: niche, 
                posts_per_day: 1, 
                duration_days: posts.length 
            }])
            .select().single();

        if (campErr) {
            console.error("❌ Supabase Campaign Creation Error:", campErr);
            process.exit(1);
        }

        // 2. Prepare database rows spaced 24 hours apart
        const now = new Date();
        const rowsToInsert = posts.map((post, index) => {
            const scheduledDate = new Date(now);
            scheduledDate.setDate(scheduledDate.getDate() + index);
            scheduledDate.setHours(9, 0, 0, 0);

            return {
                campaign_id: campaign.id,
                scheduled_for: scheduledDate.toISOString(),
                topic: post.topic,
                script_text: post.script_text,
                caption_text: post.caption_text,
                hashtags: post.hashtags,
                status: 'PENDING'
            };
        });

        // 3. Save all 30 posts into Supabase
        const { error: insertErr } = await supabase.from('scheduled_posts').insert(rowsToInsert);

        if (insertErr) {
            console.error("❌ Supabase Insertion Error:", insertErr);
            process.exit(1);
        }

        console.log(`🎉 SUCCESS! Saved all ${rowsToInsert.length} posts directly into your Supabase database!`);

    } catch (err) {
        console.error("❌ UNCAUGHT ERROR:", err);
        process.exit(1);
    }
}

runGenerator();

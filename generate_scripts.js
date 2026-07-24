const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!supabaseUrl || !supabaseKey || !groqApiKey) {
    console.error("❌ CRITICAL: Missing required environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const groq = new Groq({ apiKey: groqApiKey });

async function runGenerator() {
    const niche = "Artificial Intelligence & Tech News";
    console.log(`🚀 Starting Full Production Generator for Niche: "${niche}"...`);

    const prompt = `Generate a JSON array with 30 distinct social media post objects for the niche: "${niche}".
Return ONLY a raw valid JSON array. Do NOT wrap in markdown syntax.
Each object must have these exact keys:
- "day_number": integer from 1 to 30
- "topic": short catchy title
- "script_text": 45-second voiceover script with hook, body, and call-to-action
- "caption_text": engaging caption
- "hashtags": 5 relevant hashtags separated by spaces
- "image_prompt": concise descriptive prompt for a futuristic visual relevant to topic`;

    try {
        console.log("📡 Requesting content generation from Groq...");
        
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a JSON-only API response engine. Always return valid raw JSON arrays." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        let rawText = chatCompletion.choices[0]?.message?.content?.trim();
        let parsed = JSON.parse(rawText);
        let posts = Array.isArray(parsed) ? parsed : (parsed.posts || parsed.data || Object.values(parsed)[0]);

        if (!Array.isArray(posts)) {
            throw new Error("Parsed JSON response was not an array of posts.");
        }

        console.log(`✅ Success! Received ${posts.length} posts from Groq AI.`);

        // 1. Create Campaign Record in Supabase
        const { data: campaign, error: campErr } = await supabase
            .from('user_campaigns')
            .insert([{ 
                user_id: "00000000-0000-0000-0000-000000000000", 
                niche: niche, 
                posts_per_day: 1, 
                duration_days: posts.length 
            }])
            .select()
            .single();

        if (campErr) {
            console.error("❌ Supabase Campaign Creation Error:", campErr);
            process.exit(1);
        }

        // 2. Prepare database rows with auto-generated dynamic image URLs
        const now = new Date();
        const rowsToInsert = posts.map((post, index) => {
            const scheduledDate = new Date(now);
            scheduledDate.setDate(scheduledDate.getDate() + index);
            scheduledDate.setHours(9, 0, 0, 0);

            // Generate direct HD Flux AI image URL based on prompt
            const cleanImagePrompt = encodeURIComponent(post.image_prompt || post.topic);
            const generatedImageUrl = `https://pollinations.ai/p/${cleanImagePrompt}?width=1080&height=1080&seed=${index + 100}&model=flux`;

            return {
                campaign_id: campaign.id,
                scheduled_for: scheduledDate.toISOString(),
                topic: post.topic,
                script_text: post.script_text,
                caption_text: post.caption_text,
                hashtags: post.hashtags,
                media_url: generatedImageUrl,
                status: 'PENDING'
            };
        });

        // 3. Save all 30 posts to Supabase
        const { error: insertErr } = await supabase.from('scheduled_posts').insert(rowsToInsert);

        if (insertErr) {
            console.error("❌ Supabase Insertion Error:", insertErr);
            process.exit(1);
        }

        console.log(`🎉 PRODUCTION SUCCESS! Generated and stored ${rowsToInsert.length} posts with custom AI visuals into Supabase!`);

    } catch (err) {
        console.error("❌ SCRIPT EXECUTION FAILED:", err.message || err);
        process.exit(1);
    }
}

runGenerator();

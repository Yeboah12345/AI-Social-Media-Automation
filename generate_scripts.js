const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

console.log("=== ENVIRONMENT CHECK ===");
console.log("SUPABASE_URL present:", !!supabaseUrl);
console.log("SUPABASE_KEY present:", !!supabaseKey);
console.log("GROQ_API_KEY present:", !!groqApiKey);

if (!supabaseUrl || !supabaseKey || !groqApiKey) {
    console.error("❌ CRITICAL: Missing required secrets in GitHub!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const groq = new Groq({ apiKey: groqApiKey });

async function runGenerator() {
    const niche = "Artificial Intelligence & Tech News";
    console.log(`🚀 Generating 30-day posting plan with Groq (Llama 3.3 70B) for niche: "${niche}"...`);

    const prompt = `Generate a JSON array with 30 distinct social media post objects for the niche: "${niche}".
Return ONLY a raw valid JSON array. Do NOT wrap in markdown syntax or \`\`\`json.
Each object must have these exact keys:
- "day_number": integer from 1 to 30
- "topic": short catchy title
- "script_text": 45-second voiceover script with hook, body, and call-to-action
- "caption_text": engaging caption
- "hashtags": 5 relevant hashtags separated by spaces`;

    try {
        console.log("📡 Requesting script generation from Groq...");
        
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

        // Unwrap JSON if nested under a top-level key like {"posts": [...]} or raw array
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
            console.error("❌ Supabase Campaign Error:", JSON.stringify(campErr, null, 2));
            process.exit(1);
        }

        console.log("✅ Created campaign record ID:", campaign.id);

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

        // 3. Save all posts to Supabase
        const { error: insertErr } = await supabase.from('scheduled_posts').insert(rowsToInsert);

        if (insertErr) {
            console.error("❌ Supabase Posts Insertion Error:", JSON.stringify(insertErr, null, 2));
            process.exit(1);
        }

        console.log(`🎉 SUCCESS! Saved all ${rowsToInsert.length} posts directly into Supabase!`);

    } catch (err) {
        console.error("❌ UNCAUGHT EXCEPTION:", err);
        process.exit(1);
    }
}

runGenerator();

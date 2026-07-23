const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

console.log("--- CHECKING ENVIRONMENT VARIABLES ---");
console.log("SUPABASE_URL present?:", !!supabaseUrl);
console.log("SUPABASE_KEY present?:", !!supabaseKey);
console.log("GEMINI_API_KEY present?:", !!geminiApiKey);

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("❌ ERROR: One or more environment secrets are missing in GitHub!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runGenerator() {
    const niche = "Artificial Intelligence & Tech News";
    console.log(`\n🚀 Testing Gemini API Connection for niche: "${niche}"...`);

    const prompt = `Generate a JSON array with 5 video post objects for the niche: "${niche}".
Return ONLY raw valid JSON array without markdown code blocks.
Each object must have: "day_number", "topic", "script_text", "caption_text", "hashtags".`;

    // Trying standard stable endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ API ERROR RESPONSE FROM GOOGLE:", JSON.stringify(data, null, 2));
            process.exit(1);
        }

        let rawText = data.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const posts = JSON.parse(rawText);
        console.log(`✅ Success! Generated ${posts.length} posts from Gemini.`);

        // Test Supabase Save
        const { data: campaign, error: campErr } = await supabase
            .from('user_campaigns')
            .insert([{ user_id: "00000000-0000-0000-0000-000000000000", niche: niche, posts_per_day: 1, duration_days: 5 }])
            .select().single();

        if (campErr) {
            console.error("❌ Supabase Campaign Creation Failed:", campErr);
            process.exit(1);
        }

        const rows = posts.map((p, i) => ({
            campaign_id: campaign.id,
            scheduled_for: new Date(Date.now() + i * 86400000).toISOString(),
            topic: p.topic,
            script_text: p.script_text,
            caption_text: p.caption_text,
            hashtags: p.hashtags,
            status: 'PENDING'
        }));

        const { error: postErr } = await supabase.from('scheduled_posts').insert(rows);

        if (postErr) {
            console.error("❌ Supabase Post Insertion Failed:", postErr);
            process.exit(1);
        }

        console.log("🎉 SUCCESS! Saved posts directly into Supabase table!");

    } catch (err) {
        console.error("❌ UNCAUGHT SCRIPT ERROR:", err);
        process.exit(1);
    }
}

runGenerator();

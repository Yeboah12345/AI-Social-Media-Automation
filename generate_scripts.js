const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

console.log("=== ENVIRONMENT CHECK ===");
console.log("SUPABASE_URL present:", !!supabaseUrl);
console.log("SUPABASE_KEY present:", !!supabaseKey);
console.log("GEMINI_API_KEY present:", !!geminiApiKey);

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("❌ CRITICAL: Missing required environment variables in GitHub Secrets!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAndGenerate() {
    console.log("\n=== STEP 1: TESTING GEMINI API CONNECTION ===");
    
    // Primary official Gemini endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const promptText = `Generate a JSON array with 5 distinct social media post objects for niche "Tech".
Return strictly valid raw JSON without markdown formatting.
Each object must have: "day_number", "topic", "script_text", "caption_text", "hashtags".`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        const responseText = await response.text();
        console.log(`HTTP Status Code: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error("❌ GEMINI API ERROR RESPONSE:");
            console.error(responseText);
            process.exit(1);
        }

        console.log("✅ Gemini API returned success!");
        const data = JSON.parse(responseText);
        let rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawContent) {
            console.error("❌ Gemini returned an empty payload:", JSON.stringify(data, null, 2));
            process.exit(1);
        }

        // Clean potential markdown blocks
        rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        const posts = JSON.parse(rawContent);
        console.log(`✅ Parsed ${posts.length} generated posts from Gemini.`);

        console.log("\n=== STEP 2: TESTING SUPABASE CONNECTION ===");
        
        // Check if user_campaigns table is accessible
        const { data: campaign, error: campErr } = await supabase
            .from('user_campaigns')
            .insert([{ 
                user_id: "00000000-0000-0000-0000-000000000000", 
                niche: "Tech", 
                posts_per_day: 1, 
                duration_days: posts.length 
            }])
            .select()
            .single();

        if (campErr) {
            console.error("❌ SUPABASE CAMPAIGN ERROR:");
            console.error(JSON.stringify(campErr, null, 2));
            process.exit(1);
        }

        console.log("✅ Successfully created campaign record ID:", campaign.id);

        const now = new Date();
        const rowsToInsert = posts.map((post, index) => ({
            campaign_id: campaign.id,
            scheduled_for: new Date(now.getTime() + index * 86400000).toISOString(),
            topic: post.topic,
            script_text: post.script_text,
            caption_text: post.caption_text,
            hashtags: post.hashtags,
            status: 'PENDING'
        }));

        const { error: insertErr } = await supabase.from('scheduled_posts').insert(rowsToInsert);

        if (insertErr) {
            console.error("❌ SUPABASE POSTS INSERTION ERROR:");
            console.error(JSON.stringify(insertErr, null, 2));
            process.exit(1);
        }

        console.log("🎉 ALL STEPS COMPLETED SUCCESSFULLY!");

    } catch (err) {
        console.error("❌ UNCAUGHT SCRIPT EXCEPTION:");
        console.error(err);
        process.exit(1);
    }
}

testAndGenerate();

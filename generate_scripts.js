const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("❌ Missing required environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createCampaignAndGeneratePosts(userId, niche, postsPerDay = 1, durationDays = 30) {
    console.log(`🚀 Starting campaign setup for Niche: "${niche}" (${durationDays} days)...`);

    // 1. Create a campaign record in Supabase
    const { data: campaign, error: campaignError } = await supabase
        .from('user_campaigns')
        .insert([{
            user_id: userId,
            niche: niche,
            posts_per_day: postsPerDay,
            duration_days: durationDays
        }])
        .select()
        .single();

    if (campaignError) {
        console.error("❌ Error creating campaign record:", campaignError);
        process.exit(1);
    }

    console.log(`✅ Created Campaign ID: ${campaign.id}`);

    // 2. Call Gemini API to generate scripts
    const totalPosts = durationDays * postsPerDay;
    const prompt = `Generate a JSON array with exactly ${totalPosts} post objects for the niche: "${niche}".
Return ONLY raw JSON array. Do NOT wrap in markdown code block fence like \`\`\`json.
Each object must have these exact keys:
- "day_number": integer from 1 to ${totalPosts}
- "topic": short catchy title
- "script_text": 45-second voiceover script with hook, body, CTA
- "caption_text": engaging caption
- "hashtags": 5 relevant hashtags separated by spaces`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("❌ Gemini API Error:", JSON.stringify(data));
        process.exit(1);
    }

    let rawText = data.candidates[0].content.parts[0].text.trim();
    
    // Clean up any markdown tags Gemini might attach
    rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();

    let postIdeas;
    try {
        postIdeas = JSON.parse(rawText);
    } catch (e) {
        console.error("❌ Failed to parse JSON response from Gemini:", e.message);
        console.log("Raw output was:", rawText);
        process.exit(1);
    }

    console.log(`💡 Gemini successfully generated ${postIdeas.length} post ideas.`);

    // 3. Prepare rows with scheduled timestamps
    const now = new Date();
    const rowsToInsert = postIdeas.map((post, index) => {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(scheduledDate.getDate() + Math.floor(index / postsPerDay));
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

    // 4. Save to Supabase
    const { error: insertError } = await supabase.from('scheduled_posts').insert(rowsToInsert);

    if (insertError) {
        console.error("❌ Error saving posts to Supabase:", insertError);
        process.exit(1);
    } else {
        console.log(`🎉 SUCCESS! Successfully populated ${rowsToInsert.length} scheduled posts into Supabase!`);
    }
}

// Run test campaign generation
const sampleUserId = "00000000-0000-0000-0000-000000000000";
createCampaignAndGeneratePosts(sampleUserId, "Artificial Intelligence & Tech News", 1, 30);

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const socialApiKey = process.env.SOCIAL_API_KEY;

if (!supabaseUrl || !supabaseKey || !socialApiKey) {
    console.error("❌ CRITICAL: Missing required environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function publishDuePosts() {
    console.log("🔍 Running Production Social Media Dispatcher...");

    const now = new Date().toISOString();

    // 1. Retrieve all PENDING posts scheduled on or before current time
    const { data: posts, error: fetchErr } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'PENDING')
        .lte('scheduled_for', now);

    if (fetchErr) {
        console.error("❌ Error fetching pending posts from Supabase:", fetchErr);
        process.exit(1);
    }

    if (!posts || posts.length === 0) {
        console.log("⚡ No pending posts due for publication at this time.");
        return;
    }

    console.log(`📦 Found ${posts.length} pending post(s) ready for instant distribution.`);

    for (const post of posts) {
        console.log(`\n🚀 Dispatching Post ID [${post.id}]: "${post.topic}"...`);

        const fullPostText = `${post.caption_text}\n\n${post.hashtags}`;

        const payload = {
            text: fullPostText,
            platforms: ["linkedin", "twitter", "instagram", "tiktok"]
        };

        // Attach image media URL if present
        if (post.media_url) {
            payload.media_url = post.media_url;
        }

        try {
            const response = await fetch('https://v1.upload-post.com/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${socialApiKey}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                console.log(`✅ Successfully published Post ID [${post.id}] to connected social channels!`);

                await supabase
                    .from('scheduled_posts')
                    .update({ 
                        status: 'PUBLISHED',
                        published_at: new Date().toISOString()
                    })
                    .eq('id', post.id);
            } else {
                console.error(`❌ Dispatch Failed for Post ID [${post.id}]:`, result);

                await supabase
                    .from('scheduled_posts')
                    .update({ status: 'FAILED' })
                    .eq('id', post.id);
            }

        } catch (err) {
            console.error(`❌ Exception during publication of Post ID [${post.id}]:`, err);

            await supabase
                .from('scheduled_posts')
                .update({ status: 'FAILED' })
                .eq('id', post.id);
        }
    }
}

publishDuePosts();

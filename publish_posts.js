const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Must be service_role key
const socialApiKey = process.env.SOCIAL_API_KEY;

if (!supabaseUrl || !supabaseKey || !socialApiKey) {
    console.error("❌ CRITICAL: Missing required environment variables!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function publishDuePosts() {
    console.log("🔍 Checking Supabase for due posts...");

    const now = new Date().toISOString();

    // 1. Fetch pending posts scheduled for now or earlier
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
        console.log("⚡ No pending posts due for publication right now.");
        return;
    }

    console.log(`📦 Found ${posts.length} post(s) ready to publish.`);

    for (const post of posts) {
        console.log(`\n🚀 Publishing Post ID [${post.id}]: "${post.topic}"...`);

        const postCaption = `${post.caption_text}\n\n${post.hashtags}`;

        try {
            // 2. Send to Upload-Post API
            const response = await fetch('https://v1.upload-post.com/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${socialApiKey}`
                },
                body: JSON.stringify({
                    text: postCaption,
                    platforms: ["linkedin", "twitter", "instagram", "tiktok"] // Adjust based on your connected platforms
                })
            });

            const result = await response.json();

            if (response.ok) {
                console.log(`✅ Successfully published Post ID [${post.id}]!`);

                // 3. Mark as PUBLISHED in Supabase
                await supabase
                    .from('scheduled_posts')
                    .update({ 
                        status: 'PUBLISHED',
                        published_at: new Date().toISOString()
                    })
                    .eq('id', post.id);
            } else {
                console.error(`❌ API Dispatch Failed for Post ID [${post.id}]:`, result);

                await supabase
                    .from('scheduled_posts')
                    .update({ status: 'FAILED' })
                    .eq('id', post.id);
            }

        } catch (err) {
            console.error(`❌ Exception while publishing Post ID [${post.id}]:`, err);

            await supabase
                .from('scheduled_posts')
                .update({ status: 'FAILED' })
                .eq('id', post.id);
        }
    }
}

publishDuePosts();

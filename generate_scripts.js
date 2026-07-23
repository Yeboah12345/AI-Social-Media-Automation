// Function to generate 30 days of video scripts using Google Gemini API
async function generate30DayContent(niche, postsPerDay = 1) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing in environment variables.");
    }

    const totalPosts = 30 * postsPerDay;
    const prompt = `You are a social media growth expert. Generate a structured JSON array containing ${totalPosts} post ideas for the niche: "${niche}".
    
    Return ONLY a valid JSON array of objects. Do not include markdown code block tags like \`\`\`json.
    Each object must have these exact keys:
    - "day_number": integer
    - "topic": concise title of the video
    - "script_text": 45-second engaging voiceover script with a hook, body, and call-to-action
    - "caption_text": engaging caption for social media
    - "hashtags": 5 relevant hashtags separated by spaces`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error("Gemini API Error:", data);
        return;
    }

    const rawText = data.candidates[0].content.parts[0].text;
    console.log("--- SUCCESS: AI GENERATED CONTENT ---");
    console.log(rawText.substring(0, 500) + "...\n[Truncated for log length]");
}

// Test run with a sample niche
generate30DayContent("Personal Finance & Investing", 1);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, image, mode, messages } = req.body || {};

    if ((!message || !message.trim()) && !image) {
      return res.status(400).json({ error: "Message or image is required." });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is not configured in Vercel." });
    }

    const system = `You are NiSa AI, a friendly personal AI assistant for a student.
Answer clearly and accurately. Do not reveal hidden reasoning or internal analysis.
If an image is provided, directly analyze what is visible. For school questions, give the answer first and a short explanation.
Mode: ${mode || "Normal"}.`;

    const content = [
      { type: "text", text: message || "Please analyze this image carefully." }
    ];

    if (image) {
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return res.status(400).json({ error: "Invalid image format." });
      }
      if (image.length > 20 * 1024 * 1024) {
        return res.status(413).json({ error: "Image is too large. Please choose a smaller photo." });
      }
      content.push({
        type: "image_url",
        image_url: { url: image }
      });
    }

    const previous = Array.isArray(messages)
      ? messages.slice(-12).filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      : [];

    const finalMessages = [
      { role: "system", content: system },
      ...previous,
      { role: "user", content }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        messages: finalMessages,
        temperature: 0.7,
        max_completion_tokens: 2048
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Groq API error."
      });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) {
      return res.status(502).json({ error: "Groq returned no answer." });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Server error. Please try again."
    });
  }
}

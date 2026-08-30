export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const image = body.image || null;
    const mode = body.mode || "Normal";
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!message && !image) {
      return res.status(400).json({ error: "Message or image is required." });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is missing in Vercel Environment Variables."
      });
    }

    const userContent = [
      {
        type: "text",
        text:
          message ||
          "Analyze this image carefully. Give only the useful final answer. Do not show reasoning or <think> tags."
      }
    ];

    if (image) {
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return res.status(400).json({ error: "Invalid image format." });
      }

      if (image.length > 20 * 1024 * 1024) {
        return res.status(413).json({
          error: "Image is too large. Please upload a smaller image."
        });
      }

      userContent.push({
        type: "image_url",
        image_url: { url: image }
      });
    }

    const systemMessage = {
      role: "system",
      content:
        `You are NiSa AI, a friendly personal AI assistant for students.
Answer directly and clearly.
Never reveal hidden reasoning, chain-of-thought, internal analysis, or text inside <think>...</think>.
For image questions, inspect the image and answer what is actually visible.
If text is unclear, say that it is unclear instead of inventing it.
Mode: ${mode}.`
    };

    const previous = messages
      .slice(-12)
      .filter(
        m =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .map(m => ({
        role: m.role,
        content: m.content
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .trim()
      }))
      .filter(m => m.content);

    const apiMessages = [
      systemMessage,
      ...previous,
      { role: "user", content: userContent }
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "qwen/qwen3.6-27b",
          messages: apiMessages,
          reasoning_format: "hidden",
          reasoning_effort: "none",
          temperature: 0.7,
          max_completion_tokens: 2048,
          stream: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Groq API error."
      });
    }

    let answer = data?.choices?.[0]?.message?.content || "";

    // Safety net: remove any reasoning tags if a provider/model response contains them.
    answer = answer
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/gi, "")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "No final answer was returned." });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Server error. Please try again."
    });
  }
}

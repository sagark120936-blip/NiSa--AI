export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      apiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
      endpoint: "/api/chat"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: "GROQ_API_KEY is missing in Vercel Environment Variables."
    });
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();
    const image = body.image || null;
    const mode = String(body.mode || "normal");
    const language = String(body.language || "auto");
    const memory = String(body.memory || "");
    const oldMessages = Array.isArray(body.messages) ? body.messages : [];

    if (!message && !image) {
      return res.status(400).json({ error: "Message or image is required." });
    }

    const languageRule =
      language === "mr" ? "Reply mainly in Marathi." :
      language === "hi" ? "Reply mainly in Hindi." :
      language === "en" ? "Reply in English." :
      "Reply in the same language/style as the user when practical.";

    const modeRule = {
      simple: "Use simple words and short explanations.",
      teacher: "Teach step by step like a patient teacher.",
      exam: "Focus on exam-ready points, definitions, formulas and concise answers.",
      quiz: "Ask one question at a time when appropriate.",
      expert: "Give technically detailed and accurate explanations.",
      normal: "Be helpful, clear and concise."
    }[mode] || "Be helpful, clear and concise.";

    const system =
      "You are NiSa AI, a friendly personal AI assistant. " +
      "Never reveal private chain-of-thought or internal reasoning. " +
      "Give only the useful final answer. " +
      "If an image is supplied, actually inspect it and answer from what is visible. " +
      "Do not invent unreadable text; say when something is unclear. " +
      languageRule + " " + modeRule +
      (memory ? " User preferences: " + memory : "");

    const history = oldMessages
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .slice(-14)
      .map(m => ({
        role: m.role,
        content: String(m.content || "").slice(0, 12000)
      }));

    const userContent = [];
    userContent.push({
      type: "text",
      text: message || "Analyze this image carefully. Describe the visible content and answer any questions shown."
    });

    if (typeof image === "string" && image.startsWith("data:image/")) {
      if (image.length > 8_000_000) {
        return res.status(413).json({ error: "Image is too large. Please choose a smaller photo." });
      }
      userContent.push({
        type: "image_url",
        image_url: { url: image }
      });
    }

    const messages = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userContent }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        messages,
        temperature: 0.7,
        max_completion_tokens: 2048,
        reasoning_format: "hidden"
      })
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: "Groq returned an invalid response.",
        details: raw.slice(0, 500)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Groq API request failed."
      });
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) {
      return res.status(502).json({ error: "Groq returned no answer." });
    }

    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Server error. Please try again."
    });
  }
}
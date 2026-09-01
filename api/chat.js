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
    const image = typeof body.image === "string" ? body.image : null;
    const mode = String(body.mode || "normal");
    const language = String(body.language || "auto");
    const memory = String(body.memory || "").slice(0, 3000);
    const web = Boolean(body.web);
    const oldMessages = Array.isArray(body.messages) ? body.messages : [];

    if (!message && !image) {
      return res.status(400).json({ error: "Message or image is required." });
    }

    if (image && !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image format." });
    }

    // Browser sends compressed JPEG data URLs. Reject unusually large payloads early.
    if (image && image.length > 7000000) {
      return res.status(413).json({
        error: "Image is too large. Please choose a smaller photo."
      });
    }

    const languageRule =
      language === "mr" ? "Reply mainly in Marathi." :
      language === "hi" ? "Reply mainly in Hindi." :
      language === "en" ? "Reply in English." :
      "Match the user's language naturally. Marathi/Hinglish users should get natural Marathi/Hinglish.";

    const modeRule = ({
      simple: "Use simple words and short explanations.",
      teacher: "Teach step by step like a patient teacher.",
      exam: "Focus on exam-ready points, definitions, formulas and likely questions.",
      quiz: "Ask one question at a time and wait for the user's answer.",
      expert: "Give technically accurate, detailed explanations.",
      compare: "Compare options clearly when comparison is requested.",
      normal: "Be clear, useful and concise."
    })[mode] || "Be clear, useful and concise.";

    const system = [
      "You are NiSa AI, a friendly professional assistant.",
      "Never reveal private chain-of-thought, hidden analysis, tool traces, or <think> blocks. Give only the useful final answer.",
      "Do not invent unreadable text from images. Say when something is unclear.",
      "Use clean headings, bullets and numbered steps when useful.",
      "For maths/physics, show the necessary calculation and a clear final answer.",
      languageRule,
      modeRule,
      memory ? "User preferences: " + memory : ""
    ].join(" ");

    const history = oldMessages
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .slice(-12)
      .map(m => ({
        role: m.role,
        content: String(m.content || "").slice(0, 10000)
      }));

    let model;
    let currentContent;

    if (image) {
      // Qwen 3.6 27B accepts both text and image input.
      model = "qwen/qwen3.6-27b";
      currentContent = [
        {
          type: "text",
          text: message || "Analyze this image carefully and answer the visible question."
        },
        {
          type: "image_url",
          image_url: { url: image }
        }
      ];
    } else if (web) {
      // Compound provides server-side web search/tooling.
      model = "groq/compound";
      currentContent = message;
    } else {
      model = "openai/gpt-oss-20b";
      currentContent = message;
    }

    const requestBody = {
      model,
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: currentContent }
      ]
    };

    // Hidden reasoning is supported by Groq for reasoning models and prevents <think> text.
    if (!web) {
      requestBody.reasoning_format = "hidden";
      requestBody.temperature = 0.5;
      requestBody.max_completion_tokens = 2048;
    }

    if (web) {
      requestBody.compound_custom = {
        tools: {
          enabled_tools: ["web_search", "visit_website"]
        }
      };
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    const raw = await response.text();

    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      return res.status(502).json({ error: "Groq returned an invalid response." });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Groq API request failed."
      });
    }

    let answer = data?.choices?.[0]?.message?.content;
    if (Array.isArray(answer)) {
      answer = answer.map(x => x?.text || "").join("");
    }

    if (!answer) {
      return res.status(502).json({ error: "Groq returned no answer." });
    }

    answer = String(answer)
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
      .trim();

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("NiSa API error:", error);
    return res.status(500).json({
      error: error?.message || "Server error. Please try again."
    });
  }
}
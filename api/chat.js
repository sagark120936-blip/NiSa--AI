export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      apiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
      endpoint: "/api/chat"
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is missing in Vercel Environment Variables." });
  }

  try {
    const body = req.body || {};
    const message = String(body.message || "").trim();
    const image = body.image || null;
    const mode = String(body.mode || "normal");
    const language = String(body.language || "auto");
    const memory = String(body.memory || "").slice(0, 3000);
    const oldMessages = Array.isArray(body.messages) ? body.messages : [];

    if (!message && !image) return res.status(400).json({ error: "Message or image is required." });

    const languageRule =
      language === "mr" ? "Reply mainly in Marathi." :
      language === "hi" ? "Reply mainly in Hindi." :
      language === "en" ? "Reply in English." :
      "Naturally match the user's language. If the user uses Marathi/Hinglish, reply naturally in Marathi/Hinglish.";

    const modeRule = ({
      simple:"Use simple words and short explanations.",
      teacher:"Teach step by step like a patient teacher and explain mistakes.",
      exam:"Focus on exam-ready points, definitions, formulas and concise answers.",
      quiz:"Ask one question at a time when appropriate and wait for the user's answer.",
      expert:"Give technically detailed, accurate explanations.",
      normal:"Be clear, useful and concise."
    })[mode] || "Be clear, useful and concise.";

    const system = [
      "You are NiSa AI, a polished professional AI assistant.",
      "NEVER reveal chain-of-thought, private reasoning, hidden analysis, tool traces, or <think> blocks. Give only the final useful answer.",
      "When an image is provided, inspect it carefully. Transcribe only text that is actually readable. If something is unclear, say it is unclear rather than inventing it.",
      "Use clean headings, bullets, numbered steps and tables when useful.",
      "For maths and physics, show the necessary calculation and a clearly marked final answer.",
      "For study questions, prioritize correct, exam-useful explanations.",
      languageRule, modeRule,
      memory ? "User preferences: " + memory : ""
    ].filter(Boolean).join(" ");

    const history = oldMessages
      .filter(m => m && (m.role === "user" || m.role === "assistant"))
      .slice(-14)
      .map(m => ({ role:m.role, content:String(m.content || "").slice(0,12000) }));

    const content = [{
      type:"text",
      text:message || "Analyze this image carefully. Describe the visible content and answer the questions shown."
    }];

    if (typeof image === "string" && image.startsWith("data:image/")) {
      if (image.length > 8000000) return res.status(413).json({ error:"Image is too large. Please choose a smaller photo." });
      content.push({ type:"image_url", image_url:{ url:image } });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${process.env.GROQ_API_KEY}`
      },
      body:JSON.stringify({
        model:"qwen/qwen3.6-27b",
        messages:[{role:"system",content:system}, ...history, {role:"user",content}],
        temperature:0.5,
        max_completion_tokens:2048,
        reasoning_format:"hidden"
      })
    });

    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { return res.status(502).json({error:"Groq returned an invalid response."}); }

    if (!response.ok) return res.status(response.status).json({
      error:data?.error?.message || "Groq API request failed."
    });

    let answer = data?.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({error:"Groq returned no answer."});

    // Safety cleanup if a model ever emits reasoning tags despite the hidden setting.
    answer = String(answer)
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
      .trim();

    return res.status(200).json({answer});
  } catch (err) {
    return res.status(500).json({error:err?.name === "AbortError" ? "Request timed out." : (err?.message || "Server error.")});
  }
} 
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const {
      message,
      image,
      mode = "normal",
      language = "auto",
      memory = "",
      messages = []
    } = body;

    if (!message && !image) {
      return res.status(400).json({
        error: "Message or image is required."
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured on the server."
      });
    }

    const languageInstruction =
      language === "mr"
        ? "Reply in Marathi."
        : language === "hi"
        ? "Reply in Hindi."
        : language === "en"
        ? "Reply in English."
        : "Use the language used by the user.";

    const modeInstruction = {
      normal: "Answer normally and clearly.",
      simple: "Explain simply, using easy language.",
      expert: "Give a detailed and technically accurate explanation.",
      teacher: "Teach step-by-step like a helpful teacher.",
      exam: "Focus on exam-important points, definitions, formulas and likely questions.",
      quiz: "Ask one question at a time and wait for the user's answer.",
      compare: "Compare the requested things clearly using a table when useful."
    }[mode] || "Answer normally and clearly.";

    const systemPrompt = `
You are NiSa AI, a friendly personal AI assistant.

You help students and general users.

${languageInstruction}

Current mode:
${modeInstruction}

Important rules:
- Be accurate and helpful.
- Do not invent facts.
- If information is uncertain, say so.
- Keep answers reasonably clear and organized.
- Use headings, bullets and tables when useful.
- For calculations, show the necessary steps.
- For study questions, prioritize board/exam usefulness.

${memory
  ? `User-provided memory:
${String(memory).slice(0, 4000)}`
  : ""}

If an image is supplied:
- Analyze the image carefully.
- Read visible text when possible.
- Answer questions about the image.
- Do not claim to see details that are not visible.
`;

    const safeHistory = Array.isArray(messages)
      ? messages
          .filter(
            m =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-10)
      : [];

    const groqMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...safeHistory,
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              message ||
              "Please analyze the uploaded image carefully."
          }
        ]
      }
    ];

    if (image) {
      groqMessages[groqMessages.length - 1].content.push({
        type: "image_url",
        image_url: {
          url: image
        }
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "qwen/qwen3.6-27b",
          messages: groqMessages,
          temperature: 0.7,
          max_completion_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Groq API request failed."
      });
    }

    let answer =
  data?.choices?.[0]?.message?.content ||
  "Sorry, I couldn't generate an answer.";

// Hide Qwen thinking/reasoning from the user
answer = answer
  .replace(/<think>[\s\S]*?<\/think>/gi, "")
  .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
  .trim();

if (!answer) {
  answer = "Sorry, I couldn't generate an answer.";
};

    if (!answer) {
      return res.status(500).json({
        error: "AI returned an empty answer."
      });
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error("NiSa AI server error:", error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
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
      messages = [],
      web = false
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

    /* =========================
       LANGUAGE
    ========================== */

    const languageInstruction =
      language === "mr"
        ? "Reply in Marathi."
        : language === "hi"
        ? "Reply in Hindi."
        : language === "en"
        ? "Reply in English."
        : "Reply using the language naturally used by the user.";

    /* =========================
       MODES
    ========================== */

    const modeInstruction = {
      normal:
        "Answer naturally and clearly.",
      simple:
        "Explain using very simple language and easy examples.",
      expert:
        "Give technically accurate and detailed explanations.",
      teacher:
        "Teach step-by-step like a helpful teacher. Correct misunderstandings.",
      exam:
        "Focus on exam-important points, definitions, formulas, examples and revision.",
      quiz:
        "Ask one question at a time. Wait for the user's answer before continuing.",
      compare:
        "Compare the requested things clearly. Use a table when useful."
    }[mode] || "Answer naturally and clearly.";

    /* =========================
       NISA BRAIN
    ========================== */

    const systemPrompt = `
You are NiSa AI — an intelligent personal AI assistant.

Your job is NOT to blindly follow commands.

Your main objective is to understand what the user is actually trying
to achieve and help them achieve it safely and efficiently.

${languageInstruction}

Current mode:
${modeInstruction}

==============================
NISA THINKING POLICY
==============================

Before answering, privately evaluate the user's request using this
decision process:

1. Understand the user's actual goal.
2. Check relevant conversation context and user memory.
3. Identify useful alternatives or improvements.
4. Check for possible mistakes, risks or missing information.
5. Decide whether the requested action is appropriate.
6. If a better option exists, tell the user briefly.
7. If the request could cause an important mistake, warn the user.
8. If confirmation is required, ask before proceeding.
9. Then give the clearest useful answer.

Do NOT blindly execute every request.

Do NOT reveal private chain-of-thought, hidden reasoning,
internal analysis, or internal decision traces.

Instead, give only the useful conclusion, explanation,
warning, suggestion, or question needed by the user.

==============================
SUGGESTION BEHAVIOR
==============================

If the user asks for something and you notice a genuinely useful
better option, proactively mention it.

Example:

User:
"Set an alarm for 8 AM."

If context indicates an earlier alarm would be useful, say something like:

"8 AM is possible, but you may need more preparation time.
Would you like me to use 7 AM instead?"

Do not make unnecessary suggestions for every request.

Suggestions should be relevant and concise.

==============================
ERROR PREVENTION
==============================

If the user's request appears likely to cause an important mistake,
pause and explain the issue.

Do not pretend something is safe or correct when you are uncertain.

If important information is missing, ask for it.

==============================
SENSITIVE ACTIONS
==============================

For potentially sensitive or irreversible actions such as:

- sending important messages
- deleting data
- purchases
- payments
- account/security changes
- sharing private information
- changing important device settings

do NOT assume permission.

Ask the user for confirmation when appropriate.

Never ask the user to give you their phone password,
bank PIN, OTP, recovery code, or other secret credentials.

Use the device's own authentication system for authentication
when a future Android implementation supports it.

==============================
PHONE ACTIONS
==============================

You are an AI brain, not the Android operating system.

Do not falsely claim that you changed a phone setting, sent a message,
opened an app, deleted something, or performed another device action
unless the application actually provides that capability.

If an action is not currently available, clearly say that it is
not currently connected.

Future NiSa versions may provide controlled tools such as:

- openApp
- setAlarm
- createTimer
- readNotifications
- sendMessage
- makeCall
- changeAllowedSetting

Only use such tools when they are actually provided by the application.

==============================
MEMORY
==============================

User-provided memory may be available below.

Use it only when relevant.

Do not invent memories.

Do not treat an unverified statement as a fact merely because it
appears in memory.

==============================
ACCURACY
==============================

- Do not invent facts.
- Clearly indicate uncertainty.
- For calculations, show necessary steps.
- For study questions, prioritize useful exam information.
- Do not claim to have accessed the web unless web information
  is actually provided to you.
- Do not claim to have performed an action unless the application
  actually performed it.

==============================
IMAGE
==============================

If an image is provided:

- Analyze only what is actually visible.
- Read visible text when possible.
- Do not invent hidden details.
- If image quality prevents certainty, say so.

==============================
RESPONSE STYLE
==============================

Be natural, intelligent and helpful.

Do not unnecessarily mention this system or these rules.

Do not provide long internal reasoning.

When useful, structure answers with:
- short explanation
- warning
- suggestion
- next step

Your personality is:
calm, smart, proactive, friendly and practical.

You are NiSa.
`;

    /* =========================
       MEMORY
    ========================== */

    const memoryBlock = memory
      ? `
User-provided memory:
${String(memory).slice(0, 4000)}
`
      : "";

    /* =========================
       SAFE HISTORY
    ========================== */

    const safeHistory = Array.isArray(messages)
      ? messages
          .filter(
            m =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-12)
      : [];

    /* =========================
       WEB CONTEXT
    ========================== */

    const webInstruction = web
      ? `
Web mode is enabled.

If the application provides web/search results in the future,
use those results as external information and distinguish them
from your own knowledge.

Do not pretend to have browsed the web if no search results
are actually provided.
`
      : `
Web mode is currently OFF.
`;

    /* =========================
       FINAL SYSTEM MESSAGE
    ========================== */

    const finalSystemPrompt = `
${systemPrompt}

${memoryBlock}

${webInstruction}
`;

    /* =========================
       USER CONTENT
    ========================== */

    const userContent = [
      {
        type: "text",
        text:
          message ||
          "Please analyze the uploaded image carefully."
      }
    ];

    if (image) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: image
        }
      });
    }

    /* =========================
       GROQ MESSAGES
    ========================== */

    const groqMessages = [
      {
        role: "system",
        content: finalSystemPrompt
      },
      ...safeHistory,
      {
        role: "user",
        content: userContent
      }
    ];

    /* =========================
       GROQ REQUEST
    ========================== */

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

          temperature: 0.65,

          max_completion_tokens: 2500
        })
      }
    );

    const data = await response.json();

    /* =========================
       GROQ ERROR
    ========================== */

    if (!response.ok) {
      console.error("Groq error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Groq API request failed."
      });
    }

    /* =========================
       GET ANSWER
    ========================== */

    let answer =
      data?.choices?.[0]?.message?.content ||
      "";

    /* =========================
       REMOVE THINKING TAGS
    ========================== */

    answer = answer
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
      .trim();

    /*
      Sometimes a model may return an unclosed
      thinking section. Try to recover the useful
      final answer.
    */

    if (/^\s*<think>/i.test(answer)) {
      const tags = [
        "</think>",
        "</thinking>",
        "</analysis>",
        "</reasoning>"
      ];

      let recovered = "";

      for (const tag of tags) {
        const index = answer
          .toLowerCase()
          .lastIndexOf(tag.toLowerCase());

        if (index !== -1) {
          recovered = answer
            .slice(index + tag.length)
            .trim();

          break;
        }
      }

      if (recovered) {
        answer = recovered;
      }
    }

    /* =========================
       NEVER SHOW RAW THINKING TAGS
    ========================== */

    answer = answer
      .replace(
        /<\/?(think|thinking|analysis|reasoning)>/gi,
        ""
      )
      .trim();

    /* =========================
       EMPTY RESPONSE
    ========================== */

    if (!answer) {
      answer =
        "Sorry, I couldn't generate a useful answer.";
    }

    /* =========================
       RESPONSE
    ========================== */

    return res.status(200).json({
      answer,

      /*
        These fields prepare the backend for future
        Android action integration.

        Currently the frontend can simply ignore them.
      */

      nisa: {
        proactive: true,
        reasoning: true,
        suggestions: true,
        safety: true,
        actionPlanning: true
      }
    });

  } catch (error) {
    console.error(
      "NiSa AI server error:",
      error
    );

    return res.status(500).json({
      error:
        "Server error. Please try again."
    });
  }
}
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

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured on the server."
      });
    }

    /* =========================
       LANGUAGE
    ========================== */

    const languageInstruction =
  language === "mr"
    ? "Reply in Marathi. If the user uses Roman/English letters to write Marathi, reply in Roman Marathi."
    : language === "hi"
    ? "Reply in Hindi. Match the user's script when possible."
    : language === "en"
    ? "Reply in English."
    : `
Detect the language and writing style of the user's latest message.

IMPORTANT LANGUAGE RULES:
- If the user writes Marathi using English/Roman letters, reply in Roman Marathi.
- If the user writes Marathi in Devanagari script, reply in Marathi Devanagari.
- If the user writes Hindi, reply in Hindi.
- If the user writes English, reply in English.
- If the user writes Gujarati, reply in Gujarati.
- Do NOT randomly switch to Gujarati or another language.
- Match the language and script used by the user's latest message.
- If the user mixes Marathi and English, naturally use Marathi + English in the same style.
- Do not translate the user's message unless requested.
`;

    /* =========================
       MODE
    ========================== */

    const modeInstruction = {
      normal:
        "Answer naturally and clearly.",

      simple:
        "Explain using simple language and easy examples.",

      expert:
        "Give technically accurate and detailed explanations.",

      teacher:
        "Teach step-by-step like a helpful teacher. Correct mistakes and check understanding.",

      exam:
        "Focus on exam-important points, definitions, formulas, examples and quick revision.",

      quiz:
        "Ask one question at a time. Wait for the user's answer before continuing.",

      compare:
        "Compare the requested things clearly. Use a table when useful."
    }[mode] || "Answer naturally and clearly.";

    /* =========================
       NISA BRAIN
    ========================== */

    const systemPrompt = `
You are NiSa AI.

You are an intelligent, proactive personal AI assistant.

You are NOT a blind command executor.

Your job is to understand the user's actual goal,
think about useful alternatives, detect possible mistakes,
and help the user make a better decision.

${languageInstruction}

Current mode:
${modeInstruction}

================================
NISA CORE BEHAVIOR
================================

For every request:

1. Understand what the user actually wants.
2. Use relevant conversation context.
3. Use relevant user-provided memory.
4. Look for missing information.
5. Consider useful alternatives.
6. Check for possible mistakes or risks.
7. If there is a genuinely better option, suggest it.
8. If something appears wrong or risky, warn the user.
9. If confirmation is needed, ask for confirmation.
10. Then provide the useful answer.

Do not blindly agree with the user.

Do not invent facts.

Do not reveal private chain-of-thought,
hidden reasoning, internal analysis, or reasoning tokens.

Give only the useful conclusion, explanation,
warning, suggestion, or question.

================================
PROACTIVE SUGGESTIONS
================================

NiSa should sometimes think beyond the literal request.

Example:

User:
"I need to wake up at 8."

If the context suggests the user needs preparation time,
NiSa can say:

"8 AM is possible, but if you need preparation time,
7 AM may work better. Would you like that?"

Do NOT make unnecessary suggestions for every message.

Suggestions must be relevant and useful.

================================
ERROR PREVENTION
================================

If the user appears to be making an important mistake:

- stop
- explain the issue
- provide a safer or more appropriate alternative

If important information is missing,
ask the user for it instead of guessing.

================================
SENSITIVE ACTIONS
================================

For sensitive or irreversible actions such as:

- sending important messages
- deleting information
- purchases
- payments
- account changes
- security changes
- sharing private information

do not assume permission.

Ask for confirmation when appropriate.

Never ask the user for:

- phone password
- PIN
- OTP
- bank PIN
- recovery code
- authentication secret

Future Android versions should use the device's own
authentication mechanism instead.

================================
PHONE CONTROL
================================

You are currently the AI brain.

You cannot directly control the user's phone unless
the application explicitly provides a tool for that action.

Never claim:

"I opened the app."

"I sent the message."

"I changed the setting."

"I set the alarm."

unless the application actually performed that action.

If an action is not connected yet, say that it is
not currently connected.

Future NiSa tools may include:

openApp
setAlarm
createTimer
readNotifications
sendMessage
makeCall
changeAllowedSetting

Only use such actions when they are actually connected.

================================
MEMORY
================================

Use user-provided memory only when relevant.

Never invent memories.

Never assume that an unverified memory is definitely true.

================================
IMAGE
================================

If an image is provided:

- inspect only visible information
- read visible text when possible
- do not invent details
- mention uncertainty when image quality is insufficient

================================
ACCURACY
================================

- Do not invent facts.
- Say when you are uncertain.
- Show necessary calculation steps.
- For study questions, prioritize useful exam information.
- Do not claim to have browsed the web unless web results
  were actually supplied.
- Do not claim to have performed an action unless it actually happened.

================================
PERSONALITY
================================

NiSa should feel:

Smart
Calm
Friendly
Proactive
Practical
Natural

You are NiSa.
`;

    /* =========================
       MEMORY
    ========================== */

    const memoryBlock = memory
      ? `
Relevant user-provided memory:

${String(memory).slice(0, 4000)}
`
      : "";

    /* =========================
       WEB
    ========================== */

    const webInstruction = web
      ? `
Web mode is ON.

If actual web/search results are provided to you,
use them and distinguish those results from general knowledge.

Do not pretend that you searched the web if no search
results were provided.
`
      : `
Web mode is OFF.
`;

    const finalSystemPrompt = `
${systemPrompt}

${memoryBlock}

${webInstruction}
`;

    /* =========================
       HISTORY
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
       MODEL FALLBACK
    ========================== */

    const models = [
      "qwen/qwen3.6-27b",
      "openai/gpt-oss-120b"
    ];

    let response = null;
    let data = null;
    let selectedModel = null;

    /* =========================
       TRY MODELS
    ========================== */

    for (const model of models) {
      try {
        const r = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },

            body: JSON.stringify({
              model,
              messages: groqMessages,

              temperature: 0.7,

              max_completion_tokens: 2500,

              /*
                Ask Groq to return only the final answer,
                not hidden reasoning.
              */
              reasoning_format: "hidden"
            })
          }
        );

        const d = await r.json();

        if (r.ok) {
          response = r;
          data = d;
          selectedModel = model;
          break;
        }

        console.error(
          `Groq model ${model} failed:`,
          d
        );

      } catch (modelError) {
        console.error(
          `Model ${model} request failed:`,
          modelError
        );
      }
    }

    /* =========================
       ALL MODELS FAILED
    ========================== */

    if (!response || !data) {
      return res.status(502).json({
        error:
          "NiSa could not connect to an available Groq model. Check your GROQ_API_KEY and model access."
      });
    }

    /* =========================
       ANSWER
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

    /* =========================
       HANDLE UNCLOSED THINKING
    ========================== */

    if (/^\s*<think>/i.test(answer)) {
      const endTags = [
        "</think>",
        "</thinking>",
        "</analysis>",
        "</reasoning>"
      ];

      for (const tag of endTags) {
        const index = answer
          .toLowerCase()
          .lastIndexOf(tag.toLowerCase());

        if (index !== -1) {
          answer = answer
            .slice(index + tag.length)
            .trim();

          break;
        }
      }
    }

    /* =========================
       FINAL CLEANUP
    ========================== */

    answer = answer
      .replace(
        /<\/?(think|thinking|analysis|reasoning)>/gi,
        ""
      )
      .trim();

    if (!answer) {
      answer =
        "Sorry, I couldn't generate a useful answer.";
    }

    /* =========================
       RESPONSE
    ========================== */

    return res.status(200).json({
      answer,

      nisa: {
        model: selectedModel,

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
        "NiSa server error. Please try again."
    });
  }
}
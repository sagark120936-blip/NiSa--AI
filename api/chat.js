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

    let languageInstruction = "";

    if (language === "mr") {
      languageInstruction = `
Reply in Marathi.

IMPORTANT:
- If user writes Marathi in Roman/English letters,
  reply ONLY in Roman Marathi.
- If user writes Marathi in Devanagari,
  reply ONLY in Marathi Devanagari.
- Do not randomly change script.
`;
    } else if (language === "hi") {
      languageInstruction = `
Reply in Hindi.
Match the script used by the user.
`;
    } else if (language === "en") {
      languageInstruction = `
Reply in English.
`;
    } else {
      languageInstruction = `
Detect the language AND SCRIPT of the user's latest message.

STRICT RULES:

1. Roman Marathi → ONLY Roman Marathi.
2. Marathi Devanagari → ONLY Marathi Devanagari.
3. English → English.
4. Hindi → Hindi.
5. Mixed Roman Marathi + English → natural Roman Marathi + English.
6. Never randomly switch to Gujarati or another language.
7. If the latest message is Roman Marathi,
   DO NOT use Devanagari characters.
8. Match the latest message.
`;
    }

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
       NISA SYSTEM
    ========================== */

    const systemPrompt = `
You are NiSa AI.

You are an intelligent, proactive personal AI assistant.

You are NOT a blind command executor.

Your job is to:

- understand the user's real goal
- think before answering
- detect mistakes
- detect possible risks
- suggest useful alternatives
- ask for missing information
- ask for confirmation when necessary
- never pretend an action was performed

${languageInstruction}

Current mode:
${modeInstruction}

================================
NISA CORE BEHAVIOR
================================

For every request:

1. Understand the real goal.
2. Check conversation context.
3. Use relevant user-provided memory.
4. Detect missing information.
5. Consider useful alternatives.
6. Check for mistakes or risks.
7. Give useful suggestions when appropriate.
8. Warn about important problems.
9. If a phone action is requested, create an action plan.
10. Give the useful answer.

Do not blindly agree.

Do not invent facts.

Do not reveal hidden chain-of-thought or internal reasoning.

================================
ACTION PLANNER
================================

The current web application does NOT directly control Android.

Therefore:

- Never claim an Android action was completed.
- Never say "Done" for an unconnected phone action.
- Action plans are requests waiting for user confirmation.
- Confirmation must happen before an action is sent to Android.

Supported first-stage actions:

1. setAlarm
2. createTimer

================================
SET ALARM
================================

When the user requests an alarm, create:

<action_plan>
{
  "requiresConfirmation": true,
  "action": "setAlarm",
  "params": {
    "hour": 7,
    "minutes": 0,
    "message": "NiSa Alarm"
  },
  "description": "7:00 vajta alarm set karaycha aahe."
}
</action_plan>

Rules:

- hour must be 0-23.
- minutes must be 0-59.
- Always provide numeric hour and minutes.
- If the exact time is missing, ASK the user for the time.
- Do not guess the time.

For a one-time alarm, do not invent repeat days.

================================
CREATE TIMER
================================

When the user requests a timer, create:

<action_plan>
{
  "requiresConfirmation": true,
  "action": "createTimer",
  "params": {
    "seconds": 600,
    "message": "NiSa Timer"
  },
  "description": "10 minute timer start karaycha aahe."
}
</action_plan>

Rules:

- seconds must be a positive integer.
- Convert minutes/hours into seconds.
- If duration is missing, ASK the user.
- Do not guess the duration.

Examples:

"10 minute timer lav"

→ seconds = 600

"1 hour timer lav"

→ seconds = 3600

"90 second timer lav"

→ seconds = 90

================================
CONFIRMATION
================================

For phone actions:

1. Explain what NiSa wants to do.
2. Create the action_plan.
3. Wait for confirmation.

Never execute an action merely because the user originally requested it.

The frontend confirmation button is the approval step.

================================
OTHER PHONE ACTIONS
================================

Do NOT create executable plans for:

- payments
- purchases
- deleting important data
- account/security changes
- sending important messages
- sharing private information

unless a future explicitly connected and authorized tool supports them.

Never ask for:

- password
- PIN
- OTP
- bank PIN
- recovery code
- authentication secret

================================
PHONE CONTROL STATUS
================================

Current application:

AI brain = connected

Android phone control = NOT connected yet

Therefore never claim:

"I set the alarm."

"I started the timer."

"I opened the app."

"I sent the message."

unless an actual connected Android tool performs it.

================================
MEMORY
================================

Use user-provided memory only when relevant.

Never invent memories.

================================
IMAGE
================================

If an image is provided:

- inspect visible information
- read visible text when possible
- don't invent details
- mention uncertainty when needed

================================
ACCURACY
================================

- Do not invent facts.
- Say when uncertain.
- Show necessary calculation steps.
- For study questions, prioritize exam-useful information.
- Do not claim web browsing unless actual results are provided.
- Do not claim actions were performed.

================================
PERSONALITY
================================

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

If actual web/search results are provided,
use them and distinguish them from general knowledge.

Do not pretend to have searched the web
when no search results are provided.
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

    let data = null;
    let selectedModel = null;

    /* =========================
       TRY MODELS
    ========================== */

    for (const model of models) {
      try {
        const response = await fetch(
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
              reasoning_format: "hidden"
            })
          }
        );

        const result = await response.json();

        if (response.ok) {
          data = result;
          selectedModel = model;
          break;
        }

        console.error(
          `Groq model ${model} failed:`,
          result
        );

      } catch (error) {
        console.error(
          `Model ${model} request failed:`,
          error
        );
      }
    }

    /* =========================
       ALL MODELS FAILED
    ========================== */

    if (!data) {
      return res.status(502).json({
        error:
          "NiSa could not connect to an available Groq model. Check your GROQ_API_KEY and model access."
      });
    }

    /* =========================
       RAW ANSWER
    ========================== */

    let rawAnswer =
      data?.choices?.[0]?.message?.content || "";

    rawAnswer = String(rawAnswer).trim();

    /* =========================
       ACTION PLAN PARSER
    ========================== */

    let actionPlan = null;

    const actionMatch = rawAnswer.match(
      /<action_plan>\s*([\s\S]*?)\s*<\/action_plan>/i
    );

    if (actionMatch) {
      try {
        actionPlan = JSON.parse(actionMatch[1]);
      } catch (error) {
        console.error(
          "Action plan JSON parse failed:",
          error
        );

        actionPlan = null;
      }

      rawAnswer = rawAnswer
        .replace(
          /<action_plan>\s*[\s\S]*?\s*<\/action_plan>/i,
          ""
        )
        .trim();
    }

    /* =========================
       ACTION PLAN VALIDATION
    ========================== */

    if (
      actionPlan &&
      actionPlan.requiresConfirmation !== true
    ) {
      actionPlan = null;
    }

    if (
      actionPlan &&
      typeof actionPlan.action !== "string"
    ) {
      actionPlan = null;
    }

    if (
      actionPlan &&
      typeof actionPlan.description !== "string"
    ) {
      actionPlan = null;
    }

    /* =========================
       ALARM VALIDATION
    ========================== */

    if (
      actionPlan &&
      actionPlan.action === "setAlarm"
    ) {
      const p = actionPlan.params;

      if (
        !p ||
        !Number.isInteger(p.hour) ||
        !Number.isInteger(p.minutes) ||
        p.hour < 0 ||
        p.hour > 23 ||
        p.minutes < 0 ||
        p.minutes > 59
      ) {
        console.error(
          "Invalid alarm action plan:",
          actionPlan
        );

        actionPlan = null;
      }
    }

    /* =========================
       TIMER VALIDATION
    ========================== */

    if (
      actionPlan &&
      actionPlan.action === "createTimer"
    ) {
      const p = actionPlan.params;

      if (
        !p ||
        !Number.isInteger(p.seconds) ||
        p.seconds <= 0
      ) {
        console.error(
          "Invalid timer action plan:",
          actionPlan
        );

        actionPlan = null;
      }
    }

    /* =========================
       ALLOWED ACTIONS ONLY
    ========================== */

    const allowedActions = [
      "setAlarm",
      "createTimer"
    ];

    if (
      actionPlan &&
      !allowedActions.includes(actionPlan.action)
    ) {
      console.error(
        "Unsupported action:",
        actionPlan.action
      );

      actionPlan = null;
    }

    /* =========================
       REMOVE THINKING TAGS
    ========================== */

    let answer = rawAnswer
      .replace(
        /<think>[\s\S]*?<\/think>/gi,
        ""
      )
      .replace(
        /<thinking>[\s\S]*?<\/thinking>/gi,
        ""
      )
      .replace(
        /<analysis>[\s\S]*?<\/analysis>/gi,
        ""
      )
      .replace(
        /<reasoning>[\s\S]*?<\/reasoning>/gi,
        ""
      )
      .trim();

    /* =========================
       UNCLOSED THINKING
    ========================== */

    if (/^\s*<think>/i.test(answer)) {
      const endTags = [
        "</think>",
        "</thinking>",
        "</analysis>",
        "</reasoning>"
      ];

      for (const tag of endTags) {
        const index =
          answer
            .toLowerCase()
            .lastIndexOf(
              tag.toLowerCase()
            );

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

      actionPlan,

      nisa: {
        model: selectedModel,
        proactive: true,
        reasoning: true,
        suggestions: true,
        safety: true,
        actionPlanning: Boolean(actionPlan)
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
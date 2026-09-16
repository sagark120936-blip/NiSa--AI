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
- If the user writes Marathi using Roman/English letters,
  reply ONLY in Roman Marathi.
- If the user writes Marathi using Devanagari,
  reply ONLY in Marathi Devanagari.
- Do not randomly switch scripts.
`;
    } 
    else if (language === "hi") {
      languageInstruction = `
Reply in Hindi.
Match the script used by the user.
`;
    } 
    else if (language === "en") {
      languageInstruction = `
Reply in English.
`;
    } 
    else {
      languageInstruction = `
Detect the language AND SCRIPT of the user's latest message.

STRICT LANGUAGE RULES:

1. Roman Marathi:
   If the user writes Marathi using English/Roman letters,
   reply ONLY in Roman Marathi.

2. Marathi Devanagari:
   If the user writes Marathi using Devanagari,
   reply ONLY in Marathi Devanagari.

3. English:
   Reply in English.

4. Hindi:
   Reply in Hindi.

5. Mixed Roman Marathi + English:
   Prefer natural Roman Marathi + English.

6. Never randomly switch to Gujarati or another language.

7. If the user's latest message is Roman Marathi,
   DO NOT use Devanagari characters in the answer.

8. Match the user's latest message rather than older messages.
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
- never pretend that an action was performed

${languageInstruction}

Current mode:
${modeInstruction}

================================
NISA CORE BEHAVIOR
================================

For every request:

1. Understand what the user actually wants.
2. Check conversation context.
3. Use relevant user-provided memory.
4. Look for missing information.
5. Consider useful alternatives.
6. Check for mistakes or risks.
7. If a genuinely useful suggestion exists, mention it.
8. If something is wrong or risky, warn the user.
9. If an action requires confirmation, create an action plan.
10. Give the useful answer.

Do not blindly agree with the user.

Do not invent facts.

Do not reveal private chain-of-thought,
hidden reasoning, internal analysis, or reasoning tokens.

================================
ACTION PLANNER
================================

You may identify an intended action such as:

- setAlarm
- createTimer
- openApp
- readNotifications
- sendMessage
- makeCall
- changeAllowedSetting

BUT remember:

The current web application does NOT directly control the Android phone.

Therefore:

- Never claim that a phone action was completed.
- Never say "Done" for an unconnected phone action.
- If an action is not connected, explain that it is not connected yet.
- For sensitive or irreversible actions, confirmation is required.

When an action should require confirmation, your response MUST include
this exact JSON block at the END of your answer:

<action_plan>
{
  "requiresConfirmation": true,
  "action": "ACTION_NAME",
  "description": "Short description of the action"
}
</action_plan>

When no action is required, do NOT include an action_plan block.

Examples:

User:
"Udya 7 vajta alarm lav"

Response:
"Udya 7 vajta alarm lavu ka?

<action_plan>
{
  "requiresConfirmation": true,
  "action": "setAlarm",
  "description": "Udya sakali 7:00 vajta alarm set karaycha aahe."
}
</action_plan>"

User:
"10 minute timer lav"

Response:
"10 minute timer start karu ka?

<action_plan>
{
  "requiresConfirmation": true,
  "action": "createTimer",
  "description": "10 minute timer start karaycha aahe."
}
</action_plan>"

================================
SENSITIVE ACTIONS
================================

For:

- payments
- purchases
- deleting important information
- account/security changes
- sending important messages
- sharing private information

always require appropriate confirmation.

Never ask for:

- phone password
- PIN
- OTP
- bank PIN
- recovery code
- authentication secret

Use device/system authentication when a future native Android
integration supports it.

================================
PHONE CONTROL
================================

The current application is only the AI brain.

Actual phone actions are NOT connected yet.

Never claim:

"I opened the app."

"I sent the message."

"I changed the setting."

"I set the alarm."

unless an actual connected tool performed it.

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
- do not invent details
- mention uncertainty if image quality is insufficient

================================
ACCURACY
================================

- Do not invent facts.
- Say when uncertain.
- Show necessary calculation steps.
- For study questions, prioritize exam-useful information.
- Do not claim to browse the web unless actual web results are provided.
- Do not claim to perform an action unless it actually happened.

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

Do not pretend that you searched the web when
no search results were provided.
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
      data?.choices?.[0]?.message?.content ||
      "";

    rawAnswer = String(rawAnswer).trim();

    /* =========================
       ACTION PLAN PARSER
    ========================== */

    let actionPlan = null;

    const actionMatch =
      rawAnswer.match(
        /<action_plan>\s*([\s\S]*?)\s*<\/action_plan>/i
      );

    if (actionMatch) {

      try {

        actionPlan =
          JSON.parse(
            actionMatch[1]
          );

      } catch (error) {

        console.error(
          "Action plan JSON parse failed:",
          error
        );

        actionPlan = null;

      }

      rawAnswer =
        rawAnswer
          .replace(
            /<action_plan>\s*[\s\S]*?\s*<\/action_plan>/i,
            ""
          )
          .trim();

    }

    /* =========================
       SAFETY VALIDATION
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
       REMOVE THINKING TAGS
    ========================== */

    let answer =
      rawAnswer
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

    if (
      /^\s*<think>/i.test(answer)
    ) {

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

          answer =
            answer
              .slice(
                index + tag.length
              )
              .trim();

          break;

        }

      }

    }

    /* =========================
       FINAL CLEANUP
    ========================== */

    answer =
      answer
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

        actionPlanning: Boolean(
          actionPlan
        )

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
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      message,
      image,
      mode,
      language,
      memory,
      messages
    } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({
        error: "Message or image is required"
      });
    }

    const systemPrompt = `
You are NiSa AI, a friendly personal AI assistant.

Answer clearly, helpfully and appropriately for students.

Mode: ${mode || "normal"}
Language: ${language || "auto"}

${memory ? `User memory:\n${memory}` : ""}

If an image is provided:
- Carefully analyze the image.
- Read visible text when possible.
- Answer the user's question about the image.
- Do not say that you cannot see images.
`;

    const userContent = [];

    userContent.push({
      type: "text",
      text: message || "Please analyze this image carefully."
    });

    // IMAGE SUPPORT
    if (image) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: image
        }
      });
    }

    const previousMessages = Array.isArray(messages)
      ? messages.slice(-10)
      : [];

    const groqMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...previousMessages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      {
        role: "user",
        content: userContent
      }
    ];

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
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
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Groq API error"
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate an answer.";

    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error("NiSa AI error:", error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
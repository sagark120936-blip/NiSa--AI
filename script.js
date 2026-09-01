document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");
    const chatBox = document.getElementById("chatBox");

    //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
    const OPENAI_API_KEY = "तुमची_नवीन_API_KEY_इथे_टाका"; 

    function appendMessage(text, sender) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender === "user" ? "user-message" : "ai-message");
        messageDiv.innerText = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function getAIResponse(userMessage) {
        const url = "https://openai.com";

        const loadingDiv = document.createElement("div");
        loadingDiv.innerText = "AI विचार करत आहे...";
        chatBox.appendChild(loadingDiv);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo", 
                    messages: [{ role: "user", content: userMessage }]
                })
            });

            // "AI विचार करत आहे..." काढून टाका
            chatBox.removeChild(loadingDiv);

            if (response.ok) {
                const data = await response.json();
                const aiReply = data.choices[0].message.content;
                appendMessage(aiReply, "ai");
            } else {
                // इथे आपल्याला नेमका एरर कोड समजेल (उदा. 401 म्हणजे की चुकीची आहे)
                appendMessage(`सर्वर एरर आलं! कोड: ${response.status}. तुमची नवीन API Key तपासा किंवा बॅलन्स चेक करा.`, "ai");
            }

        } catch (error) {
            chatBox.removeChild(loadingDiv);
            // जर ब्राउझरने रिक्वेस्ट ब्लॉक केली तर:
            appendMessage("कनेक्शन ब्लॉक झाले! कृपया नवीन API Key वापरा किंवा ब्राउझरचे Ad-blocker बंद करा.", "ai");
        }
    }

    function handleSend() {
        const message = userInput.value.trim();
        if (message === "") return;
        appendMessage(message, "user");
        userInput.value = "";
        getAIResponse(message);
    }

    sendBtn.addEventListener("click", handleSend);
    userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleSend(); });
});

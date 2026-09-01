document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");
    const chatBox = document.getElementById("chatBox");

    //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
    const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE"; 

    // मेसेज स्क्रीनवर दाखवण्याचे फंक्शन
    function appendMessage(text, sender) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender === "user" ? "user-message" : "ai-message");
        messageDiv.innerText = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight; // ऑटो स्क्रोल खाली जाण्यासाठी
    }

    // ChatGPT कडून उत्तर मागवणारे मुख्य फंक्शन
    async function getAIResponse(userMessage) {
        const url = "https://openai.com";

        // तात्पुरता "Typing..." मेसेज दाखवा
        const loadingDiv = document.createElement("div");
        loadingDiv.classList.add("message", "ai-message");
        loadingDiv.innerText = "विचार करत आहे...";
        chatBox.appendChild(loadingDiv);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo", // तुम्ही gpt-4o किंवा नवीन मॉडेल देखील वापरू शकता
                    messages: [
                        { role: "system", content: "You are a helpful AI assistant." },
                        { role: "user", content: userMessage }
                    ]
                })
            });

            const data = await response.json();
            
            // "Typing..." मेसेज काढून टाका
            chatBox.removeChild(loadingDiv);

            if (response.ok) {
                const aiReply = data.choices[0].message.content;
                appendMessage(aiReply, "ai");
            } else {
                console.error("API Error:", data);
                appendMessage("क्षमस्व, काहीतरी गडबड झाली आहे. कृपया API Key तपासा.", "ai");
            }

        } catch (error) {
            console.error("Network Error:", error);
            chatBox.removeChild(loadingDiv);
            appendMessage("नेटवर्क कनेक्शन एरर! इंटरनेट तपासा.", "ai");
        }
    }

    // सेंड प्रोसेस मॅनेज करणे
    function handleSend() {
        const message = userInput.value.trim();
        if (message === "") return;

        // १. युझरचा मेसेज दाखवा
        appendMessage(message, "user");
        userInput.value = ""; // इनपुट बॉक्स रिकामा करा

        // २. खरी API रिक्वेस्ट पाठवा
        getAIResponse(message);
    }

    // बटन क्लिक आणि एंटर की इव्हेंट्स
    sendBtn.addEventListener("click", handleSend);
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSend();
        }
    });
});

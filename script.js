document.addEventListener("DOMContentLoaded", () => {
    // 1. चेक करना कि कोड काम कर रहा है या नहीं
    alert("जावास्क्रिप्ट फाइल कनेक्ट हो गई है!"); 

    const sendBtn = document.getElementById("sendBtn");
    const userInput = document.getElementById("userInput");
    const chatBox = document.getElementById("chatBox");

    if (!sendBtn) {
        alert("गड़बड़: HTML में sendBtn नाम का बटन नहीं मिला!");
        return;
    }

    sendBtn.addEventListener("click", () => {
        const text = userInput.value.trim();
        if(text === "") return;

        // यूजर का मैसेज दिखाना
        const userDiv = document.createElement("div");
        userDiv.innerText = "You: " + text;
        chatBox.appendChild(userDiv);

        userInput.value = ""; // इनपुट खाली करना
    });
});

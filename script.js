"use strict";

const STORAGE_CHAT = "nisa_chat_v4";
const STORAGE_MEMORY = "nisa_memory_v4";
const STORAGE_THEME = "nisa_theme_v4";
const STORAGE_LANGUAGE = "nisa_language_v4";

let history = [];
let memory = "";
let selectedImage = null;
let webMode = false;
let stream = null;
let capturedData = null;
let timerSeconds = 1500;
let timerId = null;
let abortController = null;
let isGenerating = false;


/* -------------------------
   SAFE STORAGE
------------------------- */

try {
  const saved = localStorage.getItem(STORAGE_CHAT);
  history = saved ? JSON.parse(saved) : [];

  if (!Array.isArray(history)) {
    history = [];
  }
} catch {
  history = [];
}

memory =
  localStorage.getItem(STORAGE_MEMORY) || "";


/* -------------------------
   ELEMENTS
------------------------- */

const chat =
  document.getElementById("chat");

const input =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const fileInput =
  document.getElementById("imageInput");

const previewBox =
  document.getElementById("imagePreviewBox");


/* -------------------------
   HELPERS
------------------------- */

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]
  );
}


function formatAnswer(value) {

  let text = escapeHtml(value);

  text = text.replace(
    /```([\s\S]*?)```/g,
    `<pre>$1</pre>`
  );

  text = text.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  return text.replace(/\n/g, "<br>");
}


function saveHistory() {
  try {
    localStorage.setItem(
      STORAGE_CHAT,
      JSON.stringify(history.slice(-80))
    );
  } catch {}
}


function scrollChat() {
  chat.scrollTop = chat.scrollHeight;
}


/* -------------------------
   PANELS
------------------------- */

function openPanel(id) {

  const panel =
    document.getElementById(id);

  if (panel) {
    panel.classList.add("open");
  }
}


function closePanel(id) {

  const panel =
    document.getElementById(id);

  if (panel) {
    panel.classList.remove("open");
  }
}


/* -------------------------
   CHAT RENDER
------------------------- */

function renderHistory() {

  chat.innerHTML = `
    <div class="welcome">
      <h2>👋 Hello! I'm NiSa AI</h2>
      <p>
        Ask me anything, upload a photo,
        or use the camera.
      </p>
    </div>
  `;

  history.forEach((message, index) => {

    addMessage(
      message.role === "assistant"
        ? "ai"
        : "user",

      message.text || "",

      message.image || null,

      index
    );

  });

  scrollChat();
}


function addMessage(
  role,
  text,
  image = null,
  index = -1
) {

  const element =
    document.createElement("div");

  element.className =
    `message ${role}`;


  if (image) {

    const img =
      document.createElement("img");

    img.src = image;
    img.className = "preview";
    img.alt = "Uploaded image";

    element.appendChild(img);
  }


  const body =
    document.createElement("div");

  body.className = "message-body";


  if (role === "ai") {
    body.innerHTML =
      formatAnswer(text);
  } else {
    body.textContent = text;
  }


  element.appendChild(body);


  const actions =
    document.createElement("div");

  actions.className =
    "msg-actions";


  if (role === "ai") {

    actions.innerHTML = `
      <button type="button"
        data-action="copy">
        📋 Copy
      </button>

      <button type="button"
        data-action="read">
        🔊 Read
      </button>

      <button type="button"
        data-action="regenerate"
        data-index="${index}">
        🔄 Regenerate
      </button>
    `;

  } else {

    actions.innerHTML = `
      <button type="button"
        data-action="edit"
        data-index="${index}">
        ✏️ Edit
      </button>
    `;
  }


  element.appendChild(actions);


  if (role === "ai") {

    const confidence =
      document.createElement("div");

    confidence.className =
      "confidence";

    confidence.textContent =
      "AI answer • verify important facts";

    element.appendChild(confidence);
  }


  chat.appendChild(element);
}


/* -------------------------
   COPY
------------------------- */

async function copyText(button) {

  const message =
    button.closest(".message");

  const body =
    message?.querySelector(".message-body");

  const text =
    body?.innerText || "";

  try {

    if (navigator.clipboard) {

      await navigator.clipboard.writeText(text);

    } else {

      fallbackCopy(text);
    }

    const old =
      button.textContent;

    button.textContent =
      "✅ Copied";

    setTimeout(() => {
      button.textContent = old;
    }, 1000);

  } catch {

    fallbackCopy(text);
  }
}


function fallbackCopy(text) {

  const textarea =
    document.createElement("textarea");

  textarea.value = text;

  document.body.appendChild(
    textarea
  );

  textarea.select();

  try {
    document.execCommand("copy");
  } catch {}

  textarea.remove();
}


/* -------------------------
   TEXT TO SPEECH
------------------------- */

function getSpeechLanguage() {

  const language =
    document.getElementById(
      "langSelect"
    )?.value || "auto";

  if (language === "mr")
    return "mr-IN";

  if (language === "hi")
    return "hi-IN";

  return "en-IN";
}


function speakText(button) {

  const body =
    button.closest(".message")
      ?.querySelector(".message-body");

  if (
    !body ||
    !("speechSynthesis" in window)
  ) {

    alert(
      "Read-aloud is not supported here."
    );

    return;
  }

  speechSynthesis.cancel();

  const speech =
    new SpeechSynthesisUtterance(
      body.innerText
    );

  speech.lang =
    getSpeechLanguage();

  speechSynthesis.speak(
    speech
  );
}


/* -------------------------
   EDIT
------------------------- */

function editMessage(index) {

  const message =
    history[index];

  if (
    !message ||
    message.role !== "user"
  ) {
    return;
  }

  input.value =
    message.text || "";

  if (message.image) {

    selectedImage =
      message.image;

    showPreview(
      message.image
    );
  }

  input.focus();
}


/* -------------------------
   REGENERATE
------------------------- */

function regenerate(index) {

  const assistant =
    history[index];

  if (
    !assistant ||
    assistant.role !== "assistant"
  ) {
    return;
  }

  const user =
    history[index - 1];

  if (
    !user ||
    user.role !== "user"
  ) {
    return;
  }

  sendExistingMessage(
    user.text || "",
    user.image || null
  );
}


/* -------------------------
   SEND
------------------------- */

async function sendMessage() {

  if (isGenerating) {
    stopGeneration();
    return;
  }

  const text =
    input.value.trim();

  if (
    !text &&
    !selectedImage
  ) {
    return;
  }

  const image =
    selectedImage;

  input.value = "";

  clearPreview();

  await sendExistingMessage(
    text,
    image,
    true
  );
}


async function sendExistingMessage(
  text,
  image = null,
  saveUser = false
) {

  if (isGenerating) {
    return;
  }

  const mode =
    document.getElementById(
      "mode"
    )?.value || "normal";

  const language =
    document.getElementById(
      "langSelect"
    )?.value || "auto";


  if (saveUser) {

    const userText =
      text ||
      "Please analyze this image.";

    history.push({
      role: "user",
      text: userText,
      image: image || null
    });

    saveHistory();

    addMessage(
      "user",
      userText,
      image,
      history.length - 1
    );
  }


  const aiElement =
    document.createElement("div");

  aiElement.className =
    "message ai";


  aiElement.innerHTML = `
    <div class="thinking">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  `;

  chat.appendChild(
    aiElement
  );

  scrollChat();


  isGenerating = true;

  sendBtn.textContent =
    "Stop";

  sendBtn.classList.add(
    "stop"
  );


  abortController =
    new AbortController();


  try {

    const messages =
      history
        .slice(-10)
        .map(message => ({
          role:
            message.role,
          content:
            String(
              message.text || ""
            )
        }));


    const payload = {

      message:
        text ||
        "Analyze this image.",

      image:
        image || null,

      mode,

      language,

      memory,

      web:
        webMode,

      messages
    };


    const response =
      await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            abortController.signal
        }
      );


    const raw =
      await response.text();


    let data = {};

    try {

      data =
        raw
          ? JSON.parse(raw)
          : {};

    } catch {

      throw new Error(
        "Server returned an invalid response."
      );
    }


    if (!response.ok) {

      throw new Error(
        data.error ||
        `Server error ${response.status}`
      );
    }


    const answer =
      String(
        data.answer ||
        data.message ||
        data.output ||
        ""
      ).trim();


    if (!answer) {

      throw new Error(
        "AI returned an empty answer."
      );
    }


    aiElement.innerHTML = `
      <div class="message-body">
        ${formatAnswer(answer)}
      </div>

      <div class="msg-actions">

        <button
          type="button"
          data-action="copy">
          📋 Copy
        </button>

        <button
          type="button"
          data-action="read">
          🔊 Read
        </button>

        <button
          type="button"
          data-action="regenerate"
          data-index="${history.length}">
          🔄 Regenerate
        </button>

      </div>

      <div class="confidence">
        AI answer • verify important facts
      </div>
    `;


    history.push({
      role: "assistant",
      text: answer
    });

    saveHistory();


  } catch (error) {

    if (
      error.name ===
      "AbortError"
    ) {

      aiElement.innerHTML = `
        <div class="message-body">
          ⏹️ Generation stopped.
        </div>
      `;

    } else {

      aiElement.innerHTML = `
        <div class="message-body">
          ❌ ${escapeHtml(
            error.message ||
            "Something went wrong."
          )}
        </div>

        <div class="confidence">
          Check the API deployment and try again.
        </div>
      `;
    }

  } finally {

    abortController = null;

    isGenerating = false;

    sendBtn.textContent =
      "Send";

    sendBtn.classList.remove(
      "stop"
    );

    input.focus();

    scrollChat();
  }
}


function stopGeneration() {

  if (abortController) {
    abortController.abort();
  }
}


/* -------------------------
   IMAGE
------------------------- */

function handleImage(file) {

  if (!file) {
    return;
  }

  if (
    !file.type.startsWith(
      "image/"
    )
  ) {

    alert(
      "Please select an image."
    );

    return;
  }


  const reader =
    new FileReader();


  reader.onload = () => {

    selectedImage =
      reader.result;

    showPreview(
      selectedImage
    );
  };


  reader.onerror = () => {

    alert(
      "Could not read this image."
    );
  };


  reader.readAsDataURL(
    file
  );
}


function showPreview(src) {

  previewBox.classList.remove(
    "hidden"
  );

  previewBox.innerHTML = `
    <img
      class="preview"
      src="${escapeHtml(src)}"
      alt="Selected photo"
    >

    <button
      type="button"
      class="mini"
      id="removePhotoBtn">
      ✕ Remove photo
    </button>
  `;
}


function clearPreview() {

  selectedImage = null;

  previewBox.classList.add(
    "hidden"
  );

  previewBox.innerHTML = "";

  if (fileInput) {
    fileInput.value = "";
  }
}


/* -------------------------
   CAMERA
------------------------- */

async function openCamera() {

  openPanel(
    "cameraPanel"
  );

  const video =
    document.getElementById(
      "cameraVideo"
    );


  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "Camera not supported."
      );
    }


    stream =
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: {
              ideal:
                "environment"
            }
          },

          audio: false
        });


    video.srcObject =
      stream;

    await video.play()
      .catch(() => {});

  } catch {

    alert(
      "Camera permission is unavailable. You can still use Photo upload."
    );
  }
}


function capturePhoto() {

  const video =
    document.getElementById(
      "cameraVideo"
    );

  const canvas =
    document.getElementById(
      "cameraCanvas"
    );

  const preview =
    document.getElementById(
      "cameraPreview"
    );


  if (
    !video ||
    !video.videoWidth
  ) {

    alert(
      "Camera is not ready yet."
    );

    return;
  }


  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;


  const context =
    canvas.getContext(
      "2d"
    );


  context.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );


  capturedData =
    canvas.toDataURL(
      "image/jpeg",
      0.82
    );


  preview.src =
    capturedData;

  preview.classList.remove(
    "hidden"
  );

  video.classList.add(
    "hidden"
  );
}


function retakePhoto() {

  capturedData = null;

  document
    .getElementById(
      "cameraPreview"
    )
    ?.classList.add(
      "hidden"
    );

  document
    .getElementById(
      "cameraVideo"
    )
    ?.classList.remove(
      "hidden"
    );
}


function useCapturedPhoto() {

  if (!capturedData) {

    alert(
      "Capture a photo first."
    );

    return;
  }


  selectedImage =
    capturedData;

  showPreview(
    capturedData
  );

  closeCamera();

  input.focus();
}


function closeCamera() {

  if (stream) {

    stream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    stream = null;
  }


  closePanel(
    "cameraPanel"
  );
}


/* -------------------------
   VOICE
------------------------- */

function startVoice() {

  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!Recognition) {

    alert(
      "Voice input is not supported in this browser."
    );

    return;
  }


  const recognition =
    new Recognition();


  recognition.lang =
    getSpeechLanguage();

  recognition.interimResults =
    false;

  recognition.maxAlternatives =
    1;


  recognition.onresult =
    event => {

      input.value =
        event
          .results[0][0]
          .transcript;

      input.focus();
    };


  recognition.onerror =
    event => {

      alert(
        "Voice input error: " +
        (
          event.error ||
          "unknown"
        )
      );
    };


  try {
    recognition.start();
  } catch {}
}


/* -------------------------
   WEB TOGGLE
------------------------- */

function toggleWeb() {

  webMode =
    !webMode;

  const button =
    document.getElementById(
      "webBtn"
    );


  button.textContent =
    `🌐 Web: ${
      webMode
        ? "ON"
        : "OFF"
    }`;


  button.classList.toggle(
    "active",
    webMode
  );
}


/*
  IMPORTANT:
  The Web button is currently a UI state.
  The current Groq/Qwen API does not perform
  internet search automatically.
*/


/* -------------------------
   MEMORY
------------------------- */

function saveMemory() {

  const box =
    document.getElementById(
      "memoryText"
    );

  memory =
    box?.value.trim() || "";

  try {

    localStorage.setItem(
      STORAGE_MEMORY,
      memory
    );

  } catch {}


  alert(
    "Memory saved on this device."
  );
}


function clearMemory() {

  memory = "";

  try {

    localStorage.removeItem(
      STORAGE_MEMORY
    );

  } catch {}


  const box =
    document.getElementById(
      "memoryText"
    );

  if (box) {
    box.value = "";
  }


  alert(
    "Memory cleared."
  );
}


/* -------------------------
   THEME
------------------------- */

function setTheme(theme) {

  document.body.dataset.theme =
    theme;


  try {

    localStorage.setItem(
      STORAGE_THEME,
      theme
    );

  } catch {}
}


/* -------------------------
   EXPORT
------------------------- */

function exportChat() {

  if (!history.length) {

    alert(
      "There is no chat to export."
    );

    return;
  }


  const text =
    history
      .map(message => {

        const prefix =
          message.role ===
          "user"
            ? "You: "
            : "NiSa AI: ";

        return (
          prefix +
          (message.text || "")
        );
      })
      .join("\n\n");


  const blob =
    new Blob(
      [text],
      {
        type:
          "text/plain;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    "nisa-chat.txt";

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}


/* -------------------------
   CLEAR CHAT
------------------------- */

function clearChat() {

  if (
    !confirm(
      "Clear this conversation?"
    )
  ) {
    return;
  }


  history = [];

  saveHistory();

  renderHistory();
}


/* -------------------------
   STUDY
------------------------- */

function studyPrompt(type) {

  const prompts = {

    teacher:
      "Teach me this topic step by step like a teacher. Ask me small questions and explain my mistakes.",

    exam:
      "Exam mode: give important points, likely questions, short answers, formulas and a quick revision checklist.",

    quiz:
      "Quiz mode: ask me one question at a time. Wait for my answer, then score it and explain.",

    flashcards:
      "Create 10 study flashcards from the topic I give you. Use Question → Answer format."
  };


  const prompt =
    prompts[type] ||
    prompts.teacher;


  input.value =
    prompt;

  input.focus();

  closePanel(
    "studyPanel"
  );
}


/* -------------------------
   TIMER
------------------------- */

function updateTimer() {

  const timer =
    document.getElementById(
      "timer"
    );

  if (!timer) {
    return;
  }


  const minutes =
    String(
      Math.floor(
        timerSeconds / 60
      )
    ).padStart(2, "0");


  const seconds =
    String(
      timerSeconds % 60
    ).padStart(2, "0");


  timer.textContent =
    `${minutes}:${seconds}`;
}


function startTimer() {

  if (timerId) {
    return;
  }


  timerId =
    setInterval(() => {

      if (
        timerSeconds <= 0
      ) {

        clearInterval(
          timerId
        );

        timerId = null;

        alert(
          "⏰ Study timer finished!"
        );

        return;
      }


      timerSeconds--;

      updateTimer();

    }, 1000);
}


function resetTimer() {

  clearInterval(
    timerId
  );

  timerId = null;

  timerSeconds = 1500;

  updateTimer();
}


/* -------------------------
   EVENT HANDLERS
------------------------- */

document.addEventListener("DOMContentLoaded", function () {

  // SEND
  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }

  if (input) {
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });
  }


  // CAMERA
  document.getElementById("cameraBtn")?.addEventListener(
    "click",
    openCamera
  );

  document.getElementById("captureBtn")?.addEventListener(
    "click",
    capturePhoto
  );

  document.getElementById("retakeBtn")?.addEventListener(
    "click",
    retakePhoto
  );

  document.getElementById("useShotBtn")?.addEventListener(
    "click",
    useCapturedPhoto
  );

  document.getElementById("closeCameraBtn")?.addEventListener(
    "click",
    closeCamera
  );


  // PHOTO
  document.getElementById("photoBtn")?.addEventListener(
    "click",
    function () {
      if (fileInput) {
        fileInput.click();
      }
    }
  );

  if (fileInput) {
    fileInput.addEventListener("change", function (event) {
      const file = event.target.files[0];

      if (file) {
        handleImage(file);
      }
    });
  }


  // REMOVE PHOTO
  if (previewBox) {
    previewBox.addEventListener("click", function (event) {
      if (event.target.id === "removePhotoBtn") {
        clearPreview();
      }
    });
  }


  // VOICE
  document.getElementById("voiceBtn")?.addEventListener(
    "click",
    startVoice
  );


  // WEB
  document.getElementById("webBtn")?.addEventListener(
    "click",
    toggleWeb
  );


  // SETTINGS
  document.getElementById("settingsBtn")?.addEventListener(
    "click",
    function () {
      openPanel("settingsPanel");
    }
  );

  document.getElementById("closeSettings")?.addEventListener(
    "click",
    function () {
      closePanel("settingsPanel");
    }
  );


  // THEME
  const themeSelect =
    document.getElementById("themeSelect");

  if (themeSelect) {
    themeSelect.addEventListener("change", function () {
      setTheme(this.value);
    });

    const savedTheme =
      localStorage.getItem(STORAGE_THEME) || "dark";

    themeSelect.value = savedTheme;
    setTheme(savedTheme);
  }


  // MEMORY
  document.getElementById("memoryBtn")?.addEventListener(
    "click",
    function () {

      const box =
        document.getElementById("memoryText");

      if (box) {
        box.value = memory;
      }

      closePanel("settingsPanel");
      openPanel("memoryPanel");
    }
  );

  document.getElementById("saveMemoryBtn")?.addEventListener(
    "click",
    saveMemory
  );

  document.getElementById("clearMemoryBtn")?.addEventListener(
    "click",
    clearMemory
  );

  document.getElementById("closeMemory")?.addEventListener(
    "click",
    function () {
      closePanel("memoryPanel");
    }
  );


  // EXPORT
  document.getElementById("exportBtn")?.addEventListener(
    "click",
    exportChat
  );


  // CLEAR CHAT
  document.getElementById("clearBtn")?.addEventListener(
    "click",
    clearChat
  );


  // STUDY
  document.getElementById("studyBtn")?.addEventListener(
    "click",
    function () {
      openPanel("studyPanel");
    }
  );

  document.querySelectorAll("[data-study]").forEach(
    function (button) {
      button.addEventListener("click", function () {
        studyPrompt(button.dataset.study);
      });
    }
  );

  document.getElementById("closeStudy")?.addEventListener(
    "click",
    function () {
      closePanel("studyPanel");
    }
  );


  // TIMER
  document.getElementById("startTimer")?.addEventListener(
    "click",
    startTimer
  );

  document.getElementById("resetTimer")?.addEventListener(
    "click",
    resetTimer
  );

  updateTimer();


  // CHAT BUTTONS
  if (chat) {

    chat.addEventListener("click", function (event) {

      const button =
        event.target.closest("button");

      if (!button) return;

      const action =
        button.dataset.action;

      if (action === "copy") {
        copyText(button);
      }

      if (action === "read") {
        speakText(button);
      }

      if (action === "regenerate") {
        regenerate(
          Number(button.dataset.index)
        );
      }

      if (action === "edit") {
        editMessage(
          Number(button.dataset.index)
        );
      }

    });

  }


  // START
  renderHistory();

});
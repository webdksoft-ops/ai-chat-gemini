function () {
  const scriptTag = document.currentScript;
  const backendUrl =
    scriptTag && scriptTag.dataset && scriptTag.dataset.backendUrl;

  if (!backendUrl) {
    console.error("❌ Thiếu data-backend-url trong script tag!");
    return;
  }

  const container = document.querySelector("#ai-chat-container");
  if (!container) {
    console.error("❌ Thiếu div id='ai-chat-container'");
    return;
  }

  /* -------------------- Render UI -------------------- */
  container.classList.add("ai-chat-widget");
  container.innerHTML = `
    <div class="ai-chat-header">Gia sư Thỏ Hồng</div>
    <div class="ai-chat-body" role="log" aria-live="polite"></div>
    <div class="meta-small">Nhấn mic để nói — AI trả lời bằng giọng nói tự nhiên</div>
    <div class="ai-chat-footer">
      <input id="ai-chat-input" placeholder="Nhập tin nhắn..." />
      <button id="ai-voice-btn" title="Nhấn để nói">🎤</button>
      <button id="ai-chat-send">➤</button>
      <button id="ai-tts-toggle" class="tts-toggle active">🔊</button>
    </div>
  `;

  const bodyEl = container.querySelector(".ai-chat-body");
  const inputEl = container.querySelector("#ai-chat-input");
  const sendBtn = container.querySelector("#ai-chat-send");
  const voiceBtn = container.querySelector("#ai-voice-btn");
  const ttsToggle = container.querySelector("#ai-tts-toggle");

  let currentAudio = null;
  let ttsEnabled = true;

  /* -------------------- Helpers -------------------- */
  function scrollBottom() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function addMessage(sender, text) {
    const row = document.createElement("div");
    row.className = `ai-row ${sender}`;
    row.innerHTML = `<div class="bubble">${text}</div>`;
    bodyEl.appendChild(row);
    scrollBottom();
  }

  function showTyping() {
    const row = document.createElement("div");
    row.className = "ai-row bot typing";
    row.textContent = "Gia sư Thỏ Hồng đang trả lời...";
    bodyEl.appendChild(row);
    scrollBottom();
    return row;
  }

  /* -------------------- Google TTS Playback -------------------- */
  function playAudioBase64(base64) {
    if (!ttsEnabled || !base64) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
    }

    currentAudio = new Audio(`data:audio/mp3;base64,${base64}`);
    currentAudio.play().catch((e) => {
      console.warn("Không thể phát âm thanh:", e);
    });
  }

  ttsToggle.addEventListener("click", () => {
    ttsEnabled = !ttsEnabled;
    ttsToggle.classList.toggle("active", ttsEnabled);
    if (!ttsEnabled && currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
    }
  });

  /* -------------------- Speech-to-Text (GIỮ NGUYÊN) -------------------- */
  let recognition = null;
  let isRecording = false;
  const supportsSTT =
    !!window.SpeechRecognition || !!window.webkitSpeechRecognition;

  if (supportsSTT) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Rec();
    recognition.lang = "vi-VN";

    recognition.onstart = () => {
      isRecording = true;
      voiceBtn.classList.add("recording");
    };

    recognition.onend = () => {
      isRecording = false;
      voiceBtn.classList.remove("recording");
    };

    recognition.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      inputEl.value = text;
      sendMessage();
    };
  }

  voiceBtn.addEventListener("click", () => {
    if (!recognition) {
      alert("Trình duyệt không hỗ trợ thu âm");
      return;
    }
    if (isRecording) recognition.stop();
    else {
      if (currentAudio) currentAudio.pause();
      recognition.start();
    }
  });

  /* -------------------- Send Message -------------------- */
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
    }

    addMessage("user", text);
    inputEl.value = "";

    const typingRow = showTyping();

    try {
      const res = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          tts_requested: ttsEnabled,
        }),
      });

      const data = await res.json();
      typingRow.remove();

      addMessage("bot", data.reply || "Mình chưa hiểu ý bạn.");

      // 🔥 Google Cloud TTS
      playAudioBase64(data.audioBase64);
    } catch (err) {
      typingRow.remove();
      addMessage("bot", "Không thể kết nối server.");
      console.error(err);
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  /* -------------------- Greeting -------------------- */
  setTimeout(() => {
    addMessage(
      "bot",
      "Xin chào! Mình là Gia sư Thỏ Hồng — bạn cần mình giúp gì?"
    );
  }, 300);
})();

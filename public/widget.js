// File widget.js (Đặt trong thư mục public của Next.js, hoặc là file nhúng)
(function () {
  const scriptTag = document.currentScript;
  // Đảm bảo URL này trỏ đến API Route trên Vercel, ví dụ: https://your-project.vercel.app/api/chat
  const backendUrl = scriptTag && scriptTag.dataset && scriptTag.dataset.backendUrl; 

  if (!backendUrl) {
    console.error("❌ Thiếu data-backend-url trong script tag!");
    return;
  }

  /* -------------------- Render widget & Elements -------------------- */
  const container = document.querySelector("#ai-chat-container");
  if (!container) {
    console.error("❌ Thiếu div id='ai-chat-container'");
    return;
  }
  // ... (Giữ nguyên phần HTML render)
    container.classList.add("ai-chat-widget");
    container.innerHTML = `
        <div class="ai-chat-header">Gia sư Thỏ Hồng</div>
        <div class="ai-chat-body" role="log" aria-live="polite"></div>
        <div class="meta-small">Nhấn mic để nói — AI có thể trả lời bằng giọng nói (chất lượng cao)</div>
        <div class="ai-chat-footer">
            <input id="ai-chat-input" placeholder="Nhập tin nhắn..." aria-label="Nhập tin nhắn" />
            <button id="ai-voice-btn" class="voice-btn" title="Nhấn để nói" aria-pressed="false">🎤</button>
            <button id="ai-chat-send" aria-label="Gửi tin nhắn">
                <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </button>
            <button id="ai-tts-toggle" class="tts-toggle active" title="Bật/Tắt giọng nói" aria-pressed="true">🔊</button>
        </div>
    `;

  const bodyEl = container.querySelector(".ai-chat-body");
  const inputEl = container.querySelector("#ai-chat-input");
  const sendBtn = container.querySelector("#ai-chat-send");
  const voiceBtn = container.querySelector("#ai-voice-btn");
  const ttsToggle = container.querySelector("#ai-tts-toggle");
    
  let currentAudio = null; // Biến lưu trữ đối tượng Audio hiện tại

  /* -------------------- Helpers -------------------- */
  function scrollBottom() { bodyEl.scrollTop = bodyEl.scrollHeight; }

  function createRow(sender, text) { /* ... (Giữ nguyên logic tạo row) */ 
        const row = document.createElement("div");
        row.className = `ai-row ${sender}-row`;
        const avatar = document.createElement("div");
        avatar.className = `avatar ${sender}`;
        const bubble = document.createElement("div");
        bubble.className = `bubble ${sender}`;
        bubble.textContent = text;
        if (sender === "bot") {
            row.appendChild(avatar);
            row.appendChild(bubble);
        } else {
            row.appendChild(bubble);
            row.appendChild(avatar);
        }
        return row;
    }

  function addMessage(sender, text) {
    const row = createRow(sender, text);
    bodyEl.appendChild(row);
    scrollBottom();
    return row;
  }

  function showTyping() { /* ... (Giữ nguyên logic show typing) */ 
        const row = document.createElement("div");
        row.className = "ai-row bot";
        const avatar = document.createElement("div");
        avatar.className = "avatar bot";
        const typing = document.createElement("div");
        typing.className = "typing-indicator";
        typing.innerHTML = `<span>Gia sư Thỏ Hồng đang trả lời</span> <span class="dots"><span></span><span></span><span></span></span>`;
        row.appendChild(avatar);
        row.appendChild(typing);
        bodyEl.appendChild(row);
        scrollBottom();
        return row;
    }

  /* -------------------- Text-to-Speech (TTS) - Phát âm thanh từ URL -------------------- */
  let ttsEnabled = true;
  
  ttsToggle.addEventListener("click", () => {
    ttsEnabled = !ttsEnabled;
    ttsToggle.classList.toggle("active", ttsEnabled);
    ttsToggle.setAttribute("aria-pressed", ttsEnabled ? "true" : "false");
    
    if (!ttsEnabled && currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
    }
  });

function playAudioFromUrl(url) {
    if (!ttsEnabled || !url) return;
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
    }

    currentAudio = new Audio(url);
    currentAudio.play().catch(e => console.warn("Lỗi phát âm thanh:", e));
}

  /* -------------------- Speech-to-Text (STT) - Web Speech API -------------------- */
  // ... (Giữ nguyên toàn bộ logic STT)
    let recognition = null;
    let isRecording = false;
    const supportsSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    if (supportsSTT) {
        const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new Rec();
        recognition.lang = "vi-VN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.classList.add("recording");
            voiceBtn.setAttribute("aria-pressed", "true");
        };
        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove("recording");
            voiceBtn.setAttribute("aria-pressed", "false");
        };
        recognition.onerror = (ev) => {
            console.warn("Recognition error", ev);
            isRecording = false;
            voiceBtn.classList.remove("recording");
            voiceBtn.setAttribute("aria-pressed", "false");
        };
        recognition.onresult = (ev) => {
            try {
                const text = ev.results[0][0].transcript;
                inputEl.value = text;
                sendMessage();
            } catch (e) { console.warn(e); }
        };
    } else {
        voiceBtn.title = "Trình duyệt không hỗ trợ thu âm (SpeechRecognition)";
        voiceBtn.style.opacity = "0.6";
    }

    voiceBtn.addEventListener("click", () => {
        if (!recognition) {
            alert("Trình duyệt của bạn không hỗ trợ thu âm (SpeechRecognition). Vui lòng dùng Chrome/Edge.");
            return;
        }
        if (isRecording) {
            recognition.stop();
        } else {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = "";
            }
            try { recognition.start(); } catch (e) { console.warn(e); }
        }
    });

  /* -------------------- Send Message -------------------- */
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    
    // Dừng âm thanh cũ khi bắt đầu gửi tin nhắn mới
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
            // Gửi cờ cho Backend biết có cần TTS không
            tts_requested: ttsEnabled 
        })
      });

      let data = await res.json(); 

      if (typingRow && typingRow.parentNode) typingRow.remove();

      // Lấy dữ liệu từ phản hồi
      const reply = (data && data.reply) || "Mình chưa hiểu ý bạn.";
      const audioUrl = data && data.audio_url; 

      addMessage("bot", reply);

      // Phát âm thanh chất lượng cao từ URL (từ Vercel /public)
      playAudioFromUrl(audioUrl); 

    } catch (err) {
      if (typingRow && typingRow.parentNode) typingRow.remove();
      addMessage("bot", "Không thể kết nối server.");
      console.error("Send error", err);
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* -------------------- Init: greeting -------------------- */
  setTimeout(() => {
    const welcome = "Xin chào! Mình là Gia sư Thỏ Hồng — bạn muốn hỏi gì hôm nay?";
    addMessage("bot", welcome);
  }, 300);
})();

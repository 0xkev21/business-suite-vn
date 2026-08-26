// ====== MESSENGER VOICE NOTE ======
(function () {
  "use strict";

  // Prevent duplicate injections from hot-reloading
  if (window.__voiceExtensionLoaded) return;
  window.__voiceExtensionLoaded = true;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $id = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let audioContext = null;
  let animationFrameId = null;

  // ====== 1. MP3 ENCODING ======
  async function encodeAudioBufferToMp3(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
    const samples = audioBuffer.getChannelData(0);
    const mp3Data = [];
    const block = 1152;

    for (let i = 0; i < samples.length; i += block) {
      const chunkSize = Math.min(block, samples.length - i);
      const intChunk = new Int16Array(chunkSize);
      for (let j = 0; j < chunkSize; j++) {
        let s = samples[i + j];
        s = s < 0 ? s * 32768 : s * 32767;
        intChunk[j] = Math.max(-32768, Math.min(32767, Math.round(s)));
      }
      const mp3buf = encoder.encodeBuffer(intChunk);
      if (mp3buf && mp3buf.length) mp3Data.push(mp3buf);
      if ((i / block) % 50 === 0) await sleep(0);
    }

    const tail = encoder.flush();
    if (tail && tail.length) mp3Data.push(tail);
    return new Blob(mp3Data, { type: "audio/mp3" });
  }

  // ====== 2. RECORDING & UI ======
  async function startRecording(e) {
    if (e && e.type === "click") e.preventDefault();
    if (isRecording) {
      await stopRecordingAndSend();
      return;
    }

    try {
      const permissionStatus = await navigator.permissions.query({
        name: "microphone",
      });
      if (permissionStatus.state === "prompt") {
        showPermissionEducation();
        return;
      }
    } catch (err) {}

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (ev) => audioChunks.push(ev.data);
      mediaRecorder.start();
      isRecording = true;

      const micIcon = $("#mic-svg-icon");
      if (micIcon) micIcon.style.color = "#E41E3F";

      const wrapper = $id("voice-mic-btn-wrapper");
      if (wrapper) {
        const controls = getOrCreateControls(wrapper);
        controls.style.display = "flex";
      }

      startVisualizer(stream);
    } catch (err) {
      alert(
        "Microphone access is blocked. Please click the icon in your URL bar to allow it.",
      );
    }
  }

  function cleanupUI() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    const micIcon = $id("mic-svg-icon");
    if (micIcon) micIcon.style.color = "currentColor";
    const controls = $id("voice-recording-controls");
    if (controls) controls.style.display = "none";
    const canvas = $id("voice-visualizer");
    const spinner = $id("voice-spinner");
    if (canvas) canvas.style.display = "block";
    if (spinner) spinner.style.display = "none";

    ["voice-send-btn", "voice-cancel-btn"].forEach((id) => {
      const el = $id(id);
      if (el) {
        el.disabled = false;
        el.style.opacity = "1";
        el.style.cursor = "pointer";
      }
    });
  }

  async function stopRecordingAndSend() {
    if (!isRecording || !mediaRecorder) return;

    isRecording = false;
    setUIProcessingState("Processing audio...");

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        await nextFrame();
        await sleep(50);
        const webmBlob = new Blob(audioChunks, { type: "audio/webm" });

        try {
          const arrayBuffer = await webmBlob.arrayBuffer();
          if (!audioContext)
            audioContext = new (
              window.AudioContext || window.webkitAudioContext
            )();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const mp3Blob = await encodeAudioBufferToMp3(audioBuffer);

          setUIProcessingState("Attaching message...");
          await attachAndSendAudio(mp3Blob);
          cleanupUI();
        } catch (err) {
          cleanupUI();
        }
        resolve();
      };
      mediaRecorder.stop();
      mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
    });
  }

  function cancelRecording() {
    if (!isRecording || !mediaRecorder) return;
    isRecording = false;
    cleanupUI();
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
  }

  // ====== 3. VISUALIZER ======
  function startVisualizer(stream) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } else if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = $id("voice-visualizer");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function draw() {
      if (!isRecording) return;
      animationFrameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = 3,
        gap = 3;
      const numBars = Math.floor(canvas.width / (barWidth + gap));
      const step = Math.max(1, Math.floor(bufferLength / numBars));

      let x = 0;
      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          const idx = i * step + j;
          if (idx < bufferLength) sum += dataArray[idx];
        }
        const average = sum / step;
        const barHeight = Math.max(2, (average / 255) * canvas.height);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = "#1c1e21";
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, barWidth, barHeight);
        }
        x += barWidth + gap;
      }
    }
    draw();
  }

  // ====== 4. INJECT BUTTON & CONTROLS ======
  function injectMicButton() {
    if ($("#voice-mic-btn-wrapper")) return;
    const anchorBtn = document.querySelector(
      '[aria-label="Attach a file"], [aria-label="Attach photo or video"]',
    );
    if (!anchorBtn) return;

    const buttonWrapper =
      anchorBtn.closest(".x1rg5ohu.x67bb7w") || anchorBtn.parentElement;
    const micWrapperClone = buttonWrapper.cloneNode(true);
    micWrapperClone.id = "voice-mic-btn-wrapper";

    const clickableArea = micWrapperClone.querySelector('[role="button"]');
    if (clickableArea) {
      clickableArea.setAttribute("aria-label", "Click to record voice note");
      clickableArea.id = "voice-mic-btn";
    }

    const iconContainer = micWrapperClone.querySelector(
      '[role="presentation"]',
    );
    if (iconContainer) {
      iconContainer.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" id="mic-svg-icon" style="transition: color 0.2s ease;">
        <path d="M10 14a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 0 0-7 0v5.5A3.5 3.5 0 0 0 10 14zm-5-3.5a.5.5 0 0 1 1 0 4 4 0 1 0 8 0 .5.5 0 0 1 1 0 5 5 0 0 1-4.5 4.975V18h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-2.525A5 5 0 0 1 5 10.5z"></path>
      </svg>`;
    }

    const targetBtn = clickableArea || micWrapperClone;
    targetBtn.onclick = startRecording;
    buttonWrapper.insertAdjacentElement("afterend", micWrapperClone);
  }

  function getOrCreateControls(wrapperElement) {
    let controls = $id("voice-recording-controls");
    if (!controls) {
      if (!document.getElementById("voice-recording-styles")) {
        const style = document.createElement("style");
        style.id = "voice-recording-styles";
        style.innerHTML = `
          @keyframes pulse-dot { 0%{transform:scale(0.95);opacity:1}50%{transform:scale(1.3);opacity:0.6}100%{transform:scale(0.95);opacity:1} }
          @keyframes spin-loader { 0%{transform:rotate(0deg)}100%{transform:rotate(360deg)} }
          #voice-recording-dot{animation:pulse-dot 1.5s infinite}
          .voice-ctrl-btn{border:none;padding:6px 12px;border-radius:14px;font-weight:bold;font-size:13px;cursor:pointer;transition:opacity .2s;color:white}
          .voice-ctrl-btn:hover{opacity:.8}
          .voice-spinner{width:18px;height:18px;border:3px solid #f0f2f5;border-top:3px solid #0866FF;border-radius:50%;animation:spin-loader 1s linear infinite}
        `;
        document.head.appendChild(style);
      }

      controls = document.createElement("div");
      controls.id = "voice-recording-controls";
      Object.assign(controls.style, {
        position: "absolute",
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginBottom: "14px",
        padding: "12px",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "none",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        zIndex: "9999",
        pointerEvents: "auto",
      });

      controls.innerHTML = `
      <div id="voice-vis-container" style="width:100%;border-bottom:1px solid #f0f2f5;padding-bottom:8px;display:flex;justify-content:center;align-items:center;min-height:33px;">
        <canvas id="voice-visualizer" width="200" height="24" style="display:block;width:100%"></canvas>
        <div id="voice-spinner" class="voice-spinner" style="display:none"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:16px;">
        <div style="display:flex;align-items:center;gap:8px;padding-left:4px">
          <div id="voice-recording-dot" style="width:8px;height:8px;background-color:#E41E3F;border-radius:50%"></div>
          <span style="font-size:13px;font-family:inherit;color:#1c1e21;font-weight:bold">Recording...</span>
        </div>
        <div style="display:flex;gap:6px">
          <button id="voice-cancel-btn" class="voice-ctrl-btn" style="background:#65676B;display:flex;align-items:center;gap:4px">Cancel</button>
          <button id="voice-send-btn" class="voice-ctrl-btn" style="background:#0866FF;display:flex;align-items:center;gap:4px">Done</button>
        </div>
      </div>
      `;
      wrapperElement.style.position = "relative";
      wrapperElement.appendChild(controls);
    }
    $id("voice-cancel-btn").onclick = cancelRecording;
    $id("voice-send-btn").onclick = stopRecordingAndSend;
    return controls;
  }

  // ====== 5. ATTACH & SEND ======
  function injectPageWorldScript() {
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("scripts/page-world.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function attachAndSendAudio(blob) {
    const fileName = `voice_${Date.now()}.mp3`;
    const mimeType = blob.type || "audio/mp3";

    try {
      const base64 = await blobToBase64(blob);
      const chatBox = document.querySelector('[contenteditable="true"]');
      if (!chatBox) {
        return;
      }

      chatBox.focus();

      const detail = { base64, fileName, mimeType };
      const eventDetail =
        typeof cloneInto === "function" ? cloneInto(detail, window) : detail;
      document.dispatchEvent(
        new CustomEvent("VoiceExtSendAudio", {
          detail: eventDetail,
          bubbles: true,
        }),
      );

      await sleep(2500);
    } catch (err) {
      return;
    }
  }

  // ====== 6. MISC HELPERS ======
  function setUIProcessingState(statusText) {
    const textElement = $("#voice-recording-controls span");
    if (textElement) textElement.innerText = statusText;
    const dot = $id("voice-recording-dot");
    if (dot) dot.style.backgroundColor = "#0866FF";
    const canvas = $id("voice-visualizer");
    const spinner = $id("voice-spinner");
    if (canvas) canvas.style.display = "none";
    if (spinner) spinner.style.display = "block";
    ["voice-send-btn", "voice-cancel-btn"].forEach((id) => {
      const el = $id(id);
      if (el) {
        el.disabled = true;
        el.style.opacity = "0.5";
        el.style.cursor = "not-allowed";
      }
    });
  }

  function showPermissionEducation() {
    if ($id("voice-permission-modal")) return;
    const overlay = document.createElement("div");
    overlay.id = "voice-permission-modal";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      fontFamily: "inherit",
    });
    const modal = document.createElement("div");
    Object.assign(modal.style, {
      background: "#fff",
      color: "#1c1e21",
      padding: "24px",
      borderRadius: "8px",
      maxWidth: "400px",
      boxShadow: "0 12px 28px rgba(0,0,0,0.2)",
      textAlign: "center",
    });
    modal.innerHTML = `
      <div style="font-size:32px;margin-bottom:12px">🎙️</div>
      <h2 style="margin:0 0 12px 0;font-size:20px">One-Time Microphone Setup</h2>
      <p style="margin:0 0 20px 0;font-size:15px;color:#65676b;line-height:1.5">To make voice notes fast, the browser needs permission.<br><br>Select <strong>"Always Allow"</strong> so you don't have to do this every time.</p>
      <button id="voice-understand-btn" style="background:#0866FF;color:white;border:none;padding:10px 24px;border-radius:6px;font-weight:bold;font-size:15px;cursor:pointer;">I Understand</button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    $id("voice-understand-btn").onclick = async () => {
      overlay.remove();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {}
    };
  }

  function watchForMessengerUI() {
    const root = document.body;
    if (!root) return;
    let isChecking = false;
    const observer = new MutationObserver(() => {
      if (!window.location.href.includes("/latest/inbox")) return;
      if (
        isRecording &&
        !document.body.contains($id("voice-mic-btn-wrapper"))
      ) {
        cancelRecording();
        return;
      }
      if ($id("voice-mic-btn-wrapper") || isChecking) return;
      isChecking = true;
      requestAnimationFrame(() => {
        injectMicButton();
        isChecking = false;
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    if (window.location.href.includes("/latest/inbox")) injectMicButton();
  }

  window.addEventListener("pagehide", () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
      isRecording = false;
    }
  });

  injectPageWorldScript();
  watchForMessengerUI();
})();

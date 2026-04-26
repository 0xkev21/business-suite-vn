// ====== MESSENGER VOICE NOTE EXTENSION ======
// console.log("Messenger Voice Note script loaded.");

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// --- VISUALIZER & AUDIO VARIABLES ---
let audioContext = null;
let animationFrameId = null;

// ====== RECORDING HANDLERS ======
async function startRecording(e) {
  if (e && e.type === "click") e.preventDefault();

  if (isRecording) {
    stopRecordingAndSend();
    return;
  }

  // --- Permission Check ---
  try {
    const permissionStatus = await navigator.permissions.query({
      name: "microphone",
    });
    if (permissionStatus.state === "prompt") {
      showPermissionEducation();
      return;
    }
  } catch (err) {
    console.log("Permission API not supported, falling back.", err);
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.start();
    isRecording = true;

    const micIcon = document.querySelector("#mic-svg-icon");
    if (micIcon) micIcon.style.color = "#E41E3F";

    const wrapper = document.querySelector("#voice-mic-btn-wrapper");
    if (wrapper) {
      const controls = getOrCreateControls(wrapper);
      controls.style.display = "flex";
    }

    startVisualizer(stream);
  } catch (err) {
    console.log("Microphone access error:", err);
    alert(
      "Microphone access is blocked. Please click the icon in your URL bar to allow it.",
    );
  }
}

function cleanupUI() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  const micIcon = document.querySelector("#mic-svg-icon");
  if (micIcon) micIcon.style.color = "currentColor";

  const controls = document.getElementById("voice-recording-controls");
  if (controls) controls.style.display = "none";
}

async function stopRecordingAndSend() {
  if (!isRecording || !mediaRecorder) return;
  cleanupUI();

  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(audioChunks, { type: "audio/webm" });
      isRecording = false;

      try {
        // --- NEW: LAMEJS MP3 ENCODING PIPELINE ---
        const arrayBuffer = await webmBlob.arrayBuffer();
        if (!audioContext)
          audioContext = new (
            window.AudioContext || window.webkitAudioContext
          )();

        // Decode the raw webm audio
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Prepare LameJS Encoder (Mono, 128kbps)
        const sampleRate = audioBuffer.sampleRate;
        const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
        const samples = audioBuffer.getChannelData(0); // Get mono audio track
        const mp3Data = [];

        // Convert float32 audio data to int16 (Required by LameJS)
        const sampleBlockSize = 1152;
        const intSamples = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          let sample = samples[i];
          // Fast clamp and scale to 16-bit signed integer
          sample = sample < 0 ? sample * 32768 : sample * 32767;
          intSamples[i] = sample;
        }

        // Encode in chunks
        for (let i = 0; i < intSamples.length; i += sampleBlockSize) {
          const chunk = intSamples.subarray(i, i + sampleBlockSize);
          const mp3buf = mp3encoder.encodeBuffer(chunk);
          if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }

        // Flush the final data
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) mp3Data.push(mp3buf);

        // Compile the final MP3 file
        const mp3Blob = new Blob(mp3Data, { type: "audio/mp3" });
        await attachAndSendAudio(mp3Blob);
      } catch (err) {
        console.log("Error encoding MP3:", err);
      }
      resolve();
    };

    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
  });
}

function cancelRecording() {
  if (!isRecording || !mediaRecorder) return;
  cleanupUI();

  mediaRecorder.onstop = () => {
    isRecording = false;
  };

  mediaRecorder.stop();
  mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
}

// ====== AUDIO WAVE VISUALIZER ======
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

  const canvas = document.getElementById("voice-visualizer");
  if (!canvas) return;
  const canvasCtx = canvas.getContext("2d");

  function draw() {
    if (!isRecording) return;
    animationFrameId = requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = 3;
    const gap = 3;
    const numBars = Math.floor(canvas.width / (barWidth + gap));
    const step = Math.max(1, Math.floor(bufferLength / numBars));

    let x = 0;
    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        if (i * step + j < bufferLength) {
          sum += dataArray[i * step + j];
        }
      }
      let average = sum / step;

      const barHeight = Math.max(2, (average / 255) * canvas.height);
      const y = (canvas.height - barHeight) / 2;

      canvasCtx.fillStyle = "#1c1e21";

      if (canvasCtx.roundRect) {
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, y, barWidth, barHeight, 2);
        canvasCtx.fill();
      } else {
        canvasCtx.fillRect(x, y, barWidth, barHeight);
      }

      x += barWidth + gap;
    }
  }

  draw();
}

// ====== INJECT MIC BUTTON ======
function injectMicButton() {
  if (document.querySelector("#voice-mic-btn-wrapper")) return;

  const anchorBtn = document.querySelector('[aria-label="Attach a file"]');
  if (!anchorBtn) return;

  const buttonWrapper =
    anchorBtn.closest(".x1rg5ohu.x67bb7w") || anchorBtn.parentElement;
  const micWrapperClone = buttonWrapper.cloneNode(true);
  micWrapperClone.id = "voice-mic-btn-wrapper";

  if (
    micWrapperClone.hasAttribute("id") &&
    micWrapperClone.id !== "voice-mic-btn-wrapper"
  ) {
    micWrapperClone.removeAttribute("id");
  }

  const clickableArea = micWrapperClone.querySelector('[role="button"]');
  if (clickableArea) {
    clickableArea.setAttribute("aria-label", "Click to record voice note");
    clickableArea.id = "voice-mic-btn";
  }

  const iconContainer = micWrapperClone.querySelector('[role="presentation"]');
  if (iconContainer) {
    iconContainer.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" color="currentColor" id="mic-svg-icon" style="transition: color 0.2s ease;">
        <path d="M10 14a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 0 0-7 0v5.5A3.5 3.5 0 0 0 10 14zm-5-3.5a.5.5 0 0 1 1 0 4 4 0 1 0 8 0 .5.5 0 0 1 1 0 5 5 0 0 1-4.5 4.975V18h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-2.525A5 5 0 0 1 5 10.5z"></path>
      </svg>
    `;
  }

  const targetBtn = clickableArea || micWrapperClone;
  targetBtn.addEventListener("click", startRecording);

  buttonWrapper.insertAdjacentElement("afterend", micWrapperClone);
}

// ====== INTERACTIVE FLOATING CONTROLS ======
function getOrCreateControls(wrapperElement) {
  let controls = document.getElementById("voice-recording-controls");

  if (!controls) {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes pulse-dot {
        0% { transform: scale(0.95); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
        100% { transform: scale(0.95); opacity: 1; }
      }
      #voice-recording-dot { animation: pulse-dot 1.5s infinite; }
      .voice-ctrl-btn {
        border: none; padding: 6px 12px; border-radius: 14px; font-weight: bold; 
        font-size: 13px; cursor: pointer; transition: opacity 0.2s; color: white;
      }
      .voice-ctrl-btn:hover { opacity: 0.8; }
    `;
    document.head.appendChild(style);

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
      <canvas id="voice-visualizer" width="200" height="24" style="display:block; width: 100%; border-bottom: 1px solid #f0f2f5; padding-bottom: 8px;"></canvas>
      
      <div style="display:flex; justify-content: space-between; align-items:center; width: 100%; gap: 16px;">
        <div style="display:flex; align-items:center; gap: 8px; padding-left: 4px;">
          <div id="voice-recording-dot" style="width:8px; height:8px; background-color:#E41E3F; border-radius:50%;"></div>
          <span style="font-size:13px; font-family:inherit; color:#1c1e21; font-weight:bold;">Recording...</span>
        </div>
        <div style="display:flex; gap: 6px;">
          <button id="voice-cancel-btn" class="voice-ctrl-btn" style="background: #65676B; display: flex; align-items: center; gap: 4px;">Cancel 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M10 12L14 16M14 12L10 16M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M18 6V16.2C18 17.8802 18 18.7202 17.673 19.362C17.3854 19.9265 16.9265 20.3854 16.362 20.673C15.7202 21 14.8802 21 13.2 21H10.8C9.11984 21 8.27976 21 7.63803 20.673C7.07354 20.3854 6.6146 19.9265 6.32698 19.362C6 18.7202 6 17.8802 6 16.2V6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          </button>
          <button id="voice-send-btn" class="voice-ctrl-btn" style="background: #0866FF; display: flex; align-items: center; gap: 4px;">Done 
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path fill="#ffffff" fill-rule="evenodd" d="M3 10a7 7 0 019.307-6.611 1 1 0 00.658-1.889 9 9 0 105.98 7.501 1 1 0 00-1.988.22A7 7 0 113 10zm14.75-5.338a1 1 0 00-1.5-1.324l-6.435 7.28-3.183-2.593a1 1 0 00-1.264 1.55l3.929 3.2a1 1 0 001.38-.113l7.072-8z"/>
          </svg>
          </button>
        </div>
      </div>
    `;

    wrapperElement.style.position = "relative";
    wrapperElement.appendChild(controls);

    document
      .getElementById("voice-cancel-btn")
      .addEventListener("click", cancelRecording);
    document
      .getElementById("voice-send-btn")
      .addEventListener("click", stopRecordingAndSend);
  }
  return controls;
}

// ====== WATCH FOR UI ======
function watchForMessengerUI() {
  const root = document.body;
  if (!root) return;

  let isChecking = false;

  const observer = new MutationObserver(() => {
    if (
      isRecording &&
      !document.body.contains(document.getElementById("voice-mic-btn-wrapper"))
    ) {
      console.log("🚫 User navigated away. Cancelling active recording.");
      cancelRecording();
      return;
    }

    if (document.getElementById("voice-mic-btn-wrapper")) return;

    if (isChecking) return;
    isChecking = true;

    requestAnimationFrame(() => {
      injectMicButton();
      isChecking = false;
    });
  });

  observer.observe(root, { childList: true, subtree: true });
  injectMicButton();
}

watchForMessengerUI();

// ====== ATTACH & SEND AUDIO ======
async function attachAndSendAudio(blob) {
  // Update file name to .mp3 to trigger Messenger's native audio player seamlessly
  const fileName = `voice_${Date.now()}.mp3`;
  const file = new File([blob], fileName, { type: blob.type || "audio/mp3" });

  const contentEditable = document.querySelector('[contenteditable="true"]');
  const dropTarget =
    contentEditable?.closest('[role="textbox"], [role="presentation"]') ||
    contentEditable?.parentElement ||
    document.body;

  if (!dropTarget) {
    console.log("❌ Could not locate drop target for Messenger.");
    return;
  }

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const dragEnter = new DragEvent("dragenter", { bubbles: true, dataTransfer });
  const dragOver = new DragEvent("dragover", { bubbles: true, dataTransfer });
  const drop = new DragEvent("drop", { bubbles: true, dataTransfer });

  dropTarget.dispatchEvent(dragEnter);
  dropTarget.dispatchEvent(dragOver);
  dropTarget.dispatchEvent(drop);

  await new Promise((r) => setTimeout(r, 1200));

  const sendBtn = document.querySelector(
    'div[aria-label="Press Enter to send"], div[aria-label="Send"]',
  );

  if (sendBtn) {
    sendBtn.click();
    return;
  }

  if (contentEditable) {
    contentEditable.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    return;
  }

  console.log(
    "⚠️ File attached but send button not found and contentEditable missing. You might need to hit Enter manually.",
  );
}

// ====== EDUCATIONAL PERMISSION MODAL ======
function showPermissionEducation() {
  if (document.getElementById("voice-permission-modal")) return;

  const overlay = document.createElement("div");
  overlay.id = "voice-permission-modal";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
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
    <div style="font-size: 32px; margin-bottom: 12px;">🎙️</div>
    <h2 style="margin: 0 0 12px 0; font-size: 20px;">One-Time Microphone Setup</h2>
    <p style="margin: 0 0 20px 0; font-size: 15px; color: #65676b; line-height: 1.5;">
      To make voice notes fast, the browser needs permission.<br><br>
      When the prompt appears at the top of your screen, please select <strong>"Always Allow" (or "Forever")</strong> so you don't have to do this every time.
    </p>
    <button id="voice-understand-btn" style="background: #0866FF; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s;">
      I Understand
    </button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document
    .getElementById("voice-understand-btn")
    .addEventListener("click", async () => {
      overlay.remove();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
        alert("✅ Setup complete! You can now click the mic button to record.");
      } catch (err) {
        console.log("User blocked permission after education.", err);
      }
    });
}

// ====== EMERGENCY CLEANUP ======
window.addEventListener("pagehide", () => {
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
    isRecording = false;
  }
});

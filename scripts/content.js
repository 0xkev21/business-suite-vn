// ====== MESSENGER VOICE NOTE EXTENSION ======
// console.log("Messenger Voice Note script loaded.");

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isHoveringButton = false;

// ====== RECORDING HANDLERS ======
async function startRecording(e) {
  if (e.type === "mousedown") e.preventDefault();

  if (isRecording) return;

  // --- NEW: Permission Check Check ---
  try {
    const permissionStatus = await navigator.permissions.query({
      name: "microphone",
    });
    if (permissionStatus.state === "prompt") {
      showPermissionEducation();
      return; // Stop here, don't try to record yet
    }
  } catch (err) {
    console.log("Permission API not supported, falling back.", err);
  }
  // -----------------------------------

  isHoveringButton = true;

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
      const popup = getOrCreatePopup(wrapper);
      popup.style.display = "flex";
      popup.style.background = "#E41E3F";
      document.getElementById("voice-recording-text").innerText =
        "Recording... Slide away to cancel";
      document.getElementById("voice-recording-dot").style.display = "block";
    }

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("touchend", handleGlobalMouseUp);
  } catch (err) {
    console.log("Microphone access error:", err);
    // If they denied it previously, show them a friendly error
    alert(
      "Microphone access is blocked. Please click the icon in your URL bar to allow it.",
    );
  }
}

function handleGlobalMouseUp() {
  document.removeEventListener("mouseup", handleGlobalMouseUp);
  document.removeEventListener("touchend", handleGlobalMouseUp);

  if (isHoveringButton) {
    stopRecordingAndSend();
  } else {
    cancelRecording();
  }
}

function cleanupUI() {
  const micIcon = document.querySelector("#mic-svg-icon");
  if (micIcon) micIcon.style.color = "currentColor";

  const popup = document.getElementById("voice-recording-popup");
  if (popup) popup.style.display = "none";
}

async function stopRecordingAndSend() {
  if (!isRecording || !mediaRecorder) return;
  cleanupUI();

  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      isRecording = false;
      // console.log("⏹️ Recording stopped. Sending...");
      try {
        await attachAndSendAudio(blob);
      } catch (err) {
        console.log("Error sending audio:", err);
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
    // console.log("🚫 Recording cancelled by user sliding away.");
  };

  mediaRecorder.stop();
  mediaRecorder.stream?.getTracks()?.forEach((t) => t.stop());
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
    clickableArea.setAttribute("aria-label", "Hold to record voice note");
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

  targetBtn.addEventListener("mousedown", startRecording);
  targetBtn.addEventListener("touchstart", startRecording);

  targetBtn.addEventListener("mouseleave", () => {
    if (!isRecording) return;
    isHoveringButton = false;
    const popup = document.getElementById("voice-recording-popup");
    if (popup) {
      popup.style.background = "#65676B";
      document.getElementById("voice-recording-dot").style.display = "none";
      document.getElementById("voice-recording-text").innerText =
        "Release to cancel 🗑️";
    }
  });

  targetBtn.addEventListener("mouseenter", () => {
    if (!isRecording) return;
    isHoveringButton = true;
    const popup = document.getElementById("voice-recording-popup");
    if (popup) {
      popup.style.background = "#E41E3F";
      document.getElementById("voice-recording-dot").style.display = "block";
      document.getElementById("voice-recording-text").innerText =
        "Release to send 📤";
    }
  });

  targetBtn.addEventListener("touchmove", (e) => {
    if (!isRecording) return;
    const touch = e.touches[0];
    const rect = targetBtn.getBoundingClientRect();
    const isInside =
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom;

    if (isInside && !isHoveringButton) {
      targetBtn.dispatchEvent(new Event("mouseenter"));
    } else if (!isInside && isHoveringButton) {
      targetBtn.dispatchEvent(new Event("mouseleave"));
    }
  });

  buttonWrapper.insertAdjacentElement("afterend", micWrapperClone);
}

// ====== POPUP UI GENERATOR ======
function getOrCreatePopup(wrapperElement) {
  let popup = document.getElementById("voice-recording-popup");

  if (!popup) {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes pulse-dot {
        0% { transform: scale(0.95); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
        100% { transform: scale(0.95); opacity: 1; }
      }
      #voice-recording-dot { animation: pulse-dot 1.5s infinite; }
    `;
    document.head.appendChild(style);

    popup = document.createElement("div");
    popup.id = "voice-recording-popup";
    Object.assign(popup.style, {
      position: "absolute",
      bottom: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginBottom: "14px",
      padding: "8px 14px",
      background: "#E41E3F",
      color: "white",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight: "bold",
      fontFamily: "inherit",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      display: "none",
      alignItems: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      zIndex: "9999",
      pointerEvents: "none",
      transition: "background 0.2s ease",
    });

    const dot = document.createElement("div");
    dot.id = "voice-recording-dot";
    Object.assign(dot.style, {
      width: "8px",
      height: "8px",
      backgroundColor: "white",
      borderRadius: "50%",
    });

    const text = document.createElement("span");
    text.id = "voice-recording-text";

    popup.appendChild(dot);
    popup.appendChild(text);

    wrapperElement.style.position = "relative";
    wrapperElement.appendChild(popup);
  }
  return popup;
}

// ====== WATCH FOR UI (HIGH-SPEED & OPTIMIZED) ======
function watchForMessengerUI() {
  const root = document.body;
  if (!root) return;

  let isChecking = false;

  const observer = new MutationObserver(() => {
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

// ====== INITIAL PERMISSION REQUEST ======
async function requestMicPermissionOnLoad() {
  try {
    // Check if permission is already granted so we don't flash the mic icon unnecessarily
    const permissionStatus = await navigator.permissions.query({
      name: "microphone",
    });

    if (permissionStatus.state === "prompt") {
      // console.log("🛡️ Requesting initial microphone permission...");
      // This triggers the browser popup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Immediately stop the tracks so the microphone doesn't stay active
      stream.getTracks().forEach((track) => track.stop());
      // console.log("✅ Initial microphone permission granted.");
    }
  } catch (err) {
    // If the browser blocks the auto-prompt due to lack of user interaction,
    // it will gracefully fail here and just ask when they click the button later.
    console.log("Could not request initial microphone permission:", err);
  }
}

// Fire the permission request when the page loads
requestMicPermissionOnLoad();

// ====== ATTACH & SEND AUDIO ======
async function attachAndSendAudio(blob) {
  const fileName = `voice_${Date.now()}.webm`;
  const file = new File([blob], fileName, { type: blob.type || "audio/webm" });

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
      When the prompt appears at the top of your screen, please select <strong>"Allow on every visit" (or "Forever")</strong> so you don't have to do this every time.
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
        // Trigger the browser prompt now that they are educated
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop()); // Immediately close it

        alert("✅ Setup complete! You can now hold the mic button to record.");
      } catch (err) {
        console.log("User blocked permission after education.", err);
      }
    });
}

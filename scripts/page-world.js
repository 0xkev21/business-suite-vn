// ====== page-world.js ======
if (!window.__voiceExtPageWorldLoaded) {
  window.__voiceExtPageWorldLoaded = true;

  window.addEventListener("VoiceExtSendAudio", async (e) => {
    const { base64, fileName, mimeType } = e.detail;

    try {
      // Decode locally so Facebook's fetch interceptor never sees the payload.
      const encoded = base64.slice(base64.indexOf(",") + 1);
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });

      const findFileInput = (root) => {
        const input = root.querySelector('input[type="file"]');
        if (input) return input;
        for (const element of root.querySelectorAll("*")) {
          if (element.shadowRoot) {
            const shadowInput = findFileInput(element.shadowRoot);
            if (shadowInput) return shadowInput;
          }
        }
        return null;
      };

      const fileInput = findFileInput(document);

      if (fileInput) {
        const filesSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "files",
        ).set;
        filesSetter.call(
          fileInput,
          (() => {
            const files = new DataTransfer();
            files.items.add(file);
            return files.files;
          })(),
        );
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const chatBox = document.querySelector('[contenteditable="true"]');

      if (chatBox && !fileInput) {
        chatBox.focus();

        for (const eventName of ["dragenter", "dragover", "drop"]) {
          chatBox.dispatchEvent(
            new DragEvent(eventName, {
              dataTransfer,
              bubbles: true,
              cancelable: true,
            }),
          );
        }

        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        });
        chatBox.dispatchEvent(pasteEvent);
      } else if (!fileInput) {
        return;
      }

      setTimeout(() => {
        if (fileInput || chatBox) {
          const sendBtn = document.querySelector(
            '[aria-label="Press Enter to send"], [aria-label="Send"], [aria-label="Send message"], [aria-label="Send Message"]',
          );

          if (sendBtn) {
            sendBtn.click();
          } else {
            const currentChatBox = document.querySelector(
              '[contenteditable="true"]',
            );
            currentChatBox?.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              }),
            );
          }
        }
      }, 1500);
    } catch (err) {
      return;
    }
  });
}

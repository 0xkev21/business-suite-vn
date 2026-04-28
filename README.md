# Business Suite Voice Note

A browser extension that enables voice note recording and sending directly within Meta Business Suite on desktop. Meta currently lacks a native voice message sender in their web-based Business Suite—this extension seamlessly bridges that gap.

## 🚀 How to Install

You can install the extension directly from the official store in seconds:

1. Go to the Business Suite Voice Note page on the **[Chrome Web Store](#)**.
2. Click **Add to Chrome**.
3. The extension will automatically install and activate. No manual setup required!

## 🎤 How to Use

* Navigate to your Meta Business Suite Inbox.
* Look at the chat toolbar at the bottom of the screen. You will see a new **Microphone icon** next to the "Attach a file" button.
* **First Time Setup:** Click the mic. A dark modal will appear explaining the permission process. Click "I Understand", and when the browser prompts you at the top of the screen, select **"Allow on every visit"** (or "Remember this decision").
* **Recording:** Click the mic to start. Speak your message, and click **Done** to instantly convert and send the audio file into the chat.

## 🔒 Privacy & Permissions

This extension runs entirely locally on your machine.

* **No data collection:** Audio is processed in your browser's memory and injected directly into the Meta chat input. No audio, text, or user data is ever sent to external servers or third parties.
* **Host Permissions:** Only requests access to `business.facebook.com` to inject the microphone button securely into the chat toolbar.

## 🤝 Acknowledgments & Open Source Credits

This extension is made possible by the following open-source software:

* **[lamejs](https://github.com/zhuker/lamejs):** A fast MP3 encoder written in JavaScript by zhuker. Licensed under the MIT License. Used to convert raw microphone audio into highly compressed, universally supported `.mp3` files entirely offline within the browser.
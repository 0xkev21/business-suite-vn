# Business Suite Voice Note

Browser extension that enables voice note recording and sending feature for Meta Business Suite on Desktops.
Meta somehow doesn't have voice message sender button on business suite on pc browsers. This extension brings that button.

## 🚀 How to Install (Free / Sideloading)
You can install this extension directly into Chrome, Edge, or Brave without putting it on the Web Store.

*  Download or unzip this entire project folder to your computer.
*  Open your browser and go to the extensions page:
* Chrome/Brave: Type chrome://extensions/ in the address bar.
*  Edge: Type edge://extensions/ in the address bar.
* Turn on Developer mode (usually a toggle switch in the top right or left menu).
* Click the Load unpacked button.
* Select the project folder (the folder containing manifest.json).
* The extension is now installed!

## 🎤 How to Use
* Navigate to your Meta Business Suite Inbox.
* Look at the chat toolbar at the bottom of the screen. You will see a new Microphone icon next to the "Attach a file" button.
* First Time Setup: Click the mic. A dark modal will appear explaining the permission process. Click "I Understand", and when the browser prompts you at the top of the screen, select "Allow on every visit" (or "Remember this decision").
* Recording: Click the mic to start. Speak your message, and click Done to instantly convert and send the audio file into the chat.

## 🔒 Privacy & Permissions
This extension runs entirely locally on your machine.
* No data collection: Audio is processed in your browser's memory and injected directly into the Meta chat input. No audio, text, or user data is ever sent to external servers or third parties.
* Host Permissions: Only requests access to business.facebook.com to inject the microphone button into the chat toolbar.

## 🤝 Acknowledgments & Open Source Credits

This extension is made possible by the following open-source software:

* **[lamejs](https://github.com/zhuker/lamejs):** A fast MP3 encoder written in JavaScript by zhuker. Licensed under the MIT License. Used to convert raw microphone audio into highly compressed, universally supported `.mp3` files entirely offline within the browser.
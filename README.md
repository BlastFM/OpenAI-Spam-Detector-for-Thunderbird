# OpenAI Spam Detector for Thunderbird

![Extension Version](https://img.shields.io/badge/version-1.3-blue.svg)
![Thunderbird](https://img.shields.io/badge/Thunderbird-115.0%2B-58A6FF.svg?logo=thunderbird&logoColor=white)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

An AI-powered spam detection and training extension for Mozilla Thunderbird. **OpenAI Spam Detector** utilizes OpenAI's Chat Completions API (such as `gpt-4o-mini` and `gpt-4o`) to classify incoming emails, move unwanted messages to your deleted folder automatically, and continuously adapt to your preferences via few-shot context learning.

---

## 🌟 Key Features

* **AI-Powered Email Classification:** Automatically screens incoming mail using OpenAI models (e.g., `gpt-4o-mini`).
* **Origin-Tracking Restores:** Marking an email as "Not Spam" moves it back to its original folder (Inbox, custom folders, etc.), rather than forcing everything into the main Inbox.
* **Smart Training & Overrides:** Context-menu options allow training the AI on false positives with dynamic context injection into system prompts.
* **Automatic Deduplication:** Clean log management prevents duplicate entries in both the *Detected Spam Log* and *Active AI Training Memory*.
* **Customizable Prompts:** Define custom system prompt rules directly from the settings page to tweak detection aggressiveness.

---

## Installation

### Method 1: Install from `.xpi` File
1. Download the latest `.xpi` file from the [Releases](https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird/releases) page.
2. Open **Thunderbird** and navigate to **Settings** > **Add-ons and Themes**.
3. Click the gear icon ⚙️ in the top right and select **Install Add-on From File...**.
4. Choose the downloaded `.xpi` file and confirm the installation.

### Method 2: Manual Development Build
1. Clone this repository:
   ```cmd
   git clone [https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird.git](https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird.git)

## 📁 Repository Structure

```text
├── manifest.json
├── background.js
├── icons/
│   ├── icon-48.png
│   ├── not-spam-green.png
│   └── spam-red.png
└── options/
    ├── options.css
    ├── options.html
    ├── options.js
    ├── popup.html
    └── popup.js

⚙️ Setup & Configuration
Open Thunderbird and click the extension icon in the toolbar, or open Add-ons and Themes > OpenAI Spam Detector > Options.

Input your OpenAI API Key.

Select your desired OpenAI Model (default: gpt-4o-mini).

(Optional) Add custom prompts to refine classification logic.

Click Test API Key to verify connection, then click Save.

💡 How It Works
Context Menu Training
Mark as Spam: Right-click any email in your message list, choose Train AI: Mark as Spam. The add-on logs a snippet to spamExamples, moves the email to the Deleted folder, and includes it as a negative example in future OpenAI API payloads.

Mark as Not Spam: Right-click an email and choose Train AI: Mark as Not Spam. The add-on restores the message to your Inbox, saves a snippet to falsePositives, and instructs OpenAI to prioritize similar emails as HAM.

Message Processing Pipeline
graph TD
    A[New Email Received] --> B{API Key Set?}
    B -- No --> C[Notify User & Prompt Options]
    B -- Yes --> D[Extract Email Headers & Body Snippet]
    D --> E[Fetch User Custom Rules + Training Memory]
    E --> F[Send Request to OpenAI API]
    F --> G{Verdict: SPAM or HAM?}
    G -- SPAM --> H[Move Email to Deleted / Trash]
    H --> I[Log Event & Show Restore Notification]
    G -- HAM --> J[Retain Email in Inbox]

🛡️ Permissions & Privacy
This add-on requires the following WebExtension permissions:

messagesRead & messagesMove: To inspect incoming email headers/bodies and move spam to your trash folder.

accountsRead: To locate the target Inbox and Deleted folders across configured email accounts.

menus: To inject AI training options into the message list context menu.

storage: To save configuration keys, logs, and user training memory locally.

notifications: To alert you when spam is intercepted or when setup errors occur.

Host Permission (https://api.openai.com/*): Required to transmit snippet data to OpenAI endpoints for evaluation.

Privacy Note: Transmitted email content includes the sender address, subject line, and the first 1,000 characters of the body text. Data is processed according to OpenAI's Data Usage Policies. No data is sent to intermediate third-party servers.

📄 License
Distributed under the MIT License. See LICENSE for more information.


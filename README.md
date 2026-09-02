# Thunderbird OpenAI Spam Detector

A powerful Mozilla Thunderbird Mail Extension that uses OpenAI's GPT models to automatically detect spam, filter junk emails, and learn from user feedback.

[![GitHub license](https://img.shields.io/github/license/BlastFM/OpenAI-Spam-Detector-for-Thunderbird)](https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird)
[![GitHub release](https://img.shields.io/github/v/release/BlastFM/OpenAI-Spam-Detector-for-Thunderbird)](https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird/releases)

---

## Features

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

🚀 Installation & Setup
Manual Installation in Thunderbird
Download or clone this repository to your local machine:

Bash
git clone [https://github.com/your-username/openai-spam-detector.git](https://github.com/your-username/openai-spam-detector.git)
Zip the contents of the root folder (or compile into a .xpi file).

Open Mozilla Thunderbird.

Go to Settings > Add-ons and Themes (or press Ctrl + Shift + A / Cmd + Shift + A).

Click the gear icon (⚙️) in the top-right corner and select Install Add-on From File....

Select your zipped file or .xpi package to complete installation.

⚙️ Configuration
Right-click the extension in your Thunderbird Add-ons Manager and select Options (or open the settings page from the notification prompt).

Enter your OpenAI API Key (sk-...).

Click Test Key to verify connection and key validity.

Select your preferred OpenAI Model:

gpt-4o-mini (Recommended): Fast, lightweight, and cost-effective for high-volume email processing.

gpt-4o: Maximum classification accuracy for complex edge cases.

gpt-3.5-turbo: Legacy support.

(Optional) Add Custom Classification Prompt Rules to refine how the AI handles specific email patterns.

Click Save Settings.

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


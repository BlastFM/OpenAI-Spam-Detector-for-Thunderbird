# OpenAI Spam Detector for Thunderbird

![Extension Version](https://img.shields.io/badge/version-1.3-blue.svg)
![Thunderbird](https://img.shields.io/badge/Thunderbird-115.0%2B-58A6FF.svg?logo=thunderbird&logoColor=white)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

An AI-powered spam detection and training extension for Mozilla Thunderbird. **OpenAI Spam Detector** utilizes OpenAI's Chat Completions API (such as `gpt-4o-mini` and `gpt-4o`) to classify incoming emails, move unwanted messages to your deleted folder automatically, and continuously adapt to your preferences via few-shot context learning.

---

## 🌟 Key Features

* **Automated AI Spam Classification**: Scans incoming mail synchronously and evaluates content against OpenAI models.
* **Dynamic Context Learning (Few-Shot Training)**:
  * **Spam Training**: Remembers past user-flagged spam and uses example snippets to detect similar future spam.
  * **False Positive Prevention**: Remembers emails marked as "Not Spam" (HAM) to ensure legitimate senders or formats aren't flagged again.
* **Custom Prompting Rules**: Add user-defined heuristics directly into the classification prompt (e.g., *"Always allow invoice emails from acme.com"*).
* **Interactive Desktop Notifications**: Provides instant alerts when spam is intercepted with a one-click **Undo / Restore** button.
* **Modern Dashboard**: Features a responsive options page with light/dark theme support, API key validation testing, and active memory controls.

---

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
    └── popup.html

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


Would you like help creating a release script to zip this into an installable `.xpi` fil

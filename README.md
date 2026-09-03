# OpenAI Spam Detector for Thunderbird

![Extension Version](https://img.shields.io/badge/version-1.3-blue.svg)
![Thunderbird](https://img.shields.io/badge/Thunderbird-115.0%2B-58A6FF.svg?logo=thunderbird&logoColor=white)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

An AI-powered spam detection and training extension for Mozilla Thunderbird. **OpenAI Spam Detector** utilizes OpenAI's Chat Completions API (such as `gpt-4o-mini` and `gpt-4o`) to classify incoming emails, move unwanted messages to your deleted folder automatically, and continuously adapt to your preferences via few-shot context learning.

---

## 🚀 v1.2.0 — Fixed Log Scrolling & Zero-UI Storage BackupThis release stabilizes the two-column options layout, locks the vertical scrolling behavior for both log containers to prevent display reflows, and provides native keyboard shortcuts for log backup and restoration.🚀 New FeaturesZero-UI JSON Backup & Restore: Added shortcut handlers (Ctrl/Cmd + Shift + E for export, Ctrl/Cmd + Shift + I for import) to backup and restore storage data safely without DOM modifications.

## 🐛 Bug Fixes & Layout ImprovementsFixed Column Scrolling (overflow-y: auto): Locked the Detected Spam Log and Active AI Training Memory containers to a fixed 250px height with strict vertical overflow rules (overflow-x: hidden). This enables smooth scrolling without stretching cards or breaking the two-column dashboard structure.  Prevented Grid Layout Shifts: Resolved flexible container expansion in Thunderbird's rendering engine by locking log height bounds and preserving the responsive auto-fit grid.

## 📦 Assetsopenai-spam-detector-v1.2.0.xpi: Main extension package. Fully compatible with Thunderbird WebExtension API standards.Installation Note: Install via Thunderbird Add-ons Manager (Tools > Add-ons and Themes > ⚙️ > Install Add-on From File...).

## 🌟 Key Features

- **Automated Spam Detection**: Leverages OpenAI models (`gpt-4o-mini`, `gpt-4o`) to classify incoming messages.
- **Two-Pane History Dashboard**:
  - **Detected Spam Log**: Keeps track of flagged spam items.
  - **AI Training Memory**: Stores non-spam classifications to refine filter accuracy.
- **Scrollable Log Views**: Vertical overflow containers prevent layout disruption regardless of log entry volume.
- **JSON Backup & Restore**: Export and import your storage configuration and logs at any time.

---

## ⌨️ Backup & Restore (Settings Shortcuts)

To maintain UI performance and prevent layout reflows in Thunderbird, storage backups can be exported or imported directly from the **Settings Page** using native keyboard shortcuts:

| Action | Shortcut (Windows/Linux) | Shortcut (Mac) | Description |
| :--- | :--- | :--- | :--- |
| **Export Backup** | `Ctrl` + `Shift` + `E` | `Cmd` + `Shift` + `E` | Downloads a `.json` backup file containing all local logs and API configurations. |
| **Import Backup** | `Ctrl` + `Shift` + `I` | `Cmd` + `Shift` + `I` | Opens a file picker to restore extension storage from a previously exported `.json` file. |

> **Note**: These shortcuts must be pressed while active on the **OpenAI Spam Detector Settings** tab.

---

## 🚀 Installation & Release Packaging

Open Thunderbird:

Go to Tools > Add-ons and Themes.

Click the ⚙️ (Gear Icon) and select Install Add-on From File...

Select openai-spam-detector-v1.1.0.xpi.

---

## 📁 Repository Structure

```text
OpenAI-Spam-Detector-for-Thunderbird/
├── manifest.json
├── background.js
├── README.md
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


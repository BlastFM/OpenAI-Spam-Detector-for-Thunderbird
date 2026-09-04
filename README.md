# OpenAI Spam Detector for Thunderbird

![Extension Version](https://img.shields.io/badge/version-1.3-blue.svg)
![Thunderbird](https://img.shields.io/badge/Thunderbird-115.0%2B-58A6FF.svg?logo=thunderbird&logoColor=white)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

An AI-powered spam detection and training extension for Mozilla Thunderbird. **OpenAI Spam Detector** utilizes OpenAI's Chat Completions API (such as `gpt-4o-mini` and `gpt-4o`) to classify incoming emails, move unwanted messages to your deleted folder automatically, and continuously adapt to your preferences via few-shot context learning.

---

## What’s New in v1.3.2
Custom Spam Destination Selector
Users can now control exactly where emails marked as spam are moved upon detection. A new dropdown menu in the Options UI allows choosing between multiple routing destinations:

Trash / Bin (Default): Directly moves detected spam to your account's Trash folder.

Account Junk / Spam Folder: Routes detected spam to your account's server-synchronized Junk or Spam folder.

Local Folders / AI Filtered Spam: Automatically creates and routes detected messages to a dedicated local directory (Local Folders > AI Filtered Spam). This safely isolates AI-classified spam away from standard junk folders and keeps false positives easy to manage without risk of auto-purging.

Folder Creation & Fallback Logic
Automated Local Folder Initialization: Selecting the local destination dynamically creates the AI Filtered Spam folder under Local Folders on first use if it does not already exist.

Improved Fallback Chains: If a custom folder destination becomes unavailable, the background handler gracefully defaults to the standard account Trash to prevent unprocessed emails from sticking in the Inbox.

### Configuration Options

Open the Extension Options page (`Tools > Add-ons & Themes > Options`) to configure the following settings:

| Setting | Description |
| :--- | :--- |
| **OpenAI API Key** | Your OpenAI secret key (`sk-...`) used to authenticate requests. |
| **OpenAI Model** | Select your preferred classification model (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`). |
| **Spam Action Destination** | Target folder where flagged spam is routed (`Trash`, `Account Junk`, or `Local Folders / AI Filtered Spam`). |
| **Custom Rules** | Text prompt to add strict user rules (e.g., *Always mark newsletters from domain.com as HAM*). |

#### Using the Dedicated Local Spam Folder
To keep AI-detected spam isolated from server-synced folders:
1. Open Extension Settings and set **Spam Action Destination** to `Local Folders / AI Filtered Spam`.
2. When the AI detects a spam email, it automatically creates and routes the message to `Local Folders > AI Filtered Spam` inside Thunderbird.
3. You can set a custom local retention policy on this folder (e.g., auto-delete after 14 days) by right-clicking the folder in Thunderbird and selecting **Properties > Retention Policy**.

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

## Download & Installation

[![Download Release](https://img.shields.io/badge/Download-v1.3.2_.XPI-blue?style=for-the-badge&logo=thunderbird&logoColor=white)](https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird/releases/download/v1.3.2/openai-spam-detector-v1.3.2.xpi)
[![Get Latest Release](https://img.shields.io/github/v/release/YOUR_USERNAME/YOUR_REPO?color=green&label=Latest%20Release&style=for-the-badge)](https://github.com/BlastFM/OpenAI-Spam-Detector-for-Thunderbird/releases/latest)

### Direct Downloads

| Asset | Description | Download Link |
| :--- | :--- | :--- |
| **Extension Binary** | Ready-to-install Thunderbird Add-on | [`openai-spam-detector-v1.3.2.xpi`](https://github.com/YOUR_USERNAME/YOUR_REPO/releases/download/v1.3.2/openai-spam-detector-v1.3.2.xpi) |
| **Source Code** | Compressed source files (`.zip`) | [`Source code (zip)`](https://github.com/YOUR_USERNAME/YOUR_REPO/archive/refs/tags/v1.3.2.zip) |

---

### How to Install in Thunderbird

1. Click the download button above to save **`openai-spam-detector-v1.3.2.xpi`** to your computer.
2. Open Thunderbird and navigate to **Add-ons and Themes** (`Ctrl+Shift+A` or `Cmd+Shift+A`).
3. Click the gear icon (**Tools for all add-ons**) in the top-right corner.
4. Select **Install Add-on From File...** and choose the downloaded `.xpi` file.

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

## Release History

### [v1.3.1] - 2026-09-04

#### Added
* **Dedicated Configuration Export/Import:** Introduced independent configuration backup and restore controls within the left-hand Configuration panel to back up API keys, model selections, and custom prompt rules separately from log data.

#### Changed
* **Action Styling:** Applied a dedicated slate/navy blue theme (`.btn-slate`) to Configuration panel backup controls to visually distinguish setting actions from log management.
* **Hover Interaction:** Enhanced hover feedback across configuration buttons with a higher-contrast steel-blue shade and subtle elevation shadows.

📄 License
Distributed under the MIT License. See LICENSE for more information.


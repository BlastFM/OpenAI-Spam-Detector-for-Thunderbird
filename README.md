# OpenAI Spam Detector for Thunderbird

![Extension Version](https://img.shields.io/badge/version-1.3.2-blue.svg)
![Thunderbird](https://img.shields.io/badge/Thunderbird-102.0%2B-58A6FF.svg?logo=thunderbird&logoColor=white)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

An AI-powered spam detection and continuous-training extension for Mozilla Thunderbird. **OpenAI Spam Detector** utilizes OpenAI's Chat Completions API (`gpt-4o-mini`, `gpt-4o`) to automatically classify incoming emails, move unwanted messages to designated spam folders, and continuously adapt to your preferences through few-shot context learning.

---

## 🌟 Key Features

* **Automated AI Email Filtering**: Real-time evaluation of incoming emails using customized OpenAI prompts and user-defined rules.
* **Continuous Context Training**: Right-click context menus allow one-click training (*Mark as Spam* / *Mark as Not Spam*) to feed few-shot examples back into the AI engine.
* **Flexible Action Routing**: Automatically route detected spam to `Trash`, `Account Junk`, or an isolated `Local Folders / AI Filtered Spam` folder.
* **Two-Pane History Dashboard**: Scrollable, non-disruptive logs tracking *Detected Spam* and *AI Training Memory*.
* **Full Data Portability**: Instant JSON backup and restore for configurations, custom prompt rules, and training memory.

---

## 💡 How It Works

### Context Menu Training
* **Mark as Spam**: Right-click any email and select **Train AI: Mark as Spam**. The message is moved to your designated spam folder, logged in training memory, and appended as a negative example in future API payloads.
* **Mark as Not Spam**: Right-click a misclassified message and select **Train AI: Mark as Not Spam**. The email is returned to your Inbox and added as a positive example to prevent similar false positives.

### Message Processing Pipeline

```mermaid
graph TD
    A[New Email Received] --> B{API Key Configured?}
    B -- No --> C[Notify User & Prompt Options]
    B -- Yes --> D[Extract Email Headers & Body Snippet]
    D --> E[Fetch Custom Rules + Training Memory]
    E --> F[Send Request to OpenAI API]
    F --> G{Verdict: SPAM or HAM?}
    G -- SPAM --> H[Move Email to Spam Destination]
    H --> I[Log Event & Show Notification]
    G -- HAM --> J[Retain Email in Inbox]

### 🚀 Installation
Direct DownloadsAssetDescriptionDownload LinkExtension BinaryReady-to-install Thunderbird Add-onopenai-spam-detector-v1.3.2.xpiSource CodeCompressed repository sourceSource code (zip)Installation StepsDownload openai-spam-detector-v1.3.2.xpi using the button or link above.Open Thunderbird and navigate to Add-ons and Themes (Ctrl + Shift + A or Cmd + Shift + A).Click the Gear Icon (⚙️) at the top right of the tab.Select Install Add-on From File... and pick the downloaded .xpi file.Click Add when prompted to grant required permissions.⚙️ Configuration OptionsAccess settings via Add-ons and Themes $\rightarrow$ Thunderbird OpenAI Spam Detector $\rightarrow$ Options.SettingDescriptionOpenAI API KeySecret key (sk-...) used to authenticate with OpenAI API endpoints.OpenAI ModelChoose from gpt-4o-mini (fast & cost-effective, recommended), gpt-4o (highest precision), or gpt-3.5-turbo.Spam Action DestinationDestination folder for spam: Trash, Account Junk, or Local Folders / AI Filtered Spam.Custom RulesUser-defined prompt instructions (e.g., "Always mark messages containing order confirmations from domain.com as HAM").Using the Dedicated Local Spam FolderTo keep AI-filtered spam isolated from server-synced IMAP accounts:Set Spam Action Destination to Local Folders / AI Filtered Spam.When spam is detected, the extension creates and routes messages to Local Folders > AI Filtered Spam.Configure a custom retention policy (e.g., auto-delete after 14 days) by right-clicking the folder in Thunderbird and choosing Properties $\rightarrow$ Retention Policy.⌨️ Backup & Restore ShortcutsManage extension data directly from the Settings Page using native keyboard shortcuts:ActionShortcut (Windows/Linux)Shortcut (Mac)DescriptionExport BackupCtrl + Shift + ECmd + Shift + EDownloads a .json file containing all API keys, rules, and logs.Import BackupCtrl + Shift + ICmd + Shift + IRestores settings and training logs from an exported .json file.Note: These shortcuts are active while focused on the OpenAI Spam Detector Settings tab.

### 📁 Repository StructurePlaintextOpenAI-Spam-Detector-for-Thunderbird/
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

### 🛡️ Permissions & Privacy
This extension operates strictly as a local Thunderbird WebExtension using standard permissions:messagesRead & messagesMove: Inspect incoming message headers/snippets and move flagged messages.accountsRead & accountsFolders: Resolve folder structures across configured email accounts.menus: Add training controls to message list context menus.storage: Persist local API keys, settings, custom prompt rules, and classification memory.downloads & tabs: Handle configuration export files and UI navigation.Host Permission (https://api.openai.com/*): Transmit snippet payloads to OpenAI endpoints.Privacy Notice: Transmitted data includes email sender headers, subject line, and the first 1,000 characters of the body text. Data is sent directly to OpenAI's API according to their Data Usage Policies. No intermediate third-party servers are used.📄 LicenseDistributed under the MIT License. See LICENSE for details.

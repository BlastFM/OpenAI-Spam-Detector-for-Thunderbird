# OpenAI Spam Detector for Thunderbird

![Extension Version](https://img.shields.io/badge/version-1.3.6-blue.svg)
![Thunderbird](https://img.shields.io/badge/Thunderbird-115.0%2B-58A6FF.svg?logo=thunderbird&logoColor=white)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green.svg)
![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)

An AI-powered spam detection and training extension for Mozilla Thunderbird. **OpenAI Spam Detector** utilizes OpenAI's Chat Completions API (such as `gpt-4o-mini` and `gpt-4o`) to classify incoming emails, move unwanted messages to your deleted folder automatically, and continuously adapt to your preferences via few-shot context learning.

This add-on is offered **FREE by BlastFM Limited at this time**. OpenAI API usage may incur separate charges from OpenAI.

---

Release Date: September 5, 2026

Compatibility: Thunderbird 102.0+ (Manifest V3)

This release adds a redesigned options interface with clearer action grouping, stronger status cues, and more distinct backup and destructive controls. The header now identifies BlastFM Limited, states that the add-on is currently free, and dynamically reports save status. It also includes the reliability and packaging fixes from v1.3.4.

🌟 What's Changed  
🐛 Bug Fixes & Stability Improvements
Archive Path Resolution (/ Normalization): Switched the XPI build process to .NET archive compilation to enforce forward-slash path separators. This resolves the persistent "Page Not Found" errors on the Options page and missing toolbar icons on Windows installations.

Manifest V3 Permission Mapping: Updated manifest.json with complete relative icon sizing declarations across icons and action.default_icon, alongside updated permissions (accountsRead, accountsFolders, messagesRead, messagesMove, storage, downloads, tabs, menus).

Options UI & Scope Fixes: Resolved duplicate DOM element ID conflicts and variable scoping errors in options.js and options.html.

🔒 Data Backup & Portability  
Full backup and restore controls are provided in the Detected Spam Log panel. A full JSON backup contains synced settings, the API key, spam history, and AI training memory. Separate rules/key backup controls were removed from the Configuration panel to avoid duplicate backup paths. Backup and restore status is shown only after the corresponding download, storage writes, and log refresh complete successfully. Backups remain compatible with the existing plain-text JSON format and warn users before exporting API credentials.

✅ Options Feedback  
The options page now provides clearer progress, validation, success, and error messages for settings, OpenAI connection tests, spam logs, AI training memory, and backup actions. All of these messages use the dynamic header status indicator rather than a separate floating confirmation. Status and error announcements use accessible live-region behavior for assistive technology.

🔍 Checksum (Integrity Verification)  
Filename: openai-spam-detector-v1.3.6.xpi
### SHA-256: `63ED11D23CBE2E0BF0BF31D8F1D01B2C335D2962BA67A192DA5CD1775F7639C1`

### Configuration Options

Open the Extension Options page (`Tools > Add-ons & Themes > Options`) to configure the following settings:

| Setting | Description |
| :--- | :--- |
| **OpenAI API Key** | Your OpenAI secret key (`sk-...`) used to authenticate requests. |
| **OpenAI Model** | Select `gpt-4o-mini` or `gpt-4o` for classification. |
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
- **Context-Menu Training**: Mark messages as spam or not spam directly from the Thunderbird message list.
- **Reliable Folder Routing**: Spam can be sent to Trash, the account Junk folder, or `Local Folders / AI Filtered Spam`.
- **Move-Before-Log Guarantees**: Training and classification logs are updated only after Thunderbird confirms the requested message move.
- **Scrollable Log Views**: Vertical overflow containers prevent layout disruption regardless of log entry volume.
- **JSON Backup & Restore**: Export and import your storage configuration and logs at any time.
- **Dynamic Save Status**: The options header shows whether settings are ready to save, have unsaved changes, are being saved, or were saved successfully. Transient status messages automatically reset after five seconds.
- **Header Branding**: The options page uses the bundled spam-shield logo, identifies BlastFM Limited as the publisher, and states the current free availability.
- **Publisher Footer**: A footer at the bottom of the options page identifies BlastFM Limited and the add-on's current free availability.

---

## 💾 Backup & Restore

Storage backups can be exported or imported from the **Detected Spam Log** panel on the Settings Page. The full backup includes synced settings, the local API key, spam history, and AI training memory.

1. Open the extension Settings page.
2. Use **Export Full Backup** or **Import Full Backup** in the Detected Spam Log panel.
3. Confirm the plaintext API-key warning before exporting, and keep exported backup files secure.

Restore success is reported only after storage writes and the log refresh complete. Existing JSON backups remain importable.

---

## 🚀 Installation & Release Packaging

## Download & Installation

[![Download Mozilla Thunderbird](https://img.shields.io/badge/Download-Mozilla%20Thunderbird-0A84FF?style=for-the-badge&logo=thunderbird&logoColor=white)](https://www.thunderbird.net/)

Install [Mozilla Thunderbird](https://www.thunderbird.net/) first, then install the OpenAI Spam Detector extension from the release asset below.

[![Download Release](https://img.shields.io/badge/Download-v1.3.6_.XPI-blue?style=for-the-badge&logo=thunderbird&logoColor=white)](https://github.com/BlastFM/ThunderbirdPersonalSpamFilter/releases/download/v1.3.6/openai-spam-detector-v1.3.6.xpi)
[![Get Latest Release](https://img.shields.io/github/v/release/BlastFM/ThunderbirdPersonalSpamFilter?color=green&label=Latest%20Release&style=for-the-badge)](https://github.com/BlastFM/ThunderbirdPersonalSpamFilter/releases/latest)

### Direct Downloads

| Asset | Description | Download Link |
| :--- | :--- | :--- |
| **Extension Binary** | Ready-to-install Thunderbird Add-on | [`openai-spam-detector-v1.3.6.xpi`](https://github.com/BlastFM/ThunderbirdPersonalSpamFilter/releases/download/v1.3.6/openai-spam-detector-v1.3.6.xpi) |
| **Source Code** | Compressed source files (`.zip`) | [`Source code (zip)`](https://github.com/BlastFM/ThunderbirdPersonalSpamFilter/archive/refs/tags/v1.3.6.zip) |

---

### How to Install in Thunderbird

1. Download and install [Mozilla Thunderbird](https://www.thunderbird.net/) if it is not already installed.
2. Click the extension download button above to save **`openai-spam-detector-v1.3.6.xpi`**.
3. Open Thunderbird and navigate to **Add-ons and Themes** (`Ctrl+Shift+A` or `Cmd+Shift+A`).
4. Click the gear icon (**Tools for all add-ons**) in the top-right corner.
5. Select **Install Add-on From File...** and choose the downloaded `.xpi` file.

---

## 📁 Repository Structure

```text
ThunderbirdPersonalSpamFilter/
├── .github/
│   └── workflows/
│       └── package.yml
├── .gitignore
├── LICENSE
├── manifest.json
├── background.js
├── README.md
├── openai-spam-detector-v1.3.6.xpi
├── icons/
│   ├── icon-48.png
│   ├── icon.png
│   ├── spam-detector-header.png
│   ├── not-spam-green.png
│   ├── not-spam-green.svg
│   ├── spam-red.png
│   └── spam-red.svg
└── options/
    ├── options.css
    ├── options.html
    ├── options.js
    ├── popup.html
    └── popup.js
```

🚀 Installation & Setup
Manual Installation in Thunderbird
Download or clone this repository to your local machine:

Bash
git clone https://github.com/BlastFM/ThunderbirdPersonalSpamFilter.git
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
Mark as Spam: Right-click any email in your message list and choose **Mark as Spam (Train AI)**. The add-on moves the email to the configured spam destination first, then records the successful action in the Detected Spam Log. The original folder is retained for restoration.

Mark as Not Spam: Right-click an email and choose **Mark as Not Spam (Train AI)**. The add-on restores the email to its recorded original folder when available, then adds it to AI Training Memory and removes it from the Detected Spam Log. If the original folder is unavailable, it falls back to the account Inbox.

Both actions leave their logs unchanged if Thunderbird cannot complete the requested move. Message header identifiers are retained to improve restoration matching when Thunderbird assigns a new message ID during an IMAP move.

### Message Processing Pipeline

```mermaid
graph TD
    A[New email received] --> B[Read sender, subject, and message body]
    B --> C{Whitelist match?}
    C -- Yes --> D[Keep in inbox and skip classification]
    C -- No --> E{Blacklist match?}
    E -- Yes --> F[Move to configured spam destination]
    F --> G[Write Detected Spam Log entry]
    E -- No --> H{API key configured?}
    H -- No --> I[Keep message unchanged and log a warning]
    H -- Yes --> J[Load custom rules and AI Training Memory]
    J --> K[Send up to 1,500 body characters to OpenAI]
    K --> L{Spam verdict?}
    L -- Yes --> F
    L -- No --> M[Keep message in its current folder]
```

Messages are logged only after a spam move succeeds. A failed move leaves the Detected Spam Log unchanged. Manual **Mark as Spam (Train AI)** and **Mark as Not Spam (Train AI)** actions use the same move-before-log principle; the not-spam action restores the original folder when available and then updates Active AI Training Memory.

🛡️ Permissions & Privacy
This add-on requires the following WebExtension permissions:

messagesRead & messagesMove: To inspect incoming email headers/bodies and move messages to the configured destination or back to their original folder.

accountsRead & accountsFolders: To locate account folders, Junk/Trash/Inbox destinations, and the Local Folders account.

menus: To inject AI training options into the message list context menu.

storage: To save configuration keys, logs, and user training memory locally.

Host Permission (https://api.openai.com/*): Required to transmit snippet data to OpenAI endpoints for evaluation.

Privacy Note: Transmitted email content includes the sender address, subject line, and up to the first 1,500 characters of the body text. Data is processed according to OpenAI's Data Usage Policies. No data is sent to intermediate third-party servers.

## Release History

### [v1.3.6] - 2026-09-05

#### Changed
* Promoted the redesigned options interface to the next release version with the new teal header, readiness indicator, purpose-based sections, and responsive layout.
* Distinguished backup actions from destructive actions with blue and orange visual treatments, pill-shaped controls, and action icons.
* Updated the in-page confirmation dialog to use the same refreshed destructive-action styling.
* Added BlastFM Limited branding and a clear FREE availability notice to the options-page header.
* Added the finalized Thunderbird spam-filter shield image as the options-page header logo while retaining the BlastFM Limited name and FREE availability notice.
* Added a bottom-of-page publisher footer identifying BlastFM Limited and the add-on's current free availability.
* Replaced the static “Ready to save” label with dynamic `Unsaved changes`, `Saving...`, `Saved`, `Needs attention`, and `Save failed` states.
* Routed all options-page success, error, and informational messages through the dynamic header status indicator and removed the old floating confirmation messages.
* Added a five-second reset for transient header messages; the indicator returns to `Unsaved changes` when edits remain or `Ready to save` otherwise.
* Updated release links, package naming, and documentation references for v1.3.6.

#### Compatibility
* Existing settings, logs, training memory, and plaintext JSON backups remain compatible.

### [v1.3.5] - 2026-09-05

#### Changed
* Redesigned the options page with a dark teal header, status indicator, purpose-based sections, and stronger visual hierarchy.
* Grouped backup and destructive actions separately, using pill-shaped controls, icons, and distinct blue/orange action states.
* Added responsive behavior so the redesigned controls stack cleanly on narrow options windows.
* Updated the confirmation dialog styling to match the redesigned destructive-action controls.

#### Compatibility
* Existing settings, logs, training memory, and plaintext JSON backups remain compatible.

### [v1.3.4] - 2026-09-05

#### Changed
* Whitelist matches now skip AI classification and remain in the inbox; blacklist matches move directly to the configured spam destination.
* Spam and not-spam training actions update their logs only after Thunderbird confirms the corresponding message move.
* Failed moves and folder-resolution failures are logged as errors instead of being treated as successful training actions.
* The `AI Filtered Spam` folder is searched recursively before creation, and selecting the local destination no longer silently falls back to Trash.
* Message header identifiers are retained to improve restoration matching when Thunderbird changes a message ID during an IMAP move.
* Backup restore success is reported only after storage writes and the log refresh complete.
* An explicitly empty API key in a full backup clears the existing locally stored key; backups without the field preserve it.
* Full backup and restore controls are centralized in the Detected Spam Log panel, and duplicate left-pane rules/key controls were removed.
* Options-page confirmation, progress, validation, and error messages were improved with accessible live-region announcements.
* The Detected Spam Log now highlights its newest entry with a green Latest marker and responsive top-aligned metadata.
* The Custom Classification Prompt Rules field is larger and vertically resizable for long rule sets.
* Manual context-menu actions continue when message-body retrieval fails, allowing moves and log/training updates to complete with an empty snippet.
* Replaced native clear confirmations with accessible, styled in-page dialogs for the Detected Spam Log and AI Training Memory.

#### Compatibility
* Existing JSON backup files remain importable.
* Plain-text backup exports remain supported and continue to display a warning because API credentials are included.

### [v1.3.1] - 2026-09-04

#### Added
* **Dedicated Configuration Export/Import:** Introduced independent configuration backup and restore controls within the left-hand Configuration panel. These controls were consolidated into the full backup flow in v1.3.4.

#### Changed
* **Action Styling:** Applied a dedicated slate/navy blue theme (`.btn-slate`) to Configuration panel backup controls to visually distinguish setting actions from log management.
* **Hover Interaction:** Enhanced hover feedback across configuration buttons with a higher-contrast steel-blue shade and subtle elevation shadows.

📄 License
Distributed under the MIT License. See LICENSE for more information.

console.log("[Thunderbird OpenAI Spam Detector] Background service worker initialized.");

// Message IDs we are moving ourselves. Used to stop our own moves from
// re-triggering messages.onUpdated -> processIncomingMessages, which
// previously caused every spam-classified (or restored) email to be
// reclassified a second time.
// NOTE: on some account types (notably IMAP) a message can be assigned a
// new id after being moved, so this guard is a best-effort de-duplication,
// not a hard guarantee. It eliminates the common case (local folders/POP,
// and the immediate re-fire that IMAP servers also usually produce).
const pendingProgrammaticMoves = new Set();

async function moveMessageTracked(messageId, destinationFolder) {
  pendingProgrammaticMoves.add(messageId);
  try {
    await messenger.messages.move([messageId], destinationFolder);
  } finally {
    // Safety net: if onUpdated never fires (or fires with a different id),
    // don't let the Set grow forever.
    setTimeout(() => pendingProgrammaticMoves.delete(messageId), 5000);
  }
}

function setupContextMenus() {
  messenger.menus.removeAll().then(() => {
    messenger.menus.create({
      id: "mark-as-spam",
      title: "Mark as Spam (Train AI)",
      contexts: ["message_list"],
      icons: {
        "16": "icons/spam-red.png",
        "32": "icons/spam-red.png"
      }
    });

    messenger.menus.create({
      id: "mark-as-not-spam",
      title: "Mark as Not Spam (Train AI)",
      contexts: ["message_list"],
      icons: {
        "16": "icons/not-spam-green.png",
        "32": "icons/not-spam-green.png"
      }
    });
  }).catch(err => console.error("[Thunderbird OpenAI Spam Detector] Context Menu error:", err));
}

// One-time migration: the API key used to live in storage.sync, which
// syncs to every Thunderbird profile signed into the same account. Move
// it to storage.local so the secret stays on this machine only.
async function migrateApiKeyToLocalStorage() {
  try {
    const syncData = await messenger.storage.sync.get(['apiKey']);
    if (!syncData.apiKey) return;

    const localData = await messenger.storage.local.get(['apiKey']);
    if (!localData.apiKey) {
      await messenger.storage.local.set({ apiKey: syncData.apiKey });
    }
    await messenger.storage.sync.remove('apiKey');
    console.log("[Thunderbird OpenAI Spam Detector] Migrated API key from sync to local storage.");
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] API key migration failed:", err);
  }
}

messenger.runtime.onInstalled.addListener(() => {
  setupContextMenus();
  migrateApiKeyToLocalStorage();
});

messenger.runtime.onStartup.addListener(() => {
  setupContextMenus();
  migrateApiKeyToLocalStorage();
});

// Lets the options page's "Mark as Not Spam" log button reuse this file's
// folder-resolution + tracked-move logic instead of re-implementing it.
messenger.runtime.onMessage.addListener((request) => {
  if (request && request.action === 'restoreMessage' && request.messageId) {
    return manualMarkAsNotSpam(request.messageId);
  }
});

messenger.menus.onClicked.addListener(async (info, tab) => {
  if (!info.selectedMessages || info.selectedMessages.messages.length === 0) return;

  for (let message of info.selectedMessages.messages) {
    if (info.menuItemId === "mark-as-spam") {
      const fullMessage = await messenger.messages.get(message.id);
      const bodyText = await getPlainTextBody(message.id);
      await handleSpamMessage(fullMessage, bodyText);
    } else if (info.menuItemId === "mark-as-not-spam") {
      await manualMarkAsNotSpam(message.id);
    }
  }
});

messenger.messages.onNewMailReceived.addListener(async (folder, messages) => {
  await processIncomingMessages(messages.messages || []);
});

if (messenger.messages.onUpdated) {
  messenger.messages.onUpdated.addListener(async (message, changedProperties) => {
    if (!changedProperties.folder) return;

    // Skip re-classification for moves we triggered ourselves (spam moves
    // and "not spam" restores both change the folder and would otherwise
    // cause this listener to fire again immediately).
    if (pendingProgrammaticMoves.has(message.id)) {
      pendingProgrammaticMoves.delete(message.id);
      return;
    }

    await processIncomingMessages([message]);
  });
}

// Helper: Convert wildcard string (* and ?) to RegExp
function globToRegex(pattern) {
  const escaped = pattern.trim().toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexString = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexString);
}

// Helper: Extract full email address from author string
function getSenderEmail(authorString) {
  if (!authorString) return '';
  const match = authorString.match(/<([^>]+)>/) || [null, authorString];
  return (match[1] || authorString).trim().toLowerCase();
}

// Helper: Match sender email or domain against wildcard rules
function matchesDomainPattern(senderEmail, patternList) {
  if (!patternList || patternList.length === 0) return false;

  const senderDomain = senderEmail.split('@').pop() || '';

  return patternList.some(pattern => {
    const cleanPattern = pattern.trim().toLowerCase();
    if (!cleanPattern) return false;

    // Wildcard matching (* or ?)
    if (cleanPattern.includes('*') || cleanPattern.includes('?')) {
      const regex = globToRegex(cleanPattern);
      return regex.test(senderEmail) || regex.test(senderDomain);
    }

    // Exact domain or subdomain match (e.g. "stripe.com" matches "sub.stripe.com")
    return senderDomain === cleanPattern || senderDomain.endsWith('.' + cleanPattern);
  });
}

async function processIncomingMessages(messageList) {
  const { model, customPrompt, whitelist = '', blacklist = '' } =
    await messenger.storage.sync.get(['model', 'customPrompt', 'whitelist', 'blacklist']);
  const { apiKey } = await messenger.storage.local.get(['apiKey']);

  const safePatterns = whitelist.split(',').map(d => d.trim()).filter(Boolean);
  const blockedPatterns = blacklist.split(',').map(d => d.trim()).filter(Boolean);

  const activeModel = model || 'gpt-4o-mini';
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });

  for (let message of messageList) {
    try {
      const fullMessage = await messenger.messages.get(message.id);
      const senderEmail = getSenderEmail(fullMessage.author);

      // Fast-Path 1: Whitelist Match (Skip AI & Stay in Inbox)
      if (matchesDomainPattern(senderEmail, safePatterns)) {
        console.log(`[Thunderbird OpenAI Spam Detector] Whitelisted pattern match (${senderEmail}): Skipping classification.`);
        continue;
      }

      // Fast-Path 2: Blacklist Match (Skip AI & Move to Spam)
      if (matchesDomainPattern(senderEmail, blockedPatterns)) {
        console.log(`[Thunderbird OpenAI Spam Detector] Blacklisted pattern match (${senderEmail}): Moving to spam.`);
        await handleSpamMessage(fullMessage, "Blacklisted Sender Pattern Match");
        continue;
      }

      // AI Analysis Path
      if (!apiKey) {
        console.warn("[Thunderbird OpenAI Spam Detector] Skipping classification: No API key configured.");
        continue; // was `return` - that aborted the whole batch, not just this message
      }

      const bodyText = await getPlainTextBody(message.id);

      const isSpam = await classifyEmailWithOpenAI({
        author: fullMessage.author,
        subject: fullMessage.subject,
        body: bodyText.substring(0, 1500),
        apiKey,
        model: activeModel,
        customPrompt,
        falsePositives
      });

      if (isSpam) {
        console.log(`[Thunderbird OpenAI Spam Detector] Spam detected: "${fullMessage.subject}"`);
        await handleSpamMessage(fullMessage, bodyText);
      }
    } catch (err) {
      console.error("[Thunderbird OpenAI Spam Detector] Error processing message:", err);
    }
  }
}

// Shared helper: fetch a message's body and return plain, HTML-stripped text.
// Centralizes logic that was previously duplicated in three places.
async function getPlainTextBody(messageId) {
  const messageBody = await messenger.messages.getFull(messageId);
  let bodyText = extractTextFromParts(messageBody.parts || []);
  if (!bodyText.trim() && messageBody.body) {
    bodyText = messageBody.body;
  }
  return stripHtmlTags(bodyText);
}

// Prefers the first text/plain part found anywhere in the MIME tree; only
// falls back to text/html if no plain-text part exists at all. (Previously
// a text/html part appearing before a text/plain part in the tree would
// get concatenated with the plain-text part instead of being skipped.)
function extractTextFromParts(parts) {
  const plain = findPartBody(parts, "text/plain");
  if (plain && plain.trim()) return plain;

  const html = findPartBody(parts, "text/html");
  return html || "";
}

function findPartBody(parts, contentType) {
  for (let part of parts) {
    if (part.contentType === contentType && part.body) {
      return part.body;
    }
    if (part.parts) {
      const nested = findPartBody(part.parts, contentType);
      if (nested) return nested;
    }
  }
  return "";
}

function stripHtmlTags(str) {
  return (str || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function classifyEmailWithOpenAI({ author, subject, body, apiKey, model, customPrompt, falsePositives }) {
  let fpContext = "";
  if (falsePositives && falsePositives.length > 0) {
    fpContext = "\n\nCRITICAL OVERRIDE RULE - The user marked these similar emails as NOT SPAM. Treat emails with similar patterns as HAM:\n" +
      falsePositives.map(fp => `- From: "${fp.author}", Subject: "${fp.subject}"`).join("\n");
  }

  const systemPrompt = `You are an expert email spam classifier running inside Thunderbird. Analyze the email and respond strictly with JSON: {"isSpam": true} or {"isSpam": false}. Do not include markdown formatting or commentary.${fpContext}${customPrompt ? `\n\nCustom User Rules:\n${customPrompt}` : ""}`;

  const userContent = `From: ${author}\nSubject: ${subject}\nBody Snippet:\n${body}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      console.error("[Thunderbird OpenAI Spam Detector] OpenAI API error status:", response.status);
      return false;
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return !!result.isSpam;
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Classification failed:", err);
    return false;
  }
}

async function handleSpamMessage(messageHeader, fullBody) {
  const { spamLog } = await messenger.storage.local.get({ spamLog: [] });
  const { targetFolder } = await messenger.storage.sync.get({ targetFolder: 'trash' });

  const originFolderId = messageHeader.folder ? messageHeader.folder.id : null;

  const newEntry = {
    id: messageHeader.id,
    author: messageHeader.author,
    subject: messageHeader.subject,
    bodySnippet: (fullBody || "").substring(0, 120).replace(/\s+/g, ' '),
    dateAdded: new Date().toISOString(),
    originFolderId: originFolderId
  };

  const updatedLog = [newEntry, ...spamLog].slice(0, 50);
  await messenger.storage.local.set({ spamLog: updatedLog });

  try {
    const account = await messenger.accounts.get(messageHeader.folder.accountId);
    let destinationFolder = null;

    if (targetFolder === 'junk') {
      destinationFolder = findFolderByType(account.folders, 'junk');
    } else if (targetFolder === 'local_ai_spam') {
      destinationFolder = await getOrCreateLocalAISpamFolder();
    }

    if (!destinationFolder) {
      destinationFolder = findFolderByType(account.folders, 'trash');
    }

    if (destinationFolder) {
      await moveMessageTracked(messageHeader.id, destinationFolder);
    }
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not move email to target spam folder:", err);
  }
}

async function manualMarkAsNotSpam(messageId) {
  try {
    const messageHeader = await messenger.messages.get(messageId);
    const bodyText = await getPlainTextBody(messageId);

    const { spamLog } = await messenger.storage.local.get({ spamLog: [] });
    const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });

    const logItem = spamLog.find(item => item.id === messageId);
    let targetFolder = null;

    if (logItem && logItem.originFolderId) {
      try {
        targetFolder = await messenger.folders.get(logItem.originFolderId);
      } catch (e) {
        console.warn("[Thunderbird OpenAI Spam Detector] Origin folder unavailable, falling back to Inbox.");
      }
    }

    if (!targetFolder) {
      const account = await messenger.accounts.get(messageHeader.folder.accountId);
      targetFolder = findFolderByType(account.folders, 'inbox');
    }

    const newFP = {
      id: messageHeader.id,
      author: messageHeader.author,
      subject: messageHeader.subject,
      bodySnippet: (bodyText || "").substring(0, 120).replace(/\s+/g, ' '),
      dateAdded: new Date().toISOString()
    };

    const updatedFP = [newFP, ...falsePositives].slice(0, 20);
    const updatedSpamLog = spamLog.filter(item => item.id !== messageId);

    await messenger.storage.local.set({
      falsePositives: updatedFP,
      spamLog: updatedSpamLog
    });

    if (targetFolder) {
      await moveMessageTracked(messageId, targetFolder);
    }
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Error marking message as not spam:", err);
  }
}

function findFolderByType(folders, typeName) {
  for (let f of folders) {
    if (f.type === typeName) return f;
    const lowerName = (f.name || "").toLowerCase();
    if (typeName === 'trash' && (lowerName === 'trash' || lowerName === 'deleted' || lowerName === 'deleted items' || lowerName === 'bin')) return f;
    if (typeName === 'junk' && (lowerName === 'junk' || lowerName === 'spam' || lowerName === 'bulk')) return f;
    if (typeName === 'inbox' && lowerName === 'inbox') return f;

    if (f.subFolders && f.subFolders.length > 0) {
      const found = findFolderByType(f.subFolders, typeName);
      if (found) return found;
    }
  }
  return null;
}

async function getOrCreateLocalAISpamFolder() {
  try {
    const accounts = await messenger.accounts.list();
    const localAccount = accounts.find(a => a.type === "none" || a.name === "Local Folders");

    if (!localAccount) return null;

    let targetFolder = localAccount.folders.find(f => f.name === "AI Filtered Spam");

    if (!targetFolder && localAccount.folders.length > 0) {
      const rootFolder = localAccount.folders[0];
      targetFolder = await messenger.folders.create(rootFolder, "AI Filtered Spam");
    }
    return targetFolder;
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not find or create Local Folders / AI Filtered Spam:", err);
    return null;
  }
}

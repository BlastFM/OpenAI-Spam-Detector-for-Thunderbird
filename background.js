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
  const selectedMessages = info.selectedMessages && info.selectedMessages.messages;
  if (!selectedMessages || selectedMessages.length === 0) {
    console.warn("[Thunderbird OpenAI Spam Detector] No message was selected for the context-menu action.");
    return;
  }

  for (let message of selectedMessages) {
    try {
      if (info.menuItemId === "mark-as-spam") {
        const fullMessage = await messenger.messages.get(message.id);
        const bodyText = await getPlainTextBodyForAction(message.id);
        await handleSpamMessage(fullMessage, bodyText, 'local_ai_spam');
      } else if (info.menuItemId === "mark-as-not-spam") {
        await manualMarkAsNotSpam(message.id);
      }
    } catch (err) {
      console.error(
        `[Thunderbird OpenAI Spam Detector] Context-menu action failed for message ${message.id}:`,
        err
      );
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
  const { model, customPrompt, whitelist = '', blacklist = '', targetFolder } =
    await messenger.storage.sync.get(['model', 'customPrompt', 'whitelist', 'blacklist', 'targetFolder']);
  const { apiKey } = await messenger.storage.local.get(['apiKey']);

  const safePatterns = whitelist.split(',').map(d => d.trim()).filter(Boolean);
  const blockedPatterns = blacklist.split(',').map(d => d.trim()).filter(Boolean);

  const activeModel = model || 'gpt-4o-mini';
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });

  const resolvedTargetFolder = targetFolder || 'trash';
  // Cache the resolved spam destination per account for this batch. This
  // avoids a redundant accounts.get()/Local Folders lookup per message and,
  // more importantly, lets us detect messages that are already sitting in
  // the spam destination (see the guard below).
  const destinationCache = new Map();

  for (let message of messageList) {
    try {
      const fullMessage = await messenger.messages.get(message.id);
      const senderEmail = getSenderEmail(fullMessage.author);

      // Guard against reclassifying messages that are already in the spam
      // destination. This matters most for the "Local Folders / AI Filtered
      // Spam" destination: moving a message there from a different account
      // is a copy+delete under the hood, and Thunderbird can surface the
      // copy as "new mail", which would otherwise re-trigger the AI call
      // and append a duplicate log entry for a message we already handled.
      if (fullMessage.folder) {
        const currentDestination = await resolveSpamDestinationFolder(
          fullMessage.folder.accountId, resolvedTargetFolder, destinationCache
        );
        if (currentDestination && currentDestination.id === fullMessage.folder.id) {
          continue;
        }
      }

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

// Resolves (and caches, per batch) the MailFolder that a given account's
// spam should currently land in for the configured destination setting.
// For 'local_ai_spam' the destination is a single shared folder regardless
// of account, so it is only resolved once per batch under the 'local_ai_spam'
// cache key instead of once per account.
async function resolveSpamDestinationFolder(accountId, resolvedTargetFolder, cache) {
  if (resolvedTargetFolder === 'local_ai_spam') {
    if (!cache.has('local_ai_spam')) {
      cache.set('local_ai_spam', await getOrCreateLocalAISpamFolder());
    }
    return cache.get('local_ai_spam');
  }

  if (!cache.has(accountId)) {
    try {
      const account = await messenger.accounts.get(accountId);
      const folder = resolvedTargetFolder === 'junk'
        ? findFolderByType(account.folders, 'junk')
        : findFolderByType(account.folders, 'trash');
      cache.set(accountId, folder);
    } catch (err) {
      cache.set(accountId, null);
    }
  }
  return cache.get(accountId);
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

async function getPlainTextBodyForAction(messageId) {
  try {
    return await getPlainTextBody(messageId);
  } catch (err) {
    // Body access is useful for the log snippet, but must not prevent a
    // manual spam action from moving and recording the selected message.
    console.warn(
      `[Thunderbird OpenAI Spam Detector] Could not read message body for ${messageId}; continuing without a snippet:`,
      err
    );
    return "";
  }
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

async function handleSpamMessage(messageHeader, fullBody, destinationOverride = null) {
  const { spamLog = [] } = await messenger.storage.local.get(['spamLog']);
  const { targetFolder } = await messenger.storage.sync.get({ targetFolder: 'trash' });
  const selectedTargetFolder = destinationOverride || targetFolder;

  try {
    if (!messageHeader.folder) {
      throw new Error("The message has no source folder.");
    }

    const account = await messenger.accounts.get(messageHeader.folder.accountId);
    let destinationFolder = null;

    if (selectedTargetFolder === 'junk') {
      destinationFolder = findFolderByType(account.folders, 'junk');
    } else if (selectedTargetFolder === 'local_ai_spam') {
      destinationFolder = await getOrCreateLocalAISpamFolder();
    } else {
      destinationFolder = findFolderByType(account.folders, 'trash');
    }

    const alreadyInDestination = destinationFolder && destinationFolder.id === messageHeader.folder.id;

    if (alreadyInDestination) {
      console.log("[Thunderbird OpenAI Spam Detector] Message is already in the configured spam folder.");
    } else if (destinationFolder) {
      await moveMessageTracked(messageHeader.id, destinationFolder);
    } else {
      throw new Error("No destination folder was found for the spam action.");
    }

    // If the message was already sitting in the destination folder, its
    // current folder isn't a meaningful "original" location to restore to
    // later, so leave originFolderId unset (manualMarkAsNotSpam already
    // falls back to Inbox when it is missing).
    const originFolderId = alreadyInDestination ? null : messageHeader.folder.id;

    const newEntry = {
      id: messageHeader.id,
      headerMessageId: messageHeader.headerMessageId || null,
      author: messageHeader.author,
      subject: messageHeader.subject,
      bodySnippet: (fullBody || "").substring(0, 120).replace(/\s+/g, ' '),
      dateAdded: new Date().toISOString(),
      originFolderId: originFolderId
    };

    // Only record the classification after Thunderbird confirms the move.
    // De-dupe against any existing entry for the same message (matched by
    // id or, as a fallback for IMAP ids that can change after a move, by
    // headerMessageId) so repeated actions on the same message update its
    // entry in place instead of growing the log with duplicates.
    const dedupedLog = spamLog.filter(item =>
      item.id !== newEntry.id &&
      !(newEntry.headerMessageId && item.headerMessageId === newEntry.headerMessageId)
    );
    const updatedLog = [newEntry, ...dedupedLog].slice(0, 50);
    await messenger.storage.local.set({ spamLog: updatedLog });
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not move email to target spam folder:", err);
    throw err;
  }
}

async function manualMarkAsNotSpam(messageId) {
  try {
    const messageHeader = await messenger.messages.get(messageId);
    const bodyText = await getPlainTextBodyForAction(messageId);

    const { spamLog = [], falsePositives = [] } =
      await messenger.storage.local.get(['spamLog', 'falsePositives']);

    const logItem = spamLog.find(item =>
      item.id === messageId ||
      (messageHeader.headerMessageId &&
        item.headerMessageId === messageHeader.headerMessageId)
    );
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
      headerMessageId: messageHeader.headerMessageId || null,
      author: messageHeader.author,
      subject: messageHeader.subject,
      bodySnippet: (bodyText || "").substring(0, 120).replace(/\s+/g, ' '),
      dateAdded: new Date().toISOString()
    };

    // De-dupe the same way handleSpamMessage does, so repeatedly restoring
    // the same message doesn't grow the training data with duplicates.
    const dedupedFP = falsePositives.filter(item =>
      item.id !== newFP.id &&
      !(newFP.headerMessageId && item.headerMessageId === newFP.headerMessageId)
    );
    const updatedFP = [newFP, ...dedupedFP].slice(0, 20);
    const updatedSpamLog = spamLog.filter(item => item !== logItem);

    if (!targetFolder) {
      throw new Error("No destination folder was found for restoring the message.");
    }

    await moveMessageTracked(messageId, targetFolder);

    // Only update training history after Thunderbird confirms the restore.
    await messenger.storage.local.set({
      falsePositives: updatedFP,
      spamLog: updatedSpamLog
    });
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Error marking message as not spam:", err);
    throw err;
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

    let targetFolder = findFolderByName(localAccount.folders, "AI Filtered Spam");

    if (!targetFolder) {
      // Passing the account (rather than one of its folders) as the parent
      // creates "AI Filtered Spam" as a top-level folder of Local Folders.
      // Passing an arbitrary existing folder here would instead nest it as
      // a subfolder of whichever folder happened to be first in the list.
      targetFolder = await messenger.folders.create(localAccount, "AI Filtered Spam");
    }
    return targetFolder;
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not find or create Local Folders / AI Filtered Spam:", err);
    return null;
  }
}

function findFolderByName(folders, folderName) {
  for (let folder of folders || []) {
    if (folder.name === folderName) return folder;
    const nested = findFolderByName(folder.subFolders, folderName);
    if (nested) return nested;
  }
  return null;
}

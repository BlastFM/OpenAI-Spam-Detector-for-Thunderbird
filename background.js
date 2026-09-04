console.log("[Thunderbird OpenAI Spam Detector] Optimized background worker initialized.");

// Account folder cache with TTL support
const folderCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache invalidation

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

messenger.runtime.onInstalled.addListener(() => setupContextMenus());
messenger.runtime.onStartup.addListener(() => setupContextMenus());

// Reliable worker queue for controlled concurrency
async function processInBatches(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(item => fn(item)));
    results.push(...chunkResults);
  }
  return results;
}

<<<<<<< HEAD
messenger.menus.onClicked.addListener(async (info, tab) => {
=======
// Context Menu Click Listener
messenger.menus.onClicked.addListener(async (info) => {
>>>>>>> origin/main
  if (!info.selectedMessages || info.selectedMessages.messages.length === 0) return;

  await processInBatches(info.selectedMessages.messages, 3, async (message) => {
    if (info.menuItemId === "mark-as-spam") {
      const fullMessage = await messenger.messages.get(message.id);
      const messageBody = await messenger.messages.getFull(message.id);
<<<<<<< HEAD
      let bodyText = extractTextFromParts(messageBody.parts || []);
      if (!bodyText && messageBody.body) bodyText = messageBody.body;
      bodyText = stripHtmlTags(bodyText);
=======
      let bodyText = stripHtmlTags(extractTextFromParts(messageBody.parts || []));
>>>>>>> origin/main
      await handleSpamMessage(fullMessage, bodyText);
    } else if (info.menuItemId === "mark-as-not-spam") {
      await manualMarkAsNotSpam(message.id);
    }
  });
});

<<<<<<< HEAD
=======
// Automatic New Mail Classifier (Throttled Concurrency)
>>>>>>> origin/main
messenger.messages.onNewMailReceived.addListener(async (folder, messages) => {
  await processIncomingMessages(messages.messages || []);
});

if (messenger.messages.onUpdated) {
  messenger.messages.onUpdated.addListener(async (message, changedProperties) => {
    if (changedProperties.folder) {
      await processIncomingMessages([message]);
    }
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
  const { apiKey, model, customPrompt, whitelist = '', blacklist = '' } = 
    await messenger.storage.sync.get(['apiKey', 'model', 'customPrompt', 'whitelist', 'blacklist']);

  const safePatterns = whitelist.split(',').map(d => d.trim()).filter(Boolean);
  const blockedPatterns = blacklist.split(',').map(d => d.trim()).filter(Boolean);

  const activeModel = model || 'gpt-4o-mini';
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });
  const messageList = messages.messages || [];

<<<<<<< HEAD
  for (let message of messageList) {
=======
  await processInBatches(messageList, 3, async (message) => {
>>>>>>> origin/main
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
        return;
      }

      const messageBody = await messenger.messages.getFull(message.id);
<<<<<<< HEAD
      let bodyText = extractTextFromParts(messageBody.parts || []);
      if (!bodyText.trim() && messageBody.body) {
        bodyText = messageBody.body;
      }
=======
      
      let bodyText = messageBody.parts && messageBody.parts.length > 0 
        ? extractTextFromParts(messageBody.parts)
        : (messageBody.body || "");

      bodyText = stripHtmlTags(bodyText);
>>>>>>> origin/main

      bodyText = stripHtmlTags(bodyText);

      const isSpam = await classifyEmailWithOpenAI({
        author: fullMessage.author,
        subject: fullMessage.subject,
        body: bodyText.substring(0, 1200),
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
<<<<<<< HEAD
  }
}
=======
  });
});
>>>>>>> origin/main

function stripHtmlTags(str) {
  return (str || "")
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTextFromParts(parts) {
  let plainText = "";
  let htmlText = "";

  for (let part of parts) {
    if (part.contentType === "text/plain" && part.body) {
<<<<<<< HEAD
      text += part.body + "\n";
    } else if (part.contentType === "text/html" && part.body) {
      if (!text.trim()) {
        text += part.body + "\n";
      }
=======
      plainText += part.body + "\n";
    } else if (part.contentType === "text/html" && part.body) {
      htmlText += part.body + "\n";
>>>>>>> origin/main
    } else if (part.parts) {
      const nested = extractTextFromParts(part.parts);
      if (nested) return nested;
    }
  }
  return plainText || htmlText;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.0,
        max_tokens: 15,
        response_format: { type: "json_object" }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("[Thunderbird OpenAI Spam Detector] OpenAI status error:", response.status);
      return false;
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content.trim();
    
    try {
      const result = JSON.parse(rawContent);
      return !!result.isSpam;
    } catch (parseErr) {
      return /"isSpam"\s*:\s*true/i.test(rawContent);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error("[Thunderbird OpenAI Spam Detector] OpenAI API request timed out after 8s.");
    } else {
      console.error("[Thunderbird OpenAI Spam Detector] Classification error:", err);
    }
    return false;
  }
}

async function getAccountFoldersCached(accountId) {
  const now = Date.now();
  if (folderCache.has(accountId)) {
    const cached = folderCache.get(accountId);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.folders;
    }
  }

  try {
    const account = await messenger.accounts.get(accountId);
    if (account && account.folders) {
      folderCache.set(accountId, { folders: account.folders, timestamp: now });
      return account.folders;
    }
  } catch (e) {
    folderCache.delete(accountId);
  }
  return [];
}

async function handleSpamMessage(messageHeader, fullBody) {
  const { spamLog } = await messenger.storage.local.get({ spamLog: [] });
<<<<<<< HEAD
  const { targetFolder } = await messenger.storage.sync.get({ targetFolder: 'trash' });

=======
>>>>>>> origin/main
  const originFolderId = messageHeader.folder ? messageHeader.folder.id : null;
  const accountId = messageHeader.folder ? messageHeader.folder.accountId : null;

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

  if (!accountId) {
    console.error("[Thunderbird OpenAI Spam Detector] Cannot move email: Account ID missing.");
    return;
  }

  try {
<<<<<<< HEAD
    const account = await messenger.accounts.get(messageHeader.folder.accountId);
    let destinationFolder = null;

    if (targetFolder === 'junk') {
      destinationFolder = findFolderByType(account.folders, 'junk');
    } else if (targetFolder === 'local_ai_spam') {
      destinationFolder = await getOrCreateLocalAISpamFolder();
    }
=======
    const folders = await getAccountFoldersCached(accountId);
    const trashFolder = findTrashFolder(folders);
>>>>>>> origin/main
    
    if (!destinationFolder) {
      destinationFolder = findFolderByType(account.folders, 'trash');
    }

    if (destinationFolder) {
      await messenger.messages.move([messageHeader.id], destinationFolder);
    }
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not move email to target spam folder:", err);
  }
}

async function manualMarkAsNotSpam(messageId) {
  try {
    const messageHeader = await messenger.messages.get(messageId);
    const messageBody = await messenger.messages.getFull(messageId);
<<<<<<< HEAD
    let bodyText = extractTextFromParts(messageBody.parts || []);
    if (!bodyText && messageBody.body) bodyText = messageBody.body;
    bodyText = stripHtmlTags(bodyText);
=======
    let bodyText = stripHtmlTags(extractTextFromParts(messageBody.parts || []));
>>>>>>> origin/main

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

<<<<<<< HEAD
    if (!targetFolder) {
      const account = await messenger.accounts.get(messageHeader.folder.accountId);
      targetFolder = findFolderByType(account.folders, 'inbox');
=======
    if (!targetFolder && messageHeader.folder) {
      const folders = await getAccountFoldersCached(messageHeader.folder.accountId);
      targetFolder = findInboxFolder(folders);

      if (!targetFolder && folders) {
        targetFolder = folders.find(f => f.type === 'inbox' || f.name.toUpperCase() === 'INBOX');
      }
>>>>>>> origin/main
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
      await messenger.messages.move([messageId], targetFolder);
      console.log(`[Thunderbird OpenAI Spam Detector] Moved message ${messageId} to ${targetFolder.name}`);
    } else {
      console.error("[Thunderbird OpenAI Spam Detector] Could not locate Inbox target folder.");
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

<<<<<<< HEAD
async function getOrCreateLocalAISpamFolder() {
  try {
    const accounts = await messenger.accounts.list();
    const localAccount = accounts.find(a => a.type === "none" || a.name === "Local Folders");
    
    if (!localAccount) return null;

    let targetFolder = localAccount.folders.find(f => f.name === "AI Filtered Spam");
    
    if (!targetFolder && localAccount.folders.length > 0) {
      const rootFolder = localAccount.folders[0];
      targetFolder = await messenger.folders.create(rootFolder, "AI Filtered Spam");
=======
function findInboxFolder(folders) {
  for (let f of folders) {
    if (
      f.type === 'inbox' || 
      f.name.toLowerCase() === 'inbox' || 
      f.name.toUpperCase() === 'INBOX' ||
      (f.path && f.path.toLowerCase().endsWith('/inbox'))
    ) {
      return f;
    }
    if (f.subFolders && f.subFolders.length > 0) {
      const found = findInboxFolder(f.subFolders);
      if (found) return found;
>>>>>>> origin/main
    }
    return targetFolder;
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not find or create Local Folders / AI Filtered Spam:", err);
    return null;
  }
}
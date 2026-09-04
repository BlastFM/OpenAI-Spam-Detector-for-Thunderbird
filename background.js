console.log("[Thunderbird OpenAI Spam Detector] Optimized background worker initialized.");

// Account folder cache with TTL support
const folderCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache invalidation

// Setup Context Menus safely
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

// Context Menu Click Listener
messenger.menus.onClicked.addListener(async (info) => {
  if (!info.selectedMessages || info.selectedMessages.messages.length === 0) return;

  await processInBatches(info.selectedMessages.messages, 3, async (message) => {
    if (info.menuItemId === "mark-as-spam") {
      const fullMessage = await messenger.messages.get(message.id);
      const messageBody = await messenger.messages.getFull(message.id);
      let bodyText = stripHtmlTags(extractTextFromParts(messageBody.parts || []));
      await handleSpamMessage(fullMessage, bodyText);
    } else if (info.menuItemId === "mark-as-not-spam") {
      await manualMarkAsNotSpam(message.id);
    }
  });
});

// Automatic New Mail Classifier (Throttled Concurrency)
messenger.messages.onNewMailReceived.addListener(async (folder, messages) => {
  const { apiKey, model, customPrompt } = await messenger.storage.sync.get(['apiKey', 'model', 'customPrompt']);
  
  if (!apiKey) {
    console.warn("[Thunderbird OpenAI Spam Detector] Skipping classification: No API key configured.");
    return;
  }

  const activeModel = model || 'gpt-4o-mini';
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });
  const messageList = messages.messages || [];

  await processInBatches(messageList, 3, async (message) => {
    try {
      const fullMessage = await messenger.messages.get(message.id);
      const messageBody = await messenger.messages.getFull(message.id);
      
      let bodyText = messageBody.parts && messageBody.parts.length > 0 
        ? extractTextFromParts(messageBody.parts)
        : (messageBody.body || "");

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
  });
});

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
      plainText += part.body + "\n";
    } else if (part.contentType === "text/html" && part.body) {
      htmlText += part.body + "\n";
    } else if (part.parts) {
      const nested = extractTextFromParts(part.parts);
      if (nested) return nested;
    }
  }
  return plainText || htmlText;
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
    const folders = await getAccountFoldersCached(accountId);
    const trashFolder = findTrashFolder(folders);
    
    if (trashFolder) {
      await messenger.messages.move([messageHeader.id], trashFolder);
    }
  } catch (err) {
    console.error("[Thunderbird OpenAI Spam Detector] Could not move email to Trash:", err);
  }
}

async function manualMarkAsNotSpam(messageId) {
  try {
    const messageHeader = await messenger.messages.get(messageId);
    const messageBody = await messenger.messages.getFull(messageId);
    let bodyText = stripHtmlTags(extractTextFromParts(messageBody.parts || []));

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

    if (!targetFolder && messageHeader.folder) {
      const folders = await getAccountFoldersCached(messageHeader.folder.accountId);
      targetFolder = findInboxFolder(folders);

      if (!targetFolder && folders) {
        targetFolder = folders.find(f => f.type === 'inbox' || f.name.toUpperCase() === 'INBOX');
      }
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

function findTrashFolder(folders) {
  for (let f of folders) {
    if (f.type === 'trash' || f.name.toLowerCase() === 'trash' || f.name.toLowerCase() === 'deleted' || f.name.toLowerCase() === 'deleted items') return f;
    if (f.subFolders && f.subFolders.length > 0) {
      const found = findTrashFolder(f.subFolders);
      if (found) return found;
    }
  }
  return null;
}

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
    }
  }
  return null;
}
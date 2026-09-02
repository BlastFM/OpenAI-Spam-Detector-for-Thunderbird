console.log("[Thunderbird OpenAI Spam Detector] Background service worker initialized.");

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

messenger.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

messenger.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

// Context Menu Click Listener
messenger.menus.onClicked.addListener(async (info, tab) => {
  if (!info.selectedMessages || info.selectedMessages.messages.length === 0) return;

  for (let message of info.selectedMessages.messages) {
    if (info.menuItemId === "mark-as-spam") {
      const fullMessage = await messenger.messages.get(message.id);
      const messageBody = await messenger.messages.getFull(message.id);
      let bodyText = extractTextFromParts(messageBody.parts || []);
      await handleSpamMessage(fullMessage, bodyText);
    } else if (info.menuItemId === "mark-as-not-spam") {
      await manualMarkAsNotSpam(message.id);
    }
  }
});

// Automatic New Mail Classifier
messenger.messages.onNewMailReceived.addListener(async (folder, messages) => {
  const { apiKey, model, customPrompt } = await messenger.storage.sync.get(['apiKey', 'model', 'customPrompt']);
  
  if (!apiKey) {
    console.warn("[Thunderbird OpenAI Spam Detector] Skipping classification: No API key configured.");
    return;
  }

  const activeModel = model || 'gpt-4o-mini';
  const { falsePositives } = await messenger.storage.local.get({ falsePositives: [] });

  for await (let message of messages.messages) {
    try {
      const fullMessage = await messenger.messages.get(message.id);
      const messageBody = await messenger.messages.getFull(message.id);
      
      let bodyText = "";
      if (messageBody.parts && messageBody.parts.length > 0) {
        bodyText = extractTextFromParts(messageBody.parts);
      } else if (messageBody.body) {
        bodyText = messageBody.body;
      }

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
});

function extractTextFromParts(parts) {
  let text = "";
  for (let part of parts) {
    if (part.contentType === "text/plain" && part.body) {
      text += part.body + "\n";
    } else if (part.parts) {
      text += extractTextFromParts(part.parts);
    }
  }
  return text;
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

  const originFolderId = messageHeader.folder ? messageHeader.folder.id : null;

  const newEntry = {
    id: messageHeader.id,
    author: messageHeader.author,
    subject: messageHeader.subject,
    bodySnippet: (fullBody || "").substring(0, 120).replace(/\s+/g, ' '),
    dateAdded: new Date().toISOString(),
    originFolderId: originFolderId
  };

  // Remove duplicate entries with matching ID or matching author + subject
  const deduplicatedLog = spamLog.filter(item => 
    item.id !== newEntry.id && !(item.author === newEntry.author && item.subject === newEntry.subject)
  );

  const updatedLog = [newEntry, ...deduplicatedLog].slice(0, 50);
  await messenger.storage.local.set({ spamLog: updatedLog });

  try {
    const account = await messenger.accounts.get(messageHeader.folder.accountId);
    const trashFolder = findTrashFolder(account.folders);
    
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
    let bodyText = extractTextFromParts(messageBody.parts || []);

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
      targetFolder = findInboxFolder(account.folders);
    }

    const newFP = {
      id: messageHeader.id,
      author: messageHeader.author,
      subject: messageHeader.subject,
      bodySnippet: (bodyText || "").substring(0, 120).replace(/\s+/g, ' '),
      dateAdded: new Date().toISOString()
    };

    // Remove duplicate entries from falsePositives memory
    const deduplicatedFP = falsePositives.filter(item => 
      item.id !== newFP.id && !(item.author === newFP.author && item.subject === newFP.subject)
    );

    const updatedFP = [newFP, ...deduplicatedFP].slice(0, 20);
    const updatedSpamLog = spamLog.filter(item => item.id !== messageId);

    await messenger.storage.local.set({
      falsePositives: updatedFP,
      spamLog: updatedSpamLog
    });

    if (targetFolder) {
      await messenger.messages.move([messageId], targetFolder);
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
    if (f.type === 'inbox' || f.name.toLowerCase() === 'inbox') return f;
    if (f.subFolders && f.subFolders.length > 0) {
      const found = findInboxFolder(f.subFolders);
      if (found) return found;
    }
  }
  return null;
}
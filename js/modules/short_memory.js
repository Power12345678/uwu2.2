// WeChat-compatible short memory bridge.
// File format: {"userName":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}

const SHORT_MEMORY_DEFAULT_SOURCE = 'uwu';
const SHORT_MEMORY_IMPORT_MODE_PRESERVE = 'preserve';
const SHORT_MEMORY_IMPORT_MODE_MERGE_WECHAT = 'merge_wechat';
const SHORT_MEMORY_IMPORT_MODE_UWU_BLOCKS = 'uwu_blocks';
const SHORT_MEMORY_IMPORT_MODES = [
    SHORT_MEMORY_IMPORT_MODE_PRESERVE,
    SHORT_MEMORY_IMPORT_MODE_MERGE_WECHAT,
    SHORT_MEMORY_IMPORT_MODE_UWU_BLOCKS
];

function getShortMemoryChatType(chatType) {
    return chatType === 'group' ? 'group' : 'private';
}

function getShortMemoryChatKey(chatType, chatId) {
    return `${getShortMemoryChatType(chatType)}:${chatId}`;
}

function ensureShortMemoryDbArray() {
    if (!Array.isArray(db.shortMemoryContexts)) db.shortMemoryContexts = [];
    return db.shortMemoryContexts;
}

function normalizeShortMemoryRole(role) {
    const raw = String(role || '').trim().toLowerCase();
    return raw === 'assistant' || raw === 'model' || raw === 'ai' || raw === 'char' ? 'assistant' : 'user';
}

function normalizeShortMemoryItem(item) {
    if (!item || typeof item !== 'object') return null;
    const content = String(item.content || item.text || '').trim();
    if (!content) return null;
    return {
        role: normalizeShortMemoryRole(item.role),
        content,
        timestamp: item.timestamp || Date.now()
    };
}

function normalizeShortMemoryItems(items) {
    return (Array.isArray(items) ? items : [])
        .map(normalizeShortMemoryItem)
        .filter(Boolean);
}

function normalizeShortMemoryRecord(record) {
    return Object.assign({}, record || {}, {
        sourceUserName: String((record && record.sourceUserName) || SHORT_MEMORY_DEFAULT_SOURCE).trim() || SHORT_MEMORY_DEFAULT_SOURCE,
        useShadowContext: !!(record && record.useShadowContext),
        importNormalizationMode: normalizeShortMemoryImportMode(record && record.importNormalizationMode),
        items: normalizeShortMemoryItems(record && record.items)
    });
}

function normalizeShortMemoryImportMode(mode) {
    const raw = String(mode || '').trim();
    return SHORT_MEMORY_IMPORT_MODES.includes(raw) ? raw : SHORT_MEMORY_IMPORT_MODE_PRESERVE;
}

function getShortMemoryImportModeLabel(mode) {
    switch (normalizeShortMemoryImportMode(mode)) {
        case SHORT_MEMORY_IMPORT_MODE_MERGE_WECHAT:
            return '微信分隔符归一化';
        case SHORT_MEMORY_IMPORT_MODE_UWU_BLOCKS:
            return '转为小手机消息块';
        case SHORT_MEMORY_IMPORT_MODE_PRESERVE:
        default:
            return '保留原文';
    }
}

function getShortMemoryRecordSync(chatType, chatId) {
    const chatKey = getShortMemoryChatKey(chatType, chatId);
    const list = ensureShortMemoryDbArray();
    const record = list.find(item => item.chatKey === chatKey);
    return record ? normalizeShortMemoryRecord(record) : null;
}

function getDefaultShortMemorySourceName(chat, chatType) {
    if (!chat) return SHORT_MEMORY_DEFAULT_SOURCE;
    if (chatType === 'group') return chat.name || SHORT_MEMORY_DEFAULT_SOURCE;
    return chat.wechatUserId || chat.myName || chat.remarkName || chat.realName || SHORT_MEMORY_DEFAULT_SOURCE;
}

async function ensureShortMemoryRecord(chatType, chatId, options = {}) {
    const normalizedType = getShortMemoryChatType(chatType);
    const chatKey = getShortMemoryChatKey(normalizedType, chatId);
    const list = ensureShortMemoryDbArray();
    const existing = list.find(item => item.chatKey === chatKey);
    if (existing) {
        const normalized = normalizeShortMemoryRecord(existing);
        Object.assign(existing, normalized);
        return existing;
    }

    const chat = options.chat || (normalizedType === 'group'
        ? (db.groups || []).find(g => g.id === chatId)
        : (db.characters || []).find(c => c.id === chatId));

    const record = {
        chatKey,
        chatId,
        chatType: normalizedType,
        sourceUserName: options.sourceUserName || getDefaultShortMemorySourceName(chat, normalizedType),
        useShadowContext: !!options.useShadowContext,
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    list.push(record);
    if (typeof dexieDB !== 'undefined' && dexieDB && dexieDB.shortMemoryContexts) {
        await dexieDB.shortMemoryContexts.put(record);
    }
    return record;
}

async function saveShortMemoryRecord(record) {
    if (!record || !record.chatKey) return null;
    const normalized = normalizeShortMemoryRecord(record);
    normalized.updatedAt = Date.now();

    const list = ensureShortMemoryDbArray();
    const index = list.findIndex(item => item.chatKey === normalized.chatKey);
    if (index >= 0) {
        list[index] = normalized;
    } else {
        list.push(normalized);
    }

    if (typeof dexieDB !== 'undefined' && dexieDB && dexieDB.shortMemoryContexts) {
        await dexieDB.shortMemoryContexts.put(normalized);
    }
    return normalized;
}

function shortMemoryMessageToText(message) {
    if (!message || message.isThinking || message.isContextDisabled) return '';
    let text = '';
    if (typeof getMessagePlainText === 'function') {
        text = getMessagePlainText(message);
    } else if (Array.isArray(message.parts) && message.parts.length > 0) {
        text = message.parts.map(part => part && part.text ? part.text : '[图片]').join('');
    } else {
        text = String(message.content || '');
    }
    return String(text || '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
        .replace(/\s+\n/g, '\n')
        .trim();
}

function stripShortMemoryDisplayWrapper(text) {
    const raw = String(text || '').trim();
    const bracketMatch = raw.match(/^\[(?:unknown|.+?)的消息[：:]([\s\S]*?)\]$/);
    if (bracketMatch) return bracketMatch[1].trim();
    const plainMatch = raw.match(/^(?:unknown|.+?)的消息[：:]([\s\S]*)$/);
    if (plainMatch) return plainMatch[1].trim();
    return raw;
}

function hasWechatLeadingChatTimestamp(text) {
    return /^\[\d{4}-\d{2}-\d{2}(?: [A-Za-z]+)? \d{2}:\d{2}(?::\d{2})?\]\s*/.test(String(text || '').trim());
}

function formatShortMemoryUserTextForWechat(chat, chatType, message, text) {
    const body = stripShortMemoryDisplayWrapper(text);
    if (!body) return '';
    if (getShortMemoryChatType(chatType) !== 'private') return body;
    if (hasWechatLeadingChatTimestamp(body)) return body;
    const timestamp = typeof formatWechatChatTimestamp === 'function'
        ? formatWechatChatTimestamp(new Date(message && message.timestamp ? message.timestamp : Date.now()))
        : new Date(message && message.timestamp ? message.timestamp : Date.now()).toISOString().slice(0, 19).replace('T', ' ');
    return `[${timestamp}] ${body}`;
}

function formatShortMemoryAssistantTextForWechat(chat, chatType, message, text) {
    const body = stripShortMemoryDisplayWrapper(text);
    if (!body) return '';
    return body;
}

function setShortMemoryMessageText(message, text) {
    const next = Object.assign({}, message || {}, {
        content: text,
        parts: Array.isArray(message && message.parts)
            ? message.parts.map(part => part ? Object.assign({}, part) : part)
            : [{ type: 'text', text }]
    });
    if (Array.isArray(next.parts) && next.parts.length > 0) {
        const textIndex = next.parts.findIndex(part => part && (part.type === 'text' || part.type === 'html'));
        if (textIndex >= 0) {
            next.parts[textIndex] = Object.assign({}, next.parts[textIndex], { text });
        } else {
            next.parts.unshift({ type: 'text', text });
        }
    }
    return next;
}

function formatShortMemoryMessageForWechatPrompt(message, chat, chatType) {
    if (!message || getShortMemoryChatType(chatType) !== 'private') return message;
    const text = shortMemoryMessageToText(message);
    if (!text) return message;
    if (message.role === 'user') {
        return setShortMemoryMessageText(message, formatShortMemoryUserTextForWechat(chat, chatType, message, text));
    }
    if (isShortMemoryAssistantMessage(message)) {
        return setShortMemoryMessageText(message, formatShortMemoryAssistantTextForWechat(chat, chatType, message, text));
    }
    return message;
}

function isShortMemoryAssistantMessage(message) {
    if (!message || message.isThinking || message.isContextDisabled) return false;
    if (message.role === 'assistant' || message.role === 'char') return true;
    return !!(message.senderId && message.role !== 'user');
}

function isShortMemoryAssistantReplyCountable(text) {
    const raw = String(text || '').trim();
    if (!raw) return false;
    const normalized = raw.toLowerCase().replace(/\s+/g, '');
    const invalidMarkers = [
        '抱歉，我现在有点忙',
        '抱歉,我现在有点忙',
        '稍后再聊',
        '请稍后再试',
        '服务繁忙',
        '系统繁忙'
    ];
    return !invalidMarkers.some(marker => normalized.includes(marker.toLowerCase().replace(/\s+/g, '')));
}

function buildShortMemoryItemsFromHistory(chat, chatType) {
    const items = [];
    let pendingUserTexts = [];
    let pendingAssistantTexts = [];
    let lastTimestamp = Date.now();

    const flush = () => {
        const userText = pendingUserTexts.join('\n').trim();
        const assistantText = pendingAssistantTexts.join('\n').trim();
        if (userText && assistantText && isShortMemoryAssistantReplyCountable(assistantText)) {
            items.push({ role: 'user', content: userText, timestamp: lastTimestamp });
            items.push({ role: 'assistant', content: assistantText, timestamp: lastTimestamp + 1 });
        }
        pendingUserTexts = [];
        pendingAssistantTexts = [];
    };

    (chat && Array.isArray(chat.history) ? chat.history : []).forEach(message => {
        if (!message || message.isThinking || message.isContextDisabled) return;
        const text = shortMemoryMessageToText(message);
        if (!text) return;
        lastTimestamp = message.timestamp || Date.now();

        if (message.role === 'user') {
            if (pendingUserTexts.length > 0 && pendingAssistantTexts.length > 0) flush();
            pendingUserTexts.push(formatShortMemoryUserTextForWechat(chat, chatType, message, text));
            return;
        }

        if (isShortMemoryAssistantMessage(message) && pendingUserTexts.length > 0) {
            pendingAssistantTexts.push(formatShortMemoryAssistantTextForWechat(chat, chatType, message, text));
        }
    });
    flush();
    return normalizeShortMemoryItems(items);
}

function shortMemoryItemsToRounds(items) {
    const rounds = [];
    let pendingUsers = [];
    let pendingAssistants = [];
    let lastTimestamp = Date.now();

    const flush = () => {
        const userText = pendingUsers.map(item => item.content).join('\n').trim();
        const assistantText = pendingAssistants.map(item => item.content).join('\n').trim();
        if (userText && assistantText && isShortMemoryAssistantReplyCountable(assistantText)) {
            rounds.push({
                users: [{ role: 'user', content: userText, timestamp: lastTimestamp }],
                user: { role: 'user', content: userText, timestamp: lastTimestamp },
                ai: { role: 'assistant', content: assistantText, timestamp: lastTimestamp + 1 }
            });
        }
        pendingUsers = [];
        pendingAssistants = [];
    };

    normalizeShortMemoryItems(items).forEach(item => {
        lastTimestamp = item.timestamp || Date.now();
        if (item.role === 'user') {
            if (pendingUsers.length > 0 && pendingAssistants.length > 0) flush();
            pendingUsers.push(item);
        } else if (pendingUsers.length > 0) {
            pendingAssistants.push(item);
        }
    });
    flush();
    return rounds;
}

function getLatestUserShortMemoryItemFromHistory(chat, beforeIndex = null, chatType = 'private') {
    const history = chat && Array.isArray(chat.history) ? chat.history : [];
    const end = beforeIndex == null ? history.length : Math.min(beforeIndex, history.length);
    const texts = [];
    let timestamp = Date.now();

    for (let i = end - 1; i >= 0; i--) {
        const message = history[i];
        if (!message || message.isThinking || message.isContextDisabled) continue;
        if (isShortMemoryAssistantMessage(message)) {
            if (texts.length > 0) break;
            return null;
        }
        if (message.role === 'user') {
            const text = shortMemoryMessageToText(message);
            if (text) {
                texts.unshift(formatShortMemoryUserTextForWechat(chat, chatType, message, text));
                timestamp = message.timestamp || timestamp;
            }
            continue;
        }
        if (texts.length > 0) break;
    }

    const content = texts.join('\n').trim();
    return content ? { role: 'user', content, timestamp } : null;
}

function getShortMemoryItemsForChat(chat, chatType, options = {}) {
    if (!chat || !chat.id) return { items: [], source: 'empty', record: null };
    const record = getShortMemoryRecordSync(chatType, chat.id);
    let items;
    let source;

    if (record && record.useShadowContext) {
        items = normalizeShortMemoryItems(record.items || []);
        source = 'shadow';
        if (options.includeLatestUserFromHistory) {
            const latestUser = getLatestUserShortMemoryItemFromHistory(chat, null, chatType);
            const last = items[items.length - 1];
            if (latestUser && !(last && last.role === 'user' && last.content === latestUser.content)) {
                items = items.concat([latestUser]);
            }
        }
    } else {
        items = buildShortMemoryItemsFromHistory(chat, chatType);
        source = 'history';
    }

    return { items, source, record };
}

function shortMemoryItemsToHistoryMessages(items, maxItems = 0) {
    let normalized = normalizeShortMemoryItems(items);
    if (maxItems > 0 && normalized.length > maxItems) {
        normalized = normalized.slice(-maxItems);
    }
    return normalized.map((item, index) => ({
        id: `short_memory_${index}_${item.timestamp || Date.now()}`,
        role: item.role,
        content: item.content,
        parts: [{ type: 'text', text: item.content }],
        timestamp: item.timestamp || (Date.now() + index),
        isShortMemoryContext: true
    }));
}

function getShortMemoryHistoryForAI(chat, chatType, maxItems = 0) {
    const record = chat && chat.id ? getShortMemoryRecordSync(chatType, chat.id) : null;
    if (!record || !record.useShadowContext) return null;
    const result = getShortMemoryItemsForChat(chat, chatType, { includeLatestUserFromHistory: true });
    return shortMemoryItemsToHistoryMessages(result.items, maxItems);
}

function getShortMemoryRoundsForChat(chat, chatType) {
    const result = getShortMemoryItemsForChat(chat, chatType);
    return shortMemoryItemsToRounds(result.items);
}

async function saveShortMemoryItemsForChat(chatType, chatId, items, options = {}) {
    const chat = options.chat || (getShortMemoryChatType(chatType) === 'group'
        ? (db.groups || []).find(g => g.id === chatId)
        : (db.characters || []).find(c => c.id === chatId));
    const record = await ensureShortMemoryRecord(chatType, chatId, {
        chat,
        sourceUserName: options.sourceUserName,
        useShadowContext: true
    });
    record.items = normalizeShortMemoryItems(items);
    record.useShadowContext = options.useShadowContext !== false;
    if (options.sourceUserName) record.sourceUserName = options.sourceUserName;
    if (options.importNormalizationMode) record.importNormalizationMode = normalizeShortMemoryImportMode(options.importNormalizationMode);
    if (options.sourceProtocol) record.sourceProtocol = options.sourceProtocol;
    return await saveShortMemoryRecord(record);
}

async function appendShortMemoryTurnFromHistoryDiff(chatType, chatId, chat, historyStartLength) {
    const record = getShortMemoryRecordSync(chatType, chatId);
    if (!record || !record.useShadowContext) return null;
    const userItem = getLatestUserShortMemoryItemFromHistory(chat, historyStartLength, chatType);
    if (!userItem) return null;

    const newMessages = (chat.history || []).slice(historyStartLength || 0);
    const assistantText = newMessages
        .filter(message => isShortMemoryAssistantMessage(message))
        .map(message => formatShortMemoryAssistantTextForWechat(chat, chatType, message, shortMemoryMessageToText(message)))
        .filter(Boolean)
        .join('\n')
        .trim();

    if (!assistantText || !isShortMemoryAssistantReplyCountable(assistantText)) return null;

    const items = normalizeShortMemoryItems(record.items || []);
    const lastUser = items.slice().reverse().find(item => item.role === 'user');
    const alreadyHasUser = lastUser && lastUser.content === userItem.content;
    const nextItems = alreadyHasUser
        ? items.concat([{ role: 'assistant', content: assistantText, timestamp: Date.now() }])
        : items.concat([userItem, { role: 'assistant', content: assistantText, timestamp: Date.now() }]);

    record.items = nextItems;
    return await saveShortMemoryRecord(record);
}

function splitWechatMessageParts(text, options = {}) {
    const raw = String(text || '');
    const separateRows = options.separateRows !== false;
    const result = [];
    const ticklePattern = /(\[tickle\]|\[tickle_self\]|\[recall\])/g;
    const tickleParts = raw.split(ticklePattern).filter(part => part !== '');

    const pushSegment = (segment) => {
        const trimmed = String(segment || '').trim();
        if (trimmed) result.push(trimmed);
    };

    tickleParts.forEach(ticklePart => {
        if (!ticklePart) return;
        if (['[tickle]', '[tickle_self]', '[recall]'].includes(ticklePart)) {
            pushSegment(ticklePart);
            return;
        }

        ticklePart.split('$').forEach(dollarPart => {
            if (!dollarPart || !dollarPart.trim()) return;
            const rowParts = separateRows
                ? dollarPart.split(/(?:\\{3,}|\n)/)
                : dollarPart.split(/\\{3,}/);

            rowParts.forEach(rowPart => {
                const part = String(rowPart || '').trim();
                if (!part) return;
                const segments = [];
                let lastEnd = 0;

                for (let i = 0; i < part.length; i++) {
                    if (part[i] !== '\\') continue;
                    let shouldSplit = false;
                    let advanceBy = 1;
                    const prevChar = i > 0 ? part[i - 1] : '';
                    const nextChar = i + 1 < part.length ? part[i + 1] : '';

                    if (nextChar === 'n') {
                        shouldSplit = true;
                        advanceBy = 2;
                    } else {
                        const isLastChar = i === part.length - 1;
                        const nextIsWord = /[a-zA-Z0-9]/.test(nextChar);
                        const prevIsWordOrEmpty = prevChar ? /[a-zA-Z0-9]/.test(prevChar) : true;
                        const nearLeft = part.slice(Math.max(0, i - 10), i);
                        const nearRight = part.slice(i + 1, Math.min(part.length, i + 10));
                        const looksLikeEmoticon = /[(\[{（【｛][^({[（【｛]*$/.test(nearLeft) && /^[^)}\]）】｝]*[)}\]）】｝]/.test(nearRight);

                        if (!isLastChar && nextIsWord && prevIsWordOrEmpty) {
                            shouldSplit = true;
                        } else if (!looksLikeEmoticon) {
                            shouldSplit = true;
                        }
                    }

                    if (shouldSplit) {
                        pushSegment(part.slice(lastEnd, i));
                        lastEnd = i + advanceBy;
                        if (advanceBy > 1) i += advanceBy - 1;
                    }
                }

                if (lastEnd < part.length) {
                    segments.push(part.slice(lastEnd));
                }

                if (segments.length > 0) {
                    segments.forEach(pushSegment);
                } else {
                    pushSegment(part);
                }
            });
        });
    });

    return result.length > 0 ? result : (raw.trim() ? [raw.trim()] : []);
}

function isUwuStructuredMessageBlock(text) {
    return /^\[[^\]]+(的消息|的语音|发送的表情包|发来的照片\/视频|的转账|撤回了一条消息|引用“|的位置|更新状态为)[：:][\s\S]*\]$/.test(String(text || '').trim());
}

function escapeShortMemoryUwuBlockContent(text) {
    return String(text || '').replace(/\]/g, '］').trim();
}

function getShortMemoryCharacterName(options = {}) {
    const chat = options.chat || null;
    return String(
        options.characterName ||
        (chat && (chat.realName || chat.remarkName || chat.name)) ||
        '角色'
    ).trim() || '角色';
}

function wrapWechatPartAsUwuBlock(part, characterName) {
    const text = String(part || '').trim();
    if (!text) return '';
    if (isUwuStructuredMessageBlock(text)) return text;
    if (text === '[tickle]') return `[${characterName}的消息：戳了你一下]`;
    if (text === '[tickle_self]') return `[${characterName}的消息：戳了戳自己]`;
    if (text === '[recall]') return `[${characterName}的消息：撤回了一条消息]`;
    return `[${characterName}的消息：${escapeShortMemoryUwuBlockContent(text)}]`;
}

function compactShortMemoryItemsByRole(items) {
    const compacted = [];
    normalizeShortMemoryItems(items).forEach(item => {
        const last = compacted[compacted.length - 1];
        if (last && last.role === item.role) {
            last.content = `${last.content}\n${item.content}`.trim();
            last.timestamp = item.timestamp || last.timestamp;
        } else {
            compacted.push(Object.assign({}, item));
        }
    });
    return compacted;
}

function normalizeWechatShortMemoryItemsForUwu(items, options = {}) {
    const mode = normalizeShortMemoryImportMode(options.importMode);
    const characterName = getShortMemoryCharacterName(options);
    let normalized = normalizeShortMemoryItems(items).map(item => {
        if (item.role !== 'assistant' || mode === SHORT_MEMORY_IMPORT_MODE_PRESERVE) return item;
        const parts = splitWechatMessageParts(item.content, options);
        if (mode === SHORT_MEMORY_IMPORT_MODE_UWU_BLOCKS) {
            return Object.assign({}, item, {
                content: parts.map(part => wrapWechatPartAsUwuBlock(part, characterName)).filter(Boolean).join('\n')
            });
        }
        return Object.assign({}, item, {
            content: parts.join('\n')
        });
    });

    if (mode !== SHORT_MEMORY_IMPORT_MODE_PRESERVE) {
        normalized = compactShortMemoryItemsByRole(normalized);
    }

    return normalized;
}

function parseWechatShortMemoryJson(text, options = {}) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error('短期记忆文件不是有效 JSON。');
    }

    if (Array.isArray(data)) {
        return {
            type: 'array',
            users: [],
            items: normalizeWechatShortMemoryItemsForUwu(data, options)
        };
    }

    if (data && typeof data === 'object') {
        const users = Object.keys(data).filter(key => Array.isArray(data[key]));
        if (users.length === 0) {
            throw new Error('短期记忆对象中没有可用的用户上下文数组。');
        }
        return {
            type: 'object',
            users,
            getItemsForUser(userName) {
                return normalizeWechatShortMemoryItemsForUwu(data[userName] || [], options);
            }
        };
    }

    throw new Error('短期记忆格式不正确：顶层必须是数组或对象。');
}

function exportWechatShortMemoryJson(record, options = {}) {
    const normalized = normalizeShortMemoryRecord(record || {});
    const items = normalizeShortMemoryItems(normalized.items || []).map(item => ({
        role: item.role,
        content: item.content
    }));
    if (options.mode === 'array') {
        return JSON.stringify(items, null, 2);
    }
    const userName = String(options.userName || normalized.sourceUserName || SHORT_MEMORY_DEFAULT_SOURCE).trim() || SHORT_MEMORY_DEFAULT_SOURCE;
    return JSON.stringify({ [userName]: items }, null, 2);
}

function readShortMemoryFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('读取文件失败。'));
        reader.readAsText(file, 'utf-8');
    });
}

async function importShortMemoryFile(file, chatType, chatId, options = {}) {
    const text = await readShortMemoryFileAsText(file);
    const chat = getShortMemoryChatType(chatType) === 'group'
        ? (db.groups || []).find(g => g.id === chatId)
        : (db.characters || []).find(c => c.id === chatId);
    const importMode = normalizeShortMemoryImportMode(options.importMode);
    const parsed = parseWechatShortMemoryJson(text, Object.assign({}, options, { chat, importMode }));
    let sourceUserName = options.sourceUserName || SHORT_MEMORY_DEFAULT_SOURCE;
    let items = [];

    if (parsed.type === 'array') {
        items = parsed.items;
    } else {
        sourceUserName = options.sourceUserName || parsed.users[0];
        if (parsed.users.length > 1 && !options.sourceUserName) {
            const chosen = prompt(`检测到多个用户上下文：${parsed.users.join('、')}\n请输入要导入的用户名：`, parsed.users[0]);
            if (chosen && parsed.users.includes(chosen)) sourceUserName = chosen;
        }
        items = parsed.getItemsForUser(sourceUserName);
    }

    const record = await saveShortMemoryItemsForChat(chatType, chatId, items, {
        chat,
        sourceUserName,
        useShadowContext: true,
        importNormalizationMode: importMode,
        sourceProtocol: importMode === SHORT_MEMORY_IMPORT_MODE_PRESERVE ? 'wechat_raw' : 'wechat_normalized'
    });
    record.sourceFileName = file && file.name ? file.name : 'chat_contexts.json';
    return await saveShortMemoryRecord(record);
}

function downloadShortMemoryContextJson(chatType, chatId, options = {}) {
    const record = getShortMemoryRecordSync(chatType, chatId);
    if (!record) return;
    const json = exportWechatShortMemoryJson(record, options);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const userName = String(record.sourceUserName || SHORT_MEMORY_DEFAULT_SOURCE).replace(/[\\/:*?"<>|]+/g, '_');
    link.href = url;
    link.download = options.mode === 'array'
        ? `${userName}_short_memory.json`
        : 'chat_contexts.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

if (typeof window !== 'undefined') {
    window.getShortMemoryChatKey = getShortMemoryChatKey;
    window.getShortMemoryRecordSync = getShortMemoryRecordSync;
    window.ensureShortMemoryRecord = ensureShortMemoryRecord;
    window.saveShortMemoryRecord = saveShortMemoryRecord;
    window.normalizeShortMemoryItems = normalizeShortMemoryItems;
    window.buildShortMemoryItemsFromHistory = buildShortMemoryItemsFromHistory;
    window.shortMemoryItemsToRounds = shortMemoryItemsToRounds;
    window.getShortMemoryItemsForChat = getShortMemoryItemsForChat;
    window.getShortMemoryHistoryForAI = getShortMemoryHistoryForAI;
    window.getShortMemoryRoundsForChat = getShortMemoryRoundsForChat;
    window.isShortMemoryAssistantReplyCountable = isShortMemoryAssistantReplyCountable;
    window.saveShortMemoryItemsForChat = saveShortMemoryItemsForChat;
    window.appendShortMemoryTurnFromHistoryDiff = appendShortMemoryTurnFromHistoryDiff;
    window.splitWechatMessageParts = splitWechatMessageParts;
    window.normalizeShortMemoryImportMode = normalizeShortMemoryImportMode;
    window.getShortMemoryImportModeLabel = getShortMemoryImportModeLabel;
    window.normalizeWechatShortMemoryItemsForUwu = normalizeWechatShortMemoryItemsForUwu;
    window.stripShortMemoryDisplayWrapper = stripShortMemoryDisplayWrapper;
    window.formatShortMemoryUserTextForWechat = formatShortMemoryUserTextForWechat;
    window.formatShortMemoryAssistantTextForWechat = formatShortMemoryAssistantTextForWechat;
    window.formatShortMemoryMessageForWechatPrompt = formatShortMemoryMessageForWechatPrompt;
    window.parseWechatShortMemoryJson = parseWechatShortMemoryJson;
    window.exportWechatShortMemoryJson = exportWechatShortMemoryJson;
    window.importShortMemoryFile = importShortMemoryFile;
    window.downloadShortMemoryContextJson = downloadShortMemoryContextJson;
}

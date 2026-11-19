// Local-only bridge to the Python Memory Palace bot.
// It sends unsummarized source rounds plus the current CoreMemory cards.

const UWU_LOCAL_SYNC_DEFAULT_URL = 'http://127.0.0.1:5000/api/memory_palace/uwu/local-sync';
const UWU_LOCAL_SYNC_OUTBOX_KEY = 'uwu-memory-sync-outbox-v1';

function getUwuLocalSyncUrl() {
    try { return localStorage.getItem('uwu-local-sync-url') || UWU_LOCAL_SYNC_DEFAULT_URL; }
    catch (_) { return UWU_LOCAL_SYNC_DEFAULT_URL; }
}

function getUwuLocalSyncScope() {
    let userId = '11';
    let charId = 'solo';
    try {
        userId = localStorage.getItem('uwu-local-sync-user-id') || userId;
        charId = localStorage.getItem('uwu-local-sync-char-id') || charId;
    } catch (_) {}
    return { userId: String(userId), charId: String(charId) };
}

function getUwuSyncOutbox() {
    try {
        const parsed = JSON.parse(localStorage.getItem(UWU_LOCAL_SYNC_OUTBOX_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
}

function saveUwuSyncOutbox(items) {
    try { localStorage.setItem(UWU_LOCAL_SYNC_OUTBOX_KEY, JSON.stringify((items || []).slice(-5))); }
    catch (_) {}
}

function getUwuSyncChatContext() {
    const chatType = typeof currentChatType === 'undefined' ? 'private' : currentChatType;
    const chatId = typeof currentChatId === 'undefined' ? '' : currentChatId;
    const chat = chatType === 'group'
        ? (db.groups || []).find(item => item.id === chatId)
        : (db.characters || []).find(item => item.id === chatId);
    return { chat, chatType, chatId };
}

function getUwuSyncMessageText(message) {
    if (typeof getMessagePlainText === 'function') return getMessagePlainText(message);
    return String(message && message.content || '');
}

function getUwuSyncSourceId(chatKey, roundIndex, role, message, fallbackText) {
    const syncSourceId = message && message.memorySyncSourceId;
    if (syncSourceId) return String(syncSourceId);
    const supplied = message && (message.id || message.messageId);
    if (supplied) return `uwu:${chatKey}:${role}:${supplied}`;
    const stamp = message && message.timestamp || 0;
    const raw = `${chatKey}|${roundIndex}|${role}|${stamp}|${fallbackText}`;
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
    return `uwu:${chatKey}:${role}:${Math.abs(hash)}`;
}

function getUwuSyncTextFingerprint(text) {
    const raw = String(text || '');
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
        hash ^= raw.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a:${(hash >>> 0).toString(16)}`;
}

function getUwuSyncSnapshotKey(chatKey) {
    return `uwu-memory-sync-snapshot-v1:${chatKey}`;
}

function getUwuSyncSnapshot(chatKey) {
    try {
        const parsed = JSON.parse(localStorage.getItem(getUwuSyncSnapshotKey(chatKey)) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) { return {}; }
}

function saveUwuSyncSnapshot(chatKey, snapshot) {
    try { localStorage.setItem(getUwuSyncSnapshotKey(chatKey), JSON.stringify(snapshot || {})); }
    catch (_) {}
}

function buildUwuSyncRawMessages(rounds, lastSummarizedRound, chatKey, previousSnapshot = {}) {
    const previous = previousSnapshot && typeof previousSnapshot === 'object' ? previousSnapshot : {};
    const nextSnapshot = {};
    const messages = [];
    (Array.isArray(rounds) ? rounds : []).forEach((round, roundIndex) => {
        (Array.isArray(round && round.messages) ? round.messages : []).forEach(message => {
            const content = getUwuSyncMessageText(message).trim();
            if (!content) return;
            const role = message.role === 'user' ? 'user' : 'assistant';
            const sourceId = getUwuSyncSourceId(chatKey, roundIndex, role, message, content);
            const fingerprint = getUwuSyncTextFingerprint(content);
            nextSnapshot[sourceId] = fingerprint;
            const isUnsummarizedTail = roundIndex >= lastSummarizedRound;
            const isEditedPreviouslySynced = Object.prototype.hasOwnProperty.call(previous, sourceId)
                && previous[sourceId] !== fingerprint;
            if (!isUnsummarizedTail && !isEditedPreviouslySynced) return;
            messages.push({
                source_id: sourceId,
                role,
                content,
                timestamp_ms: Number(message && message.timestamp || 0) || 0,
                conversation_unit_id: `uwu:${chatKey}:round:${roundIndex}`,
            });
        });
    });
    return { messages, nextSnapshot };
}

// Build completed rounds from the full uwu history.  The short-memory shadow
// context is a presentation/input window and may be shorter than chat.history;
// it must never be used as the source of truth for a Palace import.
function buildUwuSyncSourceRounds(history) {
    const rounds = [];
    let pendingUsers = [];
    let pendingAssistants = [];

    const isAssistant = message => Boolean(message && (
        message.role === 'assistant' || message.role === 'char' || message.senderId
    ));
    const textOf = message => getUwuSyncMessageText(message).trim();
    const isCountable = text => (
        typeof window.isShortMemoryAssistantReplyCountable !== 'function'
        || window.isShortMemoryAssistantReplyCountable(text)
    );
    const flush = () => {
        const users = pendingUsers.filter(message => textOf(message));
        const assistants = pendingAssistants.filter(message => textOf(message));
        const assistantText = assistants.map(textOf).join('\n').trim();
        if (users.length && assistants.length && assistantText && isCountable(assistantText)) {
            rounds.push({
                users: users.slice(),
                assistants: assistants.slice(),
                messages: users.concat(assistants),
            });
        }
        pendingUsers = [];
        pendingAssistants = [];
    };

    (Array.isArray(history) ? history : []).forEach(message => {
        if (!message || message.isContextDisabled || message.isThinking) return;
        if (message.role === 'user') {
            if (pendingUsers.length && pendingAssistants.length) flush();
            pendingUsers.push(message);
            return;
        }
        if (isAssistant(message) && pendingUsers.length) pendingAssistants.push(message);
    });
    flush();
    return rounds;
}

function buildUwuLocalSyncPayload() {
    const { chat, chatType, chatId } = getUwuSyncChatContext();
    if (!chat || !chatId || !Array.isArray(chat.history)) throw new Error('请先打开需要同步的 uwu 私聊');
    const record = typeof getCoreMemoryRecordSync === 'function' ? getCoreMemoryRecordSync(chatType, chatId) : null;
    const rounds = buildUwuSyncSourceRounds(chat.history);
    const recordedCursor = Math.max(0, parseInt(record && record.lastSummarizedRound, 10) || 0);
    const lastSummarizedRound = Math.min(recordedCursor, rounds.length);
    const chatKey = typeof getCoreMemoryChatKey === 'function' ? getCoreMemoryChatKey(chatType, chatId) : `${chatType}:${chatId}`;
    const selected = buildUwuSyncRawMessages(
        rounds,
        lastSummarizedRound,
        chatKey,
        getUwuSyncSnapshot(chatKey),
    );
    const rawMessages = selected.messages;

    const items = record && Array.isArray(record.items) ? record.items : [];
    const lastRaw = rawMessages[rawMessages.length - 1];
    const scope = getUwuLocalSyncScope();
    return {
        protocol: 'uwu-memory-sync-v1',
        sync_id: `uwu:${chatKey}:r${rounds.length}:s${lastSummarizedRound}:${lastRaw ? lastRaw.source_id : 'none'}:${record && record.updatedAt || 0}`,
        user_id: scope.userId,
        char_id: scope.charId,
        source_chat_key: chatKey,
        raw_messages: rawMessages,
        core_memory_items: items,
        total_completed_rounds: rounds.length,
        last_summarized_round: lastSummarizedRound,
        client_snapshot: selected.nextSnapshot,
    };
}

function buildUwuMemorySyncBundle() {
    const { chat, chatType, chatId } = getUwuSyncChatContext();
    if (!chat || !chatId || !Array.isArray(chat.history)) throw new Error('请先打开需要导出的 uwu 私聊');
    const record = typeof getCoreMemoryRecordSync === 'function' ? getCoreMemoryRecordSync(chatType, chatId) : null;
    const rounds = buildUwuSyncSourceRounds(chat.history);
    const chatKey = typeof getCoreMemoryChatKey === 'function' ? getCoreMemoryChatKey(chatType, chatId) : `${chatType}:${chatId}`;
    const allRaw = buildUwuSyncRawMessages(rounds, 0, chatKey, {}).messages;
    const exportedIds = new Set(allRaw.map(item => item.source_id));
    // Preserve Bot-origin rows that do not form a user→assistant pair in the
    // phone history.  They still have a stable source ID and must survive a
    // Bot → uwu → Bot round trip.
    (chat.history || []).forEach(message => {
        const sourceId = String(message && message.memorySyncSourceId || '').trim();
        const content = getUwuSyncMessageText(message).trim();
        const role = String(message && message.role || '').trim().toLowerCase();
        if (!sourceId || exportedIds.has(sourceId) || !content || !['user', 'assistant'].includes(role)) return;
        allRaw.push({
            source_id: sourceId,
            role,
            content,
            timestamp_ms: Number(message.timestamp || 0) || 0,
            conversation_unit_id: `uwu:${chatKey}:imported:${sourceId}`,
        });
        exportedIds.add(sourceId);
    });
    allRaw.sort((a, b) => Number(a.timestamp_ms || 0) - Number(b.timestamp_ms || 0));
    const scope = getUwuLocalSyncScope();
    const shortRecord = typeof getShortMemoryRecordSync === 'function'
        ? getShortMemoryRecordSync(chatType, chatId)
        : null;
    const shortItems = typeof getShortMemoryItemsForChat === 'function'
        ? getShortMemoryItemsForChat(chat, chatType).items
        : (shortRecord && Array.isArray(shortRecord.items) ? shortRecord.items : []);
    return {
        protocol: 'uwu-memory-sync-bundle-v1',
        exported_at: new Date().toISOString(),
        source: 'uwu',
        source_chat_key: chatKey,
        user_id: scope.userId,
        char_id: scope.charId,
        raw_messages: allRaw,
        core_memory_items: record && Array.isArray(record.items) ? record.items : [],
        short_context_items: shortItems,
        summary_cursor_kind: 'short_context_rounds',
        short_context_summary_cursor: Math.max(0, parseInt(record && record.lastSummarizedRound, 10) || 0),
        total_completed_rounds: rounds.length,
        last_summarized_round: Math.max(0, parseInt(record && record.lastSummarizedRound, 10) || 0),
    };
}

function downloadUwuMemorySyncBundle() {
    const bundle = buildUwuMemorySyncBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    link.href = url;
    link.download = `uwu_memory_sync_${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Some mobile browsers start the download asynchronously after click().
    // Revoke on the next turn so the file is not truncated on those browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return bundle;
}

function validateUwuMemorySyncBundle(bundle) {
    if (!bundle || bundle.protocol !== 'uwu-memory-sync-bundle-v1'
        || !Array.isArray(bundle.raw_messages) || !Array.isArray(bundle.core_memory_items)
        || (bundle.short_context_items !== undefined && !Array.isArray(bundle.short_context_items))) {
        throw new Error('文件不是有效的 uwu / Bot 同步包');
    }
    const scope = getUwuLocalSyncScope();
    if ((bundle.user_id && bundle.user_id !== scope.userId) || (bundle.char_id && bundle.char_id !== scope.charId)) {
        throw new Error('同步包的用户或角色与当前同步档案不一致');
    }
    const validMessage = item => item && ['user', 'assistant'].includes(item.role)
        && typeof item.content === 'string' && item.content.trim();
    const seen = new Set();
    bundle.raw_messages.forEach(item => {
        if (!validMessage(item) || typeof item.source_id !== 'string' || !item.source_id.trim()
            || !Number.isSafeInteger(item.timestamp_ms) || item.timestamp_ms <= 0 || seen.has(item.source_id)) {
            throw new Error('原文消息缺少有效内容、时间或唯一来源 ID');
        }
        seen.add(item.source_id);
    });
    bundle.core_memory_items.forEach(item => {
        if (!item || typeof item.summary !== 'string' || !item.summary.trim()
            || typeof item.timestamp !== 'string' || !item.timestamp.trim()
            || !Array.isArray(item.keywords || []) || !Number.isInteger(item.importance)
            || item.importance < 1 || item.importance > 10) {
            throw new Error('连续性摘要格式不完整');
        }
    });
    (bundle.short_context_items || []).forEach(item => {
        if (!validMessage(item)) throw new Error('短期上下文格式不完整');
    });
}

async function importUwuMemorySyncBundle(file) {
    if (typeof isGenerating !== 'undefined' && isGenerating) throw new Error('请等当前回复完成后再导入同步包');
    const target = getUwuSyncChatContext();
    if (!file) throw new Error('请选择同步包 JSON 文件');
    const text = await (typeof file.text === 'function'
        ? file.text()
        : new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
            reader.readAsText(file, 'utf-8');
        }));
    let bundle;
    try { bundle = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch (_) { throw new Error('同步包不是有效 JSON'); }
    validateUwuMemorySyncBundle(bundle);
    const { chat, chatType, chatId } = getUwuSyncChatContext();
    if (chat !== target.chat || chatType !== target.chatType || chatId !== target.chatId) throw new Error('读取文件期间切换了聊天，请在目标私聊重新导入');
    if (typeof isGenerating !== 'undefined' && isGenerating) throw new Error('请等当前回复完成后再导入同步包');
    if (!chat || !chatId || chatType !== 'private' || !Array.isArray(chat.history)) throw new Error('请先打开要导入的 uwu 私聊');
    if (typeof dexieDB === 'undefined' || !dexieDB || !dexieDB.transaction
        || !dexieDB.characters || !dexieDB.coreMemoryFiles || !dexieDB.shortMemoryContexts) {
        throw new Error('手机本地数据库尚未就绪，请稍后重试');
    }
    const copy = value => JSON.parse(JSON.stringify(value));
    const nextChat = copy(chat);
    const chatKey = getCoreMemoryChatKey(chatType, chatId);
    const existingByKey = new Map();
    nextChat.history.forEach(item => {
        const role = item.role === 'user' ? 'user' : 'assistant';
        const sourceId = getUwuSyncSourceId(chatKey, 0, role, item, getUwuSyncMessageText(item));
        existingByKey.set(sourceId, item);
    });
    let inserted = 0;
    let updated = 0;
    bundle.raw_messages.forEach(item => {
        const { role, content, source_id: sourceId, timestamp_ms: timestamp } = item;
        const old = existingByKey.get(sourceId);
        if (old) {
            const oldRole = old.role === 'user' ? 'user' : 'assistant';
            if (oldRole !== role) throw new Error('原文角色与手机原记录冲突，未导入');
            if (getUwuSyncMessageText(old) !== content) {
                old.content = content;
                old.parts = [{ type: 'text', text: content }];
                updated += 1;
            }
            old.memorySyncSourceId = sourceId;
            return;
        }
        const message = {
            id: `sync:${sourceId}`, role, content, timestamp,
            memorySyncSourceId: sourceId,
            parts: [{ type: 'text', text: content }],
        };
        nextChat.history.push(message);
        existingByKey.set(sourceId, message);
        inserted += 1;
    });
    if (inserted) nextChat.history.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    const coreRecord = copy(getCoreMemoryRecordSync(chatType, chatId) || {
        chatKey, chatId, chatType, settings: getCoreMemoryDefaultSettings(),
        items: [], lastSummarizedRound: 0, createdAt: Date.now(),
    });
    const previousSummaryCount = coreRecord.items.length;
    coreRecord.items = mergeCoreMemoryItems(coreRecord.items, bundle.core_memory_items, 'merge');
    coreRecord.updatedAt = Date.now();
    const previousShort = getShortMemoryRecordSync(chatType, chatId);
    let shortRecord = null;
    if (Array.isArray(bundle.short_context_items)) {
        shortRecord = copy(previousShort || { chatKey, chatId, chatType, createdAt: Date.now() });
        shortRecord.items = bundle.short_context_items.map((item, index) => ({
            role: item.role, content: item.content,
            timestamp: Number(item.timestamp || 0) || Date.now() + index,
        }));
        shortRecord.useShadowContext = true;
        shortRecord.sourceUserName = String(bundle.user_id || '11');
        shortRecord.sourceProtocol = 'uwu_memory_sync_bundle';
        shortRecord.updatedAt = Date.now();
        coreRecord.lastSyncImportBackup = {
            shortContext: previousShort, lastSummarizedRound: coreRecord.lastSummarizedRound,
        };
        const count = shortMemoryItemsToRounds(shortRecord.items).length;
        coreRecord.lastSummarizedRound = bundle.summary_cursor_kind === 'short_context_rounds'
            ? Math.min(count, Math.max(0, Math.floor(Number(bundle.short_context_summary_cursor) || 0))) : 0;
    }
    // Publish in-memory changes only after every IndexedDB write commits.
    // A quota/permission/transaction failure leaves all three old records intact.
    await dexieDB.transaction('rw', dexieDB.characters, dexieDB.coreMemoryFiles, dexieDB.shortMemoryContexts, async () => {
        await dexieDB.characters.put(nextChat);
        await dexieDB.coreMemoryFiles.put(coreRecord);
        if (shortRecord) await dexieDB.shortMemoryContexts.put(shortRecord);
    });
    Object.assign(chat, nextChat);
    const updateCache = (field, record) => {
        if (!record) return;
        const list = Array.isArray(db[field]) ? db[field] : (db[field] = []);
        const index = list.findIndex(item => item.chatKey === chatKey);
        if (index < 0) list.push(record);
        else list[index] = record;
    };
    updateCache('coreMemoryFiles', coreRecord);
    updateCache('shortMemoryContexts', shortRecord);
    return {
        insertedRawMessages: inserted, updatedRawMessages: updated,
        coreMemoryCount: coreRecord.items.length - previousSummaryCount,
        shortContextCount: shortRecord ? shortRecord.items.length : 0,
    };
}

async function sendUwuLocalSyncPayload(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
        const response = await fetch(getUwuLocalSyncUrl(), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(
                Object.entries(payload).filter(([key]) => key !== 'client_snapshot'),
            )), signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.status === 'error') throw new Error(data.message || `本机 bot 返回 HTTP ${response.status}`);
        return data;
    } finally { clearTimeout(timeout); }
}

async function syncCurrentUwuChatToLocalBot(options = {}) {
    const setStatus = value => {
        const target = document.getElementById('core-memory-sync-status');
        if (target) target.textContent = value;
    };
    let payload;
    try { payload = buildUwuLocalSyncPayload(); }
    catch (error) { setStatus(error.message || '没有可同步的聊天'); throw error; }
    setStatus('正在同步…');
    try {
        const result = await sendUwuLocalSyncPayload(payload);
        saveUwuSyncOutbox(getUwuSyncOutbox().filter(item => item.sync_id !== payload.sync_id));
        saveUwuSyncSnapshot(payload.source_chat_key, payload.client_snapshot);
        const summaryNote = result.summary_status === 'anchor_missing'
            ? '；摘要锚点不明确，已仅同步原文'
            : '';
        setStatus(`已同步：原文新增 ${result.inserted_raw_messages || 0} 条、更新 ${result.updated_raw_messages || 0} 条，摘要 ${result.summary_count || 0} 条${summaryNote}`);
        return result;
    } catch (error) {
        const outbox = getUwuSyncOutbox().filter(item => item.sync_id !== payload.sync_id);
        outbox.push(payload); saveUwuSyncOutbox(outbox);
        setStatus('bot 未启动，已暂存；下次在本机打开 uwu 后再点同步');
        if (!options.silent && typeof showToast === 'function') showToast('本机 bot 当前不可达，数据已暂存');
        return { status: 'queued_local', error: error.message || String(error) };
    }
}

async function flushUwuLocalSyncOutbox() {
    const pending = getUwuSyncOutbox();
    if (!pending.length) return [];
    const remaining = []; const results = [];
    for (const item of pending) {
        try {
            results.push(await sendUwuLocalSyncPayload(item));
            saveUwuSyncSnapshot(item.source_chat_key, item.client_snapshot);
        }
        catch (_) { remaining.push(item); }
    }
    saveUwuSyncOutbox(remaining); return results;
}

if (typeof window !== 'undefined') {
    window.buildUwuSyncSourceRounds = buildUwuSyncSourceRounds;
    window.buildUwuSyncRawMessages = buildUwuSyncRawMessages;
    window.buildUwuLocalSyncPayload = buildUwuLocalSyncPayload;
    window.buildUwuMemorySyncBundle = buildUwuMemorySyncBundle;
    window.downloadUwuMemorySyncBundle = downloadUwuMemorySyncBundle;
    window.importUwuMemorySyncBundle = importUwuMemorySyncBundle;
    window.syncCurrentUwuChatToLocalBot = syncCurrentUwuChatToLocalBot;
    window.flushUwuLocalSyncOutbox = flushUwuLocalSyncOutbox;
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { flushUwuLocalSyncOutbox().catch(() => {}); }, 1200);
});

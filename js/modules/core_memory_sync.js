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
    const scope = getUwuLocalSyncScope();
    const shortRecord = typeof getShortMemoryRecordSync === 'function'
        ? getShortMemoryRecordSync(chatType, chatId)
        : null;
    return {
        protocol: 'uwu-memory-sync-bundle-v1',
        exported_at: new Date().toISOString(),
        source: 'uwu',
        source_chat_key: chatKey,
        user_id: scope.userId,
        char_id: scope.charId,
        raw_messages: allRaw,
        core_memory_items: record && Array.isArray(record.items) ? record.items : [],
        short_context_items: shortRecord && Array.isArray(shortRecord.items) ? shortRecord.items : [],
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

function getUwuImportedMessageKey(item) {
    const source = String(item && (item.memorySyncSourceId || item.syncSourceId || '') || '').trim();
    if (source) return `source:${source}`;
    const role = String(item && item.role || '').trim().toLowerCase();
    const content = getUwuSyncMessageText(item).trim();
    const timestamp = Number(item && item.timestamp || 0) || 0;
    return `content:${role}|${timestamp}|${content}`;
}

async function importUwuMemorySyncBundle(file) {
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
    try { bundle = JSON.parse(text); }
    catch (_) { throw new Error('同步包不是有效 JSON'); }
    if (!bundle || bundle.protocol !== 'uwu-memory-sync-bundle-v1'
        || !Array.isArray(bundle.raw_messages)
        || !Array.isArray(bundle.core_memory_items)) {
        throw new Error('文件不是 uwu / Bot 同步包');
    }
    const { chat, chatType, chatId } = getUwuSyncChatContext();
    if (!chat || !chatId || !Array.isArray(chat.history)) throw new Error('请先打开要导入的 uwu 私聊');

    const existingByKey = new Map();
    const existing = Array.isArray(chat.history) ? chat.history : [];
    existing.forEach(item => existingByKey.set(getUwuImportedMessageKey(item), item));
    let inserted = 0;
    let updated = 0;
    (bundle.raw_messages || []).forEach(item => {
        const role = String(item && item.role || '').trim().toLowerCase();
        const content = String(item && item.content || '').trim();
        if (!['user', 'assistant'].includes(role) || !content) return;
        const sourceId = String(item.source_id || '').trim();
        const timestamp = Number(item.timestamp_ms || item.timestamp || 0) || Date.now();
        const key = sourceId ? `source:${sourceId}` : `content:${role}|${timestamp}|${content}`;
        const old = existingByKey.get(key);
        if (old) {
            if (old.content !== content || old.role !== role) {
                old.content = content;
                old.role = role;
                old.timestamp = timestamp;
                if (sourceId) old.memorySyncSourceId = sourceId;
                updated += 1;
            }
            return;
        }
        const message = {
            id: `sync:${sourceId || `${role}:${timestamp}:${inserted}`}`,
            role,
            content,
            timestamp,
        };
        if (sourceId) message.memorySyncSourceId = sourceId;
        existing.push(message);
        existingByKey.set(key, message);
        inserted += 1;
    });
    existing.sort((a, b) => (Number(a && a.timestamp || 0) - Number(b && b.timestamp || 0)));
    chat.history = existing;
    if (typeof saveCharacter === 'function') await saveCharacter(chat.id);

    const coreRecord = await ensureCoreMemoryRecord(chatType, chatId, { chat });
    coreRecord.items = mergeCoreMemoryItems(coreRecord.items || [], bundle.core_memory_items || [], 'merge');
    await saveCoreMemoryRecord(coreRecord);

    let shortCount = 0;
    if (Array.isArray(bundle.short_context_items) && bundle.short_context_items.length) {
        const shortRecord = getShortMemoryRecordSync(chatType, chatId);
        const current = bundle.source === 'memory_palace_bot'
            ? []
            : (shortRecord && Array.isArray(shortRecord.items) ? shortRecord.items : []);
        const seen = new Set(current.map(item => `${item.role}|${item.content}`));
        const merged = current.slice();
        bundle.short_context_items.forEach(item => {
            const role = String(item && item.role || '').trim().toLowerCase();
            const content = String(item && item.content || '').trim();
            if (!['user', 'assistant'].includes(role) || !content) return;
            const key = `${role}|${content}`;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push({ role, content, timestamp: Number(item.timestamp || 0) || Date.now() });
        });
        await saveShortMemoryItemsForChat(chatType, chatId, merged, {
            chat,
            sourceUserName: shortRecord && shortRecord.sourceUserName,
            useShadowContext: true,
            sourceProtocol: 'uwu_memory_sync_bundle',
        });
        shortCount = merged.length;
    }
    return {
        insertedRawMessages: inserted,
        updatedRawMessages: updated,
        coreMemoryCount: Array.isArray(bundle.core_memory_items) ? bundle.core_memory_items.length : 0,
        shortContextCount: shortCount,
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

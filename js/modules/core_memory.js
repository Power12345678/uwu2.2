// Core memory bridge for WeChat-compatible memory files.
// File format: [{ timestamp, summary, importance, keywords }]

const CORE_MEMORY_DEFAULT_SETTINGS = {
    enabled: true,
    uploadToAi: true,
    uploadKeywords: false,
    autoSummaryByRound: true,
    maxChatRoundEntries: 12,
    recentMemoryCount: 70,
    archiveRecallCount: 20,
    memoryRecallMinCount: 20,
    memoryQueryTurns: 3,
    memoryKeywordStopwordsExtra: null,
    memorySummaryPromptTemplate: '',
    memoryImportancePromptTemplate: '',
    memoryRerankGenericTerms: null,
    memoryRerankIntimacyTerms: null,
    memoryRerankEventVerbWhitelist: null,
    memoryRerankEventOutcomeTerms: null,
    memoryRerankEventCandidateBlockTerms: null,
    memoryRerankHardAnchorNounWhitelist: null,
    memoryRerankHardAnchorBlockTerms: null,
    memoryRerankHardAnchorForceAuxTerms: null,
    memoryRerankTermAliases: null,
    memoryRerankAlphaCodeTokens: null,
    rerankEnabled: true,
    stageALightModeEnabled: true,
    stageAComplexModeEnabled: false,
    stageAV1Enabled: true,
    stageAFillToLimit: true,
    stageAGenericGuardEnabled: false,
    stageARequireNonGenericMatch: false,
    stageAMinNonGenericHits: 1,
    stageAGenericMatchWeight: 0.35,
    stageAGenericHitPenalty: 1.2,
    stageANonGenericHitBonus: 0.8,
    stageAGenericOnlyScoreMultiplier: 0.35,
    stageAPoolHardWeight: 5.2,
    stageAPoolEventWeight: 4.4,
    stageAPoolAuxWeight: 1.2,
    stageAQueryAssistWeight: 0.25,
    stageAOverlapBonusWeight: 0.8,
    stageAImportanceWeight: 0.9,
    stageANoPoolPenalty: 4.0,
    stageAPoolSoftFloorEnabled: true,
    stageAPoolSoftFloorMinHits: 30,
    stageABucketOrderEnabled: true,
    stageABucketPrimaryAnchorOnlyCrossBucket: true,
    stageABucketSecondaryHardBonusWeight: 0.35,
    stageABucketNoFixedLimit: true,
    stageABucketSamplingEnabled: false,
    stageABucketSamplingTarget: 800,
    rerankAnchorTop1Threshold: 5.5,
    rerankAnchorTop1Soft: 4.0,
    rerankAnchorTop2Soft: 3.0,
    rerankTopicRequireMultiAnchor: true,
    rerankTopicMinHardAnchorCount: 2,
    rerankTopicSingleAnchorOverrideScore: 9.2,
    rerankUserAnchorWeight: 1.0,
    rerankAssistantAnchorWeight: 1.0,
    rerankAssistantOnlyHardMin: 0.0,
    rerankBlockGenericAsHardAnchor: true,
    rerankHardAnchorMinScore: 5.0,
    rerankHardAnchorNounMinIdf: 2.6,
    rerankHardAnchorEntityMinIdf: 1.3,
    rerankHardAnchorVerbMinIdf: 2.2,
    rerankAnchorIdfWeight: 0.6,
    rerankAnchorIdfMaxBoost: 0.0,
    rerankAnchorFreqPenaltyWeight: 0.6,
    rerankQueryRecencyWeightEnabled: true,
    rerankQueryRecencyDecay: 0.2,
    rerankQueryRecencyMinWeight: 0.4,
    rerankQueryRecencyTier2Threshold: 1.6,
    rerankQueryRecencyTier1Threshold: 0.8,
    rerankAnchorCompositeDfAdjustEnabled: true,
    rerankAnchorCompositeDfShortMaxLen: 3,
    rerankAnchorBoost: 18,
    rerankAuxAnchorBoost: 2.2,
    rerankAuxAnchorMinScore: 2.0,
    rerankAuxMergeAlpha: 0.0,
    rerankAuxTermMaxScore: 4.5,
    rerankAuxLowSignalMultiplier: 1.8,
    rerankAuxMaxShare: 0.35,
    rerankIdfWeight: 2.0,
    rerankGenericPenalty: 5.0,
    rerankNoPoolMatchPenalty: 60.0,
    rerankMemoryRecencyWeight: 4.0,
    rerankTierMultiplier: 0.0,
    rerankDisableTierWhenNoPoolHit: true,
    rerankBasePoolInWeight: 1.0,
    rerankBasePoolOutWeight: 0.25,
    rerankPenetrationEnabled: true,
    rerankPenetrationMargin: 2.0,
    rerankPenetrationMaxSwaps: 2,
    rerankPenetrationReplaceWeakTailFirst: true,
    rerankDynamicTermGateEnabled: false,
    rerankDynamicTermGateMinTopk: 2,
    rerankDynamicTermGateProtectPerTerm: 1,
    rerankDynamicTermGateProtectMax: 6,
    rerankDynamicTermGatePLow: 40,
    rerankDynamicTermGatePMid: 50,
    rerankDynamicTermGatePHigh: 80,
    rerankFrontAnchorPriorityEnabled: true,
    rerankFrontAnchorPriorityWeight: 10.0,
    rerankFrontAnchorRankDecay: 0.25,
    rerankFrontAnchorRearPenaltyWeight: 3.0,
    rerankFrontAnchorRearTolerance: 2,
    rerankFrontAnchorRearStartRank: 5,
    rerankDiversityPenalty: 0.0,
    rerankAnchorCarryoverEnabled: false,
    rerankAnchorCarryoverTtl: 4,
    rerankAnchorCarryoverDecay: 0.85,
    rerankAnchorCarryoverStrongDecay: 0.65,
    rerankAnchorCarryoverKeepTopk: 6,
    rerankCarryoverRequireLink: true,
    rerankCarryoverLinkAuxTopk: 6,
    rerankCarryoverWeakFallbackTopk: 1,
    rerankTopicLockEnabled: true,
    rerankTopicLockTtl: 2,
    rerankTopicLockDecay: 0.9,
    rerankTopicCoreMinScore: 5.0,
    rerankTopicCoreTopk: 6,
    rerankTopicCorePreferObjectOutcome: true,
    rerankTopicConstraintsSoftOnly: true,
    rerankTopicLockSoftBonus: 8.0,
    rerankTopicCoreHitSoftBonus: 5.0,
    rerankTopicNonOutcomeSoftBonus: 3.0,
    rerankTopicStrongMatchSoftBonus: 4.0,
    rerankTopicEmotionMaxCount: 20,
    rerankEventVerbThreshold: 3.5,
    rerankEventVerbRequireStructure: true,
    rerankEventVerbMinStructureHits: 2,
    rerankEventStructureWindowChars: 12,
    rerankEventVerbBaseBonus: 1.2,
    rerankEventVerbMaxExtra: 1.4,
    rerankEventVerbWeakRareEnabled: true,
    rerankEventVerbWeakMinStructureHits: 0,
    rerankEventVerbWeakRareMinIdf: 4.4,
    rerankEventVerbWeakRareBaseSignal: 1.3,
    rerankEventVerbWeakRequireLatest: false,
    rerankEventVerbWeakBlockGeneric: true,
    rerankEventVerbWeakThreshold: 1.3,
    rerankEventVerbWeakBaseBonus: 0.8,
    rerankEventVerbWeakMaxExtra: 0.7,
    rerankEventCandidateEnabled: true,
    rerankEventCandidateMinScore: 2.4,
    rerankEventCandidateMinIdf: 2.0,
    rerankEventCandidateMinStructureHits: 2,
    rerankEventCandidateBoost: 6.0,
    rerankEventAliasPhraseBonus: 0.8,
    rerankEventSlotBoost: 10.0,
    rerankEventSlotEntityWeight: 1.2,
    rerankEventSlotActionWeight: 1.35,
    rerankEventSlotObjectWeight: 1.0,
    rerankEventSlotOutcomeWeight: 1.35,
    rerankRelaxedKeywordMatchEnabled: true,
    rerankRelaxedMatchMaxShare: 0.6,
    rerankRelaxedMatchStandaloneMaxMass: 0.7,
    rerankRelaxedMatchStandaloneMaxIdf: 3.2,
    rerankPoolMatchAlphaCodeWeight: 0.78,
    rerankPoolMatchMixedStrongWeight: 0.82,
    rerankPoolMatchMixedWeakWeight: 0.5,
    rerankAutoDiscoverTerms: true,
    rerankAutoGenericTopk: 30,
    rerankAutoIntimacyTopk: 20,
    topicLockEnabled: true,
    eventVerbEnabled: true,
    eventCandidateEnabled: true,
    autoDiscoverTerms: true,
    autoCleanArchiveThreshold: 500,
    autoCleanImportanceMax: 2
};

function getCoreMemoryChatType(chatType) {
    return chatType === 'group' ? 'group' : 'private';
}

function getCoreMemoryChatKey(chatType, chatId) {
    return `${getCoreMemoryChatType(chatType)}:${chatId}`;
}

function cloneCoreMemoryValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function getCoreMemoryDefaultSettings() {
    return cloneCoreMemoryValue(CORE_MEMORY_DEFAULT_SETTINGS);
}

function formatWechatTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const safe = isNaN(d.getTime()) ? new Date() : d;
    const localPad = typeof pad === 'function' ? pad : (n) => String(n).padStart(2, '0');
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${safe.getFullYear()}-${localPad(safe.getMonth() + 1)}-${localPad(safe.getDate())} ${weekdays[safe.getDay()]} ${localPad(safe.getHours())}:${localPad(safe.getMinutes())}`;
}

function formatWechatChatTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const safe = isNaN(d.getTime()) ? new Date() : d;
    const localPad = typeof pad === 'function' ? pad : (n) => String(n).padStart(2, '0');
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${safe.getFullYear()}-${localPad(safe.getMonth() + 1)}-${localPad(safe.getDate())} ${weekdays[safe.getDay()]} ${localPad(safe.getHours())}:${localPad(safe.getMinutes())}:${localPad(safe.getSeconds())}`;
}

function parseCoreMemoryTimestamp(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp === 'number') return timestamp;
    const normalized = String(timestamp)
        .trim()
        .replace(/-/g, '/')
        .replace(/^(\d{4}\/\d{2}\/\d{2})\s+[A-Za-z]+\s+/, '$1 ');
    const parsed = new Date(normalized).getTime();
    return isNaN(parsed) ? 0 : parsed;
}

function normalizeCoreMemoryImportance(value) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return 3;
    return Math.max(1, Math.min(5, n));
}

function normalizeCoreMemoryKeywords(value, maxCount = 0) {
    let keywords = [];
    if (Array.isArray(value)) {
        keywords = value;
    } else if (typeof value === 'string') {
        keywords = value.split(/[,\s，、;；|/]+/);
    }

    const seen = new Set();
    const result = [];
    keywords.forEach(item => {
        const text = String(item || '').trim();
        if (!text) return;
        const key = text.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(text);
    });

    return maxCount > 0 ? result.slice(0, maxCount) : result;
}

function normalizeCoreMemoryEntry(entry, options = {}) {
    if (!entry || typeof entry !== 'object') return null;
    const summary = String(entry.summary || '').trim();
    if (!summary) return null;

    return {
        timestamp: String(entry.timestamp || formatWechatTimestamp()).trim(),
        summary,
        importance: normalizeCoreMemoryImportance(entry.importance),
        keywords: normalizeCoreMemoryKeywords(entry.keywords || [], options.maxKeywords || 0)
    };
}

function sortCoreMemoryItems(items) {
    return (items || []).slice().sort((a, b) => {
        const ta = parseCoreMemoryTimestamp(a.timestamp);
        const tb = parseCoreMemoryTimestamp(b.timestamp);
        return ta - tb;
    });
}

function makeCoreMemoryDedupKey(entry) {
    const timestamp = String(entry.timestamp || '').trim();
    const summary = String(entry.summary || '').trim();
    return `${timestamp}::${summary}`;
}

function mergeCoreMemoryItems(existingItems, incomingItems, mode = 'merge') {
    const incoming = (incomingItems || [])
        .map(item => normalizeCoreMemoryEntry(item))
        .filter(Boolean);

    if (mode === 'replace') return sortCoreMemoryItems(incoming);

    const existing = (existingItems || [])
        .map(item => normalizeCoreMemoryEntry(item))
        .filter(Boolean);
    const seen = new Set(existing.map(makeCoreMemoryDedupKey));
    const merged = existing.slice();

    incoming.forEach(item => {
        const key = makeCoreMemoryDedupKey(item);
        if (mode === 'append' || !seen.has(key)) {
            merged.push(item);
            seen.add(key);
        }
    });

    return sortCoreMemoryItems(merged);
}

function parseWechatCoreMemoryJson(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error('记忆文件不是有效 JSON。');
    }

    if (!Array.isArray(data)) {
        throw new Error('记忆文件格式不正确：顶层必须是数组。');
    }

    const items = data
        .map(item => normalizeCoreMemoryEntry(item))
        .filter(Boolean);

    if (items.length === 0 && data.length > 0) {
        throw new Error('记忆文件里没有可用的 summary 字段。');
    }

    return sortCoreMemoryItems(items);
}

function exportWechatCoreMemoryJson(items) {
    const normalized = (items || [])
        .map(item => normalizeCoreMemoryEntry(item))
        .filter(Boolean);
    return JSON.stringify(sortCoreMemoryItems(normalized), null, 2);
}

function sanitizeCoreMemoryFileName(name) {
    return String(name || 'core_memory')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'core_memory';
}

function getDefaultCoreMemoryFileName(chat, chatType) {
    const baseName = chatType === 'group'
        ? (chat && chat.name) || 'group'
        : (chat && (chat.realName || chat.remarkName)) || 'solo';
    return `${sanitizeCoreMemoryFileName(baseName)}_core_memory.json`;
}

function ensureCoreMemoryDbArray() {
    if (!Array.isArray(db.coreMemoryFiles)) db.coreMemoryFiles = [];
    return db.coreMemoryFiles;
}

function normalizeCoreMemoryRecord(record) {
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record && record.settings ? record.settings : {});
    return Object.assign({}, record || {}, {
        settings,
        items: (record && Array.isArray(record.items) ? record.items : [])
            .map(item => normalizeCoreMemoryEntry(item))
            .filter(Boolean)
    });
}

function getCoreMemoryRecordSync(chatType, chatId) {
    const chatKey = getCoreMemoryChatKey(chatType, chatId);
    const list = ensureCoreMemoryDbArray();
    const record = list.find(item => item.chatKey === chatKey);
    return record ? normalizeCoreMemoryRecord(record) : null;
}

async function saveCoreMemoryRecord(record) {
    if (!record || !record.chatKey) return null;
    const normalized = normalizeCoreMemoryRecord(record);
    normalized.updatedAt = Date.now();

    const list = ensureCoreMemoryDbArray();
    const index = list.findIndex(item => item.chatKey === normalized.chatKey);
    if (index >= 0) {
        list[index] = normalized;
    } else {
        list.push(normalized);
    }

    if (typeof dexieDB !== 'undefined' && dexieDB && dexieDB.coreMemoryFiles) {
        await dexieDB.coreMemoryFiles.put(normalized);
    }
    return normalized;
}

async function ensureCoreMemoryRecord(chatType, chatId, options = {}) {
    const normalizedType = getCoreMemoryChatType(chatType);
    const chatKey = getCoreMemoryChatKey(normalizedType, chatId);
    const list = ensureCoreMemoryDbArray();
    const existing = list.find(item => item.chatKey === chatKey);
    if (existing) {
        const normalized = normalizeCoreMemoryRecord(existing);
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
        sourceFileName: options.sourceFileName || getDefaultCoreMemoryFileName(chat, normalizedType),
        settings: getCoreMemoryDefaultSettings(),
        items: [],
        lastSummarizedRound: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    list.push(record);
    if (typeof dexieDB !== 'undefined' && dexieDB && dexieDB.coreMemoryFiles) {
        await dexieDB.coreMemoryFiles.put(record);
    }
    return record;
}

function cleanupCoreMemoryArchive(record) {
    if (!record || !Array.isArray(record.items)) return record;
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record.settings || {});
    const threshold = Math.max(0, parseInt(settings.autoCleanArchiveThreshold, 10) || 0);
    if (threshold <= 0 || record.items.length <= threshold) return record;

    const importanceMax = normalizeCoreMemoryImportance(settings.autoCleanImportanceMax || 2);
    const removeCount = record.items.length - threshold;
    const candidates = record.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => normalizeCoreMemoryImportance(item.importance) <= importanceMax)
        .sort((a, b) => parseCoreMemoryTimestamp(a.item.timestamp) - parseCoreMemoryTimestamp(b.item.timestamp))
        .slice(0, removeCount);

    if (candidates.length === 0) return record;

    const removeIndexes = new Set(candidates.map(c => c.index));
    record.items = record.items.filter((_, index) => !removeIndexes.has(index));
    return record;
}

async function appendCoreMemoryEntry(chatType, chatId, entry) {
    const record = await ensureCoreMemoryRecord(chatType, chatId);
    const normalized = normalizeCoreMemoryEntry(entry, { maxKeywords: 20 });
    if (!normalized) return null;
    record.items = mergeCoreMemoryItems(record.items || [], [normalized], 'append');
    cleanupCoreMemoryArchive(record);
    return await saveCoreMemoryRecord(record);
}

async function importCoreMemoryText(chatType, chatId, text, options = {}) {
    const incoming = parseWechatCoreMemoryJson(text);
    const record = await ensureCoreMemoryRecord(chatType, chatId, {
        sourceFileName: options.sourceFileName
    });
    record.items = mergeCoreMemoryItems(record.items || [], incoming, options.mode || 'merge');
    if (options.sourceFileName) record.sourceFileName = options.sourceFileName;
    record.lastImportedAt = Date.now();
    const saved = await saveCoreMemoryRecord(record);
    return { record: saved, importedCount: incoming.length };
}

function readCoreMemoryFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('读取文件失败。'));
        reader.readAsText(file, 'utf-8');
    });
}

async function importCoreMemoryFile(file, chatType, chatId, options = {}) {
    const text = await readCoreMemoryFileAsText(file);
    return await importCoreMemoryText(chatType, chatId, text, {
        mode: options.mode || 'merge',
        sourceFileName: file && file.name ? file.name : options.sourceFileName
    });
}

function downloadCoreMemoryJson(chatType, chatId) {
    const record = getCoreMemoryRecordSync(chatType, chatId);
    const chat = getCoreMemoryChatType(chatType) === 'group'
        ? (db.groups || []).find(g => g.id === chatId)
        : (db.characters || []).find(c => c.id === chatId);
    const fileName = record && record.sourceFileName
        ? record.sourceFileName
        : getDefaultCoreMemoryFileName(chat, chatType);
    const blob = new Blob([exportWechatCoreMemoryJson(record ? record.items : [])], {
        type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sanitizeCoreMemoryFileName(fileName.replace(/\.json$/i, '')) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function formatCoreMemoryForPrompt(memories, options = {}) {
    const items = (memories || [])
        .map(item => normalizeCoreMemoryEntry(item))
        .filter(Boolean);
    if (items.length === 0) return '';

    const includeKeywords = !!options.includeKeywords;
    const lines = items.map(item => {
        const prefix = `[${item.timestamp} | 重要度 ${item.importance}]`;
        const keywords = includeKeywords && item.keywords.length > 0
            ? `\n关键词：${item.keywords.join('、')}`
            : '';
        return `${prefix}\n${item.summary}${keywords}`;
    });

    return `<core_memory>\n【核心记忆】\n以下是长期记忆中与当前对话相关或最近生成的事实、偏好、事件和关系进展。请把它们当作已发生的背景，不要在回复中机械复述。\n${lines.join('\n\n---\n\n')}\n</core_memory>`;
}

function getMessagePlainText(message) {
    if (!message) return '';
    if (Array.isArray(message.parts) && message.parts.length > 0) {
        return message.parts.map(part => part && part.text ? part.text : '[图片]').join('');
    }
    return String(message.content || '').trim();
}

function extractCoreMemoryKeywordsFromText(text, maxCount = 20) {
    const stopwords = new Set([
        '这个', '那个', '什么', '我们', '你们', '他们', '她们', '自己', '因为', '所以', '但是',
        '然后', '如果', '就是', '可以', '需要', '已经', '还是', '不是', '没有', '一下',
        '聊天', '消息', '回复', '用户', '角色', '内容'
    ]);
    const matches = String(text || '').match(/[\u4e00-\u9fa5]{2,8}|[A-Za-z][A-Za-z0-9_-]{1,}/g) || [];
    const seen = new Set();
    const result = [];
    matches.forEach(raw => {
        const item = raw.trim();
        const key = item.toLowerCase();
        if (!item || stopwords.has(item) || seen.has(key)) return;
        seen.add(key);
        result.push(item);
    });
    return result.slice(0, maxCount);
}

if (typeof window !== 'undefined') {
    window.CORE_MEMORY_DEFAULT_SETTINGS = CORE_MEMORY_DEFAULT_SETTINGS;
    window.getCoreMemoryDefaultSettings = getCoreMemoryDefaultSettings;
    window.getCoreMemoryChatKey = getCoreMemoryChatKey;
    window.getCoreMemoryRecordSync = getCoreMemoryRecordSync;
    window.ensureCoreMemoryRecord = ensureCoreMemoryRecord;
    window.saveCoreMemoryRecord = saveCoreMemoryRecord;
    window.appendCoreMemoryEntry = appendCoreMemoryEntry;
    window.importCoreMemoryFile = importCoreMemoryFile;
    window.importCoreMemoryText = importCoreMemoryText;
    window.downloadCoreMemoryJson = downloadCoreMemoryJson;
    window.parseWechatCoreMemoryJson = parseWechatCoreMemoryJson;
    window.exportWechatCoreMemoryJson = exportWechatCoreMemoryJson;
    window.formatCoreMemoryForPrompt = formatCoreMemoryForPrompt;
    window.formatWechatTimestamp = formatWechatTimestamp;
    window.formatWechatChatTimestamp = formatWechatChatTimestamp;
    window.getMessagePlainText = getMessagePlainText;
    window.extractCoreMemoryKeywordsFromText = extractCoreMemoryKeywordsFromText;
}

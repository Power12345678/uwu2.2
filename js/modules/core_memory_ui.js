// Settings-page controls for WeChat-compatible core memories.

const CORE_MEMORY_TABLE_CONTROLS = [
    ['memoryRerankGenericTerms', 'setting-core-memory-rerank-generic-terms', 'WECHAT_RERANK_GENERIC_TERMS'],
    ['memoryRerankIntimacyTerms', 'setting-core-memory-rerank-intimacy-terms', 'WECHAT_RERANK_INTIMACY_TERMS'],
    ['memoryRerankEventVerbWhitelist', 'setting-core-memory-event-verb-whitelist', 'WECHAT_RERANK_EVENT_VERB_WHITELIST'],
    ['memoryRerankEventOutcomeTerms', 'setting-core-memory-event-outcome-terms', 'WECHAT_RERANK_EVENT_OUTCOME_TERMS'],
    ['memoryRerankEventCandidateBlockTerms', 'setting-core-memory-event-candidate-block-terms', 'WECHAT_RERANK_EVENT_CANDIDATE_BLOCK_TERMS'],
    ['memoryRerankHardAnchorNounWhitelist', 'setting-core-memory-hard-anchor-noun-whitelist', 'WECHAT_RERANK_HARD_ANCHOR_NOUN_WHITELIST'],
    ['memoryRerankHardAnchorBlockTerms', 'setting-core-memory-hard-anchor-block-terms', 'WECHAT_RERANK_HARD_ANCHOR_BLOCK_TERMS'],
    ['memoryRerankHardAnchorForceAuxTerms', 'setting-core-memory-hard-anchor-force-aux-terms', 'WECHAT_RERANK_HARD_ANCHOR_FORCE_AUX_TERMS'],
    ['memoryRerankTermAliases', 'setting-core-memory-term-aliases', 'WECHAT_RERANK_TERM_ALIASES'],
    ['memoryRerankAlphaCodeTokens', 'setting-core-memory-alpha-code-tokens', 'WECHAT_RERANK_ALPHA_CODE_TOKENS']
];

function getCurrentCoreMemoryContext() {
    if (currentChatType === 'group') {
        const group = (db.groups || []).find(g => g.id === currentChatId);
        return { chat: group, chatType: 'group', chatId: currentChatId };
    }
    const character = (db.characters || []).find(c => c.id === currentChatId);
    return { chat: character, chatType: 'private', chatId: currentChatId };
}

function setCoreMemoryElementValue(id, value, prop = 'value') {
    const el = document.getElementById(id);
    if (!el) return;
    el[prop] = value;
}

function getCoreMemoryNumberInput(id, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const el = document.getElementById(id);
    const n = el ? parseInt(el.value, 10) : fallback;
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function getCoreMemoryTextareaValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '') : '';
}

function getCoreMemoryStopwordsForSave() {
    const raw = getCoreMemoryTextareaValue('setting-core-memory-stopwords-extra');
    if (typeof normalizeCoreMemoryStopwordsExtra === 'function') {
        return normalizeCoreMemoryStopwordsExtra(raw);
    }
    return raw.split(/[,\n，、;；|/]+/).map(item => item.trim()).filter(Boolean);
}

function getCoreMemoryListForSave(id) {
    const raw = getCoreMemoryTextareaValue(id);
    if (typeof normalizeCoreMemoryListSetting === 'function') {
        return normalizeCoreMemoryListSetting(raw, []);
    }
    return raw.split(/[,\n，、;；|/]+/).map(item => item.trim()).filter(Boolean);
}

function setCoreMemoryListElementValue(id, value) {
    setCoreMemoryElementValue(id, (value || []).join(', '));
}

function renderCoreMemoryStats(record) {
    const statsEl = document.getElementById('core-memory-stats');
    if (!statsEl) return;
    const count = record && Array.isArray(record.items) ? record.items.length : 0;
    const lastTime = record && record.updatedAt ? new Date(record.updatedAt).toLocaleString() : '尚未更新';
    statsEl.textContent = `${count} 条 · ${lastTime}`;
}

function loadCoreMemorySettingsToSidebar(chat) {
    if (!chat || !chat.id) return;
    const chatType = currentChatType === 'group' ? 'group' : 'private';
    const record = getCoreMemoryRecordSync(chatType, chat.id);
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record && record.settings ? record.settings : {});

    setCoreMemoryElementValue('setting-core-memory-enabled', !!settings.enabled, 'checked');
    setCoreMemoryElementValue('setting-core-memory-upload-to-ai', !!settings.uploadToAi, 'checked');
    setCoreMemoryElementValue('setting-core-memory-auto-summary', !!settings.autoSummaryByRound, 'checked');
    setCoreMemoryElementValue('setting-core-memory-round-entries', settings.maxChatRoundEntries || 12);
    setCoreMemoryElementValue('setting-core-memory-recent-count', settings.recentMemoryCount || 70);
    setCoreMemoryElementValue('setting-core-memory-recall-count', settings.archiveRecallCount || 20);
    setCoreMemoryElementValue('setting-core-memory-query-turns', settings.memoryQueryTurns || 3);
    setCoreMemoryElementValue('setting-core-memory-filename', record && record.sourceFileName ? record.sourceFileName : getDefaultCoreMemoryFileName(chat, chatType));

    const promptSettings = typeof getCoreMemoryPromptSettings === 'function'
        ? getCoreMemoryPromptSettings(chat, chatType)
        : {
            keywordStopwordsExtra: [],
            summaryPromptTemplate: '',
            importancePromptTemplate: ''
        };
    setCoreMemoryElementValue('setting-core-memory-stopwords-extra', (promptSettings.keywordStopwordsExtra || []).join(', '));
    setCoreMemoryElementValue('setting-core-memory-summary-prompt', promptSettings.summaryPromptTemplate || '');
    setCoreMemoryElementValue('setting-core-memory-importance-prompt', promptSettings.importancePromptTemplate || '');

    const tableSettings = typeof getCoreMemoryRerankTableSettings === 'function'
        ? getCoreMemoryRerankTableSettings(settings)
        : {};
    setCoreMemoryListElementValue('setting-core-memory-rerank-generic-terms', tableSettings.genericTerms || []);
    setCoreMemoryListElementValue('setting-core-memory-rerank-intimacy-terms', tableSettings.intimacyTerms || []);
    setCoreMemoryListElementValue('setting-core-memory-event-verb-whitelist', tableSettings.eventVerbWhitelist || []);
    setCoreMemoryListElementValue('setting-core-memory-event-outcome-terms', tableSettings.eventOutcomeTerms || []);
    setCoreMemoryListElementValue('setting-core-memory-event-candidate-block-terms', tableSettings.eventCandidateBlockTerms || []);
    setCoreMemoryListElementValue('setting-core-memory-hard-anchor-noun-whitelist', tableSettings.hardAnchorNounWhitelist || []);
    setCoreMemoryListElementValue('setting-core-memory-hard-anchor-block-terms', tableSettings.hardAnchorBlockTerms || []);
    setCoreMemoryListElementValue('setting-core-memory-hard-anchor-force-aux-terms', tableSettings.hardAnchorForceAuxTerms || []);
    setCoreMemoryListElementValue('setting-core-memory-term-aliases', tableSettings.termAliases || []);
    setCoreMemoryListElementValue('setting-core-memory-alpha-code-tokens', tableSettings.alphaCodeTokens || []);

    const autoContainer = document.getElementById('setting-core-memory-auto-container');
    if (autoContainer) autoContainer.style.display = settings.autoSummaryByRound ? 'flex' : 'none';
    renderCoreMemoryStats(record);
}

async function saveCoreMemorySettingsFromSidebar(chat) {
    if (!chat || !chat.id) return;
    const chatType = currentChatType === 'group' ? 'group' : 'private';
    const record = await ensureCoreMemoryRecord(chatType, chat.id, { chat });
    const filenameEl = document.getElementById('setting-core-memory-filename');
    const enabledEl = document.getElementById('setting-core-memory-enabled');
    const uploadEl = document.getElementById('setting-core-memory-upload-to-ai');
    const autoEl = document.getElementById('setting-core-memory-auto-summary');

    record.sourceFileName = filenameEl && filenameEl.value.trim()
        ? filenameEl.value.trim()
        : getDefaultCoreMemoryFileName(chat, chatType);

    const tableSettingsForSave = {};
    CORE_MEMORY_TABLE_CONTROLS.forEach(([settingKey, id]) => {
        tableSettingsForSave[settingKey] = getCoreMemoryListForSave(id);
    });

    record.settings = Object.assign(getCoreMemoryDefaultSettings(), record.settings || {}, {
        enabled: enabledEl ? enabledEl.checked : true,
        uploadToAi: uploadEl ? uploadEl.checked : true,
        uploadKeywords: false,
        autoSummaryByRound: autoEl ? autoEl.checked : true,
        maxChatRoundEntries: getCoreMemoryNumberInput('setting-core-memory-round-entries', 12, 1, 200),
        recentMemoryCount: getCoreMemoryNumberInput('setting-core-memory-recent-count', 70, 1, 500),
        archiveRecallCount: getCoreMemoryNumberInput('setting-core-memory-recall-count', 20, 0, 200),
        memoryRecallMinCount: getCoreMemoryNumberInput('setting-core-memory-recall-count', 20, 0, 200),
        memoryQueryTurns: getCoreMemoryNumberInput('setting-core-memory-query-turns', 3, 1, 20),
        memoryKeywordStopwordsExtra: getCoreMemoryStopwordsForSave(),
        memorySummaryPromptTemplate: getCoreMemoryTextareaValue('setting-core-memory-summary-prompt').trim(),
        memoryImportancePromptTemplate: getCoreMemoryTextareaValue('setting-core-memory-importance-prompt').trim(),
        ...tableSettingsForSave,
        stageALightModeEnabled: true,
        rerankEnabled: true,
        topicLockEnabled: true,
        eventVerbEnabled: true,
        eventCandidateEnabled: true,
        autoDiscoverTerms: true
    });

    const saved = await saveCoreMemoryRecord(record);
    renderCoreMemoryStats(saved);
}

async function handleCoreMemoryImport(file) {
    if (!file) return;
    const { chat, chatType, chatId } = getCurrentCoreMemoryContext();
    if (!chat || !chatId) return;

    let mode = 'merge';
    const existing = getCoreMemoryRecordSync(chatType, chatId);
    if (existing && existing.items && existing.items.length > 0) {
        mode = confirm('检测到当前角色已有核心记忆。点击“确定”合并导入，点击“取消”用文件覆盖现有记忆。') ? 'merge' : 'replace';
    }

    try {
        const result = await importCoreMemoryFile(file, chatType, chatId, { mode });
        loadCoreMemorySettingsToSidebar(chat);
        if (typeof showToast === 'function') {
            showToast(`已导入 ${result.importedCount} 条核心记忆`);
        }
    } catch (error) {
        console.error('核心记忆导入失败:', error);
        if (typeof showToast === 'function') showToast(error.message || '核心记忆导入失败');
    }
}

function setupCoreMemoryUI() {
    const importBtn = document.getElementById('core-memory-import-btn');
    const importInput = document.getElementById('core-memory-import-input');
    const exportBtn = document.getElementById('core-memory-export-btn');
    const autoSwitch = document.getElementById('setting-core-memory-auto-summary');
    const resetStopwordsBtn = document.getElementById('core-memory-reset-stopwords-btn');
    const resetSummaryPromptBtn = document.getElementById('core-memory-reset-summary-prompt-btn');
    const resetImportancePromptBtn = document.getElementById('core-memory-reset-importance-prompt-btn');

    if (importBtn && importInput && !importBtn.dataset.coreMemoryBound) {
        importBtn.dataset.coreMemoryBound = '1';
        importBtn.addEventListener('click', () => {
            importInput.value = '';
            importInput.click();
        });
        importInput.addEventListener('change', () => {
            handleCoreMemoryImport(importInput.files && importInput.files[0]);
        });
    }

    if (exportBtn && !exportBtn.dataset.coreMemoryBound) {
        exportBtn.dataset.coreMemoryBound = '1';
        exportBtn.addEventListener('click', () => {
            const { chatType, chatId } = getCurrentCoreMemoryContext();
            if (!chatId) return;
            downloadCoreMemoryJson(chatType, chatId);
        });
    }

    if (autoSwitch && !autoSwitch.dataset.coreMemoryBound) {
        autoSwitch.dataset.coreMemoryBound = '1';
        autoSwitch.addEventListener('change', () => {
            const autoContainer = document.getElementById('setting-core-memory-auto-container');
            if (autoContainer) autoContainer.style.display = autoSwitch.checked ? 'flex' : 'none';
        });
    }

    if (resetStopwordsBtn && !resetStopwordsBtn.dataset.coreMemoryBound) {
        resetStopwordsBtn.dataset.coreMemoryBound = '1';
        resetStopwordsBtn.addEventListener('click', () => {
            setCoreMemoryElementValue('setting-core-memory-stopwords-extra', (window.WECHAT_MEMORY_KEYWORD_STOPWORDS_EXTRA || []).join(', '));
        });
    }

    if (resetSummaryPromptBtn && !resetSummaryPromptBtn.dataset.coreMemoryBound) {
        resetSummaryPromptBtn.dataset.coreMemoryBound = '1';
        resetSummaryPromptBtn.addEventListener('click', () => {
            setCoreMemoryElementValue('setting-core-memory-summary-prompt', window.WECHAT_MEMORY_SUMMARY_PROMPT_TEMPLATE || '');
        });
    }

    if (resetImportancePromptBtn && !resetImportancePromptBtn.dataset.coreMemoryBound) {
        resetImportancePromptBtn.dataset.coreMemoryBound = '1';
        resetImportancePromptBtn.addEventListener('click', () => {
            setCoreMemoryElementValue('setting-core-memory-importance-prompt', window.WECHAT_MEMORY_IMPORTANCE_PROMPT_TEMPLATE || '');
        });
    }

    CORE_MEMORY_TABLE_CONTROLS.forEach(([, id, defaultName]) => {
        const resetBtn = document.querySelector(`[data-core-memory-reset-table="${id}"]`);
        if (!resetBtn || resetBtn.dataset.coreMemoryBound) return;
        resetBtn.dataset.coreMemoryBound = '1';
        resetBtn.addEventListener('click', () => {
            setCoreMemoryListElementValue(id, window[defaultName] || []);
        });
    });
}

document.addEventListener('DOMContentLoaded', setupCoreMemoryUI);

if (typeof window !== 'undefined') {
    window.setupCoreMemoryUI = setupCoreMemoryUI;
    window.loadCoreMemorySettingsToSidebar = loadCoreMemorySettingsToSidebar;
    window.saveCoreMemorySettingsFromSidebar = saveCoreMemorySettingsFromSidebar;
}

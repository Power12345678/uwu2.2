// --- 核心记忆管理界面 ---

let generatingChatId = null;
let coreMemoryManageMode = false;
let selectedCoreMemoryKeys = new Set();
let currentCoreMemoryDetailKey = null;
let coreMemorySearchQuery = '';
let memoryBankActiveTab = 'core';

function getCurrentMemoryChat() {
    const chatType = currentChatType === 'group' ? 'group' : 'private';
    const chat = chatType === 'group'
        ? db.groups.find(g => g.id === currentChatId)
        : db.characters.find(c => c.id === currentChatId);
    return { chat, chatType, chatId: currentChatId };
}

function getCoreMemoryItemKey(item) {
    return `${String(item.timestamp || '').trim()}::${String(item.summary || '').trim()}`;
}

function getCurrentCoreMemoryItems() {
    const { chatType, chatId } = getCurrentMemoryChat();
    const record = chatId ? getCoreMemoryRecordSync(chatType, chatId) : null;
    return record && Array.isArray(record.items) ? sortCoreMemoryItems(record.items) : [];
}

function findCurrentCoreMemoryItem(key) {
    return getCurrentCoreMemoryItems().find(item => getCoreMemoryItemKey(item) === key) || null;
}

async function saveCurrentCoreMemoryItems(items) {
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return null;
    const record = await ensureCoreMemoryRecord(chatType, chatId, { chat });
    record.items = sortCoreMemoryItems((items || []).map(item => normalizeCoreMemoryEntry(item)).filter(Boolean));
    return await saveCoreMemoryRecord(record);
}

function setupMemoryJournalScreen() {
    ensureMemoryBankTabsUi();

    const titleBtn = document.getElementById('journal-title-btn');
    const actionSheet = document.getElementById('journal-title-actionsheet');
    const cancelActionBtn = document.getElementById('journal-title-cancel-btn');
    const searchBtn = document.getElementById('search-journal-btn');
    const searchBar = document.getElementById('journal-search-bar');
    const searchInput = document.getElementById('journal-search-input');
    const manualBtn = document.getElementById('manual-add-journal-btn');
    const manualModal = document.getElementById('manual-journal-modal');
    const manualForm = document.getElementById('manual-journal-form');
    const manualCancelBtn = document.getElementById('manual-journal-cancel-btn');
    const generateBtn = document.getElementById('generate-new-journal-btn');
    const generateModal = document.getElementById('generate-journal-modal');
    const generateForm = document.getElementById('generate-journal-form');
    const exportBtn = document.getElementById('export-journal-btn');
    const importBtn = document.getElementById('import-journal-btn');
    const importInput = document.getElementById('import-journal-file-input');
    const manageBtn = document.getElementById('journal-manage-btn');
    const cancelManageBtn = document.getElementById('journal-cancel-manage-btn');
    const batchDeleteBtn = document.getElementById('journal-batch-delete-btn');
    const batchExportBtn = document.getElementById('journal-batch-export-btn');
    const mergeBtn = document.getElementById('journal-merge-btn');
    const selectAllBtn = document.getElementById('journal-select-all-btn');
    const listContainer = document.getElementById('journal-list-container');
    const editDetailBtn = document.getElementById('edit-journal-detail-btn');
    const deleteDetailBtn = document.getElementById('delete-journal-detail-btn');
    const saveDetailBtn = document.getElementById('save-journal-detail-btn');
    const bindBtn = document.getElementById('bind-journal-worldbook-btn');
    const shortImportInput = document.getElementById('short-memory-import-input');
    const tabs = document.getElementById('memory-bank-tabs');

    if (tabs) {
        tabs.addEventListener('click', (event) => {
            const tabBtn = event.target.closest('[data-memory-tab]');
            if (!tabBtn) return;
            memoryBankActiveTab = tabBtn.dataset.memoryTab || 'core';
            if (memoryBankActiveTab === 'short') {
                coreMemoryManageMode = false;
                selectedCoreMemoryKeys.clear();
            }
            renderJournalList();
        });
    }

    if (bindBtn) {
        bindBtn.title = '导入微信核心记忆';
        bindBtn.addEventListener('click', () => {
            if (importInput) importInput.click();
        });
    }

    if (titleBtn) {
        titleBtn.textContent = '核心记忆';
        titleBtn.addEventListener('click', () => actionSheet && actionSheet.classList.add('visible'));
    }
    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', () => actionSheet && actionSheet.classList.remove('visible'));
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (actionSheet) actionSheet.classList.remove('visible');
            if (!searchBar) return;
            const nextDisplay = searchBar.style.display === 'none' ? 'block' : 'none';
            searchBar.style.display = nextDisplay;
            if (nextDisplay === 'block') {
                searchInput && searchInput.focus();
            } else {
                coreMemorySearchQuery = '';
                if (searchInput) searchInput.value = '';
                renderJournalList();
            }
        });
    }

    if (searchInput) {
        searchInput.placeholder = '搜索核心记忆摘要或关键词...';
        searchInput.addEventListener('input', (event) => {
            coreMemorySearchQuery = event.target.value.trim();
            renderJournalList(coreMemorySearchQuery);
        });
    }

    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            if (actionSheet) actionSheet.classList.remove('visible');
            openCoreMemoryEditModal();
        });
    }
    if (manualCancelBtn) {
        manualCancelBtn.addEventListener('click', () => manualModal && manualModal.classList.remove('visible'));
    }
    if (manualForm) {
        manualForm.addEventListener('submit', saveCoreMemoryFromManualForm);
    }

    if (generateBtn) {
        generateBtn.title = '从聊天生成核心记忆';
        generateBtn.addEventListener('click', () => {
            const { chat } = getCurrentMemoryChat();
            if (!chat || !Array.isArray(chat.history) || chat.history.length === 0) {
                showToast('当前没有可总结的聊天记录');
                return;
            }
            const startInput = document.getElementById('journal-range-start');
            const endInput = document.getElementById('journal-range-end');
            const info = document.getElementById('journal-range-info');
            if (startInput) startInput.value = Math.max(1, chat.history.length - 23);
            if (endInput) endInput.value = chat.history.length;
            if (info) info.textContent = `当前聊天记录共 ${chat.history.length} 条；建议选择约 12 轮完整对话。`;
            if (generateModal) generateModal.classList.add('visible');
        });
    }
    if (generateForm) {
        generateForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const start = parseInt(document.getElementById('journal-range-start').value, 10);
            const end = parseInt(document.getElementById('journal-range-end').value, 10);
            await generateJournal(start, end, false, false);
            if (generateModal) generateModal.classList.remove('visible');
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (actionSheet) actionSheet.classList.remove('visible');
            exportCoreMemoryItems();
        });
    }
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (actionSheet) actionSheet.classList.remove('visible');
            if (importInput) importInput.click();
        });
    }
    if (importInput) {
        importInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            await importCoreMemoryIntoCurrentChat(file);
            event.target.value = '';
        });
    }
    if (shortImportInput) {
        shortImportInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            await importShortMemoryIntoCurrentChat(file);
            event.target.value = '';
        });
    }

    if (manageBtn) manageBtn.addEventListener('click', () => toggleCoreMemoryManageMode(true));
    if (cancelManageBtn) cancelManageBtn.addEventListener('click', () => toggleCoreMemoryManageMode(false));
    if (selectAllBtn) selectAllBtn.addEventListener('click', toggleCoreMemorySelectAll);
    if (batchDeleteBtn) batchDeleteBtn.addEventListener('click', deleteSelectedCoreMemories);
    if (batchExportBtn) batchExportBtn.addEventListener('click', exportSelectedCoreMemories);
    if (mergeBtn) mergeBtn.addEventListener('click', mergeSelectedCoreMemories);

    if (listContainer) {
        listContainer.addEventListener('click', handleCoreMemoryListClick);
    }
    if (editDetailBtn) editDetailBtn.addEventListener('click', () => {
        const item = findCurrentCoreMemoryItem(currentCoreMemoryDetailKey);
        if (item) openCoreMemoryEditModal(item, currentCoreMemoryDetailKey);
    });
    if (deleteDetailBtn) deleteDetailBtn.addEventListener('click', () => {
        deleteCurrentCoreMemoryItem();
    });
    if (saveDetailBtn) saveDetailBtn.style.display = 'none';

    updateCoreMemoryScreenText();
}

function ensureMemoryBankTabsUi() {
    if (document.getElementById('memory-bank-tabs')) return;
    const screen = document.getElementById('memory-journal-screen');
    const searchBar = document.getElementById('journal-search-bar');
    if (!screen || !searchBar) return;

    const tabs = document.createElement('div');
    tabs.id = 'memory-bank-tabs';
    tabs.style.cssText = 'display:flex;gap:6px;padding:8px 12px;background:var(--bg-color);border-bottom:1px solid rgba(0,0,0,0.06);';
    tabs.innerHTML = `
        <button type="button" class="memory-bank-tab active" data-memory-tab="core" style="flex:1;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:8px 6px;background:var(--primary-color);color:#fff;font-size:13px;">长期核心记忆</button>
        <button type="button" class="memory-bank-tab" data-memory-tab="short" style="flex:1;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:8px 6px;background:#fff;color:#555;font-size:13px;">短期上下文</button>
        <input type="file" id="short-memory-import-input" accept=".json,application/json" style="display:none;">
    `;
    searchBar.insertAdjacentElement('afterend', tabs);
}

function updateCoreMemoryScreenText() {
    const menuLabel = document.querySelector('#memory-journal-btn .expansion-item-name');
    if (menuLabel) menuLabel.textContent = '记忆';

    const title = document.getElementById('journal-title-btn');
    if (title) title.textContent = '核心记忆';

    const manualBtn = document.getElementById('manual-add-journal-btn');
    if (manualBtn) manualBtn.textContent = '手动添加核心记忆';
    const searchBtn = document.getElementById('search-journal-btn');
    if (searchBtn) searchBtn.textContent = '搜索核心记忆';
    const exportBtn = document.getElementById('export-journal-btn');
    if (exportBtn) exportBtn.textContent = '导出微信记忆 JSON';
    const importBtn = document.getElementById('import-journal-btn');
    if (importBtn) importBtn.textContent = '导入微信记忆 JSON';

    const detailTitle = document.querySelector('#memory-journal-detail-screen .title');
    if (detailTitle) detailTitle.textContent = '核心记忆详情';

    const modalTitle = document.querySelector('#manual-journal-modal h3');
    if (modalTitle) modalTitle.textContent = '核心记忆片段';
    const titleLabel = document.querySelector('label[for="manual-journal-title"]');
    if (titleLabel) titleLabel.textContent = '关键词';
    const titleInput = document.getElementById('manual-journal-title');
    if (titleInput) titleInput.placeholder = '例如：面试, 工作, 鼓励';
    const contentLabel = document.querySelector('label[for="manual-journal-content"]');
    if (contentLabel) contentLabel.textContent = '记忆摘要';
    const contentInput = document.getElementById('manual-journal-content');
    if (contentInput) contentInput.placeholder = '写入一条长期核心记忆摘要...';

    const generateTitle = document.querySelector('#generate-journal-modal h3');
    if (generateTitle) generateTitle.textContent = '从聊天生成核心记忆';
    const includeFavorited = document.getElementById('journal-include-favorited');
    const includeGroup = includeFavorited ? includeFavorited.closest('.form-group') : null;
    if (includeGroup) includeGroup.style.display = 'none';
}

function updateMemoryBankTabState() {
    document.querySelectorAll('.memory-bank-tab').forEach(btn => {
        const active = btn.dataset.memoryTab === memoryBankActiveTab;
        btn.classList.toggle('active', active);
        btn.style.background = active ? 'var(--primary-color)' : '#fff';
        btn.style.color = active ? '#fff' : '#555';
    });

    const manageBtn = document.getElementById('journal-manage-btn');
    const cancelBtn = document.getElementById('journal-cancel-manage-btn');
    const bindBtn = document.getElementById('bind-journal-worldbook-btn');
    const generateBtn = document.getElementById('generate-new-journal-btn');
    const bar = document.getElementById('journal-multi-select-bar');

    if (memoryBankActiveTab === 'short') {
        if (manageBtn) manageBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (bindBtn) bindBtn.style.display = 'none';
        if (generateBtn) generateBtn.style.display = 'none';
        if (bar) bar.style.display = 'none';
    } else {
        if (manageBtn) manageBtn.style.display = coreMemoryManageMode ? 'none' : 'flex';
        if (cancelBtn) cancelBtn.style.display = coreMemoryManageMode ? 'inline-flex' : 'none';
        if (bindBtn) bindBtn.style.display = 'flex';
        if (generateBtn) generateBtn.style.display = 'flex';
        if (bar) bar.style.display = coreMemoryManageMode ? 'flex' : 'none';
    }
}

function renderJournalList(searchQuery = coreMemorySearchQuery) {
    updateCoreMemoryScreenText();
    updateMemoryBankTabState();
    const container = document.getElementById('journal-list-container');
    const placeholder = document.getElementById('no-journals-placeholder');
    if (!container) return;

    container.innerHTML = '';
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat || !chatId) return;

    if (memoryBankActiveTab === 'short') {
        renderShortMemoryPanel(container, placeholder, chat, chatType, chatId);
        return;
    }

    const record = getCoreMemoryRecordSync(chatType, chatId);
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record && record.settings ? record.settings : {});
    const allItems = record && Array.isArray(record.items) ? sortCoreMemoryItems(record.items) : [];
    const recentCount = Math.max(1, parseInt(settings.recentMemoryCount, 10) || 70);
    const archiveCount = Math.max(0, allItems.length - recentCount);
    const recentPoolCount = Math.min(allItems.length, recentCount);

    renderCoreMemoryOverview(container, {
        total: allItems.length,
        recentPoolCount,
        archiveCount,
        recallCount: settings.archiveRecallCount || 20,
        roundInterval: settings.maxChatRoundEntries || 12,
        enabled: settings.enabled,
        uploadToAi: settings.uploadToAi
    });

    let items = allItems;
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        items = items.filter(item => {
            const text = `${item.summary || ''}\n${(item.keywords || []).join(' ')}`.toLowerCase();
            return text.includes(lower);
        });
    }

    items = items.slice().reverse();

    if ((!items || items.length === 0) && !generatingChatId) {
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.innerHTML = '<p>还没有核心记忆。</p><p>导入微信记忆 JSON，或点击右上角“+”从聊天生成。</p>';
        }
        return;
    }
    if (placeholder) placeholder.style.display = 'none';

    if (generatingChatId === currentChatId) {
        const loadingCard = document.createElement('li');
        loadingCard.className = 'journal-card generating';
        loadingCard.innerHTML = '<div class="spinner"></div><div class="text">正在生成核心记忆...</div>';
        container.appendChild(loadingCard);
    }

    items.forEach((item, index) => {
        const source = allItems.indexOf(item) >= Math.max(0, allItems.length - recentCount) ? '短期池' : '长期池';
        const card = document.createElement('li');
        card.className = 'journal-card core-memory-card';
        card.dataset.key = getCoreMemoryItemKey(item);
        const selected = selectedCoreMemoryKeys.has(card.dataset.key);
        const keywords = normalizeCoreMemoryKeywords(item.keywords || []).slice(0, 8);
        card.innerHTML = `
            <div class="journal-checkbox ${selected ? 'checked' : ''}"></div>
            <div class="journal-card-header">
                <div class="journal-card-title">重要度 ${normalizeCoreMemoryImportance(item.importance)} · ${source}</div>
            </div>
            <div class="core-memory-summary" style="font-size: 13px; color: #555; line-height: 1.55; margin: 8px 0;">${escapeCoreMemoryHtml(item.summary || '')}</div>
            <div class="journal-card-footer" style="justify-content: space-between; height: auto; opacity: 1; margin-top: 10px; align-items: center;">
                <span class="journal-card-date">${escapeCoreMemoryHtml(item.timestamp || '')}</span>
                <span class="journal-card-range">${keywords.length ? escapeCoreMemoryHtml(keywords.join('、')) : '无关键词'}</span>
            </div>
        `;
        container.appendChild(card);
    });
    updateCoreMemoryMultiSelectBar();
}

function renderCoreMemoryOverview(container, stats) {
    const overview = document.createElement('li');
    overview.className = 'journal-card core-memory-overview';
    overview.style.cursor = 'default';
    overview.innerHTML = `
        <div class="journal-card-header">
            <div class="journal-card-title">长短期记忆池</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:10px;">
            <div style="background:rgba(0,0,0,0.04); border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:18px; font-weight:700;">${stats.total}</div>
                <div style="font-size:11px; color:#888;">总记忆</div>
            </div>
            <div style="background:rgba(0,0,0,0.04); border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:18px; font-weight:700;">${stats.recentPoolCount}</div>
                <div style="font-size:11px; color:#888;">短期最新池</div>
            </div>
            <div style="background:rgba(0,0,0,0.04); border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:18px; font-weight:700;">${stats.archiveCount}</div>
                <div style="font-size:11px; color:#888;">长期老记忆池</div>
            </div>
        </div>
        <div style="font-size:12px; color:#777; margin-top:10px; line-height:1.5;">
            AI读取：${stats.uploadToAi ? '开启' : '关闭'} · 自动总结：每 ${stats.roundInterval} 轮 · 老记忆召回：${stats.recallCount} 条
        </div>
        <button type="button" class="btn btn-primary btn-small" id="force-core-summary-btn" style="margin-top:12px;width:100%;">手动总结核心记忆</button>
    `;
    container.appendChild(overview);
}

function handleCoreMemoryListClick(event) {
    const forceSummaryBtn = event.target.closest('#force-core-summary-btn');
    if (forceSummaryBtn) {
        handleForceCoreMemorySummary();
        return;
    }
    if (memoryBankActiveTab === 'short') {
        handleShortMemoryPanelClick(event);
        return;
    }
    const card = event.target.closest('.core-memory-card');
    if (!card) return;
    const key = card.dataset.key;
    if (coreMemoryManageMode) {
        if (selectedCoreMemoryKeys.has(key)) {
            selectedCoreMemoryKeys.delete(key);
        } else {
            selectedCoreMemoryKeys.add(key);
        }
        renderJournalList();
        return;
    }
    openCoreMemoryDetail(key);
}

async function handleForceCoreMemorySummary() {
    const { chat, chatType } = getCurrentMemoryChat();
    if (!chat) return;
    if (!confirm('现在手动总结当前短期上下文为核心记忆吗？未满 12 轮也会总结。')) return;
    const btn = document.getElementById('force-core-summary-btn');
    const oldText = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = '总结中...';
    }
    try {
        const entry = typeof forceSummarizeCoreMemory === 'function'
            ? await forceSummarizeCoreMemory(chat, chatType, { updateCursor: true })
            : null;
        if (entry) renderJournalList();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = oldText || '手动总结核心记忆';
        }
    }
}

function renderShortMemoryPanel(container, placeholder, chat, chatType, chatId) {
    if (placeholder) placeholder.style.display = 'none';
    const result = typeof getShortMemoryItemsForChat === 'function'
        ? getShortMemoryItemsForChat(chat, chatType)
        : { items: [], source: 'empty', record: null };
    const allItems = normalizeShortMemoryEditorItems(result.items || []);
    // 管理页与实际发送保持同一窗口：maxMemory 是发送给 AI 的消息条数。
    // 只渲染窗口内的内容，避免导入大量历史后一次性创建上百个 textarea 卡片。
    const maxItems = Math.max(1, parseInt(chat.maxMemory, 10) || 20);
    const items = allItems.slice(-maxItems);
    const rounds = typeof shortMemoryItemsToRounds === 'function'
        ? shortMemoryItemsToRounds(items)
        : [];
    const record = result.record || getShortMemoryRecordSync(chatType, chatId);
    const sourceText = result.source === 'shadow' ? '独立短期上下文' : '由界面聊天记录推导';
    const willSendCount = items.length;

    const overview = document.createElement('li');
    overview.className = 'journal-card short-memory-overview';
    overview.style.cursor = 'default';
    overview.innerHTML = `
        <div class="journal-card-header">
            <div class="journal-card-title">发送给 AI 的短期记忆</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">
            <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;">${items.length}</div>
                <div style="font-size:11px;color:#888;">上下文条数</div>
            </div>
            <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;">${rounds.length}</div>
                <div style="font-size:11px;color:#888;">完整轮次</div>
            </div>
            <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;">${willSendCount}</div>
                <div style="font-size:11px;color:#888;">预计发送</div>
            </div>
        </div>
        <div style="font-size:12px;color:#777;margin-top:10px;line-height:1.5;">
            当前来源：${sourceText}${record && record.sourceUserName ? ` · 微信键：${escapeCoreMemoryHtml(record.sourceUserName)}` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
            <button type="button" class="btn btn-primary btn-small" id="short-memory-save-btn">保存短期上下文</button>
            <button type="button" class="btn btn-secondary btn-small" id="short-memory-add-round-btn">添加一轮</button>
            <button type="button" class="btn btn-secondary btn-small" id="short-memory-rebuild-btn">从界面记录重建</button>
            <button type="button" class="btn btn-secondary btn-small" id="short-memory-import-btn">导入微信短期记忆</button>
            <button type="button" class="btn btn-secondary btn-small" id="short-memory-export-btn">导出 chat_contexts</button>
            <button type="button" class="btn btn-danger btn-small" id="short-memory-clear-btn">清空发送给 AI 的短期记忆</button>
        </div>
    `;
    container.appendChild(overview);

    if (rounds.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'journal-card short-memory-empty';
        empty.style.cursor = 'default';
        empty.innerHTML = `
            <div style="font-size:14px;color:#777;line-height:1.6;">
                当前没有完整短期轮次。你可以导入微信 <code>chat_contexts.json</code>，或从界面聊天记录重建。
            </div>
        `;
        container.appendChild(empty);
        return;
    }

    rounds.forEach((round, index) => {
        const userText = round.user ? shortMemoryEditorText(round.user) : '';
        const aiText = round.ai ? shortMemoryEditorText(round.ai) : '';
        renderShortMemoryRoundCard(container, index, userText, aiText);
    });
}

function shortMemoryEditorText(item) {
    if (!item) return '';
    if (typeof getMessagePlainText === 'function') return getMessagePlainText(item);
    return String(item.content || '').trim();
}

function normalizeShortMemoryEditorItems(items) {
    if (typeof normalizeShortMemoryItems === 'function') return normalizeShortMemoryItems(items);
    return (items || []).filter(Boolean);
}

function renderShortMemoryRoundCard(container, index, userText = '', aiText = '') {
    const card = document.createElement('li');
    card.className = 'journal-card short-memory-round-card';
    card.dataset.roundIndex = String(index);
    card.style.cursor = 'default';
    card.innerHTML = `
        <div class="journal-card-header" style="align-items:center;">
            <div class="journal-card-title">第 ${index + 1} 轮</div>
            <button type="button" class="btn btn-danger btn-small short-memory-delete-round-btn">删除本轮</button>
        </div>
        <label style="display:block;font-size:12px;color:#777;margin:10px 0 4px;">用户发言</label>
        <textarea class="short-memory-user-input" rows="4" style="width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:8px;padding:8px;resize:vertical;">${escapeCoreMemoryHtml(userText)}</textarea>
        <label style="display:block;font-size:12px;color:#1976d2;margin:10px 0 4px;">AI 完整回复</label>
        <textarea class="short-memory-ai-input" rows="5" style="width:100%;box-sizing:border-box;border:1px solid #eee;border-radius:8px;padding:8px;resize:vertical;">${escapeCoreMemoryHtml(aiText)}</textarea>
    `;
    container.appendChild(card);
}

function handleShortMemoryPanelClick(event) {
    if (event.target.closest('#short-memory-save-btn')) {
        saveShortMemoryFromEditor();
    } else if (event.target.closest('#short-memory-add-round-btn')) {
        addShortMemoryRoundToEditor();
    } else if (event.target.closest('#short-memory-clear-btn')) {
        clearShortMemoryForCurrentChat();
    } else if (event.target.closest('#short-memory-rebuild-btn')) {
        rebuildShortMemoryFromCurrentHistory();
    } else if (event.target.closest('#short-memory-import-btn')) {
        const input = document.getElementById('short-memory-import-input');
        if (input) input.click();
    } else if (event.target.closest('#short-memory-export-btn')) {
        exportShortMemoryForCurrentChat();
    } else if (event.target.closest('.short-memory-delete-round-btn')) {
        const card = event.target.closest('.short-memory-round-card');
        if (card) {
            card.remove();
            renumberShortMemoryRoundCards();
            saveShortMemoryFromEditor({ silent: true });
        }
    }
}

function getShortMemoryEditorItems() {
    const cards = Array.from(document.querySelectorAll('.short-memory-round-card'));
    const items = [];
    cards.forEach(card => {
        const userText = (card.querySelector('.short-memory-user-input') || {}).value || '';
        const aiText = (card.querySelector('.short-memory-ai-input') || {}).value || '';
        if (userText.trim()) items.push({ role: 'user', content: userText.trim(), timestamp: Date.now() });
        if (aiText.trim()) items.push({ role: 'assistant', content: aiText.trim(), timestamp: Date.now() + 1 });
    });
    return items;
}

function renumberShortMemoryRoundCards() {
    Array.from(document.querySelectorAll('.short-memory-round-card')).forEach((card, index) => {
        card.dataset.roundIndex = String(index);
        const title = card.querySelector('.journal-card-title');
        if (title) title.textContent = `第 ${index + 1} 轮`;
    });
}

async function saveShortMemoryFromEditor(options = {}) {
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return;
    const currentRecord = getShortMemoryRecordSync(chatType, chatId);
    const sourceUserName = currentRecord && currentRecord.sourceUserName
        ? currentRecord.sourceUserName
        : (chatType === 'group' ? chat.name : (chat.wechatUserId || chat.myName || chat.remarkName || chat.realName || 'uwu'));
    const editedItems = getShortMemoryEditorItems();
    // 编辑器只展示发送窗口；保存时保留窗口外的历史，避免为了修正一条消息误删旧上下文。
    const maxItems = Math.max(1, parseInt(chat.maxMemory, 10) || 20);
    const hiddenItems = currentRecord && currentRecord.useShadowContext && Array.isArray(currentRecord.items)
        ? normalizeShortMemoryItems(currentRecord.items).slice(0, -maxItems)
        : [];
    await saveShortMemoryItemsForChat(chatType, chatId, hiddenItems.concat(editedItems), {
        chat,
        sourceUserName,
        useShadowContext: true
    });
    if (!options.silent) {
        showToast('短期上下文已保存，后续 AI 会按这里的内容读取');
        renderJournalList();
    }
}

function addShortMemoryRoundToEditor() {
    const container = document.getElementById('journal-list-container');
    if (!container) return;
    const index = document.querySelectorAll('.short-memory-round-card').length;
    renderShortMemoryRoundCard(container, index, '', '');
}

async function clearShortMemoryForCurrentChat() {
    if (!confirm('确定清空发送给 AI 的短期记忆吗？这不会删除聊天界面里的消息。')) return;
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return;
    await saveShortMemoryItemsForChat(chatType, chatId, [], {
        chat,
        sourceUserName: chatType === 'group' ? chat.name : (chat.wechatUserId || chat.myName || chat.remarkName || chat.realName || 'uwu'),
        useShadowContext: true
    });
    showToast('已清空发送给 AI 的短期记忆，界面聊天记录未删除');
    renderJournalList();
}

async function rebuildShortMemoryFromCurrentHistory() {
    if (!confirm('要用当前界面聊天记录重建发送给 AI 的短期记忆吗？')) return;
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return;
    const items = buildShortMemoryItemsFromHistory(chat, chatType);
    await saveShortMemoryItemsForChat(chatType, chatId, items, {
        chat,
        sourceUserName: chatType === 'group' ? chat.name : (chat.wechatUserId || chat.myName || chat.remarkName || chat.realName || 'uwu'),
        useShadowContext: true
    });
    showToast(`已重建 ${items.length} 条短期上下文`);
    renderJournalList();
}

async function importShortMemoryIntoCurrentChat(file) {
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return;
    try {
        const record = await importShortMemoryFile(file, chatType, chatId, {
            chat,
            characterName: chatType === 'group' ? chat.name : (chat.realName || chat.remarkName || chat.name)
        });
        showToast(`已导入 ${record.items.length} 条短期上下文`);
        memoryBankActiveTab = 'short';
        renderJournalList();
    } catch (error) {
        console.error('短期记忆导入失败:', error);
        showToast(error.message || '短期记忆导入失败');
    }
}

function exportShortMemoryForCurrentChat() {
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return;
    let record = getShortMemoryRecordSync(chatType, chatId);
    if (!record) {
        record = {
            sourceUserName: chatType === 'group' ? chat.name : (chat.wechatUserId || chat.myName || chat.remarkName || chat.realName || 'uwu'),
            items: buildShortMemoryItemsFromHistory(chat, chatType)
        };
    }
    const json = exportWechatShortMemoryJson(record, { mode: 'object' });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chat_contexts.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openCoreMemoryDetail(key) {
    const item = findCurrentCoreMemoryItem(key);
    if (!item) return;
    currentCoreMemoryDetailKey = key;

    const title = document.getElementById('journal-detail-title');
    const meta = document.getElementById('journal-detail-meta');
    const content = document.getElementById('journal-detail-content');
    if (title) title.textContent = `重要度 ${normalizeCoreMemoryImportance(item.importance)}`;
    if (meta) meta.textContent = `${item.timestamp || ''} | 关键词：${normalizeCoreMemoryKeywords(item.keywords || []).join('、') || '无'}`;
    if (content) content.textContent = item.summary || '';
    switchScreen('memory-journal-detail-screen');
}

async function deleteCurrentCoreMemoryItem() {
    if (!currentCoreMemoryDetailKey) return;
    const item = findCurrentCoreMemoryItem(currentCoreMemoryDetailKey);
    if (!item) return;
    if (!confirm('确定删除这条核心记忆吗？删除后不可恢复。')) return;
    const items = getCurrentCoreMemoryItems().filter(entry =>
        getCoreMemoryItemKey(entry) !== currentCoreMemoryDetailKey
    );
    await saveCurrentCoreMemoryItems(items);
    currentCoreMemoryDetailKey = null;
    switchScreen('memory-journal-screen');
    renderJournalList();
    showToast('核心记忆已删除');
}

function openCoreMemoryEditModal(item = null, itemKey = null) {
    const modal = document.getElementById('manual-journal-modal');
    const form = document.getElementById('manual-journal-form');
    const timestampInput = document.getElementById('manual-memory-timestamp');
    const importanceInput = document.getElementById('manual-memory-importance');
    const keywordInput = document.getElementById('manual-journal-title');
    const summaryInput = document.getElementById('manual-journal-content');
    if (!modal || !form) return;

    form.dataset.editKey = itemKey || '';
    if (timestampInput) timestampInput.value = item && item.timestamp ? item.timestamp : formatWechatTimestamp();
    if (importanceInput) importanceInput.value = item ? normalizeCoreMemoryImportance(item.importance) : 3;
    if (keywordInput) keywordInput.value = item ? normalizeCoreMemoryKeywords(item.keywords || []).join(', ') : '';
    if (summaryInput) summaryInput.value = item ? item.summary || '' : '';
    modal.classList.add('visible');
}

async function saveCoreMemoryFromManualForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const timestampInput = document.getElementById('manual-memory-timestamp');
    const importanceInput = document.getElementById('manual-memory-importance');
    const keywordInput = document.getElementById('manual-journal-title');
    const summaryInput = document.getElementById('manual-journal-content');
    const summary = summaryInput ? summaryInput.value.trim() : '';
    if (!summary) {
        showToast('记忆摘要不能为空');
        return;
    }

    const newItem = normalizeCoreMemoryEntry({
        timestamp: timestampInput && timestampInput.value.trim() ? timestampInput.value.trim() : formatWechatTimestamp(),
        summary,
        importance: importanceInput ? importanceInput.value : 3,
        keywords: normalizeCoreMemoryKeywords(keywordInput ? keywordInput.value : '', 20)
    }, { maxKeywords: 20 });

    const editKey = form.dataset.editKey || '';
    let items = getCurrentCoreMemoryItems();
    if (editKey) {
        items = items.map(item => getCoreMemoryItemKey(item) === editKey ? newItem : item);
    } else {
        items = mergeCoreMemoryItems(items, [newItem], 'append');
    }
    await saveCurrentCoreMemoryItems(items);
    document.getElementById('manual-journal-modal').classList.remove('visible');
    renderJournalList();
    showToast(editKey ? '核心记忆已更新' : '核心记忆已添加');
}

async function generateJournal(start, end, includeFavorited = false, silent = false, nodeInfo = null) {
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat || !Array.isArray(chat.history)) return;
    const startIndex = Math.max(0, (parseInt(start, 10) || 1) - 1);
    const endIndex = Math.min(chat.history.length, parseInt(end, 10) || chat.history.length);
    if (startIndex >= endIndex) {
        showToast('总结范围不正确');
        return;
    }

    generatingChatId = chatId;
    if (!silent) showToast('正在生成核心记忆...');
    renderJournalList();

    try {
        const messages = chat.history.slice(startIndex, endIndex)
            .filter(m => m && !m.isContextDisabled && !m.isThinking);
        const logs = messages.map(m => formatCoreMemoryMessageLine(chat, chatType, m)).filter(Boolean).join('\n');
        if (!logs.trim()) throw new Error('选定范围内没有可总结的消息。');

        const prompt = buildCoreMemorySummaryPrompt(chat, chatType, logs);
        const raw = await callCoreMemorySummaryApi(prompt);
        const entry = parseCoreMemorySummaryResponse(raw);
        if (!entry || !entry.summary) {
            showToast('这段聊天没有生成可保存的核心记忆');
            return;
        }
        if (nodeInfo && nodeInfo.nodeName) {
            entry.keywords = normalizeCoreMemoryKeywords([...(entry.keywords || []), nodeInfo.nodeName], 20);
        }
        await appendCoreMemoryEntry(chatType, chatId, entry);
        showToast('核心记忆已生成');
    } catch (error) {
        console.error('核心记忆生成失败:', error);
        if (typeof showApiError === 'function') showApiError(error);
        else showToast(error.message || '核心记忆生成失败');
    } finally {
        generatingChatId = null;
        renderJournalList();
    }
}

async function importCoreMemoryIntoCurrentChat(file) {
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    if (!chat) return;
    const existing = getCoreMemoryRecordSync(chatType, chatId);
    let mode = 'merge';
    if (existing && existing.items && existing.items.length > 0) {
        mode = confirm('检测到当前已有核心记忆。点击“确定”合并导入，点击“取消”覆盖现有记忆。') ? 'merge' : 'replace';
    }
    try {
        const result = await importCoreMemoryFile(file, chatType, chatId, { mode });
        renderJournalList();
        showToast(`已导入 ${result.importedCount} 条核心记忆`);
    } catch (error) {
        console.error('核心记忆导入失败:', error);
        showToast(error.message || '核心记忆导入失败');
    }
}

function exportCoreMemoryItems(items = null) {
    const { chatType, chatId } = getCurrentMemoryChat();
    if (!chatId) return;
    if (!items) {
        downloadCoreMemoryJson(chatType, chatId);
        return;
    }
    const blob = new Blob([exportWechatCoreMemoryJson(items)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `selected_core_memory_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function toggleCoreMemoryManageMode(active) {
    coreMemoryManageMode = active;
    selectedCoreMemoryKeys.clear();
    const manageBtn = document.getElementById('journal-manage-btn');
    const cancelBtn = document.getElementById('journal-cancel-manage-btn');
    const bar = document.getElementById('journal-multi-select-bar');
    if (manageBtn) manageBtn.style.display = active ? 'none' : 'flex';
    if (cancelBtn) cancelBtn.style.display = active ? 'inline-flex' : 'none';
    if (bar) bar.style.display = active ? 'flex' : 'none';
    renderJournalList();
}

function updateCoreMemoryMultiSelectBar() {
    const countEl = document.getElementById('journal-select-count');
    if (countEl) countEl.textContent = `已选 ${selectedCoreMemoryKeys.size} 条`;
}

function toggleCoreMemorySelectAll() {
    const keys = getCurrentCoreMemoryItems().map(getCoreMemoryItemKey);
    if (selectedCoreMemoryKeys.size === keys.length) {
        selectedCoreMemoryKeys.clear();
    } else {
        selectedCoreMemoryKeys = new Set(keys);
    }
    renderJournalList();
}

async function deleteSelectedCoreMemories() {
    if (selectedCoreMemoryKeys.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedCoreMemoryKeys.size} 条核心记忆吗？`)) return;
    const items = getCurrentCoreMemoryItems().filter(item => !selectedCoreMemoryKeys.has(getCoreMemoryItemKey(item)));
    await saveCurrentCoreMemoryItems(items);
    toggleCoreMemoryManageMode(false);
    showToast('已删除核心记忆');
}

function exportSelectedCoreMemories() {
    if (selectedCoreMemoryKeys.size === 0) return;
    const items = getCurrentCoreMemoryItems().filter(item => selectedCoreMemoryKeys.has(getCoreMemoryItemKey(item)));
    exportCoreMemoryItems(items);
}

async function mergeSelectedCoreMemories() {
    if (selectedCoreMemoryKeys.size < 2) {
        showToast('请至少选择 2 条核心记忆');
        return;
    }
    const items = getCurrentCoreMemoryItems();
    const selected = items.filter(item => selectedCoreMemoryKeys.has(getCoreMemoryItemKey(item)));
    const { chat, chatType, chatId } = getCurrentMemoryChat();
    try {
        const logs = selected.map(item => `${item.timestamp} | 重要度 ${item.importance} | ${item.summary}`).join('\n');
        const prompt = buildCoreMemorySummaryPrompt(chat, chatType, logs);
        const raw = await callCoreMemorySummaryApi(prompt);
        const merged = parseCoreMemorySummaryResponse(raw);
        const remaining = items.filter(item => !selectedCoreMemoryKeys.has(getCoreMemoryItemKey(item)));
        await saveCurrentCoreMemoryItems(mergeCoreMemoryItems(remaining, [merged], 'append'));
        toggleCoreMemoryManageMode(false);
        showToast('核心记忆已合并');
    } catch (error) {
        console.error('核心记忆合并失败:', error);
        if (typeof showApiError === 'function') showApiError(error);
    }
}

function escapeCoreMemoryHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

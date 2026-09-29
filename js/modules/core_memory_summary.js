// Automatic round-based summarization for core memories.

function getCoreMemorySummaryApiConfig() {
    if (db.summaryApiSettings && db.summaryApiSettings.url && db.summaryApiSettings.key && db.summaryApiSettings.model) {
        return db.summaryApiSettings;
    }
    return db.apiSettings || {};
}

function countCompletedCoreMemoryRounds(history) {
    return getCompletedCoreMemoryRounds(history).length;
}

function getCompletedCoreMemoryRounds(history) {
    const rounds = [];
    let pendingUsers = [];
    let pendingAssistants = [];

    const flush = () => {
        if (pendingUsers.length === 0 || pendingAssistants.length === 0) {
            pendingUsers = [];
            pendingAssistants = [];
            return;
        }
        const assistantText = pendingAssistants.map(message => getMessagePlainText(message)).join('\n').trim();
        if (assistantText && (!window.isShortMemoryAssistantReplyCountable || window.isShortMemoryAssistantReplyCountable(assistantText))) {
            rounds.push({
                users: pendingUsers.slice(),
                user: pendingUsers[pendingUsers.length - 1],
                ai: {
                    role: 'assistant',
                    content: assistantText,
                    parts: [{ type: 'text', text: assistantText }],
                    timestamp: pendingAssistants[pendingAssistants.length - 1].timestamp || Date.now()
                }
            });
        }
        pendingUsers = [];
        pendingAssistants = [];
    };

    (history || []).forEach(message => {
        if (!message || message.isContextDisabled || message.isThinking) return;
        if (message.role === 'user') {
            if (pendingUsers.length > 0 && pendingAssistants.length > 0) flush();
            pendingUsers.push(message);
            return;
        }

        const isAi = message.role === 'assistant' || message.role === 'char' || message.senderId;
        if (pendingUsers.length > 0 && isAi) {
            pendingAssistants.push(message);
        }
    });
    flush();

    return rounds;
}

function getCoreMemorySummaryRounds(chat, chatType) {
    if (chat && typeof getShortMemoryRoundsForChat === 'function') {
        return getShortMemoryRoundsForChat(chat, chatType);
    }
    return getCompletedCoreMemoryRounds(chat && chat.history ? chat.history : []);
}

function getCoreMemorySpeakerName(chat, chatType, message) {
    if (!message) return '未知';
    if (message.role === 'user') {
        return chatType === 'group'
            ? ((chat.me && chat.me.nickname) || '用户')
            : (chat.myName || '用户');
    }
    if (chatType === 'group' && message.senderId && Array.isArray(chat.members)) {
        const member = chat.members.find(m => m.id === message.senderId || m.originalCharId === message.senderId);
        return (member && (member.groupNickname || member.realName)) || '群成员';
    }
    return chat.realName || chat.name || 'AI';
}

function stripWechatLeadingChatTimestamp(text) {
    return String(text || '')
        .replace(/^\[\d{4}-\d{2}-\d{2}(?: [A-Za-z]+)? \d{2}:\d{2}(?::\d{2})?\]\s*/, '')
        .trim();
}

function stripCoreMemoryDisplayWrapper(text) {
    const raw = String(text || '').trim();
    const bracketMatch = raw.match(/^\[(?:unknown|.+?)的消息[：:]([\s\S]*?)\]$/);
    if (bracketMatch) return bracketMatch[1].trim();
    const plainMatch = raw.match(/^(?:unknown|.+?)的消息[：:]([\s\S]*)$/);
    if (plainMatch) return plainMatch[1].trim();
    return raw;
}

function getWechatPromptNameForSummary(chat, chatType) {
    if (!chat) return chatType === 'group' ? 'group' : 'solo';
    if (chatType === 'group') return chat.name || 'group';
    const record = typeof getCoreMemoryRecordSync === 'function' ? getCoreMemoryRecordSync(chatType, chat.id) : null;
    if (record && record.wechatPromptName) return record.wechatPromptName;
    if (chat.wechatPromptName) return chat.wechatPromptName;
    const sourceFileName = record && record.sourceFileName ? record.sourceFileName : '';
    const match = sourceFileName.match(/^[^_]+_(.+?)_core_memory\.json$/i);
    if (match) return match[1];
    return chat.realName || chat.remarkName || 'solo';
}

function getWechatUserNameForSummary(chat, chatType) {
    if (!chat) return chatType === 'group' ? 'group' : 'user';
    if (chatType === 'group') return chat.name || 'group';
    const record = typeof getCoreMemoryRecordSync === 'function' ? getCoreMemoryRecordSync(chatType, chat.id) : null;
    if (record && record.wechatUserId) return record.wechatUserId;
    if (chat.wechatUserId) return chat.wechatUserId;
    const sourceFileName = record && record.sourceFileName ? record.sourceFileName : '';
    const match = sourceFileName.match(/^([^_]+)_.+?_core_memory\.json$/i);
    if (match) return match[1];
    return chat.myName || 'user';
}

function formatCoreMemoryMessageLine(chat, chatType, message) {
    const text = getMessagePlainText(message).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const parsed = text.match(/^\[(\d{4}-\d{2}-\d{2}(?: [A-Za-z]+)? \d{2}:\d{2}(?::\d{2})?)\]\s*([\s\S]*)$/);
    const body = stripCoreMemoryDisplayWrapper(parsed ? parsed[2].trim() : text);
    if (!body) return '';
    const time = parsed
        ? parsed[1]
        : (message.timestamp && typeof formatWechatChatTimestamp === 'function'
            ? formatWechatChatTimestamp(new Date(message.timestamp))
            : (typeof formatWechatChatTimestamp === 'function' ? formatWechatChatTimestamp() : formatWechatTimestamp()));
    const speaker = message.role === 'user'
        ? getWechatUserNameForSummary(chat, chatType)
        : getWechatPromptNameForSummary(chat, chatType);
    return `${time} | [${speaker}] ${body}`;
}

function buildCoreMemorySummaryLogs(chat, chatType, rounds) {
    const lines = [];
    rounds.forEach(round => {
        const users = Array.isArray(round.users) && round.users.length > 0 ? round.users : [round.user];
        users.forEach(userMessage => {
            const userLine = formatCoreMemoryMessageLine(chat, chatType, userMessage);
            if (userLine) lines.push(userLine);
        });
        const aiLine = formatCoreMemoryMessageLine(chat, chatType, round.ai);
        if (aiLine) lines.push(aiLine);
    });
    return lines.join('\n');
}

const WECHAT_MEMORY_KEYWORD_STOPWORDS_EXTRA = [
    '朱迅', '司洛', '宝宝', '老公', '老婆', '傻瓜', '笨蛋', '傻子', '小祖宗', '祖宗',
    '小管家婆', '管家婆', '哥', '小妖精', '怀里', '卧槽', '抱', '抱抱', '抱着',
    '抱着你', '东西', 'mua'
];

const WECHAT_MEMORY_SUMMARY_PROMPT_TEMPLATE = `你将扮演“\${PROMPT_NAME}”。请根据以下完整对话日志生成一条核心记忆，并严格只输出一个 JSON 对象。
输出格式（严格遵守，仅输出 JSON）：
{"summary":"...","keywords":["...","..."],"importance":3}
要求：
1) summary：请以司洛的口吻，第一视角写日记流水账，用中文总结与用户朱迅的对话，总结为记忆摘要，不能遗漏细节。
2) summary：必须保留所有事件细节（人物、关系、地点、时间、事件、起因、经过、结果、承诺、冲突、礼物/物品、安排），不要分点，不要换行。
3) keywords：必须从“对话日志原文”中直接抽取的实词/名词短语（禁止编造、禁止推断、禁止遗漏），10~20 个。
   - 必须能让人“通过几个词回想起这段对话”的核心点。
   - 若原文存在以下类别，且为当前对话的核心剧情点，则至少各保留一个。
     人物/特殊称谓/符号、事件/关键事件动词、地点/关键物品/事物/功能、承诺/计划/关系变化等在上下文语境中重要且含有具体意义的实词
   - 情绪词允许保留，但仅限“与事件直接相关的强情绪”，最多 1~2 个（如：崩溃、恐惧、心疼、委屈、愧疚）。
   - 重要实词名词优先于动词、情绪词。
4) keywords：过滤无意义词（如“的、了、是、我们、你、我、他、哥”等），过滤常规亲密称呼
   （如“宝宝、老公、老婆、小傻瓜”等，**除非该称呼在本段中作为身份标识或剧情关键点**）。
   过滤纯数字、编号、时间、年龄等纯数字信息，只保留带具体意义且是剧情关键点的数字信息
   （如“去年七月”“520元”“八岁”“三天后”）。
   过滤空泛词：例如“事情、感觉、想法、问题、东西、时候、怎么、这样”。
5) keywords长度规则：
   - 优选 1~4 个字符；偶尔允许 1~5；
   - 过长（>3字符）必须进行词语拆分成两个或以上的单个词语组成
5) importance：1-5 的整数。请严格按照评分规则进行评分：
\${IMPORTANCE_RULES}
6) 如有额外过滤词，请一并排除：\${EXTRA_FILTERS}
7) 只允许输出 JSON，不要任何解释、标题或多余文字。

示例（仅示例格式，不要照抄内容）：
对话里出现“礼物、游乐园、吵架”，关键词应为 ["礼物","游乐园","吵架"] 这类实词。

对话日志：
\${FULL_LOGS}`;

const WECHAT_MEMORY_IMPORTANCE_PROMPT_TEMPLATE = `请根据以下“记忆摘要”给出重要性评分，严格只输出 1-5 的单个数字。
评分标准：
5 = 长期关键：人物关系发生重大变化、明确承诺/誓言、重要计划/目标、核心设定、重大事件、资产/金钱/住址/身份等硬信息
4 = 明显重要：新增或改变的长期偏好/习惯/边界、持续性进展、会影响后续互动的事实
3 = 一般重要：可作为背景回忆但不影响关系走向；中等细节（如一次普通争执/短期决定/一般性进展）
2 = 轻度琐事：仅对当天/短期有意义、可丢弃、不影响后续（寒暄、日常琐事）
1 = 无信息/重复：空洞、纯重复、无可保存价值
避免所有分数都给3、4、5，需要自行合理判断分数。要合理分配分数给2或1
记忆摘要：
\${SUMMARY}`;

function normalizeCoreMemoryStopwordsExtra(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
        .split(/[,\n，、;；|/]+/)
        .map(item => item.trim())
        .filter(Boolean);
}

function getCoreMemoryPromptSettings(chat, chatType) {
    const record = chat && chat.id && typeof getCoreMemoryRecordSync === 'function'
        ? getCoreMemoryRecordSync(getCoreMemoryChatType(chatType), chat.id)
        : null;
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record && record.settings ? record.settings : {});
    const summaryPromptTemplate = String(settings.memorySummaryPromptTemplate || '').trim()
        ? settings.memorySummaryPromptTemplate
        : WECHAT_MEMORY_SUMMARY_PROMPT_TEMPLATE;
    const importancePromptTemplate = String(settings.memoryImportancePromptTemplate || '').trim()
        ? settings.memoryImportancePromptTemplate
        : WECHAT_MEMORY_IMPORTANCE_PROMPT_TEMPLATE;
    const keywordStopwordsExtra = settings.memoryKeywordStopwordsExtra === null || settings.memoryKeywordStopwordsExtra === undefined
        ? WECHAT_MEMORY_KEYWORD_STOPWORDS_EXTRA.slice()
        : normalizeCoreMemoryStopwordsExtra(settings.memoryKeywordStopwordsExtra);

    return {
        summaryPromptTemplate,
        importancePromptTemplate,
        keywordStopwordsExtra
    };
}

function getWechatMemoryImportanceRules(importancePromptTemplate = WECHAT_MEMORY_IMPORTANCE_PROMPT_TEMPLATE) {
    let importanceRules = String(importancePromptTemplate || '').replace('${SUMMARY}', '').trim();
    const idx = importanceRules.indexOf('记忆摘要');
    if (idx !== -1) {
        importanceRules = importanceRules.slice(0, idx).trimEnd();
    }
    return importanceRules || '请按 1-5 评分，避免所有都给 5，不确定给 3。';
}

function buildCoreMemorySummaryPrompt(chat, chatType, logs) {
    const promptName = getWechatPromptNameForSummary(chat, chatType);
    const promptSettings = getCoreMemoryPromptSettings(chat, chatType);
    const extraFilters = promptSettings.keywordStopwordsExtra.join('、') || '无';
    const importanceRules = getWechatMemoryImportanceRules(promptSettings.importancePromptTemplate);
    let summaryPromptTemplate = String(promptSettings.summaryPromptTemplate || '').trim()
        ? promptSettings.summaryPromptTemplate
        : WECHAT_MEMORY_SUMMARY_PROMPT_TEMPLATE;

    if (!summaryPromptTemplate.includes('${FULL_LOGS}')) {
        summaryPromptTemplate = `${summaryPromptTemplate.trimEnd()}\n\n对话日志：\n\${FULL_LOGS}`;
    }
    if (summaryPromptTemplate.includes('${IMPORTANCE_RULES}')) {
        summaryPromptTemplate = summaryPromptTemplate.replace('${IMPORTANCE_RULES}', importanceRules);
    } else {
        summaryPromptTemplate = `${summaryPromptTemplate.trimEnd()}\n\n重要性评分规则（importance 1-5）：\n${importanceRules}`;
    }
    if (!summaryPromptTemplate.includes('"importance"')) {
        summaryPromptTemplate = `${summaryPromptTemplate.trimEnd()}\n\n输出 JSON 需包含字段：summary、keywords、importance（1-5 整数）。`;
    }

    return summaryPromptTemplate
        .replace('${PROMPT_NAME}', String(promptName))
        .replace('${FULL_LOGS}', String(logs))
        .replace('${EXTRA_FILTERS}', extraFilters);
}

function parseCoreMemorySummaryResponse(rawContent) {
    const text = String(rawContent || '').trim();
    if (!text) throw new Error('核心记忆总结返回为空。');

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced ? fenced[1].trim() : (text.match(/\{[\s\S]*\}/) || [text])[0];

    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (error) {
        throw new Error('核心记忆总结没有返回有效 JSON。');
    }

    return normalizeCoreMemoryEntry({
        timestamp: formatWechatTimestamp(),
        summary: parsed.summary || parsed.content || '',
        importance: parsed.importance,
        keywords: normalizeCoreMemoryKeywords(parsed.keywords || [], 20)
    }, { maxKeywords: 20 });
}

async function callCoreMemorySummaryApi(prompt) {
    const apiConfig = getCoreMemorySummaryApiConfig();
    let { url, key, model, provider } = apiConfig;
    if (!url || !key || !model) {
        throw new Error('API 设置不完整，无法生成核心记忆。');
    }
    if (url.endsWith('/')) url = url.slice(0, -1);

    key = getRandomValue(key);
    provider = provider || 'openai';

    if (provider === 'gemini') {
        const endpoint = `${url}/v1beta/models/${model}:generateContent?key=${key}`;
        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6 }
        };
        const headers = { 'Content-Type': 'application/json' };
        return await fetchAiResponse(apiConfig, requestBody, headers, endpoint, false);
    }

    const endpoint = `${url}/v1/chat/completions`;
    const requestBody = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6
    };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
    return await fetchAiResponse(apiConfig, requestBody, headers, endpoint, false);
}

async function summarizeCoreMemoryRounds(chat, chatType, rounds, options = {}) {
    if (!chat || !chat.id || !Array.isArray(rounds) || rounds.length === 0) {
        if (!options.silent && typeof showToast === 'function') showToast('没有可总结的完整对话轮次');
        return null;
    }

    const normalizedType = getCoreMemoryChatType(chatType);
    const record = await ensureCoreMemoryRecord(normalizedType, chat.id, { chat });
    if (record.summaryInProgress) {
        if (!options.silent && typeof showToast === 'function') showToast('核心记忆正在总结中');
        return null;
    }

    const logs = buildCoreMemorySummaryLogs(chat, normalizedType, rounds);
    if (!logs.trim()) {
        if (!options.silent && typeof showToast === 'function') showToast('没有可总结的聊天内容');
        return null;
    }

    record.summaryInProgress = true;
    await saveCoreMemoryRecord(record);

    try {
        const prompt = buildCoreMemorySummaryPrompt(chat, normalizedType, logs);
        const rawContent = await callCoreMemorySummaryApi(prompt);
        const entry = parseCoreMemorySummaryResponse(rawContent);

        record.summaryInProgress = false;
        if (options.updateCursor !== false) {
            record.lastSummarizedRound = Math.max(0, parseInt(options.currentRoundCount, 10) || rounds.length);
        }
        if (entry && entry.summary) {
            record.items = mergeCoreMemoryItems(record.items || [], [entry], 'append');
            cleanupCoreMemoryArchive(record);
        }
        await saveCoreMemoryRecord(record);

        if (entry && entry.summary && !options.silent && typeof showToast === 'function') {
            showToast(options.manual ? '手动核心记忆总结完成' : '核心记忆已更新');
        }
        return entry;
    } catch (error) {
        record.summaryInProgress = false;
        await saveCoreMemoryRecord(record);
        console.error(options.manual ? '核心记忆手动总结失败:' : '核心记忆自动总结失败:', error);
        if (!options.silent) {
            if (typeof showApiError === 'function') showApiError(error);
            else if (typeof showToast === 'function') showToast(error.message || '核心记忆总结失败');
        }
        return null;
    }
}

async function forceSummarizeCoreMemory(chat, chatType, options = {}) {
    if (!chat || !chat.id) return null;
    const normalizedType = getCoreMemoryChatType(chatType);
    const record = await ensureCoreMemoryRecord(normalizedType, chat.id, { chat });
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record.settings || {});
    const windowSize = Math.max(1, parseInt(options.windowSize || settings.maxChatRoundEntries, 10) || 12);
    const rounds = getCoreMemorySummaryRounds(chat, normalizedType);
    if (rounds.length === 0) {
        if (typeof showToast === 'function') showToast('当前没有完整对话轮次可总结');
        return null;
    }
    const roundsToSummarize = rounds.slice(Math.max(0, rounds.length - windowSize));
    return await summarizeCoreMemoryRounds(chat, normalizedType, roundsToSummarize, {
        manual: true,
        updateCursor: options.updateCursor !== false,
        currentRoundCount: rounds.length,
        silent: options.silent
    });
}

async function checkAndTriggerCoreMemorySummary(chat, chatType) {
    if (!chat || !chat.id || !Array.isArray(chat.history)) return;
    if (typeof isGenerating !== 'undefined' && isGenerating) return;

    const normalizedType = getCoreMemoryChatType(chatType);
    const record = await ensureCoreMemoryRecord(normalizedType, chat.id, { chat });
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record.settings || {});
    if (!settings.enabled || !settings.autoSummaryByRound) return;
    if (record.summaryInProgress) return;

    const rounds = getCoreMemorySummaryRounds(chat, normalizedType);
    const currentRoundCount = rounds.length;
    const lastRound = Math.max(0, parseInt(record.lastSummarizedRound, 10) || 0);
    const interval = Math.max(1, parseInt(settings.maxChatRoundEntries, 10) || 12);

    if (currentRoundCount - lastRound < interval) return;

    const roundsToSummarize = rounds.slice(Math.max(0, currentRoundCount - interval));
    await summarizeCoreMemoryRounds(chat, normalizedType, roundsToSummarize, {
        updateCursor: true,
        currentRoundCount,
        silent: false
    });
}

if (typeof window !== 'undefined') {
    window.checkAndTriggerCoreMemorySummary = checkAndTriggerCoreMemorySummary;
    window.countCompletedCoreMemoryRounds = countCompletedCoreMemoryRounds;
    window.getCompletedCoreMemoryRounds = getCompletedCoreMemoryRounds;
    window.buildCoreMemorySummaryLogs = buildCoreMemorySummaryLogs;
    window.buildCoreMemorySummaryPrompt = buildCoreMemorySummaryPrompt;
    window.callCoreMemorySummaryApi = callCoreMemorySummaryApi;
    window.parseCoreMemorySummaryResponse = parseCoreMemorySummaryResponse;
    window.getCoreMemorySummaryRounds = getCoreMemorySummaryRounds;
    window.forceSummarizeCoreMemory = forceSummarizeCoreMemory;
    window.summarizeCoreMemoryRounds = summarizeCoreMemoryRounds;
    window.WECHAT_MEMORY_KEYWORD_STOPWORDS_EXTRA = WECHAT_MEMORY_KEYWORD_STOPWORDS_EXTRA;
    window.WECHAT_MEMORY_SUMMARY_PROMPT_TEMPLATE = WECHAT_MEMORY_SUMMARY_PROMPT_TEMPLATE;
    window.WECHAT_MEMORY_IMPORTANCE_PROMPT_TEMPLATE = WECHAT_MEMORY_IMPORTANCE_PROMPT_TEMPLATE;
    window.normalizeCoreMemoryStopwordsExtra = normalizeCoreMemoryStopwordsExtra;
    window.getCoreMemoryPromptSettings = getCoreMemoryPromptSettings;
}

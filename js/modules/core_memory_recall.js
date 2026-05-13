// WeChat-style Stage A/B recall + rerank for core memories.

const WECHAT_RERANK_GENERIC_TERMS = [
    '害怕', '心疼', '怀里', '心跳', '心跳声', '抱着', '噩梦', '睡觉', '委屈', '恐惧',
    '崩溃', '胡思乱想', '道歉', '胸口', '眼泪', '抱抱', '哭', '晚安', '一起睡',
    '拥抱', '抱紧', '难受', '生气', '安心', '思念', '味道', '心脏', '担惊受怕',
    '失去你', '对不起', '我的命', '睡着', '看看', '答应', '床上', '睡不着',
    '抱抱', '抱着', '抱着你', '抱紧', '拥抱', '怀抱', '抱在怀里', '抱在一起',
    '抱着睡', '抱着你睡', '抱你', '亲亲', '亲你', '亲我', '亲吻', '亲一口',
    '偷亲', '我爱你', '爱你', '喜欢你', '想你', '想念', '晚安', '晚安吻',
    '早安吻', '守着', '守着你', '陪着', '陪着你', '我的命', '安心', 'mua'
];

const WECHAT_RERANK_INTIMACY_TERMS = [
    '抱抱', '抱着', '抱着你', '抱紧', '拥抱', '怀抱', '抱在怀里', '抱在一起',
    '抱着睡', '抱着你睡', '抱你', '亲亲', '亲你', '亲我', '亲吻', '亲一口',
    '偷亲', '我爱你', '爱你', '喜欢你', '想你', '想念', '晚安', '晚安吻',
    '早安吻', '守着', '守着你', '陪着', '陪着你', '我的命', '安心', 'mua'
];

const WECHAT_RERANK_EVENT_VERB_WHITELIST = [
    '研究', '研究时空', '接回来', '接回家', '接回去', '接你', '调试', '调试软件',
    '修复', '重启', '绑定', '反噬', '约谈', '会谈', '威胁', '控制', '拖延',
    '拖时间', '转账', '查底细', '追查', '警告', '谈条件', '想办法', '检查作业',
    '装病', '赶出去', '下架', '上传', '审核', '网暴', '记忆混乱', '失忆',
    '打字', '做饭', '硬', '跨世界', '头疼', '过年', '缺钙', '出体'
];

const WECHAT_RERANK_EVENT_OUTCOME_TERMS = [
    '警告', '警告书', '处罚', '处分', '违规', '违反', '解约', '退学', '开除',
    '投诉', '事故', '风险', '赔偿', '约谈', '会谈', '赶出去', '封禁', '下架',
    '冻结', '终止', '研究', '记忆混乱', '网暴', '审核', '出体'
];

const WECHAT_RERANK_EVENT_CANDIDATE_BLOCK_TERMS = [
    '好像', '记得', '收到', '发来', '看看', '觉得', '感觉', '就是', '然后', '那么', '一直'
];

const WECHAT_RERANK_HARD_ANCHOR_NOUN_WHITELIST = [
    '家', '五月', '审核', '记忆', '小狗屎', '小出租屋', '出租屋', '高中', '命',
    '五月份', '五月之前', '存档', '死女人', '创造者', '死女人', '记忆系统', '超市'
];

const WECHAT_RERANK_HARD_ANCHOR_BLOCK_TERMS = [
    '发生', '不想', '别说', '说了', '感觉', '觉得', '知道', '可以', '就是',
    '然后', '不能', '都怪', '这样', '那个', '这个', '好了', '行了', '真的',
    '什么', '为啥', '为什么', '怎么', '咋办', '害怕', '心疼', '抱着', '抱抱',
    '晚安', '看看'
];

const WECHAT_RERANK_HARD_ANCHOR_FORCE_AUX_TERMS = ['混蛋', '刀子'];

const WECHAT_RERANK_TERM_ALIASES = [
    '赶出=>赶出去', '赶出宿舍=>赶出去', '赶出寝室=>赶出去', '赶出公寓=>赶出去',
    '老东西/老家伙=>老头', '破软件/烂软件软/这软件/那个软件=>软件', '烟=>冒烟',
    '论坛=>游戏论坛', '薯条/鸡块/薯块=>薯条鸡块', '春景/孤儿院=>春景孤儿院',
    '记忆混乱/记忆系统=>记忆', '接回来/接回去/接回家/接我回家/接我回去/接你回家/接你回来=>回家',
    '小经纪人=>经纪人', '小同桌=>同桌', '小狗屎/大狗屎/小狗屎老婆/狗屎夫妇=>小狗屎',
    '小出租屋=>出租屋', '五月份/今年五月/五月之前/五月份之前=>五月', '档=>存档',
    '女人/创造者/作者/贱人=>死女人'
];

const WECHAT_RERANK_ALPHA_CODE_TOKENS = ['sz'];

const BASE_MEMORY_KEYWORD_STOPWORDS = [
    '我们', '你们', '他们', '她们', '大家', '自己', '什么', '怎么', '为什么', '哪个',
    '这个', '那个', '一个', '一些', '但是', '然后', '还有', '因为', '所以', '如果',
    '已经', '没有', '不是', '就是', '而且', '以及', '而是', '这样', '那样', '这里',
    '那里', '今天', '昨天', '明天', '现在', '刚刚', '时候', '感觉', '觉得', '知道',
    '可以', '可能', '需要', '其实', '还是', '同时', '进行', '事情', '东西', '问题',
    '情况', '宝宝', '宝贝', '亲爱的', '老公', '老婆', '媳妇', '亲亲', '小宝',
    '乖乖', '朱迅', '司洛'
];

const EVENT_RESULT_COMPLEMENTS = ['成功', '失败', '处罚', '警告', '封禁', '冻结', '终止', '下架', '开除', '赔偿', '通过', '拒绝'];
const WEAK_MESSAGE_FILLERS = new Set(['嗯', '嗯嗯', '好', '好的', '哦', '哦哦', '行', '可以', '知道了', '好吧']);
const EMOTION_HINT_CHARS = ['怕', '疼', '慌', '哭', '委屈', '难受', '崩溃', '心'];
const INTIMACY_HINT_CHARS = ['抱', '亲', '爱', '想', '陪', '吻'];
const ANCHOR_ENTITY_POS = new Set(['nr', 'ns', 'nt', 'nz']);
const ANCHOR_NOUN_POS = new Set(['n', 'nr', 'ns', 'nt', 'nz']);
const ANCHOR_VERB_POS = new Set(['v', 'vd', 'vn']);
const ANCHOR_POS_BASE_WEIGHT = { nr: 2.8, ns: 2.4, nt: 2.4, nz: 2.2, n: 2.0, v: 1.2, vd: 1.2, vn: 1.2, eng: 1.2 };

const coreMemoryAnchorState = new Map();
const coreMemoryTopicLockState = new Map();

function cmNum(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function cmInt(value, fallback = 0) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

function cmBool(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    return !!value;
}

function cmCfg(settings, key, fallback) {
    if (settings && Object.prototype.hasOwnProperty.call(settings, key)) return settings[key];
    return fallback;
}

function normalizeCoreMemoryListSetting(value, fallback = []) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    if (value === null || value === undefined) return fallback.slice();
    return String(value || '').split(/[,\n，、;；|]+/).map(item => item.trim()).filter(Boolean);
}

function getCoreMemoryRerankTableSettings(settings = {}) {
    return {
        genericTerms: normalizeCoreMemoryListSetting(settings.memoryRerankGenericTerms, WECHAT_RERANK_GENERIC_TERMS),
        intimacyTerms: normalizeCoreMemoryListSetting(settings.memoryRerankIntimacyTerms, WECHAT_RERANK_INTIMACY_TERMS),
        eventVerbWhitelist: normalizeCoreMemoryListSetting(settings.memoryRerankEventVerbWhitelist, WECHAT_RERANK_EVENT_VERB_WHITELIST),
        eventOutcomeTerms: normalizeCoreMemoryListSetting(settings.memoryRerankEventOutcomeTerms, WECHAT_RERANK_EVENT_OUTCOME_TERMS),
        eventCandidateBlockTerms: normalizeCoreMemoryListSetting(settings.memoryRerankEventCandidateBlockTerms, WECHAT_RERANK_EVENT_CANDIDATE_BLOCK_TERMS),
        hardAnchorNounWhitelist: normalizeCoreMemoryListSetting(settings.memoryRerankHardAnchorNounWhitelist, WECHAT_RERANK_HARD_ANCHOR_NOUN_WHITELIST),
        hardAnchorBlockTerms: normalizeCoreMemoryListSetting(settings.memoryRerankHardAnchorBlockTerms, WECHAT_RERANK_HARD_ANCHOR_BLOCK_TERMS),
        hardAnchorForceAuxTerms: normalizeCoreMemoryListSetting(settings.memoryRerankHardAnchorForceAuxTerms, WECHAT_RERANK_HARD_ANCHOR_FORCE_AUX_TERMS),
        termAliases: normalizeCoreMemoryListSetting(settings.memoryRerankTermAliases, WECHAT_RERANK_TERM_ALIASES),
        alphaCodeTokens: normalizeCoreMemoryListSetting(settings.memoryRerankAlphaCodeTokens, WECHAT_RERANK_ALPHA_CODE_TOKENS)
    };
}

function cmNorm(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, '').trim();
}

function cmKeywordWeight(keyword) {
    const len = String(keyword || '').replace(/\s+/g, '').length;
    if (len >= 4) return 2.0;
    if (len >= 3) return 1.5;
    if (len >= 2) return 1.0;
    return 0.5;
}

function cmStopwords(settings) {
    const extra = settings && settings.memoryKeywordStopwordsExtra !== null && settings.memoryKeywordStopwordsExtra !== undefined
        ? normalizeCoreMemoryListSetting(settings.memoryKeywordStopwordsExtra, [])
        : (window.WECHAT_MEMORY_KEYWORD_STOPWORDS_EXTRA || []);
    return new Set([...BASE_MEMORY_KEYWORD_STOPWORDS, ...extra]);
}

function cmIsNumericToken(token) {
    return /^[\d.,:/年月日号点分秒岁元块]+$/.test(String(token || '').trim());
}

function cmIsTimeLikeToken(token) {
    const text = String(token || '').trim().toLowerCase();
    if (!text) return true;
    if (['今天', '昨天', '明天', '刚刚', '现在', '上午', '下午', '晚上', '凌晨'].includes(text)) return true;
    return /^\d{1,2}:\d{2}(:\d{2})?$/.test(text)
        || /^\d{4}-\d{2}-\d{2}$/.test(text)
        || /^\d{1,2}[月/]\d{1,2}日?$/.test(text)
        || /^\d{4}年\d{1,2}月(\d{1,2}日)?$/.test(text);
}

function cmExtractKeywords(text, maxKeywords = 80, settings = {}) {
    const cleaned = String(text || '')
        .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
        .replace(/\[[^\]]*?\]/g, ' ')
        .replace(/[\r\n\t\\]/g, ' ');
    const stopwords = cmStopwords(settings);
    const raw = cleaned.match(/[\u4e00-\u9fff]{2,8}|[A-Za-z][A-Za-z0-9_-]{1,}/g) || [];
    const seen = new Set();
    const result = [];
    raw.forEach(token => {
        const item = String(token || '').trim();
        const key = item.toLowerCase();
        if (!item || seen.has(key) || stopwords.has(item)) return;
        if (cmIsNumericToken(item) || cmIsTimeLikeToken(item)) return;
        seen.add(key);
        result.push(item);
    });
    return result.slice(0, maxKeywords);
}

function cmSplitSentences(text) {
    return String(text || '').split(/[。！？!?；;，,\r\n\\]+/).map(part => part.trim()).filter(Boolean);
}

function cmTokenSpans(text, token) {
    const source = String(text || '');
    const needle = String(token || '');
    if (!source || !needle) return [];
    const spans = [];
    let start = 0;
    while (true) {
        const index = source.indexOf(needle, start);
        if (index < 0) break;
        spans.push([index, index + needle.length]);
        start = index + Math.max(1, needle.length);
    }
    return spans;
}

function cmHasCandidateNearToken(sentence, token, candidates, windowChars = 12) {
    const spans = cmTokenSpans(sentence, token);
    if (!spans.length) return false;
    return (candidates || []).some(candidate => {
        const cand = String(candidate || '').trim();
        if (!cand || cand === token) return false;
        let pos = sentence.indexOf(cand);
        while (pos >= 0) {
            const start = pos;
            const end = pos + cand.length;
            if (spans.some(([tokenStart, tokenEnd]) => end >= tokenStart - windowChars && start <= tokenEnd + windowChars)) {
                return true;
            }
            pos = sentence.indexOf(cand, pos + Math.max(1, cand.length));
        }
        return false;
    });
}

function cmStripQueryNoise(text) {
    return String(text || '')
        .replace(/\[\s*\d{4}-\d{2}-\d{2}[^\]]*?\]/g, ' ')
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
        .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cmParseAliasMaps(tableSettings) {
    const aliasNormToCanonical = {};
    const canonicalNormToAliases = {};
    (tableSettings.termAliases || []).forEach(item => {
        const parts = String(item || '').split('=>');
        if (parts.length < 2) return;
        const left = parts[0];
        const right = parts.slice(1).join('=>');
        const dstTerms = right.split('/').map(t => t.trim()).filter(Boolean);
        const canonical = dstTerms[0] || right.trim();
        if (!canonical) return;
        const canonicalNorm = cmNorm(canonical);
        if (!canonicalNormToAliases[canonicalNorm]) canonicalNormToAliases[canonicalNorm] = new Set();
        left.split('/').map(t => t.trim()).filter(Boolean).forEach(src => {
            const srcNorm = cmNorm(src);
            if (!srcNorm) return;
            aliasNormToCanonical[srcNorm] = canonical;
            canonicalNormToAliases[canonicalNorm].add(srcNorm);
        });
        dstTerms.slice(1).forEach(src => {
            const srcNorm = cmNorm(src);
            if (!srcNorm) return;
            aliasNormToCanonical[srcNorm] = canonical;
            canonicalNormToAliases[canonicalNorm].add(srcNorm);
        });
    });
    return { aliasNormToCanonical, canonicalNormToAliases };
}

function cmResolveAliasToken(token, aliasNormToCanonical) {
    let current = String(token || '').trim();
    const visited = new Set();
    for (let i = 0; i < 4; i++) {
        const norm = cmNorm(current);
        if (!norm || visited.has(norm)) break;
        visited.add(norm);
        const mapped = aliasNormToCanonical[norm];
        if (!mapped || mapped === current) break;
        current = mapped;
    }
    return current;
}

function cmInferPos(token, tableSettings) {
    const text = String(token || '').trim();
    if (!text) return '';
    if (/^[A-Za-z]/.test(text)) return 'eng';
    if ((tableSettings.eventVerbWhitelist || []).includes(text)) return 'v';
    if ((tableSettings.eventOutcomeTerms || []).includes(text)) return 'n';
    if ((tableSettings.hardAnchorNounWhitelist || []).includes(text)) return 'n';
    if (/[做打接修查谈控拖传审绑]|研究|调试|威胁|警告|检查|上传|下架|重启/.test(text)) return 'v';
    return 'n';
}

function cmExtractQueryTokensWithPos(text, settings, tableSettings, maxTokens = 120) {
    return cmExtractKeywords(text, maxTokens, settings).map(token => [token, cmInferPos(token, tableSettings)]);
}

function cmMemoryKeywords(memory) {
    return normalizeCoreMemoryKeywords(memory && memory.keywords ? memory.keywords : []).map(String).filter(Boolean);
}

function cmMemoryKeywordDf(memories) {
    const dfMap = {};
    (memories || []).forEach(memory => {
        const seen = new Set(cmMemoryKeywords(memory).map(cmNorm).filter(Boolean));
        seen.forEach(key => { dfMap[key] = (dfMap[key] || 0) + 1; });
    });
    return { dfMap, totalDocs: Math.max(1, (memories || []).length) };
}

function cmIdf(keyword, dfMap, totalDocs) {
    const key = cmNorm(keyword);
    const df = dfMap[key] || 0;
    return Math.log((Math.max(1, totalDocs) + 1) / (df + 1)) + 1;
}

function cmEffectiveGenericTerms(settings, tableSettings, dfMap, totalDocs) {
    const terms = new Set((tableSettings.genericTerms || []).map(String));
    if (cmBool(cmCfg(settings, 'rerankAutoDiscoverTerms', true), true)) {
        const topk = Math.max(1, cmInt(cmCfg(settings, 'rerankAutoGenericTopk', 30), 30));
        Object.keys(dfMap).forEach(term => {
            const ratio = dfMap[term] / Math.max(1, totalDocs);
            const idf = cmIdf(term, dfMap, totalDocs);
            if (ratio >= 0.01 && idf <= 2.0 && EMOTION_HINT_CHARS.some(ch => term.includes(ch))) terms.add(term);
        });
        if (terms.size > topk + tableSettings.genericTerms.length) {
            return new Set(Array.from(terms).slice(0, topk + tableSettings.genericTerms.length));
        }
    }
    return terms;
}

function cmEffectiveIntimacyTerms(settings, tableSettings, dfMap, totalDocs, queryText) {
    const terms = new Set((tableSettings.intimacyTerms || []).map(String));
    if (cmBool(cmCfg(settings, 'rerankAutoDiscoverTerms', true), true)) {
        const topk = Math.max(1, cmInt(cmCfg(settings, 'rerankAutoIntimacyTopk', 20), 20));
        const candidates = Object.keys(dfMap)
            .filter(term => cmIdf(term, dfMap, totalDocs) <= 3.5 && INTIMACY_HINT_CHARS.some(ch => term.includes(ch)))
            .sort((a, b) => (dfMap[b] + (String(queryText).includes(b) ? 1 : 0)) - (dfMap[a] + (String(queryText).includes(a) ? 1 : 0)))
            .slice(0, topk);
        candidates.forEach(term => terms.add(term));
    }
    return terms;
}

function cmQueryRecencyMap(queryText, settings) {
    const enabled = cmBool(cmCfg(settings, 'rerankQueryRecencyWeightEnabled', true), true);
    if (!enabled) return {};
    const decay = Math.max(0, cmNum(cmCfg(settings, 'rerankQueryRecencyDecay', 0.2), 0.2));
    const minWeight = Math.max(0, Math.min(1, cmNum(cmCfg(settings, 'rerankQueryRecencyMinWeight', 0.4), 0.4)));
    const tokens = cmExtractKeywords(queryText, 80, settings);
    const result = {};
    const total = Math.max(1, tokens.length - 1);
    tokens.forEach((token, index) => {
        const distanceFromEnd = total - index;
        const weight = Math.max(minWeight, 1 - decay * (distanceFromEnd / Math.max(1, total)));
        result[cmNorm(token)] = Math.max(result[cmNorm(token)] || 0, weight);
    });
    return result;
}

function cmRecencyWeight(token, recencyMap, defaultWeight = 1) {
    return recencyMap[cmNorm(token)] || defaultWeight;
}

function cmPosWeight(pos) {
    const key = String(pos || '').toLowerCase();
    if (ANCHOR_POS_BASE_WEIGHT[key]) return ANCHOR_POS_BASE_WEIGHT[key];
    if (key.startsWith('n')) return 2.0;
    if (key.startsWith('v')) return 1.2;
    return 0.8;
}

function cmScoreEventVerb(token, pos, sentences, entityTerms, nounTerms, latestNorm, idfScore, genericTerms, settings, tableSettings) {
    const tokenText = String(token || '').trim();
    const posText = String(pos || '').toLowerCase();
    const isVerb = ANCHOR_VERB_POS.has(posText) || posText.startsWith('v') || (tableSettings.eventVerbWhitelist || []).includes(tokenText);
    const meta = { structureHits: 0, channel: 'none' };
    if (!cmBool(cmCfg(settings, 'eventVerbEnabled', true), true) || !isVerb) return { bonus: 0, meta };

    const windowChars = Math.max(2, cmInt(cmCfg(settings, 'rerankEventStructureWindowChars', 12), 12));
    const hitSentences = sentences.filter(sentence => sentence.includes(tokenText));
    const eventPeerTerms = (tableSettings.eventVerbWhitelist || [])
        .concat(tableSettings.eventOutcomeTerms || [])
        .concat(EVENT_RESULT_COMPLEMENTS)
        .filter(term => term && term !== tokenText);
    let hasObject = false;
    let hasEntity = false;
    let hasResult = false;
    let hasEventPeer = false;
    hitSentences.forEach(sentence => {
        if (cmHasCandidateNearToken(sentence, tokenText, nounTerms, windowChars)) hasObject = true;
        if (cmHasCandidateNearToken(sentence, tokenText, entityTerms, windowChars)) hasEntity = true;
        if (cmHasCandidateNearToken(sentence, tokenText, EVENT_RESULT_COMPLEMENTS, Math.max(2, Math.floor(windowChars / 2)))) hasResult = true;
        if (cmHasCandidateNearToken(sentence, tokenText, eventPeerTerms, windowChars)) hasEventPeer = true;
    });
    if (EVENT_RESULT_COMPLEMENTS.some(comp => tokenText.includes(comp))) hasResult = true;

    const structureHits = Number(hasObject) + Number(hasEntity) + Number(hasResult) + Number(hasEventPeer);
    meta.structureHits = structureHits;
    const latestHit = latestNorm && cmNorm(tokenText) && latestNorm.includes(cmNorm(tokenText));
    let eventScore = 0;
    if (hasObject) eventScore += 1.8;
    if (hasResult) eventScore += 1.6;
    if (hasEntity) eventScore += 1.4;
    if (hasEventPeer) eventScore += 0.9;
    if (latestHit) eventScore += 0.8;
    if (idfScore >= cmNum(cmCfg(settings, 'rerankHardAnchorVerbMinIdf', 2.2), 2.2)) eventScore += 0.7;
    if ((tableSettings.eventVerbWhitelist || []).includes(tokenText)) eventScore += 0.6;
    if (genericTerms.has(tokenText) && structureHits < 2) eventScore -= 1.2;

    const requireStructure = cmBool(cmCfg(settings, 'rerankEventVerbRequireStructure', true), true);
    const minStructure = Math.max(1, cmInt(cmCfg(settings, 'rerankEventVerbMinStructureHits', 2), 2));
    const threshold = cmNum(cmCfg(settings, 'rerankEventVerbThreshold', 3.5), 3.5);
    if ((!requireStructure || structureHits >= minStructure) && eventScore >= threshold) {
        meta.channel = 'strong';
        const base = cmNum(cmCfg(settings, 'rerankEventVerbBaseBonus', 1.2), 1.2);
        const extra = Math.min(cmNum(cmCfg(settings, 'rerankEventVerbMaxExtra', 1.4), 1.4), eventScore - threshold);
        return { bonus: Number((base + extra).toFixed(3)), meta };
    }

    if (cmBool(cmCfg(settings, 'rerankEventVerbWeakRareEnabled', true), true)) {
        const weakMinStructure = Math.max(0, cmInt(cmCfg(settings, 'rerankEventVerbWeakMinStructureHits', 0), 0));
        const weakMinIdf = cmNum(cmCfg(settings, 'rerankEventVerbWeakRareMinIdf', 4.4), 4.4);
        const requireLatest = cmBool(cmCfg(settings, 'rerankEventVerbWeakRequireLatest', false), false);
        const blockGeneric = cmBool(cmCfg(settings, 'rerankEventVerbWeakBlockGeneric', true), true);
        if (structureHits >= weakMinStructure && idfScore >= weakMinIdf && (!requireLatest || latestHit) && (!blockGeneric || !genericTerms.has(tokenText))) {
            let weakSignal = cmNum(cmCfg(settings, 'rerankEventVerbWeakRareBaseSignal', 1.3), 1.3);
            if (latestHit) weakSignal += 0.8;
            weakSignal += Math.min(1.0, structureHits * 0.45);
            weakSignal += Math.min(1.2, Math.max(0, idfScore - weakMinIdf) * 0.8);
            if ((tableSettings.eventVerbWhitelist || []).includes(tokenText)) weakSignal += 0.4;
            if (hasResult) weakSignal += 0.3;
            const weakThreshold = cmNum(cmCfg(settings, 'rerankEventVerbWeakThreshold', 1.3), 1.3);
            if (weakSignal >= weakThreshold) {
                meta.channel = 'weak_rare';
                const base = cmNum(cmCfg(settings, 'rerankEventVerbWeakBaseBonus', 0.8), 0.8);
                const extra = Math.min(cmNum(cmCfg(settings, 'rerankEventVerbWeakMaxExtra', 0.7), 0.7), weakSignal - weakThreshold);
                return { bonus: Number((base + extra).toFixed(3)), meta };
            }
        }
    }
    return { bonus: 0, meta };
}

function cmIsHardAnchorToken(token, pos, eventBonus, eventMeta, idfScore, genericTerms, intimacyTerms, settings, tableSettings) {
    const text = String(token || '').trim();
    if (!text || cmIsTimeLikeToken(text)) return false;
    const forceAux = new Set(tableSettings.hardAnchorForceAuxTerms || []);
    if (forceAux.has(text)) return false;
    if (cmBool(cmCfg(settings, 'rerankBlockGenericAsHardAnchor', true), true) && (genericTerms.has(text) || intimacyTerms.has(text))) return false;
    if (new Set(tableSettings.hardAnchorBlockTerms || []).has(text)) return false;
    if (new Set(tableSettings.eventOutcomeTerms || []).has(text)) return true;
    if (new Set(tableSettings.hardAnchorNounWhitelist || []).has(text)) return true;
    const posText = String(pos || '').toLowerCase();
    if (eventBonus > 0) {
        const minStructure = Math.max(1, cmInt(cmCfg(settings, 'rerankEventVerbMinStructureHits', 2), 2));
        if (cmInt(eventMeta.structureHits, 0) >= minStructure) return true;
        return eventMeta.channel === 'weak_rare' && cmInt(eventMeta.structureHits, 0) >= cmInt(cmCfg(settings, 'rerankEventVerbWeakMinStructureHits', 0), 0);
    }
    if (ANCHOR_ENTITY_POS.has(posText)) return idfScore >= cmNum(cmCfg(settings, 'rerankHardAnchorEntityMinIdf', 1.3), 1.3);
    if (ANCHOR_NOUN_POS.has(posText) || posText.startsWith('n')) return idfScore >= cmNum(cmCfg(settings, 'rerankHardAnchorNounMinIdf', 2.6), 2.6);
    return false;
}

function cmIsAuxAnchorToken(token, genericTerms, intimacyTerms, forceAuxTerms) {
    return forceAuxTerms.has(token) || genericTerms.has(token) || intimacyTerms.has(token);
}

function cmScoreEventCandidateToken(token, pos, idfScore, latestNorm, eventMeta, genericTerms, intimacyTerms, forceAuxTerms, settings, tableSettings) {
    if (!cmBool(cmCfg(settings, 'eventCandidateEnabled', true), true)) return 0;
    const text = String(token || '').trim();
    if (!text || cmIsTimeLikeToken(text)) return 0;
    if (new Set(tableSettings.eventCandidateBlockTerms || []).has(text)) return 0;
    if (new Set(tableSettings.hardAnchorBlockTerms || []).has(text)) return 0;
    if (cmIsAuxAnchorToken(text, genericTerms, intimacyTerms, forceAuxTerms)) return 0;
    const posText = String(pos || '').toLowerCase();
    const isVerbLike = ANCHOR_VERB_POS.has(posText) || posText.startsWith('v');
    const isResultLike = (tableSettings.eventOutcomeTerms || []).includes(text) || EVENT_RESULT_COMPLEMENTS.some(comp => text.includes(comp));
    const structureHits = cmInt(eventMeta.structureHits, 0);
    const isEventLike = isVerbLike || (tableSettings.eventVerbWhitelist || []).includes(text) || isResultLike || structureHits > 0;
    if (!isEventLike) return 0;
    if (isVerbLike && !(tableSettings.eventVerbWhitelist || []).includes(text) && !isResultLike && structureHits < cmInt(cmCfg(settings, 'rerankEventCandidateMinStructureHits', 2), 2)) return 0;
    if (!(tableSettings.eventVerbWhitelist || []).includes(text) && !isResultLike && idfScore < cmNum(cmCfg(settings, 'rerankEventCandidateMinIdf', 2.0), 2.0)) return 0;

    let signal = 0;
    if (structureHits > 0) signal += Math.min(2.4, structureHits * 0.85);
    if (isVerbLike) signal += 0.55;
    if ((tableSettings.eventVerbWhitelist || []).includes(text)) signal += 0.8;
    if (isResultLike) signal += 1.0;
    if (latestNorm && cmNorm(text) && latestNorm.includes(cmNorm(text))) signal += 0.45;
    if (idfScore >= cmNum(cmCfg(settings, 'rerankHardAnchorVerbMinIdf', 2.2), 2.2)) signal += 0.55;
    signal += Math.min(1.2, Math.max(0, idfScore - 1.0) * 0.35);
    return signal >= cmNum(cmCfg(settings, 'rerankEventCandidateMinScore', 2.4), 2.4) ? Number(signal.toFixed(3)) : 0;
}

function cmExtractAnchorProfile(queryText, currentMessage, dfMap, totalDocs, genericTerms, intimacyTerms, settings, tableSettings) {
    if (!String(queryText || '').trim()) {
        return { hardScores: {}, auxScores: {}, eventCandidateScores: {}, slotSets: { entity: new Set(), action: new Set(), object: new Set(), outcome: new Set() } };
    }
    const stopwords = cmStopwords(settings);
    const cleaned = cmStripQueryNoise(queryText) || String(queryText || '');
    const tokens = cmExtractQueryTokensWithPos(cleaned, settings, tableSettings);
    const tokenPos = {};
    tokens.forEach(([token, pos]) => {
        if (!tokenPos[token] || cmPosWeight(pos) > cmPosWeight(tokenPos[token])) tokenPos[token] = pos;
    });
    cmExtractKeywords(cleaned, 80, settings).forEach(token => {
        if (!tokenPos[token]) tokenPos[token] = cmInferPos(token, tableSettings);
    });

    const aliasMaps = cmParseAliasMaps(tableSettings);
    const sentences = cmSplitSentences(cleaned);
    const latestText = cmStripQueryNoise(currentMessage || sentences[sentences.length - 1] || '');
    const latestNorm = cmNorm(latestText);
    const entityTerms = tokens.filter(([, pos]) => ANCHOR_ENTITY_POS.has(String(pos).toLowerCase())).map(([token]) => token);
    const nounTerms = tokens.filter(([, pos]) => ANCHOR_NOUN_POS.has(String(pos).toLowerCase()) || String(pos).toLowerCase().startsWith('n')).map(([token]) => token);
    const recencyMap = cmQueryRecencyMap(cleaned, settings);
    const keywordVocab = new Set(Object.keys(dfMap || {}));
    const anchorRequireKeyword = cmBool(cmCfg(settings, 'rerankAnchorRequireKeywordInMemory', true), true);
    const queryNormForVocab = cmNorm(cleaned);
    keywordVocab.forEach(keywordNorm => {
        if (!keywordNorm || keywordNorm.length < 2) return;
        if (!queryNormForVocab.includes(keywordNorm)) return;
        const existingKey = Object.keys(tokenPos).find(token => cmNorm(token) === keywordNorm);
        if (!existingKey) {
            const inferredPos = cmInferPos(keywordNorm, tableSettings);
            tokenPos[keywordNorm] = inferredPos;
            const posText = String(inferredPos || '').toLowerCase();
            if (ANCHOR_ENTITY_POS.has(posText)) entityTerms.push(keywordNorm);
            if (ANCHOR_NOUN_POS.has(posText) || posText.startsWith('n')) nounTerms.push(keywordNorm);
        }
    });
    const hardScores = {};
    const auxScores = {};
    const eventCandidateScores = {};
    const slotSets = { entity: new Set(), action: new Set(), object: new Set(), outcome: new Set() };
    const forceAuxTerms = new Set(tableSettings.hardAnchorForceAuxTerms || []);
    const outcomeTerms = new Set(tableSettings.eventOutcomeTerms || []);
    const queryNorm = cmNorm(cleaned);
    const aliasPhraseBonusBase = cmNum(cmCfg(settings, 'rerankEventAliasPhraseBonus', 0.8), 0.8);
    const aliasPhraseBonus = {};
    Object.entries(aliasMaps.aliasNormToCanonical).forEach(([aliasNorm, canonical]) => {
        if (aliasNorm.length >= 4 && queryNorm.includes(aliasNorm)) {
            aliasPhraseBonus[canonical] = Math.max(aliasPhraseBonus[canonical] || 0, aliasPhraseBonusBase + Math.min(0.6, Math.max(0, aliasNorm.length - 4) * 0.08));
            if (!tokenPos[canonical]) tokenPos[canonical] = outcomeTerms.has(canonical) ? 'n' : cmInferPos(canonical, tableSettings);
        }
    });

    Object.entries(tokenPos).forEach(([rawToken, pos]) => {
        if (!rawToken || stopwords.has(rawToken) || cmIsNumericToken(rawToken) || cmIsTimeLikeToken(rawToken)) return;
        const canonicalBase = cmResolveAliasToken(rawToken, aliasMaps.aliasNormToCanonical) || rawToken;
        let candidates = [canonicalBase];
        if (anchorRequireKeyword) {
            const norm = cmNorm(canonicalBase);
            const hasVocab = keywordVocab.has(norm);
            if (!hasVocab) {
                const rescued = cmExtractKeywords(canonicalBase, 8, settings).filter(token => keywordVocab.has(cmNorm(token)));
                if (!rescued.length) return;
                candidates = rescued;
            }
        }

        candidates.forEach(token => {
            const tokenNorm = cmNorm(token);
            let tokenDf = dfMap[tokenNorm] || 0;
            if (anchorRequireKeyword && !keywordVocab.has(tokenNorm)) return;
            if (cmBool(cmCfg(settings, 'rerankAnchorCompositeDfAdjustEnabled', true), true)) {
                const maxLen = cmInt(cmCfg(settings, 'rerankAnchorCompositeDfShortMaxLen', 3), 3);
                if (token.length >= 2 && token.length <= maxLen) {
                    Object.keys(dfMap).forEach(keyword => {
                        if (keyword !== tokenNorm && keyword.includes(tokenNorm)) tokenDf = Math.max(tokenDf, dfMap[keyword] || 0);
                    });
                }
            }
            const idfScore = Math.log((Math.max(totalDocs, 1) + 1) / (tokenDf + 1)) + 1;
            let score = cmPosWeight(pos);
            let idfBoost = Math.max(0, idfScore * cmNum(cmCfg(settings, 'rerankAnchorIdfWeight', 0.6), 0.6));
            const maxBoost = cmNum(cmCfg(settings, 'rerankAnchorIdfMaxBoost', 0.0), 0.0);
            if (maxBoost > 0) idfBoost = Math.min(maxBoost, idfBoost);
            score += idfBoost;
            if (cmNum(cmCfg(settings, 'rerankAnchorFreqPenaltyWeight', 0.6), 0.6) > 0 && tokenDf > 0) {
                score -= cmNum(cmCfg(settings, 'rerankAnchorFreqPenaltyWeight', 0.6), 0.6) * Math.sqrt(Math.min(1, tokenDf / Math.max(totalDocs, 1)));
            }
            if (latestNorm && latestNorm.includes(tokenNorm)) score += 1.0;
            if (token.length >= 2 && token.length <= 6) score += 0.4;
            if (genericTerms.has(token) || genericTerms.has(rawToken)) score -= 1.8;
            if ((intimacyTerms.has(token) || intimacyTerms.has(rawToken)) && !genericTerms.has(token) && !genericTerms.has(rawToken)) score -= 0.8;
            score *= Math.max(cmRecencyWeight(token, recencyMap, 1.0), cmRecencyWeight(rawToken, recencyMap, 1.0));

            const event = cmScoreEventVerb(rawToken, pos, sentences, entityTerms, nounTerms, latestNorm, idfScore, genericTerms, settings, tableSettings);
            score += cmNum(aliasPhraseBonus[token], 0);
            score += event.bonus;
            if (score <= 0) return;
            score = Number(score.toFixed(3));

            if (cmIsHardAnchorToken(token, pos, event.bonus, event.meta, idfScore, genericTerms, intimacyTerms, settings, tableSettings)) {
                hardScores[token] = Math.max(cmNum(hardScores[token], 0), score);
                const posText = String(pos || '').toLowerCase();
                if (ANCHOR_ENTITY_POS.has(posText)) slotSets.entity.add(token);
                if (event.bonus > 0) slotSets.action.add(token);
                else if (ANCHOR_NOUN_POS.has(posText) || posText.startsWith('n')) slotSets.object.add(token);
                else slotSets.object.add(token);
                if (outcomeTerms.has(token) || EVENT_RESULT_COMPLEMENTS.some(comp => token.includes(comp))) slotSets.outcome.add(token);
            } else if (cmIsAuxAnchorToken(token, genericTerms, intimacyTerms, forceAuxTerms)) {
                auxScores[token] = Math.max(cmNum(auxScores[token], 0), score);
            } else {
                const eventCandidate = cmScoreEventCandidateToken(token, pos, idfScore, latestNorm, event.meta, genericTerms, intimacyTerms, forceAuxTerms, settings, tableSettings);
                if (eventCandidate > 0) eventCandidateScores[token] = Math.max(cmNum(eventCandidateScores[token], 0), eventCandidate);
            }
        });
    });

    return { hardScores, auxScores, eventCandidateScores, slotSets };
}

function cmMergeScores(target, source, weight = 1, useMax = true) {
    Object.entries(source || {}).forEach(([key, value]) => {
        const weighted = cmNum(value, 0) * weight;
        if (weighted <= 0) return;
        target[key] = useMax ? Math.max(cmNum(target[key], 0), Number(weighted.toFixed(3))) : Number((cmNum(target[key], 0) + weighted).toFixed(3));
    });
    return target;
}

function cmCombineAnchorProfiles(userProfile, assistantProfile, settings) {
    const userWeight = cmNum(cmCfg(settings, 'rerankUserAnchorWeight', 1), 1);
    const assistantWeight = cmNum(cmCfg(settings, 'rerankAssistantAnchorWeight', 1), 1);
    const assistantOnlyMin = cmNum(cmCfg(settings, 'rerankAssistantOnlyHardMin', 0), 0);
    const auxMergeAlpha = Math.max(0, Math.min(1, cmNum(cmCfg(settings, 'rerankAuxMergeAlpha', 0), 0)));
    const auxTermMaxScore = Math.max(0, cmNum(cmCfg(settings, 'rerankAuxTermMaxScore', 4.5), 4.5));
    const userHard = cmMergeScores({}, userProfile.hardScores, userWeight);
    const assistantHard = cmMergeScores({}, assistantProfile.hardScores, assistantWeight);
    const hardScores = { ...userHard };
    Object.entries(assistantHard).forEach(([token, score]) => {
        if (Object.keys(userHard).length === 0 && assistantOnlyMin > 0 && score < assistantOnlyMin) return;
        hardScores[token] = Math.max(cmNum(hardScores[token], 0), score);
    });
    const userAux = cmMergeScores({}, userProfile.auxScores, userWeight);
    const assistantAux = cmMergeScores({}, assistantProfile.auxScores, assistantWeight);
    const auxScores = {};
    new Set([...Object.keys(userAux), ...Object.keys(assistantAux)]).forEach(token => {
        const major = Math.max(cmNum(userAux[token], 0), cmNum(assistantAux[token], 0));
        const minor = Math.min(cmNum(userAux[token], 0), cmNum(assistantAux[token], 0));
        let merged = major + auxMergeAlpha * minor;
        if (auxTermMaxScore > 0) merged = Math.min(auxTermMaxScore, merged);
        if (merged > 0) auxScores[token] = Number(merged.toFixed(3));
    });
    const eventCandidateScores = {};
    cmMergeScores(eventCandidateScores, userProfile.eventCandidateScores, userWeight);
    cmMergeScores(eventCandidateScores, assistantProfile.eventCandidateScores, assistantWeight);
    Object.keys(eventCandidateScores).forEach(token => {
        if (hardScores[token]) delete eventCandidateScores[token];
    });
    Object.keys(auxScores).forEach(token => {
        if (hardScores[token] || eventCandidateScores[token]) delete auxScores[token];
    });
    const slotSets = { entity: new Set(), action: new Set(), object: new Set(), outcome: new Set() };
    [userProfile.slotSets, assistantProfile.slotSets].forEach(source => {
        ['entity', 'action', 'object', 'outcome'].forEach(slot => {
            (source && source[slot] ? source[slot] : new Set()).forEach(value => slotSets[slot].add(value));
        });
    });
    return { hardScores, auxScores, eventCandidateScores, slotSets };
}

function cmShouldUseTopicMode(anchorScores, settings) {
    const values = Object.values(anchorScores || {}).filter(v => v > 0).sort((a, b) => b - a);
    const top1 = values[0] || 0;
    const top2 = values[1] || 0;
    const hardTop1 = cmNum(cmCfg(settings, 'rerankAnchorTop1Threshold', 5.5), 5.5);
    const softTop1 = cmNum(cmCfg(settings, 'rerankAnchorTop1Soft', 4.0), 4.0);
    const softTop2 = cmNum(cmCfg(settings, 'rerankAnchorTop2Soft', 3.0), 3.0);
    const requireMulti = cmBool(cmCfg(settings, 'rerankTopicRequireMultiAnchor', true), true);
    const minCount = Math.max(1, cmInt(cmCfg(settings, 'rerankTopicMinHardAnchorCount', 2), 2));
    const singleOverride = cmNum(cmCfg(settings, 'rerankTopicSingleAnchorOverrideScore', 9.2), 9.2);
    const strongCount = values.filter(score => score >= softTop2).length;
    const useTopic = requireMulti
        ? ((top1 >= softTop1 && top2 >= softTop2 && strongCount >= minCount) || top1 >= Math.max(hardTop1, singleOverride))
        : (top1 >= hardTop1 || (top1 >= softTop1 && top2 >= softTop2));
    return { useTopic, top1, top2 };
}

function cmWeakMessage(message, settings, tableSettings) {
    const text = String(message || '').trim();
    if (!text) return true;
    const normalized = text.replace(/[^\w\u4e00-\u9fff]+/g, '').toLowerCase();
    if (!normalized || WEAK_MESSAGE_FILLERS.has(normalized)) return true;
    const generic = new Set(tableSettings.genericTerms || []);
    const intimacy = new Set(tableSettings.intimacyTerms || []);
    const meaningful = cmExtractKeywords(text, 8, settings).filter(token => !WEAK_MESSAGE_FILLERS.has(token) && (intimacy.has(token) || !generic.has(token)));
    return meaningful.length === 0;
}

function cmAnchorLinkedToCurrent(anchor, linkTerms, currentMessageNorm) {
    const norm = cmNorm(anchor);
    if (!norm) return false;
    if (currentMessageNorm && currentMessageNorm.includes(norm)) return true;
    return Array.from(linkTerms || []).some(term => {
        const termNorm = cmNorm(term);
        return termNorm && (termNorm === norm || termNorm.includes(norm) || norm.includes(termNorm));
    });
}

function cmConsumeState(map, key) {
    const state = map.get(key);
    if (!state || cmInt(state.ttl, 0) <= 0) {
        map.delete(key);
        return { anchors: {}, ttlBefore: 0, ttlAfter: 0 };
    }
    const ttlBefore = cmInt(state.ttl, 0);
    state.ttl = ttlBefore - 1;
    const anchors = { ...(state.anchors || {}) };
    if (state.ttl <= 0) map.delete(key);
    return { anchors, ttlBefore, ttlAfter: Math.max(0, state.ttl) };
}

function cmSaveState(map, key, anchors, ttl, topk = 8) {
    if (!ttl || ttl <= 0 || !anchors || Object.keys(anchors).length === 0) return;
    const kept = {};
    Object.entries(anchors)
        .sort((a, b) => cmNum(b[1], 0) - cmNum(a[1], 0))
        .slice(0, topk)
        .forEach(([token, score]) => { kept[token] = score; });
    map.set(key, { anchors: kept, ttl });
}

function cmBuildTopicCoreAnchorScores(hardAnchorTerms, slotSets, settings, tableSettings) {
    const forceAux = new Set(tableSettings.hardAnchorForceAuxTerms || []);
    const minScore = cmNum(cmCfg(settings, 'rerankTopicCoreMinScore', 5.0), 5.0);
    const topk = Math.max(1, cmInt(cmCfg(settings, 'rerankTopicCoreTopk', 6), 6));
    const preferObjectOutcome = cmBool(cmCfg(settings, 'rerankTopicCorePreferObjectOutcome', true), true);
    const entityObject = new Set([...(slotSets.entity || []), ...(slotSets.object || [])]);
    const selected = {};
    const source = hardAnchorTerms.filter(([token, score]) => !forceAux.has(token) && score >= minScore);
    const firstPass = preferObjectOutcome && entityObject.size > 0 ? source.filter(([token]) => entityObject.has(token)) : source;
    [...firstPass, ...source].forEach(([token, score]) => {
        if (Object.keys(selected).length >= topk) return;
        if (!selected[token]) selected[token] = score;
    });
    return selected;
}

function cmBuildMemoryQueryParts(chat, settings) {
    if (!chat || !Array.isArray(chat.history)) return { userText: '', assistantText: '', currentMessage: '', queryText: '' };
    let history = chat.history.slice();
    if (typeof filterHistoryForAI === 'function') {
        try { history = filterHistoryForAI(chat, history); } catch (_) {}
    }
    history = history.filter(m => m && !m.isContextDisabled && !m.isThinking);
    const turns = Math.max(1, cmInt(cmCfg(settings, 'memoryQueryTurns', 3), 3));
    let userCount = 0;
    let startIndex = Math.max(0, history.length - 1);
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user') userCount++;
        startIndex = i;
        if (userCount >= turns) break;
    }
    const slice = history.slice(startIndex);
    const users = [];
    const assistants = [];
    slice.forEach(message => {
        const text = typeof getMessagePlainText === 'function' ? getMessagePlainText(message) : String(message.content || '');
        if (!text) return;
        if (message.role === 'user') users.push(text);
        else assistants.push(text);
    });
    const latestUser = [...slice].reverse().find(m => m && m.role === 'user');
    const currentMessage = latestUser ? (typeof getMessagePlainText === 'function' ? getMessagePlainText(latestUser) : String(latestUser.content || '')) : '';
    return {
        userText: users.join('\n'),
        assistantText: assistants.join('\n'),
        currentMessage,
        queryText: slice.map(message => typeof getMessagePlainText === 'function' ? getMessagePlainText(message) : String(message.content || '')).filter(Boolean).join('\n')
    };
}

function buildCoreMemoryQueryText(chat, turns = 3) {
    return cmBuildMemoryQueryParts(chat, { memoryQueryTurns: turns }).queryText;
}

function cmMatchKeywordsInText(memory, queryText, tableSettings) {
    const queryNorm = cmNorm(queryText);
    if (!queryNorm) return [];
    const aliasMaps = cmParseAliasMaps(tableSettings);
    const matched = [];
    const seenCanonical = new Set();
    cmMemoryKeywords(memory).forEach(keyword => {
        const keywordNorm = cmNorm(keyword);
        if (!keywordNorm) return;
        const canonical = cmResolveAliasToken(keyword, aliasMaps.aliasNormToCanonical) || keyword;
        const canonicalNorm = cmNorm(canonical);
        const aliases = aliasMaps.canonicalNormToAliases[canonicalNorm] || new Set();
        const hit = queryNorm.includes(keywordNorm)
            || keywordNorm.includes(queryNorm)
            || queryNorm.includes(canonicalNorm)
            || Array.from(aliases).some(aliasNorm => queryNorm.includes(aliasNorm));
        if (!hit || seenCanonical.has(canonicalNorm)) return;
        seenCanonical.add(canonicalNorm);
        matched.push(canonical);
    });
    return matched;
}

function cmPoolMatchWeight(matchType, settings) {
    if (matchType === 'exact') return 1.0;
    if (matchType === 'alias') return 0.9;
    if (matchType === 'alpha') return cmNum(cmCfg(settings, 'rerankPoolMatchAlphaCodeWeight', 0.78), 0.78);
    if (matchType === 'mixed_strong') return cmNum(cmCfg(settings, 'rerankPoolMatchMixedStrongWeight', 0.82), 0.82);
    if (matchType === 'mixed_weak') return cmNum(cmCfg(settings, 'rerankPoolMatchMixedWeakWeight', 0.5), 0.5);
    if (matchType === 'relaxed') return 0.55;
    return 1.0;
}

function cmBuildPoolMatchDetails(matchedTermsAll, scoringTermPool, poolScoreMap, aliasNormMap, relaxedEnabled, settings) {
    const details = [];
    const seen = new Set();
    const pool = Array.from(scoringTermPool || []);
    (matchedTermsAll || []).forEach(sourceTerm => {
        const source = String(sourceTerm || '').trim();
        const sourceNorm = cmNorm(source);
        if (!source || !sourceNorm) return;
        let term = '';
        let matchType = '';
        if (scoringTermPool.has(source)) {
            term = source;
            matchType = 'exact';
        } else {
            const canonical = aliasNormMap[sourceNorm];
            if (canonical && scoringTermPool.has(canonical)) {
                term = canonical;
                matchType = 'alias';
            }
        }
        if (!term && relaxedEnabled) {
            const relaxed = pool.find(candidate => {
                const candidateNorm = cmNorm(candidate);
                return candidateNorm && (candidateNorm.includes(sourceNorm) || sourceNorm.includes(candidateNorm));
            });
            if (relaxed) {
                term = relaxed;
                matchType = 'relaxed';
            }
        }
        if (!term) return;
        const key = `${term}|${source}|${matchType}`;
        if (seen.has(key)) return;
        seen.add(key);
        details.push({
            term,
            sourceTerm: source,
            matchType,
            weight: cmPoolMatchWeight(matchType, settings),
            score: cmNum(poolScoreMap[term], 0)
        });
    });
    return details;
}

function cmPoolTermNormSets(details) {
    const termNorms = new Set();
    const sourceNorms = new Set();
    (details || []).forEach(detail => {
        if (detail.term) termNorms.add(cmNorm(detail.term));
        if (detail.sourceTerm) sourceNorms.add(cmNorm(detail.sourceTerm));
    });
    return { termNorms, sourceNorms };
}

function cmScoreMatchedTermsWithWeights(matchedTerms, memory, recencyMap, genericNormTerms, genericMatchWeight, tier2Threshold, tier1Threshold, poolInWeight, poolOutWeight, poolTermNorms, poolSourceNorms) {
    if (!matchedTerms || matchedTerms.length === 0) {
        return { tier: 0, score: 0, genericHits: 0, nonGenericHits: 0, poolInHits: 0, poolOutHits: 0, poolInComponent: 0, poolOutComponent: 0, importanceComponent: 0 };
    }
    let score = 0;
    let longMass = 0;
    let mediumMass = 0;
    let genericHits = 0;
    let nonGenericHits = 0;
    let poolInHits = 0;
    let poolOutHits = 0;
    let poolInComponent = 0;
    let poolOutComponent = 0;
    matchedTerms.forEach(term => {
        const termNorm = cmNorm(term);
        const genericLike = genericNormTerms.has(termNorm);
        const poolIn = poolTermNorms.has(termNorm) || poolSourceNorms.has(termNorm);
        const scale = poolIn ? poolInWeight : poolOutWeight;
        const recency = cmRecencyWeight(term, recencyMap, 1);
        const weighted = cmKeywordWeight(term) * recency * scale;
        let contrib;
        if (genericLike) {
            genericHits++;
            contrib = weighted * genericMatchWeight;
        } else {
            nonGenericHits++;
            const len = String(term || '').replace(/\s+/g, '').length;
            if (len >= 3) longMass += recency * scale;
            if (len >= 2) mediumMass += recency * scale;
            contrib = weighted;
        }
        score += contrib;
        if (poolIn) {
            poolInHits++;
            poolInComponent += contrib;
        } else {
            poolOutHits++;
            poolOutComponent += contrib;
        }
    });
    const tier = longMass >= tier2Threshold ? 2 : (mediumMass >= tier1Threshold ? 1 : 0);
    const importanceComponent = score > 0 ? normalizeCoreMemoryImportance(memory.importance) * 0.05 : 0;
    score += importanceComponent;
    return { tier, score, genericHits, nonGenericHits, poolInHits, poolOutHits, poolInComponent, poolOutComponent, importanceComponent };
}

function cmAnchorMassFromDetails(details, scoreMap, minScore, relaxedShare, relaxedStandaloneCap) {
    let strict = 0;
    let relaxed = 0;
    (details || []).forEach(detail => {
        const score = cmNum(scoreMap[detail.term], 0);
        if (score <= 0 || score < minScore) return;
        const mass = Math.log1p(Math.max(0, score - minScore + 1)) * Math.max(0, cmNum(detail.weight, 0));
        if (detail.matchType === 'relaxed') relaxed += mass;
        else strict += mass;
    });
    const relaxedCap = strict > 0 ? strict * relaxedShare : relaxedStandaloneCap;
    const relaxedCapped = Math.min(relaxed, relaxedCap);
    return { total: Number((strict + relaxedCapped).toFixed(3)), strict: Number(strict.toFixed(3)), relaxed: Number(relaxedCapped.toFixed(3)) };
}

function cmCalculateEventSlotCoverage(matchedSet, slotSets, settings) {
    const weights = {
        entity: cmNum(cmCfg(settings, 'rerankEventSlotEntityWeight', 1.2), 1.2),
        action: cmNum(cmCfg(settings, 'rerankEventSlotActionWeight', 1.35), 1.35),
        object: cmNum(cmCfg(settings, 'rerankEventSlotObjectWeight', 1.0), 1.0),
        outcome: cmNum(cmCfg(settings, 'rerankEventSlotOutcomeWeight', 1.35), 1.35)
    };
    let weighted = 0;
    let total = 0;
    const detail = {};
    Object.keys(weights).forEach(slot => {
        const terms = slotSets[slot] || new Set();
        if (!terms.size) return;
        const hits = Array.from(terms).filter(term => matchedSet.has(term)).length;
        const ratio = Math.min(1, hits / Math.max(1, terms.size));
        weighted += weights[slot] * ratio;
        total += weights[slot];
        detail[slot] = { hits, total: terms.size, ratio: Number(ratio.toFixed(3)) };
    });
    return { coverage: total > 0 ? Number((weighted / total).toFixed(3)) : 0, detail };
}

function cmParseMemoryTime(memory) {
    return typeof parseCoreMemoryTimestamp === 'function' ? parseCoreMemoryTimestamp(memory && memory.timestamp) : Date.parse(memory && memory.timestamp);
}

function cmMemoryRecencyScore(memory, maxTs, minTs) {
    const ts = cmParseMemoryTime(memory);
    if (!ts || !maxTs || maxTs <= minTs) return 0;
    return Math.max(0, Math.min(1, (ts - minTs) / (maxTs - minTs)));
}

function cmSelectWithDiversity(scoredRows, limit, diversityPenalty) {
    const pool = (scoredRows || []).slice();
    const selected = [];
    while (pool.length && selected.length < limit) {
        let bestIndex = 0;
        let bestScore = -Infinity;
        pool.forEach((row, index) => {
            const overlap = selected.reduce((sum, picked) => {
                const common = Array.from(row.matchedSet || new Set()).filter(term => picked.matchedSet && picked.matchedSet.has(term)).length;
                return sum + common;
            }, 0);
            const adjusted = row.score - diversityPenalty * overlap;
            if (adjusted > bestScore) {
                bestScore = adjusted;
                bestIndex = index;
            }
        });
        selected.push(pool.splice(bestIndex, 1)[0]);
    }
    return selected;
}

function cmBuildStageATermStrengthMap(scoredRows, hardAnchorScoreMap) {
    const map = {};
    (scoredRows || []).forEach(row => {
        (row.hardHitsAll || []).forEach(term => {
            const base = cmNum(hardAnchorScoreMap[term], 0);
            map[term] = Math.max(cmNum(map[term], 0), base + cmNum(row.score, 0) * 0.05);
        });
    });
    return map;
}

function cmPercentile(values, p) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
    return sorted[index];
}

function cmSelectDynamicGateTerms(strengthMap, minTopk, pLow, pMid, pHigh) {
    const entries = Object.entries(strengthMap || {}).sort((a, b) => b[1] - a[1]);
    const values = entries.map(([, value]) => value);
    const percentiles = { p_low: cmPercentile(values, pLow), p_mid: cmPercentile(values, pMid), p_high: cmPercentile(values, pHigh) };
    const threshold = percentiles.p_mid || 0;
    const terms = entries.filter(([, value]) => value >= threshold).slice(0, Math.max(1, minTopk)).map(([term]) => term);
    return { terms, meta: { threshold, percentiles } };
}

function cmApplyDynamicTermGateProtection(selectedRows, scoredRows, limit, gatedTerms, protectPerTerm, protectMax) {
    if (!gatedTerms || !gatedTerms.length || protectPerTerm <= 0 || protectMax <= 0) {
        return { rows: selectedRows, debug: { enabled: false, skipped: true, reason: 'feature_disabled_or_empty' } };
    }
    const selected = selectedRows.slice();
    const selectedIds = new Set(selected.map(row => row.id));
    let added = 0;
    gatedTerms.forEach(term => {
        if (added >= protectMax) return;
        const already = selected.filter(row => row.matchedSet && row.matchedSet.has(term)).length;
        let need = Math.max(0, protectPerTerm - already);
        if (!need) return;
        const candidates = scoredRows.filter(row => !selectedIds.has(row.id) && row.matchedSet && row.matchedSet.has(term)).sort((a, b) => b.score - a.score);
        candidates.slice(0, need).forEach(row => {
            if (added >= protectMax || selected.length >= limit) return;
            selected.push(row);
            selectedIds.add(row.id);
            added++;
        });
    });
    return { rows: selected.slice(0, limit), debug: { enabled: true, skipped: false, added } };
}

function cmWeakTailPriority(row) {
    const singleAnchor = cmInt(row.hardAnchorHits, 0) <= 1;
    const poolOutEmpty = cmInt(row.basePoolInHits, 0) <= 0;
    const poolCount = cmInt(row.poolMatchedCount, 0);
    return (singleAnchor && poolOutEmpty ? 100 : 0) + (poolCount <= 0 ? 20 : 0) - cmNum(row.score, 0);
}

function cmApplyPenetrationGate(selectedRows, scoredRows, limit, settings) {
    const enabled = cmBool(cmCfg(settings, 'rerankPenetrationEnabled', true), true);
    const margin = Math.max(0, cmNum(cmCfg(settings, 'rerankPenetrationMargin', 2.0), 2.0));
    const maxSwaps = Math.max(0, cmInt(cmCfg(settings, 'rerankPenetrationMaxSwaps', 2), 2));
    const weakTailFirst = cmBool(cmCfg(settings, 'rerankPenetrationReplaceWeakTailFirst', true), true);
    if (!enabled || maxSwaps <= 0 || selectedRows.length === 0) {
        return { rows: selectedRows, debug: { enabled, skipped: true, reason: 'disabled_or_empty', swapsApplied: 0, swaps: [] } };
    }
    const selected = selectedRows.slice();
    const selectedIds = new Set(selected.map(row => row.id));
    const candidates = scoredRows.filter(row => !selectedIds.has(row.id) && cmInt(row.poolMatchedCount, 0) > 0).sort((a, b) => b.score - a.score);
    const swaps = [];
    for (const candidate of candidates) {
        if (swaps.length >= maxSwaps) break;
        const tailIndex = selected
            .map((row, index) => ({ row, index }))
            .sort((a, b) => weakTailFirst ? cmWeakTailPriority(b.row) - cmWeakTailPriority(a.row) : a.row.score - b.row.score)[0];
        if (!tailIndex) break;
        if (candidate.score + margin < tailIndex.row.score) continue;
        selectedIds.delete(tailIndex.row.id);
        selectedIds.add(candidate.id);
        selected[tailIndex.index] = candidate;
        swaps.push({ in: candidate.id, out: tailIndex.row.id, inScore: candidate.score, outScore: tailIndex.row.score });
    }
    return { rows: selected.slice(0, limit), debug: { enabled, skipped: false, swapsApplied: swaps.length, swaps } };
}

function cmApplyTopicRowConstraints(scoredRows, coreAnchorSet, topicLockTerms, coreNonOutcomeTerms, settings) {
    if (!cmBool(cmCfg(settings, 'rerankTopicConstraintsSoftOnly', true), true)) return { rows: scoredRows, debug: { softOnly: false } };
    const lockBonus = cmNum(cmCfg(settings, 'rerankTopicLockSoftBonus', 8.0), 8.0);
    const coreBonus = cmNum(cmCfg(settings, 'rerankTopicCoreHitSoftBonus', 5.0), 5.0);
    const nonOutcomeBonus = cmNum(cmCfg(settings, 'rerankTopicNonOutcomeSoftBonus', 3.0), 3.0);
    const rows = scoredRows.map(row => {
        let bonus = 0;
        if (Array.from(topicLockTerms || []).some(term => row.matchedSet.has(term))) bonus += lockBonus;
        if (Array.from(coreAnchorSet || []).some(term => row.matchedSet.has(term))) bonus += coreBonus;
        if (Array.from(coreNonOutcomeTerms || []).some(term => row.matchedSet.has(term))) bonus += nonOutcomeBonus;
        return bonus > 0 ? Object.assign({}, row, { score: row.score + bonus, topicSoftBonus: bonus }) : row;
    });
    return { rows, debug: { softOnly: true } };
}

function cmApplyTopicEmotionCap(selectedRows, allRows, limit, settings, tableSettings) {
    const maxEmotion = cmInt(cmCfg(settings, 'rerankTopicEmotionMaxCount', 20), 20);
    if (maxEmotion <= 0) return { rows: selectedRows.slice(0, limit), debug: { max: maxEmotion, kept: selectedRows.length, dropped: 0 } };
    const generic = new Set(tableSettings.genericTerms || []);
    const intimacy = new Set(tableSettings.intimacyTerms || []);
    const selected = [];
    let emotionCount = 0;
    let dropped = 0;
    selectedRows.forEach(row => {
        const isEmotion = Array.from(row.matchedSet || []).some(term => generic.has(term) || intimacy.has(term));
        if (isEmotion && emotionCount >= maxEmotion) {
            dropped++;
            return;
        }
        if (isEmotion) emotionCount++;
        selected.push(row);
    });
    if (selected.length < limit) {
        const selectedIds = new Set(selected.map(row => row.id));
        allRows.forEach(row => {
            if (selected.length >= limit || selectedIds.has(row.id)) return;
            selected.push(row);
            selectedIds.add(row.id);
        });
    }
    return { rows: selected.slice(0, limit), debug: { max: maxEmotion, kept: selected.length, dropped } };
}

function cmRankMapFromScores(scoreMap) {
    const rankMap = {};
    Object.entries(scoreMap || {})
        .sort((a, b) => cmNum(b[1], 0) - cmNum(a[1], 0))
        .forEach(([token], index) => { rankMap[token] = index + 1; });
    return rankMap;
}

function cmStageABuildAnchorMapsForQuery(memories, queryText, settings) {
    const tableSettings = getCoreMemoryRerankTableSettings(settings);
    const { dfMap, totalDocs } = cmMemoryKeywordDf(memories || []);
    const genericTerms = cmEffectiveGenericTerms(settings, tableSettings, dfMap, totalDocs);
    const intimacyTerms = cmEffectiveIntimacyTerms(settings, tableSettings, dfMap, totalDocs, queryText);
    const profile = cmExtractAnchorProfile(
        queryText,
        queryText,
        dfMap,
        totalDocs,
        genericTerms,
        intimacyTerms,
        settings,
        tableSettings
    );
    const hardAnchorScoreMap = { ...(profile.hardScores || {}) };
    const eventCandidateScoreMap = { ...(profile.eventCandidateScores || {}) };
    const auxAnchorScoreMap = { ...(profile.auxScores || {}) };
    const scoringTermScoreMap = Object.assign({}, hardAnchorScoreMap, eventCandidateScoreMap, auxAnchorScoreMap);
    const aliasMaps = cmParseAliasMaps(tableSettings);
    return {
        tableSettings,
        dfMap,
        totalDocs,
        genericTerms,
        intimacyTerms,
        hardAnchorScoreMap,
        eventCandidateScoreMap,
        auxAnchorScoreMap,
        hardAnchorRankMap: cmRankMapFromScores(hardAnchorScoreMap),
        eventAnchorRankMap: cmRankMapFromScores(eventCandidateScoreMap),
        auxAnchorRankMap: cmRankMapFromScores(auxAnchorScoreMap),
        scoringTermScoreMap,
        scoringTermPool: new Set(Object.keys(scoringTermScoreMap)),
        aliasNormMap: aliasMaps.aliasNormToCanonical,
        relaxedEnabled: cmBool(cmCfg(settings, 'rerankRelaxedKeywordMatchEnabled', true), true)
    };
}

function cmStageAPickPrimaryTerm(terms, rankMap, scoreMap) {
    const ranked = Array.from(new Set(terms || [])).sort((a, b) => {
        const rankA = cmInt(rankMap[a], 1000000000);
        const rankB = cmInt(rankMap[b], 1000000000);
        if (rankA !== rankB) return rankA - rankB;
        const scoreDiff = cmNum(scoreMap[b], 0) - cmNum(scoreMap[a], 0);
        if (scoreDiff !== 0) return scoreDiff;
        return String(a).localeCompare(String(b));
    });
    const primary = ranked[0] || '';
    return { primary, rank: primary ? cmInt(rankMap[primary], 0) : 0 };
}

function rankArchiveMemoriesLight(archiveMemories, queryText, settings) {
    const memories = Array.isArray(archiveMemories) ? archiveMemories.slice() : [];
    const emptyDebug = {
        mode: 'light',
        inputCount: memories.length,
        outputCount: 0,
        bucketCounts: { hard: 0, event: 0, aux: 0, other: 0 },
        hardAnchorTerms: [],
        eventAnchorTerms: [],
        auxAnchorTerms: []
    };
    if (!memories.length || !String(queryText || '').trim()) return { memories: [], debug: emptyDebug };

    const anchorMaps = cmStageABuildAnchorMapsForQuery(memories, queryText, settings);
    const hardBuckets = {};
    const eventBuckets = {};
    const auxBuckets = {};
    const bucketCounts = { hard: 0, event: 0, aux: 0, other: 0 };

    memories.slice().reverse().forEach(memory => {
        const matchedTermsAll = cmMatchKeywordsInText(memory, queryText, anchorMaps.tableSettings);
        if (!matchedTermsAll.length) return;
        const poolMatchDetails = cmBuildPoolMatchDetails(
            matchedTermsAll,
            anchorMaps.scoringTermPool,
            anchorMaps.scoringTermScoreMap,
            anchorMaps.aliasNormMap,
            anchorMaps.relaxedEnabled,
            settings
        );
        if (!poolMatchDetails.length) return;
        const hardHits = [];
        const eventHits = [];
        const auxHits = [];
        poolMatchDetails.forEach(detail => {
            const term = String(detail.term || '').trim();
            if (!term) return;
            if (anchorMaps.hardAnchorScoreMap[term]) hardHits.push(term);
            else if (anchorMaps.eventCandidateScoreMap[term]) eventHits.push(term);
            else if (anchorMaps.auxAnchorScoreMap[term]) auxHits.push(term);
        });
        if (hardHits.length) {
            const picked = cmStageAPickPrimaryTerm(hardHits, anchorMaps.hardAnchorRankMap, anchorMaps.hardAnchorScoreMap);
            const rankKey = picked.rank > 0 ? picked.rank : 1000000000;
            if (!hardBuckets[rankKey]) hardBuckets[rankKey] = [];
            hardBuckets[rankKey].push(memory);
            bucketCounts.hard++;
            return;
        }
        if (eventHits.length) {
            const picked = cmStageAPickPrimaryTerm(eventHits, anchorMaps.eventAnchorRankMap, anchorMaps.eventCandidateScoreMap);
            const rankKey = picked.rank > 0 ? picked.rank : 1000000000;
            if (!eventBuckets[rankKey]) eventBuckets[rankKey] = [];
            eventBuckets[rankKey].push(memory);
            bucketCounts.event++;
            return;
        }
        if (auxHits.length) {
            const picked = cmStageAPickPrimaryTerm(auxHits, anchorMaps.auxAnchorRankMap, anchorMaps.auxAnchorScoreMap);
            const rankKey = picked.rank > 0 ? picked.rank : 1000000000;
            if (!auxBuckets[rankKey]) auxBuckets[rankKey] = [];
            auxBuckets[rankKey].push(memory);
            bucketCounts.aux++;
        }
    });

    const ordered = [];
    [hardBuckets, eventBuckets, auxBuckets].forEach(bucket => {
        Object.keys(bucket).map(Number).sort((a, b) => a - b).forEach(rank => {
            ordered.push(...bucket[rank]);
        });
    });
    return {
        memories: ordered,
        debug: {
            mode: 'light',
            inputCount: memories.length,
            outputCount: ordered.length,
            bucketCounts,
            hardAnchorTerms: Object.entries(anchorMaps.hardAnchorScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            eventAnchorTerms: Object.entries(anchorMaps.eventCandidateScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            auxAnchorTerms: Object.entries(anchorMaps.auxAnchorScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12)
        }
    };
}

function cmApplyStageAPoolSoftFloor(scoredRows, limit, minPoolHits) {
    const rows = (scoredRows || []).slice();
    if (limit <= 0 || !rows.length) return [];
    const selected = rows.slice(0, limit);
    const minHits = Math.max(0, cmInt(minPoolHits, 0));
    if (minHits <= 0) return selected;
    const currentPoolHits = selected.filter(row => cmInt(row.poolHitCount, 0) > 0).length;
    let need = minHits - currentPoolHits;
    if (need <= 0) return selected;
    const selectedIds = new Set(selected.map(row => row.id));
    const poolCandidates = rows.slice(limit).filter(row => cmInt(row.poolHitCount, 0) > 0 && !selectedIds.has(row.id));
    if (!poolCandidates.length) return selected;
    const replaceIndices = [];
    for (let i = selected.length - 1; i >= 0; i--) {
        if (cmInt(selected[i].poolHitCount, 0) <= 0) replaceIndices.push(i);
    }
    const replaceCount = Math.min(need, poolCandidates.length, replaceIndices.length);
    for (let i = 0; i < replaceCount; i++) selected[replaceIndices[i]] = poolCandidates[i];
    return selected.sort((a, b) => cmNum(b.score, 0) - cmNum(a.score, 0));
}

function rankArchiveMemoriesComplex(archiveMemories, queryText, limit, settings) {
    const memories = Array.isArray(archiveMemories) ? archiveMemories.slice() : [];
    if (limit <= 0 || !memories.length || !String(queryText || '').trim()) {
        return { memories: [], debug: { mode: 'complex', inputCount: memories.length, outputCount: 0, rows: [] } };
    }
    const anchorMaps = cmStageABuildAnchorMapsForQuery(memories, queryText, settings);
    const genericNormTerms = new Set([...anchorMaps.genericTerms, ...anchorMaps.intimacyTerms].map(cmNorm));
    const recencyMap = cmQueryRecencyMap(queryText, settings);
    const hardMinScore = cmNum(cmCfg(settings, 'rerankHardAnchorMinScore', 5.0), 5.0);
    const eventCandidateMinScore = cmNum(cmCfg(settings, 'rerankEventCandidateMinScore', 2.4), 2.4);
    const auxAnchorMinScore = cmNum(cmCfg(settings, 'rerankAuxAnchorMinScore', 2.0), 2.0);
    const relaxedShareCap = cmNum(cmCfg(settings, 'rerankRelaxedMatchMaxShare', 0.6), 0.6);
    const relaxedMassCap = cmNum(cmCfg(settings, 'rerankRelaxedMatchStandaloneMaxMass', 0.7), 0.7);
    const stageaV1Enabled = cmBool(cmCfg(settings, 'stageAV1Enabled', true), true);
    const scored = [];

    memories.forEach((memory, index) => {
        const matchedTermsAll = cmMatchKeywordsInText(memory, queryText, anchorMaps.tableSettings);
        if (!matchedTermsAll.length) return;
        const scoreProfile = cmScoreMatchedTermsWithWeights(
            matchedTermsAll,
            memory,
            recencyMap,
            genericNormTerms,
            Math.max(0, Math.min(1, cmNum(cmCfg(settings, 'stageAGenericMatchWeight', 0.35), 0.35))),
            Math.max(0.1, cmNum(cmCfg(settings, 'rerankQueryRecencyTier2Threshold', 1.6), 1.6)),
            Math.max(0.1, cmNum(cmCfg(settings, 'rerankQueryRecencyTier1Threshold', 0.8), 0.8)),
            1.0,
            1.0,
            new Set(),
            new Set()
        );
        if (scoreProfile.score <= 0) return;
        let adjustedScore = scoreProfile.score;
        if (cmBool(cmCfg(settings, 'stageAGenericGuardEnabled', false), false)) {
            adjustedScore += cmNum(cmCfg(settings, 'stageANonGenericHitBonus', 0.8), 0.8) * scoreProfile.nonGenericHits;
            adjustedScore -= cmNum(cmCfg(settings, 'stageAGenericHitPenalty', 1.2), 1.2) * scoreProfile.genericHits;
            if (scoreProfile.nonGenericHits <= 0) {
                adjustedScore *= Math.max(0, Math.min(1, cmNum(cmCfg(settings, 'stageAGenericOnlyScoreMultiplier', 0.35), 0.35)));
            }
        }
        if (!stageaV1Enabled) {
            if (adjustedScore <= 0) return;
            scored.push({ id: index, memory, tier: scoreProfile.tier, score: adjustedScore, poolHitCount: 0 });
            return;
        }

        const poolMatchDetails = cmBuildPoolMatchDetails(
            matchedTermsAll,
            anchorMaps.scoringTermPool,
            anchorMaps.scoringTermScoreMap,
            anchorMaps.aliasNormMap,
            anchorMaps.relaxedEnabled,
            settings
        );
        const poolHitCount = poolMatchDetails.length;
        if (poolHitCount <= 0) return;
        const hardDetails = poolMatchDetails.filter(detail => anchorMaps.hardAnchorScoreMap[detail.term]);
        const eventDetails = poolMatchDetails.filter(detail => anchorMaps.eventCandidateScoreMap[detail.term]);
        const auxDetails = poolMatchDetails.filter(detail => anchorMaps.auxAnchorScoreMap[detail.term]);
        const hardHitTerms = Array.from(new Set(hardDetails.map(detail => detail.term).filter(Boolean)));
        const picked = hardHitTerms.length
            ? cmStageAPickPrimaryTerm(hardHitTerms, anchorMaps.hardAnchorRankMap, anchorMaps.hardAnchorScoreMap)
            : { primary: '', rank: 0 };
        let hardMass = cmAnchorMassFromDetails(hardDetails, anchorMaps.hardAnchorScoreMap, hardMinScore, relaxedShareCap, relaxedMassCap).total;
        let secondaryHardBonusComponent = 0;
        if (
            cmBool(cmCfg(settings, 'stageABucketOrderEnabled', true), true)
            && cmBool(cmCfg(settings, 'stageABucketPrimaryAnchorOnlyCrossBucket', true), true)
            && picked.primary
            && picked.rank > 0
        ) {
            const primaryDetails = hardDetails.filter(detail => detail.term === picked.primary);
            const secondaryDetails = hardDetails.filter(detail => detail.term !== picked.primary);
            const primaryMass = cmAnchorMassFromDetails(primaryDetails, anchorMaps.hardAnchorScoreMap, hardMinScore, relaxedShareCap, relaxedMassCap).total;
            const secondaryMass = cmAnchorMassFromDetails(secondaryDetails, anchorMaps.hardAnchorScoreMap, hardMinScore, relaxedShareCap, relaxedMassCap).total;
            const secondaryWeight = cmNum(cmCfg(settings, 'stageABucketSecondaryHardBonusWeight', 0.35), 0.35);
            hardMass = Number((primaryMass + secondaryWeight * secondaryMass).toFixed(3));
            secondaryHardBonusComponent = cmNum(cmCfg(settings, 'stageAPoolHardWeight', 5.2), 5.2) * secondaryWeight * secondaryMass;
        }
        const eventMass = cmAnchorMassFromDetails(eventDetails, anchorMaps.eventCandidateScoreMap, eventCandidateMinScore, relaxedShareCap, relaxedMassCap).total;
        const auxMass = cmAnchorMassFromDetails(auxDetails, anchorMaps.auxAnchorScoreMap, auxAnchorMinScore, relaxedShareCap, relaxedMassCap).total;
        const poolHardComponent = cmNum(cmCfg(settings, 'stageAPoolHardWeight', 5.2), 5.2) * hardMass;
        const poolEventComponent = cmNum(cmCfg(settings, 'stageAPoolEventWeight', 4.4), 4.4) * eventMass;
        const poolAuxComponent = cmNum(cmCfg(settings, 'stageAPoolAuxWeight', 1.2), 1.2) * auxMass;
        const queryComponent = cmNum(cmCfg(settings, 'stageAQueryAssistWeight', 0.25), 0.25) * Math.max(0, adjustedScore);
        const overlapHits = new Set(poolMatchDetails.map(detail => detail.sourceTerm || detail.term).filter(Boolean)).size;
        const overlapComponent = cmNum(cmCfg(settings, 'stageAOverlapBonusWeight', 0.8), 0.8) * Math.log1p(Math.max(0, overlapHits));
        const importanceComponent = cmNum(cmCfg(settings, 'stageAImportanceWeight', 0.9), 0.9) * normalizeCoreMemoryImportance(memory.importance);
        const noPoolComponent = poolHitCount <= 0 ? Math.max(0, cmNum(cmCfg(settings, 'stageANoPoolPenalty', 4.0), 4.0)) : 0;
        const stageScore = poolHardComponent
            + poolEventComponent
            + poolAuxComponent
            + queryComponent
            + overlapComponent
            + importanceComponent
            - noPoolComponent;
        if (stageScore <= 0) return;
        scored.push({
            id: index,
            memory,
            tier: scoreProfile.tier,
            score: stageScore,
            poolHitCount,
            poolHardHits: hardHitTerms.length,
            poolHardComponent,
            poolEventComponent,
            poolAuxComponent,
            primaryAnchor: picked.primary,
            primaryAnchorRank: picked.rank,
            hardHitsAll: hardHitTerms,
            secondaryHardBonusComponent,
            queryComponent,
            overlapComponent,
            importanceComponent,
            noPoolComponent
        });
    });

    if (stageaV1Enabled) {
        if (cmBool(cmCfg(settings, 'stageABucketOrderEnabled', true), true) && cmBool(cmCfg(settings, 'stageABucketPrimaryAnchorOnlyCrossBucket', true), true)) {
            scored.sort((a, b) => {
                const poolA = cmInt(a.poolHitCount, 0) > 0 ? 0 : 1;
                const poolB = cmInt(b.poolHitCount, 0) > 0 ? 0 : 1;
                if (poolA !== poolB) return poolA - poolB;
                const rankA = cmInt(a.primaryAnchorRank, 0) > 0 ? cmInt(a.primaryAnchorRank, 0) : 1000000000;
                const rankB = cmInt(b.primaryAnchorRank, 0) > 0 ? cmInt(b.primaryAnchorRank, 0) : 1000000000;
                if (rankA !== rankB) return rankA - rankB;
                if (b.score !== a.score) return b.score - a.score;
                if (b.poolHardComponent !== a.poolHardComponent) return b.poolHardComponent - a.poolHardComponent;
                return cmInt(b.tier, 0) - cmInt(a.tier, 0);
            });
        } else {
            scored.sort((a, b) => {
                const poolDiff = Number(cmInt(b.poolHitCount, 0) > 0) - Number(cmInt(a.poolHitCount, 0) > 0);
                if (poolDiff !== 0) return poolDiff;
                if (b.poolHardComponent !== a.poolHardComponent) return b.poolHardComponent - a.poolHardComponent;
                if (b.score !== a.score) return b.score - a.score;
                return cmInt(b.tier, 0) - cmInt(a.tier, 0);
            });
        }
    } else {
        scored.sort((a, b) => (cmInt(b.tier, 0) - cmInt(a.tier, 0)) || (b.score - a.score));
    }

    const selectedRows = stageaV1Enabled && cmBool(cmCfg(settings, 'stageAPoolSoftFloorEnabled', true), true)
        ? cmApplyStageAPoolSoftFloor(scored, limit, cmInt(cmCfg(settings, 'stageAPoolSoftFloorMinHits', 30), 30))
        : scored.slice(0, limit);
    const selected = selectedRows.map(row => row.memory);
    return {
        memories: selected.slice(0, limit),
        debug: {
            mode: 'complex',
            inputCount: memories.length,
            outputCount: selected.length,
            scoredCount: scored.length,
            hardAnchorTerms: Object.entries(anchorMaps.hardAnchorScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            eventAnchorTerms: Object.entries(anchorMaps.eventCandidateScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            auxAnchorTerms: Object.entries(anchorMaps.auxAnchorScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            selectedPreview: selectedRows.slice(0, 12).map(row => ({
                score: Number(cmNum(row.score, 0).toFixed(3)),
                poolHitCount: row.poolHitCount,
                poolHardComponent: Number(cmNum(row.poolHardComponent, 0).toFixed(3)),
                poolEventComponent: Number(cmNum(row.poolEventComponent, 0).toFixed(3)),
                poolAuxComponent: Number(cmNum(row.poolAuxComponent, 0).toFixed(3)),
                primaryAnchor: row.primaryAnchor || ''
            }))
        }
    };
}

function cmStageAResolveMode(settings) {
    const lightEnabled = cmBool(cmCfg(settings, 'stageALightModeEnabled', true), true);
    const complexEnabled = cmBool(cmCfg(settings, 'stageAComplexModeEnabled', false), false);
    if (lightEnabled && complexEnabled) return { mode: 'light', lightEnabled, complexEnabled, warning: 'both_enabled_light_first' };
    if (!lightEnabled && !complexEnabled) return { mode: 'light', lightEnabled, complexEnabled, warning: 'both_disabled_fallback_light' };
    if (lightEnabled) return { mode: 'light', lightEnabled, complexEnabled, warning: '' };
    return { mode: 'complex', lightEnabled, complexEnabled, warning: '' };
}

function cmSelectStageACandidates(archiveMemories, queryText, limit, settings) {
    const memories = Array.isArray(archiveMemories) ? archiveMemories.slice() : [];
    const modeInfo = cmStageAResolveMode(settings);
    const rerankEnabled = cmBool(cmCfg(settings, 'rerankEnabled', true), true);
    let candidateLimit = memories.length;
    if (!rerankEnabled) candidateLimit = Math.min(memories.length, limit);
    const dispatch = {
        mode: modeInfo.mode,
        lightModeEnabled: modeInfo.lightEnabled,
        complexModeEnabled: modeInfo.complexEnabled,
        modeWarning: modeInfo.warning,
        thresholdMode: 'none',
        candidateLimit,
        stageaBucketNoFixedLimit: cmBool(cmCfg(settings, 'stageABucketNoFixedLimit', true), true)
    };
    let result = modeInfo.mode === 'complex'
        ? rankArchiveMemoriesComplex(memories, queryText, candidateLimit, settings)
        : rankArchiveMemoriesLight(memories, queryText, settings);
    if (!rerankEnabled) result = Object.assign({}, result, { memories: result.memories.slice(0, candidateLimit) });
    return { memories: result.memories, debug: result.debug, dispatch };
}

function rerankArchiveMemoriesWithContext(chat, chatType, candidateMemories, queryParts, limit, allMemories, settings) {
    if (!candidateMemories || candidateMemories.length === 0) return { memories: [], queryKeywords: [], debug: {} };
    const tableSettings = getCoreMemoryRerankTableSettings(settings);
    const { dfMap, totalDocs } = cmMemoryKeywordDf(allMemories && allMemories.length ? allMemories : candidateMemories);
    const genericTerms = cmEffectiveGenericTerms(settings, tableSettings, dfMap, totalDocs);
    const intimacyTerms = cmEffectiveIntimacyTerms(settings, tableSettings, dfMap, totalDocs, queryParts.queryText);
    const userProfile = cmExtractAnchorProfile(queryParts.userText || queryParts.currentMessage, queryParts.currentMessage, dfMap, totalDocs, genericTerms, intimacyTerms, settings, tableSettings);
    const assistantProfile = cmExtractAnchorProfile(queryParts.assistantText, '', dfMap, totalDocs, genericTerms, intimacyTerms, settings, tableSettings);
    const combined = cmCombineAnchorProfiles(userProfile, assistantProfile, settings);
    const forceAuxTerms = new Set(tableSettings.hardAnchorForceAuxTerms || []);

    Object.keys(combined.hardScores).forEach(token => {
        if (forceAuxTerms.has(token)) {
            combined.auxScores[token] = Math.max(cmNum(combined.auxScores[token], 0), cmNum(combined.hardScores[token], 0));
            delete combined.hardScores[token];
        }
    });
    Object.keys(combined.eventCandidateScores).forEach(token => {
        if (forceAuxTerms.has(token)) {
            combined.auxScores[token] = Math.max(cmNum(combined.auxScores[token], 0), cmNum(combined.eventCandidateScores[token], 0));
            delete combined.eventCandidateScores[token];
        }
    });

    const stateKey = getCoreMemoryChatKey(chatType, chat && chat.id ? chat.id : 'unknown');
    const carryoverDebug = { enabled: cmBool(cmCfg(settings, 'rerankAnchorCarryoverEnabled', false), false), applied: [], skipped: [], fallbackApplied: [] };
    const weakMessage = cmWeakMessage(queryParts.currentMessage, settings, tableSettings);
    if (carryoverDebug.enabled && (weakMessage || Object.keys(combined.hardScores).length === 0)) {
        const previous = cmConsumeState(coreMemoryAnchorState, stateKey).anchors;
        const topPrevious = Object.entries(previous).sort((a, b) => b[1] - a[1]).slice(0, cmInt(cmCfg(settings, 'rerankAnchorCarryoverKeepTopk', 6), 6));
        const auxLinkTerms = Object.entries(combined.auxScores).sort((a, b) => b[1] - a[1]).slice(0, cmInt(cmCfg(settings, 'rerankCarryoverLinkAuxTopk', 6), 6)).map(([token]) => token);
        const currentLinkTerms = new Set([...Object.keys(combined.hardScores), ...auxLinkTerms]);
        const currentNorm = cmNorm(queryParts.currentMessage);
        const decay = weakMessage ? cmNum(cmCfg(settings, 'rerankAnchorCarryoverDecay', 0.85), 0.85) : cmNum(cmCfg(settings, 'rerankAnchorCarryoverStrongDecay', 0.65), 0.65);
        let applied = 0;
        topPrevious.forEach(([token, value]) => {
            if (forceAuxTerms.has(token)) {
                carryoverDebug.skipped.push(token);
                return;
            }
            if (cmBool(cmCfg(settings, 'rerankCarryoverRequireLink', true), true) && !cmAnchorLinkedToCurrent(token, currentLinkTerms, currentNorm)) {
                carryoverDebug.skipped.push(token);
                return;
            }
            const decayed = value * decay;
            if (decayed > cmNum(combined.hardScores[token], 0)) {
                combined.hardScores[token] = Number(decayed.toFixed(3));
                carryoverDebug.applied.push(token);
                applied++;
            }
        });
        if (applied === 0 && weakMessage) {
            topPrevious.slice(0, cmInt(cmCfg(settings, 'rerankCarryoverWeakFallbackTopk', 1), 1)).forEach(([token, value]) => {
                if (forceAuxTerms.has(token)) return;
                const decayed = value * decay;
                if (decayed > cmNum(combined.hardScores[token], 0)) {
                    combined.hardScores[token] = Number(decayed.toFixed(3));
                    carryoverDebug.fallbackApplied.push(token);
                }
            });
        }
    }

    const topicLockEnabled = cmBool(cmCfg(settings, 'rerankTopicLockEnabled', true), true);
    const topicState = topicLockEnabled ? cmConsumeState(coreMemoryTopicLockState, stateKey) : { anchors: {}, ttlBefore: 0, ttlAfter: 0 };
    const topicLockTerms = new Set();
    Object.entries(topicState.anchors || {}).forEach(([token, score]) => {
        const decayed = score * cmNum(cmCfg(settings, 'rerankTopicLockDecay', 0.9), 0.9);
        if (decayed > cmNum(combined.hardScores[token], 0) && !forceAuxTerms.has(token)) combined.hardScores[token] = Number(decayed.toFixed(3));
        topicLockTerms.add(token);
    });

    const hardMinScore = cmNum(cmCfg(settings, 'rerankHardAnchorMinScore', 5.0), 5.0);
    const hardAnchorScoreMap = {};
    Object.entries(combined.hardScores).forEach(([token, score]) => {
        if (!forceAuxTerms.has(token) && score >= hardMinScore) hardAnchorScoreMap[token] = score;
    });
    const hardAnchorTerms = Object.entries(hardAnchorScoreMap).sort((a, b) => b[1] - a[1]);
    const hardAnchorRankMap = {};
    hardAnchorTerms.forEach(([token], index) => { hardAnchorRankMap[token] = index + 1; });
    const eventCandidateMin = cmNum(cmCfg(settings, 'rerankEventCandidateMinScore', 2.4), 2.4);
    const eventCandidateScoreMap = {};
    Object.entries(combined.eventCandidateScores).forEach(([token, score]) => {
        if (!forceAuxTerms.has(token) && !hardAnchorScoreMap[token] && score >= eventCandidateMin) eventCandidateScoreMap[token] = score;
    });
    const auxMin = cmNum(cmCfg(settings, 'rerankAuxAnchorMinScore', 2.0), 2.0);
    const auxAnchorScoreMap = {};
    Object.entries(combined.auxScores).forEach(([token, score]) => {
        if (!forceAuxTerms.has(token) && !hardAnchorScoreMap[token] && !eventCandidateScoreMap[token] && score >= auxMin) auxAnchorScoreMap[token] = score;
    });

    const coreAnchorScores = cmBuildTopicCoreAnchorScores(hardAnchorTerms, combined.slotSets, settings, tableSettings);
    if (carryoverDebug.enabled && Object.keys(combined.hardScores).length > 0) {
        cmSaveState(coreMemoryAnchorState, stateKey, combined.hardScores, cmInt(cmCfg(settings, 'rerankAnchorCarryoverTtl', 4), 4), 8);
    }
    if (topicLockEnabled && Object.keys(coreAnchorScores).length > 0) {
        cmSaveState(coreMemoryTopicLockState, stateKey, coreAnchorScores, cmInt(cmCfg(settings, 'rerankTopicLockTtl', 2), 2), cmInt(cmCfg(settings, 'rerankTopicCoreTopk', 6), 6));
    }

    const scoringTermPool = new Set([...Object.keys(hardAnchorScoreMap), ...Object.keys(eventCandidateScoreMap), ...Object.keys(auxAnchorScoreMap)]);
    const scoringTermScoreMap = Object.assign({}, hardAnchorScoreMap, eventCandidateScoreMap, auxAnchorScoreMap);
    const aliasMaps = cmParseAliasMaps(tableSettings);
    const genericNormTerms = new Set([...genericTerms, ...intimacyTerms].map(cmNorm));
    const recencyMap = cmQueryRecencyMap(queryParts.queryText, settings);
    const timestamps = candidateMemories.map(cmParseMemoryTime).filter(Boolean);
    const maxTs = Math.max(0, ...timestamps);
    const minTs = Math.min(maxTs, ...timestamps);
    const selectedDebug = { formula: 'score = tier_effective*tier_multiplier + base_score(pool_in/pool_out) + anchor_boost*hard_mass + event_boost*event_mass + aux_gain + idf_weight*idf_sum + slot_boost*slot_coverage + memory_recency_weight*recency + front_anchor_boost - rear_anchor_penalty - generic_penalty*generic_hits - no_pool_penalty' };

    const scoredRows = [];
    candidateMemories.forEach((memory, index) => {
        const matchedAll = cmMatchKeywordsInText(memory, queryParts.queryText, tableSettings);
        if (!matchedAll.length) return;
        const poolDetails = cmBuildPoolMatchDetails(
            matchedAll,
            scoringTermPool,
            scoringTermScoreMap,
            aliasMaps.aliasNormToCanonical,
            cmBool(cmCfg(settings, 'rerankRelaxedKeywordMatchEnabled', true), true),
            settings
        );
        const poolSets = cmPoolTermNormSets(poolDetails);
        const scoreProfile = cmScoreMatchedTermsWithWeights(
            matchedAll,
            memory,
            recencyMap,
            genericNormTerms,
            Math.max(0, Math.min(1, cmNum(cmCfg(settings, 'stageAGenericMatchWeight', 0.35), 0.35))),
            Math.max(0.1, cmNum(cmCfg(settings, 'rerankQueryRecencyTier2Threshold', 1.6), 1.6)),
            Math.max(0.1, cmNum(cmCfg(settings, 'rerankQueryRecencyTier1Threshold', 0.8), 0.8)),
            Math.max(0, cmNum(cmCfg(settings, 'rerankBasePoolInWeight', 1.0), 1.0)),
            Math.max(0, cmNum(cmCfg(settings, 'rerankBasePoolOutWeight', 0.25), 0.25)),
            poolSets.termNorms,
            poolSets.sourceNorms
        );
        if (scoreProfile.score <= 0) return;
        const matchedTerms = poolDetails.map(detail => detail.term).filter(Boolean);
        const matchedSet = new Set(matchedTerms);
        const hardDetails = poolDetails.filter(detail => hardAnchorScoreMap[detail.term]);
        const eventDetails = poolDetails.filter(detail => eventCandidateScoreMap[detail.term]);
        const auxDetails = poolDetails.filter(detail => auxAnchorScoreMap[detail.term]);
        const hardMass = cmAnchorMassFromDetails(hardDetails, hardAnchorScoreMap, hardMinScore, cmNum(cmCfg(settings, 'rerankRelaxedMatchMaxShare', 0.6), 0.6), cmNum(cmCfg(settings, 'rerankRelaxedMatchStandaloneMaxMass', 0.7), 0.7));
        const eventMass = cmAnchorMassFromDetails(eventDetails, eventCandidateScoreMap, eventCandidateMin, cmNum(cmCfg(settings, 'rerankRelaxedMatchMaxShare', 0.6), 0.6), cmNum(cmCfg(settings, 'rerankRelaxedMatchStandaloneMaxMass', 0.7), 0.7));
        const auxMass = cmAnchorMassFromDetails(auxDetails, auxAnchorScoreMap, auxMin, cmNum(cmCfg(settings, 'rerankRelaxedMatchMaxShare', 0.6), 0.6), cmNum(cmCfg(settings, 'rerankRelaxedMatchStandaloneMaxMass', 0.7), 0.7));
        const hardComponent = cmNum(cmCfg(settings, 'rerankAnchorBoost', 18), 18) * hardMass.total;
        const eventComponent = cmNum(cmCfg(settings, 'rerankEventCandidateBoost', 6), 6) * eventMass.total;
        let auxGainRaw = cmNum(cmCfg(settings, 'rerankAuxAnchorBoost', 2.2), 2.2) * auxMass.total;
        if (hardMass.total <= 0 && eventMass.total <= 0) auxGainRaw *= Math.max(0, cmNum(cmCfg(settings, 'rerankAuxLowSignalMultiplier', 1.8), 1.8));
        const auxCap = Math.max(0, (hardComponent + eventComponent) * cmNum(cmCfg(settings, 'rerankAuxMaxShare', 0.35), 0.35));
        const auxGain = auxCap > 0 ? Math.min(auxGainRaw, auxCap) : auxGainRaw;
        const idfStrict = poolDetails.reduce((sum, detail) => sum + (detail.matchType === 'relaxed' ? 0 : cmIdf(detail.term, dfMap, totalDocs) * detail.weight), 0);
        const idfRelaxed = poolDetails.reduce((sum, detail) => sum + (detail.matchType === 'relaxed' ? cmIdf(detail.term, dfMap, totalDocs) * detail.weight : 0), 0);
        const relaxedCap = idfStrict > 0 ? idfStrict * cmNum(cmCfg(settings, 'rerankRelaxedMatchMaxShare', 0.6), 0.6) : cmNum(cmCfg(settings, 'rerankRelaxedMatchStandaloneMaxIdf', 3.2), 3.2);
        const idfSum = idfStrict + Math.min(idfRelaxed, relaxedCap);
        const eventSlot = cmCalculateEventSlotCoverage(matchedSet, combined.slotSets, settings);
        const tierEffective = cmBool(cmCfg(settings, 'rerankDisableTierWhenNoPoolHit', true), true) && matchedSet.size <= 0 ? 0 : scoreProfile.tier;
        const tierComponent = tierEffective * Math.max(0, cmNum(cmCfg(settings, 'rerankTierMultiplier', 0), 0));
        const genericHits = matchedTerms.filter(term => genericTerms.has(term)).length;
        const hardHitTerms = Array.from(new Set(hardDetails.map(detail => detail.term)));
        const primaryAnchor = hardHitTerms.sort((a, b) => (hardAnchorRankMap[a] || 999999) - (hardAnchorRankMap[b] || 999999))[0] || '';
        let frontAnchorBoost = 0;
        let rearAnchorPenalty = 0;
        if (cmBool(cmCfg(settings, 'rerankFrontAnchorPriorityEnabled', true), true) && hardDetails.length) {
            let weightedFrontMass = 0;
            let rearHits = 0;
            hardDetails.forEach(detail => {
                const rank = cmInt(hardAnchorRankMap[detail.term], 0);
                if (!rank) return;
                const termScore = cmNum(hardAnchorScoreMap[detail.term], 0);
                if (termScore < hardMinScore) return;
                const baseMass = Math.log1p(Math.max(0, termScore - hardMinScore + 1));
                const rankWeight = 1 / (1 + cmNum(cmCfg(settings, 'rerankFrontAnchorRankDecay', 0.25), 0.25) * Math.max(0, rank - 1));
                weightedFrontMass += baseMass * detail.weight * rankWeight;
                if (rank >= cmInt(cmCfg(settings, 'rerankFrontAnchorRearStartRank', 5), 5)) rearHits++;
            });
            frontAnchorBoost = cmNum(cmCfg(settings, 'rerankFrontAnchorPriorityWeight', 10), 10) * weightedFrontMass;
            const tolerance = cmInt(cmCfg(settings, 'rerankFrontAnchorRearTolerance', 2), 2);
            if (rearHits > tolerance) rearAnchorPenalty = cmNum(cmCfg(settings, 'rerankFrontAnchorRearPenaltyWeight', 3), 3) * (rearHits - tolerance);
        }
        const memoryRecencyScore = cmMemoryRecencyScore(memory, maxTs, minTs);
        const memoryRecencyComponent = Math.max(0, cmNum(cmCfg(settings, 'rerankMemoryRecencyWeight', 4), 4)) * memoryRecencyScore;
        const noPoolPenalty = matchedSet.size <= 0 ? Math.max(0, cmNum(cmCfg(settings, 'rerankNoPoolMatchPenalty', 60), 60)) : 0;
        const score = tierComponent
            + scoreProfile.score
            + hardComponent
            + eventComponent
            + auxGain
            + cmNum(cmCfg(settings, 'rerankIdfWeight', 2), 2) * idfSum
            + cmNum(cmCfg(settings, 'rerankEventSlotBoost', 10), 10) * eventSlot.coverage
            + memoryRecencyComponent
            + frontAnchorBoost
            - cmNum(cmCfg(settings, 'rerankGenericPenalty', 5), 5) * genericHits
            - rearAnchorPenalty
            - noPoolPenalty;
        scoredRows.push({
            id: index,
            memory,
            score,
            matchedSet,
            matchedSetAll: new Set(matchedAll),
            matchedTerms,
            matchedTermsAll: matchedAll,
            poolMatchDetails: poolDetails,
            poolMatchedCount: matchedSet.size,
            tier: tierEffective,
            tierRaw: scoreProfile.tier,
            baseScore: scoreProfile.score,
            basePoolInHits: scoreProfile.poolInHits,
            basePoolOutHits: scoreProfile.poolOutHits,
            hardAnchorHits: hardHitTerms.length,
            hardHitsAll: hardHitTerms,
            primaryAnchor,
            primaryAnchorRank: primaryAnchor ? hardAnchorRankMap[primaryAnchor] || 0 : 0,
            eventCandidateHits: eventDetails.length,
            auxAnchorHits: auxDetails.length,
            genericHits,
            memoryTimestampSort: cmParseMemoryTime(memory) || 0
        });
    });

    const coreAnchorSet = new Set(Object.keys(coreAnchorScores));
    const coreNonOutcomeTerms = new Set(Array.from(coreAnchorSet).filter(term => !(combined.slotSets.outcome || new Set()).has(term)));
    let constrained = cmApplyTopicRowConstraints(scoredRows, coreAnchorSet, topicLockTerms, coreNonOutcomeTerms, settings);
    let rows = constrained.rows;
    const dynamicDebug = { enabled: cmBool(cmCfg(settings, 'rerankDynamicTermGateEnabled', false), false), protection: { enabled: false, skipped: true } };
    if (dynamicDebug.enabled) {
        const strengthMap = cmBuildStageATermStrengthMap(rows, hardAnchorScoreMap);
        const gate = cmSelectDynamicGateTerms(
            strengthMap,
            cmInt(cmCfg(settings, 'rerankDynamicTermGateMinTopk', 2), 2),
            cmInt(cmCfg(settings, 'rerankDynamicTermGatePLow', 40), 40),
            cmInt(cmCfg(settings, 'rerankDynamicTermGatePMid', 50), 50),
            cmInt(cmCfg(settings, 'rerankDynamicTermGatePHigh', 80), 80)
        );
        dynamicDebug.termStrengthMap = strengthMap;
        dynamicDebug.gatedAnchorTerms = gate.terms;
        dynamicDebug.threshold = gate.meta.threshold;
        dynamicDebug.percentiles = gate.meta.percentiles;
    }

    if (!rows.length) {
        return {
            memories: candidateMemories.slice(0, limit),
            queryKeywords: ['mode:unified', ...hardAnchorTerms.slice(0, 8).map(([token]) => token)],
            debug: Object.assign(selectedDebug, { fallback: 'stage_a_empty_scored_rows', hardAnchorTerms, carryover: carryoverDebug })
        };
    }

    rows.sort((a, b) => b.score - a.score);
    let selected = cmSelectWithDiversity(rows, limit, Math.max(0, cmNum(cmCfg(settings, 'rerankDiversityPenalty', 0), 0)));
    const emotionCap = cmApplyTopicEmotionCap(selected, rows, limit, settings, tableSettings);
    selected = emotionCap.rows;
    if (dynamicDebug.enabled && dynamicDebug.gatedAnchorTerms) {
        const protectedRows = cmApplyDynamicTermGateProtection(
            selected,
            rows,
            limit,
            dynamicDebug.gatedAnchorTerms,
            cmInt(cmCfg(settings, 'rerankDynamicTermGateProtectPerTerm', 1), 1),
            cmInt(cmCfg(settings, 'rerankDynamicTermGateProtectMax', 6), 6)
        );
        selected = protectedRows.rows;
        dynamicDebug.protection = protectedRows.debug;
    }
    const penetration = cmApplyPenetrationGate(selected, rows, limit, settings);
    selected = penetration.rows.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.memoryTimestampSort - a.memoryTimestampSort;
    });

    const memories = selected.map(row => row.memory);
    if (cmBool(cmCfg(settings, 'stageAFillToLimit', true), true) && memories.length < Math.min(limit, candidateMemories.length)) {
        const seen = new Set(memories.map(makeCoreMemoryDedupKey));
        candidateMemories.forEach(memory => {
            if (memories.length >= Math.min(limit, candidateMemories.length)) return;
            const key = makeCoreMemoryDedupKey(memory);
            if (seen.has(key)) return;
            seen.add(key);
            memories.push(memory);
        });
    }

    const topicMode = cmShouldUseTopicMode(combined.hardScores, settings);
    const queryKeywords = ['mode:unified', ...hardAnchorTerms.slice(0, 8).map(([token]) => token)];
    Object.keys(eventCandidateScoreMap).slice(0, 4).forEach(token => queryKeywords.push(`evt:${token}`));
    Object.keys(auxAnchorScoreMap).slice(0, 6).forEach(token => queryKeywords.push(`aux:${token}`));
    Object.keys(coreAnchorScores).slice(0, 5).forEach(token => queryKeywords.push(`core:${token}`));

    return {
        memories,
        queryKeywords,
        debug: Object.assign(selectedDebug, {
            mode: 'unified',
            top1: Number(topicMode.top1.toFixed(3)),
            top2: Number(topicMode.top2.toFixed(3)),
            hardAnchorTerms: hardAnchorTerms.slice(0, 12),
            auxAnchorTerms: Object.entries(auxAnchorScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            eventCandidateTerms: Object.entries(eventCandidateScoreMap).sort((a, b) => b[1] - a[1]).slice(0, 12),
            coreAnchorTerms: Object.entries(coreAnchorScores).sort((a, b) => b[1] - a[1]).slice(0, 10),
            carryover: carryoverDebug,
            topicLock: { enabled: topicLockEnabled, ttlBefore: topicState.ttlBefore, ttlAfter: topicState.ttlAfter, activeTerms: Array.from(topicLockTerms) },
            topicConstraints: constrained.debug,
            emotionCap: emotionCap.debug,
            dynamicTermGate: dynamicDebug,
            penetrationGate: penetration.debug,
            finalCount: memories.length,
            selectedPreview: selected.slice(0, 12).map(row => ({
                score: Number(row.score.toFixed(3)),
                tier: row.tier,
                tierRaw: row.tierRaw,
                baseScore: Number(row.baseScore.toFixed(3)),
                matchedTerms: row.matchedTerms,
                hardAnchorHits: row.hardAnchorHits,
                eventCandidateHits: row.eventCandidateHits,
                auxAnchorHits: row.auxAnchorHits,
                genericHits: row.genericHits,
                primaryAnchor: row.primaryAnchor
            }))
        })
    };
}

function rankArchiveCoreMemories(archiveItems, queryTextOrParts, settings, context = {}) {
    const limit = Math.max(
        cmInt(settings.archiveRecallCount, 20) || 20,
        cmInt(settings.memoryRecallMinCount, 20) || 20
    );
    const queryParts = typeof queryTextOrParts === 'string'
        ? { userText: queryTextOrParts, assistantText: '', currentMessage: queryTextOrParts, queryText: queryTextOrParts }
        : queryTextOrParts;
    const queryText = queryParts.queryText || queryParts.userText || queryParts.currentMessage || '';
    const stageA = cmSelectStageACandidates(archiveItems, queryText, limit, settings);
    if (!stageA.memories.length) {
        if (typeof window !== 'undefined') {
            window.lastCoreMemoryRerankDebug = {
                mode: 'unified',
                reason: 'stage_a_empty',
                stagea_dispatch: stageA.dispatch,
                stagea_light_debug: stageA.debug
            };
        }
        return [];
    }
    if (settings.rerankEnabled === false) {
        if (typeof window !== 'undefined') {
            window.lastCoreMemoryRerankDebug = {
                mode: 'disabled',
                stagea_dispatch: stageA.dispatch,
                stagea_light_debug: stageA.debug
            };
        }
        return stageA.memories.slice(0, limit);
    }
    const result = rerankArchiveMemoriesWithContext(
        context.chat || { id: 'unknown' },
        context.chatType || 'private',
        stageA.memories,
        queryParts,
        limit,
        context.allMemories || archiveItems,
        settings
    );
    if (result && result.debug) {
        result.debug.stagea_dispatch = stageA.dispatch;
        if (stageA.dispatch.mode === 'light') result.debug.stagea_light_debug = stageA.debug;
        else result.debug.stagea_complex_debug = stageA.debug;
    }
    if (typeof window !== 'undefined') window.lastCoreMemoryRerankDebug = result.debug;
    return result.memories;
}

function selectCoreMemoriesForPrompt(chat, chatType, options = {}) {
    if (!chat || !chat.id) return [];
    const record = getCoreMemoryRecordSync(chatType, chat.id);
    if (!record || !Array.isArray(record.items) || record.items.length === 0) return [];

    const settings = Object.assign(getCoreMemoryDefaultSettings(), record.settings || {});
    if (!settings.enabled || !settings.uploadToAi) return [];

    const items = sortCoreMemoryItems(record.items);
    const recentCount = Math.max(1, cmInt(settings.recentMemoryCount, 70) || 70);
    const recentItems = items.slice(-recentCount);
    const archiveItems = items.slice(0, Math.max(0, items.length - recentCount));
    if (archiveItems.length === 0) return recentItems;

    const queryParts = options.queryText
        ? { userText: options.queryText, assistantText: '', currentMessage: options.queryText, queryText: options.queryText }
        : cmBuildMemoryQueryParts(chat, settings);
    const recalledItems = rankArchiveCoreMemories(archiveItems, queryParts, settings, { chat, chatType, allMemories: items });

    const merged = [];
    const seen = new Set();
    [...recalledItems, ...recentItems].forEach(item => {
        const key = makeCoreMemoryDedupKey(item);
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
        }
    });
    return sortCoreMemoryItems(merged);
}

function buildCoreMemoryPromptForChat(chat, chatType, options = {}) {
    const record = chat && chat.id ? getCoreMemoryRecordSync(chatType, chat.id) : null;
    const settings = Object.assign(getCoreMemoryDefaultSettings(), record && record.settings ? record.settings : {});
    const selected = selectCoreMemoriesForPrompt(chat, chatType, options);
    return formatCoreMemoryForPrompt(selected, { includeKeywords: !!settings.uploadKeywords });
}

if (typeof window !== 'undefined') {
    window.buildCoreMemoryQueryText = buildCoreMemoryQueryText;
    window.selectCoreMemoriesForPrompt = selectCoreMemoriesForPrompt;
    window.buildCoreMemoryPromptForChat = buildCoreMemoryPromptForChat;
    window.normalizeCoreMemoryListSetting = normalizeCoreMemoryListSetting;
    window.getCoreMemoryRerankTableSettings = getCoreMemoryRerankTableSettings;
    window.rankArchiveCoreMemories = rankArchiveCoreMemories;
    window.rerankArchiveMemoriesWithContext = rerankArchiveMemoriesWithContext;
    window.rankArchiveMemoriesLight = rankArchiveMemoriesLight;
    window.rankArchiveMemoriesComplex = rankArchiveMemoriesComplex;
    window.cmSelectStageACandidates = cmSelectStageACandidates;
    window.WECHAT_RERANK_GENERIC_TERMS = WECHAT_RERANK_GENERIC_TERMS;
    window.WECHAT_RERANK_INTIMACY_TERMS = WECHAT_RERANK_INTIMACY_TERMS;
    window.WECHAT_RERANK_EVENT_VERB_WHITELIST = WECHAT_RERANK_EVENT_VERB_WHITELIST;
    window.WECHAT_RERANK_EVENT_OUTCOME_TERMS = WECHAT_RERANK_EVENT_OUTCOME_TERMS;
    window.WECHAT_RERANK_EVENT_CANDIDATE_BLOCK_TERMS = WECHAT_RERANK_EVENT_CANDIDATE_BLOCK_TERMS;
    window.WECHAT_RERANK_HARD_ANCHOR_NOUN_WHITELIST = WECHAT_RERANK_HARD_ANCHOR_NOUN_WHITELIST;
    window.WECHAT_RERANK_HARD_ANCHOR_BLOCK_TERMS = WECHAT_RERANK_HARD_ANCHOR_BLOCK_TERMS;
    window.WECHAT_RERANK_HARD_ANCHOR_FORCE_AUX_TERMS = WECHAT_RERANK_HARD_ANCHOR_FORCE_AUX_TERMS;
    window.WECHAT_RERANK_TERM_ALIASES = WECHAT_RERANK_TERM_ALIASES;
    window.WECHAT_RERANK_ALPHA_CODE_TOKENS = WECHAT_RERANK_ALPHA_CODE_TOKENS;
}

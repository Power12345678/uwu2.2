# 微信机器人当前启用记忆链路移植到 uwu 小手机技术文档

## 1. 目标

本次移植只搬微信机器人当前实际启用、正在使用的记忆链路，不移植历史实验按钮和已关闭分支。

核心目标：

1. uwu 小手机支持与微信机器人完全一致的核心记忆 JSON 文件。
2. 微信机器人 `CoreMemory/*_core_memory.json` 可以直接导入 uwu。
3. uwu 导出的核心记忆 JSON 可以直接放回微信机器人 `CoreMemory` 使用。
4. uwu 的长期记忆从“收藏日记为主”升级为“微信同格式核心记忆池 + 当前启用召回链路”。
5. 不把未开启、废弃、实验性按钮移植进 uwu，避免复杂度膨胀。

## 2. 当前启用状态

以下状态来自当前 `微信机器人/config.py`，也是本次移植的准绳。

### 2.1 要移植的开启链路

| 功能 | 当前值 | 移植结论 |
| --- | --- | --- |
| 总记忆功能 | `ENABLE_MEMORY = True` | 移植 |
| 核心记忆独立 JSON | `SAVE_MEMORY_TO_SEPARATE_FILE = True` | 移植 |
| 记忆上传给 AI | `UPLOAD_MEMORY_TO_AI = True` | 移植 |
| 关键词上传给 AI | `UPLOAD_MEMORY_KEYWORDS = False` | 不把关键词写进 prompt，关键词只用于召回 |
| 按聊天轮数总结 | `ENABLE_MEMORY_SUMMARY_TRIGGER_BY_CHAT_ROUND = True` | 移植 |
| 按日志条数总结 | `ENABLE_MEMORY_SUMMARY_TRIGGER_BY_LOG_COUNT = False` | 不移植 |
| 轮数总结阈值 | `MAX_CHAT_ROUND_ENTRIES = 12` | 移植 |
| 最新记忆池 | `RECENT_MEMORY_COUNT = 70` | 移植 |
| 老记忆池召回数 | `ARCHIVE_RECALL_COUNT = 20` | 移植 |
| 召回下限 | `MEMORY_RECALL_MIN_COUNT = 20` | 移植 |
| 召回查询回合 | `MEMORY_QUERY_TURNS = 3` | 移植 |
| 记忆重排 | `ENABLE_MEMORY_RERANK = True` | 移植当前轻量链路 |
| Stage A 轻量模式 | `STAGEA_LIGHT_MODE_ENABLED = True` | 移植 |
| Stage A 复杂模式 | `STAGEA_COMPLEX_MODE_ENABLED = False` | 不移植 |
| 轻量阈值复杂门 | `STAGEA_LIGHT_THRESHOLD_COMPLEX_ENABLED = False` | 不移植 |
| 轻量阈值：硬+事件优先 | `STAGEA_LIGHT_THRESHOLD_PRIORITY_HARD_EVENT_ONLY = False` | 不移植 |
| 轻量阈值：允许辅助补齐 | `STAGEA_LIGHT_THRESHOLD_ALLOW_AUX_FILL = False` | 不移植 |
| 锚点 carryover | `RERANK_ANCHOR_CARRYOVER_ENABLED = False` | 不移植 |
| 主题锁 | `RERANK_TOPIC_LOCK_ENABLED = True` | 移植 |
| 事件动词/事件池 | `RERANK_EVENT_VERB_ENABLED = True`、`RERANK_EVENT_CANDIDATE_ENABLED = True` | 移植 |
| 自动发现泛词/亲密词 | `RERANK_AUTO_DISCOVER_TERMS = True` | 移植 |
| 老记忆池自动清理 | `AUTO_CLEAN_ARCHIVE_THRESHOLD = 500`、`AUTO_CLEAN_IMPORTANCE_MAX = 2` | 移植 |
| 记忆总结专用 API | `ENABLE_MEMORY_SUMMARY_DEDICATED_API = True` | 复用 uwu 的总结 API 设置 |

### 2.2 明确不移植的冗余/废弃分支

这些功能虽然代码里有，但当前未开启或属于实验按钮，本轮不要搬：

1. 按日志条数触发总结。
2. prompt 文件内嵌记忆模式。
3. Stage A 复杂模式。
4. Stage A 复杂阈值裁剪。
5. Stage A 轻量阈值复杂门。
6. 轻量阈值里的“硬+事件优先”。
7. 轻量阈值里的“允许辅助补齐”。
8. bucket sampling。
9. 锚点 carryover。
10. dynamic term gate。
11. mixed token match。
12. 关键词字段上传给生成回复的 AI。
13. 手动合并老记忆池作为首期必需功能。

如果后续确认某个实验按钮重新启用，再单独补迁移，不在本次主链路里预留复杂 UI。

## 3. 微信机器人当前真实链路

### 3.1 写入链路

当前启用的自动总结链路：

```text
聊天上下文 chat_contexts
  -> 按完整 user/assistant 轮次计数
  -> 每新增 12 轮触发 summarize_and_save()
  -> 从 chat_contexts 重建最近 12 轮日志
  -> 调用记忆总结 API
  -> 模型输出 {"summary","keywords","importance"}
  -> 清洗与校验
  -> append 到 CoreMemory/<user>_<prompt>_core_memory.json
```

当前不走按日志条数触发。`Memory_Temp/*_log.txt` 可以存在，但不是自动总结的主触发来源。

轮次状态文件：

```text
Memory_Temp/memory_summary_round_counter.json
Memory_Temp/memory_summary_round_state.json
```

uwu 移植时不需要照搬 `Memory_Temp` 文件名，但需要保留同等语义：

1. 当前聊天累计完成轮次。
2. 上次已总结到第几轮。
3. 达到 12 轮后总结最新完整区间。

### 3.2 核心记忆文件

当前核心记忆文件为 UTF-8 JSON 数组，每条只有 4 个字段：

```json
[
  {
    "timestamp": "2026-01-26 Monday 20:15",
    "summary": "这里是长期记忆摘要。",
    "importance": 5,
    "keywords": ["关键词1", "关键词2"]
  }
]
```

互通硬规则：

1. 顶层必须是数组。
2. 每条只导出 `timestamp`、`summary`、`importance`、`keywords`。
3. 不导出 uwu 的 `id`、`chatId`、`title`、`range`、`isFavorited` 等内部字段。
4. `importance` 归一化为 1-5 整数。
5. `keywords` 是去重后的字符串数组。
6. 顺序保持“旧在前，新在后”。

### 3.3 读取与注入链路

当前启用的读取链路：

```text
load_core_memory_from_json()
  -> select_memories_for_prompt()
  -> 最新 70 条无条件保留
  -> 老记忆池按当前 3 个用户回合上下文召回 20 条
  -> ENABLE_MEMORY_RERANK=True 时精排
  -> format_json_memories_for_prompt()
  -> 注入 prompt
```

注入格式：

```text
## 记忆片段 [2026-01-26 Monday 20:15]
**重要度**: 5
**摘要**: ...
```

当前 `UPLOAD_MEMORY_KEYWORDS = False`，所以 prompt 中不附带关键词行。

### 3.4 当前召回链路

本次只移植当前启用的轻量召回链路：

1. `MEMORY_QUERY_TURNS = 3`
   - 查询文本来自当前输入 + 最近 3 个用户回合及其间助手回复。

2. 双层记忆池：
   - 最新池：最后 70 条，全部注入。
   - 老记忆池：除最新 70 条之外的记忆。

3. Stage A：
   - 使用轻量模式。
   - 不启用复杂模式。
   - 不启用轻量阈值复杂门。
   - 不启用“硬+事件优先”阈值分支。
   - 不启用“辅助补齐”阈值分支。

4. Stage B：
   - `ENABLE_MEMORY_RERANK = True`，保留当前精排。
   - 用户锚点与助手锚点同权。
   - 泛词不进入硬锚点。
   - 事件动词与事件候选池启用。
   - 主题锁启用。
   - 锚点 carryover 关闭。

### 3.5 当前清理链路

当前并不是传统“最多只保留 150 条”的硬裁剪。

实际清理逻辑：

1. 最新 70 条不清理。
2. 老记忆池数量达到 500 时，删除老记忆池里 `importance <= 2` 的条目。
3. 如果老记忆池未达到 500，则不做删除。

uwu 需要照这个逻辑实现，不要做“总数 150 强制裁剪”。

## 4. uwu 目标架构

### 4.1 保持现有技术栈

继续使用：

1. 原生 JavaScript。
2. Dexie + IndexedDB。
3. FileReader / Blob 做导入导出。
4. 现有 `fetchAiResponse()` 调用总结 API。
5. 现有设置页、Toast、Modal 风格。

### 4.2 新增最小模块

只新增当前链路需要的模块：

```text
js/modules/core_memory.js
js/modules/core_memory_recall.js
js/modules/core_memory_summary.js
js/modules/core_memory_ui.js
```

职责：

1. `core_memory.js`
   - 微信核心 JSON 格式校验。
   - Dexie 读写。
   - 导入、导出、合并去重。

2. `core_memory_recall.js`
   - 最新 70 条 + 老记忆池召回 20 条。
   - 轻量 Stage A。
   - 当前启用的 Stage B 精排必要逻辑。

3. `core_memory_summary.js`
   - 按 12 轮聊天自动总结。
   - 输出 `summary + keywords + importance`。
   - 写入核心记忆 JSON 池。

4. `core_memory_ui.js`
   - 当前角色核心记忆导入/导出。
   - 当前条数、最近池、老记忆池数量显示。
   - 开关只保留当前主链路必需项。

### 4.3 IndexedDB 设计

升级 Dexie，新增独立表，避免把大记忆池塞进角色对象：

```js
dexieDB.version(4).stores({
  characters: '&id',
  groups: '&id',
  worldBooks: '&id',
  myStickers: '&id',
  globalSettings: 'key',
  archives: '&id,characterId,timestamp',
  coreMemoryFiles: '&chatKey,chatId,chatType,sourceFileName,updatedAt'
});
```

记录结构：

```js
{
  chatKey: "private:char_123",
  chatId: "char_123",
  chatType: "private",
  sourceFileName: "11_solo_core_memory.json",
  wechatUserId: "11",
  wechatPromptName: "solo",
  importedAt: 1760000000000,
  updatedAt: 1760000000000,
  dirty: false,
  items: [
    {
      timestamp: "2026-01-26 Monday 20:15",
      summary: "...",
      importance: 5,
      keywords: ["..."]
    }
  ],
  roundCounter: 0,
  lastSummarizedRound: 0,
  settings: {
    enabled: true,
    recentMemoryCount: 70,
    archiveRecallCount: 20,
    memoryRecallMinCount: 20,
    memoryQueryTurns: 3,
    autoSummaryByRound: true,
    autoSummaryRoundEntries: 12,
    uploadKeywordsToPrompt: false,
    autoCleanArchiveThreshold: 500,
    autoCleanImportanceMax: 2,
    stageALightMode: true,
    enableRerank: true,
    enableTopicLock: true,
    enableAnchorCarryover: false
  }
}
```

导出核心 JSON 时只导出 `items`，不导出 `settings` 和轮次状态。

## 5. 移植实施步骤

### Phase 1：核心 JSON 互通

先做最小互通，不碰召回。

实现：

1. `parseWechatCoreMemoryJson(text)`
2. `normalizeCoreMemoryEntry(entry)`
3. `normalizeCoreMemoryFile(data)`
4. `getCoreMemoryRecord(chatType, chatId)`
5. `saveCoreMemoryRecord(record)`
6. `exportWechatCoreMemoryJson(items)`

导入策略：

1. 覆盖本地核心记忆。
2. 合并导入，按 `timestamp + summary` 去重。
3. 只追加新条目。

验收：

1. 当前 `11_solo_core_memory.json` 可导入。
2. 不修改直接导出后，`JSON.parse(原文件)` 与 `JSON.parse(导出文件)` 结构一致。
3. 导出文件可被微信机器人读取。

### Phase 2：接入 prompt 注入

修改 `chat_ai.js` 的 `<memoir>` 构建：

1. 先读取当前角色绑定的核心记忆。
2. 调用 `selectCoreMemoriesForPrompt(chat, currentMessage)`。
3. 把返回条目格式化为微信机器人同款记忆片段。
4. 插入到原有收藏日记前面。

注入顺序：

```text
<memoir>
【核心记忆】
最新 70 条 + 老记忆召回 20 条

【共同回忆】
原有收藏日记
</memoir>
```

关键词不注入 prompt。

### Phase 3：移植当前启用召回

实现当前主链路，不实现关闭分支。

基础函数：

1. `buildMemoryQueryText(chat, currentMessage, turns = 3)`
2. `normalizeMemoryKeywords(keywords)`
3. `matchKeywordsInText(memory, queryText)`
4. `memoryKeywordDf(memories)`
5. `scoreArchiveMemory(memory, queryText, dfMap)`
6. `rankArchiveMemoriesLight(archiveMemories, queryText)`
7. `rerankArchiveMemoriesWithContext(...)`
8. `selectCoreMemoriesForPrompt(...)`

必须保留：

1. 最新池全部注入。
2. 老记忆池召回。
3. `archiveRecallCount = 20`。
4. `memoryRecallMinCount = 20`。
5. 事件动词/事件候选池。
6. 泛词、亲密词隔离。
7. 主题锁。
8. 用户/助手锚点同权。

不要实现：

1. complex Stage A。
2. threshold complex gate。
3. hard/event priority threshold。
4. aux fill threshold。
5. carryover。
6. sampling。
7. dynamic term gate。

### Phase 4：按轮数自动总结

不要移植“按日志总结”。

uwu 的自动总结应按当前聊天对象记录：

```js
roundCounter += 1; // 每完成一轮 user + assistant 后增加

if (roundCounter - lastSummarizedRound >= 12) {
  summarizeLatestRounds(12);
  lastSummarizedRound = roundCounter;
}
```

总结输入：

1. 最新 12 个完整 user/assistant 轮次。
2. 带时间戳。
3. 带说话人名。

模型输出必须是：

```json
{"summary":"...","keywords":["...","..."],"importance":3}
```

写入：

1. 生成微信格式 timestamp。
2. 清洗 summary。
3. 清洗 keywords。
4. importance 归一化为 1-5。
5. append 到 `items` 末尾。
6. 保存 `coreMemoryFiles`。

### Phase 5：清理

实现当前启用的老记忆池清理：

```js
recent = items.slice(-70)
archive = items.slice(0, -70)

if (archive.length >= 500) {
  archive = archive.filter(memory => memory.importance > 2)
}

items = archive.concat(recent)
```

不要做总量 150 的硬删除。

### Phase 6：回忆日记兼容

保留现有 `memoryJournals`。

新增一个可选动作：“将收藏日记转换为核心记忆”。

转换结果必须进入核心记忆池，并符合微信格式：

```js
{
  timestamp: formatWechatTimestamp(new Date(journal.createdAt || Date.now())),
  summary: journal.content,
  importance: journal.isFavorited ? 4 : 3,
  keywords: extractKeywordsFromText(journal.title + "\n" + journal.content)
}
```

转换不是主链路，不能替代按轮数自动总结。

## 6. UI 只保留必要项

核心记忆设置页只保留：

1. 启用核心记忆。
2. 导入微信核心记忆 JSON。
3. 导出微信核心记忆 JSON。
4. 绑定文件名 / 微信用户 ID / prompt 名。
5. 当前总条数。
6. 最新记忆池数量：默认 70。
7. 老记忆召回数量：默认 20。
8. 自动总结开关：按轮数。
9. 自动总结轮数：默认 12。
10. 清理阈值：老记忆池 500。
11. 清理重要度：<=2。

不要出现：

1. 按日志总结。
2. 轻量阈值复杂门。
3. 硬+事件优先。
4. 允许辅助补齐。
5. complex 模式。
6. carryover。
7. dynamic gate。
8. sampling。
9. 关键词上传 prompt。

## 7. 文件互通方案

首期只做手动互通：

1. 微信机器人复制或导出 `CoreMemory/*.json`。
2. uwu 导入该 JSON。
3. uwu 运行后可继续追加核心记忆。
4. uwu 导出同格式 JSON。
5. 用户放回微信机器人 `CoreMemory`。

暂不做本地桥接服务，也不做自动监听微信目录。浏览器静态应用无法无授权读写任意本地路径，这个留到后续单独设计。

## 8. 验收标准

### 8.1 格式

1. 导入微信核心文件后条数一致。
2. 导出 JSON 顶层是数组。
3. 每条只有 `timestamp`、`summary`、`importance`、`keywords`。
4. 导出文件可被微信机器人继续读取和追加。

### 8.2 当前链路

1. 自动总结只按轮数触发，不按日志条数触发。
2. 每 12 个完整回合生成一条核心记忆。
3. 最新 70 条始终注入。
4. 老记忆池召回 20 条。
5. 关键词不出现在 prompt 里。
6. 老记忆池达到 500 后才清理重要度 <=2 的旧记忆。

### 8.3 不回归实验功能

检查 UI 与代码，确认没有出现：

1. 按日志总结按钮。
2. complex Stage A 按钮。
3. 轻量阈值复杂门按钮。
4. 硬+事件优先按钮。
5. 辅助补齐按钮。
6. carryover 按钮。

## 9. 推荐落地顺序

1. 先做核心 JSON 导入导出。
2. 再接入 prompt 注入。
3. 再做当前启用的轻量召回 + 精排。
4. 再做按 12 轮自动总结。
5. 最后做老记忆池清理与日记转换。

这版文档的原则是：只移植你现在真正使用的记忆主链路，不把曾经试过但已经关闭的按钮带进 uwu。

## 10. 当前落地进度快照（2026-05-12）

### 10.1 已完成

1. 已新增核心记忆基础模块：
   - `js/modules/core_memory.js`
   - `js/modules/core_memory_recall.js`
   - `js/modules/core_memory_summary.js`
   - `js/modules/core_memory_ui.js`
2. 已新增 Dexie `coreMemoryFiles` 表，用于保存微信同格式核心记忆池。
3. 已将旧“日记/总结”界面替换成“核心记忆”管理界面。
4. 已支持核心记忆手动新增、编辑、删除、多选、搜索、导入和导出。
5. 已在私聊、群聊、小剧场、偷看等主 prompt 路径中读取核心记忆。
6. 已移除旧日记自动总结作为主链路。
7. 已移除启动登录/验证界面，小手机直接进入主界面。

### 10.2 当前仍需补齐

1. 微信机器人式短期记忆管理界面尚未移植。
2. 还没有“清空发送给 AI 的聊天上下文，但不清空界面聊天记录”的独立按钮。
3. 还没有微信机器人式“未满 12 轮也可以手动总结核心记忆”的按钮。
4. 小手机当前轮次统计与微信机器人有细微差异，需要在下一阶段修正。
5. 短期记忆暂未支持与微信机器人 `chat_contexts.json` 互相导入导出。

## 11. Phase 7：短期记忆 UI 管理

### 11.1 微信机器人参照对象

微信机器人短期记忆来自 `chat_contexts.json`，后台 UI 位于配置编辑器的“聊天上下文管理”区域。

实际功能：

1. 用户列表来自 `chat_contexts.json` 顶级键。
2. 每个用户有两个主要动作：`编辑`、`清除临时记忆`。
3. 编辑弹窗将上下文渲染为多轮卡片：
   - 用户发言 textarea。
   - AI 回复 textarea。
   - 删除本轮按钮。
   - 添加一轮对话按钮。
   - 保存按钮。
4. 清除临时记忆会删除 `chat_contexts.json` 中对应用户的上下文，不影响核心记忆。

对应源码：

```text
微信机器人/templates/config_editor.html
  - clearUserChatContext()
  - renderChatContextRounds()
  - getChatContextRoundsFromUI()
  - addChatRound()
  - deleteChatRound()
  - editUserChatContext()
  - saveUserChatContext()

微信机器人/config_editor.py
  - /api/get_chat_context_users
  - /clear_chat_context/<username>
  - /api/get_chat_context/<username>
  - /api/save_chat_context/<username>
```

### 11.2 uwu 设计原则

小手机里的短期记忆必须明确区分两层：

1. 界面聊天记录：用户在小手机聊天页看到的完整历史。
2. 发送给 AI 的短期上下文：下次生成回复时会进入 prompt 的上下文。

下一阶段的“清空短期记忆”只清空第 2 层，不删除第 1 层。

这点必须和“清空聊天记录”按钮分开，避免误删用户界面历史。

### 11.3 建议新增模块

新增：

```text
js/modules/short_memory.js
```

职责：

1. 建立微信 `chat_contexts.json` 兼容格式。
2. 从当前 `chat.history` 初始化短期上下文。
3. 在新消息发送和 AI 完整回复结束后，同步追加短期上下文。
4. 提供 UI 读写 API。
5. 提供导入/导出 API。
6. 提供清空“发送给 AI 的短期上下文”功能。

建议 Dexie 新表：

```js
shortMemoryContexts: '&chatKey,chatId,chatType,sourceUserName,updatedAt'
```

记录结构：

```js
{
  chatKey: "private:char_123",
  chatId: "char_123",
  chatType: "private",
  sourceUserName: "11",
  importedAt: 1760000000000,
  updatedAt: 1760000000000,
  useShadowContext: true,
  items: [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

`useShadowContext = true` 表示后续 AI prompt 优先使用这份短期上下文，而不是直接从界面 `chat.history` 推导。

### 11.4 UI 方案

在现有“核心记忆”页面增加分段：

```text
[长期核心记忆] [短期上下文]
```

短期上下文页保留微信机器人核心交互：

1. 顶部状态：
   - 当前短期上下文条数。
   - 当前完整轮数。
   - 预计发送给 AI 的条数。
   - 是否使用独立短期上下文。
2. 操作按钮：
   - 添加一轮。
   - 保存修改。
   - 清空发送给 AI 的短期记忆。
   - 从界面聊天记录重建。
   - 导入微信 `chat_contexts.json`。
   - 导出微信 `chat_contexts.json`。
3. 每轮卡片：
   - 第 N 轮。
   - 用户发言 textarea。
   - AI 回复 textarea。
   - 删除本轮。

不要把这个按钮命名为“清空聊天记录”。建议文案：

```text
清空发送给 AI 的短期记忆
```

确认弹窗文案应明确：

```text
这只会清空后续发送给 AI 的短期上下文，不会删除聊天界面里的消息。
```

### 11.5 导入导出互通

微信机器人 `chat_contexts.json` 格式：

```json
{
  "11": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

uwu 建议支持两种导入：

1. 完整 `chat_contexts.json`：让用户选择顶级用户键，并绑定到当前角色或群聊。
2. 单用户数组：直接导入为当前聊天的短期上下文。

uwu 导出建议提供两种：

1. 单用户数组：

```json
[
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]
```

2. 微信完整对象：

```json
{
  "11": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

为了能直接放回微信机器人，完整对象模式应作为推荐导出。

## 12. Phase 8：手动总结核心记忆按钮

### 12.1 微信机器人行为

微信机器人支持跳过阈值检查手动总结：

1. 配置页核心记忆文件列表中有 `手动总结` 按钮。
2. 聊天命令也支持 `/总结` 或 `/ms`。
3. 后端调用 `summarize_and_save(user_id, skip_check=True)`。
4. 即使未满 12 轮，也会用当前可用轮次生成核心记忆。
5. 如果启用按轮数总结，手动总结完成后会更新轮次游标，避免同一批内容下次又被自动总结一次。

### 12.2 uwu 目标行为

在“核心记忆”页面增加：

```text
手动总结核心记忆
```

行为：

1. 不要求当前聊天已满 12 轮。
2. 优先读取短期上下文兼容层中的完整轮次。
3. 如果短期上下文兼容层不存在，则从 `chat.history` 推导完整轮次。
4. 总结窗口使用最近 `MAX_CHAT_ROUND_ENTRIES = 12` 轮。
5. 如果当前不足 12 轮，则总结当前所有可用完整轮。
6. 总结成功后写入核心记忆 JSON 池。
7. 总结成功后将 `lastSummarizedRound` 更新到当前完整轮数。

建议新增函数：

```js
async function forceSummarizeCoreMemory(chat, chatType, options = {})
```

建议 `options`：

```js
{
  updateCursor: true,
  windowSize: 12,
  source: "manual"
}
```

### 12.3 防重复策略

手动总结成功后应更新游标：

```js
record.lastSummarizedRound = currentRoundCount;
```

这与微信机器人 `skip_check=True` 后仍更新轮次游标的行为一致。

如果用户想重复总结同一段内容，应通过“从聊天范围生成核心记忆”这类显式工具完成，而不是自动/手动总结按钮默认重复同一批轮次。

## 13. Phase 9：轮次定义修正

### 13.1 微信机器人定义

微信机器人配置页明确写着：

```text
1轮 = 1条user + 1条assistant
```

代码上：

1. 用户消息写入 `chat_contexts.json`。
2. 一次主模型调用完成后，assistant 完整回复写入 `chat_contexts.json`。
3. 如果 assistant 是报错或兜底文本，不计入轮次。

### 13.2 小手机当前实现

当前 `core_memory_summary.js` 中：

```js
let pendingUsers = [];
```

这会导致：

1. 连续 user 消息会被合并进同一轮。
2. 第一个 AI/角色消息会闭合这一轮。
3. 如果一次 AI 调用在界面里拆成多条 assistant 气泡，后续 assistant 气泡不会进入同一轮总结日志。

### 13.3 下一阶段目标定义

小手机应采用更贴近实际调用的定义：

```text
1轮 = 用户触发一次完整 AI 调用 + 该次调用的完整 AI 回复
```

解释：

1. 如果界面只有一条 AI 气泡，这条气泡就是 assistant 回合。
2. 如果一次 AI 调用被拆成多条 AI 气泡，短期记忆里应合并为一个 assistant 回合。
3. 核心记忆总结应读取短期记忆里的 assistant 完整回合，而不是只读取界面第一条 AI 气泡。

建议实现：

1. 在 `getAiReply()` 开始时创建 `turnId` 或 `aiCallId`。
2. 用户消息写入短期上下文时记录该轮。
3. 模型原始完整回复在拆分成气泡前写入短期上下文 assistant 项。
4. 界面气泡可继续拆分显示，但不影响短期记忆的一轮统计。

## 14. Phase 10：prompt 接入调整

当前小手机短期上下文主要从 `chat.history` 滑动窗口构建。下一阶段应调整为：

```text
优先读取 shortMemoryContexts.items
  -> 没有独立短期上下文时，从 chat.history 推导
  -> 应用 maxMemory / contextLimit
  -> 组装成发送给 AI 的最近聊天上下文
```

清空“发送给 AI 的短期记忆”时：

```js
shortMemoryRecord.items = [];
shortMemoryRecord.useShadowContext = true;
```

这不会删除 `chat.history`，也不会影响界面聊天气泡。

## 15. Phase 11：验收标准

### 15.1 短期记忆管理

1. 可以打开当前角色/群聊的短期上下文管理界面。
2. 可以编辑 user/assistant 文本。
3. 可以删除一轮。
4. 可以添加一轮。
5. 保存后，下一次 AI 回复读取修改后的短期上下文。
6. 清空短期上下文后，聊天界面消息仍存在。
7. 清空短期上下文后，下一次 AI 回复不再读取清空前的短期消息。

### 15.2 手动总结

1. 未满 12 轮时可以点击“手动总结核心记忆”。
2. 如果有至少 1 个完整回合，会生成核心记忆。
3. 生成结果写入微信同格式核心记忆池。
4. 导出后仍是微信机器人可读取的 JSON 数组。
5. 手动总结后不会被下一次 12 轮自动总结重复总结同一批内容。

### 15.3 轮次

1. 一次 AI 调用拆成多条界面气泡时，短期记忆只算 1 个 assistant 回合。
2. 12 轮自动总结按“完整调用轮次”计数。
3. 报错/空回复不应计入总结轮次。

### 15.4 互通

1. 微信机器人 `chat_contexts.json` 可以导入当前聊天。
2. uwu 可以导出完整对象格式 `chat_contexts.json`。
3. 导出的短期上下文放回微信机器人后，结构符合：

```json
{
  "用户名": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

## 16. 本次落地结果（2026-05-12）

### 16.1 短期记忆兼容层

已新增：

```text
js/modules/short_memory.js
```

当前行为：

1. 新增 Dexie `shortMemoryContexts` 表，保存独立短期上下文。
2. 短期上下文结构与微信机器人 `chat_contexts.json` 对齐：

```json
[
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]
```

3. 支持导入完整对象格式：

```json
{
  "11": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

4. 支持导出微信完整对象格式，方便放回微信机器人使用。
5. 如果当前聊天没有独立短期上下文，仍从小手机界面 `chat.history` 推导上下文。
6. 如果保存/导入/清空过短期上下文，则 `useShadowContext = true`，后续 AI prompt 优先读取这份短期上下文。
7. 清空短期上下文只清空发送给 AI 的上下文，不删除界面聊天记录。

### 16.2 短期记忆 UI

已在“记忆”页面增加分段：

```text
长期核心记忆
短期上下文
```

短期上下文页已支持：

1. 查看当前发送给 AI 的短期上下文条数。
2. 查看完整轮数。
3. 查看当前是否使用独立短期上下文。
4. 编辑每轮 user / assistant 文本。
5. 添加一轮。
6. 删除一轮。
7. 保存短期上下文。
8. 从界面聊天记录重建短期上下文。
9. 清空发送给 AI 的短期记忆。
10. 导入微信 `chat_contexts.json`。
11. 导出微信完整对象格式 `chat_contexts.json`。

### 16.3 手动总结核心记忆

已新增：

```js
forceSummarizeCoreMemory(chat, chatType, options)
```

UI 上已增加：

```text
手动总结核心记忆
```

当前行为：

1. 不要求满 12 轮。
2. 优先使用短期上下文兼容层里的完整轮次。
3. 没有独立短期上下文时，从 `chat.history` 推导完整轮次。
4. 默认总结最近 12 轮；不足 12 轮时总结当前可用完整轮次。
5. 总结成功后写入微信同格式核心记忆池。
6. 总结成功后更新 `lastSummarizedRound`，避免下一次自动总结重复处理同一批内容。

### 16.4 轮次定义

当前小手机已按下面定义统计短期记忆与核心总结轮次：

```text
1 轮 = 用户一次发送触发一次完整 AI 调用 + 该调用的完整 AI 回复
```

如果一次 AI 调用在界面里被拆成多条气泡，短期记忆仍只保存为一个 assistant 完整回合。核心记忆总结读取这个完整回合，而不是只读取第一条气泡。

### 16.5 Prompt 接入

当前 `chat_ai.js` 已调整为：

```text
优先读取 shortMemoryContexts.items
  -> 没有独立短期上下文时，从 chat.history 推导
  -> 再进入原本的上下文裁剪与 prompt 组装
```

这样可以实现：

1. 编辑短期上下文后，下一次 AI 会读取编辑后的内容。
2. 清空短期上下文后，下一次 AI 不会继续读取清空前的界面历史。
3. 界面聊天记录仍保留，不受短期上下文编辑影响。

## 17. 小手机与微信机器人多气泡协议兼容结论

### 17.1 微信机器人

微信机器人短期记忆的核心数据是 `role/content` 列表。它把 assistant 内容发送到微信界面时，会通过 `split_message_with_context()` 一类逻辑按分隔符拆成多条消息。

常见拆分信号包括：

1. 换行。
2. 斜杠或反斜杠类分隔符。
3. 其他微信机器人内部定义的消息分隔规则。

因此，微信机器人的“多气泡”更多是发送层拆分。

### 17.2 小手机

小手机不是靠斜杠或换行拆气泡。小手机系统提示词要求 AI 输出结构化块，例如：

```text
[角色名的消息：文本]
[角色名的语音：文本]
[角色名发送的表情包：名称]
```

随后前端 `getMixedContent()` 会解析这些块，并渲染成多条气泡、语音、图片或表情包。

因此，小手机的“多气泡”是输出协议层 + 前端解析层共同完成的。

### 17.3 兼容判断

结论：

1. 记忆文件层面兼容。
   - 核心记忆 JSON 已兼容微信格式。
   - 短期记忆 `chat_contexts.json` 已支持导入/导出。
2. 记忆内容层面兼容。
   - 微信导入的小手机短期记忆会作为历史上下文发送给 AI。
   - 小手机导出的短期记忆也符合微信 `role/content` 结构。
3. 多气泡输出协议不完全兼容。
   - 微信机器人偏向用换行/斜杠/反斜杠等分隔符拆消息。
   - 小手机偏向用 `[角色名的消息：...]` 等结构化块拆消息。
4. 核心记忆不需要处理气泡协议。
   - 核心记忆是摘要，不应该混入任何 UI 拆分格式。
5. 短期记忆可以互通，但不应直接把微信机器人的分隔符当作小手机的新回复格式指令。

## 18. 下一步开发计划

下一步建议做“输出协议适配”，而不是继续扩大记忆系统本体。

优先级：

1. 增加短期记忆导入归一化选项。
   - 保留原文。
   - 将微信机器人分隔符拆出的多条 assistant 文本重新合并为一个完整 assistant 回合。
   - 可选转换为小手机示例块格式，仅用于 prompt 示例，不写入核心记忆。
2. 增加 prompt 兼容说明开关。
   - 微信机器人 prompt 模式：强调用分隔符生成多条微信消息。
   - 小手机 prompt 模式：强调用 `[角色名的消息：...]` 块生成多条气泡。
3. 做一次真实对话验收。
   - AI 一次回复拆成多条小手机气泡。
   - 短期记忆只新增一个 assistant 完整回合。
   - 手动总结读取完整 assistant 回合。
4. 群聊短期上下文导出键名可编辑。
   - 方便和微信机器人不同用户 ID / prompt 名互通。

## 19. 私聊微信文字协议落地结果（2026-05-12）

本阶段根据新的产品决策调整方向：

```text
私聊默认对齐微信机器人纯文字聊天体验；
小手机特殊功能改成按需开启；
群聊保留小手机原结构化协议。
```

### 19.1 私聊默认协议

私聊默认启用：

```js
privateWechatTextMode = true
```

默认行为：

1. 普通 AI 回复直接输出文字。
2. 不再要求普通消息写成 `[角色名的消息：内容]`。
3. 多条气泡按微信机器人式分隔符拆分：
   - 换行
   - `$`
   - `\n`
   - 连续反斜杠
4. 如果模型仍输出旧式 `[角色名的消息：内容]`，前端会把它降级为普通文字气泡。
5. 短期记忆继续保存微信兼容的 `role/content`，普通 assistant 内容不写入小手机 UI 包装。

对应实现：

```text
js/modules/chat_ai.js
  - buildPrivateReplyItems()
  - splitPrivateTextReplyParts()
  - extractPrivatePlainMessageText()
  - getPrivateSpecialReplyType()
  - shouldKeepPrivateSpecialReply()
```

### 19.2 私聊特殊能力开关

新增角色字段：

```js
privateFeatureToggles: {
  voice: false,
  photo: false,
  sticker: false,
  transfer: false,
  gift: false,
  location: false,
  status: false,
  quote: false,
  withdraw: false,
  shop: false,
  videoCall: false,
  html: false
}
```

所有特殊能力默认关闭。只有开启对应开关后，prompt 才注入对应中括号格式。

UI 位置：

```text
角色设置 -> 私聊微信文字协议
角色设置 -> 私聊特殊能力
```

当前开关包括：

1. 表情包
2. 语音
3. 图片/视频
4. 转账
5. 礼物
6. 位置
7. 状态
8. 引用
9. 撤回
10. 商城
11. 通话
12. HTML

如果某项未开启，但 AI 仍偶发输出对应中括号格式，私聊解析层会将其降级为普通文字，不触发对应小手机功能。

### 19.3 Prompt 策略

私聊默认 prompt 现在强调：

```text
普通文字消息：直接输出消息内容。
多条气泡：用换行、$、\n 或连续反斜杠分隔。
不要添加 [角色名的消息：] 前缀。
```

特殊功能只按开关注入。例如：

1. 未开启语音：prompt 不包含 `[角色名的语音：...]`。
2. 未开启表情包：prompt 不包含表情包列表与表情包格式。
3. 未开启转账/礼物：prompt 不要求角色主动转账或送礼。
4. 未开启商城：prompt 不包含下单、代付等商城格式。

这样可以减少默认 token，也降低模型乱用特殊功能的概率。

### 19.4 群聊隔离策略

群聊不追求与微信机器人互通，继续保留小手机内部协议。

原因：

1. 群聊需要明确区分发言人。
2. 群聊有成员昵称、多人回复、群内私聊通知等小手机特色逻辑。
3. 群聊记忆文件不需要导入/导出到微信机器人。

因此当前边界为：

```text
私聊：微信机器人式纯文字协议 + 可选特殊能力。
群聊：小手机原结构化协议。
核心记忆：微信同格式 JSON。
短期记忆：微信同格式 role/content。
```

### 19.5 验收重点

下一次真实使用时优先测试：

1. 私聊 AI 输出三行普通文本，界面应显示三条气泡。
2. 私聊 AI 输出 `第一条$第二条$第三条`，界面应显示三条气泡。
3. 短期记忆中一次 AI 调用仍保存为一个 assistant 完整回合。
4. 默认关闭特殊能力时，prompt 不应出现语音、图片、转账、表情包等输出格式。
5. 开启某个特殊能力后，只有该能力对应格式进入 prompt。
6. 群聊仍能按原格式区分角色发言，不受私聊微信文字协议影响。

## 20. 微信总结 Prompt 与用户短期格式对齐（2026-05-12）

### 20.1 问题

复查后发现两处仍与微信机器人不一致：

1. 小手机核心记忆总结 prompt 仍是通用“长期记忆整理器”口径，不是微信机器人 `config.py` 当前启用的 `MEMORY_SUMMARY_PROMPT_TEMPLATE`。
2. 小手机私聊用户消息进入短期上下文时，仍可能是：

```text
朱迅的消息：嗯🥺亲亲我
```

而微信机器人保存和总结时使用的用户消息形态更接近：

```text
[2026-05-12 Tuesday 01:18:29] 嗯🥺亲亲我
```

### 20.2 核心记忆总结 Prompt 已对齐

小手机当前 `buildCoreMemorySummaryPrompt()` 已改为微信机器人 `config.py` 当前启用模板，并按 `bot.py` 的实际拼装逻辑处理 `${PROMPT_NAME}`、`${IMPORTANCE_RULES}`、`${EXTRA_FILTERS}`、`${FULL_LOGS}`：

```text
你将扮演“${PROMPT_NAME}”。请根据以下完整对话日志生成一条核心记忆，并严格只输出一个 JSON 对象。
输出格式（严格遵守，仅输出 JSON）：
{"summary":"...","keywords":["...","..."],"importance":3}
要求：
1) summary：请以司洛的口吻，第一视角写日记流水账，用中文总结与用户朱迅的对话，总结为记忆摘要，不能遗漏细节。
```

关键要求也已同步：

1. `summary` 使用微信机器人当前配置里的“司洛口吻、第一视角日记流水账”风格。
2. 保留人物、关系、地点、时间、事件、起因、经过、结果、承诺、冲突、礼物/物品、安排。
3. 不分点、不换行。
4. `keywords` 必须从对话日志原文直接抽取，禁止编造、推断、遗漏。
5. 关键词限制为 10-20 个，并按微信机器人规则过滤无意义词、常规亲密称呼、空泛词与额外过滤词。
6. 输出只允许 JSON，字段为 `summary`、`keywords`、`importance`。

额外过滤词已同步为微信机器人 `MEMORY_KEYWORD_STOPWORDS_EXTRA` 当前值：

```text
朱迅、司洛、宝宝、老公、老婆、傻瓜、笨蛋、傻子、小祖宗、祖宗、小管家婆、管家婆、哥、小妖精、怀里、卧槽、抱、抱抱、抱着、抱着你、东西、mua
```

重要度规则来自微信机器人 `MEMORY_IMPORTANCE_PROMPT_TEMPLATE`，并沿用 `bot.py` 的实际拼装行为。

### 20.3 总结日志格式已对齐

微信机器人从 `chat_contexts` 重建总结输入时使用：

```text
2026-05-12 Tuesday 01:18:29 | [11] 嗯🥺亲亲我
2026-05-12 Tuesday 01:18:30 | [solo] 亲亲。
```

小手机当前核心总结日志也改为同类格式：

```text
YYYY-MM-DD Weekday HH:MM:SS | [用户键] 用户原文
YYYY-MM-DD Weekday HH:MM:SS | [prompt名] AI原文
```

其中：

1. 用户键优先来自核心记忆文件名或 `wechatUserId`。
2. prompt 名优先来自核心记忆文件名或 `wechatPromptName`。
3. 如果短期上下文用户消息已有 `[YYYY-MM-DD Weekday HH:MM:SS]` 前缀，会复用该时间。
4. 如果没有时间戳，则按消息 timestamp 生成微信格式时间。

### 20.4 私聊短期上下文用户消息已对齐

私聊模式下，发送给 AI / 写入短期上下文的用户消息现在会被格式化为：

```text
[2026-05-12 Tuesday 01:18:29] 嗯🥺亲亲我
```

处理规则：

1. 小手机 UI 内部原始消息可以仍保留自己的显示格式。
2. 进入短期上下文和 AI prompt 前，会去掉 `朱迅的消息：` 或 `[朱迅的消息：...]` 这类 UI 包装。
3. 如果原文已经有微信时间戳，则不重复添加。
4. AI / assistant 短期内容会去掉普通消息包装，保留文本本体。
5. 群聊不套用这个规则，继续保留小手机内部群聊协议。

对应实现：

```text
js/modules/core_memory.js
  - formatWechatTimestamp()
  - formatWechatChatTimestamp()

js/modules/core_memory_summary.js
  - buildCoreMemorySummaryPrompt()
  - formatCoreMemoryMessageLine()

js/modules/short_memory.js
  - stripShortMemoryDisplayWrapper()
  - formatShortMemoryUserTextForWechat()
  - formatShortMemoryAssistantTextForWechat()
  - formatShortMemoryMessageForWechatPrompt()

js/modules/chat_ai.js
  - 私聊微信文字模式下，在发送 API 前格式化 historySlice
```

### 20.5 仍需验收

下一次真实对话重点检查：

1. 用户发送普通消息后，短期上下文 user 项是否为 `[YYYY-MM-DD Weekday HH:MM:SS] 原文`。
2. AI 回复是否仍为普通纯文本，不带 `[角色名的消息：]`。
3. 手动总结生成的 summary 是否明显接近微信机器人当前“司洛口吻、第一视角日记流水账”风格。
4. 导出的核心记忆 timestamp 是否为 `YYYY-MM-DD Weekday HH:MM`。
5. 群聊是否仍不受私聊格式转换影响。

## 21. 核心记忆 Prompt 与词表可编辑化（2026-05-12）

### 21.1 当前结论

微信机器人当前启用的手动泛词词表来自 `config.py`：

```text
MEMORY_KEYWORD_STOPWORDS_EXTRA = ['朱迅', '司洛', '宝宝', '老公', '老婆', '傻瓜', '笨蛋', '傻子', '小祖宗', '祖宗', '小管家婆', '管家婆', '哥', '小妖精', '怀里', '卧槽', '抱', '抱抱', '抱着', '抱着你', '东西', 'mua']
```

小手机默认值已与该列表一致，并新增设置项：

1. 手动泛词词表（逗号分隔）
2. 核心记忆总结提示词
3. 核心记忆重要度提示词

复查后发现微信当前开启记忆链路不止这一张词表，小手机已继续补齐以下本地精排词表：

1. `RERANK_GENERIC_TERMS`：本地精排泛词表
2. `RERANK_INTIMACY_TERMS`：亲密词表
3. `RERANK_EVENT_VERB_WHITELIST`：事件动词白名单
4. `RERANK_EVENT_OUTCOME_TERMS`：事件结果词表
5. `RERANK_EVENT_CANDIDATE_BLOCK_TERMS`：事件候选阻断词表
6. `RERANK_HARD_ANCHOR_NOUN_WHITELIST`：硬锚点名词白名单
7. `RERANK_HARD_ANCHOR_BLOCK_TERMS`：硬锚点阻断词表
8. `RERANK_HARD_ANCHOR_FORCE_AUX_TERMS`：强制辅助锚点词表
9. `RERANK_TERM_ALIASES`：统一别名表
10. `RERANK_ALPHA_CODE_TOKENS`：字母代号词表

### 21.2 保存位置

这些设置跟随当前角色/会话的核心记忆 record 保存：

```text
record.settings.memoryKeywordStopwordsExtra
record.settings.memorySummaryPromptTemplate
record.settings.memoryImportancePromptTemplate
record.settings.memoryRerankGenericTerms
record.settings.memoryRerankIntimacyTerms
record.settings.memoryRerankEventVerbWhitelist
record.settings.memoryRerankEventOutcomeTerms
record.settings.memoryRerankEventCandidateBlockTerms
record.settings.memoryRerankHardAnchorNounWhitelist
record.settings.memoryRerankHardAnchorBlockTerms
record.settings.memoryRerankHardAnchorForceAuxTerms
record.settings.memoryRerankTermAliases
record.settings.memoryRerankAlphaCodeTokens
```

如果用户留空提示词，小手机会回退到微信机器人 `config.py` 当前默认模板。

### 21.3 生成 Prompt 时的使用顺序

核心总结时：

1. 读取当前角色/会话的核心记忆 record。
2. 优先使用 record 中保存的自定义提示词和泛词词表。
3. 如果没有自定义值，则使用微信机器人默认值。
4. 按微信机器人 `bot.py` 的实际拼装方式替换：
   - `${PROMPT_NAME}`
   - `${IMPORTANCE_RULES}`
   - `${EXTRA_FILTERS}`
   - `${FULL_LOGS}`

### 21.4 实现文件

```text
js/modules/core_memory.js
  - 默认 settings 增加 prompt/泛词/本地精排词表字段

js/modules/core_memory_recall.js
  - 默认微信本地精排词表常量
  - getCoreMemoryRerankTableSettings()
  - 召回排序读取可编辑词表

js/modules/core_memory_summary.js
  - 默认微信模板常量
  - normalizeCoreMemoryStopwordsExtra()
  - getCoreMemoryPromptSettings()
  - buildCoreMemorySummaryPrompt() 读取自定义设置

js/modules/core_memory_ui.js
  - 设置页加载/保存 prompt 与所有记忆词表
  - 恢复微信默认按钮

index.html
  - 新增 prompt/泛词/本地精排词表 textarea
```

### 21.5 完整 A/B 阶段召回精排移植结果

本阶段已把微信机器人当前启用的 A/B 阶段召回精排链路迁入 `js/modules/core_memory_recall.js`，不再停留在早期轻量近似。

已完成：

1. `ENABLE_MEMORY_RERANK` 对应 `rerankEnabled = true`，默认开启。
2. `STAGEA_LIGHT_MODE_ENABLED` 对应 `stageALightModeEnabled = true`，默认开启。
3. `STAGEA_COMPLEX_MODE_ENABLED` 对应 `stageAComplexModeEnabled = false`，默认关闭，符合当前微信 `config.py`。
4. `rankArchiveMemoriesLight()` 已按微信轻量 Stage A 实现 hard -> event -> aux 分桶候选。
5. `rankArchiveMemoriesComplex()` 已实现 Stage A V1 公式：
   - `stageAPoolHardWeight`
   - `stageAPoolEventWeight`
   - `stageAPoolAuxWeight`
   - `stageAQueryAssistWeight`
   - `stageAOverlapBonusWeight`
   - `stageAImportanceWeight`
   - `stageANoPoolPenalty`
   - `stageAPoolSoftFloorEnabled`
   - `stageABucketOrderEnabled`
   - `stageABucketPrimaryAnchorOnlyCrossBucket`
6. `rerankArchiveMemoriesWithContext()` 已接入微信 B 阶段核心链路：
   - `_score_matched_terms_with_weights()` 对应实现为 `cmScoreMatchedTermsWithWeights()`。
   - 池内/池外基础权重：`rerankBasePoolInWeight` / `rerankBasePoolOutWeight`。
   - 无池命中禁用档位分：`rerankDisableTierWhenNoPoolHit = true`。
   - B 阶段穿透：`rerankPenetrationEnabled = true`。
   - 优先替换弱尾部：`rerankPenetrationReplaceWeakTailFirst = true`。
   - 泛词禁止进入硬锚点池：`rerankBlockGenericAsHardAnchor = true`。
   - topic lock、动态门控保护框架、事件槽位覆盖、front-anchor priority、relaxed match cap 均已迁入。
7. carryover 当前按微信 `config.py` 保持 `rerankAnchorCarryoverEnabled = false`；同时保留 `rerankCarryoverRequireLink = true`，如果之后开启续航，也会要求与当前锚点关联。
8. 召回调试输出会写入 `window.lastCoreMemoryRerankDebug`，其中包含：
   - `stagea_dispatch`
   - `stagea_light_debug` 或 `stagea_complex_debug`
   - `hardAnchorTerms`
   - `eventCandidateTerms`
   - `auxAnchorTerms`
   - `penetrationGate`
   - `dynamicTermGate`
   - `selectedPreview`

浏览器端兼容说明：

微信机器人后端使用 Python/jieba 分词；小手机运行在浏览器里，不能直接复用 jieba。因此小手机采用 JS 规则分词，并额外加入“核心记忆关键词词库反扫查询文本”的兼容层。只要核心记忆 `keywords` 中有 `调试软件`、`重启`、`修复` 这类词，即使浏览器把整句切成长块，也能把这些词拉回 event candidate 池。

已验证样例：

```text
查询：[2026-05-12 Tuesday 01:18:29] 那个破软件又冒烟了，帮我调试软件然后重启修复
命中：evt:调试软件、evt:重启、evt:修复
Stage A light：只输出含这些事件关键词的候选记忆
B 阶段：selectedPreview 中 eventCandidateHits = 3
Stage A complex/V1：poolEventComponent 生效并选中同一条事件记忆
```

剩余差异：

1. 不是功能链路缺失，而是运行环境差异：Python/jieba 与浏览器 JS 分词不会在所有中文长句上逐字一致。
2. 如果某条旧核心记忆没有写好 `keywords`，微信和小手机都更难召回；小手机的关键词反扫依赖核心记忆关键词池。

### 21.6 uwu2.1 API 失败/空回自动重试

本阶段把已在 `uwu小手机/uwu-main` 中验证过的 API 重试逻辑同步移植到 `uwu2.1-main/uwu2.1-main`。

新增设置：

```text
API 设置页：
API失败自动重试

存储字段：
db.apiSettings.apiRetryCount

默认值：
2

关闭方式：
填写 0
```

接入点：

```text
utils.js
  getApiRetryOptions()
  runApiRequestWithRetry()
  fetchAiResponse()

chat_ai.js
  getAiReply() 主聊天直接 fetch
  processStream() 空流式响应检测

settings.js
  读取/保存 apiRetryCount

db.js
  默认 apiSettings = { apiRetryCount: 2 }
```

重试触发：

1. 网络失败。
2. 5xx 服务端错误。
3. 408 / 409 / 425 / 429。
4. 流式或非流式返回空文本。

不重试：

1. 用户主动中止 `AbortError`。
2. 400 / 401 / 402 / 403 / 404。
3. 明确的 key 错误、余额不足、实名/支付/配额、敏感词、Cloudflare 等不可通过重试解决的问题。

验证：

```text
node --check js/utils.js
node --check js/modules/chat_ai.js
node --check js/settings.js
node --check js/db.js

模拟空回：
前两次返回空 content，第三次返回 ok-after-retry
结果：calls = 3，最终文本 = ok-after-retry

DevTools:
file:// 打开 uwu2.1-main/index.html
document.getElementById('api-retry-count').value === "2"
```

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(
  require('path').join(__dirname, '..', 'js', 'modules', 'core_memory_sync.js'),
  'utf8',
);
const context = {
  console,
  setTimeout,
  clearTimeout,
  document: { addEventListener() {} },
  window: {},
  localStorage: { getItem() { return null; }, setItem() {} },
};
vm.runInNewContext(
  source + '\nthis.__buildUwuSyncSourceRounds = buildUwuSyncSourceRounds;\n' +
  'this.__buildUwuLocalSyncPayload = buildUwuLocalSyncPayload;\n' +
  'this.__buildUwuSyncRawMessages = buildUwuSyncRawMessages;\n' +
  'this.__buildUwuMemorySyncBundle = buildUwuMemorySyncBundle;\n' +
  'this.__importUwuMemorySyncBundle = importUwuMemorySyncBundle;',
  context,
);

const build = context.__buildUwuSyncSourceRounds;
assert.strictEqual(typeof build, 'function');

const rounds = build([
  { id: 'u1', role: 'user', content: '第一轮', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: '回答一', timestamp: 2 },
  { id: 'u2', role: 'user', content: '第二轮', timestamp: 3 },
  { id: 'a2', role: 'assistant', content: '回答二', timestamp: 4 },
  { id: 'u3', role: 'user', content: '未完成', timestamp: 5 },
]);

assert.strictEqual(rounds.length, 2);
assert.deepStrictEqual(Array.from(rounds[0].messages, item => item.id), ['u1', 'a1']);
assert.deepStrictEqual(Array.from(rounds[1].messages, item => item.id), ['u2', 'a2']);
assert.strictEqual(rounds[0].messages[0].content, '第一轮');

// Scope metadata must use the local bridge defaults, even when uwu's display
// record contains a human-readable WeChat prompt name.
context.currentChatType = 'private';
context.currentChatId = 'c1';
context.db = {
  characters: [{ id: 'c1', history: [
    { id: 'u1', role: 'user', content: '第一轮', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: '回答一', timestamp: 2 },
  ] }],
};
context.getCoreMemoryRecordSync = () => ({
  wechatUserId: 'display-name',
  wechatPromptName: '司洛',
  lastSummarizedRound: 0,
  items: [],
  updatedAt: 1,
});
const payload = context.__buildUwuLocalSyncPayload();
assert.strictEqual(payload.user_id, '11');
assert.strictEqual(payload.char_id, 'solo');
assert.deepStrictEqual(Array.from(payload.raw_messages, item => item.source_id), [
  'uwu:private:c1:user:u1',
  'uwu:private:c1:assistant:a1',
]);

const changed = context.__buildUwuSyncRawMessages(rounds, 1, 'private:c1', {
  'uwu:private:c1:user:u1': 'old-fingerprint',
});
assert.deepStrictEqual(Array.from(changed.messages, item => item.content), ['第一轮', '第二轮', '回答二']);
assert.ok(changed.nextSnapshot['uwu:private:c1:user:u1']);

// Portable export must use the whole completed history, even when the uwu
// continuity cursor already covers its first round.  It must also carry the
// current summaries but never leak settings or API credentials.
context.currentChatType = 'private';
context.currentChatId = 'c1';
context.db.characters[0].history = [
  { id: 'u1', role: 'user', content: '第一轮', timestamp: 1 },
  { id: 'a1', role: 'assistant', content: '回答一', timestamp: 2 },
  { id: 'u2', role: 'user', content: '第二轮', timestamp: 3 },
  { id: 'a2', role: 'assistant', content: '回答二', timestamp: 4 },
  { id: 'u3', role: 'user', content: '未完成', timestamp: 5 },
];
context.getCoreMemoryRecordSync = () => ({
  lastSummarizedRound: 1,
  items: [{ timestamp: '2026-11-19 20:00', summary: '已总结第一轮', importance: 4, keywords: ['第一轮'] }],
  settings: { apiKey: 'must-not-export' },
  updatedAt: 7,
});
const bundle = context.__buildUwuMemorySyncBundle();
assert.strictEqual(bundle.protocol, 'uwu-memory-sync-bundle-v1');
assert.deepStrictEqual(Array.from(bundle.raw_messages, item => item.source_id), [
  'uwu:private:c1:user:u1',
  'uwu:private:c1:assistant:a1',
  'uwu:private:c1:user:u2',
  'uwu:private:c1:assistant:a2',
]);
assert.strictEqual(bundle.core_memory_items.length, 1);
assert.strictEqual(bundle.settings, undefined);
assert.strictEqual(JSON.stringify(bundle).includes('must-not-export'), false);

(async () => {
  context.db.characters[0].history = [];
  context.saveCharacter = async () => {};
  context.getCoreMemoryRecordSync = () => ({ chatKey: 'private:c1', items: [] });
  context.ensureCoreMemoryRecord = async () => ({ chatKey: 'private:c1', items: [] });
  context.mergeCoreMemoryItems = (oldItems, newItems) => oldItems.concat(newItems);
  context.saveCoreMemoryRecord = async () => {};
  context.getShortMemoryRecordSync = () => null;
  context.saveShortMemoryItemsForChat = async () => {};
  const importBundle = {
    protocol: 'uwu-memory-sync-bundle-v1',
    raw_messages: [
      { source_id: 'bot:stable:1', role: 'user', content: '从电脑导入', timestamp_ms: 10 },
      { source_id: 'bot:stable:2', role: 'assistant', content: '已经接上', timestamp_ms: 11 },
    ],
    core_memory_items: [{ timestamp: '2026-11-19', summary: '已合并摘要', importance: 4, keywords: [] }],
    short_context_items: [{ role: 'assistant', content: '最近一轮回复', timestamp: 11 }],
  };
  const importFile = { text: async () => JSON.stringify(importBundle) };
  const firstImport = await context.__importUwuMemorySyncBundle(importFile);
  const secondImport = await context.__importUwuMemorySyncBundle(importFile);
  assert.strictEqual(firstImport.insertedRawMessages, 2);
  assert.strictEqual(secondImport.insertedRawMessages, 0);
  assert.strictEqual(context.db.characters[0].history[0].memorySyncSourceId, 'bot:stable:1');
  const returnedBundle = context.__buildUwuMemorySyncBundle();
  assert.strictEqual(returnedBundle.raw_messages[0].source_id, 'bot:stable:1');
  console.log('core_memory_sync_rounds: ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

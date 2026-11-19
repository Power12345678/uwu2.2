const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const clone = value => JSON.parse(JSON.stringify(value));
function harness(failWrite = false) {
  const state = {
    currentChatType: 'private', currentChatId: 'c1',
    db: { characters: [{ id: 'c1', history: [], persona: 'keep' }], coreMemoryFiles: [], shortMemoryContexts: [] },
    document: { addEventListener() {} }, window: {}, console, setTimeout, clearTimeout,
    localStorage: { getItem() { return null; } },
  };
  const stored = { characters: {}, coreMemoryFiles: {}, shortMemoryContexts: {} };
  const database = {};
  for (const name of Object.keys(stored)) {
    database[name] = { put: async record => {
      if (failWrite && name === 'shortMemoryContexts') throw new Error('QuotaExceededError');
      stored[name][record.chatKey || record.id] = clone(record);
    } };
  }
  database.transaction = async (_mode, ...args) => {
    const before = clone(stored);
    try { await args.at(-1)(); }
    catch (error) { Object.assign(stored, before); throw error; }
  };
  state.dexieDB = database;
  vm.createContext(state);
  for (const file of ['core_memory.js', 'short_memory.js', 'core_memory_sync.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/modules', file), 'utf8'), state);
  }
  return { state, stored, import: bundle => state.window.importUwuMemorySyncBundle({ text: async () => JSON.stringify(bundle) }) };
}
function bundle() {
  return {
    protocol: 'uwu-memory-sync-bundle-v1', source: 'memory_palace_bot', user_id: '11', char_id: 'solo',
    raw_messages: [
      { source_id: 'palace:MTEAc29sbw:1', role: 'user', content: '电脑问题', timestamp_ms: 1000 },
      { source_id: 'palace:MTEAc29sbw:2', role: 'assistant', content: '电脑回答', timestamp_ms: 1001 },
    ],
    core_memory_items: [{ timestamp: '2026-11-19', summary: '原有摘要', importance: 3, keywords: ['电脑'] }],
    short_context_items: [
      { role: 'user', content: '嗯' }, { role: 'assistant', content: '好' },
      { role: 'user', content: '嗯' }, { role: 'assistant', content: '好' },
    ],
    summary_cursor_kind: 'short_context_rounds', short_context_summary_cursor: 1,
  };
}
test('imports both records, preserves repeated dialogue and cursor, and round-trips source IDs', async () => {
  const h = harness();
  assert.equal((await h.import(bundle())).insertedRawMessages, 2);
  assert.equal((await h.import(bundle())).insertedRawMessages, 0);
  const db = h.state.db;
  assert.equal(db.characters[0].history.length, 2);
  assert.equal(db.characters[0].persona, 'keep');
  assert.equal(db.coreMemoryFiles[0].items.length, 1);
  assert.equal(db.coreMemoryFiles[0].lastSummarizedRound, 1);
  assert.deepEqual(clone(db.shortMemoryContexts[0].items.map(item => item.content)), ['嗯', '好', '嗯', '好']);
  const returned = h.state.window.buildUwuMemorySyncBundle();
  assert.equal(returned.raw_messages[0].source_id, bundle().raw_messages[0].source_id);
  assert.equal(returned.short_context_items.length, 4);
});
test('quota failure rolls back stored records and never changes memory caches', async () => {
  const h = harness(true);
  const before = clone(h.state.db);
  await assert.rejects(h.import(bundle()), /QuotaExceeded/);
  assert.deepEqual(clone(h.state.db), before);
  assert.deepEqual(h.stored, { characters: {}, coreMemoryFiles: {}, shortMemoryContexts: {} });
});
test('rejects wrong scope and malformed summary before writing any data', async () => {
  const h = harness();
  const wrong = bundle(); wrong.char_id = 'other';
  await assert.rejects(h.import(wrong), /不一致/);
  const invalid = bundle(); invalid.core_memory_items[0].summary = '';
  await assert.rejects(h.import(invalid), /摘要/);
  assert.equal(h.state.db.characters[0].history.length, 0);
  assert.equal(h.state.db.coreMemoryFiles.length, 0);
});
test('matches original uwu IDs so returned native messages do not duplicate or retain old parts', async () => {
  const h = harness();
  h.state.db.characters[0].history = [{ id: 'u1', role: 'user', content: '旧文', timestamp: 999,
    parts: [{ type: 'text', text: '旧文' }] }];
  const input = bundle(); input.raw_messages[0].source_id = 'uwu:private:c1:user:u1';
  const result = await h.import(input);
  assert.equal(result.updatedRawMessages, 1);
  assert.equal(result.insertedRawMessages, 1);
  assert.equal(h.state.db.characters[0].history[0].parts[0].text, '电脑问题');
});
test('explicit empty short context clears shadow input while leaving the visible history', async () => {
  const h = harness();
  await h.import(bundle());
  const empty = bundle(); empty.short_context_items = []; empty.short_context_summary_cursor = 0;
  await h.import(empty);
  assert.equal(h.state.db.shortMemoryContexts[0].items.length, 0);
  assert.equal(h.state.db.characters[0].history.length, 2);
});

test('unpaired Palace source survives a phone export back to Bot', async () => {
  const h = harness();
  const input = bundle();
  input.raw_messages = [{ source_id: 'palace:MTEAc29sbw:3', role: 'assistant',
    content: 'unpaired original', timestamp_ms: 1000 }];
  await h.import(input);
  assert.equal(h.state.window.buildUwuMemorySyncBundle().raw_messages[0].source_id, input.raw_messages[0].source_id);
});

test('rejects import while generating or switching chats during file read', async () => {
  const h = harness();
  h.state.isGenerating = true;
  await assert.rejects(h.import(bundle()));
  h.state.isGenerating = false;
  await assert.rejects(h.state.window.importUwuMemorySyncBundle({ text: async () => {
    h.state.currentChatId = 'another';
    return JSON.stringify(bundle());
  } }));
  assert.equal(h.state.db.characters[0].history.length, 0);
});

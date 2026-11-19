const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = name => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function shortHarness() {
  const chat = { id: 'c1', history: [
    { id: 'u2', role: 'user', content: '嗯', timestamp: 2000 },
    { id: 'a2', role: 'assistant', content: '第二次回答', timestamp: 2001 },
  ] };
  const state = { console, window: {}, db: { characters: [chat], groups: [], shortMemoryContexts: [{
    chatKey: 'private:c1', chatType: 'private', chatId: 'c1', useShadowContext: true,
    items: [{role:'user', content:'嗯'}, {role:'assistant', content:'第一次回答'}],
  }] }, dexieDB: { shortMemoryContexts: { put: async () => {} } } };
  vm.createContext(state);
  vm.runInContext(source('modules/short_memory.js'), state);
  state.formatShortMemoryUserTextForWechat = (_chat,_type,_message,text) => text;
  state.formatShortMemoryAssistantTextForWechat = (_chat,_type,_message,text) => text;
  return { state, chat };
}

test('repeated user phrases still create a new complete short-context round', async () => {
  const { state, chat } = shortHarness();
  await state.appendShortMemoryTurnFromHistoryDiff('private', 'c1', chat, 1);
  assert.deepEqual(clone(state.getShortMemoryRecordSync('private', 'c1').items.map(i=>i.role)), ['user','assistant','user','assistant']);
});

test('failed short-context storage does not publish an unsaved cache', async () => {
  const { state } = shortHarness();
  const before = clone(state.db.shortMemoryContexts);
  state.dexieDB.shortMemoryContexts.put = async () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(state.saveShortMemoryRecord({ ...before[0], items: [{role:'user',content:'new'}] }));
  assert.deepEqual(clone(state.db.shortMemoryContexts), before);
});

function apiHarness(fetchFn) {
  const ui = () => ({ style: {}, disabled: false, scrollTop: 0, scrollHeight: 0, getAttribute: () => null });
  const state = {
    console, window: {}, setTimeout, clearTimeout, AbortController,
    currentReplyAbortController: null, isGenerating: false,
    getReplyBtn: ui(), regenerateBtn: ui(), typingIndicator: ui(), messageArea: ui(),
    currentChatId: 'c1', currentChatType: 'private',
    document: { hidden: false, visibilityState: 'visible' },
    db: { characters: [{ id: 'c1', maxMemory: 10, history: [], remarkName:'test' }], groups: [],
      apiSettings: {url:'https://invalid.example',key:'fake',model:'fake',provider:'newapi',streamEnabled:false} },
    AudioManager: {unlock(){}}, filterHistoryForAI: (_,items) => items,
    generatePrivateSystemPrompt: () => 'test', isPrivateWechatTextMode: () => false,
    normalizeMessagesForProvider: items => items,
    showApiError: error => state.errors.push(error), showToast(){}, errors: [], fetch: fetchFn,
    runApiRequestWithRetry: async operation => {
      try { return await operation(); } catch (_) { return await operation(); }
    },
  };
  vm.createContext(state);
  vm.runInContext(source('modules/chat_ai.js'), state);
  state.generatePrivateSystemPrompt = () => 'test';
  state.isPrivateWechatTextMode = () => false;
  return state;
}

test('reply application failure never repeats a paid model request', async () => {
  let calls = 0;
  const state = apiHarness(async () => { calls++; return {ok:true,json:async()=>({choices:[{message:{content:'answer'}}]})}; });
  state.handleAiReplyContent = async () => { throw new Error('storage failed'); };
  await state.getAiReply('c1', 'private');
  assert.equal(calls, 1);
  assert.equal(state.errors.length, 1);
});

test('proactive and foreground requests cannot overlap for the same chat', async () => {
  let calls = 0;
  const finishes = [];
  const state = apiHarness(async () => { calls++; return await new Promise(resolve=>{finishes.push(resolve);}); });
  state.handleAiReplyContent = async () => {};
  const foreground = state.getAiReply('c1', 'private');
  const proactive = state.getAiReply('c1', 'private', true);
  const actualCalls = calls;
  finishes.forEach(finish=>finish({ok:true,json:async()=>({choices:[{message:{content:'answer'}}]})}));
  await Promise.all([foreground, proactive]);
  assert.equal(actualCalls, 1);
});

test('Safari Load failed gets a network explanation', () => {
  const state = { console, window:{}, document:{addEventListener(){}}, TypeError };
  vm.createContext(state);
  vm.runInContext(source('utils.js'), state);
  const text = state.getFriendlyErrorMessage(new TypeError('Load failed'));
  assert.match(text, /网络|后台|连接/);
  assert.doesNotMatch(text, /未知/);
});

test('SSE final frame without blank terminator is not silently lost', async () => {
  const state = apiHarness(async()=>{});
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"last reply"}}]}');
  let read = false;
  const response = { body: { getReader: () => ({ read: async () => {
    if (read) return {done:true}; read=true; return {done:false,value:bytes};
  }, releaseLock(){} }) } };
  state.TextDecoder = TextDecoder;
  const result = await state.processStream(response, state.db.characters[0], 'newapi', 'c1','private', false,false,true);
  assert.equal(result, 'last reply');
});

test('short context append is idempotent for the same assistant message', async () => {
  const { state, chat } = shortHarness();
  await state.appendShortMemoryTurnFromHistoryDiff('private', 'c1', chat, 1);
  await state.appendShortMemoryTurnFromHistoryDiff('private', 'c1', chat, 1);
  assert.equal(state.getShortMemoryRecordSync('private','c1').items.length, 4);
});

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

test('saving again after a failed reply write preserves the received short-context turn', async () => {
  const { state, chat } = shortHarness();
  let fail = true;
  let storedRecord;
  state.dexieDB.characters = {put: async () => { if (fail) throw new Error('disk busy'); }};
  state.dexieDB.shortMemoryContexts.put = async record => { storedRecord = clone(record); };
  state.dexieDB.transaction = async (_mode, ...tablesAndCallback) => tablesAndCallback.at(-1)();
  const received = state.buildShortMemoryTurnFromHistoryDiff('private', 'c1', chat, 1);
  await assert.rejects(state.persistChatWithShortMemory(chat, 'private', received));
  fail = false;
  // This is the same read/save sequence used by saveCurrentChat().
  await state.persistChatWithShortMemory(chat, 'private', state.getShortMemoryRecordSync('private', 'c1'));
  assert.deepEqual(storedRecord.items.map(i => i.content), ['嗯', '第一次回答', '嗯', '第二次回答']);
  assert.equal(state.hasPendingChatPersistence('private', 'c1'), false);
});

test('an older successful write cannot clear a newer failed pending reply', async () => {
  const { state, chat } = shortHarness();
  let finishOld;
  let calls = 0;
  state.dexieDB.characters = {put: async () => {}};
  state.dexieDB.transaction = async (_mode, ...tablesAndCallback) => {
    calls++;
    if (calls === 1) await new Promise(resolve => { finishOld = resolve; });
    else throw new Error('disk busy');
    await tablesAndCallback.at(-1)();
  };
  const original = state.getShortMemoryRecordSync('private', 'c1');
  const oldSave = state.persistChatWithShortMemory(chat, 'private', original);
  const newer = {...original, items: [...original.items, {role:'user',content:'new user'}, {role:'assistant',content:'new reply'}]};
  await assert.rejects(state.persistChatWithShortMemory(chat, 'private', newer));
  finishOld();
  await oldSave;
  assert.equal(state.hasPendingChatPersistence('private', 'c1'), true);
  assert.equal(state.getShortMemoryRecordSync('private', 'c1').items.at(-1).content, 'new reply');
});

test('accepted gift status survives a save/reload after the reply', async () => {
  const state = apiHarness(async () => {});
  const chat = state.db.characters[0];
  Object.assign(chat, { realName:'司洛', myName:'朱迅', history:[
    {id:'gift',role:'user',content:'[朱迅送来的礼物：书]',giftStatus:'pending'},
    {id:'accepted',role:'assistant',content:'[司洛已接收礼物]'},
  ] });
  state.document.getElementById = () => ({classList:{contains:()=>true}});
  state.messageArea.querySelector = () => null;
  let storedChat;
  state.persistChatWithShortMemory = async record => { storedChat = clone(record); };
  state.renderChatList = () => {};
  vm.runInContext(source('modules/chat_render.js'), state);
  await state.persistReplyAndRenderedSideEffects(chat, 'c1', 'private', null, [[chat.history[1], 'c1', 'private']]);
  assert.equal(storedChat.history[0].giftStatus, 'received');
});

test('theme change storage failure preserves all following reply bubbles for local retry', async () => {
  const state = apiHarness(async () => {});
  const chat = state.db.characters[0];
  Object.assign(chat, {realName:'司洛',myName:'朱迅',allowCharSwitchBubbleCss:true,bubbleCssThemeBindings:[{presetName:'dark'}]});
  state.db.bubbleCssPresets = [{name:'dark',css:'test'}];
  state.executePhoneControlCommands = () => ({executed:false});
  state.getMixedContent = text => text.split('|').map(content => ({type:'text',content}));
  state.renderChatList = () => {};
  state.saveCurrentChat = () => {};
  const shown = [];
  state.addMessageBubble = message => shown.push(message.content);
  let pendingChat;
  state.persistChatWithShortMemory = async record => { pendingChat = clone(record); throw new Error('disk busy'); };
  state.buildShortMemoryTurnFromHistoryDiff = () => null;
  await assert.rejects(state.handleAiReplyContent('[司洛的消息：first]|[更换主题：dark]|[司洛的消息：last]',chat,'c1','private'));
  assert.deepEqual(pendingChat.history.map(m => m.content), ['[司洛的消息：first]', '[司洛的消息：last]']);
  assert.deepEqual(shown, ['[司洛的消息：first]', '[司洛的消息：last]']);
});

test('normal dialogue mentioning later chatting is kept in both history and shadow short context', async () => {
  const {state,chat} = shortHarness();
  chat.history[1].content = '我先去上课，稍后再聊，晚上陪你看电影。';
  assert.equal(state.buildShortMemoryItemsFromHistory(chat, 'private').length, 2);
  await state.appendShortMemoryTurnFromHistoryDiff('private','c1',chat,1);
  assert.equal(state.getShortMemoryRecordSync('private','c1').items.at(-1).content, '我先去上课，稍后再聊，晚上陪你看电影。');
});

test('a manually sent pending user is visible in short context without counting as a completed round', () => {
  const {state,chat} = shortHarness();
  chat.history.push({id:'u3',role:'user',content:'下一句',timestamp:3000});
  const items = state.buildShortMemoryItemsFromHistory(chat,'private');
  assert.deepEqual(clone(items.map(i=>i.role)), ['user','assistant','user']);
  assert.equal(state.shortMemoryItemsToRounds(items).length, 1);
});

test('a failed user-message save keeps the draft and removes the uncommitted history item', async () => {
  const state = {
    console, window:{}, currentChatId:'c1', currentChatType:'private',
    messageInput:{value:'hello'}, currentQuoteInfo:null,
    db:{characters:[{id:'c1',myName:'User',history:[{id:'prior',role:'assistant',content:'saved'}]}],groups:[],apiSettings:{}},
    activeChatReplyRequests:new Map(), addMessageBubble(){}, renderChatList(){}, renderMessages(){},
    triggerHapticFeedback(){}, showApiError(){},
    getShortMemoryRecordSync:()=>null,
    persistChatWithShortMemory:async()=>{throw new Error('disk busy');},
    chatRoomTitle:{textContent:''}, formatTimeGap:()=>'',
  };
  vm.createContext(state);
  vm.runInContext(source('chat.js'), state);
  const sent = await state.sendMessage();
  assert.equal(sent, false);
  assert.equal(state.messageInput.value, 'hello');
  assert.equal(state.db.characters[0].history.length, 1);
});

test('two overlapping sends from one chat commit only one user message', async () => {
  const chat = {id:'c1',myName:'User',history:[]};
  let writes = 0;
  const releaseWrites = [];
  const state = {
    console, window:{}, currentChatId:'c1', currentChatType:'private',
    messageInput:{value:'hello'}, currentQuoteInfo:null,
    db:{characters:[chat],groups:[],apiSettings:{}},
    activeChatReplyRequests:new Map(), addMessageBubble(){}, renderChatList(){}, renderMessages(){},
    triggerHapticFeedback(){}, showApiError(){}, getShortMemoryRecordSync:()=>null,
    persistChatWithShortMemory:async()=>{ writes++; await new Promise(resolve=>{releaseWrites.push(resolve);}); },
  };
  vm.createContext(state);
  vm.runInContext(source('chat.js'), state);
  const first = state.sendMessage();
  const second = state.sendMessage();
  releaseWrites.forEach(release=>release());
  await Promise.all([first,second]);
  assert.equal(writes, 1);
  assert.equal(chat.history.filter(message=>message.role === 'user').length, 1);
});

const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness() {
  const handlers = new Map();
  let now=1000;
  const state = {console,window:{},currentChatId:'c1',currentChatType:'private',Date:class extends Date { static now(){return now;} },isGenerating:false,showApiError:error=>{throw error;}};
  vm.createContext(state);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','chat.js'),'utf8'),state);
  let sends=0;
  const releases=[];
  state.sendMessageAndGetReply = async () => {sends++; await new Promise(resolve=>{releases.push(resolve);});};
  const input = {addEventListener:(type,callback)=>handlers.set(type,callback)};
  state.setupChatComposerKeyboard(input);
  return {state, get sends(){return sends;}, release:()=>releases.forEach(resolve=>resolve()), advance:ms=>{now+=ms;},
    fire(type,fields={}) {return handlers.get(type)?.({preventDefault(){},...fields});}};
}

test('a mobile beforeinput send without a usable keydown invokes the chat submission', async () => {
  const h=harness();
  const result=h.fire('beforeinput',{inputType:'insertLineBreak',cancelable:true});
  h.release(); await result;
  assert.equal(h.sends,1);
});

test('keyboard and beforeinput for the same Enter cannot submit twice', async () => {
  const h=harness();
  const first=h.fire('keydown',{key:'Enter',keyCode:13});
  const second=h.fire('beforeinput',{inputType:'insertParagraph',cancelable:true});
  h.release(); await Promise.all([first,second]);
  assert.equal(h.sends,1);
});

test('Chinese composition confirmation never submits a message', async () => {
  const h=harness();
  h.fire('compositionstart');
  await h.fire('keydown',{key:'Enter',keyCode:229,isComposing:false});
  await h.fire('beforeinput',{inputType:'insertParagraph',isComposing:false,cancelable:true});
  h.fire('compositionend');
  await h.fire('keydown',{key:'Enter',keyCode:229,isComposing:false});
  assert.equal(h.sends,0);
});

test('Shift Enter and held Enter do not submit a message', async () => {
  const h=harness();
  await h.fire('keydown',{key:'Enter',keyCode:13,shiftKey:true});
  await h.fire('beforeinput',{inputType:'insertLineBreak',cancelable:true});
  await h.fire('keydown',{key:'Enter',keyCode:13,repeat:true});
  assert.equal(h.sends,0);
});

test('Safari Enter immediately after compositionend is treated as confirmation', async () => {
  const h=harness();
  h.fire('compositionstart');
  h.fire('compositionend');
  const result=h.fire('keydown',{key:'Enter',keyCode:13,isComposing:false});
  h.release(); await result;
  assert.equal(h.sends,0);
});

test('a completed IME key sequence cannot permanently block the next mobile send', async () => {
  const h=harness();
  h.fire('compositionstart');
  h.fire('compositionend');
  h.fire('keydown',{key:'Enter',keyCode:229,isComposing:false});
  h.fire('keyup',{key:'Process',keyCode:229});
  h.advance(1000);
  const result=h.fire('beforeinput',{inputType:'insertParagraph',cancelable:true});
  h.release(); await result;
  assert.equal(h.sends,1);
});

test('a pending reply in another chat cannot block Enter in the current chat', async () => {
  const h=harness();
  const first=h.fire('keydown',{key:'Enter',keyCode:13});
  h.state.currentChatId='c2';
  const second=h.fire('keydown',{key:'Enter',keyCode:13});
  h.release(); await Promise.all([first,second]);
  assert.equal(h.sends,2);
});

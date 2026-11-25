import {InterfaceError, errorText, locale, quantity, shortcutKey} from './ru.js';
import {call} from './bridge.js';
import {mountDesk} from './desk.js';
import {mountEditor} from './editor.js';
import {importMarkdown,exportMarkdown,exportPlainText} from './markdown.js';
import {hasLetterText,normalizeSeal} from './seal.js';
import {mountPanels,normalizeSettings,pageTitle} from './panels.js';
import {Keys} from './audio.js';

const $=id=>document.getElementById(id);
const buttons={};
const welcomed='Тихое место для ваших мыслей.\n\nБез лент и шума.\nТолько следующая строка.\n\nУстраивайтесь поудобнее.';
const library=new Map(),dirty=new Map(),audio=new Keys(),seg=new Intl.Segmenter();
const state={id:null,settings:normalizeSettings(),focus:false,available:false,path:'',storageMessage:'',trashWarning:'',deleted:[],status:'Открываем…',saveFailed:false,prefRevision:0,savedPrefRevision:0};
let pendingAction=Promise.resolve(),ready=false,flushWork=null,timer=0,lastError='',exitGuard=false,formatMask=0;
const page=()=>library.get(state.id);
function createPage(data={}){const now=new Date().toISOString();return {id:crypto.randomUUID().toUpperCase(),createdAt:now,modifiedAt:now,text:'',...data};}
function loadLibraryPage(p){
 if(p.seal && !hasLetterText(p.text))delete p.seal;
 library.set(p.id,p);
}
function message(msg){if(!msg)return;const d=$('notice');$('notice-text').textContent=msg;if(!d.open)d.showModal();}
$('notice-ok').onclick=()=>$('notice').close();
$('notice').addEventListener('close',()=>{if(!panel.isOpen())editor.focus()});
const desk=mountDesk($('desk'),{toggleNight:()=>{setPrefs({nightMode:!state.settings.nightMode});editor.focus()}});
const editor=mountEditor(desk.surface,{onChange(p){
 if(!ready||!p?.id||p.id!==state.id)return;
 const previous=page();const next={...previous,text:p.text,formatting:p.formatting??[],modifiedAt:new Date().toISOString()};
 if(p.seal)next.seal=p.seal;else delete next.seal;
 library.set(p.id,next);mark(next);
},onMove:g=>desk.move(g),onSound:k=>{if(k!=='navigation'&&k!=='bell')desk.strike();if(state.settings.soundEnabled)audio.play(k,state.settings)},onFormat:n=>{formatMask=n;formatButtons();}});
const panel=mountPanels($('panels'),{onSettings:setPrefs,onPreviewSound:()=>audio.preview(state.settings),onStopSoundPreview:()=>audio.stopPreview(),onAction:action,onClose:()=>{audio.stopPreview();editor.focus();}});
function noticeError(e){message(errorText(e))}
const icons={
 library:'<path d="M2 8.5 5 3h10l3 5.5V15H2Z"/><path d="M2 9h5l1 2h4l1-2h5"/>',
 new:'<path d="M10 3v14M3 10h14"/>',menu:'<circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/>',
 sound:'<path d="M2 8h4l4-4v12l-4-4H2Z"/><path d="M13 6q4 4 0 8"/>',mute:'<path d="M2 8h4l4-4v12l-4-4H2Z"/><path d="m13 8 4 4m0-4-4 4"/>',
 export:'<path d="M6 7H4v10h12V7h-2M10 12V2m-3 3 3-3 3 3"/>',
 seal:'<path d="m10 1.8 2.2 1.3 2.5.1 1.2 2.2 2 1.5-.4 2.5.4 2.5-2 1.6-1.2 2.2-2.5.1L10 17.2l-2.2-1.4-2.5-.1-1.2-2.2-2-1.6.4-2.5-.4-2.5 2-1.5 1.2-2.2 2.5-.1Z"/><circle cx="10" cy="9.5" r="4.5"/>',
 focus:'<path d="M3 7V3h4m6 0h4v4m0 6v4h-4m-6 0H3v-4"/>',
 moon:'<path d="M16.5 12.2A7.4 7.4 0 0 1 7.8 3.4a7.1 7.1 0 1 0 8.7 8.8Z"/>',
 sun:'<circle cx="10" cy="10" r="3.5"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6l1.6 1.6m9.6 9.6 1.6 1.6M3.6 16.4l1.6-1.6m9.6-9.6 1.6-1.6"/>',
 settings:'<path d="M2 4h16M2 10h16M2 16h16"/><path d="M6 2v4m7 2v4m-5 2v4"/>',
};
const el=(name,cls,text)=>{const o=document.createElement(name);if(cls)o.className=cls;if(text)o.textContent=text;return o};
function setIcon(b,k){b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true">'+icons[k]+'</svg>';}
function button(action,label,icon,extra=''){const b=el('button','s-btn '+extra);b.type='button';b.dataset.action=action;b.title=label;b.setAttribute('aria-label',label);if(icon)setIcon(b,icon);b.onclick=e=>{if(action==='menu'||action==='export')showMenu(e.currentTarget);else invoke(action)};if(['bold','italic','underline'].includes(action))b.onpointerdown=e=>e.preventDefault();buttons[action]=b;return b;}
let header=el('div','s-head'),count=el('span','s-count'),dot=el('span','s-dot'),date=el('span','s-date'),tools=el('div','s-tools'),foot=el('div','s-foot'),wc=el('span'),saveState=el('span');
header.append(button('library','Библиотека писем · Ctrl+Shift+O','library'),button('new','Новое письмо · Ctrl+N','new'),button('menu','Меню команд · Alt+F','menu'),el('span','s-flex'),el('span','s-brand','INKRAIL'),count,dot);
tools.append(date,el('span','s-flex'));
for(const [name,title,k,tag,caption] of [['bold','Жирный','B','b','Ж'],['italic','Курсив','I','i','К'],['underline','Подчёркивание','U','u','П']]){const b=button(name,title,null,'s-format');b.append(el(tag,'',caption));b.title=title+' · Ctrl+'+k;tools.append(b);}
tools.append(el('span','s-divider'),button('sound','Выключить звук · Ctrl+Shift+M','sound'),button('seal','Запечатать письмо…','seal'),button('export','Экспорт письма…','export'),button('focus','Включить режим фокуса · Ctrl+Shift+F','focus'),button('night','Ночной режим · Ctrl+Alt+L','moon'),button('settings','Настройки · Ctrl+,','settings'));
buttons.seal.setAttribute('aria-haspopup','dialog');
for(const b of [buttons.menu,buttons.export]){b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-controls','commands');b.setAttribute('aria-expanded','false');}
foot.append(wc,el('span','','·'),saveState);desk.header.append(header);desk.controls.append(tools);desk.footer.append(foot);
function formatButtons(){for(const [k,b] of [['bold',1],['italic',2],['underline',4]])buttons[k]?.setAttribute('aria-pressed',String(!!(formatMask&b)));}
function warnBeforeExit(event){event.preventDefault();event.returnValue='';}
function dirtySignal(){
 const next=dirty.size>0 || (state.available && state.prefRevision!==state.savedPrefRevision);
 if(exitGuard===next)return;
 exitGuard=next;
 if(next)window.addEventListener('beforeunload',warnBeforeExit);
 else window.removeEventListener('beforeunload',warnBeforeExit);
}
function updateLibrary(){panel.setLibrary({pages:[...library.values()],selectedID:state.id,deleted:state.deleted,trashWarning:state.trashWarning});panel.setStorage({path:state.path,available:state.available,message:state.storageMessage});}
function status(){const p=page(),s=p?.text||'';if(status.last!==s){status.last=s;wc.textContent=quantity(s.trim()?s.trim().split(/\s+/u).length:0,'слово','слова','слов');let n=0;if(/^[\x00-\x7f]*$/u.test(s))n=s.length-(s.match(/\r\n/g)||[]).length;else for(const _ of seg.segment(s))n++;count.textContent=n;count.setAttribute('aria-label',quantity(n,'знак','знака','знаков'));}
 const sealed=Boolean(normalizeSeal(p?.seal)),label=sealed?'Изменить печать…':'Запечатать письмо…';
 buttons.seal.disabled=!hasLetterText(s);buttons.seal.title=label;buttons.seal.setAttribute('aria-label',label);
 const item=menu.querySelector('[data-command="seal"]');item.disabled=buttons.seal.disabled;item.firstElementChild.textContent=label;
 dot.classList.toggle('dirty',dirty.size>0);dot.title=state.status;saveState.textContent=state.status.toLowerCase();foot.classList.toggle('error',!state.available||state.saveFailed);
 if(p)date.textContent=new Date(p.createdAt).toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'}).toLocaleUpperCase(locale);dirtySignal();}
function applyAppearance(){const s=state.settings;desk.update({...s,focusMode:state.focus});editor.applySettings(s);panel.update(s);tools.classList.toggle('night',s.nightMode);for(const [k,ic,pressed,label] of [['sound',s.soundEnabled?'sound':'mute',s.soundEnabled,s.soundEnabled?'Выключить звук':'Включить звук'],['night',s.nightMode?'sun':'moon',s.nightMode,s.nightMode?'Дневной режим':'Ночной режим'],['focus','focus',state.focus,state.focus?'Выйти из режима фокуса':'Включить режим фокуса']]){const b=buttons[k];setIcon(b,ic);b.setAttribute('aria-pressed',String(pressed));b.setAttribute('aria-label',label);b.title=label;}formatButtons();}
function setPrefs(patch){const old=state.settings;state.settings=normalizeSettings({...old,...patch});if(!state.settings.soundEnabled||old.typewriterSound!==state.settings.typewriterSound||!state.settings.soundVolume)audio.stop();state.prefRevision++;applyAppearance();schedule();}
function select(id, options){const p=library.get(id);if(!p)return false;state.id=id;editor.load(p,options);state.prefRevision++;status();updateLibrary();schedule();return true;}
function mark(p){dirty.set(p.id,(dirty.get(p.id)||0)+1);state.status=state.available?'Сохраняем…':'Не сохранено · экспортируйте письмо';status();schedule();}
function schedule(){dirtySignal();clearTimeout(timer);timer=setTimeout(()=>{void flush();},350);}
async function flush(){
 clearTimeout(timer);
 // The writer is shared by autosave, switching, relocation and close. A
 // successful write only clears the exact object that went to disk.
 if(!state.available){
  if(state.savedPrefRevision!==state.prefRevision){const revision=state.prefRevision;state.savedPrefRevision=revision;try{await call('settings',{preferences:state.settings,selectedID:state.id})}catch{state.storageMessage='Библиотека или настройки недоступны. Экспортируйте несохранённые письма перед закрытием.';updateLibrary()}}
  status();return dirty.size===0;
 }
 while (flushWork || dirty.size || state.savedPrefRevision !== state.prefRevision) {
  if (!flushWork) flushWork = savePendingChanges().finally(() => { flushWork = null; status(); });
  if (!await flushWork) return false;
 }
 return true;
}
async function savePendingChanges() {
 const failures = new Map();
 let settingsError = '';
 while (true) {
  // Try each failed letter again on the next flush. A newer edit to a letter
  // that saved successfully can still be written during this flush.
  const ids = [...dirty.keys()].filter(id => !failures.has(id));
  if (!ids.length && (settingsError || state.prefRevision === state.savedPrefRevision)) break;
  for (const id of ids) {
   const letter = library.get(id);
   if (!letter) { dirty.delete(id); continue; }
   try {
    await call('save', letter);
    if (library.get(id) === letter) dirty.delete(id);
   } catch (error) {
    failures.set(id, errorText(error));
   }
  }
  if (!settingsError && state.prefRevision !== state.savedPrefRevision) {
   const revision = state.prefRevision;
   try {
    await call('settings', {preferences: state.settings, selectedID: state.id});
    state.savedPrefRevision = revision;
   } catch (error) {
    settingsError = errorText(error);
   }
  }
 }
 if (failures.size || settingsError) {
  state.saveFailed = true;
  state.status = 'Ошибка сохранения · экспортируйте письмо';
  const signature = JSON.stringify([[...failures], settingsError]);
  if (lastError !== signature) {
   lastError = signature;
   const details = [...failures].map(([id, error]) => {
    const letter = library.get(id);
    return `«${letter ? pageTitle(letter) : id}» — ${error}`;
   });
   if (settingsError) details.push(`Настройки — ${settingsError}`);
   message('Не удалось сохранить изменения. Они ещё видны в редакторе. Экспортируйте копию письма перед закрытием.\n\n' + details.join('\n'));
  }
  return false;
 }
 state.saveFailed = false;
 state.status = 'Сохранено в этом браузере';
 lastError = '';
 return true;
}
function newLetter(data={},options){const p=createPage(data);library.set(p.id,p);select(p.id,options);mark(p);return p;}
async function checkTrash(){try{const r=await call('cleanup');state.trashWarning=(r.warnings||[]).join('\n');const gone=new Set(r.removedIDs||[]);if(gone.size)state.deleted=state.deleted.filter(p=>!gone.has(p.id));}catch(e){state.trashWarning=errorText(e);}updateLibrary();}
async function trashList(){await checkTrash();const r=await call('list',{trash:true});state.deleted=r.pages||[];state.trashWarning=[state.trashWarning,...(r.warnings||[])].filter(Boolean).join('\n');updateLibrary();}
async function action(name,id,value){
 switch(name){
 case 'library':updateLibrary();panel.showLibrary();return true;
 case 'settings':panel.showSettings();return true;
 case 'seal':{const p=page();if(!hasLetterText(p?.text))return false;panel.showSeal(p);return true;}
 case 'setSeal':{
  const p=library.get(id);
  if(!p||p.id!==state.id)return false;
  const seal=normalizeSeal(value);
  if(value && (!seal || !hasLetterText(p.text)))return false;
  const next={...p,modifiedAt:new Date().toISOString()};
  if(seal)next.seal=seal;else delete next.seal;
  library.set(id,next);editor.setSeal(seal,true);mark(next);return true;
 }
 case 'new':newLetter();await flush();return true;
 case 'select':await flush();return select(id);
 case 'save':return flush();
 case 'import':{const result=await call('import');if(!result)return false;newLetter(result.markdown?importMarkdown(result.text):{text:result.text});await flush();return true;}
 case 'exportPDF':return exportPDF();
 case 'export':case 'exportMarkdown':{const p=page();if(!p)return false;const md=name==='exportMarkdown';return call('export',{text:md?exportMarkdown(p):exportPlainText(p),body:p.text,markdown:md});}
 case 'rename':{
  const p=library.get(id);if(!p)throw new InterfaceError('Этого письма больше нет в библиотеке.');
  const next={...p},title=(value||'').split(/[\r\n\u0085\u2028\u2029\v\f]+/u).join(' ').trim();
  if(title)next.privateTitle=title;else delete next.privateTitle;
  library.set(id,next);mark(next);
  await flush();
  if(dirty.has(id))throw new InterfaceError('Не удалось сохранить название.');
  updateLibrary();return true;
 }
 case 'trash':{if(!await flush())throw new InterfaceError('Сохраните изменения перед переносом письма в корзину.');await call('trash',{id});library.delete(id);dirty.delete(id);if(id===state.id){if(library.size)select([...library.values()].sort((a,b)=>Date.parse(b.modifiedAt)-Date.parse(a.modifiedAt))[0].id);else newLetter();}await flush();updateLibrary();return true;}
 case 'restore':{
  if(!await flush())throw new InterfaceError('Сохраните изменения перед восстановлением письма.');
  await checkTrash();await call('restore',{id});
  const {pages}=await call('list',{trash:false});
  for(const p of pages){if(p.id===id||!library.has(p.id))loadLibraryPage(p);}
  if(state.id===id)select(id);
  await trashList();return true;
 }
 case 'listTrash':await trashList();return true;
 case 'storage':panel.showSettings('storage');return true;
 case 'backup':{
  if(!await flush())throw new InterfaceError('Не удалось сохранить изменения. Экспортируйте эти письма отдельно перед созданием резервной копии.');
  return call('backup');
 }
 case 'restoreBackup':{
  const file=await call('openBackup');if(!file)return false;
  if(!await flush())throw new InterfaceError('Не удалось сохранить изменения. Экспортируйте письма перед импортом резервной копии.');
  const {added,preferences}=await call('mergeBackup',file);
  const {pages}=await call('list',{trash:false});
  for(const p of pages){if(!library.has(p.id))loadLibraryPage(p);}
  if(preferences)setPrefs(normalizeSettings(preferences));
  await flush();await trashList();
  state.storageMessage=`Импортировано из резервной копии: ${quantity(added,'письмо','письма','писем')}.`;
  updateLibrary();return true;
 }
 case 'bold':case 'italic':case 'underline':case 'clearFormatting':editor.command(name);return true;
 case 'focus':state.focus=!state.focus;applyAppearance();return true;
 case 'night':setPrefs({nightMode:!state.settings.nightMode});return true;
 case 'sound':setPrefs({soundEnabled:!state.settings.soundEnabled});return true;
 case 'about':message('Inkrail · веб-версия\nБумага, чернила и тихое место для письма.\n\nСделано с любовью. Автор: Аарьян Верма.\nОткрытый исходный код · лицензия MIT.');return true;
 }
 return false;
}
async function exportPDF() {
 if (!page() || !await call('beginPdfExport')) return false;
 let root;
 let finished = false;
 try {
  const letter = page();
  const content = editor.printContent();
  const paper = await desk.printPaper();
  root = el('div');
  root.id = 'letter-print';
  root.style.width = paper.width + 'px';
  root.style.setProperty('--sheet-height', paper.height + 'px');
  const writing = el('div', 'ink-print-writing');
  writing.append(content);
  root.append(paper.substrate, paper.ornaments, writing);
  document.body.append(root);
  // Lay out the snapshot so fonts first used offscreen are loaded before printing.
  root.getBoundingClientRect();
  await document.fonts.ready;
  const saved = await call('exportPDF', {body: letter.text, width: paper.width, height: paper.height});
  finished = true; // The file was installed or the user canceled Save As.
  return saved;
 } finally {
  root?.remove();
  await call('endPdfExport', finished);
 }
}
function invoke(name){
 if(!ready)return;
 // Saving must not swallow the next writing command or steal a newer caret.
 // Modal file actions are serialized, while editing controls stay responsive.
 if(name==='save'){void flush();return;}
 const run=async()=>{try{await action(name)}catch(e){noticeError(e)}finally{if(!panel.isOpen()&&!$('notice').open)editor.focus();}};
 if(['bold','italic','underline','clearFormatting','focus','night','sound'].includes(name)){void run();return;}
 pendingAction=pendingAction.then(run,run);
}
const menu=$('commands'),commands=[['new','Новое письмо','Ctrl+N'],['import','Импорт текста или Markdown…','Ctrl+O'],['save','Сохранить','Ctrl+S'],['seal','Запечатать письмо…',''],['exportPDF','Сохранить как PDF…',''],['exportMarkdown','Экспорт в Markdown…',''],['export','Экспорт текста…','Ctrl+Shift+E'],null,['library','Библиотека писем','Ctrl+Shift+O'],['settings','Настройки…','Ctrl+,'],['clearFormatting','Очистить форматирование','Ctrl+\\'],['storage','Хранилище и резервные копии…',''],null,['about','Об Inkrail','']];
for(const entry of commands){if(!entry){menu.append(el('hr'));continue}const [id,label,key]=entry,b=el('button');b.type='button';b.role='menuitem';b.dataset.command=id;b.append(el('span','',label),el('small','',key));b.onclick=()=>{hideMenu();invoke(id)};menu.append(b);}
let menuAnchor=null;
function hideMenu(){menu.hidden=true;menuAnchor?.setAttribute('aria-expanded','false');menuAnchor=null;}
function showMenu(anchor){
 const wasOpen=menuAnchor===anchor;hideMenu();
 if(wasOpen){editor.focus();return;}
 const exportsOnly=anchor===buttons.export;
 menu.setAttribute('aria-label',exportsOnly?'Экспорт письма':'Команды для работы с письмами');
 for(const item of menu.children)item.hidden=exportsOnly&&!['exportPDF','exportMarkdown','export'].includes(item.dataset.command);
 menuAnchor=anchor;anchor.setAttribute('aria-expanded','true');menu.hidden=false;
 const r=anchor.getBoundingClientRect();
 menu.style.left=Math.max(4,Math.min(innerWidth-menu.offsetWidth-4,r.left))+'px';
 menu.style.top=(r.bottom+menu.offsetHeight+4<=innerHeight?r.bottom+2:Math.max(4,r.top-menu.offsetHeight-2))+'px';
 menu.querySelector('button:not([hidden]):enabled').focus();
}
window.addEventListener('pointerdown',e=>{
 if(!menu.hidden&&!menu.contains(e.target)&&![buttons.menu,buttons.export].some(b=>b.contains(e.target)))hideMenu();
});
window.addEventListener('keydown',e=>{if(!ready||e.isComposing||e.key==='Process')return;
 if(!menu.hidden){if(e.key==='Escape'){e.preventDefault();const anchor=menuAnchor;hideMenu();anchor.focus()}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const list=[...menu.querySelectorAll('button:not([hidden]):enabled')];list[(list.indexOf(document.activeElement)+list.length+(e.key==='ArrowDown'?1:-1))%list.length].focus()}return;}
 if(panel.isOpen()||$('notice').open)return;
 const k=shortcutKey(e), mod=e.ctrlKey||e.metaKey;let cmd;
 if(e.altKey&&!mod&&k==='f'){e.preventDefault();showMenu(buttons.menu);return;}
 if(mod){if(e.altKey){if(k==='l'&&!e.getModifierState('AltGraph'))cmd='night'}else if(e.shiftKey)cmd=({o:'library',e:'export',m:'sound',f:'focus'})[k];else cmd=({o:'import',n:'new',s:'save',p:'exportPDF',',':'settings','\\':'clearFormatting'})[k];}
 if(cmd){e.preventDefault();e.stopPropagation();if(!e.repeat)invoke(cmd)}
},true);
window.addEventListener('blur',()=>{if(ready)void flush();});
document.addEventListener('visibilitychange',()=>{if(ready&&document.hidden)void flush();});
window.addEventListener('pagehide',()=>{if(ready)void flush();});
function watchForUpdate(){
 if(!('serviceWorker' in navigator))return;
 const workers=navigator.serviceWorker,banner=$('app-update'),reload=$('app-reload');
 let previous=workers.controller;
 workers.addEventListener('controllerchange',()=>{
  const current=workers.controller;
  if(previous&&current&&current!==previous&&banner)banner.hidden=false;
  previous=current;
 });
 if(reload)reload.onclick=async()=>{
  reload.disabled=true;
  try{if(!ready||await flush())location.reload();}
  finally{reload.disabled=false;}
 };
 void workers.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update())
  .catch(error=>console.warn('Не удалось проверить офлайн-кэш:',error));
}
async function boot(){const data=await call('boot');state.settings=normalizeSettings(data.settings?.preferences);state.available=data.available;state.path=data.path||'';state.trashWarning=data.trashWarning||'';state.status=data.available?'Сохранено в этом браузере':'Хранилище недоступно · экспортируйте письмо';
 for(const p of data.pages||[])loadLibraryPage(p);ready=true;applyAppearance();
 if(library.size){select(library.has(data.settings?.selectedID)?data.settings.selectedID:library.keys().next().value,{atEnd:true})}else if(state.available){newLetter({text:welcomed},{atEnd:true});await flush();}else{const p=createPage();library.set(p.id,p);select(p.id);}
 updateLibrary();$('boot-message').hidden=true;
 if(!matchMedia('(pointer: coarse)').matches)editor.focus();
 document.documentElement.dataset.ready='true';
 if(data.error){state.storageMessage=data.error;updateLibrary();message('Не удалось открыть библиотеку. Вы по-прежнему можете писать и экспортировать письма. Разрешите браузеру хранить данные сайта и откройте Inkrail заново.\n'+data.error);}
 setInterval(()=>{if(dirty.size||state.available&&state.prefRevision!==state.savedPrefRevision)void flush();},2000);
 setInterval(()=>{if(state.available)void checkTrash()},3600000);
}
if(window.isSecureContext && location.protocol!=='file:'){
 history.scrollRestoration='manual';
 watchForUpdate();
 void boot().catch(e=>{ready=false;$('boot-message').textContent='Не удалось открыть письменный стол. '+errorText(e);});
}

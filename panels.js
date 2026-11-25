import {errorText, locale as uiLocale, quantity} from './ru.js';
import {canonicalSound, soundProfiles} from './sound-profiles.js';
import {defaults} from './defaults.js';
import {mountDeskPreview} from './desk.js';
import {styleWritingPreview,inkImpression,styleInkStrike} from './editor.js';
import {defaultSeal, drawSeal, limitSealText, normalizeSeal, sealColors, sealShapes, sealTextLimit} from './seal.js';

// Settings and letter box. Persisted keys and enum identifiers match InkrailCore.
const titled = values => values.map(([id,label,detail]) => ({id,label,detail}));
export const choices = Object.freeze({
  paper: titled([['ivory','Слоновая кость','#eeecd9'],['cream','Кремовый','#e5d7b7'],['white','Белый','#f3f1e9']]),
  paperStartPosition: titled([['top','Сверху'],['bottom','Снизу']]),
  paperMotion: titled([['sheet','Лист'],['roll','Рулон']]),
  paperTexture: titled([['classic','Классика','Мелкое зерно'],['smooth','Гладкая','Ровная поверхность без фактуры'],['laid','Верже','Тонкие линии на бумаге'],['cotton','Хлопок','Мягкие волокна с неровной фактурой']]),
  marginStyle: titled([['none','Нет'],['botanical','Растительный узор'],['ledger','Линовка'],['artDeco','Ар-деко'],['celestial','Созвездия']]),
  paperEmbossing: titled([['none','Нет','Бумага без тиснения'],['botanical','Растительный узор','Лёгкий растительный оттиск'],['monogram','Монограмма','Небольшой оттиск Inkrail'],['sunburst','Солнечные лучи','Узор из расходящихся лучей'],['makerMark','Клеймо мастера','Инициалы с каретки, выдавленные на бумаге']]),
  capsule: titled([['porcelain','Фарфор','#e5e2d6'],['sage','Шалфейный','#86977c'],['cobalt','Кобальт','#3d609c'],['terracotta','Терракота','#ad6548'],['graphite','Графит','#454c4a']]),
  rail: titled([['steel','Сталь'],['brass','Латунь'],['charcoal','Угольный']]),
  ribbon: titled([['carbon','Угольно-чёрный','#292b26'],['midnight','Полночь','#213d57'],['oxblood','Бордовый','#591f24']]),
  writingFont: titled([['courier','Courier Prime','Насыщенные машинописные буквы с выразительным курсивом'],['americanTypewriter','American Typewriter','Округлый машинописный шрифт с засечками'],['menlo','Menlo','Чёткий моноширинный шрифт'],['georgia','Georgia','Мягкие, хорошо читаемые засечки'],['courierNew','Courier New','Знакомый машинописный шрифт с тонкими засечками'],['typewriterLight','American Typewriter (светлый)','Облегчённое начертание American Typewriter'],['typewriterCondensed','American Typewriter (узкий)','Узкое начертание American Typewriter'],['monaco','Monaco','Компактный моноширинный шрифт с мягкими формами']]),
  deskFinish: titled([['charcoal','Угольный'],['walnut','Орех'],['felt','Войлок'],['linen','Лён'],['oak','Медовый дуб'],['leather','Кожа']]),
  deskAccent: titled([['none','Нет'],['sprig','Веточка'],['paperclip','Скрепка'],['envelope','Конверт'],['brassLamps','Две бронзовые лампы'],['linenLamps','Две лампы с льняными абажурами']]),
  typewriterSound: titled(soundProfiles),
  mechanismStyle: titled([['classic','Классика','Каретка в оригинальном исполнении'],['brushedSteel','Матовая сталь','Матовый металл · тонкие рёбра'],['champagne','Шампань','Мягкое золото · ар-деко'],['walnut','Орех','Древесный рисунок · латунь'],['porcelain','Фарфор','Кремовая глазурь · шалфей'],['midnight','Полночь','Графит · золотая инкрустация'],['roseQuartz','Розовый кварц','Розовый камень · перламутровые прожилки'],['seaGlass','Морское стекло','Матовый бирюзовый · серебро'],['lavender','Лаванда','Сиреневая эмаль · мягкий блеск'],['racingGreen','Гоночный зелёный','Глубокий зелёный · кремовые полосы'],['copper','Медь','Чеканка по металлу · патина'],['wildflower','Полевые цветы','Кремовая эмаль · мелкие цветы']]),
});
export {defaults};
const bounds = {textureStrength:[0,1], embossingDepth:[0,1], fontSize:[15,28], inkStrength:[.35,1], inkBuildup:[0,1], soundVolume:[0,1], lampIntensity:[.25,1], lampWarmth:[0,1]};
export function normalizeSettings(source = {}) {
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const value = source?.[key];
    if (key === 'marginStyle' && value == null && source?.garden === true) return [key, 'botanical'];
    if (key === 'typewriterSound') return [key, canonicalSound(value)];
    if (choices[key]) return [key, choices[key].some(x => x.id === value) ? value : fallback];
    if (bounds[key]) return [key, Number.isFinite(value) ? Math.min(bounds[key][1], Math.max(bounds[key][0], value)) : fallback];
    return [key, typeof value === typeof fallback ? value : fallback];
  }));
}
const graphemes = new Intl.Segmenter(undefined, {granularity:'grapheme'});
function prefix(text, count) {
  let i=0;
  for (const item of graphemes.segment(text)) if (i++ === count) return text.slice(0,item.index);
  return text;
}
const firstLine = text => (text ?? '').split(/[\r\n\u0085\u2028\u2029\v\f]+/u).map(x=>x.trim()).find(Boolean) || 'Письмо без названия';
export const pageTitle = page => page.privateTitle?.trim() || prefix(firstLine(page.text),64);
export function pagePreview(page) {
  const text = page.text ?? '';
  const terminals = /(?:(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|\p{L}\.\p{L}))\.(?=[\s\p{Pe}\p{Pf}"']|$)|(?=[^.])\p{Sentence_Terminal})\p{Sentence_Terminal}*[\p{Pe}\p{Pf}"']*/giu;
  let ends = 0, stop = text.length;
  for (const match of text.matchAll(terminals)) {
    if (++ends === 2) { stop = match.index + match[0].length; break; }
  }
  let result = text.slice(0,stop).trim().replace(/\s+/gu,' ');
  if (!result) return '';
  if (!ends) result = prefix(result,140).trimEnd();
  return result.replace(/\.+$/u,'') + '...';
}
const modified = page => typeof page.modifiedAt==='number' ? new Date(978307200000 + page.modifiedAt*1000) : new Date(page.modifiedAt);
const idOf = page => String(page.id);
export function letterGroups(pages, query = '', locale = uiLocale) {
  const key = query.toLocaleLowerCase(locale);
  const month = new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'});
  const groups = new Map();
  const ordered = [...pages].sort((a,b)=>(+modified(b)||0)-(+modified(a)||0));
  for (const page of ordered) {
    if (key && !page.privateTitle?.toLocaleLowerCase(locale).includes(key) && !(page.text ?? '').toLocaleLowerCase(locale).includes(key)) continue;
    const d = modified(page);
    const dateKey = Number.isFinite(+d) ? d.getFullYear()+'-'+d.getMonth() : 'unknown';
    if (!groups.has(dateKey)) groups.set(dateKey,{month:Number.isFinite(+d)? month.format(d).toLocaleUpperCase(locale) : 'ДАТА НЕИЗВЕСТНА',pages:[]});
    groups.get(dateKey).pages.push(page);
  }
  return [...groups.values()];
}
const tabs = Object.entries({paper:'Бумага',type:'Шрифт',machine:'Каретка',desk:'Стол',sound:'Звук',light:'Свет',storage:'Данные'});
const preferredRail = {brushedSteel:'steel',champagne:'brass',walnut:'brass',porcelain:'charcoal',midnight:'charcoal',roseQuartz:'brass',seaGlass:'steel',lavender:'steel',racingGreen:'brass',copper:'charcoal',wildflower:'brass'};
const labelFor = (key,id) => choices[key].find(x=>x.id===id)?.label ?? '';
const el = (tag, cls='', text) => {
  const node=document.createElement(tag);
  if (cls) node.className=cls;
  if (text!=null) node.textContent=text;
  return node;
};
function append(node,...children) { node.append(...children.filter(Boolean)); return node; }
function button(text, action, cls='ip-plain') {
  const node=el('button',cls,text);
  node.type='button';
  node.addEventListener('click',action);
  return node;
}
function icon(name) {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.classList.add('ip-glyph');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d', {
    search:'M15.5 15.5 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
    trash:'M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13m-9 0V4h6v3',
    edit:'M4 20h3l12-12-3-3L4 17v3Zm10-13 3 3',
    clear:'M5 5l14 14m0-14L5 19',
    play:'M8 5v14l11-7Z',
  }[name]);
  svg.append(path); return svg;
}
function iconButton(name,label,action) {
  const b=button('',action,'ip-plain ip-icon');
  b.title=label; b.setAttribute('aria-label',label); b.append(icon(name)); return b;
}
const note = text => el('p','ip-note',text);
function card(title, subtitle,...body) {
  return append(el('section','ip-card'), append(el('div','ip-card-title'),el('h3','',title),subtitle&&note(subtitle)),el('hr'),...body);
}
function row(left, right) { return append(el('div','ip-row'),left,right); }
function drawTypePreview(node,prefs) {
  styleWritingPreview(node,prefs);
  node.style.setProperty('--preview-paper', choices.paper.find(x=>x.id===prefs.paper)?.detail);
  const sample=el('span','ip-sample');
  const text='Одни буквы темнее других.\nОттиски остаются на бумаге.';
  if (prefs.wornInk) {
    for (const {segment,index} of graphemes.segment(text)) {
      if(!/^[!-~А-Яа-яЁё]$/u.test(segment)){sample.append(document.createTextNode(segment));continue;}
      const letter=el('span','ip-ink-impression',segment);
      styleInkStrike(letter,inkImpression(index,text.charCodeAt(index),prefs.inkBuildup,prefs.fontSize));
      sample.append(letter);
    }
  } else sample.textContent=text;
  node.replaceChildren(sample);
}

export function mountPanels(root, callbacks = {}) {
  let prefs = normalizeSettings();
  let library = {pages:[],deleted:[],selectedID:null,trashWarning:''};
  let storage = {path:'',available:true,message:''};
  let kind=null, tab='paper', showDeleted=false, query='', activeBefore=null, revision=0;
  let busy=false, returnFromSub=null;
  const dialog=el('dialog','ip-dialog');
  const sub=el('dialog','ip-dialog ip-subdialog');
  const headingId='ip-dialog-heading', subheadingId='ip-subdialog-heading';
  dialog.setAttribute('aria-labelledby',headingId);
  sub.setAttribute('aria-labelledby',subheadingId);
  dialog.setAttribute('aria-modal','true'); sub.setAttribute('aria-modal','true');
  root.append(dialog,sub);
  let body,errorBox,nav,footer,libraryList,visibleShape='', searchInput, warningBox, bottom, previews=[];
  const libraryBusyButtons=new Set();

  function report(error) {
    if (!errorBox || !dialog.open) return;
    errorBox.textContent=errorText(error);
    errorBox.hidden=false;
  }
  function clearError() { if (errorBox) errorBox.hidden=true; }
  function changeSettings(patch) {
    update({...prefs,...patch});
    try { Promise.resolve(callbacks.onSettings?.(patch)).catch(report); }
    catch(error) { report(error); }
  }
  function stopAudio() { callbacks.onStopSoundPreview?.(); }
  function close() {
    if (!dialog.open) return false;
    if (sub.open) { if (!busy) sub.close(); return true; }
    const previous=kind;
    if (kind==='settings') {stopAudio(); cleanupPreviews();}
    kind=null; revision++; busy=false; dialog.close();
    activeBefore?.focus?.({preventScroll:true});
    activeBefore=null;
    callbacks.onClose?.(previous);
    return true;
  }
  function open(type, page) {
    if (!dialog.open) activeBefore=document.activeElement;
    if (sub.open) sub.close();
    if (kind==='settings' && type!=='settings') {stopAudio(); cleanupPreviews();}
    kind=type; revision++; busy=false;
    dialog.classList.toggle('ip-library',type==='library');
    dialog.classList.toggle('ip-seal-dialog',type==='seal');
    if (type==='settings') buildSettings();
    else if (type==='seal') buildSeal(page);
    else { showDeleted=false; query=''; buildLibrary(); }
    if (!dialog.open) dialog.showModal();
    if (type==='settings') previews.forEach(hydratePreview);
    if (type==='library') searchInput.focus({preventScroll:true});
    else if (type==='seal') dialog.querySelector('input').select();
    else nav.querySelector('[aria-selected="true"]').focus({preventScroll:true});
  }
  dialog.addEventListener('cancel',ev=>{ ev.preventDefault(); close(); });
  sub.addEventListener('cancel',ev=>{ ev.preventDefault(); if (!busy) sub.close(); });
  sub.addEventListener('close',()=>{
    if (sub.open || !returnFromSub) return;
    const {page,action}=returnFromSub;returnFromSub=null;
    if (kind!=='library'||!dialog.open) return;
    const controls=[...libraryList.querySelectorAll('button[data-page]')];
    const target=controls.find(node=>node.dataset.page===page&&node.dataset.rowAction===action) ||
      controls.find(node=>node.dataset.rowAction===(showDeleted?'restore':'select')) || searchInput;
    target?.focus({preventScroll:true});
  });
  for (const d of [dialog,sub]) {
    let pressedOutside=false;
    function outside(e) {
      const r=d.getBoundingClientRect();
      return e.target===d && (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);
    }
    d.addEventListener('pointerdown',e=>{pressedOutside=outside(e);});
    d.addEventListener('pointercancel',()=>{pressedOutside=false;});
    d.addEventListener('click',e=>{
      if (pressedOutside && outside(e)) d===sub ? (!busy && sub.close()) : close();
      pressedOutside=false;
    });
  }
  function addError(parent) {
    errorBox=el('p','ip-error');
    errorBox.setAttribute('role','alert'); errorBox.hidden=true;
    parent.append(errorBox);
  }
  function makeHeader(title, subtitle, doneStyle, mono=false) {
    const titleNode=el('h2','',title);
    titleNode.id=headingId;
    return append(el('header','ip-header'+(mono?' ip-mono':'')),append(el('div'),titleNode,el('p','',subtitle)),button('Готово',close,doneStyle));
  }
  function makePreview(mode, overrides={}) {
    const node=el('div','ip-preview ip-preview-'+mode);
    if (mode==='mechanismTile') node.setAttribute('aria-hidden','true');
    else { node.setAttribute('role','img'); node.setAttribute('aria-label',({paper:'Образец бумаги и шрифта',type:'Образец шрифта и чернил',machine:'Образец каретки и направляющей',desk:'Образец отделки и предметов на столе',light:'Образец ночного освещения'})[mode]); }
    previews.push({node,mode,overrides});
    return node;
  }
  function cleanupPreviews() {
    for (const item of previews) item.renderer?.destroy();
    previews=[];
  }
  function hydratePreview(item) {
    const {node,mode,overrides}=item;
    const state={...prefs,...overrides};
    if (callbacks.renderPreview) {callbacks.renderPreview(node,state,mode);return;}
    if (mode==='type') {
      node.setAttribute('aria-label','Образец шрифта и чернил: '+labelFor('writingFont',state.writingFont)+', '+(state.wornInk?'изношенная лента':'равномерный оттиск'));
      drawTypePreview(node,state);return;
    }
    const paintMode=mode==='mechanismTile'?'machine':mode==='light'?'lamp':mode;
    if (!item.renderer) item.renderer=mountDeskPreview(node,state,paintMode);
    else item.renderer.update(state);
    styleWritingPreview(node,state);
    if(mode==='paper') {
      node.setAttribute('aria-label','Образец бумаги и шрифта: '+['paperMotion','paper','paperTexture','paperEmbossing','writingFont'].map(key=>labelFor(key,state[key])).join(', ')+'. Оформление полей: '+labelFor('marginStyle',state.marginStyle));
      const sampleText=state.paperMotion==='roll'?'Лист идёт вверх.\nСледующая строка ждёт.':'Тихо шуршит дождь.\nСамое время писать.';
      const host=item.renderer.surface??node;
      if (!item.sample) item.sample=el('span','ip-sample ip-paper-sample');
      const sample=item.sample;
      if (sample.parentNode!==host) host.append(sample);
      sample.textContent=sampleText;
      sample.classList.toggle('ip-sample-bordered',state.marginStyle!=='none');
      sample.classList.toggle('ip-sample-roll',state.paperMotion==='roll');
      sample.classList.toggle('ip-sample-bottom',state.paperStartPosition==='bottom');
    } else if(mode==='desk') {
      node.setAttribute('aria-label','Образец отделки и предметов на столе: '+labelFor('deskFinish',state.deskFinish)+', '+labelFor('deskAccent',state.deskAccent));
    } else if(mode==='light') {
      node.setAttribute('aria-label','Образец ночного освещения: '+(state.nightMode?'теплота света: '+Math.round(state.lampWarmth*100)+' %':'лампа выключена'));
    }
  }
  function select(key,label) {
    const wrapper=el('span','ip-select-wrap');
    const field=el('select','ip-select');
    field.setAttribute('aria-label',label);
    field.dataset.bind=key;
    for (const choice of choices[key]) {
      const option=el('option','',choice.label); option.value=choice.id;
      field.append(option);
    }
    field.addEventListener('change',()=>changeSettings({[key]:field.value}));
    const icon=el('span','ip-select-tip','⌃');icon.setAttribute('aria-hidden','true');
    return row(el('span','',label),append(wrapper,field,icon));
  }
  function toggle(key,label) {
    const field=el('input','ip-toggle');
    field.type='checkbox';field.setAttribute('role','switch');field.dataset.bind=key;
    field.addEventListener('change',()=>changeSettings({[key]:field.checked}));
    return append(el('label','ip-toggle-line'),el('span','',label),field);
  }
  let sliderId=0;
  function slider(key,label,{percentage=true,unit='пт',disabledBy=''}={}) {
    const field=el('input','ip-range'), out=el('output','ip-range-value');
    field.type='range'; [field.min,field.max]=bounds[key]; field.step=percentage?.01:1;
    field.setAttribute('aria-label',label); field.dataset.bind=key; field.id='ip-range-'+(++sliderId);
    out.htmlFor=field.id;out.dataset.valueFor=key;out.dataset.unit=percentage?'\u00a0%':' '+unit;
    if (disabledBy) field.dataset.disableBy=disabledBy;
    field.addEventListener('input',()=>changeSettings({[key]:field.valueAsNumber}));
    return append(el('label','ip-range-line'),el('span','',label),field,out);
  }
  function options(key,label, style) {
    const field=el('div','ip-options ip-'+style);
    field.setAttribute('role','group');field.setAttribute('aria-label',label);
    for (const {id,label:caption,detail} of choices[key]) {
      const b=button('',()=>changeSettings({[key]:id}),'ip-option');
      b.dataset.choiceKey=key;b.dataset.choiceVal=id;b.setAttribute('aria-pressed','false');
      if (style==='segmented') b.textContent=caption;
      if (style==='swatches') {
        const dot=el('i'); dot.style.backgroundColor=detail; dot.setAttribute('aria-hidden','true');
        b.append(dot,el('span','',caption));
      }
      if (style==='machine-grid') {
        b.setAttribute('aria-label',caption+' '+detail);
        b.append(makePreview('mechanismTile',{mechanismStyle:id}),el('span','ip-option-title',caption),el('small','',detail));
        b.title=caption+': '+detail;
      }
      if (style==='sound-grid') {
        b.setAttribute('aria-label',caption+' '+detail);
        b.dataset.disableBy='soundEnabled';
        b.append(el('span','ip-check'),append(el('span',''),el('span','ip-option-title',caption),el('small','',detail)));
      }
      field.append(b);
    }
    return style.endsWith('-grid')?field:row(el('span','',label),field);
  }
  const scenes=[['Кожаный стол','Кожа · бронзовые лампы','leather','brassLamps'],['Ореховый стол','Орех · бронзовые лампы','walnut','brassLamps'],['Тёплый дуб','Медовый дуб · льняные абажуры','oak','linenLamps']];
  function sceneChoices() {
    const out=el('div','ip-options ip-scenes');out.setAttribute('role','group');out.setAttribute('aria-label','Готовые оформления стола');
    for (const [name,desc,deskFinish,deskAccent] of scenes) {
      const b=button('',()=>changeSettings({deskFinish,deskAccent}),'ip-option');
      b.dataset.scene=deskFinish;b.dataset.accent=deskAccent;
      b.setAttribute('aria-label',name+' '+desc);
      b.append(append(el('span','ip-scene-header'),el('span','ip-option-title',name),el('span','ip-check')),el('small','',desc));
      out.append(b);
    }
    return out;
  }
  function shape() { return [tab,prefs.paperTexture==='smooth',prefs.paperEmbossing==='none',prefs.wornInk,prefs.mechanismStyle==='classic',prefs.matchRailToStyle].join(); }
  function renderSettingsBody() {
    const top=body.scrollTop;
    const active=document.activeElement;
    const before=[active?.dataset.bind,active?.dataset.choiceKey, active?.dataset.choiceVal, active?.dataset.scene];
    cleanupPreviews();
    let nodes;
    switch (tab) {
      case 'paper':
        nodes=[makePreview('paper'),
          card('Разметка страницы',null,options('paperMotion','Подача бумаги','segmented'),options('paperStartPosition','Начало письма','segmented'),
            el('p','ip-note ip-start-note'),toggle('wideMargins','Широкие поля')),
          card('Поверхность бумаги','Выберите цвет и фактуру бумаги.',options('paper','Цвет бумаги','swatches'),
            select('paperTexture','Фактура'),prefs.paperTexture!=='smooth'&&slider('textureStrength','Выраженность фактуры'),toggle('curvedPaper','Загнутые верхние углы'),
            select('marginStyle','Оформление полей')),
          card('Тиснение','Рельефный оттиск на бумаге.',select('paperEmbossing','Оттиск'),prefs.paperEmbossing!=='none'&&slider('embossingDepth','Глубина тиснения'))];
        break;
      case 'type':
        nodes=[makePreview('type'),card('Шрифт',null,select('writingFont','Гарнитура'),slider('fontSize','Размер шрифта',{percentage:false})),
          card('Лента и чернила',null,toggle('wornInk','Изношенная лента'),prefs.wornInk&&slider('inkBuildup','Насыщенность оттиска'),
            prefs.wornInk&&note('При неравномерном оттиске одни буквы темнее и толще, а другие бледнее.'),
            slider('inkStrength','Темнота чернил'),options('ribbon','Цвет ленты','swatches')),
          note('Шрифт и оформление бумаги не входят в текстовый экспорт. Чтобы сохранить оформление, выберите PDF.')];
        break;
      case 'machine':
        nodes=[makePreview('machine'),
          card('Стиль каретки','Та же машинка, но с другим характером.',options('mechanismStyle','Стиль каретки','machine-grid')),
          card('Отделка',null,prefs.mechanismStyle==='classic'?options('capsule','Цвет каретки','swatches'):toggle('matchRailToStyle','Подбирать направляющую под каретку'),
            prefs.mechanismStyle==='classic'||!prefs.matchRailToStyle?select('rail','Отделка направляющей'):row(el('span','','Отделка направляющей'),el('span','ip-preferred-rail')))];
        break;
      case 'desk':
        nodes=[makePreview('desk'),card('Оформление стола',null,sceneChoices(),select('deskFinish','Материал стола'),select('deskAccent','Предметы на столе'),
          toggle('widerFocusPaper','Шире лист в режиме фокуса'),note('В режиме фокуса и в узких окнах предметы на столе скрываются. Настройки бумаги, тиснения и подачи сохраняются.'))];
        break;
      case 'sound': {
        const preview=button('',()=>callbacks.onPreviewSound?.(),'ip-emphasis ip-preview-sound-button');
        preview.append(icon('play'),document.createTextNode('Послушать'));
        nodes=[card('Звуки печатной машинки','Звонок раздаётся примерно за семь знаков до конца строки.',toggle('soundEnabled','Звуки механизма'), options('typewriterSound','Звуки печатной машинки','sound-grid')),
          card('Громкость звука',null,slider('soundVolume','Громкость',{disabledBy:'soundEnabled'}),
            row(preview,note('Клавиши, пробел, звонок и возврат каретки'))),
          note('Образец звучит только после нажатия кнопки. Звук можно отключить в любой момент.')];
        break;
      }
      case 'light':
        nodes=[makePreview('light'),card('Ночной режим','Мягкий свет вокруг строки, на которой вы пишете.',toggle('nightMode','Ночной режим'),
          slider('lampIntensity','Яркость лампы',{disabledBy:'nightMode'}),append(el('div'),slider('lampWarmth','Теплота света',{disabledBy:'nightMode'}),append(el('div','ip-warmth'),el('span','','Холодный белый'),el('span','','Янтарный')))),
          note('Нажмите на каретку, чтобы включить или выключить подсветку.')];
        break;
      case 'storage': {
        const path=el('p','ip-path',storage.path||'Хранилище недоступно');
        const backup=button('Скачать копию…',e=>run('backup',undefined,undefined,e.currentTarget),'ip-emphasis');
        const restore=button('Импортировать копию…',e=>run('restoreBackup',undefined,undefined,e.currentTarget));
        backup.disabled=restore.disabled=!storage.available;
        nodes=[card('Хранилище писем','Inkrail хранит письма на этом устройстве, в этом браузере.',path,
          append(el('div','ip-storage-actions'),backup,restore),
          note('Резервная копия включает письма, корзину и настройки стола. При импорте письма добавляются без замены существующих, а настройки из копии применяются.')),
          !storage.available&&card('Хранилище браузера недоступно',null,note('Разрешите браузеру хранить данные сайта и откройте Inkrail заново. Экспортируйте несохранённые письма перед закрытием вкладки.')),
          storage.message&&card('Состояние хранилища',null,note(storage.message)),
          note('При очистке данных сайта или завершении приватного сеанса письма могут исчезнуть. Храните резервные копии отдельно: Inkrail не синхронизирует письма между браузерами и устройствами.')];
        break;
      }
    }
    body.replaceChildren(...nodes.filter(Boolean));
    visibleShape=shape();body.scrollTop=top;
    if (before.some(Boolean)) {
      Array.from(body.querySelectorAll('[data-bind],[data-choice-key],[data-scene]'))
        .find(x=>x.dataset.bind===before[0]&&x.dataset.choiceKey===before[1]&&x.dataset.choiceVal===before[2]&&x.dataset.scene===before[3])
        ?.focus({preventScroll:true});
    }
    reflectSettings();
  }
  function reflectSettings(renderPreviews=true) {
    for (const f of body.querySelectorAll('[data-bind]')) {
      const value=prefs[f.dataset.bind];
      if (f.type==='checkbox') f.checked=value; else f.value=String(value);
    }
    for (const chosen of body.querySelectorAll('[data-choice-key]')) chosen.setAttribute('aria-pressed',String(prefs[chosen.dataset.choiceKey]===chosen.dataset.choiceVal));
    for (const pick of body.querySelectorAll('[data-scene]')) pick.setAttribute('aria-pressed',String(prefs.deskFinish===pick.dataset.scene&&prefs.deskAccent===pick.dataset.accent));
    for (const f of body.querySelectorAll('[data-disable-by]')) f.disabled=!prefs[f.dataset.disableBy];
    for (const out of body.querySelectorAll('[data-value-for]')) {
      const val=prefs[out.dataset.valueFor];out.value = (out.dataset.unit.endsWith('%')?Math.round(val*100):Math.round(val))+out.dataset.unit;
    }
    const preview=body.querySelector('.ip-preview-sound-button');
    if (preview) preview.disabled=!prefs.soundEnabled||prefs.soundVolume===0;
    const rail=body.querySelector('.ip-preferred-rail');
    if (rail) rail.textContent=labelFor('rail',preferredRail[prefs.mechanismStyle]);
    const start=body.querySelector('.ip-start-note');
    if (start) start.textContent=prefs.paperStartPosition==='top'?'Пишите сверху. Бумага начнёт двигаться вверх, когда текст дойдёт до нижней части листа.':'Пишите у нижнего края. С каждой новой строкой бумага будет двигаться вверх.';
    if (renderPreviews) previews.forEach(hydratePreview);
  }
  function activateTab(id,{focus=false}={}) {
    if (!tabs.some(([key])=>key===id)) id='paper';
    if (id!==tab) stopAudio();
    tab=id;
    for (const btn of nav.querySelectorAll('[role="tab"]')) {
      const active=btn.dataset.tab===tab;
      btn.setAttribute('aria-selected',String(active));
      btn.tabIndex=active?0:-1;
      if (active) {
        body.setAttribute('aria-labelledby',btn.id);
        if (focus) btn.focus();
      }
    }
    footer.firstElementChild.textContent=tab==='storage'?'Ваши письма · в этом браузере':'Настройки вашего письменного стола';
    clearError();
    body.scrollTop=0;
    renderSettingsBody();
  }
  function buildSettings() {
    const header=makeHeader('Настройки','Устройте письменный стол по-своему.','ip-emphasis');
    nav=el('nav','ip-tabs');
    nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Разделы настроек');
    for (const [i,[id,name]] of tabs.entries()) {

      const b=button(name,()=>activateTab(id),'ip-tab');
      b.id='ip-tab-'+id;b.dataset.tab=id;b.setAttribute('role','tab');b.setAttribute('aria-controls','ip-settings-body');
      b.addEventListener('keydown',ev=>{
        let index;
        if (ev.key==='ArrowRight') index=(i+1)%tabs.length;
        else if (ev.key==='ArrowLeft') index=(i+tabs.length-1)%tabs.length;
        else if (ev.key==='Home') index=0;
        else if (ev.key==='End') index=tabs.length-1;
        else return;
        ev.preventDefault(); ev.stopPropagation();activateTab(tabs[index][0],{focus:true});
      });
      nav.append(b);
    }
    body=el('div','ip-settings-body');body.id='ip-settings-body';body.setAttribute('role','tabpanel');
    footer=append(el('footer','ip-settings-footer'),el('span'),el('span','','С ♥ от Аарьяна Вермы'));
    footer.lastElementChild.setAttribute('aria-label','Сделано с любовью. Автор: Аарьян Верма.');
    dialog.replaceChildren(header,nav,body,footer);
    addError(dialog);
    dialog.insertBefore(errorBox,body);
    activateTab(tab);
  }
  function buildSeal(page) {
    const existing=normalizeSeal(page.seal);
    const draft={...(existing || defaultSeal)};
    const form=el('form','ip-seal-form');
    const heading=el('h2','','Печать для письма');
    heading.id=headingId;
    const preview=el('div','ip-seal-preview');
    const field=el('input','ip-title-input');
    field.type='text';field.value=draft.text;field.autocomplete='off';
    const textLabel=el('label','ip-seal-field');
    textLabel.append(append(el('span','ip-seal-label'),el('span','','Надпись на печати'),el('small','', `До ${quantity(sealTextLimit,'знака','знаков','знаков')}`)),field);
    const apply=el('button','ip-emphasis',existing?'Сохранить':'Поставить печать');
    apply.type='submit';
    function previewDraft() {
      const value=normalizeSeal(draft);
      preview.replaceChildren(drawSeal(value || {...draft,text:''}));
      apply.disabled=!value;
    }
    function updateText(event) {
      if (event.isComposing) return;
      const limited=limitSealText(field.value);
      if (field.value!==limited) field.value=limited;
      draft.text=limited;
      previewDraft();
    }
    field.addEventListener('input',updateText);
    field.addEventListener('compositionend',updateText);
    function choiceField(key,label,choices) {
      const field=el('select','ip-select');
      for (const [id,name] of Object.entries(choices)) field.add(new Option(name,id));
      field.value=draft[key];
      field.onchange=()=>{draft[key]=field.value;previewDraft();};
      return append(el('label','ip-seal-field'),el('span','',label),field);
    }
    const choices=append(el('div','ip-seal-choices'),choiceField('shape','Форма',sealShapes),choiceField('color','Цвет воска',sealColors));
    const actions=el('footer','ip-confirm-actions');
    if (existing) actions.append(button('Снять печать',async e=>{
      if (await run('setSeal',page.id,null,e.currentTarget,true)) close();
    },'ip-plain ip-remove-seal'));
    actions.append(button('Отмена',close),apply);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const value=normalizeSeal(draft);
      if (value && await run('setSeal',page.id,value,apply,true)) close();
    });
    form.append(heading,preview,textLabel,choices);
    addError(form);
    form.append(actions);
    dialog.replaceChildren(form);
    previewDraft();
  }
  function buildLibrary() {
    const header=makeHeader('Библиотека писем','Все ваши письма в одном месте.','ip-plain',true);
    searchInput=el('input','ip-search');searchInput.type='search';
    searchInput.placeholder='Поиск по названию или тексту…';searchInput.setAttribute('aria-label', searchInput.placeholder);
    searchInput.spellcheck=false;searchInput.autocomplete='off';
    const clear=iconButton('clear','Очистить поиск',()=>{searchInput.value='';searchInput.dispatchEvent(new Event('input'));searchInput.focus();});
    clear.hidden=true;
    searchInput.addEventListener('input',()=>{
      query=searchInput.value;
      clear.hidden=!query;
      renderLibraryRows();
    });
    const search=append(el('div','ip-search-line'),icon('search'),searchInput,clear);
    warningBox=el('p','ip-note ip-trash-warning');
    libraryList=el('div','ip-library-list');
    libraryList.setAttribute('role','region');
    libraryList.setAttribute('aria-label','Письма');
    bottom=el('footer','ip-library-footer');
    dialog.replaceChildren(header,search,warningBox,libraryList,bottom);
    addError(dialog);dialog.insertBefore(errorBox,libraryList);
    renderLibrary();
  }
  function renderLibrary() {
    dialog.querySelector('#'+headingId).textContent=showDeleted?'Корзина':'Библиотека писем';
    dialog.querySelector('.ip-header p').textContent=showDeleted?'Письма можно восстановить в течение 30 дней. Затем они удаляются навсегда.':'Все ваши письма в одном месте.';
    warningBox.hidden=!showDeleted||!library.trashWarning;
    warningBox.textContent=showDeleted?(library.trashWarning||''):'';
    const toggleBtn=button(showDeleted?'К письмам':'Корзина',async e=>{
      if (busy) return;
      const trigger=e.currentTarget;
      if (showDeleted) { showDeleted=false; clearError(); }
      else {
        showDeleted=true;
        const ok=await run('listTrash',undefined,undefined,trigger);
        if (!ok) showDeleted=false;
      }
      if (kind==='library') {
        libraryList.scrollTop=0;
        renderLibrary();
        bottom.firstElementChild?.focus({preventScroll:true});
      }
    });
    const right=el('div');
    if (!showDeleted) {
      right.append(button('Импорт',async e=>{ if (await run('import',undefined,undefined,e.currentTarget, true)) close(); }),
        button('+ Новое письмо',async e=>{ if (await run('new',undefined,undefined,e.currentTarget, true)) close(); }));
    }
    bottom.replaceChildren(toggleBtn,right);
    renderLibraryRows();
  }
  function renderLibraryRows() {
    const active=document.activeElement;
    const before=[active?.dataset.page,active?.dataset.rowAction];
    const top=libraryList.scrollTop;
    const groups=letterGroups(showDeleted?library.deleted:library.pages,query);
    const children=[];
    libraryBusyButtons.clear();
    if (!groups.length) children.push(el('p','ip-empty',showDeleted?'В корзине нет писем.':'Письма не найдены.'));
    for (const {month,pages} of groups) {
      const section=append(el('section','ip-month'),el('h3','',month));
      for (const page of pages) section.append(letterRow(page));
      children.push(section);
    }
    libraryList.replaceChildren(...children);
    libraryList.scrollTop=top;
    if (before[0]) {
      const replacement=Array.from(libraryList.querySelectorAll('button[data-page]')).find(b=>b.dataset.page===before[0]&&b.dataset.rowAction===before[1]);
      replacement?.focus({preventScroll:true});
    }
  }
  function letterRow(page) {
    const id=idOf(page), title=pageTitle(page), d=modified(page);
    const selected=!showDeleted&&library.selectedID!=null&&String(library.selectedID).toLowerCase()===id.toLowerCase();
    const item=el('article','ip-letter-row'+(selected?' ip-current':''));
    item.dataset.page=id;
    let content;
    if (showDeleted) content=el('div','ip-open-letter');
    else {
      content=button('',async e=>{ if (await run('select',id,undefined,e.currentTarget,true)) close(); },'ip-open-letter');
      content.setAttribute('aria-label','Открыть: '+title);
      if (selected) content.setAttribute('aria-current','true');
      markAction(content,id,'select');
    }
    const top=append(el('span','ip-letter-top'),el('span','ip-letter-title',title),el('time','',Number.isFinite(+d)?new Intl.DateTimeFormat(uiLocale,{day:'numeric'}).format(d):''));
    if (Number.isFinite(+d)) top.lastElementChild.dateTime=d.toISOString();
    content.append(top,el('span','ip-letter-preview',pagePreview(page)||'Пустой лист.'));
    item.append(content);
    let controls=[];
    if (showDeleted) {
      const restore=button('Восстановить',e=>run('restore',id,undefined,e.currentTarget));
      restore.setAttribute('aria-label','Восстановить: '+title);
      markAction(restore,id,'restore');controls.push(restore);
    } else {
      const rename=iconButton('edit','Переименовать: '+title,()=>openRename(page));
      const del=iconButton('trash','В корзину: '+title,()=>openTrash(page));
      del.title='Переместить в корзину';
      markAction(rename,id,'rename');markAction(del,id,'trash');
      controls.push(rename,del);
      // Keyboard alternative to the visible rename icon.
      item.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();openRename(page);}});
      item.addEventListener('contextmenu',e=>{e.preventDefault();openRename(page);});
    }
    item.append(append(el('span','ip-letter-actions'),...controls));
    return item;
  }
  function markAction(node,id,action) {
    node.dataset.page=id;node.dataset.rowAction=action;node.disabled=busy;
    libraryBusyButtons.add(node);
  }
  async function run(action,id,value,trigger,successFalsy=false) {
    if (busy) return false;
    const at=revision;
    const subAlert=sub.open?sub.querySelector('.ip-error'):null;
    if (subAlert) subAlert.hidden=true; else clearError();
    busy=true;
    if(trigger) trigger.disabled=true;
    libraryBusyButtons.forEach(x=>{x.disabled=true;});
    let ok=false;
    try {
      const response=await callbacks.onAction?.(action,id,value);
      ok=revision===at && (!successFalsy || response!==false);
    } catch (error) {
      if (revision===at) {
        if (subAlert) {
          subAlert.textContent=errorText(error);
          subAlert.hidden=false;
        } else report(error);
      }
    } finally {
      if (revision===at) {
        busy=false;
        const cancelLock=['backup','restoreBackup'].includes(action)&&!storage.available;
        if(trigger) trigger.disabled=cancelLock;
        libraryBusyButtons.forEach(x=>{x.disabled=false;});
      }
    }
    return ok;
  }
  function openSub(title,detail,body,confirmLabel,confirm,returnFocus) {
    if (busy||sub.open) return false;
    returnFromSub=returnFocus;
    const titleNode=el('h3','',title);titleNode.id=subheadingId;
    const caption=note(detail); caption.id='ip-sub-caption';
    sub.setAttribute('aria-describedby',caption.id);
    const alert=el('p','ip-error');alert.setAttribute('role','alert');alert.hidden=true;
    const form=el('form','ip-confirm-form');
    const cancel=button('Отмена',()=>{if(!busy) sub.close();});
    const submit=el('button',returnFocus?.action==='trash'?'ip-emphasis ip-destructive':'ip-emphasis',confirmLabel);
    submit.type='submit';
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if (await confirm(submit) && sub.open) sub.close();
    });
    form.append(titleNode,...(body?[body]:[]),caption,alert,append(el('footer','ip-confirm-actions'),cancel,submit));
    sub.replaceChildren(form);
    sub.showModal();
    (body||cancel).focus({preventScroll:true});
    return true;
  }
  function openRename(page) {
    const field=el('input','ip-title-input');field.type='text';field.setAttribute('aria-label','Личное название');
    field.placeholder='Личное название';field.autocomplete='off';
    field.value=page.privateTitle||'';
    if (openSub('Переименовать письмо','Название видно только в библиотеке. Оставьте его пустым, чтобы вместо него показывалась первая строка письма.',field,'Сохранить',
      trigger=>run('rename',idOf(page),field.value,trigger),{page:idOf(page),action:'rename'})) field.select();
  }
  function openTrash(page) {
    openSub('Переместить письмо в корзину?','Письмо можно восстановить из корзины в течение 30 дней. Затем оно будет удалено навсегда.',null,'В корзину',
      trigger=>run('trash',idOf(page),undefined,trigger),{page:idOf(page),action:'trash'});
  }
  function update(values) {
    const next=normalizeSettings(values);
    const changed=Object.keys(defaults).filter(key=>prefs[key]!==next[key]);
    if (!changed.length) return;
    if (changed.some(k=>['soundEnabled','typewriterSound','soundVolume'].includes(k))) stopAudio();
    prefs=next;
    if (kind==='settings') {
      if (shape()!==visibleShape) renderSettingsBody();
      else reflectSettings();
    }
  }
  return {
    showSettings(section='paper') {
      const next=String(section).toLowerCase();
      if (kind==='settings' && dialog.open) {activateTab(next,{focus:true});return;}
      tab=tabs.some(([key])=>key===next)?next:'paper';
      open('settings');
    },
    showLibrary() { open('library'); },
    showSeal(page) { open('seal',page); },
    close,
    isOpen() {return dialog.open;},
    update,
    setLibrary(values={}) {
      library={...library,...values};
      if (kind==='library') {
        warningBox.hidden=!showDeleted||!library.trashWarning;
        warningBox.textContent=showDeleted?(library.trashWarning||''):'';
        renderLibraryRows();
      }
    },
    setStorage(values={}) {
      const before=storage;
      storage={...storage,...values};
      if (kind==='settings'&&tab==='storage'&&Object.keys(storage).some(key=>storage[key]!==before[key])) renderSettingsBody();
    },
    destroy() { if(sub.open) sub.close(); if(dialog.open) close(); dialog.remove(); sub.remove(); },
  };
}

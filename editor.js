import {shortcutKey} from './ru.js';
import {crossedBellPoint} from './margin-bell.js';
import {defaults} from './defaults.js';
import {emphasis, markdownLines, shortcutAt, expandFormatting, compactFormatting} from './markdown.js';
import {drawSeal, hasLetterText, normalizeSeal} from './seal.js';

export const writingFonts = Object.freeze({
  courier:'"Inkrail Courier Prime", monospace',
  courierNew:'"Courier New", "Liberation Mono", monospace',
  americanTypewriter:'"American Typewriter", "Rockwell", "Bookman Old Style", Georgia, serif',
  typewriterLight:'"American Typewriter", "Bookman Old Style", "Century Schoolbook", Georgia, serif',
  typewriterCondensed:'"American Typewriter Condensed", "Rockwell Condensed", Cambria, "Liberation Serif", serif',
  menlo:'Menlo, Consolas, "Liberation Mono", monospace',
  monaco:'Monaco, "Lucida Console", "DejaVu Sans Mono", monospace',
  georgia:'Georgia, "Liberation Serif", serif'
});
const ribbon={carbon:[41,43,38],midnight:[33,61,87],oxblood:[89,31,36]};
const formatType='application/x-inkrail-selection';
const amount=(value,min,max,defaultValue)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):defaultValue;
export function styleWritingPreview(element,settings={}) {
  const rgb = (ribbon[settings.ribbon] || ribbon.carbon).join(' '), strength=amount(settings.inkStrength,.35,1,.88);
  const font=writingFonts[settings.writingFont] || writingFonts.courier;
  const size=amount(settings.fontSize,15,28,20);
  const values={'--ink-font':font,'--ink-font-size':size+'px','--ink-color':'rgb('+rgb+' / '+strength+')',
    '--ink-pressure':strength, '--ink-tint':rgb, '--ink-weight':settings.writingFont==='typewriterLight'?'300':'400'};
  for(const [name,value] of Object.entries(values)) element.style.setProperty(name,value);
}
export function caretLimit(height, position) { return Math.max(position==='bottom'?1:100,height-(position==='bottom'?4:28)); }
export function topInset(height,line,position) { return position==='bottom'?Math.max(68,caretLimit(height,position)-line):68; }
export function desiredOffset(bottom,offset,height,position) { return Math.max(0,position==='bottom'?bottom-caretLimit(height,position):Math.max(offset,bottom-caretLimit(height,position))); }

export function rollProjection(width,height) {
  const bend=Math.max(1,Math.min(180,Math.max(1,height)*.72));
  return {bend,y(value){return value>=bend?value:Math.sign(value+bend)*(value+bend)**2/(4*bend);},
    x(value,y){const scale=.88+.12*Math.max(0,Math.min(1,(y+bend)/(2*bend)));return width/2+(value-width/2)*scale;},
    scaleX(y){return .88+.12*Math.max(0,Math.min(1,(y+bend)/(2*bend)));}};
}
const seg = new Intl.Segmenter();
const normalizeNewline=s=>s.replace(/\r\n|[\r\u0085\u2028\u2029]/g,'\n');
function normalized(text,style) {
  let output='',i=0,j=0;
  const endings=new Map();
  if(normalizeNewline(text)===text) {
    for(let k=text.indexOf('\n'); k>=0; k=text.indexOf('\n',k+1)) endings.set(k,{value:'\n'});
    return {text,style,endings};
  }
  const next=new Uint8Array(text.length);
  for(;i<text.length;i++) {
    const c=text[i];
    next[j]=style[i];
    const normalized=normalizeNewline(c);
    if(normalized==='\n') {
      if(c==='\r'&&text[i+1]==='\n') endings.set(j,{value:'\r\n',secondStyle:style[++i]});
      else endings.set(j,{value:c});
    }
    j++;output+=normalized;
  }
  return {text:output,style:next.subarray(0,j),endings};
}
export function inkImpression(index,unit,buildup,size) {
  const u=n=>BigInt.asUintN(64,n);
  let hash=u(BigInt(index)*0x9e3779b97f4a7c15n+BigInt(unit)*0xbf58476d1ce4e5b9n);
  hash=u((hash^(hash>>30n))*0xbf58476d1ce4e5b9n);
  hash=u((hash^(hash>>27n))*0x94d049bb133111ebn);
  hash^=hash>>31n;
  const pressure=Number((hash>>12n)%101n)/100, strike=Number(hash%100n), a=amount(buildup,0,1,.55), scale=amount(size,1,144,20)/20;
  const base=.82+pressure*.18;
  return {opacity:strike<24?base+(1-base)*a:base-(strike<42?(.22+pressure*.12)*a:0),
    x:(Number((hash>>24n)%7n)-3)*.035*a*scale,
    spread:strike<24?(.46+pressure*.24)*a*scale:0,
    spreadOpacity:strike<24?.30+.28*a:0};
}
export function styleInkStrike(el,v) {
  const px=n=>n.toFixed(3)+'px';
  el.style.setProperty('--press-x',px(v.x));
  el.style.setProperty('--strike',v.opacity.toFixed(3));
  if(v.spread) {
    const color='rgb(var(--ink-tint) / calc(var(--ink-pressure) * '+v.spreadOpacity.toFixed(3)+'))';
    el.style.textShadow=[[1,.12],[-.60,.45],[.10,-.55]].map(([x,y])=>px(x*v.spread)+' '+px(y*v.spread)+' 0 '+color).join(',');
  }
}
function styleSpan(span,mask) {
  if(mask) span.dataset.emphasis=String(mask);
  for(const [name,m] of Object.entries(emphasis)) if(mask&m) span.classList.add('ink-'+name);
}
function clipboardHTML(text,style) {
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>');
  const tags=['strong','em','u','s','code'], chunks=[];
  for(let a=0;a<text.length;) {
    let b=a+1; while(b<text.length&&style[b]===style[a]) b++;
    let value=escape(text.slice(a,b));
    for(let i=0;i<tags.length;i++) if(style[a]&(1<<i)) value='<'+tags[i]+'>'+value+'</'+tags[i]+'>';
    chunks.push(value); a=b;
  }
  return chunks.join('');
}
function htmlStyles(html) {
  const template=document.createElement('template');
  template.innerHTML=html; // Keep pasted markup inert. Only collect text and allowed bit flags.
  let text='', formats=[];
  function visit(node,mask) {
    if(node.nodeType===3) {
      const value=node.textContent;
      if(mask&&value.length) formats.push({location:text.length,length:value.length,emphasis:mask});
      text+=value; return;
    }
    if(node.nodeType!==1) return;
    const tag=node.localName;
    if(['style','script','head','img','object','iframe','template','svg'].includes(tag)) return;
    if(tag==='br') {text+='\n';return;}
    const s=node.style;
    if(['b','strong'].includes(tag)||s?.fontWeight==='bold'||Number(s?.fontWeight)>=600) mask|=1;
    if(['i','em'].includes(tag)||/italic|oblique/.test(s?.fontStyle||'')) mask|=2;
    if(tag==='u'||/underline/.test(s?.textDecoration||'')) mask|=4;
    if(['s','strike','del'].includes(tag)||/line-through/.test(s?.textDecoration||'')) mask|=8;
    if(tag==='code') mask|=16;
    const block=/^(?:div|p|li|ul|ol|blockquote|h[1-6]|tr)$/.test(tag);
    if(block&&text&&!text.endsWith('\n')) text+='\n';
    for(const child of node.childNodes) visit(child,mask);
  }
  for(const child of template.content.childNodes) visit(child,0);
  return {text,style:expandFormatting(text,formats)};
}
export function mountEditor(surface, {onChange=()=>{}, onMove=()=>{}, onSound=()=>{}, onFormat=()=>{}}={}) {
  const scroller=document.createElement('div');
  scroller.className='ink-editor-scroll';
  const node=document.createElement('div');
  node.className='ink-editor';
  node.contentEditable='true';
  node.spellcheck=false;
  node.setAttribute('role','textbox');
  node.setAttribute('aria-label','Текст письма');
  node.setAttribute('aria-multiline','true');
  const placeholder=document.createElement('span');
  placeholder.className='ink-editor-placeholder';
  placeholder.textContent='Начните с любой строки.';
  placeholder.setAttribute('aria-hidden','true');
  placeholder.hidden=true;
  const sealFooter=document.createElement('div');
  sealFooter.className='ink-seal-footer';
  scroller.append(node,sealFooter,placeholder);surface.append(scroller);
  let page={text:''}, text='', style=new Uint8Array(), settings={}, selection=[0,0], typing=0, typingOverride=false;
  let endings=new Map(), preferredEnding='\n', inkKey='';
  // A separate seal edit takes precedence over earlier text undo checkpoints.
  let sealRevision = 0;
  const curvedLines=new Map(), rolledParagraphs=new Map();
  let selectingByPointer=false;
  let lastGeometry=null, viewport={height:0,width:0,inset:0};
  let rendered=[], composing=false, compositionSnapshot=null, pendingNativeCommit=null, undo=[], redo=[], latest=null, frame=0, feed=0, timer=0;
  const limit=150;
  const bottom=()=>settings.paperStartPosition==='bottom';
  const lineHeight=()=>amount(settings.fontSize,15,28,20)*1.54;
  const inkWindows=new Map();
  let inkAnchor=-Infinity;
  const virtualAt=3000;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function snapshot() {
    if(![...endings.values()].some(e=>e.value!=='\n')) return {...page,text,formatting:compactFormatting(style)};
    const decoded=[], renderedStyles=[];
    for(let i=0;i<text.length;i++) {
      const end=endings.get(i);
      decoded.push(end?.value??text[i]);renderedStyles.push(style[i]);
      if(end?.value.length===2) renderedStyles.push(end.secondStyle??style[i]);
    }
    return {...page,text:decoded.join(''),formatting:compactFormatting(renderedStyles)};
  }
  function checkpoint() {
    return {text,style:style.slice(),endings:new Map(endings),selection:[...selection],typing,typingOverride,
      seal:page.seal,sealRevision};
  }
  function history(kind) {
    const now=performance.now();
    if(!latest||!['type','erase'].includes(kind)||latest.kind!==kind||latest.at!==selection[0]||now-latest.time>800||selection[0]!==selection[1]) {
      undo.push(checkpoint()); if(undo.length>limit) undo.shift();
    }
    redo=[]; latest=kind?{kind,time:now,at:selection[0]}:null;
  }
  function endpoint(target,offset) {
    if(target===node) {
      if(offset>=node.children.length) return text.length;
      return rendered[offset]?.start??0;
    }
    let line=target.nodeType===1?target:target.parentElement;
    while(line&&line.parentElement!==node) line=line.parentElement;
    if(!line) return null;
    const start=rendered[line.dataset.index]?.start;
    if(start===undefined) return null;
    const r=document.createRange();r.setStart(line,0);r.setEnd(target,offset);
    return start+r.toString().length;
  }
  function readSelection() {
    const s=getSelection();
    if(!s?.anchorNode||!node.contains(s.anchorNode)||!node.contains(s.focusNode)) return null;
    const a=endpoint(s.anchorNode,s.anchorOffset),b=endpoint(s.focusNode,s.focusOffset);
    return a===null||b===null?null:[a,b];
  }
  function findPoint(index) {
    let lo=0,hi=rendered.length;
    while(lo+1<hi) {
      const mid=(lo+hi)>>1;
      if(rendered[mid].start<=index) lo=mid; else hi=mid;
    }
    const l=rendered[lo], line=node.children[lo], offset=Math.min(index,l.end)-l.start;
    const walk=document.createTreeWalker(line,NodeFilter.SHOW_TEXT);
    let remaining=offset,t;
    while((t=walk.nextNode())) {
      if(t.length>remaining) return [t,remaining];
      if(t.length===remaining) {
        const next=walk.nextNode();
        return next?[next,0]:[t,remaining];
      }
      remaining-=t.length;
    }
    return [line,0];
  }
  function writeSelection() {
    if(document.activeElement!==node) return;
    getSelection()?.setBaseAndExtent(...findPoint(selection[0]),...findPoint(selection[1]));
  }
  function ordered() { return selection[0]<=selection[1]?selection:[selection[1],selection[0]]; }
  function active() {
    const [a,b]=ordered();
    if(a===b) return typing;
    let result=31;
    for(let i=a;i<b&&result;i++) result&=style[i];
    return result;
  }
  let previousFormat=-1;
  function updateFormat() { const m=active();if(m!==previousFormat){previousFormat=m;onFormat(m);} }
  // Paint isolated ASCII and Russian typewriter strikes, but leave combined
  // letters and other scripts intact for the browser's text shaper.
  function simpleStrike(i,clusters) {
    const c=text.charCodeAt(i);
    if(!((c>=33&&c<=126)||(c>=0x410&&c<=0x44f)||c===0x401||c===0x451))return false;
    if(!(text.charCodeAt(i+1)>127||text.charCodeAt(i-1)>127))return true;
    const set=clusters();return set.containing(i-set.base)?.segment.length===1;
  }
  function strikesFor(start,end) {
    const base=Math.max(0,start-32);
    let clusters;
    const get=()=>{
      if(!clusters) {const items=seg.segment(text.slice(base,end+32));
        clusters={base,containing:i=>items.containing(i)};}
      return clusters;
    };
    return i=>simpleStrike(i,get);
  }
  // Keep every strike on its native baseline, including at fractional display
  // scales. Ribbon wear varies the ink and horizontal registration.
  function press(i,sourceIndex,pointSize) {
    const el=document.createElement('span'),v=inkImpression(sourceIndex,text.charCodeAt(i),settings.inkBuildup,pointSize);
    el.className='ink-press';el.textContent=text[i];styleInkStrike(el,v);
    return el;
  }
  function pressRange(dest,start,end,line,eligible=strikesFor(start,end)) {
    for(let i=start;i<end;) {
      if(eligible(i)){dest.append(press(i,i+line.sourceDelta,line.pointSize));i++;}
      else {const at=i++;while(i<end&&!eligible(i))i++;dest.append(document.createTextNode(text.slice(at,i)));}
    }
  }
  // Very long native text nodes force Chromium to reshape unrelated scripts
  // when a visible UTF-16 range is measured. Plain inline runs keep those
  // measurements local, without injecting break opportunities or model text.
  // Prefer whitespace, but never split a composed cluster (even one longer
  // than a chunk); identical inline styles preserve native bidi and shaping.
  function flatRun(segment,value) {
    if(value.length<=768){segment.textContent=value;return;}
    let clusters;
    for(let start=0;start<value.length;) {
      let end=Math.min(start+384,value.length);
      if(end<value.length) {
        const space=value.slice(start+224,end).lastIndexOf(' ');
        if(space>=0)end=start+225+space;
        if(value.charCodeAt(end)>127||value.charCodeAt(end-1)>127) {
          clusters??=seg.segment(value);const g=clusters.containing(end);
          end=g.index>start?g.index:g.index+g.segment.length;
        }
      }
      const part=document.createElement('span');
      part.textContent=value.slice(start,end);segment.append(part);start=end;
    }
  }
  function renderLine(l,index,worn) {
    const raw=l.raw, format=l.format, prefix=l.prefix;
    const line=document.createElement('div');
    line.className='ink-line'; line.dataset.index=String(index);
    if(prefix) {
      line.classList.add('ink-block-'+prefix.kind);
      if(prefix.kind==='heading') line.style.setProperty('--heading-scale',String(l.scale));
      if(prefix.kind==='list') line.style.setProperty('--marker-width',prefix.source.length+'ch');
    }
    const mark=prefix?.kind==='heading'?prefix.source.length:0;
    for(let j=0;j<raw.length;) {
      const start=j++,mask=format[start],hidden=start<mark;
      while(j<raw.length&&format[j]===mask&&(j<mark)===hidden) j++;
      const segment=document.createElement('span');
      styleSpan(segment,mask);
      if(hidden) segment.className='ink-heading-marker';
      const value=raw.slice(start,j);
      if(worn&&!hidden)pressRange(segment,l.start+start,l.start+j,l);
      else if(!hidden)flatRun(segment,value);
      else segment.textContent=value;
      line.append(segment);
    }
    if(!raw) line.append(document.createElement('br'));
    return line;
  }
  // Build the full flat impression independently of the scroll and roller caches.
  function printContent() {
    const content=node.cloneNode(false);
    for (const attribute of ['contenteditable','role','aria-label','aria-multiline']) content.removeAttribute(attribute);
    content.style.paddingBlock='0';
    for(const [i,line] of rendered.entries()) {
      const printed=renderLine(line,i,settings.wornInk!==false);
      if(line.prefix?.kind==='heading') printed.querySelectorAll('.ink-heading-marker').forEach(marker=>marker.remove());
      content.append(printed);
    }
    const fragment=document.createDocumentFragment();
    fragment.append(content);
    if(!sealFooter.hidden) fragment.append(sealFooter.cloneNode(true));
    return fragment;
  }
  function render(force=false) {
    if(composing) return;
    inkKey='';
    const oldScroll=scroller.scrollTop;
    const lines=markdownLines(text), old=rendered;
    const worn=settings.wornInk!==false && text.length<=virtualAt, opt=[worn,settings.inkBuildup,settings.fontSize].join(':');
    const size=amount(settings.fontSize,15,28,20);
    rendered=lines;let sourceDelta=0;
    for(let i=0;i<lines.length;i++) {
      const l=lines[i], raw=text.slice(l.start,l.end), format=style.subarray(l.start,l.end);
      l.sourceDelta=sourceDelta;
      const prefix=l.block&&raw.slice(l.block.source.length).trim()?l.block:null;
      const scale=prefix?.kind==='heading'?1.05+(6-prefix.level)*.08:1;
      l.prefix=prefix;l.scale=scale;l.pointSize=size*scale;
      if(endings.get(l.end)?.value.length===2)sourceDelta++;
      const previous=old[i], existing=node.children[i];
      const changed=force||!existing||!previous||previous.raw!==raw||previous.literal!==l.literal||previous.opt!==opt||
        (worn&&(previous.start!==l.start||previous.sourceDelta!==l.sourceDelta))||format.length!==previous.format.length||format.some((m,k)=>m!==previous.format[k]);
      l.raw=raw;l.opt=opt;l.format=changed?format.slice():previous.format;
      if(!changed) continue;
      const line=renderLine(l,i,worn);
      if(existing) {curvedLines.delete(existing);existing.replaceWith(line);} else node.append(line);
    }
    while(node.children.length>lines.length) {curvedLines.delete(node.lastElementChild);node.lastElementChild.remove();}
    writeSelection();scroller.scrollTop=oldScroll;
  }
  function reflow() {
    const height=scroller.clientHeight, width=scroller.clientWidth;
    const inset=topInset(height,lineHeight(),settings.paperStartPosition);
    const result={resized:height!==viewport.height||width!==viewport.width,insetDelta:inset-viewport.inset,offset:scroller.scrollTop};
    viewport={width,height,inset};
    node.style.paddingTop=inset+'px';
    node.style.paddingBottom=(bottom()?4:28)+'px';
    node.toggleAttribute('data-narrow-margins', settings.wideMargins === false);
    return result;
  }
  function afterReflow({resized,insetDelta,offset},layoutChanged=false) {
    if(layoutChanged||resized&&lastGeometry?.visible!==false)follow();
    else {
      if(resized&&insetDelta)scroller.scrollTop=offset+insetDelta;
      scheduleMove();
    }
  }
  // A bounded set of real editable visual rows, rather than a screenshot.
  // Chromium lays the paragraph out first, then Range supplies the boundaries
  // of the visual rows at the roller. Prefix/suffix retain normal native wrap.
  // No newlines are introduced in the document or its UTF-16 coordinates.
  function sourceUnits(paragraph) {
    const units=[], walk=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
    let length=0,t;
    while((t=walk.nextNode())) {
      if(t.length) {units.push({node:t,start:length,end:length+t.length});length+=t.length;}
    }
    function at(offset) {
      let lo=0,hi=units.length;
      while(lo<hi){const m=(lo+hi)>>1;if(units[m].end<=offset)lo=m+1;else hi=m;}
      const u=units[lo];
      return u?[u.node,offset-u.start]:units.length?[units.at(-1).node,units.at(-1).node.length]:[paragraph,0];
    }
    return {length,at};
  }
  function nativeVisualRows(paragraph, firstRow,lastRow, height, leading) {
    const source=sourceUnits(paragraph), ruler=document.createRange();
    const baseline=paragraph.getBoundingClientRect().top+leading;
    const lineAt=i=>{
      ruler.setStart(...source.at(i));ruler.setEnd(...source.at(i+1));
      const rect=ruler.getClientRects()[0];
      if(!rect||!rect.height) return 0;
      return Math.max(0,Math.floor(((rect.top+rect.bottom)/2-baseline)/height));
    };
    const offsets=new Map([[0,0]]);
    function find(row) {
      if(offsets.has(row))return offsets.get(row);
      let l=0,r=source.length;
      while(l<r){const m=(l+r)>>1;if(lineAt(m)<row)l=m+1;else r=m;}
      // A measured boundary may not split a surrogate pair.
      const [at,off]=source.at(l);
      if(off&&at.nodeType===3&&at.data.charCodeAt(off)>=0xdc00&&at.data.charCodeAt(off)<=0xdfff)l--;
      offsets.set(row,l);return l;
    }
    const result=[];
    if(firstRow>0)result.push({start:0,end:find(firstRow),row:-1});
    for(let row=firstRow;row<=lastRow;row++) {
      const start=find(row),end=find(row+1);
      if(start<end)result.push({start,end,row});
    }
    const end=find(lastRow+1);
    if(end<source.length)result.push({start:end,end:source.length,row:-1});
    return {pieces:result,source};
  }
  function projectVisibleLines() {
    if(composing) return;
    const width=scroller.clientWidth, height=scroller.clientHeight, projection=rollProjection(width,height), offset=scroller.scrollTop;
    const hit=new Set(), visible=new Set();
    let saved=null,reparented=false;
    function preserveSelection() {
      if(!reparented) {saved=readSelection();stripLongInk();reparented=true;}
    }
    function restore(paragraph,entry) {
      preserveSelection();paragraph.replaceChildren(...entry.native);
      rolledParagraphs.delete(paragraph);
    }
    function setTransform(line,top,h){
      const dy=projection.y(top)-top;
      const sy=Math.max(.001,(projection.y(top+h)-projection.y(top))/Math.max(1,h));
      const sx=projection.scaleX(top+h*.5);
      hit.add(line);
      const prev=curvedLines.get(line);
      if(!prev||prev.dy!==dy||prev.sy!==sy||prev.sx!==sx) {
        const pageCenter=width*.5-line.offsetLeft;
        line.style.transformOrigin=pageCenter+'px top';
        line.style.transform='translateY('+dy+'px) scale('+sx+', '+sy+')';
        curvedLines.set(line,{dy,sy,sx});
      }
    }
    if(settings.paperMotion==='roll') {
      if (!sealFooter.hidden) {
        const top=sealFooter.offsetTop-offset;
        if (top<projection.bend && top+sealFooter.offsetHeight>-projection.bend) setTransform(sealFooter,top,sealFooter.offsetHeight);
      }
      let lo=0,hi=node.children.length;
      while(lo<hi) {
        const i=(lo+hi)>>1, p=node.children[i];
        if(p.offsetTop+p.offsetHeight<offset-projection.bend) lo=i+1;else hi=i;
      }
      for(let i=lo;i<node.children.length;i++) {
        const paragraph=node.children[i], top=paragraph.offsetTop-offset;
        if(top>=projection.bend)break;
        visible.add(paragraph);
        const css=getComputedStyle(paragraph);
        const leading=parseFloat(css.paddingTop)||0,trailing=parseFloat(css.paddingBottom)||0;
        const em=parseFloat(css.lineHeight)||lineHeight();
        const rows=Math.max(1,Math.round((paragraph.offsetHeight-leading-trailing)/em));
        if(rows===1&&!rolledParagraphs.has(paragraph)) {setTransform(paragraph,top,paragraph.offsetHeight);continue;}
        const firstRow=Math.max(0,Math.floor((-projection.bend-top-leading)/em));
        const lastRow=Math.min(rows-1,Math.ceil((projection.bend-top-leading)/em));
        const key=[paragraph.clientWidth,em,firstRow,lastRow,settings.writingFont].join(':');
        let entry=rolledParagraphs.get(paragraph);
        if(entry?.key!==key&&!selectingByPointer) {
          if(entry)restore(paragraph,entry);
          paragraph.style.removeProperty('transform');curvedLines.delete(paragraph);
          preserveSelection();
          const {pieces,source}=nativeVisualRows(paragraph,firstRow,lastRow,em,leading);
          const native=[...paragraph.childNodes], fragment=document.createDocumentFragment(), projected=[];
          // Chromium's plaintext paragraph direction must not be re-derived
          // from each wrapped row. Resolve its first strong letter once.
          paragraph.dir='auto';
          const direction=getComputedStyle(paragraph).direction;
          paragraph.removeAttribute('dir');
          const range=document.createRange();
          for(const part of pieces) {
            const wrap=document.createElement('div');
            wrap.className=part.row<0?'ink-roll-rest':'ink-roll-visual-line';
            wrap.dir=direction;
            if(part.start)wrap.style.textIndent='0';
            range.setStart(...source.at(part.start));range.setEnd(...source.at(part.end));
            let content=range.cloneContents(), ancestor=range.commonAncestorContainer;
            if(ancestor.nodeType!==1)ancestor=ancestor.parentElement;
            for(;ancestor&&ancestor!==paragraph;ancestor=ancestor.parentElement) {
              const shell=ancestor.cloneNode(false);shell.append(content);content=shell;
            }
            wrap.append(content);fragment.append(wrap);
            if(part.row>=0)projected.push(wrap);
          }
          paragraph.replaceChildren(fragment);
          entry={key,native,projected};rolledParagraphs.set(paragraph,entry);
        }
        for(const row of entry?.projected??[]) {
          const rowTop=row.offsetTop-offset;
          if(rowTop<projection.bend&&rowTop+row.offsetHeight>-projection.bend)setTransform(row,rowTop,row.offsetHeight);
        }
      }
    }
    for(const [paragraph,entry] of rolledParagraphs) {
      if(!paragraph.isConnected)rolledParagraphs.delete(paragraph);
      else if((settings.paperMotion!=='roll'||!visible.has(paragraph))&&!selectingByPointer)restore(paragraph,entry);
    }
    for(const line of curvedLines.keys()) if(!hit.has(line)) {
      line.style.removeProperty('transform');line.style.removeProperty('transform-origin');curvedLines.delete(line);
    }
    if(reparented) {
      inkKey='';
      if(saved){selection=saved;writeSelection();}
      scroller.scrollTop=offset;
    }
  }
  function cursor(at=selection[1], flat=false) {
    if(!rendered.length) return null;
    let p,o;
    if(composing) {
      // The browser owns the marked text until compositionend. The logical
      // selection still points at the start of the original replacement.
      const native=getSelection();
      if(!native?.focusNode||!node.contains(native.focusNode)) return null;
      p=native.focusNode;o=native.focusOffset;
    } else [p,o]=findPoint(at);
    const r=document.createRange();r.setStart(p,o);r.collapse(true);
    let rect=r.getBoundingClientRect();
    // An empty paragraph's collapsed range has no bounds in Chromium. The
    // break itself has the font's native caret height, just like typed text.
    if(!rect.height && p.nodeType===1 && p.firstChild?.nodeName==='BR') {
      r.selectNode(p.firstChild);
      rect=r.getBoundingClientRect();
    }
    let line=p.nodeType===1?p:p.parentElement;
    while(line?.parentElement!==node&&line?.parentElement&&!curvedLines.has(line)) line=line.parentElement;
    if(!rect.height) {
      const fallback=(p.nodeType===1?p:p.parentElement).getBoundingClientRect();
      const h=Math.min(fallback.height,lineHeight()*(curvedLines.get(line)?.sy??1));
      rect={left:fallback.left,top:fallback.top,bottom:fallback.top+h,height:h};
    }
    const projected=curvedLines.get(line);
    if(!flat||!projected)return rect;
    const transformedTop=line.getBoundingClientRect().top, top=transformedTop-projected.dy;
    const y=top+(rect.top-transformedTop)/projected.sy, height=rect.height/projected.sy;
    return {left:rect.left,top:y,bottom:y+height,height};
  }
  function geometry(flat=false) {
    const c=cursor(selection[1],flat),v=scroller.getBoundingClientRect();
    if(!c) return null;
    const h=scroller.clientHeight, caretBottom=c.bottom-v.top, top=c.top-v.top;
    const seal = !flat && sealFooter.firstElementChild?.getBoundingClientRect();
    const sealBottom = seal && seal.top < v.bottom && seal.bottom > v.top ? Math.min(h, seal.bottom - v.top) : null;
    return {x:c.left-v.left, y:caretBottom, caretX:c.left-v.left, caretY:top, caretBottom, lineTop:top,
      lineHeight:c.height, scrollOffset:scroller.scrollTop, hasText:!!(text||compositionSnapshot?.preview), visible:caretBottom>=0&&caretBottom<=h+4,
      startPosition:bottom()?'bottom':'top',
      sealBottom,
      followingTextBottom:!bottom()&&(selection[1]<text.length||caretBottom>h)?Math.min(h,(node.lastElementChild?.getBoundingClientRect().bottom??c.bottom)-v.top):null};
  }
  // Remove live wear before cloning/restoring a rolled row. Text and
  // emphasis stay in the real editable DOM, never in a second drawing layer.
  function clearWindow(el,parents) {
    if(el.parentNode&&el.isConnected) {
      const parent=el.parentNode;el.replaceWith(document.createTextNode(el.textContent));parents.add(parent);
    }
    inkWindows.delete(el);
  }
  function stripLongInk() {
    const parents=new Set();
    for(const el of inkWindows.keys())clearWindow(el,parents);
    for(const parent of parents)parent.normalize();
    inkKey='';
  }
  function paintLongInk() {
    if(composing||selectingByPointer||!rendered.length)return;
    const enabled=text.length>virtualAt&&settings.wornInk!==false;
    if(!enabled) {
      if(inkWindows.size) {
        const saved=readSelection();stripLongInk();
        if(saved){selection=saved;writeSelection();}
      }
      return;
    }
    const scroll=scroller.scrollTop, rect=scroller.getBoundingClientRect(), h=rect.height;
    const pad=Math.max(72,lineHeight()*4), roll=settings.paperMotion==='roll'?rollProjection(rect.width,h).bend:0;
    const config=[settings.inkBuildup,settings.fontSize].join(':');
    const key=[rect.width,h,config,settings.paperMotion].join(':');
    if(inkKey===key&&Math.abs(scroll-inkAnchor)<pad*.45)return;
    inkKey=key;inkAnchor=scroll;
    const minY=scroll-pad-roll,maxY=scroll+h+pad;
    let lo=0,hi=rendered.length;
    while(lo<hi) {const m=(lo+hi)>>1,p=node.children[m];if(p.offsetTop+p.offsetHeight<minY)lo=m+1;else hi=m;}
    const bands=new Map();
    for(let i=lo;i<rendered.length;i++) {
      const p=node.children[i], top=p.offsetTop, bottom=top+p.offsetHeight,l=rendered[i];
      if(top>maxY)break;
      let a=0,b=l.end-l.start;
      // Large single paragraphs cannot be treated as a unit. Binary-search
      // their native, shaped line boxes; no scan through preceding characters.
      if(b&&(top<minY||bottom>maxY)) {
        const source=sourceUnits(p),range=document.createRange();
        const bound=y=>{
          let x=0,z=source.length;
          while(x<z) {
            const m=(x+z)>>1;
            range.setStart(...source.at(m));range.setEnd(...source.at(m+1));
            const glyph=range.getClientRects()[0];
            if(glyph&&glyph.bottom<y)x=m+1;else z=m;
          }
          return x;
        };
        if(top<minY)a=Math.max(0,bound(rect.top-pad)-1);
        if(bottom>maxY)b=Math.min(b,bound(rect.bottom+pad)+1);
      }
      if(b>a)bands.set(p,{a:l.start+a,b:l.start+b,l});
    }
    const saved=readSelection(), parents=new Set();
    let mutated=false;
    for(const [el,w] of inkWindows) {
      const band=bands.get(w.p);
      if(!el.isConnected||!band||w.b<=band.a||w.a>=band.b||w.lineStart!==band.l.start||
           w.sourceDelta!==band.l.sourceDelta||w.config!==config) {
        mutated ||= el.isConnected;clearWindow(el,parents);
      }
    }
    for(const parent of parents)parent.normalize();
    // Collect text nodes in document order, skipping already-painted runs.
    // Boundaries of each window are *simple* glyphs, never in a complex
    // grapheme. No DOM node is created for any off-screen part of a draft.
    for(const [p,{a,b,l}] of bands) {
      let at=l.start;
      const decorate=(el)=>{
        if(at>=b)return;
        if(el.nodeType===3) {
          const x=at;at+=el.length;
          let left=Math.max(x,a),right=Math.min(at,b);
          if(right<=left)return;
          const eligible=strikesFor(left,right);
          while(left<right&&!eligible(left))left++;
          while(right>left&&!eligible(right-1))right--;
          if(right<=left)return;
          const frag=document.createDocumentFragment(), wrapper=document.createElement('span');
          wrapper.className='ink-window';
          if(left>x)frag.append(document.createTextNode(text.slice(x,left)));
          pressRange(wrapper,left,right,l,eligible);frag.append(wrapper);
          if(right<at)frag.append(document.createTextNode(text.slice(right,at)));
          el.replaceWith(frag);mutated=true;
          inkWindows.set(wrapper,{a:left,b:right,lineStart:l.start,sourceDelta:l.sourceDelta,p,config});
        } else {
          const retained=inkWindows.get(el);
          if(retained){at+=retained.b-retained.a;return;}
          if(el.classList?.contains('ink-heading-marker')){at+=el.textContent.length;return;}
          for(let c=el.firstChild,next;c&&at<b;c=next){next=c.nextSibling;decorate(c);}
        }
      };
      decorate(p);
    }
    if(mutated&&saved){selection=saved;writeSelection();}
    if(mutated&&scroller.scrollTop!==scroll)scroller.scrollTop=scroll;
  }
  function setPlaceholder(g) {
    placeholder.hidden=!g||text.length>0||composing;
    if(placeholder.hidden)return;
    placeholder.style.left=Math.max(0,g.x)+'px';
    placeholder.style.top=Math.max(0,g.lineTop+3)+'px';
  }
  function publish() {
    // Scroll/selection animation frames can run after the new width has
    // rewrapped the text but before ResizeObserver follows the insertion
    // point. Never replace the old visibility with that transient geometry:
    // doing so confuses a reflowed caret with intentional reading scroll.
    if(scroller.clientWidth!==viewport.width||scroller.clientHeight!==viewport.height)return;
    projectVisibleLines();paintLongInk();const g=geometry();setPlaceholder(g);if(g){lastGeometry=g;onMove(g);}
  }
  function scheduleMove() { if(!frame) frame=requestAnimationFrame(()=>{frame=0;publish();}); }
  function cancelFeed() { if(feed) cancelAnimationFrame(feed);feed=0; }
  function follow(animate=false,oldTop=scroller.scrollTop) {
    // Remeasure resized roller rows before reading the flat caret. During
    // composition projectVisibleLines leaves the browser's marked DOM alone.
    projectVisibleLines();
    const g=geometry(true);
    if(!g) return;
    cancelFeed();
    const h=scroller.clientHeight, t=g.caretBottom+scroller.scrollTop;
    const initial=g.lineTop<0?Math.max(0,t-g.lineHeight-16):scroller.scrollTop;
    let target=Math.min(scroller.scrollHeight-h,desiredOffset(t,initial,h,settings.paperStartPosition));
    // The browser stores scrollTop on a device-pixel boundary. Keep a
    // settled row there when the measured caret falls between two pixels.
    if(Math.abs(target-oldTop)<1/window.devicePixelRatio)target=oldTop;
    if(!animate||settings.paperMotion!=='roll'||reduced.matches||Math.abs(target-oldTop)>Math.max(80,lineHeight()*3)||Math.abs(target-oldTop)<1) {
      scroller.scrollTop=target;
    } else {
      scroller.scrollTop=oldTop;
      const start=performance.now();
      const tick=now=>{
        const p=Math.min(1,(now-start)/145);
        scroller.scrollTop=oldTop+(target-oldTop)*(1-(1-p)**3);publish();
        feed=p<1?requestAnimationFrame(tick):0;
      };
      feed=requestAnimationFrame(tick);
    }
    publish();
  }
  function commit(animate=false,oldTop=scroller.scrollTop,forceRender=false) {
    if (page.seal && !hasLetterText(text)) displaySeal(null);
    render(forceRender);follow(animate,oldTop);updateFormat();
    onChange(snapshot());
  }
  function replaceRange(a,b,value,m=typing,withStyle=null,newEndings=null) {
    const next=new Uint8Array(a+value.length+text.length-b);
    next.set(style.subarray(0,a));
    if(withStyle) next.set(withStyle,a); else next.fill(m,a,a+value.length);
    next.set(style.subarray(b),a+value.length);
    const delta=value.length-(b-a), updated=new Map();
    for(const [i,end] of endings) if(i<a||i>=b) updated.set(i<a?i:i+delta,end);
    for(let i=value.indexOf('\n');i>=0;i=value.indexOf('\n',i+1)) {
      updated.set(a+i,newEndings?.get(i)??{value:preferredEnding});
    }
    endings=updated;
    style=next;text=text.slice(0,a)+value+text.slice(b);
    selection=[a+value.length,a+value.length];
  }
  function finishTypingStroke(value, start, eligible, previous, oldTop) {
    const after = geometry(true);
    if (previous && after && after.caretBottom + scroller.scrollTop > previous.caretBottom + oldTop + lineHeight() * .72) {
      onSound('carriage');
    } else if (eligible && crossedBellPoint(value, start, findPoint)) {
      onSound('bell');
    }
  }
  function replace(value,kind,withStyle=null,markers=false,stroke=null,newEndings=null) {
    selection=readSelection()||selection;
    const [a,b]=ordered(),oldTop=scroller.scrollTop,previous=geometry(true);
    const mark=markers&&a===b&&!(typing&16)&&value.length===1?shortcutAt(text.slice(0,a)+value+text.slice(b),a+value.length):null;
    history(mark?null:kind);
    if(mark&&!(style[mark.start]&16)) {
      const next=style.slice(mark.bodyStart,mark.bodyEnd);
      for(let i=0;i<next.length;i++) next[i]|=mark.emphasis;
      replaceRange(mark.start,b,text.slice(mark.bodyStart,mark.bodyEnd),typing,next);
      typingOverride=true;
    } else replaceRange(a,b,value,typing,withStyle,newEndings);
    if(latest) latest.at=selection[0];
    commit(true,oldTop);
    if(stroke) onSound(stroke);
    if (stroke === 'key' || stroke === 'space') {
      const directInsertion = (markers || value === '\t') && !mark && a === b;
      finishTypingStroke(value, a, directInsertion, previous, oldTop);
    }
  }
  function applyUndo(mode) {
    const from=mode==='undo'?undo:redo,to=mode==='undo'?redo:undo,changes=from.pop();
    if(!changes) return;
    to.push(checkpoint());latest=null;
    ({text,style,endings,selection,typing,typingOverride}=changes);
    if (changes.sealRevision === sealRevision && changes.seal !== page.seal) displaySeal(changes.seal);
    commit();
  }
  function toggleStyle(flag) {
    if(composing) return;
    selection=readSelection()||selection;
    const [a,b]=ordered(), remove=flag&&active()&flag;
    const toggle=value=>flag?(remove?value&~flag:value|flag):0;
    if(a===b) { typing=toggle(typing);typingOverride=true;latest=null;updateFormat();return; }
    if(!flag&&!style.subarray(a,b).some(Boolean)&&![...endings].some(([i,end])=>i>=a&&i<b&&end.secondStyle)) return;
    history(null);
    for(let i=a;i<b;i++) {
      style[i]=toggle(style[i]);
      if(endings.get(i)?.value==='\r\n') {
        const end=endings.get(i);
        endings.set(i,{...end,secondStyle:end.secondStyle===undefined?undefined:toggle(end.secondStyle)});
      }
    }
    commit();
  }
  function changeBlock(type,value) {
    const [a,b]=ordered(), lines=markdownLines(text).filter(l=>l.next>a&&l.start<=b||a===b&&l.start===a);
    if(!lines.length) return;
    const desired=type==='heading'?'#'.repeat(Math.max(1,Math.min(6,Number(value)||1)))+' ':type==='quote'?'> ':type==='orderedList'?'1. ':type==='list'?'- ':'';
    const remove=!!desired&&lines.every(l=>l.block?.source===desired);
    history(null);
    for(const l of lines.reverse()) {
      if(l.literal) continue;
      const prefix=remove?'':desired, length=l.block?.source?.length??0;
      replaceRange(l.start,l.start+length,prefix,0);
    }
    commit();
  }
  function command(name,value) {
    if(composing) return;
    watchSelection();node.focus({preventScroll:true});writeSelection();
    if(Object.hasOwn(emphasis,name)) toggleStyle(emphasis[name]);
    else if(name==='clearFormatting')toggleStyle(0);
    else if(name==='undo'||name==='redo') applyUndo(name);
    else if(['heading','quote','list','orderedList','plain'].includes(name))changeBlock(name,value);
  }
  function startEndOffset(at,dir,type) {
    if(type.endsWith('WordBackward')) return (text.slice(0,at).match(/(?:\s*\S+)?\s*$/u)||[''])[0].length*-1+at;
    if(type.endsWith('WordForward')) return (text.slice(at).match(/^\s*\S*\s*/u)||[''])[0].length+at;
    if(type.endsWith('LineBackward')) return text.lastIndexOf('\n',Math.max(0,at-1))+1;
    if(type.endsWith('LineForward')) { const end=text.indexOf('\n',at); return end<0?text.length:end; }
    if(dir<0&&at>0) return seg.segment(text).containing(at-1).index;
    if(dir>0&&at<text.length) {const g=seg.segment(text).containing(at);return g.index+g.segment.length;}
    return at;
  }
  function onBeforeInput(event) {
    const type=event.inputType;
    if(composing) {
      // Chromium can silently drop native marking when the replacement
      // crosses editable visual-row blocks. Its final input then arrives as
      // plain insertText, without a compositionend event.
      if(!event.isComposing&&(type==='insertText'||type==='insertReplacementText')&&typeof event.data==='string') {
        if(event.cancelable){event.preventDefault();finishComposition(event.data);}
        else pendingNativeCommit=event.data;
      }
      return;
    }
    if(event.isComposing)return;
    const ranges=event.getTargetRanges();
    const userSelection=readSelection();
    if(userSelection&&(userSelection[0]!==selection[0]||userSelection[1]!==selection[1])) {
      selection=userSelection;typing=style[Math.max(0,selection[1]-1)]||0;typingOverride=false;latest=null;
    }
    if(type==='insertText'||type==='insertReplacementText'||type==='insertLineBreak'||type==='insertParagraph') {
      event.preventDefault();
      const value=type==='insertLineBreak'||type==='insertParagraph'?'\n':event.data??'';
      if(ranges.length&&type==='insertReplacementText') {
        const r=ranges[0], a=endpoint(r.startContainer,r.startOffset), b=endpoint(r.endContainer,r.endOffset);
        if(a!==null&&b!==null) getSelection().setBaseAndExtent(...findPoint(a),...findPoint(b));
      }
      replace(normalizeNewline(value),value==='\n'?null:'type',null,type==='insertText',value==='\n'?'carriage':value===' '?'space':'key');
    } else if(type.startsWith('delete')) {
      event.preventDefault();
      let [a,b]=ordered(),dir=type.endsWith('Forward')?1:-1;
      if(a===b) {
        if(ranges.length&&(ranges[0].startContainer!==ranges[0].endContainer||ranges[0].startOffset!==ranges[0].endOffset)) {
          const r=ranges[0];a=endpoint(r.startContainer,r.startOffset)??a;b=endpoint(r.endContainer,r.endOffset)??b;
        }
        if(a===b) {const to=startEndOffset(a,dir,type);[a,b]=dir<0?[to,a]:[a,to];}
      }
      if(a!==b) {
        const oldTop=scroller.scrollTop;
        history(type==='deleteContentBackward'?'erase':null);
        replaceRange(a,b,'');
        if(latest) latest.at=selection[0];
        commit(true,oldTop);onSound('erase');
      }
    } else if(type==='historyUndo'||type==='historyRedo') {
      event.preventDefault();applyUndo(type==='historyUndo'?'undo':'redo');
    } else if(type.startsWith('format')) {
      event.preventDefault();
      const names={formatBold:'bold',formatItalic:'italic',formatUnderline:'underline',formatStrikeThrough:'strikethrough',formatRemove:'clearFormatting'};
      if(names[type])command(names[type]);
    } else if(event.cancelable) event.preventDefault();
  }
  function onKey(event) {
    if(composing||event.isComposing||event.keyCode===229) return;
    const key=shortcutKey(event);
    if((event.ctrlKey||event.metaKey)&&!event.altKey) {
      const name=key==='z'?(event.shiftKey?'redo':'undo'):key==='y'?'redo':({b:'bold',i:'italic',u:'underline','\\':'clearFormatting'})[key];
      if(name) { event.preventDefault();event.stopPropagation();command(name);return; }
    }
    if(event.key==='Tab'&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!event.metaKey) {
      event.preventDefault(); replace('\t',null,null,false,'key');
    }
    if(event.key.startsWith('Arrow')||['Home','End','PageUp','PageDown'].includes(event.key)) {
      onSound('navigation');latest=null;typingOverride=false;clearTimeout(timer);
      timer=setTimeout(()=>{watchSelection();follow();},0);
    }
    if((event.ctrlKey||event.metaKey)&&key==='a'&&!event.altKey) {
      event.preventDefault();selection=[0,text.length];writeSelection();
    }
  }
  function copy(event,cut) {
    if(!event.clipboardData||composing) return;
    selection=readSelection()||selection;
    const [a,b]=ordered();
    if(a===b) return;
    const value=text.slice(a,b),s=style.subarray(a,b);
    event.preventDefault();
    event.clipboardData.setData('text/plain',value);
    event.clipboardData.setData('text/html',clipboardHTML(value,s));
    try { event.clipboardData.setData(formatType,JSON.stringify({text:value,formatting:compactFormatting(s)})); } catch {}
    if(cut)replace('',null);
  }
  function paste(event) {
    if(!event.clipboardData||composing)return;
    event.preventDefault();
    let custom;try {custom=JSON.parse(event.clipboardData.getData(formatType));} catch {}
    let value;const html=event.clipboardData.getData('text/html'), plain=event.clipboardData.getData('text/plain');
    if(custom&&typeof custom.text==='string') value={text:custom.text,style:expandFormatting(custom.text,custom.formatting)};
    else if(html) value=htmlStyles(html);
    if(!value||(!value.text&&plain)) value={text:plain,style:new Uint8Array(plain.length).fill(typing)};
    if (!value.text) return;
    value=normalized(value.text,value.style);
    replace(value.text,null,value.style,false,null,value.endings);
  }
  function watchSelection() {
    if(composing) {scheduleMove();return;}
    const current=readSelection();
    if(!current)return;
    if(current[0]!==selection[0]||current[1]!==selection[1]) {
      selection=current;typingOverride=false;latest=null;
      typing=style[Math.max(0,selection[1]-1)]||0;
    }
    scheduleMove();updateFormat();
  }
  const listener=new AbortController(), options={signal:listener.signal};
  node.addEventListener('beforeinput',onBeforeInput,options);
  node.addEventListener('keydown',onKey,options);
  node.addEventListener('pointerdown',()=>{selectingByPointer=true;typingOverride=false;latest=null;cancelFeed();},options);
  const endPointer=()=>{if(selectingByPointer){selectingByPointer=false;scheduleMove();}};
  window.addEventListener('pointerup',endPointer,options);
  window.addEventListener('pointercancel',endPointer,options);
  window.addEventListener('blur',endPointer,options);
  node.addEventListener('dragover',e=>e.preventDefault(),options);
  node.addEventListener('drop',e=>{
    if(!e.dataTransfer) return;
    e.preventDefault();
    const pos=document.caretPositionFromPoint?.(e.clientX,e.clientY), to=pos?endpoint(pos.offsetNode,pos.offset):null;
    if(to!==null && to!==undefined) {selection=[to,to];node.focus({preventScroll:true});writeSelection();}
    const value=e.dataTransfer.getData('text/plain');
    if(value) replace(normalizeNewline(value),null);
  },options);
  node.addEventListener('copy',e=>copy(e,false),options);
  node.addEventListener('cut',e=>copy(e,true),options);
  node.addEventListener('paste',paste,options);
  function finishComposition(value) {
    if(!composing)return;
    composing=false;pendingNativeCommit=null;
    const {selection: original, caret, offset, preview} = compositionSnapshot;
    selection=original;compositionSnapshot=null;
    const [a,b]=ordered();
    if(!value){render(true);follow();return;}
    // Commit only the established input text over the original logical
    // selection. Never infer edits from provisional DOM or visual breaks.
    history(null);replaceRange(a,b,normalizeNewline(value));
    commit(true,scroller.scrollTop,true);
    if(value!==preview)onSound(value.endsWith(' ')?'space':'key');
    finishTypingStroke(value, a, a === b, caret, offset);
  }
  node.addEventListener('compositionstart',()=>{
    if(composing)return;
    selection=readSelection()||selection;
    compositionSnapshot={selection:[...selection], caret:geometry(true), offset:scroller.scrollTop, preview:null};
    composing=true;setPlaceholder(null);cancelFeed();
  },options);
  node.addEventListener('compositionend',e=>finishComposition(e.data??''),options);
  node.addEventListener('input',e=>{
    if(pendingNativeCommit!==null){finishComposition(pendingNativeCommit);return;}
    if(!composing||(!e.isComposing&&e.inputType!=='insertCompositionText'&&e.inputType!=='deleteCompositionText'))return;
    // Mobile keyboards can keep a whole word marked until Space. Follow
    // each provisional edit without saving it or interrupting the IME.
    const previous=compositionSnapshot.preview, value=e.data??'';
    compositionSnapshot.preview=value;
    follow();
    if(value!==previous)onSound(!value?'erase':value.endsWith(' ')?'space':'key');
  },options);
  document.addEventListener('selectionchange',watchSelection,options);
  scroller.addEventListener('scroll',scheduleMove,options);
  scroller.addEventListener('wheel',cancelFeed,{...options,passive:true});
  document.fonts.addEventListener('loadingdone', () => {
    if (settings.writingFont !== 'courier') return;
    // Wrapped roller rows may have been measured with the temporary font.
    for (const entry of rolledParagraphs.values()) entry.key = null;
    inkKey = '';
    scheduleMove();
  }, options);
  const observer=new ResizeObserver(()=>afterReflow(reflow()));
  observer.observe(surface);
  function applySettings(value={}) {
    watchSelection();
    const layoutKeys=['paperStartPosition','paperMotion','fontSize','wideMargins','writingFont'];
    const next={...defaults,...value};
    const changed=layoutKeys.some(key=>settings[key]!==next[key]);
    settings=next;styleWritingPreview(node,settings);styleWritingPreview(placeholder,settings);const layout=reflow();render();
    afterReflow(layout,changed);
  }
  function displaySeal(seal, reveal=false) {
    if (seal) page.seal=seal; else delete page.seal;
    node.classList.toggle('ink-editor-sealed',Boolean(seal));
    sealFooter.hidden=!seal;
    sealFooter.replaceChildren(...(seal?[drawSeal(seal)]:[]));
    if (reveal && seal) {
      cancelFeed();
      scroller.scrollTop=Math.max(0, sealFooter.offsetTop + sealFooter.offsetHeight - scroller.clientHeight);
    }
    scheduleMove();
  }
  function setSeal(value, reveal=false) {
    sealRevision++;
    latest=null;
    displaySeal(hasLetterText(text) ? normalizeSeal(value) : null, reveal);
  }
  function load(value, {atEnd=false}={}) {
    cancelFeed();composing=false;compositionSnapshot=null;pendingNativeCommit=null;
    const hasFocus=document.activeElement===node;
    page={...value};
    const content=typeof value?.text==='string'?value.text:'';
    ({text,style,endings}=normalized(content,expandFormatting(content,value?.formatting)));
    setSeal(page.seal);
    const counts=new Map();
    for(const end of endings.values()) counts.set(end.value,1+(counts.get(end.value)||0));
    preferredEnding=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]??'\n';
    const position=atEnd?text.length:0;
    selection=[position,position];typing=style[Math.max(0,position-1)]||0;typingOverride=false;undo=[];redo=[];latest=null;
    render(true);scroller.scrollTop=atEnd?scroller.scrollHeight:0;
    if(atEnd && position && document.fonts.status==='loading') {
      // A newly loaded font may rewrap the last lines. Keep the initial view
      // at the end unless another letter is loaded or the reader has moved.
      const opened=page, offset=scroller.scrollTop;
      void document.fonts.ready.then(()=>{
        if(page!==opened || selection[0]!==position || selection[1]!==position || scroller.scrollTop!==offset)return;
        scroller.scrollTop=scroller.scrollHeight;
        publish();
      });
    }
    if(hasFocus) writeSelection();
    publish();updateFormat();
  }
  applySettings();load({text:''});
  return {element:node,scroller,load,snapshot,applySettings,command,setSeal,printContent,
    focus(){watchSelection();node.focus({preventScroll:true});if(!composing)writeSelection();},
    activeEmphasis:active,
    destroy(){inkWindows.clear();listener.abort();observer.disconnect();cancelFeed();cancelAnimationFrame(frame);clearTimeout(timer);scroller.remove();}};
}

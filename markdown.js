// Inkrail's interchange uses JavaScript UTF-16 offsets, the same units as NSTextStorage.
import {hasLetterText,normalizeSeal} from './seal.js';

export const emphasis = Object.freeze({bold:1, italic:2, underline:4, strikethrough:8, code:16});
const tags = Object.freeze({strong:1, em:2, u:4, del:8});
const newline = /\r\n|[\n\r\u0085\u2028\u2029]/g;
const trail = n => n >= 0xdc00 && n <= 0xdfff;
export function validateFormatting(text, runs) {
  const result = [];
  let end = 0;
  for (const run of (Array.isArray(runs) ? runs.filter(x => x && typeof x === 'object').slice() : []).sort((a,b) => a.location-b.location)) {
    const {location:l,length:n} = run, m = Number.isSafeInteger(run.emphasis) ? run.emphasis & 31 : 0;
    if (!m || !Number.isSafeInteger(l) || !Number.isSafeInteger(n) || l < end || n < 1 || l+n > text.length ||
        trail(text.charCodeAt(l)) || trail(text.charCodeAt(l+n))) continue;
    result.push({location:l,length:n,emphasis:m}); end=l+n;
  }
  return result;
}
export function expandFormatting(text,runs) {
  const styles = new Uint8Array(text.length);
  for(const {location,length,emphasis:m} of validateFormatting(text,runs)) styles.fill(m,location,location+length);
  return styles;
}
export function compactFormatting(styles) {
  const result=[];
  for(let i=0;i<styles.length;) {
    const m=styles[i], start=i++;
    while(i<styles.length&&styles[i]===m) i++;
    if(m) result.push({location:start,length:i-start,emphasis:m});
  }
  return result;
}
export function blockPrefix(text) {
  const m=/^(#{1,6}|>|[-*+]|[0-9]{1,9}[.)])[ \t]/.exec(text);
  if (!m) return null;
  return {kind:m[1][0]==='#'?'heading':m[1]==='>'?'quote':'list', level:m[1].length, source:m[0]};
}
function openFenceAtEnd(text) {
  return text.includes('```') || text.includes('~~~') ? scanMarkdownLines(text).fence : '';
}

export function markdownLines(text) {
  return scanMarkdownLines(text).lines;
}
function scanMarkdownLines(text) {
  let fence='', start=0, match, lines=[];
  const breaks = new RegExp(newline.source,'g');
  const line=(end,next) => {
    const body=text.slice(start,end), boundary=/^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(body);
    let marker='';
    if(boundary) {
      const [,head,tail]=boundary;
      if(fence ? head.startsWith(fence)&&/^[ \t]*$/.test(tail) : head[0]!=='`'||!tail.includes('`')) marker=head;
    }
    const literal=Boolean(fence||marker)||/^( {4}|\t)/.test(body);
    const block=literal?null:blockPrefix(body);
    let inline=literal?end:start;
    if(!literal) for(let prefix;(prefix=blockPrefix(text.slice(inline,end)));) inline+=prefix.source.length;
    lines.push({start,end,next,inline,literal,block});
    if(marker) fence=fence?'':marker;
    start=next;
  };
  while((match=breaks.exec(text))) line(match.index,breaks.lastIndex);
  line(text.length,text.length);
  return {lines,fence};
}
function edge(s,i) {
  if(i<0||i>=s.length) return 0;
  if(trail(s.charCodeAt(i))) i--;
  const c=String.fromCodePoint(s.codePointAt(i));
  return /\s/u.test(c)?0:/[\p{P}\p{S}]/u.test(c)?1:2;
}
function isEscaped(s,i,start) {
  let j=i;
  while(j>start&&s[j-1]==='\\') j--;
  return (i-j)%2!==0;
}
function afterBalanced(s,i,end,a,b) {
  let depth=1;
  for(i++; i<end&&depth;i++) {
    if(s[i]==='\\' && i+1<end) i++;
    else if(s[i]===a) depth++;
    else if(s[i]===b) depth--;
  }
  return i;
}
function scan(s,start,end,importing) {
  const pending=new Map(), spans=[];
  let code;
  function open(k,a,b) { if(!pending.has(k)) pending.set(k,[]); pending.get(k).push([a,b]); }
  function pair(left,a,b,m) {
    if(left && left[1]<a) spans.push({start:left[0],bodyStart:left[1],bodyEnd:a,end:b,emphasis:m});
  }
  for(let i=start;i<end;) {
    const a=i, c=s[i++];
    if(!('*_~`['.includes(c)||(importing&&c==='<'))) continue;
    const escaped=isEscaped(s,a,start);
    if (!code && escaped) continue;
    if(!code&&!escaped&&c==='[') {
      i=afterBalanced(s,a,end,'[',']');
      if(i<end&&s[i]==='(') i=afterBalanced(s,i,end,'(',')');
      continue;
    }
    if(!code&&!escaped&&c==='<'&&importing&&/[a-z/]/i.test(s[i]||'')) {
      const tail=s.indexOf('>',i);
      if(tail<0||tail>=end) break;
      const closing=s[i]==='/';
      const tag=s.slice(i+Number(closing),tail).toLowerCase();
      i=tail+1;
      if(Object.hasOwn(tags,tag)) {
        if(closing) pair(pending.get(tag)?.pop(),a,i,tags[tag]);
        else open(tag,a,i);
      }
      continue;
    }
    if(!'*_~`'.includes(c)) continue;
    while(i<end&&s[i]===c) i++;
    const length=i-a;
    if(c==='`') {
      if(code && code[1]-code[0]===length) { pair(code,a,i,16); code=undefined; }
      else if(!code&&!escaped) code=[a,i];
      continue;
    }
    if(code||escaped||(c==='~'?length!==2:length>3)) continue;
    const m=c==='~'?8:length===1?2:length===2?1:3, key=s.slice(a,i);
    const before=edge(s,a-1),after=edge(s,i),left=after!==0&&(after!==1||before!==2),right=before!==0&&(before!==1||after!==2);
    const canOpen=left&&(c!=='_'||!right||before===1),canClose=right&&(c!=='_'||!left||after===1);
    if(canClose&&pending.get(key)?.length) pair(pending.get(key).pop(),a,i,m);
    else if(canOpen) open(key,a,i);
  }
  return spans;
}
export function shortcutAt(text,caret) {
  const c=text[caret-1];
  if(!c||!'*_~`'.includes(c)||text[caret]===c) return null;
  const line=markdownLines(text).find(x=>x.start<=caret-1&&x.end>=caret);
  if(!line||line.literal) return null;
  return scan(text,line.start,caret,false).findLast(x=>x.end===caret)||null;
}
function unescapeStyled(source) {
  return source.replace(/\\([\p{P}\p{S}])/gu,'$1').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
}
function splitSealFooter(markdown) {
  const footer = /(?:\r\n\r\n|\n\n|^)(<p data-inkrail-seal="([a-z]+) ([a-z]+)"( data-inkrail-closed-fence)?>✦ ([^<>\r\n]+) ✦<\/p>)(?:\r?\n)?$/u.exec(markdown);
  if (!footer) return [markdown];
  const [, markup, shape, color, closesFence, inscription] = footer;
  const text = inscription.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const seal = normalizeSeal({text, shape, color});
  if (!seal || markdownFooter(seal, closesFence) !== markup) return [markdown];
  let body = markdown.slice(0, footer.index);
  if (closesFence) {
    const closing = /(?:\r\n\r\n|\n\n)(`{3,}|~{3,})$/u.exec(body);
    if (!closing) return [markdown];
    body = body.slice(0, closing.index);
    if (openFenceAtEnd(body) !== closing[1]) return [markdown];
  } else if (openFenceAtEnd(body)) return [markdown];
  return [body, seal];
}

export function importMarkdown(source) {
  const [markdown, seal] = splitSealFooter(source);
  let text='';
  const formatting=[];
  function append(content,m=0) {
    if(!content) return;
    if(m && !(m&16)) content=unescapeStyled(content);
    const previous=formatting.at(-1);
    if(m && previous?.emphasis===m && previous.location+previous.length===text.length) previous.length+=content.length;
    else if(m) formatting.push({location:text.length,length:content.length,emphasis:m});
    text+=content;
  }
  for(const line of markdownLines(markdown)) {
    if (markdown.startsWith('<p data-inkrail-seal=', line.start)) {
      append(markdown.slice(line.start, line.next));
      continue;
    }
    const boundaries=[];
    for(const span of scan(markdown,line.inline,line.end,true)) {
      let {start,bodyStart,bodyEnd,end,emphasis:m}=span;
      if(m===16&&markdown[bodyStart]===' '&&markdown[bodyEnd-1]===' '&&/[^ ]/.test(markdown.slice(bodyStart,bodyEnd))) { bodyStart++; bodyEnd--; }
      boundaries.push([start,bodyStart,m,1],[bodyEnd,end,m,-1]);
    }
    boundaries.sort((a,b)=>a[0]-b[0]);
    let cursor=line.start,style=0;
    const depth=new Uint32Array(5);
    for(const [start,end,m,delta] of boundaries) {
      if(start<cursor) continue;
      append(markdown.slice(cursor,start),style);
      for(let i=0;i<5;i++) if(m&(1<<i)) {
        depth[i]+=delta;
        if(depth[i]) style|=1<<i; else style&=~(1<<i);
      }
      cursor=end;
    }
    append(markdown.slice(cursor,line.next));
  }
  return seal && hasLetterText(text) ? {text,formatting,seal} : {text,formatting};
}
function markdownSpan(text,start,end,m) {
  const raw=text.slice(start,end), trimmed=raw.trim();
  if(!trimmed) return raw;
  const boundary=c=>c===undefined||/[\s.,;:!?()]/u.test(c);
  const marker=boundary(text[start-1])&&boundary(text[end])?({1:'**',2:'*',8:'~~'})[m]:null;
  const names=Object.keys(tags).filter(tag=>m&tags[tag]);
  let content=trimmed;
  if(m&16) {
    const max=Math.max(0,...(content.match(/`+/g)||[]).map(x=>x.length));
    const fence='`'.repeat(max+1), pad=/^`|`$/.test(content)?' ':'';
    content=fence+pad+content+pad+fence;
  } else {
    content=content.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/[\\`*_\[\]~|]/g,'\\$&');
  }
  return raw.slice(0,raw.indexOf(trimmed))+(marker??names.map(x=>'<'+x+'>').join(''))+content+
    (marker??names.reverse().map(x=>'</'+x+'>').join(''))+raw.slice(raw.indexOf(trimmed)+trimmed.length);
}
function markdownFooter(seal, closesFence) {
  const inscription = seal.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const attribute = closesFence ? ' data-inkrail-closed-fence' : '';
  return `<p data-inkrail-seal="${seal.shape} ${seal.color}"${attribute}>✦ ${inscription} ✦</p>`;
}

export function exportPlainText(page) {
  const seal = normalizeSeal(page.seal);
  const text = page.text ?? '';
  return seal && hasLetterText(text) ? text + `\n\n✦ ${seal.text} ✦` : text;
}

export function exportMarkdown(page) {
  const body = markdownBody(page), seal = normalizeSeal(page.seal);
  if (!seal || !hasLetterText(page.text)) return body;
  const fence = openFenceAtEnd(body);
  const closing = fence ? '\n\n' + fence : '';
  return body + closing + (body ? '\n\n' : '') + markdownFooter(seal, fence);
}

function markdownBody({text='',formatting}) {
  const runs=validateFormatting(text,formatting);
  if(!runs.length) return text;
  let out='',i=0;
  for(const l of markdownLines(text)) {
    let cursor=l.start;
    while(i<runs.length) {
      const r=runs[i],end=r.location+r.length;
      if(r.location>=l.next) break;
      const a=Math.max(r.location,l.inline), b=Math.min(end,l.end);
      if(a<b) { out+=text.slice(cursor,a)+markdownSpan(text,a,b,r.emphasis); cursor=b; }
      if(end>l.next) break;
      i++;
    }
    out+=text.slice(cursor,l.next);
  }
  return out;
}

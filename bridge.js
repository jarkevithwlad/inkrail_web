import {InterfaceError, errorText} from './ru.js';
import * as storage from './storage.js';

let printing = false;

function chooseFile(accept) {
  return new Promise(resolve => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = accept;
    picker.hidden = true;
    const finish = () => { const file = picker.files[0]; picker.remove(); resolve(file || null); };
    picker.addEventListener('change', finish, {once:true});
    picker.addEventListener('cancel', finish, {once:true});
    (document.querySelector('dialog[open]') || document.body).append(picker);
    picker.click();
  });
}

async function readText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' :
    bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
  try { return new TextDecoder(encoding, {fatal:true}).decode(bytes); }
  catch { throw new InterfaceError('Сохраните файл в UTF-8 или в UTF-16 с меткой порядка байтов (BOM) и попробуйте снова.'); }
}

function filename(body) {
  const line = body.split(/[\r\n\v\f\u0085\u2028\u2029]/u).map(s => s.trim()).find(Boolean) || '';
  let title = '', count = 0;
  for (const {segment} of new Intl.Segmenter().segment(line)) {
    if (count++ === 64) break;
    title += segment;
  }
  let name = title.replace(/[<>:"/\\|?*%\u0000-\u001f]/gu, '-').replace(/^[. ]+|[. ]+$/g, '');
  if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)) name = '_' + name;
  return name || 'Письмо без названия';
}

function download(contents, type, name) {
  const url = URL.createObjectURL(new Blob([contents], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  (document.querySelector('dialog[open]') || document.body).append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

function printLetter({body, width, height}) {
  const style = document.createElement('style');
  style.textContent = `@page { size: ${Math.ceil(width)}px ${Math.ceil(height)}px; margin: 0; }`;
  document.head.append(style);
  const title = document.title;
  document.title = filename(body);
  return new Promise((resolve, reject) => {
    const end = () => {
      document.title = title;
      style.remove();
    };
    const after = () => { end(); resolve(true); };
    window.addEventListener('afterprint', after, {once:true});
    try { window.print(); }
    catch (error) { window.removeEventListener('afterprint', after); end(); reject(error); }
  });
}

export async function call(op, args = {}) {
  switch (op) {
    case 'boot':
      try { return await storage.boot(); }
      catch (error) { return {available:false, path:storage.libraryPath, error:errorText(error)}; }
    case 'save': return storage.savePage(args);
    case 'settings': return storage.saveSettings(args);
    case 'list': return storage.listPages(!!args.trash);
    case 'cleanup': return storage.cleanup();
    case 'trash': return storage.movePage(args.id, true);
    case 'restore': return storage.movePage(args.id, false);
    case 'import': {
      const file = await chooseFile('.txt,.md,.markdown,.mdown,.mkd,text/plain,text/markdown');
      return file && {text:await readText(file), markdown:/\.(md|markdown|mdown|mkd)$/i.test(file.name)};
    }
    case 'export': {
      const extension = args.markdown ? 'md' : 'txt';
      return download(args.text, 'text/plain;charset=utf-8', `${filename(args.body)}.${extension}`);
    }
    case 'backup': {
      const backup = await storage.makeBackup();
      return download(JSON.stringify(backup), 'application/json', `Inkrail-${new Date().toISOString().slice(0, 10)}.json`);
    }
    case 'openBackup': return chooseFile('.json,application/json');
    case 'mergeBackup': {
      const text = await readText(args);
      let backup;
      try { backup = JSON.parse(text); }
      catch { throw new InterfaceError('В файле некорректный JSON. Выберите резервную копию библиотеки Inkrail.'); }
      return storage.mergeBackup(backup);
    }
    case 'beginPdfExport': if (printing) return false; printing = true; return true;
    case 'exportPDF': return printLetter(args);
    case 'endPdfExport': printing = false; return;
    default: throw new InterfaceError('Эта операция не поддерживается.');
  }
}

// Do not let dropped files navigate away from unsaved writing. Import uses an explicit file picker.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());

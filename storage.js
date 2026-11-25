import {InterfaceError} from './ru.js';
import {validateFormatting} from './markdown.js';
import {hasLetterText, normalizeSeal} from './seal.js';

export const libraryPath = 'Хранилище этого браузера';
const retention = 30 * 24 * 60 * 60 * 1000;
const ids = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const versions = new Map();
let opening;

function request(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function database() {
  if (!opening) {
    const open = indexedDB.open('inkrail-web', 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('letters', {keyPath: 'page.id'});
      open.result.createObjectStore('meta');
    };
    opening = request(open).then(db => {
      db.onversionchange = () => { db.close(); opening = null; };
      return db;
    }).catch(error => { opening = null; throw error; });
  }
  return opening;
}

async function transact(names, mode, work) {
  const db = await database();
  const tx = db.transaction(names, mode);
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new InterfaceError('Операция с библиотекой была отменена.'));
  });
  // The transaction may abort while work is still awaiting an IDB request.
  void done.catch(() => {});
  try {
    const result = await work(...names.map(name => tx.objectStore(name)));
    await done;
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* Already settled. */ }
    await done.catch(() => {});
    throw error;
  }
}
const read = (names, work) => transact(names, 'readonly', work);
const write = (names, work) => transact(names, 'readwrite', work);
const record = (page, deletedAt = null) => ({page, deletedAt, version: crypto.randomUUID()});
const expired = (at, now) => at !== null && now - at >= retention;
const changed = () => new InterfaceError('Это письмо изменилось в другой вкладке. Сохраните копию с вашими правками и заново откройте Inkrail.');

function checkedPage(raw) {
  if (typeof raw?.id !== 'string' || !ids.test(raw.id) || typeof raw.text !== 'string' ||
      typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt)) ||
      typeof raw.modifiedAt !== 'string' || !Number.isFinite(Date.parse(raw.modifiedAt)) ||
      (raw.privateTitle !== undefined && typeof raw.privateTitle !== 'string')) {
    throw new InterfaceError('В резервной копии есть повреждённое письмо. Библиотека не изменилась.');
  }
  const {createdAt, modifiedAt, text, privateTitle} = raw;
  const page = {id: raw.id.toUpperCase(), createdAt, modifiedAt, text, formatting: validateFormatting(text, raw.formatting)};
  if (privateTitle) page.privateTitle = privateTitle;
  const seal = hasLetterText(text) && normalizeSeal(raw.seal);
  if (seal) page.seal = seal;
  return page;
}

function list(records, trash) {
  return records.filter(r => trash === (r.deletedAt !== null)).map(r => {
    if (!trash && !versions.has(r.page.id)) versions.set(r.page.id, r.version);
    return r.page;
  }).sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
}

export async function cleanup(now = Date.now()) {
  const removedIDs = await write(['letters'], async letters => {
    const records = await request(letters.getAll());
    const removed = records.filter(r => expired(r.deletedAt, now)).map(r => r.page.id);
    for (const id of removed) letters.delete(id);
    return removed;
  });
  return {removedIDs, warnings: []};
}

export async function boot() {
  await cleanup();
  const [records, settings] = await read(['letters', 'meta'], (letters, meta) =>
    Promise.all([request(letters.getAll()), request(meta.get('settings'))]));
  return {pages: list(records, false), settings, available: true, path: libraryPath};
}

export async function listPages(trash) {
  const records = await read(['letters'], letters => request(letters.getAll()));
  return {pages: list(records, trash), warnings: []};
}

export async function savePage(page) {
  const next = record(page);
  await write(['letters'], async letters => {
    const current = await request(letters.get(page.id));
    if (current?.version !== versions.get(page.id) || (current && current.deletedAt !== null)) throw changed();
    letters.put(next);
  });
  versions.set(page.id, next.version);
}

export function saveSettings(settings) {
  return write(['meta'], meta => request(meta.put(settings, 'settings')));
}

export async function movePage(id, toTrash) {
  const next = await write(['letters'], async letters => {
    const current = await request(letters.get(id));
    if (!current || toTrash !== (current.deletedAt === null) || expired(current.deletedAt, Date.now())) {
      throw new InterfaceError('Письмо больше недоступно. Заново откройте Inkrail, чтобы обновить библиотеку.');
    }
    if (toTrash && current.version !== versions.get(id)) throw changed();
    const next = record(current.page, toTrash ? Date.now() : null);
    letters.put(next);
    return next;
  });
  if (toTrash) versions.delete(id); else versions.set(id, next.version);
}

export async function makeBackup() {
  await cleanup();
  return read(['letters', 'meta'], async (letters, meta) => {
    const [records, settings] = await Promise.all([request(letters.getAll()), request(meta.get('settings'))]);
    return {format: 'inkrail-web-library', version: 1, settings, letters: records.map(({page, deletedAt}) => ({page, deletedAt}))};
  });
}

export async function mergeBackup(backup, now = Date.now()) {
  if (backup?.format !== 'inkrail-web-library' || backup.version !== 1 || !Array.isArray(backup.letters)) {
    throw new InterfaceError('Выберите резервную копию библиотеки Inkrail.');
  }
  // Validate the entire file before opening a write transaction.
  const incoming = backup.letters.map(entry => {
    const at = entry?.deletedAt;
    if (at !== null && (!Number.isSafeInteger(at) || at < 0 || at > 8640000000000000)) {
      throw new InterfaceError('В резервной копии указана неверная дата удаления. Библиотека не изменилась.');
    }
    return record(checkedPage(entry?.page), at);
  });
  const keys = new Set(incoming.map(entry => entry.page.id));
  if (keys.size !== incoming.length) throw new InterfaceError('В резервной копии повторяются идентификаторы писем. Библиотека не изменилась.');

  return write(['letters'], async letters => {
    let added = 0;
    const existing = new Map((await request(letters.getAll())).map(r => [r.page.id, r]));
    for (const next of incoming) {
      if (expired(next.deletedAt, now)) continue;
      const previous = existing.get(next.page.id);
      if (previous) {
        if (JSON.stringify(checkedPage(previous.page)) === JSON.stringify(next.page)) continue;
        // Keep both versions. Never replace or move an existing letter on import.
        do { next.page.id = crypto.randomUUID().toUpperCase(); }
        while (keys.has(next.page.id) || existing.has(next.page.id));
      }
      letters.add(next);
      existing.set(next.page.id, next);
      added++;
    }
    const settings = backup.settings?.preferences;
    return {added, preferences: settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : null};
  });
}

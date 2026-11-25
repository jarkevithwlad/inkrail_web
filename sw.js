// Bump this revision whenever a deployed app file changes. The whole desk is
// cached together; letters and preferences live separately in IndexedDB.
const prefix = `inkrail-web:${self.registration.scope}:`;
const version = `${prefix}v5`;
const files = [
  './index.html', './ru.js', './startup.js', './app.js', './bridge.js', './storage.js', './audio.js',
  './defaults.js', './desk.js', './editor.js', './margin-bell.js', './markdown.js',
  './panels.js', './seal.js', './sound-profiles.js', './desk.css', './editor.css',
  './panels.css', './shell.css', './assets/AppIcon.png', './assets/paper-grain.png',
  './assets/maker-mark.png', './assets/letter-seal-wax.png',
  ...['brass', 'linen'].flatMap(material => ['body', 'emitter'].map(part => `./assets/desk-lamp-${material}-${part}.png`)),
  ...['Regular', 'Bold', 'Italic', 'BoldItalic'].map(style => `./assets/fonts/CourierPrime-${style}.ttf`),
  ...['', 'soft-', 'royal-', 'vintage-', 'portable-', 'electric-'].flatMap(style =>
    ['bell', 'erase', 'key-1', 'key-2', 'key-3', 'return', 'space'].map(name => `./assets/${style}${name}.wav`)),
];
const assets = new Set(files.map(path => new URL(path, self.registration.scope).href));
const index = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(version);
    await cache.addAll(files.map(path => new Request(path, {cache:'reload'})));
    // Use the complete new cache on the next navigation, even with old tabs open.
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== version)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const desk = request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(index).pathname);
  if (url.origin !== self.location.origin || (!desk && !assets.has(url.href))) return;
  event.respondWith(caches.open(version).then(async cache => await cache.match(desk ? index : request) || fetch(request)));
});

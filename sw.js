/* ============================================================
   Orthographe — service worker (application installée, hors ligne)
   ------------------------------------------------------------
   - À l'installation : met en cache tous les fichiers de l'application.
   - Fichiers de l'application : réseau d'abord (toujours la dernière
     version quand on est connecté), copie en cache si le réseau ne répond
     pas dans les 4 s ou si l'on est hors ligne.
   - Police (Google Fonts) : cache d'abord.
   - Ne touche jamais à la progression de l'élève (localStorage).
   Après l'ajout d'un fichier à l'application : l'ajouter à FICHIERS
   et changer VERSION.
   ============================================================ */
'use strict';

const VERSION = 'orthographe-v2';
const POLICES = 'orthographe-polices';
const FICHIERS = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/theme.css', 'assets/er.css', 'assets/sommaire.css', 'assets/sommaire.js', 'assets/hero.js',
  'assets/succes.js', 'assets/succes.css',
  'modules/ort.css', 'modules/ort.js', 'modules/sauvegarde.js', 'modules/regles.js', 'modules/langue.js',
  'modules/mots.js', 'modules/banque.js', 'modules/textes-brevet.js', 'modules/dictee.js', 'modules/mes-succes.js',
  'modules/dictee_courte.html', 'modules/dictee_brevet.html', 'modules/suivi.html', 'modules/fiches.html',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-maskable-512.png',
  'icones/apple-touch-icon.png', 'icones/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

// anciennes versions du cache supprimées
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(l => Promise.all(l.filter(n => n !== VERSION && n !== POLICES).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// réseau d'abord, cache si le réseau échoue ou tarde
function reseauDabord(req) {
  const enCache = () => caches.match(req, { ignoreSearch: true });
  const reseau = fetch(req).then(r => {
    if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return r;
  });
  const delai = new Promise(ok => setTimeout(ok, 4000)).then(enCache);
  return new Promise((ok, ko) => {
    let fini = false;
    const rendre = r => { if (!fini && r) { fini = true; ok(r); } };
    reseau.then(rendre, () => enCache().then(r => (r ? rendre(r) : (!fini && ko(new Error('hors ligne'))))));
    delai.then(rendre);
  });
}

// cache d'abord (polices)
function cacheDabord(req) {
  return caches.open(POLICES).then(c => c.match(req).then(r => r || fetch(req).then(x => {
    if (x && (x.ok || x.type === 'opaque')) c.put(req, x.clone());
    return x;
  })));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) e.respondWith(reseauDabord(req));
  else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(cacheDabord(req));
});

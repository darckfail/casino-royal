/* ==========================================================================
   Casino Royal Byte — enregistrement de la partie
   - note chaque événement (page ouverte, clics, touches) avec son heure ;
   - les garde dans le navigateur, puis les écrit dans .vscode/journal.jsonl,
     dans le dépôt choisi par le joueur (Chrome / Edge). Live Server ignore
     .vscode/ : écrire ailleurs rechargerait la page en boucle.
   ========================================================================== */
(function () {
  'use strict';

  var SOUS_DOSSIER = '.vscode';
  var FICHIER = 'journal.jsonl';
  var CLE_ATTENTE = 'casino-royal-byte:journal-attente';
  var CLE_SUITE = 'casino-royal-byte:journal-suite';
  var CLE_JOUEUR = 'casino-royal-byte:joueur';
  var BASE = 'casino-royal-byte';
  var MAGASIN = 'depot';
  var VERROU = 'casino-royal-byte:journal';
  var DELAI_ECRITURE = 1500;

  var possible = typeof window.showDirectoryPicker === 'function' && !!window.indexedDB && !!navigator.locks;
  var dossier = null;
  var minuterie = null;

  // ---------- Horodatage et empreinte ----------

  function deux(n) { return String(n).padStart(2, '0'); }

  /** 2026-10-12T18:03:21.457+02:00 (heure locale avec son décalage) */
  function maintenant() {
    var d = new Date();
    var decalage = -d.getTimezoneOffset();
    var signe = decalage >= 0 ? '+' : '-';
    decalage = Math.abs(decalage);
    return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()) +
      'T' + deux(d.getHours()) + ':' + deux(d.getMinutes()) + ':' + deux(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0') +
      signe + deux(Math.floor(decalage / 60)) + ':' + deux(decalage % 60);
  }

  /** FNV-1a 32 bits : chaque ligne porte l'empreinte de la précédente. */
  function empreinte(texte) {
    var h = 0x811c9dc5;
    for (var i = 0; i < texte.length; i++) {
      h ^= texte.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // ---------- File d'attente (localStorage) ----------

  function lire(cle, defaut) {
    try { return JSON.parse(localStorage.getItem(cle) || 'null') || defaut; } catch (e) { return defaut; }
  }

  function ecrire(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ }
  }

  function noter(type, details) {
    var suite = lire(CLE_SUITE, { n: 0, h: '00000000' });
    var entree = { n: suite.n + 1, t: maintenant(), type: type, page: cheminPage() };
    for (var cle in details) entree[cle] = details[cle];
    entree.h = empreinte(suite.h + JSON.stringify(entree));
    ecrire(CLE_SUITE, { n: entree.n, h: entree.h });
    var attente = lire(CLE_ATTENTE, []);
    attente.push(entree);
    ecrire(CLE_ATTENTE, attente);
    planifier();
  }

  // ---------- Description de la page et des éléments ----------

  /** Chemin depuis la racine du dépôt : index.html, tables/salon-vip.html, membre.html?id=12 */
  function cheminPage() {
    var profondeur = ((document.body && document.body.dataset.racine) || '').split('../').length - 1;
    var morceaux = decodeURIComponent(location.pathname).split('/');
    return morceaux.slice(-1 - profondeur).join('/') + location.search + location.hash;
  }

  function decrire(el) {
    if (!el || !el.tagName) return '';
    var texte = el.tagName.toLowerCase();
    if (el.id) texte += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) {
      texte += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
    }
    return texte;
  }

  function libelle(el) {
    var cible = el && el.closest ? el.closest('a, button, label, summary, [role="button"]') || el : el;
    var texte = cible && (cible.innerText || cible.value || cible.alt || '');
    return String(texte || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  function clic(e, bouton) {
    var details = { bouton: bouton, cible: decrire(e.target), x: Math.round(e.pageX), y: Math.round(e.pageY) };
    var texte = libelle(e.target);
    if (texte) details.texte = texte;
    var lien = e.target.closest && e.target.closest('a[href]');
    if (lien) details.lien = lien.getAttribute('href');
    noter('clic', details);
  }

  // ---------- Écriture dans le dépôt ----------

  function base() {
    return new Promise(function (ok, ko) {
      var req = indexedDB.open(BASE, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(MAGASIN); };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { ko(req.error); };
    });
  }

  function memoire(action, valeur) {
    return base().then(function (db) {
      return new Promise(function (ok, ko) {
        var tx = db.transaction(MAGASIN, action === 'lire' ? 'readonly' : 'readwrite');
        var magasin = tx.objectStore(MAGASIN);
        var req = action === 'lire' ? magasin.get('dossier') : magasin.put(valeur, 'dossier');
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { ko(req.error); };
      });
    });
  }

  function planifier() {
    if (!dossier || minuterie) return;
    minuterie = setTimeout(function () { minuterie = null; vider(); }, DELAI_ECRITURE);
  }

  /** Écrit les événements en attente à la fin de .vscode/journal.jsonl, un onglet à la fois. */
  function vider() {
    if (!dossier) return Promise.resolve();
    return navigator.locks.request(VERROU, function () {
      var lot = lire(CLE_ATTENTE, []);
      if (!lot.length) return null;
      var lignes = lot.map(function (e) { return JSON.stringify(e) + '\n'; }).join('');
      return dossier.getDirectoryHandle(SOUS_DOSSIER, { create: true })
        .then(function (sous) { return sous.getFileHandle(FICHIER, { create: true }); })
        .then(function (fichier) { return Promise.all([fichier.getFile(), fichier.createWritable({ keepExistingData: true })]); })
        .then(function (r) {
          var flux = r[1];
          return flux.seek(r[0].size)
            .then(function () { return flux.write(lignes); })
            .then(function () { return flux.close(); });
        })
        .then(function () {
          // D'autres onglets ont pu ajouter des événements pendant l'écriture : on ne retire que le lot écrit.
          ecrire(CLE_ATTENTE, lire(CLE_ATTENTE, []).slice(lot.length));
        });
    }).catch(function () {
      dossier = null;
      afficherBandeau();
    });
  }

  function autorise(poignee, demander) {
    var options = { mode: 'readwrite' };
    return poignee.queryPermission(options).then(function (etat) {
      if (etat === 'granted' || !demander) return etat === 'granted';
      return poignee.requestPermission(options).then(function (r) { return r === 'granted'; });
    });
  }

  function relier(poignee) {
    dossier = poignee;
    masquerBandeau();
    return vider();
  }

  function choisirDossier() {
    window.showDirectoryPicker({ id: 'casino-royal-byte', mode: 'readwrite' })
      .then(function (poignee) {
        return poignee.getFileHandle('reponses.md').then(
          function () {
            noter('depot-relie', { dossier: poignee.name });
            return memoire('ecrire', poignee).then(function () { return relier(poignee); });
          },
          function () {
            afficherBandeau('Ce dossier ne contient pas reponses.md : choisis le dossier de ton dépôt.');
          }
        );
      })
      .catch(function () { /* fenêtre fermée sans choix */ });
  }

  function reconnecter(poignee) {
    autorise(poignee, true).then(function (ok) {
      if (ok) relier(poignee); else afficherBandeau();
    });
  }

  // ---------- Bandeau ----------

  var bandeau = null;

  function afficherBandeau(message) {
    if (!possible || !document.body || !lire(CLE_JOUEUR, null)) return;
    if (!bandeau) {
      bandeau = document.createElement('div');
      bandeau.className = 'alert alert--info';
      bandeau.setAttribute('role', 'status');
      bandeau.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:1000;margin:0;' +
        'align-items:center;justify-content:space-between;flex-wrap:wrap;backdrop-filter:blur(8px);';
      bandeau.innerHTML = '<p></p><button type="button" class="btn btn--primary btn--sm"></button>';
      document.body.appendChild(bandeau);
    }
    memoire('lire').catch(function () { return null; }).then(function (poignee) {
      var texte = bandeau.querySelector('p');
      var bouton = bandeau.querySelector('button');
      texte.textContent = message || (poignee
        ? 'Ta partie n\'est plus reliée à ton dépôt.'
        : 'Pour enregistrer ta partie, choisis le dossier de ton dépôt (celui qui contient reponses.md).');
      bouton.textContent = poignee && !message ? 'Reconnecter le dépôt' : 'Choisir le dossier du dépôt';
      bouton.onclick = poignee && !message ? function () { reconnecter(poignee); } : choisirDossier;
      bandeau.hidden = false;
    });
  }

  function masquerBandeau() {
    if (bandeau) bandeau.hidden = true;
  }

  // ---------- Écoute ----------

  var joueur = lire(CLE_JOUEUR, null);
  noter('ouverture', joueur ? { joueur: joueur.nom, titre: document.title } : { titre: document.title });

  // detail = 0 : « clic » produit par le clavier (Entrée, Espace) et non par la souris.
  document.addEventListener('click', function (e) { clic(e, e.detail === 0 ? 'clavier' : 'gauche'); }, true);
  document.addEventListener('mousedown', function (e) { if (e.button === 1) clic(e, 'milieu'); }, true);
  document.addEventListener('contextmenu', function (e) { clic(e, 'droit'); }, true);

  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var details = { touche: e.key, code: e.code, cible: decrire(e.target) };
    var mods = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'].filter(function (m) { return e[m]; })
      .map(function (m) { return m.replace('Key', ''); });
    if (mods.length) details.mods = mods.join('+');
    noter('touche', details);
  }, true);

  document.addEventListener('visibilitychange', function () {
    noter(document.visibilityState === 'hidden' ? 'onglet-quitte' : 'onglet-revenu', {});
    if (document.visibilityState === 'hidden') vider();
  });

  window.addEventListener('pagehide', function () { noter('fermeture', {}); vider(); });

  // ---------- Démarrage ----------

  if (!possible) return;
  memoire('lire').catch(function () { return null; }).then(function (poignee) {
    if (!poignee) { afficherBandeau(); return; }
    autorise(poignee, false).then(function (ok) {
      if (ok) relier(poignee); else afficherBandeau();
    });
  });
})();

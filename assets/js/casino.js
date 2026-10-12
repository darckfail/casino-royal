/* ==========================================================================
   Casino Royal Byte — comportement des pages
   - retient le joueur (nom saisi sur l'accueil) dans le navigateur ;
   - remplit les valeurs personnelles (data-valeur, data-attribut) ;
   - construit les parties dynamiques (fiches membres, roulette, caisse…).
   Aucune réponse n'est vérifiée ici : les réponses vont dans reponses.md.
   ========================================================================== */
(function () {
  'use strict';

  var CLE = 'casino-royal-byte:joueur';
  var DUREE_CONSEILLEE = 45 * 60;
  var page = document.body.dataset.page || '';

  // ---------- Joueur ----------

  function lireJoueur() {
    try { return JSON.parse(localStorage.getItem(CLE) || 'null'); } catch (e) { return null; }
  }

  function enregistrerJoueur(nom) {
    var joueur = { nom: nom.trim(), debut: Date.now() };
    try { localStorage.setItem(CLE, JSON.stringify(joueur)); } catch (e) { /* stockage indisponible */ }
    return joueur;
  }

  function oublierJoueur() {
    try { localStorage.removeItem(CLE); } catch (e) { /* ignoré */ }
  }

  // ---------- Remplissage des valeurs personnelles ----------

  function valeur(objet, chemin) {
    return chemin.split('.').reduce(function (o, cle) { return o == null ? undefined : o[cle]; }, objet);
  }

  /** <span data-valeur="ticket.serie"> et <div data-attribut="data-serie=ticket.serie;data-ref=ticket.ref"> */
  function remplir(racine, donnees) {
    racine.querySelectorAll('[data-valeur]').forEach(function (el) {
      var v = valeur(donnees, el.dataset.valeur);
      if (v !== undefined) el.textContent = v;
    });
    racine.querySelectorAll('[data-attribut]').forEach(function (el) {
      el.dataset.attribut.split(';').forEach(function (paire) {
        var morceaux = paire.split('=');
        var v = valeur(donnees, morceaux[1].trim());
        if (v !== undefined) el.setAttribute(morceaux[0].trim(), v);
      });
    });
  }

  // ---------- Chronomètre ----------

  function horloge(secondes) {
    var h = Math.floor(secondes / 3600);
    var m = String(Math.floor((secondes % 3600) / 60)).padStart(2, '0');
    var s = String(secondes % 60).padStart(2, '0');
    return h > 0 ? h + ':' + m + ':' + s : m + ':' + s;
  }

  function demarrerChrono(joueur) {
    var noeuds = document.querySelectorAll('[data-chrono]');
    if (!noeuds.length) return;
    function tic() {
      var ecoule = Math.max(0, Math.floor((Date.now() - joueur.debut) / 1000));
      noeuds.forEach(function (n) {
        n.textContent = horloge(ecoule);
        n.classList.toggle('is-overtime', ecoule > DUREE_CONSEILLEE);
      });
    }
    tic();
    setInterval(tic, 1000);
  }

  // ---------- Accueil ----------

  function pageAccueil(joueur) {
    var form = document.getElementById('form-joueur');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nom = form.elements.nom.value;
        if (window.CasinoTables.normaliserNom(nom).split(' ').length < 2) {
          document.getElementById('erreur-nom').hidden = false;
          return;
        }
        enregistrerJoueur(nom);
        location.reload();
      });
    }
    var changer = document.getElementById('changer-joueur');
    if (changer) {
      changer.addEventListener('click', function () {
        if (confirm('Changer de joueur ? Toutes les valeurs des tables vont changer.')) {
          oublierJoueur();
          location.reload();
        }
      });
    }
    document.querySelectorAll('[data-si-joueur]').forEach(function (el) { el.hidden = !joueur; });
    document.querySelectorAll('[data-si-pas-joueur]').forEach(function (el) { el.hidden = !!joueur; });
  }

  // ---------- Fiches membres (membre.html?id=…) ----------

  var PRENOMS = ['Adèle', 'Basile', 'Céleste', 'Dorian', 'Éléonore', 'Félix', 'Garance', 'Hector', 'Inès', 'Jules', 'Katell', 'Léon', 'Margaux', 'Nestor', 'Octavie', 'Philémon', 'Quitterie', 'Romain', 'Solène', 'Timothée', 'Ursule', 'Victor', 'Wanda', 'Yvon', 'Zélie'];
  var NOMS = ['Arnaud', 'Bellecour', 'Castel', 'Delorme', 'Esterel', 'Fontanel', 'Granier', 'Haussmann', 'Ivry', 'Joubert', 'Lacombe', 'Marchetti', 'Noailles', 'Orsini', 'Pradel', 'Rochambeau', 'Sorel', 'Tessier', 'Valmont', 'Verneuil'];
  var JEUX = ['Roulette française', 'Black-jack', 'Baccara', 'Poker Texas Hold\'em', 'Punto banco', 'Craps'];
  var STATUTS = ['Membre', 'Membre Argent', 'Membre Or', 'Membre Platine'];
  var VILLES = ['Deauville', 'Biarritz', 'Évian', 'Cannes', 'Enghien', 'Divonne', 'Monte-Carlo', 'Aix-les-Bains'];

  function ficheOrdinaire(id) {
    var n = (id * 2654435761) >>> 0;
    return {
      id: id,
      nom: PRENOMS[n % PRENOMS.length] + ' ' + NOMS[Math.floor(n / 31) % NOMS.length],
      statut: STATUTS[Math.floor(n / 7) % STATUTS.length],
      depuis: 1998 + Math.floor(n / 13) % 27,
      jeu: JEUX[Math.floor(n / 3) % JEUX.length],
      ville: VILLES[Math.floor(n / 11) % VILLES.length],
      note: '',
      memo: '',
    };
  }

  function fiche(id, t) {
    if (!(id >= 1 && id <= 999)) return null;
    if (id === 1) {
      return {
        id: 1, nom: 'Édouard de Valmont', statut: 'Directeur — membre fondateur', depuis: 1997,
        jeu: 'Baccara', ville: 'Monte-Carlo', directeur: true,
        note: 'Fondateur du Casino Royal Byte.',
        memo: 'Mémo personnel : quatrième chiffre du coffre = ' + t.coffre.chiffres[3] + '.',
      };
    }
    var f = ficheOrdinaire(id);
    if (id === t.joueur.habitue) {
      f.parrain = t.joueur.parrain;
      f.ancienParrain = t.joueur.ancienParrain;
      f.note = 'Habitué des tables du jeudi.';
    }
    if (id === t.joueur.parrain) {
      f.nom = 'Identité masquée';
      f.statut = 'Membre fantôme';
      f.ville = '—';
      f.nomDeCode = t.joueur.nomDeCode;
      f.note = 'Aucune partie enregistrée. Accès à toutes les salles.';
      f.prive = true;
    }
    if (id === t.joueur.ancienParrain) {
      f.statut = 'Compte clôturé';
      f.nomDeCode = t.joueur.ancienNomDeCode;
      f.note = 'Compte fermé par la direction. Nom de code révoqué.';
    }
    return f;
  }

  function pageMembre(t) {
    var id = Number(new URLSearchParams(location.search).get('id'));
    var f = fiche(id, t);
    var carte = document.getElementById('fiche');
    var introuvable = document.getElementById('fiche-introuvable');
    if (!f) {
      carte.hidden = true;
      introuvable.hidden = false;
      document.title = 'Membre introuvable · Casino Royal Byte';
      return;
    }
    document.title = 'Fiche membre n°' + f.id + ' · Casino Royal Byte';
    remplir(carte, { fiche: f });

    var champParrain = document.getElementById('champ-parrain');
    if (f.parrain) {
      champParrain.setAttribute('data-ancien-parrain', f.ancienParrain);
    } else {
      champParrain.remove();
    }
    var champCode = document.getElementById('champ-code');
    if (f.nomDeCode) champCode.hidden = false; else champCode.remove();
    if (!f.memo) document.getElementById('memo').remove();
    if (f.prive) carte.classList.add('member-card--private');
    if (f.directeur) carte.classList.add('member-card--director');
  }

  // ---------- Roulette ----------

  var ROUGES = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function pageRoulette(t) {
    var liste = document.getElementById('tirages');
    var tirages = t.roulette.tirages;
    tirages.forEach(function (n, i) {
      var li = document.createElement('li');
      li.className = 'draw draw--' + (n === 0 ? 'green' : ROUGES.indexOf(n) !== -1 ? 'red' : 'black');
      li.style.setProperty('--i', i);
      li.innerHTML = '<span class="draw__rank">' + (i + 1) + '</span><span class="draw__number">' + n + '</span>';
      // Seuls les 3 derniers tirages sont affichés par défaut.
      if (i < tirages.length - 3) li.hidden = true;
      liste.insertBefore(li, liste.querySelector('.draw--unknown'));
    });

    var bouton = document.getElementById('historique-complet');
    bouton.addEventListener('click', function () {
      liste.querySelectorAll('li[hidden]').forEach(function (li) { li.hidden = false; });
      bouton.remove();
    });
  }

  // ---------- Croupier ----------

  function pageCroupier(t) {
    var pile = document.getElementById('pile-jetons');
    for (var i = 0; i < t.croupier.decalage; i++) {
      var jeton = document.createElement('span');
      jeton.className = 'chip-stack__chip';
      jeton.style.setProperty('--i', i);
      pile.appendChild(jeton);
    }
    var alphabet = document.getElementById('alphabet');
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (lettre, i) {
      var s = document.createElement('span');
      s.innerHTML = '<b>' + lettre + '</b><small>' + (i + 1) + '</small>';
      alphabet.appendChild(s);
    });
  }

  // ---------- Caisse ----------

  function pageCaisse(t) {
    var corps = document.getElementById('journal-caisse');
    var question = corps.querySelector('.table__ask');
    t.caisse.exemples.forEach(function (ex, i) {
      var tr = document.createElement('tr');
      // Lignes 1 et 4 : archivées par la caisse.
      if (i === 0 || i === 3) tr.className = 'ligne-archivee';
      tr.innerHTML = '<td><code>' + ex.montant + '</code></td><td><code>' + ex.code + '</code></td>';
      corps.insertBefore(tr, question);
    });
  }

  // ---------- Démarrage ----------

  function sansJoueur() {
    var main = document.querySelector('main');
    var accueil = page === 'accueil' ? '' : (document.body.dataset.racine || '') + 'index.html';
    if (page === 'accueil') return;
    main.innerHTML =
      '<section class="card locked-panel sans-joueur reveal">' +
      '<p class="eyebrow">Joueur inconnu</p>' +
      '<h1 class="display display--md">Présente-toi d\'abord</h1>' +
      '<p class="lead">Les tables sont préparées pour chaque joueur. Commence par saisir ton nom sur la page d\'accueil.</p>' +
      '<a class="btn btn--primary" href="' + accueil + '">Aller à l\'accueil</a></section>';
  }

  var joueur = lireJoueur();

  if (page === 'accueil') pageAccueil(joueur);

  if (!joueur) {
    sansJoueur();
  } else {
    var t = window.CasinoTables.pour(joueur.nom);
    t.lienHabitue = (document.body.dataset.racine || '') + 'membre.html?id=' + t.joueur.habitue;
    remplir(document, t);
    demarrerChrono(joueur);
    if (page === 'membre') pageMembre(t);
    if (page === 'roulette') pageRoulette(t);
    if (page === 'croupier') pageCroupier(t);
    if (page === 'caisse') pageCaisse(t);
  }

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
  }
})();

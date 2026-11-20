/* ============================================================
   Orthographe — les succès de l'application
   ------------------------------------------------------------
   Rôle : déclare les succès (moteur commun assets/succes.js, objet SUC),
   compte ce qu'il faut à chaque dictée terminée, et calcule l'état de
   départ d'après le suivi déjà enregistré (première fois).
   Chargé après ort.js (ORT.statut, ORT.R…).

   Compteurs (SUC, clé orthographe-succes) :
     dictees      dictées terminées (courtes et brevet)    sansFaute   dictées à 20/20
     tresBien     dictées à 16/20 au moins
     serie        dictées d'affilée à 16/20 au moins (en cours) ; serieMax : record
     tenace       fautes corrigées au 2e essai (dictée courte)
     brevet       dictées brevet terminées                  pretBrevet  dictées brevet à 16/20 au moins
     audio        dictées courtes audio terminées
   Jours : jours avec au moins une dictée terminée.
   Ensembles : « maitrisees » règles maîtrisées au moins une fois ;
               « sujets » sujets du brevet déjà tombés terminés.

   API :
     ORT.succesApres(occasions, note, type, info)  appelé par ORT.enregistrer ; type 'c' | 'b' ;
                                   info : { audio } ou { sujet } ; renvoie les nouveaux succès
     ORT.carteSucces()            carte « Mes succès » (page Mon suivi)
     ORT.blocSucces(liste)        bloc « Nouveaux succès » avec le lien vers Mon suivi (ou null)
   ============================================================ */
(function () {
  'use strict';
  const ORT = window.ORT, D = window.ORTHO_DONNEES;
  const APP = 'orthographe';
  const BIEN = 16;                                  // « très bien » : 16/20 au moins
  const pl = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');

  // règles maîtrisées au moins une fois (toutes, ou celles d'un niveau de priorité)
  const regles = niv => D.regles.filter(r => !niv || r.niveau === niv).map(r => r.id);
  const maitrisees = (E, niv) => regles(niv).filter(id => (E.e.maitrisees || []).indexOf(id) >= 0).length;
  // seuils d'un niveau : 25 %, 50 %, 75 % et toutes ses règles
  const seuilsNiveau = niv => () => { const n = regles(niv).length; return [0.25, 0.5, 0.75, 1].map(x => Math.max(1, Math.ceil(x * n))); };
  const nbSujets = () => (window.ORTHO_BREVET ? window.ORTHO_BREVET.length : 11);

  const categories = [
    { nom: 'Régularité', succes: [
      { id: 'regulier', ic: '🔥', nom: 'Régulier', cond: 'Jours d’affilée avec au moins une dictée terminée', seuils: [3, 7, 14, 30], u: 'j',
        val: E => SUC.serie(E.j).record, avance: E => SUC.serie(E.j).encours,
        astuce: E => {
          const s = SUC.serie(E.j);
          if (!s.record) return '';
          if (s.aujourdhui) return 'Série en cours : ' + pl(s.encours, 'jour') + '. Dictée faite aujourd’hui ✓ : reviens demain pour la prolonger.';
          if (s.encours) return 'Série en cours : ' + pl(s.encours, 'jour') + '. Fais une dictée aujourd’hui pour la prolonger.';
          return 'Record : ' + pl(s.record, 'jour') + ' d’affilée. Fais une dictée aujourd’hui pour commencer une nouvelle série.';
        } },
      { id: 'assidu', ic: '📅', nom: 'Assidu', cond: 'Jours différents avec au moins une dictée terminée', seuils: [5, 15, 30, 60], u: 'j', val: E => E.j.length },
      { id: 'infatigable', ic: '🎯', nom: 'Infatigable', cond: 'Dictées terminées (courtes ou brevet)', seuils: [10, 25, 50, 100], val: E => E.c.dictees || 0 }
    ] },
    { nom: 'Réussite', succes: [
      { id: 'sansfaute', ic: '⭐', nom: 'Sans faute', cond: 'Dictées terminées avec 20/20', seuils: [1, 5, 15, 40], val: E => E.c.sansFaute || 0 },
      { id: 'tresbien', ic: '👍', nom: 'Très bien', cond: 'Dictées terminées avec au moins 16/20', seuils: [3, 10, 25, 60], val: E => E.c.tresBien || 0 },
      { id: 'inarretable', ic: '⚡', nom: 'Inarrêtable', cond: 'Dictées d’affilée avec au moins 16/20', seuils: [3, 5, 10, 20],
        val: E => E.c.serieMax || 0, avance: E => E.c.serie || 0,
        astuce: E => (E.c.serieMax ? 'Série en cours : ' + (E.c.serie || 0) + ' · record : ' + E.c.serieMax + '. Une dictée sous 16/20 remet la série à zéro.' : '') },
      { id: 'tenace', ic: '💪', nom: 'Tenace', cond: 'Fautes corrigées au 2e essai (dictée courte)', seuils: [10, 30, 75, 150], val: E => E.c.tenace || 0 }
    ] },
    { nom: 'Dictées', succes: [
      { id: 'candidat', ic: '🎓', nom: 'Candidat', cond: 'Dictées brevet terminées', seuils: [1, 5, 10, 20], val: E => E.c.brevet || 0 },
      { id: 'annales', ic: '📜', nom: 'Annales', cond: 'Sujets du brevet déjà tombés, différents, terminés (Platine : tous)',
        seuils: () => [2, 5, 8, nbSujets()], val: E => (E.e.sujets || []).length },
      { id: 'pretbrevet', ic: '🏆', nom: 'Prêt pour le brevet', cond: 'Dictées brevet avec au moins 8/10 (16/20)', seuils: [1, 3, 6, 10], val: E => E.c.pretBrevet || 0 },
      { id: 'oreille', ic: '🎧', nom: 'Oreille fine', cond: 'Dictées courtes audio terminées', seuils: [3, 10, 25, 50], val: E => E.c.audio || 0 }
    ] },
    { nom: 'Règles', succes: [
      { id: 'maitrise', ic: '🏅', nom: 'Maîtrise', cond: 'Règles maîtrisées au moins une fois (Platine : toutes)',
        seuils: () => [5, 15, 35, regles().length], val: E => maitrisees(E) }
    ].concat(D.niveaux.map((n, i) => ({
      id: 'niveau-' + n.n, ic: ['🧱', '📘', '🔍', '💎'][i] || '★', nom: n.nom,
      cond: 'Règles du niveau ' + n.n + ' maîtrisées au moins une fois (' + regles(n.n).length + ' règles)',
      seuils: seuilsNiveau(n.n), val: E => maitrisees(E, n.n)
    }))) }
  ];

  // état de départ (première fois) : calculé d'après le suivi déjà enregistré
  function depart() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(APP + '-suivi')); } catch (e) { v = null; }
    const c = {}, j = [];
    if (v && typeof v === 'object') {
      const notes = Array.isArray(v.notes) ? v.notes.filter(x => Array.isArray(x) && x.length === 3 && typeof x[2] === 'number') : [];
      notes.sort((a, b) => a[0] - b[0]);
      c.dictees = notes.length;
      c.sansFaute = notes.filter(x => x[2] === 20).length;
      c.tresBien = notes.filter(x => x[2] >= BIEN).length;
      c.brevet = notes.filter(x => x[1] === 'b').length;
      c.pretBrevet = notes.filter(x => x[1] === 'b' && x[2] >= BIEN).length;
      notes.forEach(x => j.push(SUC.jourDe(x[0])));
      let s = 0, m = 0;
      notes.forEach(x => { s = x[2] >= BIEN ? s + 1 : 0; if (s > m) m = s; });
      c.serie = s; c.serieMax = m;
      // fautes corrigées au 2e essai (occasions à 0,5)
      let t = 0;
      if (v.r && typeof v.r === 'object') Object.keys(v.r).forEach(k => { if (Array.isArray(v.r[k])) v.r[k].forEach(x => { if (Array.isArray(x) && x[1] === 0.5) t++; }); });
      c.tenace = t;
    }
    const e = { maitrisees: regles().filter(id => ORT.statut(id) === 'm') };
    return { c, j, e };
  }

  SUC.init({ app: APP, categories, depart });

  // règles maîtrisées maintenant : ajoutées à l'ensemble (gardées pour toujours)
  const noterMaitrisees = () => SUC.reunir('maitrisees', regles().filter(id => ORT.statut(id) === 'm'));

  // première fois : l'état de départ est enregistré tout de suite (niveaux déjà atteints, sans annonce)
  try { if (localStorage.getItem(APP + '-succes') === null) { noterMaitrisees(); SUC.verifier(); } } catch (e) { /* stockage indisponible */ }

  // après chaque dictée terminée : occasions, note sur 20, type ('c' courte, 'b' brevet), info ({ audio } ou { sujet })
  function succesApres(occasions, note, type, info) {
    const t = occasions.filter(o => o.ok === 0.5).length;
    if (t) SUC.ajouter('tenace', t);
    if (note != null) {
      const E = SUC.etat();
      SUC.ajouter('dictees');
      if (note === 20) SUC.ajouter('sansFaute');
      if (note >= BIEN) {
        SUC.ajouter('tresBien');
        SUC.fixer('serie', (E.c.serie || 0) + 1);
        SUC.record('serieMax', (E.c.serie || 0) + 1);
      } else SUC.fixer('serie', 0);
      if (type === 'b') {
        SUC.ajouter('brevet');
        if (note >= BIEN) SUC.ajouter('pretBrevet');
        if (info.sujet) SUC.reunir('sujets', [info.sujet]);
      } else if (info.audio) SUC.ajouter('audio');
      SUC.jour();
    }
    noterMaitrisees();
    return SUC.verifier();
  }

  // carte « Mes succès » : niveaux à jour (règles maîtrisées, copie restaurée)
  function carteSucces() {
    noterMaitrisees();
    SUC.verifier();
    return SUC.carte();
  }

  const blocSucces = liste => SUC.blocNouveaux(liste, 'suivi.html#succes');

  Object.assign(ORT, { succesApres, carteSucces, blocSucces });
})();

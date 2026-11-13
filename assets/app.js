/* Site des propals Green Cube (V1).
   Tout se passe dans le navigateur : rien n'est envoyé en ligne. La propal en cours est gardée dans ce
   navigateur (localStorage) et peut être enregistrée dans un fichier .json pour la rouvrir ailleurs.
   Seules les zones prévues sont modifiables : textes entre crochets, cases à cocher, emplacements d'image.
   La mise en page, les photos et les couleurs viennent des pages sources (outils/assembler.js). */
'use strict';
(() => {
const D = window.PROPAL_DATA;
// Styles propres aux modules (tableaux serrés, pictos, petites étiquettes), placés après propal.css comme dans les sources.
document.head.append(Object.assign(document.createElement('style'), {textContent: D.styles}));
const ANC = window.ANCIENNES_PROPALS || {fiches: [], source: ''};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const NB = ' ';
const pad = n => String(n).padStart(2, '0');
const fmt = n => new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2}).format(n).replace(/[   ]/g, NB);
const nombre = s => {
  const m = String(s ?? '').replace(/[\s  ]/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateFR = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ''); };
const isoDepuisFR = t => { const m = String(t).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : null; };

/* ---------- stockage dans le navigateur ---------- */
const K_INDEX = 'gc-propals-v1:index', K_DERNIERE = 'gc-propals-v1:derniere', kPropal = id => 'gc-propals-v1:p:' + id;
const K_BUNDLES = 'gc-propals-v1:bundles';          // le matériel enregistré comme bundle, proposé dans toutes les propals
const STOCK = {
  lire(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  retirer(k) { try { localStorage.removeItem(k); } catch (e) { /* rien à faire */ } },
};

/* ---------- réglages ---------- */
// Les 5 pages de la propal courte sont le cadre de toute propal : ce sont elles qu'on voit quand rien n'est coché.
const GEN = D.sources.find(s => s.type === 'commun');
const MODULES = D.sources.filter(s => s.type === 'module');
// Les fiches produits : une page par produit, à cocher. Elles forment une partie à elles quand au moins une est cochée.
const FICHES = D.sources.find(s => s.type === 'fiches');
const FAMILLES = FICHES ? [...new Set(FICHES.slides.map(s => s.data.famille).filter(Boolean))] : [];
const COUPURE = GEN.slides.findIndex(s => /^\(03\)/.test(s.nom));        // les solutions s'insèrent avant (03) Notre offre
// La page « Matériel proposé » (bundle) : le matériel choisi dans le panneau, avec ses quantités. Au-delà de 10 produits, elle passe sur plusieurs pages
// (10 et non 12 depuis le 04/11/2026 : en nouvelle charte, six lignes par colonne étaient trop serrées).
const BUNDLE = {cle: 'bundle', type: 'bundle', titre: 'Matériel proposé', court: 'Matériel proposé'};
const PAR_PAGE = 10, NB_PAGES_BUNDLE = 6, MAX_AUTRES = 20;
// Le matériel ajouté à la main n'a pas de photo : un picto Lucide « package » (licence ISC), en noir sur l'aplat citron.
const PICTO_COLIS = 'data:image/png;base64,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';
const PRODUITS = new Set(FICHES ? FICHES.slides.map(s => s.data.produit).filter(Boolean) : []);
const NOM_SOLUTION = '(02) Notre solution', NOM_OFFRE = '(03) Notre offre', NOM_COMPARATIF = '(04) Le comparatif';
// Pages de matériel rattachées à une partie : si la partie est décochée, la page part avec elle.
const LIENS_MATERIEL = {securite: [[/alarme/i, '3.1'], [/caméra|enregistreur|autres équipements|vidéoprotection/i, '3.3'], [/contrôle d.accès/i, '3.4']]};
// Cases de (01) « Ce que vous avez déjà » reprises dans « Situation actuelle » de chaque solution
// (numéros des zones de la propal courte en nouvelle charte, depuis le 04/11/2026).
// Le 12/11/2026, ces numéros et ceux de U01 ont été recalés d'un cran : la case « Ordinateurs » est la zone 5, pas la 6.
const SITUATION_01 = {securite: [12, 13, 14], informatique: [5, 6, 7, 8, 10], reseaux: [9, 10, 11]};
// (01) Votre situation : les prestataires actuels (zone 17) et ce que le client paie aujourd'hui (zone 18).
const U01 = {prestataire: 17, montant: 18};
// Depuis le 12/11/2026 (demande d'Ilian) : chaque case de « Ce que vous avez déjà » (zones 5 à 16) a son prestataire (19 à 30)
// et son prix par mois (31 à 42), visibles seulement quand la case est cochée. Ils remplissent les prestataires, le total
// payé aujourd'hui et la colonne « Aujourd'hui » du comparatif (service, prestataire, prix).
const SIT01 = {cases: 5, prestataires: 19, prix: 31, nb: 12};
// Zones reliées aux informations du panneau (numéro de zone dans la slide → information).
// Sur la couverture, la numérotation part de 5 (data-u-premier) : 5 est le logo du client. Les zones 0 à 4 étaient les chiffres
// de Green Cube, devenus du texte fixe repris du catalogue le 06/11/2026 (demande d'Ilian).
const INFOS = {
  'Green Cube / Client': {6: 'client', 7: 'projet', 8: 'date', 9: 'validite', 10: 'commercial', 11: 'tel', 12: 'email'},
  [NOM_COMPARATIF]: {31: 'commercial', 32: 'tel'},
};
// « Notre offre » : les prix et les cases « Retenue » de l'achat, de la location, des abonnements et de la maintenance.
const OFFRE = {prix: {achat: 0, location: 2, abonnements: 5, maintenance: 7}, retenue: {achat: 9, location: 10, abonnements: 11, maintenance: 12}};
// « Le comparatif » : numéros des zones dans l'ordre du code, Green Cube d'abord (six lignes nom + prix, le total, l'économie),
// puis aujourd'hui. Sur la page, depuis le 12/11/2026 (demande d'Ilian), aujourd'hui est à gauche et Green Cube à droite, sur le noir :
// seules les positions ont changé dans la source, pas cet ordre, pour que les propals enregistrées restent justes.
const COMP = {gc: [0, 2, 4, 6, 8, 10], gcTotal: 12, eco: 13, pourcent: 14, ecoTotal: 15, ans: 16, auj: [17, 19, 21, 23, 25, 27], aujTotal: 29};
// Les notes des modules citent des pages qui ne sont pas dans la propal courte.
const noteCourte = t => t
  .replace(/les pages communes \(?4\.2\)? Votre maintenance(?:, \(?4\.3\)? En cas de panne)? et \(?5\.1\)? Notre offre/, 'le contrat de maintenance et « Notre offre »')
  .replace(/, et reporter le même nombre en \(?4\.2\)? Votre maintenance/, '')
  .replace(/les pages communes \(?4\.2\)? et \(?4\.3\)?/, 'le détail de la maintenance (pages communes de la propal longue, dossier 04)')
  .replace(/la page commune \(?5\.2\)? Le comparatif/, 'la page « Le comparatif »')
  .replace(/la partie \(05\) Notre offre/, '« Notre offre »')
  .replace(/\(?5\.1\)? Notre offre/, '« Notre offre »');
const DATES = new Set(['date', 'validite']);

MODULES.forEach(m => {
  m.parties = [];
  m.slides.forEach(s => {
    const r = s.nom.match(/^\((3\.\d)\)\s*(.*)$/);
    if (r && /\b(inter|cit)\b/.test(s.classes) && !m.parties.find(p => p.id === r[1]))
      m.parties.push({id: r[1], titre: r[2], maintenance: /maintenance/i.test(r[2]), materiel: /matériel/i.test(r[2])});
  });
});

let S = null;                      // la propal ouverte
let AUTO = new Map(), AUTOCB = new Map(), CHIFFRES = {};
let alerteStockage = false;
const PAGES = [];
const AJOUTS = [];                // les cases « Ajouter cette solution » de fin de partie
const page = nom => PAGES.find(p => p.src === GEN && p.nom === nom);

const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function nouvelle() {
  const auj = new Date(), fin = new Date(); fin.setDate(fin.getDate() + 30);
  const now = new Date().toISOString();
  return {
    format: 'propal-green-cube', version: 1,
    id: nouvelId(), cree: now, modifie: now,
    infos: {client: '', projet: '', reference: '', date: isoDate(auj), validite: isoDate(fin), commercial: '', fonction: '', tel: '', email: ''},
    modules: Object.fromEntries(MODULES.map(m => [m.cle, {on: false, parties: {}}])),
    maintenance: '', retirees: {}, valeurs: {}, cases: {}, images: {}, ajouts: {}, fiches: {},
    bundle: {on: false, items: {}, autres: []},    // items : produit → quantité ; autres : matériel hors fiches, sans photo
    ordre: null,                                    // l'ordre des pages quand le commercial en a déplacé
  };
}
function normaliser(p) {
  const n = nouvelle();
  const o = Object.assign(n, p || {});
  o.infos = Object.assign(nouvelle().infos, (p && p.infos) || {});
  o.modules = Object.assign(nouvelle().modules, (p && p.modules) || {});
  for (const k of ['retirees', 'valeurs', 'cases', 'images', 'ajouts', 'fiches']) if (!o[k] || typeof o[k] !== 'object') o[k] = {};
  o.bundle = nettoyerBundle(p && p.bundle);
  o.ordre = Array.isArray(o.ordre) ? o.ordre.filter(k => typeof k === 'string') : null;
  return o;
}
// Un bundle lu dans une propal, dans le navigateur ou dans un fichier : seuls les produits connus et des quantités de 1 à 999.
const qteOk = q => Math.min(999, Math.max(1, Math.round(parseFloat(q)) || 1));
function nettoyerBundle(x) {
  x = x && typeof x === 'object' ? x : {};
  const items = {};
  for (const [k, q] of Object.entries(x.items && typeof x.items === 'object' ? x.items : {})) if (PRODUITS.has(k)) items[k] = qteOk(q);
  const autres = (Array.isArray(x.autres) ? x.autres : []).filter(a => a && String(a.nom || '').trim()).slice(0, MAX_AUTRES)
    .map(a => ({id: String(a.id || nouvelId()), nom: String(a.nom).trim().slice(0, 32), sert: String(a.sert || '').trim().slice(0, 130), qte: qteOk(a.qte)}));
  return {on: !!x.on, items, autres};
}

/* ---------- construction des slides ---------- */
function construire() {
  const ordre = [
    ...GEN.slides.slice(0, COUPURE).map(s => [GEN, s]),
    ...MODULES.flatMap(m => m.slides.map(s => [m, s])),
    // Les pages « Matériel proposé » sont dessinées par rendreBundle() selon le matériel choisi.
    ...Array.from({length: NB_PAGES_BUNDLE}, (x, i) => [BUNDLE, {nom: i ? 'Matériel proposé (suite)' : 'Matériel proposé', classes: 'slide', data: {}, html: ''}]),
    ...(FICHES ? FICHES.slides.map(s => [FICHES, s]) : []),
    ...GEN.slides.slice(COUPURE).map(s => [GEN, s]),
  ];
  const vus = new Set(), planches = $('#planches');
  for (const [src, s] of ordre) {
    let cle = src.cle + '|' + s.nom;
    while (vus.has(cle)) cle += '+';
    vus.add(cle);
    const art = document.createElement('article');
    art.className = 'page';
    art.dataset.cle = cle;
    art.dataset.src = src.cle;                 // les styles propres à la source ne valent que sous cette page (outils/assembler.js)
    // Les attributs data-* de la slide source (data-liste, data-dos…) : des règles de style s'y accrochent.
    const attrs = Object.entries(s.data || {}).map(([k, v]) => ` data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${esc(v)}"`).join('');
    art.innerHTML = `<div class="page-tete"><span class="page-no"></span><span class="page-nom"></span><span class="page-partie"></span><span class="page-marque">Ajoutée</span>`
      + `<span class="page-deplacer"><button type="button" class="btn-page" data-deplacer="-1">Monter</button><button type="button" class="btn-page" data-deplacer="1">Descendre</button></span>`
      + `<label class="page-garder"><input type="checkbox" checked> Dans le PDF</label></div>`
      + `<div class="cadre-slide"><section class="${esc(s.classes)}"${attrs}>${s.html.replace(/<img\b/g, '<img loading="lazy" decoding="async"')}</section></div>`
      + (s.note ? `<details class="page-note"><summary>Note pour le commercial</summary><p>${esc(noteCourte(s.note))}</p></details>` : '');
    const el = art.querySelector('section.slide');
    const P = {cle, src, s, nom: s.nom, el, page: art, unites: new Map(), textes: []};
    art._P = P;
    if (src === FICHES) P.produit = s.data.produit || null;
    if (src === BUNDLE) { P.bundle = PAGES.filter(x => x.src === BUNDLE).length; el._page = P; }
    if (src.type === 'module') {
      const r = s.nom.match(/^\((3\.\d)\)/);
      P.partie = r ? r[1] : null;
      const pt = src.parties.find(p => p.id === P.partie);
      if (pt && pt.materiel) {
        const sans = s.nom.replace(/^\(3\.\d\)\s*/, '');
        for (const [re, id] of LIENS_MATERIEL[src.cle] || []) if (re.test(sans)) { P.materielDe = id; break; }
      }
    }
    el.querySelectorAll('[data-u]').forEach(u => {
      P.unites.set(+u.dataset.u, u);
      u._page = P;
      u._cle = cle + '|' + u.dataset.u;
      if (u.classList.contains('champ')) {
        u._ph = u.innerHTML;
        u._phTexte = u.textContent.trim();
        u.contentEditable = 'plaintext-only';
        u.setAttribute('role', 'textbox');
        u.setAttribute('aria-label', u._phTexte.replace(/^\[|\]$/g, ''));
      } else if (u.classList.contains('cb')) {
        u.setAttribute('role', 'checkbox');
        u.tabIndex = 0;
      } else if (u.hasAttribute('data-image')) {
        u._ph = u.innerHTML;
        u.setAttribute('role', 'button');
        u.setAttribute('aria-label', 'Ajouter une image : ' + u.dataset.image);
        u.tabIndex = 0;
      }
    });
    // Les textes qui contiennent un numéro de partie. « nu » : un numéro seul (« 03 », « 3.1 ») dans un numéro en contour,
    // une étiquette ou la liste « Dans cette partie ».
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode;
      if (!/\d/.test(n.nodeValue) || n.parentElement.closest('.champ, [data-image]')) continue;
      if (P.produit && n.parentElement.classList.contains('sn')) { P.snFiche = n; continue; }
      P.textes.push({n, orig: n.nodeValue, lab: !!n.parentElement.closest('.lab, .no, .dans .l b')});
    }
    planches.append(art);
    PAGES.push(P);
  }
  // En fin de partie (alarme, vidéoprotection, infogérance…), une case pour ajouter la solution au comparatif. Elle ne sort pas dans le PDF.
  for (const m of MODULES) for (const pt of m.parties) {
    if (pt.maintenance || pt.materiel) continue;
    const pages = PAGES.filter(P => P.src === m && P.partie === pt.id);
    if (!pages.length) continue;
    const cle = m.cle + '|' + pt.id, el = document.createElement('aside');
    el.className = 'ajout';
    el.dataset.ajout = cle;
    el.innerHTML = `<label class="ajout-choix"><input type="checkbox" data-ajout-on><span><b>Ajouter cette solution au comparatif</b>`
      + `<span class="ajout-fin">Fin de la partie « ${esc(pt.titre)} »</span></span></label>`
      + `<label class="ajout-champ"><span>Nom dans le comparatif</span><input type="text" data-ajout-nom maxlength="34" placeholder="${esc(pt.titre)}" autocomplete="off"></label>`
      + `<label class="ajout-champ ajout-prix"><span>€ HT par mois</span><input type="text" data-ajout-prix inputmode="decimal" maxlength="12" placeholder="Inclus" autocomplete="off"></label>`;
    pages[pages.length - 1].page.after(el);
    AJOUTS.push({m, pt, cle, el});
  }
  PAGES.filter(P => P.src.type === 'module').forEach(P => {
    const pt = P.src.parties.find(p => p.id === P.partie);
    const intro = P.src.slides[0] === P.s;
    if (intro || (pt && pt.materiel && /\b(inter|cit)\b/.test(P.s.classes))) preparerListe(P);
  });
}

// Liste « Dans cette partie » d'un intercalaire : les lignes des parties retirées disparaissent, les autres se resserrent.
// Dans l'ouverture d'une solution, la liste tient sur deux colonnes, lues de haut en bas (3.1 à 3.4, puis 3.5…).
function preparerListe(P) {
  const dans = $('.dans', P.el);
  if (!dans) return;
  const lignes = $$('.l', dans).map(e => {
    const b = e.querySelector('b'), no = b ? b.textContent.trim() : '';
    return {e, id: /^3\.\d$/.test(no) ? no : null, txt: e.textContent};
  });
  if (lignes.length < 2) return;
  const cols = dans.style.gridTemplateColumns ? dans.style.gridTemplateColumns.trim().split(/\s+/).length : 2;
  P.liste = {lignes, cols};
}

/* ---------- ce qui est affiché ---------- */
const etatModule = m => S.modules[m.cle] || (S.modules[m.cle] = {on: false, parties: {}});
function partieVisible(m, pt) {
  const st = etatModule(m);
  return !!st.on && st.parties[pt.id] !== false && !(pt.maintenance && S.maintenance === 'non');
}
const fichesCochees = () => (FICHES ? FICHES.slides : []).filter(s => s.data.produit && S.fiches[s.data.produit]);
const estPageSolution = P => P.src === GEN && P.nom === NOM_SOLUTION;
// La page « Notre solution » se remplit à la main. Une solution ou une fiche cochée prend sa place, sauf si elle a déjà été remplie.
function pageSolutionAffichee() {
  if (!MODULES.some(m => etatModule(m).on) && !fichesCochees().length && !S.bundle.on) return true;
  return [...page(NOM_SOLUTION).unites.values()].some(u => Object.prototype.hasOwnProperty.call(S.valeurs, u._cle) || S.images[u._cle]);
}
function pageVisible(P) {
  if (estPageSolution(P)) return pageSolutionAffichee();
  if (P.src === FICHES) return !!P.produit && !!S.fiches[P.produit];     // pas de page d'ouverture : la propal reste courte
  if (P.src === BUNDLE) return S.bundle.on && P.bundle < pagesBundle(elementsBundle().length);
  if (P.src.type !== 'module') return true;
  const m = P.src;
  if (!etatModule(m).on) return false;
  for (const id of [P.partie, P.materielDe]) {
    const pt = id && m.parties.find(p => p.id === id);
    if (pt && !partieVisible(m, pt)) return false;
  }
  return true;
}
// Ce qui prend un numéro de partie : chaque page de la propal courte sauf la couverture, chaque solution, le matériel proposé, chaque fiche.
const PARTIES_GEN = {'(01) Votre situation': 'situation', [NOM_SOLUTION]: 'solution', [NOM_OFFRE]: 'offre', [NOM_COMPARATIF]: 'comparatif'};
function partieNumerotee(P) {
  if (P.src === GEN) return PARTIES_GEN[P.nom] || null;
  if (P.src === FICHES) return P.produit ? 'fiche:' + P.produit : null;
  if (P.src === BUNDLE) return 'bundle';
  return P.src.type === 'module' ? P.src.cle : null;
}
// Les numéros suivent l'ordre des pages, déplacées ou non : (01) pour la première partie, et ainsi de suite.
// Une partie dont toutes les pages sont retirées du PDF ne prend pas de numéro.
function numeros(L) {
  const N = {no: {}};
  let n = 0;
  for (const P of L) {
    if (!P.visible || S.retirees[P.cle]) continue;
    const k = partieNumerotee(P);
    if (k && !(k in N.no)) N.no[k] = ++n;
  }
  N.offre = N.no.offre;
  MODULES.forEach(m => {
    if (!N.no[m.cle]) return;
    const sub = {};
    let j = 0;
    for (const P of L) if (P.src === m && P.visible && P.partie && !(P.partie in sub)) sub[P.partie] = `${N.no[m.cle]}.${++j}`;
    N[m.cle] = {P: N.no[m.cle], sub};
  });
  return N;
}
// Renumérotation des titres et des renvois écrits dans les pages.
function renum(src, t, N, lab) {
  if (src === GEN) {
    if (!N.no.solution) t = t.replace(/\s*Le détail du matériel[^.]*\./, '');
    const cles = ['situation', 'solution', 'offre', 'comparatif'];
    // Le numéro en contour d'une page (« 01 ») suit le numéro de sa partie.
    if (lab && /^\s*0[1-4]\s*$/.test(t)) return t.replace(/0([1-4])/, (x, a) => { const k = N.no[cles[a - 1]]; return k ? pad(k) : x; });
    return t.replace(/\(0([1-4])\)/g, (x, a) => { const k = N.no[cles[a - 1]]; return k ? `(${pad(k)})` : x; });
  }
  if (src.type !== 'module') return t;
  const n = N[src.cle];
  if (!n) return t;
  if (lab && /^\s*03\s*$/.test(t)) return t.replace('03', pad(n.P));
  if (lab && /^\s*3\.[1-9]\s*$/.test(t)) return t.replace(/3\.[1-9]/, x => n.sub[x] || x);
  const offre = N.offre ? `(${pad(N.offre)}) Notre offre` : '« Notre offre »';
  // Les renvois ensuite, pour qu'un numéro déjà changé ne le soit pas une seconde fois. « Notre offre » garde son numéro ;
  // le détail de la maintenance n'est pas dans la propal courte : le renvoi va au contrat.
  return t.replace(/\((03)\)|\((3\.[1-9])\)|((?:voir|en)\s)(3\.[1-9])\b/g, (x, a, b, v, c) => {
    if (a) return `(${pad(n.P)})`;
    if (b) return n.sub[b] ? `(${n.sub[b]})` : x;
    return n.sub[c] ? v + n.sub[c] : x;
  })
    // (les modules en nouvelle charte écrivent « en 4.2 Votre maintenance », sans parenthèses)
    .replace(/visites par an figure en \(?4\.2\)? Votre maintenance/, `visites par an figure en ${offre}`)
    .replace(/en \(?4\.2\)? Votre maintenance\s*;\s*les horaires, en \(?4\.3\)? En cas de panne/, 'dans votre contrat de maintenance, comme les horaires')
    .replace(/en \(?4\.[23]\)? (?:Votre maintenance|En cas de panne)/, 'dans votre contrat de maintenance')
    .replace(/\((?:05|5\.1)\) Notre offre|\b(?:5\.1|05) Notre offre/, offre);
}

/* ---------- ordre des pages ---------- */
// L'ordre des sources, sauf si le commercial a déplacé des pages : S.ordre garde alors la liste de toutes les pages,
// cachées comprises, pour qu'une page qui arrive en cochant une case prenne sa place habituelle.
function ordre() {
  if (!S || !S.ordre) return PAGES;
  const parCle = new Map(PAGES.map(P => [P.cle, P])), L = [], vus = new Set();
  for (const k of S.ordre) { const P = parCle.get(k); if (P && !vus.has(P)) { vus.add(P); L.push(P); } }
  // Une page absente de l'ordre gardé (une page source ajoutée depuis) se place après celle qui la précède d'habitude.
  PAGES.forEach((P, i) => { if (!vus.has(P)) { vus.add(P); L.splice(i ? L.indexOf(PAGES[i - 1]) + 1 : 0, 0, P); } });
  return coller(L);
}
// Les pages « Matériel proposé (suite) » restent collées à la première : elles bougent en bloc.
function coller(L) {
  const suites = L.filter(P => P.src === BUNDLE && P.bundle);
  if (!suites.length) return L;
  const R = L.filter(P => !(P.src === BUNDLE && P.bundle));
  R.splice(R.findIndex(P => P.src === BUNDLE) + 1, 0, ...suites.sort((a, b) => a.bundle - b.bundle));
  return R;
}
const blocDe = (P, vis) => P.src === BUNDLE ? vis.filter(x => x.src === BUNDLE) : [P];
function deplacer(P, cible, apres) {
  if (P && P.src === BUNDLE) P = PAGES.find(x => x.src === BUNDLE);
  if (cible && cible.src === BUNDLE && !apres) cible = PAGES.find(x => x.src === BUNDLE);
  if (!P || !cible || P === cible) return;
  const L = ordre().filter(x => x !== P);
  L.splice(L.indexOf(cible) + (apres ? 1 : 0), 0, P);
  const R = coller(L);
  S.ordre = R.every((x, i) => x === PAGES[i]) ? null : R.map(x => x.cle);
}
// Les pages suivent l'ordre à l'écran ; le bandeau « Ajouter cette solution » suit la dernière page de sa partie.
function rangerPages(L) {
  const planches = $('#planches'), actuel = $$('#planches > .page');
  if (!L.every((P, i) => actuel[i] === P.page)) L.forEach(P => planches.append(P.page));
  for (const a of AJOUTS) {
    const ps = L.filter(P => P.src === a.m && P.partie === a.pt.id), der = ps[ps.length - 1];
    if (der && der.page.nextElementSibling !== a.el) der.page.after(a.el);
  }
}
const annoncerPlace = P => message(P.no ? `« ${sansNumero(P.nomAffiche)} » est maintenant la page ${P.no}.` : `« ${sansNumero(P.nomAffiche)} » a été déplacée. Elle reste retirée du PDF.`, false, 3500);
// « Monter » et « Descendre » : la page passe avant ou après la page affichée voisine.
function decaler(P, sens, depuisPanneau) {
  if (!P) return;
  const vis = ordre().filter(x => x.visible), bloc = blocDe(P, vis);
  const cible = sens < 0 ? vis[vis.indexOf(bloc[0]) - 1] : vis[vis.indexOf(bloc[bloc.length - 1]) + 1];
  if (!cible) return;
  deplacer(P, cible, sens > 0);
  changer();
  annoncerPlace(P);
  P.page.scrollIntoView({block: 'start'});
  const b = depuisPanneau ? $(`#p-pages [data-deplacer-cle="${CSS.escape(P.cle)}"][data-sens="${sens}"]`) : P.page.querySelector(`[data-deplacer="${sens}"]`);
  const autre = depuisPanneau ? $(`#p-pages [data-deplacer-cle="${CSS.escape(P.cle)}"][data-sens="${-sens}"]`) : P.page.querySelector(`[data-deplacer="${-sens}"]`);
  const f = b && !b.disabled ? b : autre;
  if (f) f.focus({preventScroll: true});
}

/* ---------- page « Matériel proposé » (bundle) ---------- */
// Ce que la page reprend d'une fiche : nom, marque, modèle, à quoi il sert et la photo. La marque et le modèle à confirmer
// sont des zones de la fiche : on prend ce que le commercial y a tapé.
function infoFiche(P) {
  if (!P.info) {
    // Fiche en nouvelle charte : la marque et la référence sous le nom (.ref), « À quoi il sert » en chapô, la photo dans son cadre
    // (un produit sans photo a un grand picto, dans un cadre .picto, ou une zone d'image : la page met alors le picto de colis).
    const img = $('.cadre img', P.el);
    P.info = {marque: $('.ref .lab', P.el), modele: $('.ref .txt', P.el), sert: $('.chapo', P.el),
      photo: img ? {src: img.getAttribute('src'), boite: img.dataset.boite || '', alt: img.alt, contenir: !!img.closest('.picto')} : null};
  }
  const lire = e => { if (!e) return ''; const u = uniteDe(e); return (u ? texte(u) : e.textContent).replace(/\s+/g, ' ').trim(); };
  return {nom: P.s.data.nom || sansNumero(P.nom), marque: lire(P.info.marque), modele: lire(P.info.modele), sert: lire(P.info.sert), photo: P.info.photo};
}
// Le matériel choisi : les produits dans l'ordre du catalogue, puis le matériel ajouté à la main (sans photo).
function elementsBundle() {
  const b = S.bundle, L = [];
  for (const P of PAGES) if (P.produit && b.items[P.produit]) L.push(Object.assign({cle: P.produit, qte: b.items[P.produit]}, infoFiche(P)));
  for (const a of b.autres) L.push({cle: 'autre:' + a.id, nom: a.nom, sert: a.sert, marque: '', modele: '', photo: null, qte: a.qte});
  return L;
}
const pagesBundle = n => Math.max(1, Math.ceil(n / PAR_PAGE));
const nomProduit = k => { const P = PAGES.find(x => x.produit === k); return P ? P.s.data.nom || sansNumero(P.nom) : k; };
// La zone du contenu, sous le titre et au-dessus du bas de page, alignée sur les autres pages de la nouvelle charte
// (titre en haut à gauche, texte vertical sur le bord gauche, numéro de page dans le carré citron en bas à droite).
const BX = 96, BW = 1088, BY = 200, BB = 640;
// Le texte « À quoi il sert » doit tenir dans sa carte ou sa ligne. Mesuré avec la police des slides, il garde au besoin
// sa première partie entière, jusqu'à une virgule ou « : » ; sinon il se coupe au dernier mot qui tient, avec « … ».
const REGLE = document.createElement('canvas').getContext('2d');
const PT = '13.5px Montserrat', SERT_C = '12px Montserrat';           // .pt et .mp-sert-c
function nbLignes(t, larg, police) {
  if (!document.fonts.check(police)) return Math.ceil(t.length * parseFloat(police) * 0.62 / larg);   // police pas encore chargée : estimation prudente
  REGLE.font = police;
  let n = 1, l = '';
  for (const m of t.split(/\s+/)) {
    const e = l ? l + ' ' + m : m;
    if (l && REGLE.measureText(e).width > larg) { n++; l = m; } else l = e;
  }
  return n;
}
function ajuste(t, larg, lignes, police) {
  if (!t || nbLignes(t, larg, police) <= lignes) return t;
  for (const m of [...t.matchAll(/\s*[:;,]\s/g)].reverse()) {
    const c = t.slice(0, m.index) + '.';
    if (m.index >= 20 && nbLignes(c, larg, police) <= lignes) return c;
  }
  let r = '';
  for (const w of t.split(/\s+/)) { if (nbLignes((r ? r + ' ' : '') + w + ' …', larg, police) > lignes) break; r = (r ? r + ' ' : '') + w; }
  return r.replace(/[\s,;:]+$/, '') + '…';
}
// La photo du produit, dans un cadre blanc comme sur les fiches ; sans photo, le picto de colis sur l'aplat citron.
// bord : le filet et la marge blanche du cadre (tableau et liste compacte), retirés de la place laissée à la photo.
function photoBundle(it, w, h, bord = 0) {
  const st = `width:${w}px;height:${h}px`, p = it.photo;
  if (!p) { const c = Math.round(Math.min(w, h) * 0.42); return `<div class="mp-sans" style="${st}"><img src="${PICTO_COLIS}" alt="" style="width:${c}px;height:${c}px"></div>`; }
  if (p.contenir) return `<div class="mp-cadre" style="${st}"><img class="mp-photo contenir" src="${esc(p.src)}" alt="${esc(p.alt)}"></div>`;
  return `<div class="mp-cadre" style="${st}"><div class="mp-vue"><img class="mp-photo" src="${esc(p.src)}" alt="${esc(p.alt)}" data-boite="${esc(p.boite)}" data-cadre="${w - bord} ${h - bord}"></div></div>`;
}
// Le cadrage d'une photo de cette page (04/11/2026, Ilian : « il faut que les images soient bien centrés afin que le produit
// soit au centre de l'image et qu'on le voit en entier »). data-boite donne la place du produit dans la photo, en % (gauche,
// haut, droite, bas), relevée dans produits.js des fiches ; sans elle, la photo entière compte comme le produit.
// La photo est agrandie autant que possible sans couper le produit (avec une marge), et le produit va au centre du cadre.
// Quand la photo ne peut pas remplir le cadre sans décentrer le produit de plus de 10 %, la partie visible se resserre
// autour de lui, au milieu du cadre blanc. Ni position absolue ni object-fit : le PDF dessine l'image à sa place réelle
// et la coupe au bord de .mp-vue, comme l'écran.
function cadrerPhoto(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) { if (!img.complete) img.addEventListener('load', () => cadrerPhoto(img), {once: true}); return; }
  const [fw, fh] = img.dataset.cadre.split(' ').map(Number);
  const b = (img.dataset.boite || '').trim().split(/\s+/).map(Number);
  const ok = b.length === 4 && b.every(v => v >= 0 && v <= 100) && b[2] > b[0] && b[3] > b[1];
  const [x0, y0, x1, y1] = ok ? b.map(v => v / 100) : [0, 0, 1, 1];
  const marge = !ok ? 1 : Math.min(fw, fh) < 80 ? 1.1 : 1.16;
  const s = Math.min(fw / ((x1 - x0) * nw * marge), fh / ((y1 - y0) * nh * marge), 1.5);
  // Sur un axe : f la place, L la photo affichée, c le centre du produit et t sa taille (affichés). Rend [partie visible, décalage].
  const axe = (f, L, c, t) => {
    const v = Math.min(f, L), o = Math.min(0, Math.max(v - L, v / 2 - c));
    if (Math.abs(o + c - v / 2) <= 0.1 * v && o + c - t / 2 >= -0.5 && o + c + t / 2 <= v + 0.5) return [v, o];
    const w = Math.min(f, 2 * Math.min(c, L - c));
    return [w, w / 2 - c];
  };
  const [vw, ox] = axe(fw, nw * s, (x0 + x1) / 2 * nw * s, (x1 - x0) * nw * s);
  const [vh, oy] = axe(fh, nh * s, (y0 + y1) / 2 * nh * s, (y1 - y0) * nh * s);
  const px = v => Math.round(v * 100) / 100 + 'px';
  img.parentElement.style.cssText = `width:${px(vw)};height:${px(vh)}`;
  img.style.cssText = `width:${px(nw * s)};height:${px(nh * s)};margin:${px(oy)} 0 0 ${px(ox)}`;
  img.classList.add('cadree');
}
const qteBundle = (q, taille) => `<div class="mp-qte"><span class="lab">Quantité</span><span class="T4 ol" style="font-size:${taille}px">${q}</span></div>`;
const marqueBundle = (it, cl = '') => it.marque ? `<div class="lab${cl}">${esc(it.marque)}</div>` : '';
// 1 à 3 produits : des cartes, photo en haut (une seule carte : photo à gauche).
function cartesBundle(items) {
  const n = items.length, h = BB - BY;
  if (n === 1) {
    const it = items[0];
    return `<div class="ab mp-carte seule" style="left:${BX}px;top:${BY}px;width:${BW}px;height:${h}px">${photoBundle(it, 500, h - 18)}`
      + `<div class="mp-corps">${marqueBundle(it)}<div class="T4">${esc(it.nom)}</div>${it.modele ? `<div class="txt mp-modele">${esc(it.modele)}</div>` : ''}`
      + (it.sert ? `<div class="lab mp-quoi">À quoi il sert</div><div class="txt">${esc(it.sert)}</div>` : '') + qteBundle(it.qte, 72) + '</div></div>';
  }
  // Une carte sans marque ou sans modèle garde leurs lignes, pour que les noms restent alignés d'une carte à l'autre.
  const gap = 24, w = Math.floor((BW - gap * (n - 1)) / n), hPhoto = n === 2 ? 210 : 150;
  const marques = items.some(it => it.marque), modeles = items.some(it => it.modele);
  return items.map((it, i) => `<div class="ab mp-carte" style="left:${BX + i * (w + gap)}px;top:${BY}px;width:${w}px;height:${h}px">${photoBundle(it, w - 18, hPhoto)}`
    + `<div class="mp-corps">${marqueBundle(it) || (marques ? '<div class="lab">&nbsp;</div>' : '')}<div class="T4" style="font-size:${n === 2 ? 32 : 26}px">${esc(it.nom)}</div>`
    + (it.modele || modeles ? `<div class="txt mp-modele">${it.modele ? esc(it.modele) : '&nbsp;'}</div>` : '')
    + (it.sert ? `<div class="pt mp-sert">${esc(ajuste(it.sert, w - 50, n === 2 ? 5 : 3, PT))}</div>` : '') + qteBundle(it.qte, 52) + '</div></div>').join('');
}
// 4 à 6 produits : un tableau, une ligne par produit.
function listeBundle(items) {
  const n = items.length, y = BY + 34;
  const h = Math.min(100, Math.floor((BB - y) / n)), ph = h - 14, pw = Math.min(124, Math.round(ph * 1.4)), cols = `${pw}px 300px minmax(0,1fr) 110px`;
  return `<div class="ab mp-tete" style="left:${BX}px;top:${BY}px;width:${BW}px;grid-template-columns:${cols}"><span class="lab" style="grid-column:span 2">Matériel</span><span class="lab">À quoi il sert</span><span class="lab mp-droite">Quantité</span></div>`
    + items.map((it, i) => `<div class="ab mp-ligne" style="left:${BX}px;top:${y + i * h}px;width:${BW}px;height:${h}px;grid-template-columns:${cols}">${photoBundle(it, pw, ph, 10)}`
      + `<div class="mp-nom">${marqueBundle(it)}<div class="T5">${esc(it.nom)}</div>${it.modele && h >= 84 ? `<div class="pt mp-modele">${esc(it.modele)}</div>` : ''}</div>`
      + `<div class="pt">${esc(ajuste(it.sert, BW - pw - 300 - 110 - 72, Math.floor((h - 6) / 19.6), PT))}</div><div class="T4 ol mp-droite" style="font-size:44px">${it.qte}</div></div>`).join('');
}
// 7 à 10 produits par page : deux colonnes de cinq lignes au plus.
function compactBundle(items) {
  const gauche = Math.ceil(items.length / 2), colW = (BW - 40) / 2, cols = '64px minmax(0,1fr) 64px', y = BY + 30, h = Math.floor((BB - y) / 5);
  return [items.slice(0, gauche), items.slice(gauche)].map((part, c) => {
    if (!part.length) return '';
    const x = BX + c * (colW + 40);
    return `<div class="ab mp-tete c" style="left:${x}px;top:${BY}px;width:${colW}px;grid-template-columns:${cols}"><span class="lab" style="grid-column:span 2">Matériel</span><span class="lab mp-droite">Quantité</span></div>`
      + part.map((it, i) => `<div class="ab mp-ligne c" style="left:${x}px;top:${y + i * h}px;width:${colW}px;height:${h}px;grid-template-columns:${cols}">${photoBundle(it, 64, Math.min(64, h - 14), 10)}`
        + `<div class="mp-nom">${marqueBundle(it, ' mp-marque-c')}<div class="mp-nom-c">${esc(it.nom)}</div>${it.sert ? `<div class="mp-sert-c">${esc(ajuste(it.sert, colW - 160, 2, SERT_C))}</div>` : ''}</div>`
        + `<div class="T4 ol mp-droite" style="font-size:34px">${it.qte}</div></div>`).join('');
  }).join('');
}
// La page se redessine seulement quand son contenu change. Le matériel se répartit à parts égales entre les pages.
function rendreBundle(P, N) {
  const tous = elementsBundle(), nb = pagesBundle(tous.length), par = Math.ceil(tous.length / nb);
  const items = tous.slice(P.bundle * par, (P.bundle + 1) * par);
  const no = N.no.bundle ? `<span class="no t">${pad(N.no.bundle)}</span>` : '';
  const sig = JSON.stringify([no, items]);
  if (P.sig === sig) return;
  P.sig = sig;
  let h = `<div class="tete">${no}<span class="T3 t">Matériel <span class="ol">proposé</span>${P.bundle ? ' <span class="ol">(suite)</span>' : ''}</span></div>`
    + (P.bundle ? '' : `<div class="ab chapo t" style="left:96px;top:146px;width:700px">Le matériel prévu pour votre installation, avec les quantités.</div>`);
  if (!items.length) h += `<div class="ab ecran-seul mp-vide" style="left:${BX}px;top:${BY}px;width:${BW}px;height:${BB - BY}px"><div><b>Aucun matériel choisi pour l’instant.</b><br>Cochez les produits dans le panneau de gauche, bloc 5 « Le matériel proposé ». La page s’adapte au nombre de produits. Ce cadre ne sort pas dans le PDF.</div></div>`;
  else if (items.length <= 3) h += cartesBundle(items);
  else if (items.length <= 6) h += listeBundle(items);
  else h += compactBundle(items);
  P.el.innerHTML = h + '<div class="dos t"><span>Proposition commerciale</span><i></i><span class="b">Matériel proposé</span></div><div class="num t"></div>';
  $$('.mp-photo[data-cadre]', P.el).forEach(cadrerPhoto);
}
// Les bundles enregistrés dans ce navigateur, proposés dans toutes les propals.
function lireBundles() {
  const L = STOCK.lire(K_BUNDLES);
  return (Array.isArray(L) ? L : []).filter(b => b && String(b.nom || '').trim() && b.id)
    .map(b => Object.assign(nettoyerBundle(b), {id: String(b.id), nom: String(b.nom).trim().slice(0, 40), modifie: String(b.modifie || '')}));
}
const ecrireBundles = L => STOCK.ecrire(K_BUNDLES, L.map(b => ({id: b.id, nom: b.nom, items: b.items, autres: b.autres, modifie: b.modifie})));
let bundleVersion = 0;                 // change quand le matériel est remplacé d'un coup : le panneau se reconstruit
function ajouterBundle(b) {
  const liste = lireBundles(), deja = liste.find(x => x.nom.toLowerCase() === b.nom.toLowerCase());
  if (deja && !confirm(`Le bundle « ${deja.nom} » existe déjà. Le remplacer ?`)) return false;
  const nouveau = {id: deja ? deja.id : nouvelId(), nom: b.nom, items: Object.assign({}, b.items), autres: b.autres.map(a => Object.assign({}, a)), modifie: new Date().toISOString()};
  if (!ecrireBundles([nouveau, ...liste.filter(x => x !== deja)])) { message('Le navigateur n’a plus de place pour garder ce bundle.', true); return false; }
  return true;
}
function enregistrerBundle() {
  const champ = $('#p-bundle [data-bundle-nom]'), nom = champ.value.trim().slice(0, 40);
  if (!elementsBundle().length) { message('Choisissez d’abord le matériel du bundle.', true); return; }
  if (!nom) { message('Donnez un nom au bundle, par exemple « Bureau de 10 postes ».', true); champ.focus(); return; }
  if (!ajouterBundle({nom, items: S.bundle.items, autres: S.bundle.autres})) return;
  champ.value = '';
  bundleVersion++;
  majPanneau();
  message(`Bundle « ${nom} » enregistré : il sera proposé dans vos prochaines propals.`, false, 5000);
}
function chargerBundle(b) {
  if (elementsBundle().length && !confirm(`Remplacer le matériel déjà choisi par le bundle « ${b.nom} » ?`)) return;
  const avant = new Set(PAGES.filter(P => P.visible).map(P => P.cle));
  S.bundle = {on: true, items: Object.assign({}, b.items), autres: b.autres.map(a => Object.assign({}, a))};
  bundleVersion++;
  changer();
  signaler(avant, `Bundle « ${b.nom} »`);
}
function exporterBundle(b) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({format: 'bundle-green-cube', version: 1, nom: b.nom, items: b.items, autres: b.autres, modifie: b.modifie})], {type: 'application/json'}));
  a.download = `Bundle - ${b.nom}.json`.replace(/[\\/:*?"<>|]/g, '-');
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function ajouterAutre() {
  const z = $('#p-bundle'), champ = k => $(`[data-autre-champ="${k}"]`, z);
  const nom = champ('nom').value.trim();
  if (!nom) { message('Donnez un nom au matériel.', true); champ('nom').focus(); return; }
  if (S.bundle.autres.length >= MAX_AUTRES) { message(`${MAX_AUTRES} lignes au plus dans « Autre matériel ».`, true); return; }
  S.bundle.autres.push({id: nouvelId(), nom: nom.slice(0, 32), sert: champ('sert').value.trim().slice(0, 130), qte: qteOk(champ('qte').value)});
  champ('nom').value = ''; champ('sert').value = ''; champ('qte').value = '1';
  changer();
  $('#p-bundle [data-autre-champ="nom"]').focus();
  message(`« ${nom} » ajouté au matériel proposé.`);
}
// Un fichier de bundle reçu d'un collègue rejoint « Vos bundles ».
function importerBundle(p) {
  const b = nettoyerBundle(p), nom = String(p.nom || '').trim().slice(0, 40) || 'Bundle sans nom';
  if (!Object.keys(b.items).length && !b.autres.length) { message('Ce bundle ne contient aucun produit connu de ce site.', true); return; }
  if (!ajouterBundle({nom, items: b.items, autres: b.autres})) return;
  bundleVersion++;
  if ($('#vue-bibliotheque').classList.contains('active')) rendreBibliotheque(); else if (S) majPanneau();
  message(`Bundle « ${nom} » ajouté à vos bundles : choisissez-le dans le bloc 5 d’une propal.`, false, 6000);
}

/* ---------- valeurs des zones ---------- */
function infoDe(u) { const map = u._page.src === GEN && INFOS[u._page.nom]; return map ? map[+u.dataset.u] : null; }
function brut(u) {
  const k = infoDe(u);
  if (k) { const v = S.infos[k]; return v ? {t: DATES.has(k) ? dateFR(v) : v, src: 'info'} : null; }
  if (Object.prototype.hasOwnProperty.call(S.valeurs, u._cle)) return {t: S.valeurs[u._cle], src: 'saisie'};
  if (AUTO.has(u._cle)) return {t: AUTO.get(u._cle), src: 'auto'};
  return null;
}
const texte = u => (u && (brut(u) || {}).t) || '';
const coche = u => Object.prototype.hasOwnProperty.call(S.cases, u._cle) ? !!S.cases[u._cle] : !!AUTOCB.get(u._cle);
const uniteDe = e => e && (e.matches('[data-u]') ? e : e.querySelector('[data-u]'));
const estMateriel = P => { const d = P.s.data; return !!(d.liste || d.grille || d.tableau || d.services); };

// Les lignes cochées d'une page de matériel : nom, quantité, tarif. En nouvelle charte, chaque équipement est une ligne
// .rg (la case en premier, puis le nom, à quoi il sert, la quantité [data-champ="0"] et parfois le tarif) ; les services
// « Inclus dans l'offre » sont des cases suivies de leur libellé (.coche).
const sansRenvoi = t => t.replace(/\s*\(voir [^)]*\)/, '').replace(/\s+/g, ' ').trim();
function lignesMateriel(P) {
  const d = P.s.data, res = [], rangs = $$('.rg.it', P.el);
  const champ = (r, k) => r.querySelector(`[data-champ="${k}"]`);
  const val = e => e ? texte(uniteDe(e)) : '';
  if (d.grille === 'cameras') {
    const type = /dôme/i.test(P.nom) ? 'Caméra dôme' : /tube/i.test(P.nom) ? 'Caméra tube' : 'Caméra';
    for (const r of rangs) {
      const c = champ(r, 'Modèle');
      if (!c) continue;
      const modele = val(c), qte = val(champ(r, '0'));
      if (modele || nombre(qte)) res.push({nom: type + (modele ? ' ' + modele : ''), qte});
    }
    return res;
  }
  if (d.grille === 'nvr') {
    // Une colonne par modèle d'enregistreur : son nom est dans l'en-tête de la colonne (NVR 4, NVR 8…).
    const tetes = $$('.rg.tete-l > *', P.el);
    for (const r of rangs) [...r.children].forEach((col, j) => {
      const cb = col.matches('.op') && col.querySelector('.cb');
      if (!cb || !coche(cb)) return;
      const h = tetes[j] && (tetes[j].querySelector('.T5') || tetes[j]);
      res.push({nom: 'Enregistreur ' + (h ? h.textContent.trim() : ''), qte: val(champ(r, '0'))});
    });
    return res;
  }
  const titre = ($('.tete .T3', P.el) || {}).textContent || '';
  for (const cb of $$('.cb', P.el)) {
    if (!coche(cb)) continue;
    const r = cb.closest('.rg');
    if (!r) {                                            // un service coché, avec son libellé à côté
      const lib = cb.parentElement.matches('.coche') ? sansRenvoi(cb.parentElement.textContent) : '';
      if (lib) res.push({nom: lib, qte: ''});
      continue;
    }
    if (r.firstElementChild !== cb) continue;            // case d'une colonne (à garder, à remplacer…)
    const lab = $$('.txt', r).find(e => !e.dataset.champ && !e.querySelector('.champ'));
    const modele = champ(r, 'Modèle');
    const nom = (lab ? sansRenvoi(lab.textContent) : val(modele)) || titre.trim() || 'Équipement';
    const tarif = champ(r, 'Tarif');
    res.push({nom, qte: val(champ(r, '0')), prix: val(tarif)});
  }
  return res;
}
// Le nom du service à côté d'une case. En (01), la ligne contient aussi le prestataire et le prix : seul « .sit-nom » compte.
const libelleCase = cb => {
  const l = cb.parentElement;
  if (!l || !l.matches('.coche')) return '';
  return (l.querySelector('.sit-nom') || l).textContent.replace(/\s+/g, ' ').trim();
};

// Tous les calculs, dans l'ordre où ils dépendent les uns des autres.
function calculer() {
  AUTO = new Map(); AUTOCB = new Map(); CHIFFRES = {};
  const auto = (P, u, v) => { const el = P && P.unites.get(u); if (el && v != null && v !== '') AUTO.set(el._cle, String(v)); };
  const autoCb = (P, u, v) => { const el = P && P.unites.get(u); if (el) AUTOCB.set(el._cle, !!v); };
  const p01 = page('(01) Votre situation'), pOffre = page(NOM_OFFRE), pComp = page(NOM_COMPARATIF);

  // (01) Votre situation : chaque case cochée, avec son prestataire et son prix par mois. Les prestataires (sans doublon)
  // et le total remplissent « Vos prestataires actuels » et « Ce que vous payez aujourd'hui » ; on peut taper par-dessus.
  const lignes01 = [];
  if (p01) {
    const prests = [];
    let total = 0, chiffre = false;
    for (let k = 0; k < SIT01.nb; k++) {
      const cb = p01.unites.get(SIT01.cases + k);
      if (!cb || !coche(cb)) continue;
      const prest = texte(p01.unites.get(SIT01.prestataires + k)).replace(/\s+/g, ' ').trim();
      const prix = nombre(texte(p01.unites.get(SIT01.prix + k)));
      if (prest && !prests.some(p => p.toLowerCase() === prest.toLowerCase())) prests.push(prest);
      if (prix == null) continue;
      total += prix; chiffre = true;
      const nom = libelleCase(cb) + (prest ? ' (' + prest + ')' : '');
      lignes01.push({nom: nom.length > 40 ? nom.slice(0, 39).trim() + '…' : nom, prix});
    }
    // Deux lignes au plus dans « Vos prestataires actuels » (environ 84 caractères) : au-delà, « et 3 autres ».
    const liste = k => prests.slice(0, k).join(', ') + (k < prests.length ? ` et ${prests.length - k} autre${prests.length - k > 1 ? 's' : ''}` : '');
    let k = prests.length;
    while (k > 1 && liste(k).length > 84) k--;
    if (prests.length) auto(p01, U01.prestataire, liste(k));
    if (chiffre) auto(p01, U01.montant, fmt(total));
  }

  // « Avant et après » de chaque solution : à gauche ce qui existe, à droite le matériel coché.
  for (const m of MODULES) {
    const pages = PAGES.filter(p => p.src === m && pageVisible(p));
    const aa = pages.find(p => /Avant et après$/.test(p.nom));
    if (!aa) continue;
    const avant = [], apres = [];
    for (const p of pages) if (estMateriel(p)) (p.s.data.grille === 'parc' ? avant : apres).push(...lignesMateriel(p));
    if (!avant.length && p01) for (const u of SITUATION_01[m.cle] || []) {
      const cb = p01.unites.get(u);
      if (cb && coche(cb)) avant.push({nom: libelleCase(cb), qte: ''});
    }
    for (const [base, lignes] of [[0, avant], [40, apres]]) {
      let L = lignes;
      if (L.length > 13) L = L.slice(0, 12).concat([{nom: `Autres équipements (${L.length - 12})`, qte: ''}]);
      const court = t => t.length > 36 ? t.slice(0, 35).trim() + '…' : t;
      L.forEach((l, k) => { auto(aa, base + 3 * k, court(l.nom)); auto(aa, base + 3 * k + 1, l.qte); if (l.prix) auto(aa, base + 3 * k + 2, l.prix); });
    }
  }

  // Totaux de tous les tableaux qui ont une ligne « Total » (la zone est dans la dernière case de la ligne ;
  // le « € » écrit à côté de la zone dans la page n'est pas répété).
  const zoneCase = c => { const u = c && uniteDe(c); return u && u.classList.contains('champ') ? u : null; };
  for (const P of PAGES) if (pageVisible(P)) $$('table.tb', P.el).forEach(t => {
    const tot = t.querySelector('tr.total, tr.tot');
    const caseTot = tot && [...tot.cells].pop(), cible = zoneCase(caseTot);
    if (!cible) return;
    let somme = 0, vu = false;
    for (const tr of t.rows) {
      if (tr === tot || tr.querySelector('th')) continue;
      const u = zoneCase([...tr.cells].pop());
      const n = u ? nombre(texte(u)) : null;
      if (n != null) { somme += n; vu = true; }
    }
    const euroAcote = /€/.test([...caseTot.childNodes].filter(n => n !== cible).map(n => n.textContent).join(''));
    if (vu) AUTO.set(cible._cle, fmt(somme) + (euroAcote ? '' : NB + '€'));
  });

  // « Notre offre » : les prix se tapent ici. Ce qui se paie par mois et qui est retenu part dans le comparatif ; l'achat se paie une fois, il n'y entre pas.
  const lignesOffre = [];
  if (pOffre) {
    const prix = u => nombre(texte(pOffre.unites.get(u))), retenu = u => coche(pOffre.unites.get(u));
    const {prix: X, retenue: R} = OFFRE;
    const achat = prix(X.achat), loc = prix(X.location), abo = prix(X.abonnements), mt = prix(X.maintenance);
    autoCb(pOffre, R.achat, achat != null && loc == null);
    autoCb(pOffre, R.location, loc != null && achat == null);
    autoCb(pOffre, R.abonnements, abo > 0);
    autoCb(pOffre, R.maintenance, S.maintenance === 'oui' || (!S.maintenance && mt > 0));
    if (S.maintenance === 'non') auto(pOffre, X.maintenance, '0');
    if (loc != null && retenu(R.location)) lignesOffre.push({nom: 'Location du matériel', prix: loc});
    if (abo != null && retenu(R.abonnements)) lignesOffre.push({nom: 'Abonnements', prix: abo});
    if (mt != null && retenu(R.maintenance)) lignesOffre.push({nom: 'Maintenance', prix: mt});
  }
  // Le comparatif : aujourd'hui (situation actuelle chiffrée, sinon le montant de (01)) contre Green Cube.
  // Côté Green Cube : les solutions ajoutées en fin de partie ; pour une solution sans ajout, le total de son « Avant et après » ; puis l'offre retenue.
  if (pComp) {
    let gauche = [], droite = [];
    const ajoutees = solutionsAjoutees();
    for (const m of MODULES) {
      const aa = PAGES.find(p => p.src === m && /Avant et après$/.test(p.nom) && pageVisible(p));
      if (aa) for (let k = 0; k < 13; k++) {
        const pr = nombre(texte(aa.unites.get(3 * k + 2)));
        if (pr != null) gauche.push({nom: texte(aa.unites.get(3 * k)) || m.court, prix: pr, m});
      }
      const siennes = ajoutees.filter(l => l.m === m);
      if (siennes.length) droite.push(...siennes);
      else if (aa) { const tot = nombre(texte(aa.unites.get(79))); if (tot != null) droite.push({nom: m.court, prix: tot, m}); }
    }
    // Depuis le 12/11/2026 : les prix tapés à côté des cases de (01) passent en premier, une ligne par service avec son prestataire.
    // Au-delà de six lignes, les dernières se regroupent en « Autres services ».
    if (lignes01.length) {
      const n = COMP.auj.length;
      gauche = lignes01.length > n
        ? lignes01.slice(0, n - 1).concat([{nom: `Autres services (${lignes01.length - n + 1})`, prix: lignes01.slice(n - 1).reduce((s, l) => s + l.prix, 0)}])
        : lignes01.slice();
    } else if (gauche.length > 6) gauche = MODULES.map(m => ({nom: m.court + ', aujourd’hui', prix: gauche.filter(l => l.m === m).reduce((s, l) => s + l.prix, 0), n: gauche.filter(l => l.m === m).length})).filter(l => l.n);
    if (!gauche.length && p01) {
      const a = nombre(texte(p01.unites.get(U01.montant)));
      const nom = texte(p01.unites.get(U01.prestataire)) || 'Vos prestataires actuels';
      if (a != null) gauche = [{nom: nom.length > 40 ? nom.slice(0, 39).trim() + '…' : nom, prix: a}];
    }
    droite.push(...lignesOffre);
    // Une ligne tapée à la main garde sa place : le calcul remplit les lignes libres.
    // (« gauche » : ce que le client paie aujourd'hui, à gauche de la page ; « droite » : Green Cube, à droite de la page, sur le noir.)
    const tapee = u => Object.prototype.hasOwnProperty.call(S.valeurs, pComp.unites.get(u)._cle);
    const libres = COMP.gc.filter(u => !tapee(u) && !tapee(u + 1)), max = Math.max(libres.length, 1);
    // Six lignes au plus : on regroupe en une ligne la solution qui en a le plus, autant de fois qu'il faut, puis le reste passe en « Autres services ».
    while (droite.length > max) {
      const nb = new Map();
      droite.forEach(l => { if (l.m && !l.groupe) nb.set(l.m, (nb.get(l.m) || 0) + 1); });
      const [m, n] = [...nb].sort((x, y) => y[1] - x[1])[0] || [];
      if (!m || n < 2) break;
      const siennes = droite.filter(l => l.m === m), i = droite.indexOf(siennes[0]);
      const prix = siennes.reduce((t, l) => t + l.prix, 0);
      droite = droite.filter(l => l.m !== m);
      droite.splice(i, 0, {m, groupe: true, nom: m.court, prix, aff: prix === 0 && siennes.every(l => l.aff) ? 'Inclus' : null});
    }
    if (droite.length > max) droite = droite.slice(0, max - 1).concat([{nom: 'Autres services', prix: droite.slice(max - 1).reduce((s, l) => s + l.prix, 0)}]);
    gauche.slice(0, COMP.auj.length).forEach((l, k) => { auto(pComp, COMP.auj[k], l.nom); auto(pComp, COMP.auj[k] + 1, fmt(l.prix)); });
    droite.slice(0, libres.length).forEach((l, k) => { auto(pComp, libres[k], l.nom); auto(pComp, libres[k] + 1, l.aff || fmt(l.prix)); });
    // Les totaux suivent ce qui est écrit dans les lignes, calculé ou tapé à la main.
    const somme = lignes => {
      let t = 0, vu = false;
      for (const u of lignes) {
        const nom = texte(pComp.unites.get(u)), n = nombre(texte(pComp.unites.get(u + 1)));
        if (nom || n != null) { vu = true; t += n || 0; }
      }
      return vu ? t : null;
    };
    const Ls = somme(COMP.auj), Rs = somme(COMP.gc);
    if (Ls != null) auto(pComp, COMP.aujTotal, fmt(Ls));
    if (Rs != null) auto(pComp, COMP.gcTotal, fmt(Rs));
    const L = nombre(texte(pComp.unites.get(COMP.aujTotal))), R = nombre(texte(pComp.unites.get(COMP.gcTotal)));
    CHIFFRES = {L, R, actuel: p01 ? nombre(texte(p01.unites.get(U01.montant))) : null};
    if (L != null && R != null && L > R) {
      const ans = nombre(texte(pComp.unites.get(COMP.ans))) || 5;
      const eco = (L - R) * 12;
      auto(pComp, COMP.eco, fmt(Math.round(eco)));
      auto(pComp, COMP.pourcent, String(Math.round((L - R) / L * 100)));
      auto(pComp, COMP.ans, String(ans));
      auto(pComp, COMP.ecoTotal, fmt(Math.round(eco * ans)));
      Object.assign(CHIFFRES, {eco, ans});
    }
  }
}

function rendreUnite(u) {
  if (u.classList.contains('cb')) {
    const c = coche(u);
    u.classList.toggle('coche', c);
    u.setAttribute('aria-checked', String(c));
    const ligne = u.closest('.sit-l');               // (01) : le prestataire et le prix n'apparaissent que si la case est cochée
    if (ligne) ligne.classList.toggle('actif', c);
    return;
  }
  if (u.hasAttribute('data-image')) {
    const src = S.images[u._cle] || '';
    if (u._img !== src) {
      u._img = src;
      if (src) {
        u.innerHTML = `<img class="img-ajoutee" alt="${esc(u.dataset.image)}" src="${esc(src)}"><button type="button" class="retirer-image" aria-label="Retirer l’image">×</button>`;
        u.classList.add('a-image');
      } else { u.innerHTML = u._ph; u.classList.remove('a-image'); }
    }
    return;
  }
  if (document.activeElement === u) {
    const t = u.textContent.trim();
    u.classList.toggle('rempli', !!t && t !== u._phTexte);
    return;
  }
  const v = brut(u);
  if (v) {
    if (u.textContent !== v.t || !u.classList.contains('rempli')) u.textContent = v.t;
    u.classList.add('rempli');
    u.classList.toggle('auto', v.src === 'auto');
  } else {
    if (u.innerHTML !== u._ph) u.innerHTML = u._ph;
    u.classList.remove('rempli', 'auto');
  }
}

// Pour le commercial, pas de « (3.1) » : le nom de la page, la solution et la partie, et des numéros de page.
const sansNumero = t => t.replace(/^\(\d+(?:\.\d+)?\)\s*/, '');
function partieDe(P) {
  if (P.src === FICHES) return P.produit ? 'Fiche produit › ' + P.s.data.famille : '';
  if (P.src.type !== 'module') return '';
  const pt = P.src.parties.find(p => p.id === P.partie);
  return P.src.court + (pt ? ' › ' + pt.titre : '');
}
function plages(nos) {
  if (!nos.length) return '';
  const r = [];
  for (const n of nos) { const d = r[r.length - 1]; if (d && n === d[1] + 1) d[1] = n; else r.push([n, n]); }
  const txt = r.map(([a, b]) => a === b ? String(a) : b === a + 1 ? `${a} et ${b}` : `${a} à ${b}`);
  return (nos.length > 1 ? 'pages ' : 'page ') + (txt.length > 1 ? txt.slice(0, -1).join(', ') + ' et ' + txt[txt.length - 1] : txt[0]);
}
const numerosDe = ps => ps.filter(P => P.visible && P.no).map(P => P.no).sort((a, b) => a - b);
// Un lien « pages 4 à 7 » vers la première de ces pages.
function lienPages(ps) {
  const nos = numerosDe(ps);
  if (!nos.length) return '';
  const P = ps.find(x => x.visible && x.no === nos[0]);
  return `<button type="button" class="aller-pages" data-aller-cle="${esc(P.cle)}">${plages(nos)}</button>`;
}
function afficher() {
  const L = ordre();
  for (const P of PAGES) P.visible = pageVisible(P);
  const N = numeros(L), vis = L.filter(P => P.visible);
  rangerPages(L);
  let no = 0, derniere = null;
  for (const P of L) {
    const ret = !!S.retirees[P.cle];
    P.page.classList.toggle('hors', !P.visible);
    P.page.classList.toggle('retiree', ret);
    P.page.classList.remove('derniere');
    if (!P.visible) continue;
    if (P.src === BUNDLE) rendreBundle(P, N);
    for (const t of P.textes) { const v = renum(P.src, t.orig, N, t.lab); if (t.n.nodeValue !== v) t.n.nodeValue = v; }
    P.nomAffiche = renum(P.src, P.nom, N, false);
    P.no = ret ? null : ++no;
    if (!ret) derniere = P;
    P.page.querySelector('.page-garder input').checked = !ret;
    P.page.querySelector('.page-no').textContent = ret ? '–' : P.no;
    P.page.querySelector('.page-nom').textContent = sansNumero(P.nomAffiche);
    P.page.querySelector('.page-partie').textContent = partieDe(P);
    const bloc = blocDe(P, vis);
    P.page.querySelector('[data-deplacer="-1"]').disabled = vis.indexOf(bloc[0]) === 0;
    P.page.querySelector('[data-deplacer="1"]').disabled = vis.indexOf(bloc[bloc.length - 1]) === vis.length - 1;
    const nf = P.snFiche && N.no['fiche:' + P.produit];
    if (P.snFiche) P.snFiche.nodeValue = nf ? pad(nf) : '';             // le numéro en contour de la fiche
    const num = P.el.querySelector('.num');
    if (num) num.textContent = ret ? '' : P.no;
    if (P.liste) majListe(P);
    P.unites.forEach(rendreUnite);
  }
  if (derniere) derniere.page.classList.add('derniere');
  for (const a of AJOUTS) {
    const vis = partieVisible(a.m, a.pt), v = S.ajouts[a.cle] || {};
    a.el.classList.toggle('hors', !vis);
    a.el.classList.toggle('actif', !!v.on);
    a.el.querySelector('[data-ajout-on]').checked = !!v.on;
    for (const [sel, k] of [['[data-ajout-nom]', 'nom'], ['[data-ajout-prix]', 'prix']]) {
      const i = a.el.querySelector(sel);
      if (document.activeElement !== i) i.value = v[k] || '';
    }
  }
  return N;
}
// Les solutions cochées « Ajouter au comparatif », dans l'ordre de la propal.
const solutionsAjoutees = () => AJOUTS.filter(a => partieVisible(a.m, a.pt) && S.ajouts[a.cle] && S.ajouts[a.cle].on).map(a => {
  const v = S.ajouts[a.cle], prix = nombre(v.prix);
  return {m: a.m, nom: (v.nom || '').trim() || a.pt.titre, prix: prix || 0, aff: prix == null ? 'Inclus' : null};
});
function majListe(P) {
  const m = P.src, {lignes, cols} = P.liste, gardees = [];
  for (const L of lignes) {
    let id = L.id;
    if (!id) for (const [re, x] of LIENS_MATERIEL[m.cle] || []) if (re.test(L.txt)) { id = x; break; }
    const pt = id && m.parties.find(p => p.id === id);
    const garder = !pt || partieVisible(m, pt);
    L.e.style.display = garder ? '' : 'none';
    if (garder) gardees.push(L);
  }
  if (cols < 2) return;
  // Deux colonnes lues de haut en bas, comme dans la page source : la première colonne prend la moitié des lignes, arrondie au-dessus.
  // Les lignes numérotées suivent l'ordre des parties (3.1, 3.2…), quel que soit leur ordre dans la page source.
  if (gardees.every(L => L.id)) gardees.sort((a, b) => a.id.localeCompare(b.id));
  const rangs = Math.ceil(gardees.length / cols);
  gardees.forEach((L, i) => { L.e.style.gridColumn = String(Math.floor(i / rangs) + 1); L.e.style.gridRow = String(i % rangs + 2); });
}

/* ---------- panneau ---------- */
function construirePanneau() {
  const champ = (k, lib, type = 'text', extra = '') => `<label class="champ-form"><span>${lib}</span><input type="${type}" data-info="${k}" autocomplete="off" ${extra}></label>`;
  $('#panneau').innerHTML = `
  <section class="bloc"><h2><span class="no">1</span>Le client</h2>
    ${champ('client', 'Client')}${champ('projet', 'Projet')}
    <div class="deux">${champ('date', 'Date', 'date')}${champ('validite', 'Valable jusqu’au', 'date')}</div>
  </section>
  <section class="bloc"><h2><span class="no">2</span>Le commercial</h2>
    ${champ('commercial', 'Prénom et nom')}
    <div class="deux">${champ('tel', 'Téléphone', 'tel')}${champ('email', 'E-mail', 'email')}</div>
  </section>
  <section class="bloc"><h2><span class="no">3</span>Les solutions</h2>
    <p class="aide">Rien de coché : la propal fait 5 pages. Une solution cochée arrive après « Votre situation », à la place de la page « Notre solution » si celle-ci est vide. Une partie décochée retire ses pages et son matériel.</p>
    <div id="p-solutions"></div>
  </section>
  <section class="bloc"><h2><span class="no">4</span>Les fiches produits</h2>
    <p class="aide">Cochez un produit : sa fiche arrive après « Votre situation », une page par produit, à la place de la page « Notre solution » si celle-ci est vide.</p>
    <div id="p-fiches"></div>
  </section>
  <section class="bloc"><h2><span class="no">5</span>Le matériel proposé</h2>
    <p class="aide">Une page qui liste le matériel choisi pour le client : photo, nom, à quoi il sert et quantité. Elle s’adapte au nombre de produits et passe sur plusieurs pages au-delà de 12. Les fiches produits du bloc 4 restent à part.</p>
    <label class="choix"><input type="checkbox" data-bundle-on><span><b>Ajouter la page « Matériel proposé »</b> (bundle)</span></label>
    <div id="p-bundle"></div>
  </section>
  <section class="bloc"><h2><span class="no">6</span>La maintenance</h2>
    <label class="choix"><input type="radio" name="maintenance" value="oui"><span><b>Avec contrat de maintenance</b></span></label>
    <label class="choix"><input type="radio" name="maintenance" value="non"><span><b>Sans contrat</b> : la partie Maintenance des solutions est retirée, et le tableau des prix l’indique.</span></label>
  </section>
  <section class="bloc"><h2><span class="no">7</span>Les prix</h2>
    <p class="aide" id="p-prix-aide"></p>
    <dl class="chiffres" id="p-chiffres"></dl>
    <div id="p-chiffres-note"></div>
    <button type="button" class="btn-lien" data-aller="${NOM_COMPARATIF}">Voir le comparatif</button>
  </section>
  <section class="bloc"><h2><span class="no">8</span>Les pages</h2>
    <details><summary>Retirer, déplacer ou retrouver une page</summary>
      <p class="aide" style="margin-top:8px">Décochez une page pour la sortir du PDF sans la perdre. Pour changer l’ordre, faites glisser une ligne ou utilisez les flèches. Les boutons « Monter » et « Descendre », au-dessus de chaque page, font la même chose. Les numéros des parties suivent le nouvel ordre.</p>
      <button type="button" class="btn btn-petit" id="p-ordre" data-action="ordre-origine" hidden>Remettre l’ordre d’origine</button>
      <div id="p-pages"></div></details>
  </section>
  <section class="bloc"><h2><span class="no">9</span>Avant le PDF</h2>
    <ul class="verif" id="p-verif"></ul>
    <button type="button" class="btn btn-noir" data-action="pdf">Télécharger le PDF</button>
  </section>`;
}
function remplirInfos() {
  $$('#panneau [data-info]').forEach(i => { if (document.activeElement !== i) i.value = S.infos[i.dataset.info] || ''; });
  $$('#panneau input[name="maintenance"]').forEach(r => { r.checked = r.value === S.maintenance; });
}
function verifications() {
  const imprimees = ordre().filter(P => P.visible && !S.retirees[P.cle]);
  const vides = [], images = [];
  for (const P of imprimees) {
    if (estMateriel(P) || /Avant et après$/.test(P.nom)) continue;
    P.unites.forEach(u => {
      if (u.classList.contains('champ') && !u.closest('td') && !u.classList.contains('rempli')) vides.push(u);   // les cases des tableaux sont facultatives
      if (u.hasAttribute('data-image') && !S.images[u._cle]) images.push(u);
    });
  }
  const depasse = [];
  for (const P of imprimees) {
    const vus = new Set();
    P.unites.forEach(u => {
      if (!u.classList.contains('champ') || !u.classList.contains('rempli')) return;
      const c = conteneur(u);
      if (vus.has(c)) return;
      vus.add(c);
      if (exces(u) > 1) depasse.push(u);
    });
  }
  const sol = MODULES.filter(m => etatModule(m).on).map(m => m.court);
  const nbFiches = fichesCochees().length;
  if (nbFiches) sol.push(`${nbFiches} fiche${nbFiches > 1 ? 's' : ''} produit`);
  const nbBundle = S.bundle.on ? elementsBundle().length : 0;
  if (nbBundle) sol.push(`matériel proposé (${nbBundle} produit${nbBundle > 1 ? 's' : ''})`);
  const pageSol = page(NOM_SOLUTION);
  if (pageSol.visible && [...pageSol.unites.values()].some(u => u.classList.contains('rempli') || S.images[u._cle])) sol.unshift('page « Notre solution »');
  return [
    {ok: !depasse.length, texte: depasse.length ? `${depasse.length} texte${depasse.length > 1 ? 's' : ''} trop long${depasse.length > 1 ? 's' : ''} pour leur place (page ${depasse[0]._page.no})` : 'Tous les textes tiennent dans leur place', aller: depasse[0]},
    {ok: !!S.infos.client, texte: S.infos.client ? 'Client : ' + S.infos.client : 'Le nom du client manque'},
    {ok: !!S.infos.commercial, texte: S.infos.commercial ? 'Commercial : ' + S.infos.commercial : 'Le nom du commercial manque'},
    {ok: sol.length > 0, texte: sol.length ? 'Solutions : ' + sol.join(', ') : 'Aucune solution : cochez-en une ou remplissez « Notre solution »'},
    ...(S.bundle.on && !nbBundle ? [{ok: false, texte: 'La page « Matériel proposé » est vide : choisissez le matériel dans le bloc 5', aller: PAGES.find(P => P.src === BUNDLE).el}] : []),
    {ok: !!S.maintenance, texte: S.maintenance ? (S.maintenance === 'oui' ? 'Avec contrat de maintenance' : 'Sans contrat de maintenance') : 'Maintenance : avec ou sans contrat ?'},
    {ok: !vides.length, texte: vides.length ? `${vides.length} zone${vides.length > 1 ? 's' : ''} de texte encore vide${vides.length > 1 ? 's' : ''}` : 'Toutes les zones de texte sont remplies', aller: vides[0]},
    {ok: !images.length, texte: images.length ? `${images.length} image${images.length > 1 ? 's' : ''} à ajouter (${[...new Set(images.map(u => u.dataset.image.toLowerCase()))].join(', ')})` : 'Toutes les images sont en place', aller: images[0]},
    {ok: CHIFFRES.eco != null, texte: CHIFFRES.eco != null ? 'Comparatif calculé' : 'Le comparatif n’est pas encore calculé'},
    // Le montant noté en (01) et le total « aujourd’hui » du comparatif doivent raconter la même chose.
    ...(CHIFFRES.actuel != null && CHIFFRES.L != null && Math.abs(CHIFFRES.actuel - CHIFFRES.L) > 0.5
      ? [{ok: false, texte: `Montant payé aujourd’hui : ${fmt(CHIFFRES.actuel)}${NB}€ dans « Votre situation », ${fmt(CHIFFRES.L)}${NB}€ dans le comparatif`}] : []),
  ];
}
function majPanneau() {
  const lien = lienPages;
  $('#p-solutions').innerHTML = MODULES.map(m => {
    const st = etatModule(m);
    return `<div class="module${st.on ? '' : ' off'}"><div class="ligne-choix"><label class="choix"><input type="checkbox" data-module="${m.cle}"${st.on ? ' checked' : ''}><span><b>${esc(m.titre)}</b></span></label>${lien(PAGES.filter(P => P.src === m))}</div>`
      + `<div class="sous">${m.parties.map(pt => {
        const sans = pt.maintenance && S.maintenance === 'non';
        const on = st.parties[pt.id] !== false && !sans;
        return `<div class="ligne-choix"><label class="choix"><input type="checkbox" data-module="${m.cle}" data-partie="${pt.id}"${on ? ' checked' : ''}${sans ? ' disabled' : ''}><span>${esc(pt.titre)}${sans ? ' (sans contrat)' : ''}</span></label>${lien(PAGES.filter(P => P.src === m && P.partie === pt.id))}</div>`;
      }).join('')}</div></div>`;
  }).join('');
  // Les familles déjà ouvertes restent ouvertes après chaque case cochée.
  const ouvertes = new Set($$('#p-fiches details[open]').map(d => d.dataset.famille));
  $('#p-fiches').innerHTML = FAMILLES.map(f => {
    const ps = PAGES.filter(P => P.produit && P.s.data.famille === f), nb = ps.filter(P => S.fiches[P.produit]).length;
    return `<details class="famille" data-famille="${esc(f)}"${ouvertes.has(f) || nb ? ' open' : ''}><summary>${esc(f)}${nb ? `<span class="famille-nb">${nb}</span>` : ''}</summary>`
      + ps.map(P => `<div class="ligne-choix"><label class="choix"><input type="checkbox" data-fiche="${esc(P.produit)}"${S.fiches[P.produit] ? ' checked' : ''}><span>${esc(P.nom)}</span></label>${lien([P])}</div>`).join('') + '</details>';
  }).join('');
  const pg = nom => { const P = page(nom); return P && P.no ? ` (page ${P.no})` : ''; };
  $('#p-prix-aide').textContent = `Tapez les prix dans « Notre offre »${pg(NOM_OFFRE)} : achat, location, abonnements, maintenance. La location, les abonnements et la maintenance retenus partent dans « Le comparatif »${pg(NOM_COMPARATIF)}, face à ce que le client paie aujourd’hui : dans « Votre situation »${pg('(01) Votre situation')}, cochez ce qui est en place, puis tapez à côté le prestataire et le prix par mois ; chaque ligne arrive dans le comparatif avec son prix. L’achat se paie une fois : il n’entre pas dans ce comparatif par mois. À la fin de chaque partie d’une solution, « Ajouter cette solution au comparatif » y envoie la solution et son prix. Les totaux et l’économie se calculent seuls. Un montant calculé est souligné en pointillé : tapez par-dessus pour le remplacer, videz la zone pour revenir au calcul.`;
  const c = CHIFFRES, e = v => v == null ? '–' : fmt(Math.round(v * 100) / 100) + NB + '€';
  $('#p-chiffres').innerHTML = `<dt>Aujourd’hui, par mois</dt><dd>${e(c.L)}</dd><dt>Avec Green Cube, par mois</dt><dd>${e(c.R)}</dd>`
    + `<dt>Économie par an</dt><dd class="eco">${c.eco != null ? e(Math.round(c.eco)) : '–'}</dd>`
    + (c.eco != null ? `<dt>Sur ${c.ans} ans</dt><dd>${e(Math.round(c.eco * c.ans))}</dd>` : '');
  const aj = solutionsAjoutees();
  $('#p-chiffres-note').innerHTML = (aj.length ? `<p class="aide">Dans le comparatif : ${aj.map(l => esc(l.nom) + ' (' + (l.aff ? 'inclus' : fmt(l.prix) + NB + '€') + ')').join(', ')}.</p>` : '')
    + (c.L != null && c.R != null && c.L <= c.R
    ? '<p class="note-alerte">Avec Green Cube, le total mensuel n’est pas plus bas : l’économie n’est pas calculée. Remplissez-la à la main ou retirez la page.</p>' : '');
  majBundle();
  // Les pages dans l'ordre de la propal, un intertitre à chaque changement de partie. Chaque ligne se fait glisser.
  const groupe = P => P.src === GEN ? (PAGES.indexOf(P) < COUPURE ? 'Début de la propal' : 'Fin de la propal') : P.src === FICHES ? 'Fiches produits' : P.src.titre;
  const vis = ordre().filter(P => P.visible);
  let avant = null;
  $('#p-pages').innerHTML = vis.map(P => {
    const g = groupe(P), tete = g !== avant ? `<h3>${esc(g)}</h3>` : '';
    avant = g;
    const nom = esc(sansNumero(P.nomAffiche)), cle = esc(P.cle), ret = !!S.retirees[P.cle], bloc = blocDe(P, vis);
    const haut = vis.indexOf(bloc[0]) > 0, bas = vis.indexOf(bloc[bloc.length - 1]) < vis.length - 1;
    return tete + `<div class="ligne-page${ret ? ' retiree' : ''}" draggable="true" data-cle="${cle}"><input type="checkbox" data-retirer="${cle}"${ret ? '' : ' checked'} aria-label="Garder ${nom} dans le PDF"><span class="n">${P.no || '–'}</span><button type="button" class="aller" data-aller-cle="${cle}">${nom}</button>`
      + `<span class="deplacer"><button type="button" data-deplacer-cle="${cle}" data-sens="-1" title="Monter" aria-label="Monter ${nom}"${haut ? '' : ' disabled'}>↑</button><button type="button" data-deplacer-cle="${cle}" data-sens="1" title="Descendre" aria-label="Descendre ${nom}"${bas ? '' : ' disabled'}>↓</button></span></div>`;
  }).join('');
  $('#p-ordre').hidden = !S.ordre;
  VERIFS = verifications();
  $('#p-verif').innerHTML = VERIFS.map((v, i) => `<li class="${v.ok ? '' : 'ko'}">${esc(v.texte)}${v.aller ? ` <button type="button" class="btn-lien" data-verif="${i}">voir</button>` : ''}</li>`).join('');
}
let VERIFS = [];
// Bloc 5 : le choix du matériel. Il ne se reconstruit que si la liste change (pas pour une quantité tapée),
// en gardant les familles ouvertes, ce qui est en cours de saisie et l'élément actif.
let sigBundle = '';
const ATTRS_BUNDLE = ['data-bundle-produit', 'data-bundle-qte', 'data-autre-qte', 'data-autre-retirer', 'data-autre-champ', 'data-bundle-nom', 'data-bundle-choix', 'data-action'];
const selecteur = e => { const a = e && e.getAttribute && ATTRS_BUNDLE.find(x => e.hasAttribute(x)); return a ? `[${a}="${CSS.escape(e.getAttribute(a))}"]` : null; };
function majBundle() {
  const b = S.bundle, zone = $('#p-bundle'), enregistres = lireBundles();
  $('#panneau [data-bundle-on]').checked = b.on;
  const sig = JSON.stringify([b.on, Object.keys(b.items), b.autres.map(a => a.id), enregistres.map(x => x.id + x.modifie), bundleVersion]);
  if (sig !== sigBundle) {
    sigBundle = sig;
    const actif = zone.contains(document.activeElement) ? selecteur(document.activeElement) : null;
    const brouillons = $$('[data-autre-champ], [data-bundle-nom]', zone).map(i => [selecteur(i), i.value]);
    const ouvertes = new Set($$('details[open]', zone).map(d => d.dataset.famille));
    const qte = (attr, k, q, nom) => `<label class="qte-champ"><span>Qté</span><input type="number" class="qte" min="1" max="999" step="1" inputmode="numeric" ${attr}="${esc(k)}" value="${q}" aria-label="Quantité : ${esc(nom)}"></label>`;
    zone.innerHTML = !b.on ? '' : (enregistres.length ? `<label class="champ-form bundle-choix"><span>Partir d’un bundle enregistré</span><select data-bundle-choix><option value="">Choisir un bundle…</option>${enregistres.map(x => `<option value="${esc(x.id)}">${esc(x.nom)}</option>`).join('')}</select></label>` : '')
      + '<p class="bundle-resume" id="p-bundle-resume"></p>'
      + FAMILLES.map(f => {
        const ps = PAGES.filter(P => P.produit && P.s.data.famille === f), nb = ps.filter(P => b.items[P.produit]).length;
        return `<details class="famille" data-famille="${esc(f)}"${ouvertes.has(f) || nb ? ' open' : ''}><summary>${esc(f)}${nb ? `<span class="famille-nb">${nb}</span>` : ''}</summary>`
          + ps.map(P => {
            const q = b.items[P.produit], nom = nomProduit(P.produit);
            return `<div class="ligne-bundle"><label class="choix"><input type="checkbox" data-bundle-produit="${esc(P.produit)}"${q ? ' checked' : ''}><span>${esc(nom)}</span></label>${q ? qte('data-bundle-qte', P.produit, q, nom) : ''}</div>`;
          }).join('') + '</details>';
      }).join('')
      + `<details class="famille" data-famille="autres"${ouvertes.has('autres') || b.autres.length ? ' open' : ''}><summary>Autre matériel, sans fiche${b.autres.length ? `<span class="famille-nb">${b.autres.length}</span>` : ''}</summary>`
      + b.autres.map(a => `<div class="ligne-bundle"><span class="autre-nom">${esc(a.nom)}${a.sert ? `<small>${esc(a.sert)}</small>` : ''}</span>${qte('data-autre-qte', a.id, a.qte, a.nom)}<button type="button" class="btn-lien" data-autre-retirer="${esc(a.id)}" aria-label="Retirer ${esc(a.nom)}">Retirer</button></div>`).join('')
      + `<div class="autre-form"><p class="aide">Pour du matériel qui n’a pas de fiche (câbles, coffret…). Il apparaît sur la page avec un picto de colis sur un aplat vert, à la place de la photo.</p>`
      + `<label class="champ-form"><span>Nom du matériel</span><input type="text" data-autre-champ="nom" maxlength="32" autocomplete="off"></label>`
      + `<label class="champ-form"><span>À quoi il sert</span><input type="text" data-autre-champ="sert" maxlength="130" autocomplete="off"></label>`
      + `<div class="autre-bas"><label class="champ-form"><span>Quantité</span><input type="number" data-autre-champ="qte" min="1" max="999" step="1" value="1"></label><button type="button" class="btn btn-petit" data-action="autre-ajouter">Ajouter</button></div></div></details>`
      + `<div class="bundle-sauver"><label class="champ-form"><span>Enregistrer ce matériel comme bundle</span><input type="text" data-bundle-nom="" maxlength="40" placeholder="Ex. : Bureau de 10 postes" autocomplete="off"></label><button type="button" class="btn btn-petit" data-action="bundle-enregistrer">Enregistrer</button></div>`
      + '<p class="aide">Le bundle reste dans ce navigateur et se choisit en haut de ce bloc dans vos prochaines propals. Pour le passer à un collègue : Bibliothèque, « Vos bundles », « Enregistrer le fichier ».</p>';
    for (const [s, v] of brouillons) { const i = s && $(s, zone); if (i) i.value = v; }
    const f = actif && $(actif, zone);
    if (f) f.focus({preventScroll: true});
  }
  const res = $('#p-bundle-resume');
  if (res) {
    const tous = elementsBundle(), total = tous.reduce((s, x) => s + x.qte, 0);
    res.innerHTML = tous.length ? `${tous.length} produit${tous.length > 1 ? 's' : ''}, ${total} équipement${total > 1 ? 's' : ''} au total. ${lienPages(PAGES.filter(P => P.src === BUNDLE))}`
      : 'Aucun matériel choisi : ouvrez une famille et cochez les produits.';
  }
}

/* ---------- cycle de mise à jour ---------- */
function changer() {
  calculer();
  const N = afficher();
  majPanneau(N);
  planifierSauvegarde();
}
let minuteur = null;
function planifierSauvegarde() {
  S.modifie = new Date().toISOString();
  clearTimeout(minuteur);
  minuteur = setTimeout(sauver, 500);
}
function sauver() {
  if (!S) return;
  const ok = STOCK.ecrire(kPropal(S.id), S);
  const idx = (STOCK.lire(K_INDEX) || []).filter(x => x.id !== S.id);
  idx.unshift({id: S.id, client: S.infos.client, projet: S.infos.projet, modifie: S.modifie, solutions: [...MODULES.filter(m => etatModule(m).on).map(m => m.court), ...(S.bundle.on ? [BUNDLE.court] : [])]});
  STOCK.ecrire(K_INDEX, idx);
  STOCK.ecrire(K_DERNIERE, S.id);
  const h = new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
  $('#etat').textContent = ok ? `Gardée dans ce navigateur à ${h}` : 'Non gardée : enregistrez le fichier';
  if (!ok && !alerteStockage) {
    alerteStockage = true;
    message('Le navigateur n’a plus de place, sans doute à cause des images. Utilisez « Enregistrer le fichier » pour ne rien perdre.', true);
  }
}
// Après un changement de solution : les pages arrivées sont surlignées en vert et le site va à la première.
function signaler(avant, quoi) {
  $$('.page.ajoutee').forEach(e => e.classList.remove('ajoutee'));
  const pageSol = page(NOM_SOLUTION);
  const nouvelles = ordre().filter(P => P.visible && !avant.has(P.cle) && P !== pageSol);
  const perdues = PAGES.filter(P => !P.visible && avant.has(P.cle) && P !== pageSol).length;
  if (nouvelles.length) {
    const n = nouvelles.length, nos = numerosDe(nouvelles);
    nouvelles.forEach(P => P.page.classList.add('ajoutee'));
    message(`${quoi} : ${n} page${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}${nos.length ? ', ' + plages(nos) : ''}. ${n > 1 ? 'Elles sont surlignées' : 'Elle est surlignée'} en vert.`, false, 6500);
    nouvelles[0].page.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
  } else if (perdues) message(`${quoi} : ${perdues} page${perdues > 1 ? 's' : ''} en moins.${pageSol.visible && !avant.has(pageSol.cle) ? ' La page « Notre solution » revient.' : ''}`, false, 4000);
}
function ouvrir(p) {
  $$('.page.ajoutee').forEach(e => e.classList.remove('ajoutee'));
  S = normaliser(p);
  bundleVersion++;
  alerteStockage = false;
  STOCK.ecrire(K_DERNIERE, S.id);
  montrer('propal');
  calculer();
  const N = afficher();
  remplirInfos();
  majPanneau(N);
  $('#planches').scrollTop = 0;
  $('#etat').textContent = '';
}

/* ---------- saisie dans les slides ---------- */
function enregistrerValeur(u, brutTexte, fin) {
  const t = brutTexte.replace(/\s+/g, ' ').trim();
  const vide = !t || t === u._phTexte;
  const k = infoDe(u);
  if (k) {
    if (!DATES.has(k)) S.infos[k] = vide ? '' : t;
    else if (vide) S.infos[k] = '';
    else { const iso = isoDepuisFR(t); if (iso) S.infos[k] = iso; else if (fin) message('Date attendue au format JJ/MM/AAAA.', true); }
    remplirInfos();
  } else if (vide) delete S.valeurs[u._cle];
  else S.valeurs[u._cle] = t;
  changer();
}
// La boîte d'un élément en pixels de la slide (1280 × 720), sans l'échelle d'affichage.
function boite(e, sl) {
  const r = e.getBoundingClientRect(), s = sl.getBoundingClientRect(), k = s.width / 1280 || 1;
  return {x1: (r.left - s.left) / k, y1: (r.top - s.top) / k, x2: (r.right - s.left) / k, y2: (r.bottom - s.top) / k};
}
// Le bloc qu'une zone remplit : le tableau, le bloc prévu pour elle (data-champ), sinon le texte qui la contient.
const conteneur = u => u.closest('table') || u.closest('[data-champ]') || u.closest('.t') || u.closest('.ab');
// Limites d'un bloc : le cadre qui le contient (un aplat de hauteur fixe ou une ligne de liste), le premier élément placé
// en dessous ou à droite, sinon les bords de la slide.
function limites(c) {
  if (c._lim) return c._lim;
  const sl = c.closest('.slide'), b = boite(c, sl);
  let bas = 712, droite = 1256;
  for (let o = c.parentElement; o && o !== sl; o = o.parentElement) {
    const rang = o.matches('.rg');
    if (!rang && !(o.matches('.s, .ab') && o.style.height)) continue;
    const ob = boite(o, sl), marge = rang ? 0 : 8;
    bas = Math.min(bas, ob.y2 - marge); droite = Math.min(droite, ob.x2 - marge);
    break;
  }
  for (const o of $$('.t, .s, table, img', sl)) {
    if (o === c || c.contains(o) || o.contains(c) || o.offsetParent === null || o.closest('.dos')) continue;
    const ob = boite(o, sl);
    if (ob.x2 - ob.x1 < 1 || ob.y2 - ob.y1 < 1) continue;
    if (ob.x1 >= b.x2 - 2 && Math.min(b.y2, ob.y2) - Math.max(b.y1, ob.y1) > 4) { droite = Math.min(droite, ob.x1 - 4); continue; }
    if (Math.min(b.x2, ob.x2) - Math.max(b.x1, ob.x1) <= 4) continue;
    if (ob.y1 > b.y1 + 2) bas = Math.min(bas, ob.y1 - 4);
  }
  return (c._lim = {bas, droite: Math.max(droite, b.x2)});
}
// De combien une zone dépasse son emplacement (0 si elle tient).
function exces(u) {
  const c = conteneur(u);
  if (!c || !c.getClientRects().length) return 0;
  const l = limites(c), b = boite(c, c.closest('.slide'));
  return Math.max(0, b.y2 - l.bas, b.x2 - l.droite, c.scrollWidth - c.clientWidth - 2);
}
function caretFin(el) {
  const r = document.createRange(), sel = getSelection();
  r.selectNodeContents(el); r.collapse(false);
  sel.removeAllRanges(); sel.addRange(r);
}
function basculer(cb) {
  const P = cb._page, u = +cb.dataset.u;
  if (P.nom === NOM_OFFRE && u === 12) {                                  // la case « Retenue » de la maintenance suit le choix du panneau
    S.maintenance = coche(cb) ? 'non' : 'oui';
    delete S.cases[cb._cle];
    remplirInfos();
  } else S.cases[cb._cle] = !coche(cb);
  changer();
}
let zoneImage = null;
async function reduireImage(f) {
  const bmp = await createImageBitmap(f);
  const r = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return f.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
}

/* ---------- PDF ---------- */
function nomFichier() {
  const d = S.infos.date ? ' - ' + dateFR(S.infos.date).replace(/\//g, '-') : '';
  return `Propal - ${S.infos.client || 'sans client'}${d}`.replace(/[\\/:*?"<>|]/g, '-');
}
function masquerVides() {
  $$('.slide .vide-impr').forEach(e => e.classList.remove('vide-impr'));
  $$('.slide [data-champ]').forEach(c => {
    const us = $$('.champ[data-u]', c);
    c.classList.toggle('vide-impr', us.length > 0 && us.every(u => !u.classList.contains('rempli')));
  });
  // Une phrase dont un trou n'est pas rempli (« Sous [10] jours… ») sortirait avec un blanc au milieu : on la retire du PDF.
  $$('.slide .champ[data-u]:not(.rempli)').forEach(u => {
    const b = u.parentElement;
    if (!b || u.closest('td') || b.matches('td, th, [data-champ]') || b.textContent.length > 300) return;
    if ([...b.children].some(e => !e.matches('.champ, br, b, strong, em, i'))) return;
    const reste = [...b.childNodes].filter(n => n !== u && !(n.classList && n.classList.contains('champ'))).map(n => n.textContent).join('');
    if (!/[A-Za-zÀ-ÿ]/.test(reste)) return;
    b.classList.add('vide-impr');
    // La case posée juste devant la phrase part avec elle.
    const cb = b.previousElementSibling;
    if (cb && cb.classList.contains('cb') && (b.parentElement.matches('.coche') || Math.abs(cb.getBoundingClientRect().top - b.getBoundingClientRect().top) < 16)) cb.classList.add('vide-impr');
  });
  // Un montant vide (« [000] € ») ne laisse pas son « € » ou son « % » seul dans le PDF.
  $$('.slide .champ[data-u]:not(.rempli)').forEach(u => {
    for (const n of [u.previousSibling, u.nextSibling]) {
      if (!n) continue;
      if (n.nodeType === 3 && /^\s*(€|%|M€)\s*$/.test(n.textContent)) {
        const s = document.createElement('span'); s.className = 'unite-vide';
        n.replaceWith(s); s.append(n); s.classList.add('vide-impr');
      } else if (n.nodeType === 1 && n.classList.contains('unite-vide')) n.classList.add('vide-impr');
    }
  });
}
// Le bouton télécharge le fichier directement (assets/pdf.js), toujours en 1280 × 720, sans passer par la fenêtre d'impression.
let pdfEnCours = false;
async function telechargerPDF() {
  if (!S) { message('Ouvrez ou créez d’abord une propal.', true); return; }
  if (pdfEnCours) return;
  montrer('propal');
  const pb = verifications().filter(v => !v.ok);
  if (pb.length && !confirm('Avant de télécharger le PDF :\n\n' + pb.map(v => '• ' + v.texte).join('\n') + '\n\nLes zones vides et les phrases incomplètes n’apparaîtront pas dans le PDF. Télécharger quand même ?')) return;
  pdfEnCours = true;
  try {
    const pages = ordre().filter(P => P.visible && !S.retirees[P.cle]).map(P => P.el);
    const imgs = pages.flatMap(el => $$('img', el));
    imgs.forEach(i => { i.loading = 'eager'; });
    message('Préparation du PDF…', false, 120000);
    await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, {once: true}); i.addEventListener('error', r, {once: true}); })));
    masquerVides();
    const blob = await window.PropalPDF.creer(pages, {
      titre: nomFichier(),
      progression: (i, nb) => message(i ? `Préparation du PDF : page ${i} sur ${nb}…` : 'Préparation des photos du PDF…', false, 120000),
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomFichier() + '.pdf';
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 30000);
    // Un caractère absent des polices (un emoji, par exemple) ne peut pas entrer dans le fichier : on le dit.
    const manque = [...new Set(blob.manquants.map(m => m.startsWith('fond : ') ? 'un fond de couleur' : m))];
    if (manque.length) message(`PDF téléchargé, mais il manque dans le fichier : ${manque.join(' ')}. Remplacez-le dans la zone, puis téléchargez de nouveau.`, true, 15000);
    else message(`PDF téléchargé : ${a.download}`, false, 6000);
  } catch (e) {
    message('Le PDF n’a pas pu être créé : ' + e.message, true, 12000);
  } finally {
    pdfEnCours = false;
  }
}
// Si quelqu'un imprime quand même avec Cmd + P, la page garde le même rendu.
let titreAvant = document.title;
window.addEventListener('beforeprint', () => {
  if (!S) return;
  masquerVides();
  titreAvant = document.title;
  document.title = nomFichier();
});
window.addEventListener('afterprint', () => { document.title = titreAvant; });

function exporter(p) {
  const prec = S; S = p;
  const nom = nomFichier() + '.json';
  S = prec;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(p)], {type: 'application/json'}));
  a.download = nom;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- bibliothèque ---------- */
function rendreBibliotheque() {
  const idx = STOCK.lire(K_INDEX) || [], bundles = lireBundles();
  const resumeBundle = b => {
    const L = [...Object.entries(b.items).map(([k, q]) => `${nomProduit(k)} × ${q}`), ...b.autres.map(a => `${a.nom} × ${a.qte}`)];
    return L.slice(0, 6).join(', ') + (L.length > 6 ? ` et ${L.length - 6} autre${L.length > 7 ? 's' : ''}` : '');
  };
  const quand = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'}); };
  const premiereImage = src => { const m = src.slides[0].html.match(/src="([^"]+)"/); return m ? m[1] : ''; };
  const parDossier = {};
  (D.documents || []).forEach(d => { (parDossier[d.dossier] = parDossier[d.dossier] || []).push(d); });
  const groupes = {};
  ANC.fiches.forEach(f => { (groupes[f.groupe] = groupes[f.groupe] || []).push(f); });
  $('#vue-bibliotheque').innerHTML = `<div class="biblio">
    <div class="biblio-tete"><h1>Bibliothèque</h1>
      <p>Vos propals, les modèles de chaque solution, les PDF déjà produits et les anciennes propals. Tout reste sur cet ordinateur : rien n’est envoyé en ligne.</p>
      <div class="actions"><button type="button" class="btn btn-noir" data-action="nouvelle">Nouvelle propal</button><button type="button" class="btn" data-action="ouvrir-fichier">Ouvrir un fichier</button></div></div>
    <section class="rubrique"><div class="rubrique-tete"><h2>Vos propals</h2><p>Gardées dans ce navigateur. Enregistrez le fichier pour les garder ailleurs.</p></div>
      ${idx.length ? `<table class="liste"><thead><tr><th>Client</th><th>Projet</th><th>Solutions</th><th>Modifiée le</th><th></th></tr></thead><tbody>${idx.map(x => `<tr>
        <td><b>${esc(x.client || 'Sans nom de client')}</b></td><td>${esc(x.projet || '')}</td><td class="discret">${esc((x.solutions || []).join(', ') || 'aucune')}</td><td class="discret">${esc(quand(x.modifie))}</td>
        <td class="actions"><button type="button" class="btn-lien" data-ouvrir="${esc(x.id)}">Ouvrir</button><button type="button" class="btn-lien" data-dupliquer="${esc(x.id)}">Dupliquer</button><button type="button" class="btn-lien" data-exporter="${esc(x.id)}">Enregistrer le fichier</button><button type="button" class="btn-lien" data-supprimer="${esc(x.id)}">Supprimer</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="vide">Aucune propal pour l’instant. Commencez par « Nouvelle propal ».</p>'}
    </section>
    <section class="rubrique"><div class="rubrique-tete"><h2>Vos bundles</h2><p>Le matériel enregistré pour le reprendre dans une autre propal, bloc 5 « Le matériel proposé ». Gardés dans ce navigateur.</p></div>
      ${bundles.length ? `<table class="liste"><thead><tr><th>Bundle</th><th>Matériel</th><th>Modifié le</th><th></th></tr></thead><tbody>${bundles.map(b => `<tr>
        <td><b>${esc(b.nom)}</b></td><td class="discret">${esc(resumeBundle(b))}</td><td class="discret">${esc(quand(b.modifie))}</td>
        <td class="actions"><button type="button" class="btn-lien" data-bundle-exporter="${esc(b.id)}">Enregistrer le fichier</button><button type="button" class="btn-lien" data-bundle-supprimer="${esc(b.id)}">Supprimer</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="vide">Aucun bundle pour l’instant. Dans une propal, choisissez le matériel (bloc 5), puis « Enregistrer comme bundle ». Un fichier de bundle reçu d’un collègue s’ouvre avec « Ouvrir un fichier ».</p>'}
    </section>
    <section class="rubrique"><div class="rubrique-tete"><h2>Les modèles</h2><p>Les pages que le site assemble, avec leur PDF de relecture</p></div>
      <div class="modeles">${D.sources.map(s => `<article class="modele"><img src="${esc(premiereImage(s))}" alt="" loading="lazy"><h3>${esc(s.titre)}</h3>
        <p>${s.type === 'fiches' ? `${s.slides.length - 1} fiches : une page par produit, à cocher dans la propal` : `${s.slides.length} pages${s.parties ? ', ' + s.parties.length + ' parties : ' + esc(s.parties.map(p => p.titre).join(', ').toLowerCase()) : ' : Green Cube et le client, sa situation, la solution, l’offre et le comparatif'}`}</p>
        ${s.pdf ? `<a href="${esc(s.pdf)}" target="_blank" rel="noopener">Voir le PDF de relecture</a>` : ''}</article>`).join('')}</div>
    </section>
    <section class="rubrique"><div class="rubrique-tete"><h2>Les PDF déjà produits</h2><p>Dossiers export de chaque partie</p></div>
      <table class="liste"><thead><tr><th>Dossier</th><th>Fichier</th></tr></thead><tbody>${Object.entries(parDossier).map(([d, fs]) => fs.map((f, i) => `<tr><td class="discret">${i ? '' : esc(d)}</td><td><a href="${esc(f.lien)}" target="_blank" rel="noopener">${esc(f.nom)}</a></td></tr>`).join('')).join('')}</tbody></table>
    </section>
    <section class="rubrique"><div class="rubrique-tete"><h2>Anciennes propals</h2><span class="confidentiel">Interne, à ne pas publier</span><input class="filtre droite" id="filtre-anciennes" type="search" placeholder="Filtrer : client, marque, solution" aria-label="Filtrer les anciennes propals"></div>
      <p class="aide">Relevé du 29/10/2026. Les fichiers restent sur SharePoint (${esc(ANC.source)}), en lecture seule. Ils servent de source pour écrire, pas de modèle à recopier.</p>
      ${ANC.fiches.length ? `<table class="liste" id="anciennes"><thead><tr><th>Fichier</th><th>Marque</th><th>Client</th><th>Ce qui est vendu</th><th>Prix</th></tr></thead><tbody>${Object.entries(groupes).map(([g, fs]) => `<tr class="groupe"><td colspan="5"><b>${esc(g)}</b></td></tr>` + fs.map(f => `<tr><td><b>${esc(f.Fichier)}</b>${f.Slides && f.Slides !== '–' ? `<br><span class="discret">${esc(f.Slides)} slides</span>` : ''}</td><td>${esc(f.Marque)}</td><td>${esc(f.Client || '–')}</td><td>${esc(f['Ce qui est vendu'])}</td><td class="discret">${esc(f.Prix)}</td></tr>`).join('')).join('')}</tbody></table>` : '<p class="vide">La note d’analyse des anciennes propals est introuvable.</p>'}
    </section></div>`;
}

/* ---------- vues et messages ---------- */
function montrer(v) {
  if (v === 'propal' && !S) { ouvrir(nouvelle()); return; }
  $$('.vue').forEach(x => x.classList.toggle('active', x.id === 'vue-' + v));
  $$('.onglets [data-vue]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.vue === v)));
  if (v === 'bibliotheque') rendreBibliotheque();
  else echelle();
}
let minuteurMsg = null;
function message(t, erreur, duree) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.toggle('erreur', !!erreur);
  el.classList.add('visible');
  clearTimeout(minuteurMsg);
  minuteurMsg = setTimeout(() => el.classList.remove('visible'), duree || (erreur ? 5200 : 2600));
}
function echelle() {
  const p = $('#planches');
  if (!p.clientWidth) return;
  const k = Math.min(1, (p.clientWidth - 64) / 1280);
  p.style.setProperty('--k', Math.max(0.2, k).toFixed(4));
}
function allerA(P, el) {
  P.page.scrollIntoView({behavior: 'smooth', block: 'start'});
  if (el && el.classList.contains('champ')) setTimeout(() => el.focus({preventScroll: true}), 400);
}

/* ---------- événements ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-u]');
  if (!t) return;
  const a = t.dataset;
  if (a.vue) montrer(a.vue);
  else if (a.action === 'pdf') telechargerPDF();
  else if (a.action === 'fichier') { if (S) exporter(S); else message('Ouvrez ou créez d’abord une propal.', true); }
  else if (a.action === 'nouvelle') ouvrir(nouvelle());
  else if (a.action === 'ouvrir-fichier') { $('#choix-fichier').value = ''; $('#choix-fichier').click(); }
  else if (a.action === 'ordre-origine') {
    if (!confirm('Remettre toutes les pages dans l’ordre d’origine ?')) return;
    S.ordre = null;
    changer();
    message('Les pages sont revenues dans l’ordre d’origine.');
  }
  else if (a.action === 'bundle-enregistrer') enregistrerBundle();
  else if (a.action === 'autre-ajouter') ajouterAutre();
  else if (a.deplacer) decaler(t.closest('.page')._P, +a.deplacer, false);
  else if (a.deplacerCle) decaler(PAGES.find(p => p.cle === a.deplacerCle), +a.sens, true);
  else if (a.autreRetirer) { S.bundle.autres = S.bundle.autres.filter(x => x.id !== a.autreRetirer); changer(); }
  else if (a.bundleExporter) { const b = lireBundles().find(x => x.id === a.bundleExporter); if (b) exporterBundle(b); }
  else if (a.bundleSupprimer) {
    const b = lireBundles().find(x => x.id === a.bundleSupprimer);
    if (!b || !confirm(`Supprimer le bundle « ${b.nom} » de ce navigateur ?\nLes propals faites avec gardent leur matériel. Si vous voulez le garder, enregistrez d’abord le fichier.`)) return;
    ecrireBundles(lireBundles().filter(x => x.id !== b.id));
    rendreBibliotheque();
  }
  else if (a.ouvrir) { const p = STOCK.lire(kPropal(a.ouvrir)); if (p) ouvrir(p); else message('Cette propal n’est plus dans le navigateur.', true); }
  else if (a.dupliquer) {
    const p = STOCK.lire(kPropal(a.dupliquer));
    if (!p) return;
    const n = normaliser(p), now = new Date().toISOString();
    Object.assign(n, {id: nouvelle().id, cree: now, modifie: now});
    n.infos.projet = (n.infos.projet ? n.infos.projet + ' ' : '') + '(copie)';
    ouvrir(n); sauver(); message('Copie créée : modifiez-la sans toucher à l’originale.');
  }
  else if (a.exporter) { const p = STOCK.lire(kPropal(a.exporter)); if (p) exporter(normaliser(p)); }
  else if (a.supprimer) {
    const x = (STOCK.lire(K_INDEX) || []).find(i => i.id === a.supprimer);
    if (!confirm(`Supprimer la propal « ${(x && x.client) || 'sans nom'} » de ce navigateur ?\nSi vous voulez la garder, enregistrez d’abord le fichier.`)) return;
    STOCK.retirer(kPropal(a.supprimer));
    STOCK.ecrire(K_INDEX, (STOCK.lire(K_INDEX) || []).filter(i => i.id !== a.supprimer));
    if (S && S.id === a.supprimer) { S = null; STOCK.retirer(K_DERNIERE); }
    rendreBibliotheque();
  }
  else if (a.aller) { const P = PAGES.find(p => p.src === GEN && p.nom === a.aller); if (P) allerA(P); }
  else if (a.allerCle) { const P = PAGES.find(p => p.cle === a.allerCle); if (P) allerA(P); }
  else if (a.verif) { const v = VERIFS[+a.verif]; if (v && v.aller) allerA(v.aller._page, v.aller); }
  else if (t.classList.contains('retirer-image')) { const z = t.closest('[data-image]'); delete S.images[z._cle]; changer(); e.stopPropagation(); }
  else if (t.matches('.slide .cb[data-u]')) basculer(t);
  else if (t.matches('.slide [data-image]')) { zoneImage = t; $('#choix-image').value = ''; $('#choix-image').click(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.matches('#panneau [data-module]')) {
    const st = etatModule(MODULES.find(m => m.cle === t.dataset.module));
    const m = MODULES.find(x => x.cle === t.dataset.module), pt = t.dataset.partie && m.parties.find(p => p.id === t.dataset.partie);
    const avant = new Set(PAGES.filter(P => P.visible).map(P => P.cle));
    if (t.dataset.partie) st.parties[t.dataset.partie] = t.checked; else st.on = t.checked;
    const f = t.dataset.partie ? `[data-module="${t.dataset.module}"][data-partie="${t.dataset.partie}"]` : `[data-module="${t.dataset.module}"]:not([data-partie])`;
    changer();
    const r = $('#p-solutions ' + f); if (r) r.focus({preventScroll: true});
    signaler(avant, pt ? pt.titre : m.court);
  } else if (t.matches('#panneau [data-fiche]')) {
    const avant = new Set(PAGES.filter(P => P.visible).map(P => P.cle));
    const P = PAGES.find(p => p.produit === t.dataset.fiche);
    if (t.checked) S.fiches[t.dataset.fiche] = true; else delete S.fiches[t.dataset.fiche];
    changer();
    const r = $(`#p-fiches [data-fiche="${t.dataset.fiche}"]`); if (r) r.focus({preventScroll: true});
    signaler(avant, P.nom);
  } else if (t.matches('#panneau input[name="maintenance"]')) {
    const avant = new Set(PAGES.filter(P => P.visible).map(P => P.cle));
    S.maintenance = t.value;
    delete S.cases[page(NOM_OFFRE).unites.get(12)._cle];
    changer();
    signaler(avant, t.value === 'oui' ? 'Avec contrat de maintenance' : 'Sans contrat de maintenance');
  } else if (t.matches('#panneau [data-bundle-on]')) {
    const avant = new Set(PAGES.filter(P => P.visible).map(P => P.cle));
    S.bundle.on = t.checked;
    changer();
    signaler(avant, 'Matériel proposé');
  } else if (t.matches('#p-bundle [data-bundle-produit]')) {
    const k = t.dataset.bundleProduit;
    if (t.checked) S.bundle.items[k] = S.bundle.items[k] || 1; else delete S.bundle.items[k];
    changer();
  } else if (t.matches('#p-bundle [data-bundle-qte], #p-bundle [data-autre-qte]')) {
    // En quittant la case, elle montre la quantité retenue (une case vidée revient à la dernière quantité valable).
    t.value = t.dataset.bundleQte ? S.bundle.items[t.dataset.bundleQte] : ((S.bundle.autres.find(x => x.id === t.dataset.autreQte) || {}).qte || 1);
  } else if (t.matches('#p-bundle [data-bundle-choix]')) {
    const b = lireBundles().find(x => x.id === t.value);
    t.value = '';
    if (b) chargerBundle(b);
  } else if (t.matches('[data-ajout-on]')) {
    const cle = t.closest('.ajout').dataset.ajout;
    S.ajouts[cle] = Object.assign(S.ajouts[cle] || {}, {on: t.checked});
    changer();
  } else if (t.matches('[data-retirer]')) {
    const k = t.dataset.retirer;
    if (t.checked) delete S.retirees[k]; else S.retirees[k] = true;
    changer();
    const r = $(`#p-pages [data-retirer="${CSS.escape(k)}"]`); if (r) r.focus({preventScroll: true});
  } else if (t.matches('.page-garder input')) {
    const P = t.closest('.page')._P;
    if (t.checked) delete S.retirees[P.cle]; else S.retirees[P.cle] = true;
    changer();
  } else if (t.id === 'choix-image') {
    const f = t.files[0];
    if (!f || !zoneImage || !S) return;
    try { S.images[zoneImage._cle] = await reduireImage(f); changer(); }
    catch (err) { message('Cette image ne peut pas être lue. Essayez un fichier JPEG ou PNG.', true); }
  } else if (t.id === 'choix-fichier') {
    const f = t.files[0];
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (p && p.format === 'bundle-green-cube') { importerBundle(p); return; }
      if (!p || p.format !== 'propal-green-cube') throw new Error('format');
      ouvrir(p); sauver(); message('Propal ouverte depuis le fichier.');
    } catch (err) { message('Ce fichier n’est ni une propal ni un bundle enregistrés depuis ce site.', true); }
  }
});
document.addEventListener('beforeinput', e => {
  const u = e.target;
  if (!u.matches || !u.matches('.slide .champ[data-u]') || u.textContent.trim() !== u._phTexte) return;
  let t = null;
  if (/^insert(Text|FromPaste|ReplacementText|FromDrop)$/.test(e.inputType)) t = e.data != null ? e.data : (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
  else if (e.inputType.startsWith('delete')) t = '';
  if (t == null) return;
  e.preventDefault();
  u.textContent = t;
  caretFin(u);
  u.dispatchEvent(new Event('input', {bubbles: true}));
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('#panneau [data-info]')) { S.infos[t.dataset.info] = t.value.trim(); changer(); return; }
  if (t.matches('#p-bundle [data-bundle-qte], #p-bundle [data-autre-qte]')) {
    const v = parseInt(t.value, 10);
    if (!(v >= 1)) return;                              // case vide le temps de taper : rien ne change
    if (t.dataset.bundleQte) S.bundle.items[t.dataset.bundleQte] = Math.min(999, v);
    else { const a = S.bundle.autres.find(x => x.id === t.dataset.autreQte); if (a) a.qte = Math.min(999, v); }
    changer();
    return;
  }
  if (t.matches('[data-ajout-nom], [data-ajout-prix]')) {
    // Taper un nom ou un prix coche la case : la solution part dans le comparatif.
    const cle = t.closest('.ajout').dataset.ajout, v = S.ajouts[cle] || (S.ajouts[cle] = {});
    v[t.matches('[data-ajout-nom]') ? 'nom' : 'prix'] = t.value;
    if (t.value.trim()) v.on = true;
    changer();
    return;
  }
  if (t.id === 'filtre-anciennes') {
    const q = t.value.trim().toLowerCase();
    $$('#anciennes tbody tr').forEach(tr => { tr.hidden = !!q && (tr.classList.contains('groupe') || !tr.textContent.toLowerCase().includes(q)); });
    return;
  }
  if (!t.matches('.slide .champ[data-u]')) return;
  const x = exces(t);
  if (x > 0.5 && x > (t._exces || 0) + 0.5) {
    t.textContent = t._bon;
    caretFin(t);
    message('Le texte est trop long pour cet emplacement : raccourcissez-le.', true);
    return;
  }
  t._exces = x;
  t._bon = t.textContent;
  t._modifie = true;
  enregistrerValeur(t, t.textContent, false);
});
document.addEventListener('focusin', e => {
  const u = e.target;
  // Une quantité se remplace en tapant par-dessus.
  if (u.matches && u.matches('#p-bundle .qte, #p-bundle [data-autre-champ="qte"]')) { requestAnimationFrame(() => { if (document.activeElement === u) u.select(); }); return; }
  if (!u.matches || !u.matches('.slide .champ[data-u]')) return;
  u._modifie = false;
  u._avant = u.textContent;
  u._bon = u.classList.contains('rempli') ? u.textContent : '';
  u._exces = exces(u);
  if (!u.classList.contains('rempli') || u.classList.contains('auto')) requestAnimationFrame(() => {   // un montant calculé se remplace en tapant par-dessus
    if (document.activeElement !== u || u.textContent !== u._avant) return;   // déjà tapé avant l'image suivante : on ne sélectionne pas
    const r = document.createRange(), sel = getSelection();
    r.selectNodeContents(u); sel.removeAllRanges(); sel.addRange(r);
  });
});
document.addEventListener('focusout', e => {
  const u = e.target;
  if (!u.matches || !u.matches('.slide .champ[data-u]')) return;
  if (u._modifie) enregistrerValeur(u, u.textContent, true); else rendreUnite(u);
  u._modifie = false;
  setTimeout(() => { if (document.activeElement !== u) rendreUnite(u); });
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (!t.matches) return;
  if (e.key === 'Enter' && t.matches('#p-bundle [data-autre-champ]')) { e.preventDefault(); ajouterAutre(); return; }
  if (e.key === 'Enter' && t.matches('#p-bundle [data-bundle-nom]')) { e.preventDefault(); enregistrerBundle(); return; }
  if (t.matches('.slide .champ[data-u]')) {
    if (e.key === 'Enter') { e.preventDefault(); t.blur(); }
    else if (e.key === 'Escape') { t.textContent = t._avant; t._modifie = false; t.blur(); }
  } else if (t.matches('.slide .cb[data-u], .slide [data-image]') && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    t.click();
  }
});
// Glisser une ligne de la liste des pages (bloc 8) au-dessus ou au-dessous d'une autre.
let glisse = null;
const ligneSous = e => glisse && e.target.closest && e.target.closest('#p-pages .ligne-page');
const effacerCibles = () => $$('#p-pages .glisse, #p-pages .cible-avant, #p-pages .cible-apres').forEach(x => x.classList.remove('glisse', 'cible-avant', 'cible-apres'));
document.addEventListener('dragstart', e => {
  const l = e.target.closest && e.target.closest('#p-pages .ligne-page');
  if (!l) return;
  glisse = l.dataset.cle;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', glisse);
  l.classList.add('glisse');
});
document.addEventListener('dragover', e => {
  const l = ligneSous(e);
  $$('#p-pages .cible-avant, #p-pages .cible-apres').forEach(x => { if (x !== l) x.classList.remove('cible-avant', 'cible-apres'); });
  if (!l || l.dataset.cle === glisse) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const r = l.getBoundingClientRect(), apres = e.clientY > r.top + r.height / 2;
  l.classList.toggle('cible-apres', apres);
  l.classList.toggle('cible-avant', !apres);
});
document.addEventListener('drop', e => {
  const l = ligneSous(e);
  if (!l) return;
  e.preventDefault();
  const P = PAGES.find(p => p.cle === glisse), C = PAGES.find(p => p.cle === l.dataset.cle), apres = l.classList.contains('cible-apres');
  glisse = null;
  effacerCibles();
  if (!P || !C || P === C) return;
  deplacer(P, C, apres);
  changer();
  annoncerPlace(P);
  P.page.scrollIntoView({block: 'start'});
});
document.addEventListener('dragend', () => { glisse = null; effacerCibles(); });
new ResizeObserver(echelle).observe($('#planches'));

/* ---------- démarrage ---------- */
construire();
construirePanneau();
const derniere = STOCK.lire(K_DERNIERE);
const p = derniere && STOCK.lire(kPropal(derniere));
if (p) ouvrir(p); else montrer('bibliotheque');
})();

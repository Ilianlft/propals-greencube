/* Site des propals : fabrique le PDF dans le navigateur, sans fenêtre d'impression, sans serveur, sans rien envoyer en ligne.
   Chaque slide est relue telle que le navigateur l'a mise en page (position de chaque lettre, formes, photos), puis écrite
   en PDF : le texte reste net et sélectionnable, et chaque page fait toujours 1280 × 720 px, soit 960 × 540 points.
   Un site ouvert par double-clic ne peut pas relire ses propres images et polices : outils/preparer-pdf.js les prépare dans data/pdf/. */
'use strict';
window.PropalPDF = (() => {
const LARGEUR = 1280, HAUTEUR = 720, PT = 0.75;
const octets = s => new TextEncoder().encode(s);
const n = v => String(+v.toFixed(3));
const colle = v => Math.round(v + 1e-3);
const hex4 = v => v.toString(16).toUpperCase().padStart(4, '0');
const pause = () => new Promise(r => setTimeout(r));
const concat = morceaux => {
  const t = new Uint8Array(morceaux.reduce((s, m) => s + m.length, 0));
  let p = 0;
  for (const m of morceaux) { t.set(m, p); p += m.length; }
  return t;
};
async function comprimer(brut) {
  const flux = new Blob([brut]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
const depuisBase64 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));

/* ---------- données préparées par outils/preparer-pdf.js ---------- */
const recues = new Map();
window.__pdfDonnee = (id, d) => recues.set(id, d);
const script = src => new Promise((ok, ko) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = () => { s.remove(); ok(); };
  s.onerror = () => { s.remove(); ko(new Error('fichier manquant : ' + src)); };
  document.head.append(s);
});
async function donnee(id) {
  if (!recues.has(id)) await script(`data/pdf/${id}.js`);
  return recues.get(id);
}

/* ---------- polices ---------- */
function lireCmap(dv, base) {
  let choix = null, rang = -1;
  for (let i = 0, nb = dv.getUint16(base + 2); i < nb; i++) {
    const pos = base + dv.getUint32(base + 8 + i * 8), f = dv.getUint16(pos);
    const r = f === 12 ? 2 : f === 4 ? 1 : 0;
    if (r > rang) { rang = r; choix = pos; }
  }
  const m = new Map();
  if (dv.getUint16(choix) === 12) {
    for (let j = 0, nb = dv.getUint32(choix + 12); j < nb; j++) {
      const p = choix + 16 + j * 12, deb = dv.getUint32(p), fin = dv.getUint32(p + 4), g = dv.getUint32(p + 8);
      for (let c = deb; c <= fin; c++) m.set(c, g + c - deb);
    }
  } else {
    const seg = dv.getUint16(choix + 6), fins = choix + 14, debs = fins + seg + 2, deltas = debs + seg, ranges = deltas + seg;
    for (let s = 0; s < seg; s += 2) {
      const fin = dv.getUint16(fins + s), deb = dv.getUint16(debs + s), delta = dv.getUint16(deltas + s), ro = dv.getUint16(ranges + s);
      for (let c = deb; c <= fin && c !== 0xFFFF; c++) {
        let g = ro === 0 ? (c + delta) & 0xFFFF : dv.getUint16(ranges + s + ro + 2 * (c - deb));
        if (ro && g) g = (g + delta) & 0xFFFF;
        if (g) m.set(c, g);
      }
    }
  }
  return m;
}
function lirePolice(o) {
  const dv = new DataView(o.buffer, o.byteOffset, o.byteLength), tables = {};
  for (let i = 0, nb = dv.getUint16(4); i < nb; i++) {
    const p = 12 + i * 16;
    tables[String.fromCharCode(o[p], o[p + 1], o[p + 2], o[p + 3])] = {pos: dv.getUint32(p + 8), long: dv.getUint32(p + 12)};
  }
  const head = tables.head.pos, hhea = tables.hhea.pos, nbMetriques = dv.getUint16(hhea + 34), upm = dv.getUint16(head + 18);
  const os2 = tables['OS/2'] ? tables['OS/2'].pos : null, v = i => dv.getInt16(i) * 1000 / upm;
  return {
    o, dv, tables, upm, nbGlyphes: dv.getUint16(tables.maxp.pos + 4), locaLong: dv.getInt16(head + 50) === 1,
    avance: g => dv.getUint16(tables.hmtx.pos + 4 * Math.min(g, nbMetriques - 1)) * 1000 / upm,
    cmap: lireCmap(dv, tables.cmap.pos),
    boite: [v(head + 36), v(head + 38), v(head + 40), v(head + 42)],
    ascendante: v(hhea + 4), descendante: v(hhea + 6),
    capitale: os2 !== null && dv.getUint16(os2) >= 2 ? v(os2 + 88) : v(hhea + 4),
    pente: tables.post ? dv.getInt32(tables.post.pos + 4) / 65536 : 0,
  };
}
// Ne garde que les lettres utilisées : les numéros de glyphes restent les mêmes, le fichier est bien plus léger.
function sousEnsemble(P, utilises) {
  const {o, dv, tables} = P;
  const loca = g => P.locaLong ? dv.getUint32(tables.loca.pos + 4 * g) : 2 * dv.getUint16(tables.loca.pos + 2 * g);
  const garder = new Set([0, ...utilises]);
  for (const g of garder) {
    const deb = loca(g);
    if (loca(g + 1) <= deb || dv.getInt16(tables.glyf.pos + deb) >= 0) continue;
    let p = tables.glyf.pos + deb + 10;
    for (;;) {                                     // lettre composée (é = e + ´) : ses morceaux suivent
      const drapeaux = dv.getUint16(p);
      garder.add(dv.getUint16(p + 2));
      p += 4 + (drapeaux & 1 ? 4 : 2) + (drapeaux & 8 ? 2 : drapeaux & 0x40 ? 4 : drapeaux & 0x80 ? 8 : 0);
      if (!(drapeaux & 0x20)) break;
    }
  }
  const nvLoca = new Uint8Array(4 * (P.nbGlyphes + 1)), dvl = new DataView(nvLoca.buffer), morceaux = [];
  let pos = 0;
  for (let g = 0; g < P.nbGlyphes; g++) {
    dvl.setUint32(4 * g, pos);
    const deb = loca(g), fin = loca(g + 1);
    if (!garder.has(g) || fin <= deb) continue;
    morceaux.push(o.subarray(tables.glyf.pos + deb, tables.glyf.pos + fin));
    pos += fin - deb;
    const bourrage = (4 - (fin - deb) % 4) % 4;
    if (bourrage) { morceaux.push(new Uint8Array(bourrage)); pos += bourrage; }
  }
  dvl.setUint32(4 * P.nbGlyphes, pos);
  const copie = t => o.slice(tables[t].pos, tables[t].pos + tables[t].long);
  const head = copie('head'), dvh = new DataView(head.buffer);
  dvh.setUint32(8, 0);
  dvh.setInt16(50, 1);
  const t = {glyf: concat(morceaux), head, loca: nvLoca};
  for (const nom of ['cvt ', 'fpgm', 'hhea', 'hmtx', 'maxp', 'prep']) if (tables[nom]) t[nom] = copie(nom);
  const noms = Object.keys(t).sort(), nb = noms.length, e = Math.floor(Math.log2(nb));
  const entete = new Uint8Array(12 + 16 * nb), dve = new DataView(entete.buffer);
  dve.setUint32(0, 0x00010000);
  dve.setUint16(4, nb);
  dve.setUint16(6, 16 * 2 ** e);
  dve.setUint16(8, e);
  dve.setUint16(10, 16 * nb - 16 * 2 ** e);
  const corps = [];
  let decalage = entete.length;
  noms.forEach((nom, i) => {
    const d = t[nom], complet = new Uint8Array(d.length + (4 - d.length % 4) % 4);
    complet.set(d);
    const dvc = new DataView(complet.buffer);
    let somme = 0;
    for (let k = 0; k < complet.length; k += 4) somme = (somme + dvc.getUint32(k)) >>> 0;
    const p = 12 + i * 16;
    for (let k = 0; k < 4; k++) entete[p + k] = nom.charCodeAt(k);
    dve.setUint32(p + 4, somme);
    dve.setUint32(p + 8, decalage);
    dve.setUint32(p + 12, d.length);
    corps.push(complet);
    decalage += complet.length;
  });
  return concat([entete, ...corps]);
}

/* ---------- le document ---------- */
function nouveauDocument() {
  const D = {
    objets: [null, null, null, null],           // 1 catalogue, 2 pages, 3 infos, 4 ressources
    pages: [], faces: new Map(), images: new Map(), etats: new Map(), degrades: new Map(), reperes: new Map(), manquants: new Set(),
    ajouter(dict, flux, brut) { D.objets.push({dict, flux, brut}); return D.objets.length; },
  };
  return D;
}
// La même règle que le navigateur : la graisse la plus proche, d'abord vers le gras pour un texte gras, d'abord vers le fin sinon.
function choisirFace(D, famille, poids, italique) {
  let liste = [...D.faces.keys()].filter(f => f.famille === famille);
  if (!liste.length) liste = [...D.faces.keys()].filter(f => f.famille === 'Montserrat');
  const memeStyle = liste.filter(f => f.italique === italique);
  if (memeStyle.length) liste = memeStyle;
  const cout = f => (poids >= 600 ? (f.poids >= poids ? f.poids - poids : 1000 + poids - f.poids)
                                  : (f.poids <= poids ? poids - f.poids : 1000 + f.poids - poids));
  return liste.slice().sort((a, b) => cout(a) - cout(b))[0];
}
const parseCouleur = t => {
  const m = String(t).match(/rgba?\(([^)]+)\)/);
  if (!m) return {r: 0, g: 0, b: 0, a: 0};
  const v = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
  return {r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1};
};
const rvb = c => `${n(c.r / 255)} ${n(c.g / 255)} ${n(c.b / 255)}`;
function etat(D, alpha) {
  if (alpha >= 0.999) return '';
  const cle = Math.round(alpha * 1000);
  if (!D.etats.has(cle)) D.etats.set(cle, `/G${cle}`);
  return `${D.etats.get(cle)} gs `;
}
function chemin(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `${n(x)} ${n(y)} ${n(w)} ${n(h)} re`;
  const k = r * 0.4477, X = x + w, Y = y + h;
  return `${n(x + r)} ${n(y)} m ${n(X - r)} ${n(y)} l ${n(X - k)} ${n(y)} ${n(X)} ${n(y + k)} ${n(X)} ${n(y + r)} c `
    + `${n(X)} ${n(Y - r)} l ${n(X)} ${n(Y - k)} ${n(X - k)} ${n(Y)} ${n(X - r)} ${n(Y)} c `
    + `${n(x + r)} ${n(Y)} l ${n(x + k)} ${n(Y)} ${n(x)} ${n(Y - k)} ${n(x)} ${n(Y - r)} c `
    + `${n(x)} ${n(y + r)} l ${n(x)} ${n(y + k)} ${n(x + k)} ${n(y)} ${n(x + r)} ${n(y)} c h`;
}

/* ---------- images ---------- */
function infosJPEG(o) {
  let p = 2;
  while (p < o.length) {
    if (o[p] !== 0xFF) { p++; continue; }
    const m = o[p + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
      return {h: (o[p + 5] << 8) | o[p + 6], l: (o[p + 7] << 8) | o[p + 8], composantes: o[p + 9]};
    p += 2 + ((o[p + 2] << 8) | o[p + 3]);
  }
  throw new Error('photo illisible');
}
function ajouterJPEG(D, o) {
  const i = infosJPEG(o);
  const espace = i.composantes === 1 ? '/DeviceGray' : '/DeviceRGB';
  return D.ajouter(`<< /Type /XObject /Subtype /Image /Width ${i.l} /Height ${i.h} /ColorSpace ${espace} /BitsPerComponent 8 /Filter /DCTDecode >>`, o);
}
// Une image à transparence (pictos, logos) : les couleurs d'un côté, la transparence de l'autre.
async function ajouterBitmap(D, o, type) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d', {willReadFrequently: true});
  if (type === 'image/svg+xml') {
    // Un picto en SVG : createImageBitmap ne le lit pas ; on le dessine à 800 px de large, net à l'impression.
    const url = URL.createObjectURL(new Blob([o], {type}));
    try {
      const im = new Image();
      im.src = url;
      await im.decode();
      c.width = 800; c.height = Math.max(1, Math.round(800 * (im.naturalHeight || 1) / (im.naturalWidth || 1)));
      g.drawImage(im, 0, 0, c.width, c.height);
    } finally { URL.revokeObjectURL(url); }
  } else {
    const bmp = await createImageBitmap(new Blob([o], {type}));
    c.width = bmp.width; c.height = bmp.height;
    g.drawImage(bmp, 0, 0);
  }
  const px = g.getImageData(0, 0, c.width, c.height).data, nb = c.width * c.height;
  const couleurs = new Uint8Array(nb * 3), alpha = new Uint8Array(nb);
  let opaque = true, sr = 0, sg = 0, sb = 0, vus = 0;
  for (let i = 0; i < nb; i++) {
    const a = px[i * 4 + 3];
    alpha[i] = a;
    if (a < 255) opaque = false;
    if (a) { sr += px[i * 4]; sg += px[i * 4 + 1]; sb += px[i * 4 + 2]; vus++; }
  }
  if (opaque && o.length > 300000) {            // une grande image sans transparence : le JPEG est bien plus léger
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
    return ajouterJPEG(D, new Uint8Array(await b.arrayBuffer()));
  }
  const mr = vus ? sr / vus : 0, mg = vus ? sg / vus : 0, mb = vus ? sb / vus : 0;   // évite un liseré sombre autour des zones transparentes
  for (let i = 0; i < nb; i++) {
    const a = alpha[i];
    couleurs[i * 3] = a ? px[i * 4] : mr;
    couleurs[i * 3 + 1] = a ? px[i * 4 + 1] : mg;
    couleurs[i * 3 + 2] = a ? px[i * 4 + 2] : mb;
  }
  const taille = `/Width ${c.width} /Height ${c.height} /BitsPerComponent 8`;
  const masque = opaque ? '' : ` /SMask ${D.ajouter(`<< /Type /XObject /Subtype /Image ${taille} /ColorSpace /DeviceGray /Filter /FlateDecode >>`, await comprimer(alpha))} 0 R`;
  return D.ajouter(`<< /Type /XObject /Subtype /Image ${taille} /ColorSpace /DeviceRGB /Filter /FlateDecode${masque} >>`, await comprimer(couleurs));
}
async function preparerImage(D, index, src) {
  if (D.images.has(src)) return;
  let o, type;
  if (src.startsWith('data:')) {
    const m = src.match(/^data:([^;,]+);base64,(.*)$/s);
    if (!m) throw new Error('image ajoutée illisible');
    type = m[1]; o = depuisBase64(m[2]);
  } else {
    const id = index.images[src];
    if (!id) throw new Error(`image non préparée (${src}) : relancer outils/assembler.js`);
    const d = await donnee(id);
    type = d.t === 'jpg' ? 'image/jpeg' : d.t === 'svg' ? 'image/svg+xml' : 'image/png'; o = depuisBase64(d.d);
    recues.delete(id);
  }
  const num = type === 'image/jpeg' ? ajouterJPEG(D, o) : await ajouterBitmap(D, o, type);
  D.images.set(src, {num, nom: `/Im${D.images.size + 1}`});
}
// Un fondu vertical (.bake) : une colonne de couleurs et sa transparence, étirées sur la zone.
function degrade(D, h, b) {
  if (!D.degrades.has(h)) {
    const c = [...h.matchAll(/rgba?\([^)]+\)/g)].map(m => parseCouleur(m[0]));
    const coul = new Uint8Array(256 * 3), alpha = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      coul[i * 3] = c[0].r + (c[1].r - c[0].r) * t;
      coul[i * 3 + 1] = c[0].g + (c[1].g - c[0].g) * t;
      coul[i * 3 + 2] = c[0].b + (c[1].b - c[0].b) * t;
      alpha[i] = 255 * (c[0].a + (c[1].a - c[0].a) * t);
    }
    const taille = '/Width 1 /Height 256 /BitsPerComponent 8 /Interpolate true';
    const m = D.ajouter(`<< /Type /XObject /Subtype /Image ${taille} /ColorSpace /DeviceGray /Filter /FlateDecode >>`, null, alpha);
    const num = D.ajouter(`<< /Type /XObject /Subtype /Image ${taille} /ColorSpace /DeviceRGB /Filter /FlateDecode /SMask ${m} 0 R >>`, null, coul);
    D.degrades.set(h, {num, nom: `/Fd${D.degrades.size + 1}`});
  }
  return `${n(b.w)} 0 0 ${n(-b.h)} ${n(b.x)} ${n(b.y + b.h)} cm ${D.degrades.get(h).nom} Do`;
}

/* ---------- lecture d'une slide ---------- */
const MASQUES = '.champ:not(.rempli), .vide-impr, [data-image]:not(.a-image), .retirer-image, aside.notes, .ecran-seul';
// Pas de fond pour les zones à remplir (à l'écran, elles s'éclairent au survol). Les cases à cocher gardent le leur :
// en nouvelle charte, une case sur le papier est blanche.
const SANS_FOND = '.champ, [data-image]';
const FONDU = /^linear-gradient\((?:180deg, )?rgba?\([^)]+\) 0%, rgba?\([^)]+\) 100%\)$/;
const LIGATURES = {fi: 0xFB01, fl: 0xFB02};

// La distance entre le haut d'une lettre mesurée et sa ligne de base dépend de la police et de la taille : on la mesure une fois.
function repere(D, cs, taille) {
  const cle = [cs.fontFamily, cs.fontWeight, cs.fontStyle, taille].join('|');
  if (!D.reperes.has(cle)) {
    const m = document.createElement('div');
    m.style.cssText = `position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;line-height:normal;font-family:${cs.fontFamily.replace(/"/g, "'")};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};font-size:${taille}px`;
    m.innerHTML = 'Hg<i style="display:inline-block;width:0;height:0"></i>';
    document.body.append(m);
    const r = document.createRange();
    r.selectNode(m.firstChild);
    D.reperes.set(cle, m.lastChild.getBoundingClientRect().bottom - r.getBoundingClientRect().top);
    m.remove();
  }
  return D.reperes.get(cle);
}
// Le sens d'un texte vertical (writing-mode) : de bas en haut quand une rotation d'un demi-tour le retourne, comme le texte
// du bord gauche des slides (.dos : vertical-rl puis rotate(180deg)). L'échelle d'affichage de la slide n'est pas une rotation.
function sensVertical(el) {
  let retourne = false;
  for (let e = el; e && !e.classList.contains('slide'); e = e.parentElement) {
    const m = getComputedStyle(e).transform.match(/^matrix\(([^,]+),/);
    if (m && parseFloat(m[1]) < 0) retourne = !retourne;
  }
  return retourne ? 'monte' : 'descend';
}
function dessinerTexte(D, sortie, noeud, cs, op, o) {
  const t = noeud.nodeValue;
  if (!/\S/.test(t)) return;
  const coul = parseCouleur(cs.color), a = coul.a * op;
  // Un texte en contour (les numéros de la nouvelle charte : couleur transparente, -webkit-text-stroke) : on trace le contour des lettres.
  const epTrait = parseFloat(cs.webkitTextStrokeWidth) || 0, coulTrait = parseCouleur(cs.webkitTextStrokeColor || ''), aTrait = coulTrait.a * op;
  const contour = epTrait > 0 && aTrait > 0;
  if (a <= 0 && !contour) return;
  const poids = parseInt(cs.fontWeight, 10) || 400, italique = cs.fontStyle === 'italic';
  const famille = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const face = choisirFace(D, famille, poids, italique), secours = choisirFace(D, 'Montserrat', 400, false);
  const P = D.faces.get(face), majuscules = cs.textTransform === 'uppercase';
  const taille = parseFloat(cs.fontSize), base = repere(D, cs, taille);
  const gras = poids >= 600 && face.poids < 600, penche = italique && !face.italique;
  // Texte vertical : la position le long de la ligne se lit sur l'axe vertical de l'écran, la ligne de base sur l'axe horizontal.
  const vertical = /^vertical/.test(cs.writingMode) ? sensVertical(noeud.parentElement) : null;
  const r = document.createRange();
  let ligne = null;
  const fermer = () => {
    if (!ligne || !ligne.g.length) { ligne = null; return; }
    const F = D.faces.get(ligne.face), tj = [];
    ligne.g.forEach((e, i) => {
      tj.push(`<${hex4(e.g)}>`);
      if (i < ligne.g.length - 1) {
        const ecart = F.avance(e.g) - (ligne.g[i + 1].x - e.x) / taille * 1000;
        if (Math.abs(ecart) >= 0.05) tj.push(n(ecart));
      }
    });
    let style, peinture;
    if (contour) {
      style = `${a > 0 ? 2 : 1} Tr ${n(epTrait)} w ${rvb(coulTrait)} RG `;
      peinture = `${etat(D, a > 0 ? a : aTrait)}${a > 0 ? rvb(coul) + ' rg ' : ''}`;
    } else {
      style = gras ? `2 Tr ${n(taille / 28)} w ${rvb(coul)} RG ` : '';
      peinture = `${etat(D, a)}${rvb(coul)} rg `;
    }
    const x0 = ligne.g[0].x, y = ligne.y;
    const tm = vertical === 'monte' ? `0 -1 -1 0 ${n(y)} ${n(-x0)}` : vertical ? `0 1 1 0 ${n(y)} ${n(x0)}` : `1 0 ${penche ? '0.2' : '0'} -1 ${n(x0)} ${n(y)}`;
    sortie.push(`q ${peinture}BT ${style}${ligne.face.ref} ${n(taille)} Tf ${tm} Tm [${tj.join('')}] TJ ET Q`);
    ligne = null;
  };
  const poser = (f, g, x, y, texte) => {
    if (ligne && (ligne.face !== f || Math.abs(ligne.y - y) > 0.5)) fermer();
    if (!ligne) ligne = {face: f, y, g: []};
    ligne.g.push({g, x});
    f.utilises.set(g, texte);
  };
  const ligatures = !majuscules && !(parseFloat(cs.letterSpacing) || 0);
  for (let i = 0; i < t.length;) {
    const cp = t.codePointAt(i), long = cp > 0xFFFF ? 2 : 1, deb = i;
    r.setStart(noeud, i); r.setEnd(noeud, i + long);
    i += long;
    const rects = r.getClientRects();
    if (!rects.length) continue;
    const q = rects[rects.length - 1];
    if (q.width <= 0 || q.height <= 0) continue;
    // x : la position le long de la ligne (croissante dans le sens de lecture) ; y : la ligne de base.
    // Texte vertical qui monte : le haut des lettres est à gauche, chaque lettre part du bas de sa boîte.
    const x = vertical === 'monte' ? -(q.bottom - o.y) / o.k : vertical ? (q.top - o.y) / o.k : (q.left - o.x) / o.k;
    const y = vertical === 'monte' ? colle((q.left - o.x) / o.k) + base : vertical ? colle((q.right - o.x) / o.k) - base : colle((q.top - o.y) / o.k) + base;
    // Ligature fi ou fl : le navigateur partage sa largeur à parts égales entre les deux lettres.
    const lig = ligatures && P.cmap.get(LIGATURES[t.substr(deb, 2)]);
    if (lig) {
      r.setStart(noeud, deb + 1); r.setEnd(noeud, deb + 2);
      const q2 = r.getClientRects()[0];
      if (!vertical && q2 && Math.abs(q2.width - q.width) < 0.03 && Math.abs(q2.top - q.top) < 0.5) {
        i = deb + 2;
        poser(face, lig, x, y, t.substr(deb, 2));
        continue;
      }
    }
    let c = cp;
    if (majuscules) c = String.fromCodePoint(cp).toLocaleUpperCase('fr').codePointAt(0);
    if (c === 0xA0 || c === 0x202F || c === 0x2009) c = 0x20;
    let f = face, g = P.cmap.get(c);
    if (!g) { f = secours; g = D.faces.get(secours).cmap.get(c); }
    if (!g) { if (c !== 0x20) D.manquants.add(String.fromCodePoint(c)); fermer(); continue; }
    poser(f, g, x, y, String.fromCodePoint(c));
  }
  fermer();
}
function dessinerBordures(D, sortie, el, cs, b, op) {
  const cotes = ['Top', 'Right', 'Bottom', 'Left'].map(s => ({ep: cs[`border${s}Style`] === 'none' ? 0 : parseFloat(cs[`border${s}Width`]) || 0, style: cs[`border${s}Style`], coul: parseCouleur(cs[`border${s}Color`])}));
  if (cotes.every(c => !c.ep || !c.coul.a)) return;
  const [h, d, ba, g] = cotes, uniforme = cotes.every(c => c.ep === h.ep && c.style === h.style && c.coul.a === h.coul.a);
  const rayon = parseFloat(cs.borderTopLeftRadius) || 0;
  if (uniforme && (rayon > 0 || h.style === 'dashed')) {
    const e = h.ep, tirets = h.style === 'dashed' ? `[${n(e * 3)} ${n(e * 3)}] 0 d ` : '';
    sortie.push(`q ${etat(D, h.coul.a * op)}${rvb(h.coul)} RG ${n(e)} w ${tirets}${chemin(b.x + e / 2, b.y + e / 2, b.w - e, b.h - e, rayon - e / 2)} S Q`);
    return;
  }
  // Dans un tableau à bordures fusionnées, le filet est à cheval sur le bord de la case.
  const fusion = (el.tagName === 'TD' || el.tagName === 'TH') && cs.borderCollapse === 'collapse';
  const trait = (c, x, y, w, l) => { if (c.ep && c.coul.a) sortie.push(`q ${etat(D, c.coul.a * op)}${rvb(c.coul)} rg ${n(x)} ${n(y)} ${n(w)} ${n(l)} re f Q`); };
  if (fusion) {
    const debut = (v, e) => colle(v - e / 2);
    trait(h, b.x, debut(b.brut.h, h.ep), b.w, h.ep);
    trait(ba, b.x, debut(b.brut.b, ba.ep), b.w, ba.ep);
    trait(g, debut(b.brut.g, g.ep), b.y, g.ep, b.h);
    trait(d, debut(b.brut.d, d.ep), b.y, d.ep, b.h);
  } else {
    trait(h, b.x, b.y, b.w, h.ep);
    trait(ba, b.x, b.y + b.h - ba.ep, b.w, ba.ep);
    trait(g, b.x, b.y, g.ep, b.h);
    trait(d, b.x + b.w - d.ep, b.y, d.ep, b.h);
  }
}
function dessinerImage(D, sortie, el, cs, b, op) {
  const src = el.getAttribute('src');
  if (!src || !D.images.has(src)) return;
  const nl = el.naturalWidth, nh = el.naturalHeight, fit = cs.objectFit;
  let w = b.w, h = b.h;
  if (fit === 'cover' || fit === 'contain') {
    const e = fit === 'cover' ? Math.max(b.w / nl, b.h / nh) : Math.min(b.w / nl, b.h / nh);
    w = nl * e; h = nh * e;
  }
  const [px, py] = (cs.objectPosition || '50% 50%').split(' ');
  const place = (v, reste) => (v.endsWith('%') ? parseFloat(v) / 100 * reste : parseFloat(v) || 0);
  const x = b.x + place(px, b.w - w), y = b.y + place(py || '50%', b.h - h);
  sortie.push(`q ${etat(D, op)}${n(b.x)} ${n(b.y)} ${n(b.w)} ${n(b.h)} re W n ${n(w)} 0 0 ${n(-h)} ${n(x)} ${n(y + h)} cm ${D.images.get(src).nom} Do Q`);
}
// reste : les éléments positionnés croisés en chemin, dessinés après le flux normal de l'élément qui les rassemble.
function parcourir(D, sortie, el, op, o, reste) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none') return;
  const opacite = op * (parseFloat(cs.opacity) || 0);
  if (opacite <= 0) return;
  const r = el.getBoundingClientRect();
  // Le navigateur cale les formes sur le pixel entier : on fait pareil, pour que les filets tombent au même endroit.
  const brut = {g: (r.left - o.x) / o.k, h: (r.top - o.y) / o.k, d: (r.right - o.x) / o.k, b: (r.bottom - o.y) / o.k};
  const b = {x: colle(brut.g), y: colle(brut.h), w: colle(brut.d) - colle(brut.g), h: colle(brut.b) - colle(brut.h), brut};
  if (el.matches(MASQUES)) {
    // Une case de tableau vide garde ses filets : ils appartiennent au tableau.
    if (el.matches('td, th') && cs.borderCollapse === 'collapse') dessinerBordures(D, sortie, el, cs, b, opacite);
    return;
  }
  const visible = cs.visibility !== 'hidden';
  if (visible) {
    const fond = parseCouleur(cs.backgroundColor), rayon = parseFloat(cs.borderTopLeftRadius) || 0;
    if (fond.a && !el.matches(SANS_FOND)) sortie.push(`q ${etat(D, fond.a * opacite)}${rvb(fond)} rg ${chemin(b.x, b.y, b.w, b.h, rayon)} f Q`);
    const image = cs.backgroundImage;
    if (image && image !== 'none') {
      if (el.matches('.cb.coche')) {                 // la croix d'une case cochée (le fond de la case est déjà posé)
        const m = image.match(/rgb\([^)]+\)/), e = parseFloat(cs.borderTopWidth) || 0;
        const x0 = b.x + e, y0 = b.y + e, x1 = b.x + b.w - e, y1 = b.y + b.h - e;
        if (m) sortie.push(`q ${n(x0)} ${n(y0)} ${n(x1 - x0)} ${n(y1 - y0)} re W n ${etat(D, opacite)}${rvb(parseCouleur(m[0]))} RG 2.6 w ${n(x0)} ${n(y0)} m ${n(x1)} ${n(y1)} l ${n(x1)} ${n(y0)} m ${n(x0)} ${n(y1)} l S Q`);
      } else if (FONDU.test(image)) {
        sortie.push(`q ${etat(D, opacite)}${degrade(D, image, b)} Q`);
      } else {
        D.manquants.add('fond : ' + image.slice(0, 80));
      }
    }
    dessinerBordures(D, sortie, el, cs, b, opacite);
    if (el.tagName === 'IMG') { dessinerImage(D, sortie, el, cs, b, opacite); return; }
    // Les puces carrées dessinées en CSS (::before vide, placé en absolu, avec une couleur de fond), comme « .puces .it::before ».
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === 'none' || ps.content === 'normal' || ps.display === 'none' || ps.position !== 'absolute') continue;
      const f = parseCouleur(ps.backgroundColor), w = parseFloat(ps.width) || 0, h = parseFloat(ps.height) || 0;
      if (!f.a || w <= 0 || h <= 0) continue;
      const x = brut.g + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(ps.left) || 0);
      const y = brut.h + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(ps.top) || 0);
      sortie.push(`q ${etat(D, f.a * opacite)}${rvb(f)} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f Q`);
    }
  }
  const coupe = cs.overflowX !== 'visible';
  if (coupe) sortie.push(`q ${n(b.x)} ${n(b.y)} ${n(b.w)} ${n(b.h)} re W n`);
  // Comme à l'écran : les éléments positionnés ou transparents passent au-dessus du flux normal, dans l'ordre du document,
  // même rangés dans un conteneur simple.
  const liste = reste || [];
  for (const f of el.childNodes) {
    if (f.nodeType === 3) { if (visible) dessinerTexte(D, sortie, f, cs, opacite, o); continue; }
    if (f.nodeType !== 1) continue;
    const s = getComputedStyle(f);
    if (s.position !== 'static' || parseFloat(s.opacity) < 1) liste.push([f, opacite]);
    else parcourir(D, sortie, f, opacite, o, liste);
  }
  if (!reste) for (const [f, opF] of liste) parcourir(D, sortie, f, opF, o);
  if (coupe) sortie.push('Q');
}

/* ---------- écriture du fichier ---------- */
async function ecrireFonte(D, face, rang) {
  const P = D.faces.get(face), gids = [...face.utilises.keys()].sort((a, b) => a - b);
  const nom = 'GC' + String.fromCharCode(65 + Math.floor(rang / 26), 65 + rang % 26) + 'AA+' + face.fichier.replace(/\.ttf$/i, '').replace(/[^A-Za-z0-9-]/g, '');
  const sous = sousEnsemble(P, gids);
  const fichier = D.ajouter(`<< /Filter /FlateDecode /Length1 ${sous.length} >>`, await comprimer(sous));
  const desc = D.ajouter(`<< /Type /FontDescriptor /FontName /${nom} /Flags 4 /FontBBox [${P.boite.map(n).join(' ')}] /ItalicAngle ${n(P.pente)} /Ascent ${n(P.ascendante)} /Descent ${n(P.descendante)} /CapHeight ${n(P.capitale)} /StemV 80 /FontFile2 ${fichier} 0 R >>`);
  const largeurs = gids.map(g => `${g} [${n(P.avance(g))}]`).join(' ');
  const cid = D.ajouter(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${nom} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /DW 500 /W [${largeurs}] >>`);
  const lignes = gids.map(g => {
    const u = face.utilises.get(g);
    return `<${hex4(g)}> <${[...Array(u.length).keys()].map(i => hex4(u.charCodeAt(i))).join('')}>`;
  });
  let cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
  for (let i = 0; i < lignes.length; i += 100) {
    const bloc = lignes.slice(i, i + 100);
    cmap += `${bloc.length} beginbfchar\n${bloc.join('\n')}\nendbfchar\n`;
  }
  cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
  const uni = D.ajouter('<< /Filter /FlateDecode >>', await comprimer(octets(cmap)));
  return D.ajouter(`<< /Type /Font /Subtype /Type0 /BaseFont /${nom} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${uni} 0 R >>`);
}
async function finir(D, titre) {
  const fontes = [];
  const utilisees = [...D.faces.keys()].filter(f => f.utilises.size);
  for (let i = 0; i < utilisees.length; i++) fontes.push(`${utilisees[i].ref} ${await ecrireFonte(D, utilisees[i], i)} 0 R`);
  const xo = [...D.images.values(), ...D.degrades.values()].map(i => `${i.nom} ${i.num} 0 R`);
  const et = [...D.etats].map(([cle, nom]) => `${nom} << /ca ${n(cle / 1000)} /CA ${n(cle / 1000)} >>`);
  D.objets[3] = {dict: `<< /Font << ${fontes.join(' ')} >> /XObject << ${xo.join(' ')} >> /ExtGState << ${et.join(' ')} >> >>`};
  const kids = [];
  for (const contenu of D.pages) {
    const c = D.ajouter('<< /Filter /FlateDecode >>', contenu);
    kids.push(D.ajouter(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGEUR * PT} ${HAUTEUR * PT}] /Resources 4 0 R /Contents ${c} 0 R >>`));
  }
  D.objets[0] = {dict: '<< /Type /Catalog /Pages 2 0 R >>'};
  D.objets[1] = {dict: `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`};
  const hexTitre = [...Array(titre.length).keys()].map(i => hex4(titre.charCodeAt(i))).join('');
  D.objets[2] = {dict: `<< /Title <FEFF${hexTitre}> /Producer (Site des propals Green Cube) >>`};
  for (const O of D.objets) if (O.brut) { O.flux = await comprimer(O.brut); O.brut = null; }

  const parts = [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A])];
  let pos = parts[0].length;
  const pousser = b => { parts.push(b); pos += b.length; };
  const decalages = [];
  D.objets.forEach((O, i) => {
    decalages.push(pos);
    if (O.flux) {
      pousser(octets(`${i + 1} 0 obj\n${O.dict.replace(/>>$/, `/Length ${O.flux.length} >>`)}\nstream\n`));
      pousser(O.flux);
      pousser(octets('\nendstream\nendobj\n'));
    } else pousser(octets(`${i + 1} 0 obj\n${O.dict}\nendobj\n`));
  });
  const nb = D.objets.length + 1, debut = pos;
  let table = `xref\n0 ${nb}\n0000000000 65535 f \n`;
  for (const d of decalages) table += `${String(d).padStart(10, '0')} 00000 n \n`;
  pousser(octets(`${table}trailer\n<< /Size ${nb} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${debut}\n%%EOF\n`));
  return new Blob(parts, {type: 'application/pdf'});
}

/* ---------- point d'entrée ---------- */
async function creer(slides, {titre = 'Propal', progression = () => {}} = {}) {
  if (typeof CompressionStream === 'undefined') throw new Error('ce navigateur est trop ancien, ouvrez le site dans Chrome');
  if (!window.PDF_INDEX) await script('data/pdf/index.js');
  const index = window.PDF_INDEX;
  await document.fonts.ready;
  const D = nouveauDocument();
  await Promise.all(index.polices.map(async (f, i) => {
    const d = await donnee(f.js);
    f.ref = `/F${i + 1}`;
    f.utilises = new Map();
    D.faces.set(f, lirePolice(depuisBase64(d.d)));
  }));
  const sources = [...new Set(slides.flatMap(s => [...s.querySelectorAll('img')].map(i => i.getAttribute('src')).filter(Boolean)))];
  for (let i = 0; i < sources.length; i++) {
    await preparerImage(D, index, sources[i]);
    if (i % 8 === 0) { progression(0, slides.length); await pause(); }
  }
  for (let i = 0; i < slides.length; i++) {
    const r = slides[i].getBoundingClientRect();
    const sortie = [`${PT} 0 0 ${-PT} 0 ${HAUTEUR * PT} cm`];
    parcourir(D, sortie, slides[i], 1, {x: r.left, y: r.top, k: r.width / LARGEUR});
    D.pages.push(await comprimer(octets(sortie.join('\n'))));
    progression(i + 1, slides.length);
    await pause();
  }
  if (D.manquants.size) console.warn('PDF : éléments non repris', [...D.manquants]);
  const fichier = await finir(D, titre);
  fichier.manquants = [...D.manquants];
  return fichier;
}
return {creer};
})();

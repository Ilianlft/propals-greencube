/* Écran de mot de passe du site des propals.
   Ajouté le 13/11/2026 à la demande d'Ilian (« tu peux mettre un mdp sur le site pour y accéder ? »).

   - Le mot de passe n'est pas écrit en clair ici : seule son empreinte SHA-256 est gardée.
     Pour le changer, calculer l'empreinte du nouveau mot de passe (Terminal :
     printf %s 'NOUVEAU' | shasum -a 256) et la coller dans EMPREINTE.
   - Une fois le bon mot de passe tapé, l'onglet reste ouvert jusqu'à sa fermeture
     (sessionStorage). Un nouvel onglet ou une nouvelle fenêtre redemande le mot de passe.
   - C'est un verrou d'accès, pas un coffre : le site tourne sans serveur, donc quelqu'un
     qui a les fichiers peut toujours les ouvrir autrement que par cette page.
   - Le site reste mis en page derrière le voile (visibility, pas display) : app.js mesure
     la largeur des planches au chargement, elles ne doivent pas être à 0. */
(function () {
  'use strict';
  var EMPREINTE = 'e5083b6554b6f2dfb87ef1c0c54765db78d1922612f855bbd723d06c7f932048';
  var CLE = 'gct-propals-acces';

  function dejaOuvert() {
    try { return sessionStorage.getItem(CLE) === EMPREINTE; } catch (e) { return false; }
  }
  if (dejaOuvert()) return;

  var racine = document.documentElement;
  racine.classList.add('verrou');

  var style = document.createElement('style');
  style.textContent = [
    'html.verrou,html.verrou body{overflow:hidden}',
    'html.verrou body>*:not(#acces){visibility:hidden}',
    '#acces{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--noir,#010506);color:var(--pap,#f1f1ea);font-family:"Montserrat",system-ui,sans-serif}',
    '#acces form{width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px}',
    '#acces img{width:180px;height:auto;margin-bottom:18px}',
    '#acces .acces-titre{margin:0 0 6px;font-family:"Sofia Sans Condensed",sans-serif;font-weight:700;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--tx2,#9fa69c)}',
    '#acces label{font-size:14px;color:var(--tx,#d9dcd3)}',
    '#acces input{font:inherit;font-size:16px;padding:12px 14px;border:1px solid var(--fil-s,#2c3a37);border-radius:0;background:#0b1413;color:var(--pap,#f1f1ea)}',
    '#acces input:focus{outline:2px solid var(--cit,#b4c946);outline-offset:1px}',
    '#acces button{font:inherit;font-family:"Sofia Sans Condensed",sans-serif;font-weight:700;font-size:16px;letter-spacing:.04em;text-transform:uppercase;padding:12px 14px;border:0;border-radius:0;background:var(--cit,#b4c946);color:var(--noir,#010506);cursor:pointer}',
    '#acces .acces-erreur{min-height:20px;margin:0;font-size:14px;color:#f0a58f}'
  ].join('\n');
  document.head.appendChild(style);

  /* SHA-256 sans dépendance (le site tourne en file://, sans internet). */
  function sha256(texte) {
    var octets = unescape(encodeURIComponent(texte));
    function rot(v, n) { return (v >>> n) | (v << (32 - n)); }
    var puiss = Math.pow, max = puiss(2, 32), i, j, res = '';
    var mots = [], longueurBits = octets.length * 8, h = [], k = [], n = 0, compose = {};
    for (var cand = 2; n < 64; cand++) {
      if (!compose[cand]) {
        for (i = 0; i < 313; i += cand) compose[i] = cand;
        h[n] = (puiss(cand, 0.5) * max) | 0;
        k[n++] = (puiss(cand, 1 / 3) * max) | 0;
      }
    }
    octets += '\x80';
    while (octets.length % 64 - 56) octets += '\x00';
    for (i = 0; i < octets.length; i++) mots[i >> 2] |= octets.charCodeAt(i) << ((3 - i) % 4) * 8;
    mots[mots.length] = (longueurBits / max) | 0;
    mots[mots.length] = longueurBits;
    for (j = 0; j < mots.length;) {
      var w = mots.slice(j, j += 16), ancien = h;
      h = h.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = h[0], e = h[4];
        var t1 = h[7] + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & h[5]) ^ (~e & h[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rot(w15, 7) ^ rot(w15, 18) ^ (w15 >>> 3)) + w[i - 7] +
            (rot(w2, 17) ^ rot(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
        h = [(t1 + t2) | 0].concat(h);
        h[4] = (h[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) h[i] = (h[i] + ancien[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (h[i] >> (j * 8)) & 255; res += (b < 16 ? '0' : '') + b.toString(16); }
    return res;
  }
  window.__sha256Acces = sha256; // pour le test automatique uniquement

  function monter() {
    var voile = document.createElement('div');
    voile.id = 'acces';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.setAttribute('aria-labelledby', 'acces-titre');
    voile.innerHTML =
      '<form autocomplete="off" novalidate>' +
        '<img src="img/courte/img/logo-greencube.png" alt="Green Cube Technologies">' +
        '<p class="acces-titre" id="acces-titre">Propositions commerciales</p>' +
        '<label for="acces-mdp">Mot de passe</label>' +
        '<input type="password" id="acces-mdp" autocomplete="current-password" required>' +
        '<button type="submit">Entrer</button>' +
        '<p class="acces-erreur" id="acces-erreur" role="alert"></p>' +
      '</form>';
    document.body.appendChild(voile);
    var champ = voile.querySelector('#acces-mdp');
    var erreur = voile.querySelector('#acces-erreur');
    champ.focus();
    voile.querySelector('form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (sha256(champ.value) === EMPREINTE) {
        try { sessionStorage.setItem(CLE, EMPREINTE); } catch (e) { /* l'onglet redemandera, sans gravité */ }
        voile.remove();
        racine.classList.remove('verrou');
        window.dispatchEvent(new Event('resize'));
      } else {
        erreur.textContent = 'Mot de passe incorrect.';
        champ.value = '';
        champ.focus();
      }
    });
  }

  if (document.body) monter();
  else document.addEventListener('DOMContentLoaded', monter);
})();

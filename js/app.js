(() => {
  'use strict';

  const REROLLS = 3;
  const HISTORY_KEY = 'nexthalf.history';
  const SPEED_KEY = 'nexthalf.speed';
  // milliseconds per match minute: "normal" plays a match in about a minute
  const SPEEDS = { slow: 1000, normal: 650, fast: 220, quick: 95 };

  const $ = (sel, root = document) => root.querySelector(sel);
  const screenEl = $('#screen');
  const hintsEl = $('#hints');

  // ---------- helpers ----------
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1 && n % 10) || 0] || 'th');

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function flag(code) {
    if (!code) return '';
    const tag = (s) => String.fromCodePoint(0x1f3f4, ...[...s].map((c) => 0xe0000 + c.charCodeAt(0)), 0xe007f);
    if (code === 'EN') return tag('gbeng');
    if (code === 'SCO') return tag('gbsct');
    if (code === 'WA') return tag('gbwls');
    if (code.length !== 2) return '';
    return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
  }

  const SHORT_NAMES = {
    'Vinicius Jr': 'Vinicius Jr', 'Kim Min-jae': 'Kim', 'Marc-Andre ter Stegen': 'ter Stegen', 'Heung-min Son': 'Son',
    'Ki Sung-yueng': 'Ki', 'Yun Suk-young': 'Yun', 'Hwang Hee-chan': 'Hwang', 'Rafinha Alcantara': 'Rafinha',
    'Maicon Pereira': 'Maicon', 'Fred Santos': 'Fred', 'Inigo Ruiz de Galarreta': 'Ruiz de Galarreta',
  };
  function shortName(name) {
    if (SHORT_NAMES[name]) return SHORT_NAMES[name];
    const parts = name.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : name;
  }

  // only the hand-picked Team of the Year players get the special card
  function tier(p) {
    if (p.toty) return 'elite toty';
    if (p.ovr >= 75) return 'gold';
    if (p.ovr >= 65) return 'silver';
    return 'bronze';
  }

  // ---------- kits ----------
  let kitSeq = 0;
  function shirt(kit, cls = '') {
    const [c1, c2, style] = kit;
    const id = 'k' + (++kitSeq);
    const body = 'M17 5 Q24 10 31 5 L44 11 L40 22 L35 19.5 L35 44 L13 44 L13 19.5 L8 22 L4 11 Z';
    const clip = `clip-path="url(#${id}c)"`;
    let defs = `<clipPath id="${id}c"><path d="${body}"/></clipPath>`;
    let fill = c1;
    let overlay = '';
    if (style === 'stripes') {
      defs += `<pattern id="${id}p" width="7" height="48" patternUnits="userSpaceOnUse"><rect width="7" height="48" fill="${c1}"/><rect width="3.5" height="48" fill="${c2}"/></pattern>`;
      fill = `url(#${id}p)`;
    } else if (style === 'hoops') {
      defs += `<pattern id="${id}p" width="48" height="8" patternUnits="userSpaceOnUse"><rect width="48" height="8" fill="${c1}"/><rect width="48" height="4" fill="${c2}"/></pattern>`;
      fill = `url(#${id}p)`;
    } else if (style === 'checks') {
      defs += `<pattern id="${id}p" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${c1}"/><rect width="4" height="4" fill="${c2}"/><rect x="4" y="4" width="4" height="4" fill="${c2}"/></pattern>`;
      fill = `url(#${id}p)`;
    } else if (style === 'band') {
      overlay = `<rect x="20" y="0" width="8" height="48" fill="${c2}" ${clip}/><rect x="19" y="0" width="1" height="48" fill="#fff" ${clip}/><rect x="28" y="0" width="1" height="48" fill="#fff" ${clip}/>`;
    } else if (style === 'halves') {
      overlay = `<rect x="24" y="0" width="24" height="48" fill="${c2}" ${clip}/>`;
    } else if (style === 'diag') {
      overlay = `<path d="M0 48 L48 0 L48 48 Z" fill="${c2}" ${clip}/>`;
    } else if (style === 'sleeves') {
      overlay = `<path d="M4 11 L17 5 L14 17 L13 19.5 L8 22 Z M44 11 L31 5 L34 17 L35 19.5 L40 22 Z" fill="${c2}"/>`;
    }
    const collar = style === 'solid' || style === 'sleeves' || style === 'halves' || style === 'diag' ? c2 : '#fff';
    return `<svg class="shirt ${cls}" viewBox="0 0 48 48" aria-hidden="true"><defs>${defs}</defs>
      <path d="${body}" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>${overlay}
      <path d="M18 5.5 Q24 12 30 5.5" fill="none" stroke="${collar}" stroke-width="2"/>
      <path d="${body}" fill="url(#shade)" opacity=".35"/></svg>`;
  }
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs></svg>`);

  // ---------- data prep ----------
  // DB[era] = { label, teams: {id: team}, players: {uid: player}, comps: {pl, ucl, wc} }
  const DB = {};
  for (const [era, E] of Object.entries(ERAS)) {
    const teams = {};
    const players = {};
    const all = [
      ...E.clubs.map((t) => ({ ...t, type: 'club' })),
      ...E.nations.map((t) => ({ ...t, type: 'nation' })),
    ];
    const best = {};
    const toty = new Set(E.toty || []);
    all.forEach((t) => {
      t.players = t.players.split(';').map((s) => {
        const [name, pos, ovr, nat, card] = s.split(',');
        best[name] = Math.max(best[name] || 0, +ovr);
        return { uid: `${era}:${t.id}:${name}`, name, card: card || shortName(name), pos, ovr: +ovr, nation: t.type === 'nation' ? t.code : nat, team: t };
      });
    });
    all.forEach((t) => {
      // the same player keeps one rating across club and country
      t.players.forEach((p) => { p.ovr = best[p.name]; p.toty = toty.has(p.name); players[p.uid] = p; });
      const top = t.players.map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11);
      t.strength = Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 10) / 10;
      teams[t.id] = t;
    });
    DB[era] = {
      label: E.label, game: E.game, teams, players,
      comps: { pl: E.comps.pl.map((id) => teams[id]), ucl: E.comps.ucl.map((id) => teams[id]), wc: E.nations.map((t) => teams[t.id]) },
    };
  }

  const COMPS = {
    pl: { name: 'Premier League', short: 'PL', kit: ['#3d195b', '#00ff85', 'solid'] },
    ucl: { name: 'Champions League', short: 'UCL', kit: ['#0b1f52', '#ffffff', 'band'] },
    wc: { name: 'World Cup', short: 'WC', kit: ['#8a1538', '#d4af37', 'solid'] },
  };
  function compFormat(comp, era) {
    if (comp === 'pl') return 'league';
    if (comp === 'wc') return 'wc';
    return era === 'retro' ? 'groups8' : 'swiss';
  }
  function compDesc(comp, era) {
    const n = DB[era].comps[comp].length;
    return {
      league: `${n} clubs. Play every other side once.`,
      swiss: `${n} clubs. 8-game league phase, then knockouts.`,
      groups8: `${n} clubs. 8 groups of 4, then knockouts.`,
      wc: `Top 16 of ${n} nations. 4 groups of 4, then knockouts.`,
    }[compFormat(comp, era)];
  }

  // ---------- positions & rating ----------
  function fitOf(slotPos, playerPos) {
    const f = POSITION_FIT[slotPos];
    if (f.n.includes(playerPos)) return 'n';
    if (f.a.includes(playerPos)) return 'a';
    return 'x';
  }
  // Golazo rule: a player only shows up if one of your open spots is his position. A player whose
  // position isn't in the formation at all (a CAM in a 4-3-3) can fill a similar open spot instead.
  function openFits(p) {
    const open = draft.slots.filter((s) => !s.player).map((s) => s.pos);
    const nat = [...new Set(open.filter((pos) => fitOf(pos, p.pos) === 'n'))];
    const inFormation = draft.slots.some((s) => fitOf(s.pos, p.pos) === 'n');
    const alt = inFormation ? [] : [...new Set(open.filter((pos) => fitOf(pos, p.pos) === 'a'))];
    return { nat, alt, best: nat.length ? 'n' : alt.length ? 'a' : 'x' };
  }
  const canPlace = (slot, p) => {
    const f = openFits(p);
    return f.nat.includes(slot.pos) || f.alt.includes(slot.pos);
  };

  const penalty = (fit) => (fit === 'a' ? 3 : fit === 'x' ? 10 : 0);
  const effOvr = (slot) => slot.player.ovr - penalty(fitOf(slot.pos, slot.player.pos));

  function squadStats(slots) {
    const filled = slots.filter((s) => s.player);
    const rating = filled.length ? Math.round(filled.reduce((a, s) => a + effOvr(s), 0) / filled.length) : 0;
    return { rating, stars: starsFor(rating) };
  }
  const starsFor = (r) => clamp(Math.round(((r - 68) / 3.4) * 2) / 2, 0.5, 5);

  function starsHTML(n) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span class="star ${n >= i ? 'on' : n >= i - 0.5 ? 'half' : ''}">&#9733;</span>`;
    return `<span class="stars">${h}</span>`;
  }

  // ---------- storage ----------
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(val));
    } catch { /* storage unavailable */ }
    return null;
  }
  const loadHistory = () => store(HISTORY_KEY) || [];
  const CURRENT_KEY = 'nexthalf.current';

  // ---------- wallet & store ----------
  // Purchases run in demo mode: nothing is charged. Real billing would plug into buy().
  const WALLET_KEY = 'nexthalf.wallet';
  const wallet = Object.assign({ coins: 150, rerolls: 0, noAds: false }, store(WALLET_KEY) || {});
  const saveWallet = () => store(WALLET_KEY, wallet);
  const PRODUCTS = {
    r2: { name: '2 Rerolls', desc: 'For when the wheel hates you.', price: '$0.99', amount: 2, color: 'cyan' },
    r6: { name: '6 Rerolls', desc: 'Enough for a couple of drafts.', price: '$2.49', amount: 6, tag: 'Popular', color: 'pink' },
    r15: { name: '15 Rerolls', desc: 'Never settle for a bad spin.', price: '$4.99', amount: 15, tag: 'Best value', color: 'gold' },
    c1: { name: '1 Reroll', desc: 'Paid with coins from your season rewards.', coins: 150, amount: 1, color: 'lime' },
    c2: { name: '2 Rerolls', desc: 'Coin bundle, saves 20 coins.', coins: 280, amount: 2, color: 'orange' },
    k500: { name: '500 Coins', desc: 'Enough for 3 rerolls.', price: '$0.99', coinPack: 500, color: 'gold' },
    k1500: { name: '1,500 Coins', desc: 'Best for regular drafters.', price: '$2.49', coinPack: 1500, tag: 'Popular', color: 'orange' },
    k4000: { name: '4,000 Coins', desc: 'Stock up for the season.', price: '$4.99', coinPack: 4000, tag: 'Best value', color: 'pink' },
    noads: { name: 'Remove Ads', desc: 'No more ad banners on this device.', price: '$2.99', color: 'violet' },
  };
  // coins come only from how far you go: no coins per match
  const REWARDS = {
    league: [[1, 'Win the league', 500], [4, 'Finish top 4', 100]],
    cup: { Champion: 500, Final: 200, 'Semi-Final': 100 },
  };
  // Rewarded ads: sometimes offered when you land on a team, and when you run out of rerolls.
  // Until a real ad network is connected (the hook is showRewardedAd), the ad is a house promo.
  const AD_SECONDS = 15;
  const AD_CHANCE = 0.3;
  const ADS_PER_DRAFT = 2;
  const canWatchAd = () => draft && (draft.adsWatched || 0) < ADS_PER_DRAFT;
  const totalRerolls = () => (draft ? draft.rerolls : 0) + wallet.rerolls;
  const fmtNum = (n) => n.toLocaleString('en-US');
  const saveHistory = (list) => store(HISTORY_KEY, list.slice(0, 40));

  // ---------- state ----------
  const state = {
    screen: 'home',
    setup: { era: 'now', comp: 'pl', formation: '4-3-3' },
    speed: SPEEDS[store(SPEED_KEY)] ? store(SPEED_KEY) : 'normal',
    lastResult: null,
  };
  let draft = null;
  let squadSel = null;
  let season = null;
  let live = null;

  const currentEra = () => (season ? season.era : draft ? draft.era : state.setup.era);

  // The draft and season in progress are saved after every change, so a reload or crash never loses them.
  function saveCurrent() {
    if (!draft) { store(CURRENT_KEY, { draft: null }); return; }
    const spinning = draft.phase === 'spinning';
    const d = {
      ...draft,
      slots: draft.slots.map((sl) => ({ pos: sl.pos, x: sl.x, y: sl.y, uid: sl.player ? sl.player.uid : null })),
      used: [...draft.used],
      // a spin in progress is saved as already landed, so reloading can't dodge a team
      phase: spinning ? 'choose' : draft.phase,
      landed: spinning ? draft.pendingId : draft.landed ? draft.landed.id : null,
      selected: null, reelItems: undefined, justLanded: undefined,
    };
    store(CURRENT_KEY, { draft: d, season });
  }

  function restoreCurrent() {
    const c = store(CURRENT_KEY);
    if (!c || !c.draft || !DB[c.draft.era]) return false;
    const db = DB[c.draft.era];
    const d = c.draft;
    if (d.slots.some((sl) => sl.uid && !db.players[sl.uid])) return false; // squad data changed since the save
    draft = {
      ...d,
      slots: d.slots.map((sl) => ({ pos: sl.pos, x: sl.x, y: sl.y, player: sl.uid ? db.players[sl.uid] : null })),
      used: new Set(d.used),
      landed: d.landed ? db.teams[d.landed] || null : null,
      selected: null,
    };
    if (draft.phase === 'choose' && !draft.landed) draft.phase = 'idle';
    season = c.season || null;
    return true;
  }

  function newDraft() {
    const { era, comp, formation } = state.setup;
    draft = {
      era, comp, formation,
      slots: FORMATIONS[formation].map(([pos, x, y]) => ({ pos, x, y, player: null })),
      rerolls: REROLLS, landed: null, selected: null, phase: 'idle', used: new Set(), lastTeamId: null,
      name: 'NextHalf XI',
    };
    squadSel = null;
    season = null;
    live = null;
    go('draft');
  }

  // ---------- navigation ----------
  const TAB_FOR = { home: 'home', setup: 'setup', draft: 'setup', squad: 'setup', season: 'setup', match: 'setup', trophy: 'setup', squads: 'squads', store: 'store', howto: 'howto' };
  const TAB_ORDER = ['home', 'setup', 'squads', 'store', 'howto'];

  function go(screen) {
    state.confirmClear = false;
    if (state.sheet) { state.sheet = null; renderSheet(); }
    if (screen === 'setup') {
      // the Play tab resumes whatever is in progress
      if (live) screen = 'match';
      else if (season) screen = 'season';
      else if (draft && draft.phase === 'done') screen = 'squad';
      else if (draft && (draft.phase !== 'idle' || draft.slots.some((s) => s.player))) screen = 'draft';
    }
    state.screen = screen;
    render(true);
  }

  function back() {
    if (live || (draft && draft.phase === 'spinning')) return;
    if (state.sheet) { closeSheet(); return; }
    const map = { setup: 'home', draft: 'setup-force', squad: 'draft', squads: 'home', store: 'home', howto: 'home', trophy: 'home' };
    const to = map[state.screen];
    if (!to) return;
    state.screen = to === 'setup-force' ? 'setup' : to;
    render(true);
  }

  // ---------- rendering ----------
  function render(resetFocus = false) {
    const active = document.activeElement;
    const focusKey = !resetFocus && active && active.dataset ? active.dataset.key : null;

    document.body.classList.toggle('retro', currentEra() === 'retro');
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === TAB_FOR[state.screen]));
    const hist = loadHistory();
    const titles = hist.filter((h) => h.champion).length;
    $('#profile-sub').textContent = `${titles} Trophi${titles === 1 ? 'y' : 'es'} · ${hist.length} Season${hist.length === 1 ? '' : 's'}`;
    renderWallet();

    screenEl.className = 'screen screen-' + state.screen;
    screenEl.innerHTML = (SCREENS[state.screen] || SCREENS.home)();
    hintsEl.innerHTML = hints();
    if (resetFocus) window.scrollTo(0, 0);

    let el = focusKey ? screenEl.querySelector(`[data-key="${CSS.escape(focusKey)}"]`) : null;
    if (!el || el.disabled) el = screenEl.querySelector('[data-autofocus]:not([disabled])');
    if (el) el.focus({ preventScroll: true });
    saveCurrent();
  }

  function hint(key, label, action, cls = '') {
    return `<button class="hint ${cls}" ${action ? `data-action="${action}"` : 'disabled'}><span class="btn-glyph">${key}</span>${label}</button>`;
  }

  function hints() {
    const s = state.screen;
    const out = [hint('A', 'Select', '', 'a')];
    if (!['home', 'match', 'season'].includes(s)) out.push(hint('B', 'Back', 'back', 'b'));
    if (s === 'draft' && draft) {
      if (draft.phase === 'idle') out.push(hint('S', 'Spin', 'spin', 'y'));
      if (draft.phase === 'choose') out.push(hint('R', `Reroll (${totalRerolls()})`, 'reroll', 'x'));
    }
    if (s === 'match' && live && !live.over) out.push(hint('P', live.paused ? 'Resume' : 'Pause', 'togglePause', 'y'));
    out.push(`<span class="hint-spacer"></span><span class="hint-keys">Arrows navigate &middot; Q / E switch tabs</span>`);
    return out.join('');
  }

  function card(p, opts = {}) {
    const { ovr = p.ovr, pos = p.pos, size = '', extra = '' } = opts;
    return `<div class="card tier-${tier(p)} ${size} ${extra}">
      <div class="card-shine"></div>
      <div class="card-top"><div class="card-ovr">${ovr}</div><div class="card-pos">${pos}</div></div>
      <div class="card-kit">${shirt(p.team.kit)}</div>
      <div class="card-name">${esc(p.card)}</div>
      <div class="card-team"><span class="card-flag">${flag(p.nation)}</span> ${esc(p.team.short)}</div>
      ${p.toty ? '<div class="card-ribbon">TOTY</div>' : ''}
    </div>`;
  }

  function pitch(slots, mode) {
    const sel = mode === 'draft' && draft.selected ? DB[draft.era].players[draft.selected] : null;
    return `<div class="pitch">
      <div class="pitch-lines"><div class="pl-half"></div><div class="pl-circle"></div><div class="pl-box top"></div><div class="pl-box bottom"></div><div class="pl-six top"></div><div class="pl-six bottom"></div></div>
      ${slots.map((s, i) => {
        let inner, cls = '', attrs = '';
        if (s.player) {
          const fit = fitOf(s.pos, s.player.pos);
          inner = card(s.player, { ovr: effOvr(s), pos: s.pos, size: 'sm', extra: fit === 'x' ? 'oop' : fit === 'a' ? 'alt' : '' });
          cls = 'filled';
        } else {
          let tag = '';
          if (sel && canPlace(s, sel)) {
            const fit = fitOf(s.pos, sel.pos);
            cls = 'fit-' + fit;
            tag = `<small>${sel.ovr - penalty(fit)}</small>`;
          } else if (sel) {
            cls = 'fit-none';
          }
          inner = `<div class="slot-empty"><span>${s.pos}</span>${tag}</div>`;
        }
        if (mode === 'draft') {
          const usable = !s.player && sel && canPlace(s, sel);
          attrs = `data-action="placeAt" data-arg="${i}" ${usable ? '' : 'tabindex="-1"'}`;
        } else {
          attrs = `data-action="swapSlot" data-arg="${i}"`;
          if (squadSel === i) cls += ' selected';
        }
        return `<button class="slot ${cls}" style="left:${s.x}%;top:${s.y}%" data-nav data-key="slot-${i}" ${attrs}
          aria-label="${s.pos}${s.player ? ': ' + esc(s.player.name) : ' empty'}">${inner}</button>`;
      }).join('')}
    </div>`;
  }

  // ---------- screens ----------
  const SCREENS = {};

  SCREENS.home = () => {
    const hist = loadHistory();
    const titles = hist.filter((h) => h.champion).length;
    const resume = live || season || (draft && draft.slots.some((s) => s.player));
    const compTile = (comp, era, label) => `<button class="tile tile-comp tile-${comp}" data-nav data-key="t-${comp}-${era}" data-action="quickSetup" data-arg="${comp}|${era}">
        <div class="tile-art">${shirt(COMPS[comp].kit, 'big')}</div>
        <div class="tile-label"><small>${esc(label)}</small>${COMPS[comp].name}</div></button>`;
    return `<div class="page">
      <h1 class="page-title">Home</h1>
      <div class="tiles">
        <button class="tile tile-hero" data-nav data-key="t-draft" data-action="go" data-arg="setup" data-autofocus>
          <div class="tile-art art-pitch">${miniFormation('4-3-3')}</div>
          <div class="tile-badge">${REROLLS} free rerolls</div>
          <div class="tile-label"><small>${resume ? 'Pick up where you left off' : 'Play'}</small>${resume ? 'Continue Draft' : 'Draft Mode'}</div>
        </button>
        ${compTile('pl', 'now', DB.now.label)}
        ${compTile('ucl', 'now', DB.now.label)}
        <button class="tile tile-retro" data-nav data-key="t-retro" data-action="quickSetup" data-arg="pl|retro">
          <div class="tile-art art-stat"><b>14/15</b><span>Squads &amp; ratings</span><span>from 2015</span></div>
          <div class="tile-label"><small>Throwback</small>Retro Mode</div>
        </button>
        ${compTile('wc', 'now', 'Nations')}
        <button class="tile tile-squads" data-nav data-key="t-squads" data-action="go" data-arg="squads">
          <div class="tile-art art-stat"><b>${titles}</b><span>Trophies</span><span>${hist.length} seasons played</span></div>
          <div class="tile-label"><small>Your best drafts</small>Leaderboard</div>
        </button>
        <button class="tile tile-store" data-nav data-key="t-store" data-action="go" data-arg="store">
          <div class="tile-art art-stat"><b>${fmtNum(wallet.coins)}</b><span>Coins</span><span>${wallet.rerolls} reroll${wallet.rerolls === 1 ? '' : 's'} saved</span></div>
          <div class="tile-label"><small>Rerolls &amp; more</small>Store</div>
        </button>
        <button class="tile tile-help" data-nav data-key="t-howto" data-action="go" data-arg="howto">
          <div class="tile-art art-stat"><b>?</b><span>Spins, rerolls</span><span>and seasons</span></div>
          <div class="tile-label"><small>Learn</small>How To Play</div>
        </button>
      </div>
    </div>`;
  };

  function miniFormation(f) {
    return `<div class="mini-form">${FORMATIONS[f].map(([, x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('')}</div>`;
  }

  function chip(action, arg, on, label, sub, key) {
    return `<button class="chip ${on ? 'on' : ''}" data-nav data-key="${key}" data-action="${action}" data-arg="${arg}" ${on ? 'data-autofocus' : ''}><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  }

  SCREENS.setup = () => {
    const s = state.setup;
    return `<div class="page">
      <h1 class="page-title">New Season</h1>
      <section class="panel">
        <h2 class="panel-title">Era</h2>
        <div class="chip-row">
          ${chip('setEra', 'now', s.era === 'now', DB.now.label, `Current squads, ${DB.now.game} ratings`, 'era-now')}
          ${chip('setEra', 'retro', s.era === 'retro', `Retro ${DB.retro.label}`, `2015 squads, ${DB.retro.game} ratings`, 'era-retro')}
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-title">Competition</h2>
        <div class="chip-row">
          ${['pl', 'ucl', 'wc'].map((c) => chip('setComp', c, s.comp === c, COMPS[c].name + (c === 'wc' && s.era === 'retro' ? ' 2014' : ''), compDesc(c, s.era), 'comp-' + c)).join('')}
        </div>
        <p class="muted small-note">You draft from the teams in this competition, then play it with your XI. Your side takes the place of the lowest-rated team.</p>
      </section>
      <section class="panel">
        <h2 class="panel-title">Formation</h2>
        <div class="form-row">
          ${Object.keys(FORMATIONS).map((f) => `<button class="form-card ${s.formation === f ? 'on' : ''}" data-nav data-key="form-${f}" data-action="setFormation" data-arg="${f}">
            <div class="form-pitch">${miniFormation(f)}</div><b>${f}</b></button>`).join('')}
        </div>
      </section>
      <div class="action-row">
        <button class="btn btn-primary" data-nav data-key="start" data-action="startDraft">Start Draft</button>
        <span class="muted">${season ? 'Starting a new draft ends your current season. ' : ''}<b class="accent">${REROLLS} rerolls</b> per draft. Free, always.</span>
      </div>
    </div>`;
  };

  // ----- draft -----
  SCREENS.draft = () => {
    if (!draft) return SCREENS.setup();
    const st = squadStats(draft.slots);
    const filled = draft.slots.filter((s) => s.player).length;
    return `<div class="page draft-layout">
      <div class="draft-left">
        <div class="squad-head">
          <div><h1 class="page-title">Draft &middot; ${draft.formation}</h1>
            <div class="muted">${filled}/11 picked &middot; ${COMPS[draft.comp].name} &middot; ${DB[draft.era].label}</div></div>
          <div class="stat-boxes">
            <div class="stat-box"><small>Rating</small><b>${st.rating || '--'}</b></div>
            <div class="stat-box"><small>Team</small>${starsHTML(st.rating ? st.stars : 0)}</div>
          </div>
        </div>
        ${pitch(draft.slots, 'draft')}
      </div>
      <div class="draft-right">${draftPanel()}</div>
    </div>`;
  };

  function rerollPips() {
    const left = totalRerolls();
    const pips = Math.max(REROLLS, left);
    return `<div class="reroll-pips" title="Rerolls left">${Array.from({ length: Math.min(pips, 10) }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}${pips > 10 ? '<i class="more">+</i>' : ''}<span>${left} reroll${left === 1 ? '' : 's'} left</span></div>`;
  }

  function rerollButton() {
    const left = totalRerolls();
    if (left) return `<button class="btn btn-reroll" data-nav data-key="reroll" data-action="reroll"><span class="btn-glyph x">R</span>Reroll<small>${left} left</small></button>`;
    return `<button class="btn btn-reroll buy" data-nav data-key="reroll" data-action="reroll"><span class="btn-glyph x">+</span>Get Rerolls<small>None left</small></button>`;
  }

  function steps(n) {
    const labels = ['Spin', 'Pick a player', 'Pick a position'];
    return `<ol class="steps">${labels.map((l, i) => `<li class="${i === n ? 'on' : i < n ? 'done' : ''}">${i + 1}. ${l}</li>`).join('')}</ol>`;
  }

  function draftPanel() {
    const pool = DB[draft.era].comps[draft.comp];
    if (draft.phase === 'done') {
      return `<section class="panel panel-tall">
        <h2 class="panel-title">Squad Complete</h2>
        <p class="lead">All 11 spots are filled. You can still swap players around before the season starts.</p>
        ${rerollPips()}
        <button class="btn btn-primary wide" data-nav data-key="confirm" data-action="confirmSquad" data-autofocus>Confirm Squad</button>
      </section>`;
    }
    const head = `<div class="panel-title-row"><h2 class="panel-title">Team Selection</h2>${rerollPips()}</div>`;

    if (draft.phase === 'idle') {
      return `<section class="panel panel-tall">${head}${steps(0)}
        <div class="reel reel-idle"><div class="reel-marker"></div><div class="reel-strip">${shuffle(pool).slice(0, 7).map(reelItem).join('')}</div></div>
        <button class="btn btn-primary wide" data-nav data-key="spin" data-action="spin" data-autofocus>Spin For A Team</button>
        <p class="muted center">Spinning from ${pool.length} ${draft.comp === 'wc' ? 'nations' : 'clubs'} in the ${COMPS[draft.comp].name}.</p>
      </section>`;
    }
    if (draft.phase === 'spinning') {
      return `<section class="panel panel-tall">${head}${steps(0)}
        <div class="reel" id="reel"><div class="reel-marker"></div><div class="reel-strip" id="reel-strip">${draft.reelItems.map(reelItem).join('')}</div></div>
        <button class="btn btn-primary wide" disabled>Spinning...</button>
      </section>`;
    }
    // choose: pick a player, then a position
    const t = draft.landed;
    // like Golazo: players for spots you've already filled (or already in your squad) don't appear
    const rows = t.players.map((p) => ({ p, taken: draft.used.has(p.name), ...openFits(p) }))
      .filter((r) => !r.taken && r.best !== 'x')
      .sort((a, b) => b.p.ovr - a.p.ovr || ('na'.indexOf(a.best) - 'na'.indexOf(b.best)));
    const first = rows[0];
    const selected = draft.selected;
    return `<section class="panel panel-tall">${head}${steps(selected ? 2 : 1)}
      <div class="landed ${draft.justLanded ? 'anim' : ''}">
        <div class="landed-kit">${shirt(t.kit, 'big')}</div>
        <div class="landed-info"><small>You landed on</small><b>${esc(t.name)}</b><span class="muted">${t.type === 'nation' ? flag(t.code) + ' ' : ''}${esc(t.league)} &middot; ${t.strength} avg</span></div>
        ${rerollButton()}
        ${draft.adOffer && canWatchAd() ? `<button class="btn btn-adreward" data-nav data-key="watch-ad" data-action="watchAd"><span class="play-ico"></span>Watch an ad<small>+1 reroll</small></button>` : ''}
      </div>
      ${selected ? `<div class="place-hint">Now tap a spot on the pitch for <b>${esc(DB[draft.era].players[selected].name)}</b>. <span class="c-n">Green</span> = natural, <span class="c-a">amber</span> = similar spot (-3).</div>` : ''}
      <div class="player-list">
        ${rows.length ? '' : `<p class="lead center">Nobody here fits your open spots.</p>`}
        ${rows.map(({ p, nat, alt, best }) => {
          const badge = best === 'n' ? `<span class="fit n">Fits ${nat.join(' / ')}</span>` : `<span class="fit a">${alt.join(' / ')} (-3)</span>`;
          return `<button class="prow ${selected === p.uid ? 'picked' : ''}" data-nav data-key="p-${esc(p.uid)}" data-action="pickPlayer" data-arg="${esc(p.uid)}" ${!selected && p === first?.p ? 'data-autofocus' : ''}>
            <span class="prow-ovr tier-${tier(p)}">${p.ovr}</span>
            <span class="prow-pos">${p.pos}</span>
            <span class="prow-name">${esc(p.name)} <span class="prow-flag">${flag(p.nation)}</span></span>
            ${badge}
          </button>`;
        }).join('')}
      </div>
    </section>`;
  }

  function reelItem(t) {
    return `<div class="reel-item">${shirt(t.kit, 'big')}<span>${esc(t.short)}</span></div>`;
  }

  // ----- squad review -----
  SCREENS.squad = () => {
    if (!draft) return SCREENS.setup();
    const st = squadStats(draft.slots);
    const oop = draft.slots.filter((s) => s.player && fitOf(s.pos, s.player.pos) === 'x').length;
    const alt = draft.slots.filter((s) => s.player && fitOf(s.pos, s.player.pos) === 'a').length;
    return `<div class="page draft-layout">
      <div class="draft-left">
        <div class="squad-head"><div><h1 class="page-title">Squad &middot; ${draft.formation}</h1><div class="muted">Tap two players to swap them</div></div></div>
        ${pitch(draft.slots, 'squad')}
      </div>
      <div class="draft-right">
        <section class="panel panel-tall">
          <h2 class="panel-title">Squad Overview</h2>
          <label class="field"><small>Team name</small><input id="squad-name" maxlength="22" value="${esc(draft.name)}" data-nav data-key="name"></label>
          <div class="overview">
            <div class="ov-big"><small>Rating</small><b>${st.rating}</b></div>
            <div class="ov-big"><small>Team</small>${starsHTML(st.stars)}</div>
          </div>
          ${oop ? `<p class="warn">${oop} player${oop > 1 ? 's are' : ' is'} out of position (-10 each). Try swapping.</p>` : ''}
          ${alt ? `<p class="muted">${alt} player${alt > 1 ? 's are' : ' is'} in a similar position (-3 each).</p>` : ''}
          <div class="comp-strip">${shirt(COMPS[draft.comp].kit)}<div><b>${COMPS[draft.comp].name}</b><span class="muted">${DB[draft.era].label} &middot; ${compDesc(draft.comp, draft.era)}</span></div></div>
          <button class="btn btn-primary wide" data-nav data-key="go-season" data-action="startSeason" data-autofocus>Start ${COMPS[draft.comp].name}</button>
          <button class="btn wide" data-nav data-key="newdraft" data-action="discardDraft">New Draft</button>
        </section>
      </div>
    </div>`;
  };

  // ---------- season model ----------
  function roundRobin(ids) {
    const a = ids.slice();
    if (a.length % 2) a.push(null);
    const n = a.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const ms = [];
      for (let i = 0; i < n / 2; i++) {
        const h = a[i], w = a[n - 1 - i];
        if (h !== null && w !== null) ms.push(r % 2 ? [w, h] : [h, w]);
      }
      rounds.push(ms);
      a.splice(1, 0, a.pop());
    }
    return rounds;
  }

  // league phase: k rounds, every team plays k different opponents
  function swissRounds(ids, k) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const played = new Set();
      const rounds = [];
      let ok = true;
      for (let r = 0; r < k && ok; r++) {
        const pool = shuffle(ids);
        const ms = [];
        while (pool.length) {
          const a = pool.shift();
          const j = pool.findIndex((b) => !played.has(a < b ? a + '-' + b : b + '-' + a));
          if (j < 0) { ok = false; break; }
          const b = pool.splice(j, 1)[0];
          played.add(a < b ? a + '-' + b : b + '-' + a);
          ms.push(Math.random() < 0.5 ? [a, b] : [b, a]);
        }
        rounds.push(ms);
      }
      if (ok) return rounds;
    }
    return [];
  }

  // seeded pots: one team from each strength band per group
  function drawGroups(idxs, nGroups, entries) {
    const sorted = idxs.slice().sort((a, b) => entries[b].strength - entries[a].strength);
    const per = idxs.length / nGroups;
    const groups = Array.from({ length: nGroups }, (_, g) => ({ name: 'Group ' + 'ABCDEFGH'[g], members: [] }));
    for (let pot = 0; pot < per; pot++) {
      shuffle(sorted.slice(pot * nGroups, (pot + 1) * nGroups)).forEach((t, g) => groups[g].members.push(t));
    }
    return groups;
  }

  function userShort(name) {
    const letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return (letters || 'NXH').slice(0, 3);
  }

  function buildSeason() {
    const db = DB[draft.era];
    const fmt = compFormat(draft.comp, draft.era);
    const pool = db.comps[draft.comp].slice().sort((a, b) => b.strength - a.strength);
    const size = fmt === 'wc' ? 16 : pool.length;
    const kept = pool.slice(0, size - 1);
    const replaced = pool[size - 1];
    const st = squadStats(draft.slots);
    const user = {
      user: true, name: draft.name, short: userShort(draft.name), strength: st.rating,
      kit: draft.era === 'retro' ? ['#151515', '#9be22d', 'band'] : ['#0b1e3a', '#2ad2ff', 'band'],
      scorers: draft.slots.map((s) => ({ name: s.player.name, w: SCORE_WEIGHT[s.pos] })),
    };
    const entries = [user, ...kept.map((t) => ({
      name: t.name, short: t.short, kit: t.kit, strength: t.strength,
      scorers: t.players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11).map((p) => ({ name: p.name, w: SCORE_WEIGHT[p.pos] })),
    }))];
    const all = entries.map((_, i) => i);

    let groups;
    if (fmt === 'league') groups = [{ name: COMPS.pl.name, members: all, rounds: shuffle(roundRobin(all)) }];
    else if (fmt === 'swiss') groups = [{ name: 'League Phase', members: all, rounds: swissRounds(all, 8) }];
    else {
      groups = drawGroups(all, fmt === 'groups8' ? 8 : 4, entries);
      groups.forEach((g) => {
        const rr = roundRobin(g.members);
        g.rounds = fmt === 'groups8' ? rr.concat(rr.map((m) => m.map(([h, a]) => [a, h]))) : rr;
      });
    }

    season = {
      fmt, comp: draft.comp, era: draft.era, entries, groups, replaced: replaced.name,
      table: entries.map(() => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })),
      stage: 'table', md: 0, totalMd: Math.max(...groups.map((g) => g.rounds.length)),
      ko: null, last: null, log: [], userOut: false, exit: null, done: false, champion: null,
    };
  }

  function standings(members) {
    const T = season.table;
    return members.slice().sort((a, b) => (T[b].pts - T[a].pts) || ((T[b].gf - T[b].ga) - (T[a].gf - T[a].ga)) || (T[b].gf - T[a].gf) || (season.entries[b].strength - season.entries[a].strength));
  }

  function stageLabel() {
    if (season.stage === 'table') {
      const n = `Matchday ${season.md + 1} of ${season.totalMd}`;
      return season.fmt === 'league' ? n : season.fmt === 'swiss' ? 'League Phase · ' + n : 'Group Stage · ' + n;
    }
    return season.ko.names[season.ko.r];
  }

  function currentFixtures() {
    if (season.stage === 'table') {
      return season.groups.flatMap((g) => g.rounds[season.md] || []).map(([a, b]) => ({ a, b, home: season.fmt === 'league', ko: false }));
    }
    return season.ko.ties.map(([a, b]) => ({ a, b, home: false, ko: true }));
  }

  // ---------- match engine ----------
  const SCORE_WEIGHT = { ST: 6, LW: 4, RW: 4, CAM: 4, LM: 3, RM: 3, CM: 2, CDM: 1, LB: 0.6, RB: 0.6, LWB: 0.8, RWB: 0.8, CB: 0.6, GK: 0 };

  function poisson(l) {
    const L = Math.exp(-l);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  function weighted(list) {
    const tot = list.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * tot;
    for (const x of list) { r -= x.w; if (r <= 0) return x.name; }
    return list[0].name;
  }

  const xg = (s1, s2, home) => clamp(1.35 * Math.exp((s1 - s2) / 8) + (home ? 0.15 : 0), 0.2, 4.2);
  const minute = () => 1 + Math.floor(Math.random() * 90);

  function shootout(pa, pb) {
    const seq = [];
    let sa = 0, sb = 0, ka = 0, kb = 0;
    const decided = () => sa > sb + (5 - kb) || sb > sa + (5 - ka);
    while (ka < 5 || kb < 5) {
      const g = Math.random() < pa; ka++; sa += g; seq.push(['a', g]); if (decided()) break;
      const h = Math.random() < pb; kb++; sb += h; seq.push(['b', h]); if (decided()) break;
    }
    while (sa === sb) {
      const g = Math.random() < pa; sa += g; seq.push(['a', g]);
      const h = Math.random() < pb; sb += h; seq.push(['b', h]);
    }
    return { a: sa, b: sb, seq };
  }

  // result: { a, b, ga, gb, pens, winner, goals: [{min, side}] }
  function quickMatch(f) {
    const A = season.entries[f.a], B = season.entries[f.b];
    const ga = poisson(xg(A.strength, B.strength, f.home));
    const gb = poisson(xg(B.strength, A.strength, false));
    const goals = [
      ...Array.from({ length: ga }, () => ({ min: minute(), side: 'a' })),
      ...Array.from({ length: gb }, () => ({ min: minute(), side: 'b' })),
    ].sort((x, y) => x.min - y.min);
    let pens = null;
    if (f.ko && ga === gb) {
      const d = A.strength - B.strength;
      pens = shootout(clamp(0.76 + d / 80, 0.6, 0.9), clamp(0.76 - d / 80, 0.6, 0.9));
    }
    const winner = ga > gb ? f.a : gb > ga ? f.b : pens ? (pens.a > pens.b ? f.a : f.b) : null;
    return { a: f.a, b: f.b, ga, gb, pens, winner, goals, home: f.home, ko: f.ko };
  }

  // full commentary for the user's match, built on top of a quickMatch result
  function buildLive(f, others) {
    const res = quickMatch(f);
    const A = season.entries[f.a], B = season.entries[f.b];
    const d = A.strength - B.strength;
    const events = [];
    const side = (s) => (s === 'a' ? A : B);
    res.goals.forEach((g) => {
      const team = side(g.side);
      const scorer = weighted(team.scorers);
      const assist = Math.random() < 0.72 ? weighted(team.scorers.filter((p) => p.name !== scorer).map((p) => ({ ...p, w: p.w + 1 }))) : null;
      g.scorer = scorer;
      events.push({ min: g.min, side: g.side, type: 'goal', text: rand([
        `GOAL! ${scorer} finds the net${assist ? ` after great work from ${assist}` : ''}!`,
        `GOAL! ${scorer} makes no mistake${assist ? `, set up by ${assist}` : ''}.`,
        `GOAL! What a finish from ${scorer}${assist ? `! ${assist} with the assist` : '!'}`,
      ]) });
    });
    const flavour = [
      ['chance', (n) => `${n} fires just wide.`],
      ['chance', (n) => `${n} curls one over the bar.`],
      ['save', (n) => `Big save! The keeper denies ${n}.`],
      ['save', (n) => `${n} tests the keeper from distance.`],
      ['post', (n) => `${n} rattles the woodwork!`],
      ['corner', (n, t) => `Corner to ${t}. ${n} swings it in, cleared.`],
      ['card', (n) => `Yellow card for ${n}.`],
      ['foul', (n, t) => `Free kick to ${t} after ${n} is brought down.`],
      ['offside', (n) => `${n} is flagged offside.`],
      ['build', (n, t) => `${t} keep the ball well, ${n} pulling the strings.`],
      ['chance', (n) => `Great chance! ${n} heads over from close range.`],
    ];
    const share = clamp(0.5 + d / 28, 0.22, 0.78);
    const nf = 24 + Math.floor(Math.random() * 8);
    for (let i = 0; i < nf; i++) {
      const s = Math.random() < share ? 'a' : 'b';
      const [type, fn] = rand(flavour);
      events.push({ min: minute(), side: s, type, text: fn(weighted(side(s).scorers.map((p) => ({ ...p, w: p.w + 0.5 }))), side(s).name) });
    }
    events.sort((x, y) => x.min - y.min);

    const count = (s, types) => events.filter((e) => e.side === s && types.includes(e.type)).length;
    return {
      f, res, events, i: 0, min: 0, label: stageLabel(), ga: 0, gb: 0, over: false, paused: false, timer: null,
      poss: Math.round(clamp(50 + d * 1.4 + (Math.random() - 0.5) * 8, 28, 72)),
      final: {
        shots: { a: count('a', ['goal', 'chance', 'save', 'post']) + 2, b: count('b', ['goal', 'chance', 'save', 'post']) + 2 },
        sot: { a: count('a', ['goal', 'save']), b: count('b', ['goal', 'save']) },
      },
      shots: { a: 0, b: 0 }, sot: { a: 0, b: 0 },
      ball: 50,
      feed: [{ min: "0'", text: `Kick off! ${A.name} vs ${B.name}.`, cls: 'sys' }],
      shown: 0,
      others: others.map((r) => ({ r, ga: 0, gb: 0 })),
    };
  }

  function startMatchday(watch, speedKey = null) {
    const fx = currentFixtures();
    const uf = season.userOut ? null : fx.find((f) => f.a === 0 || f.b === 0);
    const others = fx.filter((f) => f !== uf).map(quickMatch);
    if (!uf || !watch) {
      commitMatchday(uf ? [quickMatch(uf), ...others] : others);
      return;
    }
    live = buildLive(uf, others);
    live.speedKey = speedKey;
    state.screen = 'match';
    render(true);
    live.shown = live.feed.length;
    scheduleTick(1200);
  }

  function commitMatchday(results) {
    queueMicrotask(saveCurrent);
    const label = stageLabel();
    season.last = { label, results };
    const mine = results.find((r) => r.a === 0 || r.b === 0);
    if (mine) {
      const home = mine.a === 0;
      season.log.push({ label, opp: season.entries[home ? mine.b : mine.a].name, gf: home ? mine.ga : mine.gb, ga: home ? mine.gb : mine.ga, pens: mine.pens ? (home ? `${mine.pens.a}-${mine.pens.b}` : `${mine.pens.b}-${mine.pens.a}`) : null, won: mine.winner === 0 });
    }
    if (season.stage === 'table') {
      const T = season.table;
      results.forEach((r) => {
        const A = T[r.a], B = T[r.b];
        A.p++; B.p++; A.gf += r.ga; A.ga += r.gb; B.gf += r.gb; B.ga += r.ga;
        if (r.ga > r.gb) { A.w++; B.l++; A.pts += 3; } else if (r.gb > r.ga) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
      });
      season.md++;
      if (season.md >= season.totalMd) finishTable();
    } else {
      advanceKO(results);
    }
  }

  function finishTable() {
    const fmt = season.fmt;
    if (fmt === 'league') {
      const order = standings(season.groups[0].members);
      season.done = true;
      season.champion = order[0];
      season.position = order.indexOf(0) + 1;
      return;
    }
    season.stage = 'ko';
    if (fmt === 'swiss') {
      const order = standings(season.groups[0].members);
      const rank = order.indexOf(0) + 1;
      if (rank > 24) { season.userOut = true; season.exit = `Out in the league phase (${ordinal(rank)})`; }
      season.ko = {
        names: ['Knockout Play-off', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'], r: 0,
        seeds: order.slice(0, 8),
        ties: Array.from({ length: 8 }, (_, j) => [order[8 + j], order[23 - j]]),
        rounds: [],
      };
      if (rank <= 8) season.byeNote = `Finished ${ordinal(rank)}: straight into the Round of 16.`;
      return;
    }
    const tables = season.groups.map((g) => standings(g.members));
    const ties = [];
    for (let g = 0; g < tables.length; g += 2) {
      ties.push([tables[g][0], tables[g + 1][1]], [tables[g + 1][0], tables[g][1]]);
    }
    const userGroupPos = tables.find((t) => t.includes(0)).indexOf(0) + 1;
    if (userGroupPos > 2) { season.userOut = true; season.exit = `Out in the group stage (${ordinal(userGroupPos)} in the group)`; }
    season.ko = { names: fmt === 'groups8' ? ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'] : ['Quarter-Final', 'Semi-Final', 'Final'], r: 0, ties, rounds: [] };
  }

  function advanceKO(results) {
    const ko = season.ko;
    // keep results in tie order so the bracket pairs up correctly
    const ordered = ko.ties.map(([a, b]) => results.find((r) => r.a === a && r.b === b));
    ko.rounds.push({ name: ko.names[ko.r], results: ordered });
    const winners = ordered.map((r) => r.winner);
    const mine = ordered.find((r) => r.a === 0 || r.b === 0);
    if (mine && mine.winner !== 0) { season.userOut = true; season.exitRound = ko.names[ko.r]; season.exit = `Knocked out in the ${ko.names[ko.r]}`; }
    if (winners.length === 1) {
      season.done = true;
      season.champion = winners[0];
      return;
    }
    if (season.fmt === 'swiss' && ko.r === 0) {
      ko.ties = ko.seeds.map((s, k) => [s, winners[7 - k]]);
    } else {
      ko.ties = [];
      for (let i = 0; i < winners.length; i += 2) ko.ties.push([winners[i], winners[i + 1]]);
    }
    ko.r++;
  }

  // ---------- live match ----------
  // a Quick Sim match runs at fast-forward speed without changing your saved speed
  const liveSpeed = () => (live && live.speedKey) || state.speed;

  function scheduleTick(delay) {
    clearTimeout(live.timer);
    live.timer = setTimeout(tick, delay ?? SPEEDS[liveSpeed()]);
  }

  function tick() {
    if (!live || live.over || live.paused) return;
    live.min++;
    const m = live.min;
    let goal = null;
    let ballTo = null;
    while (live.i < live.events.length && live.events[live.i].min <= m) {
      const e = live.events[live.i++];
      if (e.type === 'goal') { e.side === 'a' ? live.ga++ : live.gb++; goal = e.side; }
      if (['goal', 'chance', 'save', 'post', 'corner'].includes(e.type)) ballTo = e.side;
      live.feed.unshift({ min: e.min + "'", text: e.text, cls: (e.type === 'goal' ? 'goal ' : '') + 'side-' + e.side });
    }
    live.others.forEach((o) => {
      const before = o.ga + o.gb;
      o.ga = o.r.goals.filter((g) => g.side === 'a' && g.min <= m).length;
      o.gb = o.r.goals.filter((g) => g.side === 'b' && g.min <= m).length;
      o.flash = o.ga + o.gb > before;
    });
    if (m === 45) live.feed.unshift({ min: "45'", text: `Half time. ${season.entries[live.f.a].short} ${live.ga} - ${live.gb} ${season.entries[live.f.b].short}.`, cls: 'sys' });

    // ball drifts with possession, jumps to the box on chances
    if (goal) live.ball = goal === 'a' ? 97 : 3;
    else if (ballTo) live.ball = ballTo === 'a' ? 82 + Math.random() * 12 : 6 + Math.random() * 12;
    else live.ball = clamp((live.ball > 90 || live.ball < 10 ? 50 : live.ball) + (Math.random() - 0.5) * 34 + (live.poss - 50) * 0.35, 12, 88);

    const f = m / 90;
    ['a', 'b'].forEach((s) => {
      live.shots[s] = Math.round(live.final.shots[s] * f);
      live.sot[s] = Math.min(live.shots[s], Math.round(live.final.sot[s] * f));
    });

    if (m >= 90) finishLive();
    updateLiveDOM(goal);
    if (!live.over && !live.skipping) scheduleTick(m === 45 ? Math.max(SPEEDS[liveSpeed()] * 4, 600) : undefined);
  }

  function finishLive() {
    clearTimeout(live.timer);
    live.over = true;
    const A = season.entries[live.f.a], B = season.entries[live.f.b];
    live.feed.unshift({ min: 'FT', text: `Full time: ${A.name} ${live.ga} - ${live.gb} ${B.name}.`, cls: 'sys' });
    // a level knockout match goes to a shootout you take yourself; the round is saved once it ends
    if (live.f.ko && live.ga === live.gb) { startShootout(); return; }
    const p = live.res.pens;
    if (p) {
      live.feed.unshift({ min: 'PEN', text: `Shoot-out: ${p.seq.map(([s, g]) => `${(s === 'a' ? A : B).short} ${g ? '✔' : '✖'}`).join('  ')}`, cls: 'sys' });
      live.feed.unshift({ min: 'PEN', text: `${(p.a > p.b ? A : B).name} win ${Math.max(p.a, p.b)}-${Math.min(p.a, p.b)} on penalties!`, cls: 'goal side-' + (p.a > p.b ? 'a' : 'b') });
    }
    live.others.forEach((o) => { o.ga = o.r.ga; o.gb = o.r.gb; });
    commitMatchday([live.res, ...live.others.map((o) => o.r)]);
  }

  // ---------- penalty shootout ----------
  // Zones are 0-5: top row L/C/R, then bottom row L/C/R. Columns: 0 left, 1 centre, 2 right.
  const PK_X = [17, 50, 83];
  const PK_Y = [27, 70];
  const PK_KEEPER_PICK = [0.4, 0.2, 0.4];

  function startShootout() {
    const userSide = live.f.a === 0 ? 'a' : 'b';
    const user = season.entries[0];
    const opp = season.entries[userSide === 'a' ? live.f.b : live.f.a];
    const takers = (team) => team.scorers.slice().sort((x, y) => y.w - x.w).map((p) => shortName(p.name));
    const userFirst = Math.random() < 0.5;
    live.shootout = { userSide, userFirst, kicks: [], takersU: takers(user), takersO: takers(opp), oppName: opp.name, oppKit: opp.kit, userKit: user.kit, phase: null, power: 0 };
    live.feed.unshift({ min: 'PEN', text: `Penalties! ${userFirst ? 'You won the toss and shoot first.' : `${opp.name} won the toss and shoot first.`}`, cls: 'sys' });
    pkNext();
    render();
  }

  function pkCounts() {
    const k = live.shootout.kicks;
    const u = k.filter((x) => x.side === 'u'), o = k.filter((x) => x.side === 'o');
    return { ku: u.length, ko: o.length, su: u.filter((x) => x.scored).length, so: o.filter((x) => x.scored).length };
  }

  function pkDecided() {
    const { ku, ko, su, so } = pkCounts();
    if (ku < 5 || ko < 5) return su > so + (5 - ko) || so > su + (5 - ku);
    return ku === ko && su !== so; // sudden death
  }

  function pkNext() {
    const sh = live.shootout;
    if (pkDecided()) { pkEnd(); return; }
    const first = sh.userFirst ? 'u' : 'o';
    const turn = sh.kicks.length % 2 === 0 ? first : first === 'u' ? 'o' : 'u';
    const { ku, ko } = pkCounts();
    sh.turn = turn;
    sh.anim = null;
    if (turn === 'u') {
      sh.taker = sh.takersU[ku % sh.takersU.length];
      sh.phase = 'aim';
      sh.msg = `${sh.taker} steps up. Pick your spot.`;
    } else {
      sh.taker = sh.takersO[ko % sh.takersO.length];
      sh.phase = 'dive';
      sh.msg = `${sh.taker} steps up for ${sh.oppName}. Which way do you dive?`;
    }
  }

  function pkAim(zone) {
    const sh = live.shootout;
    if (!sh || sh.phase !== 'aim') return;
    sh.zone = +zone;
    sh.phase = 'power';
    sh.msg = 'Stop the meter in the green.';
    sh.power = 0;
    sh.dir = 1;
    renderShootout();
    const top = sh.zone < 3;
    const loop = () => {
      if (!live || !live.shootout || live.shootout.phase !== 'power') return;
      // top corners: a faster meter and a smaller sweet spot
      sh.power += sh.dir * (top ? 2.7 : 2.1);
      if (sh.power >= 100) { sh.power = 100; sh.dir = -1; }
      if (sh.power <= 0) { sh.power = 0; sh.dir = 1; }
      const m = $('#pk-marker');
      if (m) m.style.left = sh.power + '%';
      sh.raf = requestAnimationFrame(loop);
    };
    sh.raf = requestAnimationFrame(loop);
  }

  function pkQuality(power, top) {
    const off = Math.abs(power - 50);
    const green = top ? 7 : 10, amber = top ? 17 : 22;
    return off <= green ? 'perfect' : off <= amber ? 'ok' : 'miss';
  }

  function pkShoot() {
    const sh = live.shootout;
    if (!sh || sh.phase !== 'power') return;
    cancelAnimationFrame(sh.raf);
    const col = sh.zone % 3, top = sh.zone < 3;
    const q = pkQuality(sh.power, top);
    const keeper = weightedIndex(PK_KEEPER_PICK);
    let scored, text;
    if (q === 'miss') {
      scored = false;
      text = top ? `${sh.taker} blazes it over the bar!` : `${sh.taker} drags it wide!`;
      sh.anim = { x: top ? PK_X[col] : col === 1 ? 62 : col === 0 ? -8 : 108, y: top ? -14 : PK_Y[1], keeper };
    } else {
      const saveChance = keeper !== col ? 0 : col === 1 ? (top ? 0.35 : 0.85) : top ? (q === 'perfect' ? 0.15 : 0.45) : (q === 'perfect' ? 0.5 : 0.8);
      scored = Math.random() >= saveChance;
      text = scored ? (q === 'perfect' && top ? `${sh.taker} picks out the top corner!` : `${sh.taker} scores!`) : `Saved! The keeper reads ${sh.taker}.`;
      sh.anim = { x: PK_X[col], y: PK_Y[top ? 0 : 1], keeper, keeperTop: top };
    }
    pkResolve('u', scored, text);
  }

  function pkDive(col) {
    const sh = live.shootout;
    if (!sh || sh.phase !== 'dive') return;
    col = +col;
    const shotCol = weightedIndex([0.38, 0.24, 0.38]);
    const top = Math.random() < 0.45;
    let scored, text;
    if (Math.random() < 0.08) {
      scored = false;
      text = top ? `${sh.taker} fires it over!` : `${sh.taker} hits the post!`;
      sh.anim = { x: top ? PK_X[shotCol] : shotCol === 0 ? 3 : shotCol === 2 ? 97 : 50, y: top ? -14 : PK_Y[1], keeper: col, user: true };
    } else {
      const saveChance = col !== shotCol ? 0 : shotCol === 1 ? 0.7 : top ? 0.3 : 0.6;
      scored = Math.random() >= saveChance;
      text = scored ? `${sh.taker} scores for ${sh.oppName}.` : `SAVED! You keep out ${sh.taker}!`;
      sh.anim = { x: PK_X[shotCol], y: PK_Y[top ? 0 : 1], keeper: col, keeperTop: top, user: true };
    }
    pkResolve('o', scored, text);
  }

  function weightedIndex(weights) {
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  }

  function pkResolve(side, scored, text) {
    const sh = live.shootout;
    sh.phase = 'anim';
    sh.msg = '';
    renderShootout();
    // kick the ball and dive on the next frame so the transitions run
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ball = $('#pk-ball'), kp = $('#pk-keeper');
      if (ball) { ball.style.left = sh.anim.x + '%'; ball.style.top = sh.anim.y + '%'; ball.classList.add('kicked'); }
      if (kp) kp.className = `pk-keeper dive-${['l', 'c', 'r'][sh.anim.keeper]}${sh.anim.keeperTop ? ' high' : ''}`;
    }));
    setTimeout(() => {
      if (!live || live.shootout !== sh) return;
      sh.kicks.push({ side, scored, taker: sh.taker });
      sh.msg = text;
      sh.flash = scored ? (side === 'u' ? 'good' : 'bad') : side === 'u' ? 'bad' : 'good';
      live.feed.unshift({ min: 'PEN', text, cls: (scored ? 'goal ' : '') + 'side-' + (side === 'u' ? sh.userSide : sh.userSide === 'a' ? 'b' : 'a') });
      sh.phase = 'between';
      renderShootout();
      setTimeout(() => {
        if (!live || live.shootout !== sh) return;
        sh.flash = null;
        pkNext();
        renderShootout();
      }, 1300);
    }, 900);
  }

  function pkEnd() {
    const sh = live.shootout;
    const { su, so } = pkCounts();
    const userWon = su > so;
    const oppIdx = live.f.a === 0 ? live.f.b : live.f.a;
    const mine = (side) => (side === 'u' ? sh.userSide : sh.userSide === 'a' ? 'b' : 'a');
    live.res.pens = {
      a: sh.userSide === 'a' ? su : so,
      b: sh.userSide === 'a' ? so : su,
      seq: sh.kicks.map((k) => [mine(k.side), k.scored]),
    };
    live.res.winner = userWon ? 0 : oppIdx;
    sh.phase = 'done';
    sh.msg = userWon ? `You win ${su}-${so} on penalties!` : `${sh.oppName} win ${so}-${su} on penalties.`;
    live.feed.unshift({ min: 'PEN', text: sh.msg, cls: 'goal side-' + (userWon ? sh.userSide : sh.userSide === 'a' ? 'b' : 'a') });
    live.others.forEach((o) => { o.ga = o.r.ga; o.gb = o.r.gb; });
    commitMatchday([live.res, ...live.others.map((o) => o.r)]);
    render();
  }

  function pkTally(side) {
    const sh = live.shootout;
    const ks = sh.kicks.filter((k) => k.side === side);
    const slots = Math.max(5, ks.length);
    const dots = Array.from({ length: slots }, (_, i) => {
      const k = ks[i];
      return `<i class="${k ? (k.scored ? 'in' : 'out') : ''}">${k ? (k.scored ? '&#10003;' : '&#10007;') : ''}</i>`;
    }).join('');
    const name = side === 'u' ? season.entries[0].short : season.entries[live.f.a === 0 ? live.f.b : live.f.a].short;
    return `<div class="pk-row ${side === 'u' ? 'me' : ''}"><b>${esc(name)}</b><div class="pk-dots">${dots}</div><span>${ks.filter((k) => k.scored).length}</span></div>`;
  }

  function shootoutHTML() {
    const sh = live.shootout;
    const shooting = sh.turn === 'u';
    const keeperKit = shooting ? sh.oppKit : sh.userKit;
    const zones = sh.phase === 'aim'
      ? `<div class="pk-zones">${[0, 1, 2, 3, 4, 5].map((z) => `<button class="pk-zone" data-nav data-key="pk-z${z}" data-action="pkAim" data-arg="${z}" aria-label="${['Top left', 'Top centre', 'Top right', 'Bottom left', 'Bottom centre', 'Bottom right'][z]}" ${z === 3 ? 'data-autofocus' : ''}></button>`).join('')}</div>`
      : '';
    const target = sh.phase === 'power' ? `<span class="pk-target" style="left:${PK_X[sh.zone % 3]}%;top:${PK_Y[sh.zone < 3 ? 0 : 1]}%"></span>` : '';
    let controls = '';
    if (sh.phase === 'power') {
      const top = sh.zone < 3;
      controls = `<div class="pk-meter ${top ? 'top' : ''}"><span class="pk-band"></span><span class="pk-marker" id="pk-marker" style="left:${sh.power}%"></span></div>
        <button class="btn btn-primary wide" data-nav data-key="pk-shoot" data-action="pkShoot" data-autofocus>Shoot!</button>`;
    } else if (sh.phase === 'dive') {
      controls = `<div class="pk-dive">
        <button class="btn" data-nav data-key="pk-d0" data-action="pkDive" data-arg="0">&#8592; Dive Left</button>
        <button class="btn" data-nav data-key="pk-d1" data-action="pkDive" data-arg="1" data-autofocus>Stay Centre</button>
        <button class="btn" data-nav data-key="pk-d2" data-action="pkDive" data-arg="2">Dive Right &#8594;</button></div>`;
    } else if (sh.phase === 'done') {
      controls = liveActions();
    }
    return `<section class="panel shootout" id="shootout">
      <h2 class="panel-title">Penalty Shootout</h2>
      <div class="pk-tally">${pkTally('u')}${pkTally('o')}</div>
      <p class="pk-msg ${sh.flash || ''}">${esc(sh.msg || (shooting ? `${sh.taker} runs up...` : `${sh.taker} runs up...`))}</p>
      <div class="pk-goal ${shooting ? 'shooting' : 'saving'}">
        <div class="pk-net"></div>
        ${target}
        <div class="pk-keeper" id="pk-keeper" style="--kit:${keeperKit[0]};--kit2:${keeperKit[1]}"></div>
        <div class="pk-ball" id="pk-ball"></div>
        ${zones}
      </div>
      <div class="pk-controls">${controls}</div>
    </section>`;
  }

  function renderShootout() {
    const el = $('#shootout');
    if (!el) { render(); return; }
    el.outerHTML = shootoutHTML();
    const f = $('#shootout [data-autofocus]');
    if (f) f.focus({ preventScroll: true });
  }

  function skipLive() {
    if (!live || live.over) return;
    live.skipping = true;
    live.paused = false;
    clearTimeout(live.timer);
    while (!live.over) tick();
  }

  function updateLiveDOM(goal) {
    if (state.screen !== 'match' || !$('#sb-score')) return;
    $('#sb-score').textContent = `${live.ga} - ${live.gb}`;
    $('#sb-clock').textContent = live.over ? 'FT' : live.min + "'";
    const fresh = live.feed.length - live.shown;
    if (fresh > 0) $('#feed').insertAdjacentHTML('afterbegin', live.feed.slice(0, fresh).map(feedLine).join(''));
    live.shown = live.feed.length;
    $('#mstats').innerHTML = liveStats();
    $('#ball').style.left = live.ball + '%';
    $('#ball').style.transitionDuration = Math.min(SPEEDS[liveSpeed()], 700) + 'ms';
    $('#clockbar').style.width = (live.min / 90) * 100 + '%';
    const other = $('#others');
    if (other) other.innerHTML = othersHTML();
    if (goal && !live.skipping) {
      const fl = $('#goal-flash');
      fl.classList.remove('show', 'opp');
      void fl.offsetWidth;
      fl.classList.add('show');
      const userSide = live.f.a === 0 ? 'a' : 'b';
      if (goal !== userSide) fl.classList.add('opp');
    }
    if (live.over && !live.shootout) {
      $('#match-actions').innerHTML = liveActions();
      hintsEl.innerHTML = hints();
      const btn = $('#match-actions [data-autofocus]');
      if (btn) btn.focus();
    }
  }

  function feedLine(f) {
    return `<li class="fl ${f.cls || ''}"><span class="fl-min">${f.min}</span><span>${esc(f.text)}</span></li>`;
  }

  function liveStats() {
    const row = (label, a, b) => {
      const tot = a + b || 1;
      return `<div class="ms-row"><b>${a}</b><div class="ms-bar"><i style="width:${(a / tot) * 100}%"></i></div><b>${b}</b><small>${label}</small></div>`;
    };
    return row('Possession %', live.poss, 100 - live.poss) + row('Shots', live.shots.a, live.shots.b) + row('On target', live.sot.a, live.sot.b);
  }

  function othersHTML() {
    if (!live.others.length) return '<p class="muted">No other games this round.</p>';
    return live.others.map((o) => {
      const A = season.entries[o.r.a], B = season.entries[o.r.b];
      return `<div class="os-row ${o.flash ? 'flash' : ''}"><span>${esc(A.short)}</span><b>${o.ga} - ${o.gb}</b><span>${esc(B.short)}</span></div>`;
    }).join('');
  }

  function liveActions() {
    if (live.shootout && live.shootout.phase !== 'done') return '<p class="muted center">Penalties! Take them above.</p>';
    if (!live.over) {
      return `<div class="speed-row">${Object.keys(SPEEDS).map((s) => `<button class="chip mini ${liveSpeed() === s ? 'on' : ''}" data-nav data-key="spd-${s}" data-action="setSpeed" data-arg="${s}"><b>${s}</b></button>`).join('')}</div>
        <button class="btn wide" data-nav data-key="pause" data-action="togglePause">${live.paused ? 'Resume' : 'Pause'}</button>
        <button class="btn wide" data-nav data-key="skip" data-action="skipMatch">Skip To Full Time</button>`;
    }
    const userSide = live.f.a === 0 ? 'a' : 'b';
    const r = live.res;
    const userGoals = userSide === 'a' ? r.ga : r.gb, oppGoals = userSide === 'a' ? r.gb : r.ga;
    const won = r.winner === 0, drew = r.winner === null;
    return `<div class="result ${won ? 'win' : drew ? 'draw' : 'lose'}">${won ? 'Win' : drew ? 'Draw' : 'Defeat'}</div>
      <div class="muted center">${userGoals} - ${oppGoals}${r.pens ? ' (pens)' : ''}</div>
      <button class="btn btn-primary wide" data-nav data-key="continue" data-action="leaveMatch" data-autofocus>Continue</button>
      ${adSlot()}`;
  }

  SCREENS.match = () => {
    if (!live) return SCREENS.season();
    const A = season.entries[live.f.a], B = season.entries[live.f.b];
    return `<div class="page">
      <div class="scorebug">
        <span class="sb-kit">${shirt(A.kit)}</span>
        <span class="sb-team ${A.user ? 'me' : ''}">${esc(A.short)}</span>
        <span class="sb-score" id="sb-score">${live.ga} - ${live.gb}</span>
        <span class="sb-team ${B.user ? 'me' : ''}">${esc(B.short)}</span>
        <span class="sb-kit">${shirt(B.kit)}</span>
        <span class="sb-clock" id="sb-clock">${live.over ? 'FT' : live.min + "'"}</span>
      </div>
      <h1 class="page-title center">${esc(live.label)}</h1>
      ${live.shootout ? shootoutHTML() : ''}
      <div class="live-pitch" ${live.shootout ? 'hidden' : ''}>
        <div class="lp-lines"><i></i><i></i><i></i></div>
        <div class="lp-name left">${esc(A.name)}</div><div class="lp-name right">${esc(B.name)}</div>
        <div class="lp-ball" id="ball" style="left:${live.ball}%"></div>
        <div class="lp-clock"><i id="clockbar" style="width:${(live.min / 90) * 100}%"></i></div>
      </div>
      <div class="match-grid">
        <section class="panel">
          <h2 class="panel-title">Commentary</h2>
          <ul class="feed" id="feed">${live.feed.map(feedLine).join('')}</ul>
        </section>
        <div>
          <section class="panel">
            <h2 class="panel-title">Match Stats</h2>
            <div id="mstats">${liveStats()}</div>
            <div id="match-actions" class="match-actions">${live.shootout ? '' : liveActions()}</div>
          </section>
          <section class="panel">
            <h2 class="panel-title">Around The Grounds</h2>
            <div id="others" class="others">${othersHTML()}</div>
          </section>
        </div>
      </div>
      <div class="goal-flash" id="goal-flash">GOAL!</div>
    </div>`;
  };

  // ---------- season hub ----------
  SCREENS.season = () => {
    if (!season) return SCREENS.home();
    const E = season.entries;
    const head = `<div class="season-head">
        <div class="comp-badge">${shirt(COMPS[season.comp].kit, 'big')}</div>
        <div><h1 class="page-title">${COMPS[season.comp].name}</h1>
          <div class="muted">${DB[season.era].label} &middot; ${esc(E[0].name)} (${E[0].strength} OVR) took the place of ${esc(season.replaced)}</div></div>
      </div>`;

    let main;
    if (season.done) {
      const champ = season.champion === 0;
      const summary = season.fmt === 'league'
        ? `You finished <b>${ordinal(season.position)}</b> with ${season.table[0].pts} points.`
        : champ ? 'You won the final!' : esc(season.exit || 'Season over.');
      main = `<section class="panel next-card">
        <h2 class="panel-title">${champ ? 'Champions!' : 'Season Complete'}</h2>
        <div class="trophy-mini ${champ ? '' : 'dim'}">&#127942;</div>
        <p class="lead center">${summary}<br><span class="muted">Winner: ${esc(E[season.champion].name)}</span></p>
        ${rewardHTML()}
        <button class="btn btn-primary wide" data-nav data-key="finish" data-action="finishSeason" data-autofocus>Save &amp; Finish</button>
      </section>`;
    } else if (season.userOut) {
      main = `<section class="panel next-card">
        <h2 class="panel-title">Eliminated</h2>
        <p class="lead">${esc(season.exit)}.</p>
        ${season.exitRound ? rewardHTML() : ''}
        <p class="muted">Next up: ${esc(stageLabel())}</p>
        <button class="btn btn-primary wide" data-nav data-key="simend" data-action="simToEnd" data-autofocus>See Who Wins</button>
        <button class="btn wide" data-nav data-key="finish" data-action="finishSeason">Save &amp; Finish Now</button>
      </section>`;
    } else if (!currentFixtures().some((x) => x.a === 0 || x.b === 0)) {
      main = `<section class="panel next-card">
        <h2 class="panel-title">${esc(stageLabel())}</h2>
        <p class="lead">${esc(season.byeNote || 'You have a bye this round.')}</p>
        <p class="muted">The other clubs play this round. You're straight through to the next one.</p>
        <button class="btn btn-primary wide" data-nav data-key="simround" data-action="simRound" data-autofocus>Play Out ${esc(stageLabel())}</button>
        <button class="btn btn-violet wide" data-nav data-key="simend" data-action="simToEnd">Sim To End</button>
      </section>`;
    } else {
      const f = currentFixtures().find((x) => x.a === 0 || x.b === 0);
      const A = E[f.a], B = E[f.b];
      const side = (T, isHome) => `<div class="nx-side ${T.user ? 'me' : ''}">${shirt(T.kit, 'big')}<b>${esc(T.name)}</b><span>${T.strength} OVR${season.fmt === 'league' ? (isHome ? ' &middot; Home' : ' &middot; Away') : ''}</span></div>`;
      main = `<section class="panel next-card">
        <h2 class="panel-title">${esc(stageLabel())}</h2>
        ${season.byeNote && season.ko && season.ko.r === 1 ? `<p class="accent">${esc(season.byeNote)}</p>` : ''}
        <div class="nx">${side(A, true)}<div class="nx-vs">VS</div>${side(B, false)}</div>
        <button class="btn btn-primary wide" data-nav data-key="watch" data-action="watchMatch" data-autofocus>Play Match</button>
        <div class="btn-pair">
          <button class="btn btn-orange" data-nav data-key="quick" data-action="quickMatch">Quick Sim</button>
          <button class="btn btn-violet" data-nav data-key="simend" data-action="simToEnd">Sim To End</button>
        </div>
        <p class="muted center small-note">Play Match runs at ${state.speed} speed (about ${Math.round((SPEEDS[state.speed] * 90) / 1000)}s). Quick Sim fast-forwards through it in a few seconds.</p>
      </section>`;
    }

    return `<div class="page">
      ${head}
      <div class="season-grid">
        <div>${main}${adSlot()}${lastResultsHTML()}${formHTML()}</div>
        <div>${season.stage === 'ko' ? bracketHTML() : ''}${tablesHTML()}</div>
      </div>
    </div>`;
  };

  function lastResultsHTML() {
    if (!season.last) return '';
    const E = season.entries;
    const rows = season.last.results.slice().sort((x, y) => ((y.a === 0 || y.b === 0) - (x.a === 0 || x.b === 0)));
    return `<section class="panel">
      <h2 class="panel-title">Results &middot; ${esc(season.last.label)}</h2>
      <div class="results">${rows.map((r) => `<div class="res-row ${r.a === 0 || r.b === 0 ? 'me' : ''}">
        <span class="${r.winner === r.a ? 'w' : ''}">${esc(E[r.a].name)}</span>
        <b>${r.ga} - ${r.gb}${r.pens ? `<small> (${r.pens.a}-${r.pens.b}p)</small>` : ''}</b>
        <span class="${r.winner === r.b ? 'w' : ''}">${esc(E[r.b].name)}</span></div>`).join('')}</div>
    </section>`;
  }

  function formHTML() {
    if (!season.log.length) return '';
    return `<section class="panel"><h2 class="panel-title">Your Results</h2>
      <div class="form-list">${season.log.slice().reverse().map((g) => {
        const cls = g.won ? 'w' : g.gf === g.ga && !g.pens ? 'd' : 'l';
        return `<div class="form-row-item"><span class="pill ${cls}">${cls.toUpperCase()}</span><span>${g.gf}-${g.ga}${g.pens ? ` (${esc(g.pens)}p)` : ''} vs ${esc(g.opp)}</span><small class="muted">${esc(g.label)}</small></div>`;
      }).join('')}</div></section>`;
  }

  function tablesHTML() {
    const E = season.entries;
    const T = season.table;
    const fmt = season.fmt;
    if (fmt === 'league' || fmt === 'swiss') {
      const order = standings(season.groups[0].members);
      const zone = (pos) => {
        if (fmt === 'league') return pos <= 4 ? 'z-top' : pos > order.length - 3 ? 'z-bottom' : '';
        return pos <= 8 ? 'z-top' : pos <= 24 ? 'z-mid' : 'z-bottom';
      };
      const legend = fmt === 'league'
        ? '<span class="lg z-top">Top 4</span><span class="lg z-bottom">Bottom 3</span>'
        : '<span class="lg z-top">1-8: Round of 16</span><span class="lg z-mid">9-24: Play-off</span><span class="lg z-bottom">25+: Out</span>';
      return `<section class="panel"><h2 class="panel-title">${fmt === 'league' ? 'Table' : 'League Phase Table'}</h2>
        <div class="legend">${legend}</div>
        <table class="table"><thead><tr><th>#</th><th class="t-name">Team</th><th>P</th><th class="hide-sm">W</th><th class="hide-sm">D</th><th class="hide-sm">L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${order.map((i, k) => {
          const r = T[i];
          return `<tr class="${E[i].user ? 'me' : ''} ${zone(k + 1)}"><td>${k + 1}</td><td class="t-name">${esc(E[i].name)}</td><td>${r.p}</td><td class="hide-sm">${r.w}</td><td class="hide-sm">${r.d}</td><td class="hide-sm">${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`;
        }).join('')}</tbody></table></section>`;
    }
    const groups = season.groups.slice().sort((x, y) => y.members.includes(0) - x.members.includes(0));
    return `<section class="panel"><h2 class="panel-title">Groups</h2><div class="group-grid">${groups.map((g) => `<div class="group">
        <h3>${g.name}</h3>
        <table class="table compact"><tbody>${standings(g.members).map((i, k) => {
          const r = T[i];
          return `<tr class="${E[i].user ? 'me' : ''} ${k < 2 ? 'z-top' : ''}"><td>${k + 1}</td><td class="t-name">${esc(E[i].short)}</td><td>${r.p}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`;
        }).join('')}</tbody></table></div>`).join('')}</div></section>`;
  }

  function bracketHTML() {
    const E = season.entries;
    const ko = season.ko;
    const tie = (a, b, r) => `<div class="tie ${a === 0 || b === 0 ? 'me' : ''}">
      <span class="${r && r.winner === a ? 'w' : ''}">${esc(E[a].short)}</span>
      <b>${r ? `${r.ga}-${r.gb}${r.pens ? '<small>p</small>' : ''}` : 'v'}</b>
      <span class="${r && r.winner === b ? 'w' : ''}">${esc(E[b].short)}</span></div>`;
    const done = ko.rounds.map((rd) => `<div class="br-round"><h3>${rd.name}</h3>${rd.results.map((r) => tie(r.a, r.b, r)).join('')}</div>`);
    const next = season.done ? [] : [`<div class="br-round current"><h3>${ko.names[ko.r]}</h3>${ko.ties.map(([a, b]) => tie(a, b)).join('')}</div>`];
    return `<section class="panel"><h2 class="panel-title">Knockouts</h2><div class="bracket-cols">${[...done, ...next].join('')}</div></section>`;
  }

  // house ads fill the ad slots until a real ad network is connected
  const HOUSE_ADS = [
    ['Out of rerolls?', 'Grab 6 rerolls for $2.49.', 'Shop Rerolls'],
    ['Short on coins?', '1,500 coins for $2.49.', 'Get Coins'],
    ['Tired of banners?', 'Go ad-free for $2.99, once and done.', 'Remove Ads'],
    ['Retro 14/15 is live', 'Draft prime Ronaldo, Messi and Robben.', 'Play Retro'],
  ];
  let adTurn = Math.floor(Math.random() * HOUSE_ADS.length);
  function adSlot() {
    if (wallet.noAds) return '';
    const [title, body, cta] = HOUSE_ADS[adTurn++ % HOUSE_ADS.length];
    const action = cta === 'Play Retro' ? 'data-action="quickSetup" data-arg="pl|retro"' : 'data-action="go" data-arg="store"';
    return `<aside class="ad-slot"><span class="ad-label">Ad</span><div class="ad-body"><b>${title}</b><span>${body}</span></div>
      <button class="btn btn-ad" data-nav data-key="ad-cta" ${action}>${cta}</button></aside>`;
  }

  function productCard(id, owned) {
    const pr = PRODUCTS[id];
    const cost = pr.coins ? `<span class="price coins"><i class="coin"></i>${fmtNum(pr.coins)}</span>` : `<span class="price">${pr.price}</span>`;
    return `<div class="product p-${pr.color}">
      ${pr.tag ? `<span class="p-tag">${pr.tag}</span>` : ''}
      <div class="p-icon">${id === 'noads' ? '<span class="p-noads">AD</span>' : pr.coinPack ? `<span class="p-count"><i class="coin"></i>${fmtNum(pr.coinPack)}</span>` : `<span class="p-count">+${pr.amount}</span>`}</div>
      <b class="p-name">${pr.name}</b><span class="p-desc">${pr.desc}</span>
      ${owned ? '<span class="price owned">Owned</span>' : cost}
      <button class="btn btn-buy" data-nav data-key="buy-${id}" data-action="buy" data-arg="${id}" ${owned ? 'disabled' : ''}>${owned ? 'Active' : pr.coins ? 'Buy With Coins' : 'Buy'}</button>
    </div>`;
  }

  SCREENS.store = () => `<div class="page">
    <h1 class="page-title">Store</h1>
    <div class="wallet-row">
      <div class="wallet-box w-coins"><small>Coins</small><b><i class="coin"></i>${fmtNum(wallet.coins)}</b><span>Earned from season results only</span></div>
      <div class="wallet-box w-rerolls"><small>Rerolls saved</small><b>${wallet.rerolls}</b><span>Added to your ${REROLLS} free ones in every draft</span></div>
      <div class="wallet-box w-ads"><small>Ads</small><b>${wallet.noAds ? 'Off' : 'On'}</b><span>${wallet.noAds ? 'Thanks for your support' : 'Remove them below'}</span></div>
    </div>
    <section class="panel"><h2 class="panel-title">How To Earn Coins</h2>
      <div class="reward-table">
        <div><b>${fmtNum(REWARDS.cup.Champion)}</b><span>Win the Champions League or World Cup</span></div>
        <div><b>${fmtNum(REWARDS.league[0][2])}</b><span>Win the Premier League</span></div>
        <div><b>${fmtNum(REWARDS.cup.Final)}</b><span>Reach a final</span></div>
        <div><b>${fmtNum(REWARDS.cup['Semi-Final'])}</b><span>Reach a semi-final</span></div>
        <div><b>${fmtNum(REWARDS.league[1][2])}</b><span>Finish top 4 in the Premier League</span></div>
      </div></section>
    <section class="panel"><h2 class="panel-title">Rerolls</h2>
      <div class="product-grid">${['c1', 'c2', 'r2', 'r6', 'r15'].map((id) => productCard(id)).join('')}</div></section>
    <section class="panel"><h2 class="panel-title">Coins</h2>
      <div class="product-grid">${['k500', 'k1500', 'k4000'].map((id) => productCard(id)).join('')}</div></section>
    <section class="panel"><h2 class="panel-title">Ad-Free</h2>
      <div class="product-grid">${productCard('noads', wallet.noAds)}</div></section>
    <p class="muted small-note">Demo store: purchases are free for now and saved on this device. No payment details are collected.</p>
  </div>`;

  // ----- bottom sheet (checkout and quick reroll top-up) -----
  function openSheet(sheet) { state.sheet = sheet; renderSheet(); }
  function closeSheet() { stopAd(); state.sheet = null; renderSheet(); }

  const AD_PROMOS = [
    ['Retro 14/15', 'Prime Ronaldo. Prime Messi. Robben cutting inside. Draft them all in Retro mode.', ['#c8ff1a', '#1f8a00']],
    ['Win the Champions League', 'Lift it and bank 500 coins. Reach the final for 200.', ['#19d6ff', '#3b1fb8']],
    ['Go ad-free', 'Remove Ads for $2.99. Ad rerolls stay available whenever you want them.', ['#ff2d8f', '#8b46ff']],
    ['Build your best XI', 'Every finished draft goes on your leaderboard. Can you top it?', ['#ffcf1a', '#e0461f']],
  ];
  let adTimer = null;
  function stopAd() { clearInterval(adTimer); adTimer = null; }

  function adHTML(sh) {
    const [title, body, [c1, c2]] = AD_PROMOS[sh.promo];
    const left = Math.max(0, AD_SECONDS - sh.elapsed);
    const done = left === 0;
    return `<div class="ad-top"><span class="ad-label">Ad</span><span class="muted">${done ? 'Reward earned' : `Reward in ${left}s`}</span></div>
      <div class="ad-stage" style="--c1:${c1};--c2:${c2}">
        <div class="ad-burst"></div>
        <b class="ad-brand">NEXT<i>HALF</i></b>
        <h3>${title}</h3><p>${body}</p>
      </div>
      <div class="ad-progress"><i style="width:${(sh.elapsed / AD_SECONDS) * 100}%"></i></div>
      ${done ? `<button class="btn btn-primary wide" data-nav data-key="ad-collect" data-action="collectAd" data-autofocus>Collect +1 Reroll</button>`
        : `<button class="btn wide" data-nav data-key="ad-close" data-action="closeSheet">Close ad (no reward)</button>`}`;
  }

  // the hook for a real rewarded-ad network: grant the reward only when the ad finishes
  function showRewardedAd() {
    stopAd();
    openSheet({ type: 'ad', elapsed: 0, promo: Math.floor(Math.random() * AD_PROMOS.length) });
    adTimer = setInterval(() => {
      if (!state.sheet || state.sheet.type !== 'ad') { stopAd(); return; }
      state.sheet.elapsed++;
      if (state.sheet.elapsed >= AD_SECONDS) stopAd();
      renderSheet();
    }, 1000);
  }

  function renderSheet() {
    const el = $('#sheet');
    const sh = state.sheet;
    if (!sh) { el.hidden = true; el.innerHTML = ''; return; }
    let inner;
    if (sh.type === 'rerolls') {
      inner = `<h2 class="panel-title">Out Of Rerolls</h2>
        <p class="lead">You've used all your rerolls. Top up to keep spinning, or pick a player from this team.</p>
        ${canWatchAd() ? `<button class="btn btn-adreward wide" data-nav data-key="sheet-ad" data-action="watchAd" data-autofocus><span class="play-ico"></span>Watch an ad for a free reroll<small>${AD_SECONDS} seconds</small></button>` : ''}
        <div class="product-grid compact">${['c1', 'c2', 'r2', 'r6'].map((id) => productCard(id)).join('')}</div>
        <button class="btn wide" data-nav data-key="sheet-close" data-action="closeSheet">Keep This Team</button>`;
    } else if (sh.type === 'ad') {
      inner = adHTML(sh);
    } else {
      const pr = PRODUCTS[sh.id];
      inner = `<h2 class="panel-title">Checkout</h2>
        <div class="checkout-line"><b>${pr.name}</b><span class="price">${pr.price}</span></div>
        <p class="muted">${pr.desc}</p>
        <p class="demo-note">Demo mode: tapping Confirm gives you the item. You won't be charged.</p>
        <div class="btn-pair">
          <button class="btn" data-nav data-key="sheet-cancel" data-action="closeSheet">Cancel</button>
          <button class="btn btn-primary" data-nav data-key="sheet-confirm" data-action="confirmBuy" data-arg="${sh.id}" data-autofocus>Confirm ${pr.price}</button>
        </div>`;
    }
    el.hidden = false;
    el.innerHTML = `<div class="sheet-backdrop" ${sh.type === 'ad' ? '' : 'data-action="closeSheet"'}></div><div class="sheet panel ${sh.type === 'ad' ? 'ad-sheet' : ''}" role="dialog" aria-modal="true">${inner}</div>`;
    const f = el.querySelector('[data-autofocus]') || el.querySelector('.btn');
    if (f) f.focus({ preventScroll: true });
  }

  function grant(id) {
    const pr = PRODUCTS[id];
    if (id === 'noads') wallet.noAds = true;
    else if (pr.coinPack) wallet.coins += pr.coinPack;
    else wallet.rerolls += pr.amount;
    saveWallet();
    toast(id === 'noads' ? 'Ads removed' : pr.coinPack ? `+${fmtNum(pr.coinPack)} coins added` : `+${pr.amount} reroll${pr.amount > 1 ? 's' : ''} added`);
  }

  function buy(id) {
    const pr = PRODUCTS[id];
    if (pr.coins) {
      if (wallet.coins < pr.coins) { toast(`You need ${fmtNum(pr.coins - wallet.coins)} more coins. Win matches to earn them.`); return; }
      wallet.coins -= pr.coins;
      grant(id);
      state.sheet = null;
      renderSheet();
      render();
      return;
    }
    openSheet({ type: 'checkout', id });
  }

  function renderWallet() {
    $('#wallet').innerHTML = `<button class="wallet-chip" data-action="go" data-arg="store" aria-label="Store: ${wallet.coins} coins, ${wallet.rerolls} rerolls saved"><i class="coin"></i>${fmtNum(wallet.coins)}<span class="wc-sep"></span><span class="wc-r">&#8635;</span>${wallet.rerolls}</button>`;
  }

  SCREENS.trophy = () => {
    const h = state.lastResult;
    return `<div class="page center-page">
      <div class="trophy ${h.champion ? '' : 'dim'}">&#127942;</div>
      <h1 class="page-title center">${h.champion ? 'Champions' : 'Season Over'}</h1>
      <p class="lead center">${esc(h.name)} &middot; ${esc(h.compName)} ${esc(h.eraLabel)} &middot; ${h.rating} OVR<br>${esc(h.result)}</p>
      <div class="action-row center">
        <button class="btn btn-primary" data-nav data-key="again" data-action="go" data-arg="setup" data-autofocus>Draft Again</button>
        <button class="btn" data-nav data-key="mysquads" data-action="go" data-arg="squads">My Squads</button>
      </div>
    </div>`;
  };

  const entryScore = (h) => (h.score != null ? h.score : (h.champion ? 1000 : 0) + h.rating);

  SCREENS.squads = () => {
    const hist = loadHistory().map((h, i) => ({ ...h, key: String(h.id || 'old' + i) }));
    const view = state.histView || 'best';
    const list = view === 'best' ? hist.slice().sort((a, b) => entryScore(b) - entryScore(a)) : hist;
    const resume = draft && (season || draft.slots.some((sl) => sl.player));
    return `<div class="page">
      <h1 class="page-title">My Squads</h1>
      ${resume ? `<section class="panel resume-card"><div><b>Draft in progress</b><span class="muted">${esc(draft.name)} &middot; ${COMPS[draft.comp].name} ${DB[draft.era].label}${season ? ` &middot; ${esc(season.done ? 'season complete' : stageLabel())}` : ` &middot; ${draft.slots.filter((sl) => sl.player).length}/11 picked`}</span></div>
        <button class="btn btn-primary" data-nav data-key="resume" data-action="go" data-arg="setup" data-autofocus>Continue Draft</button></section>` : ''}
      ${hist.length ? `<div class="chip-row small">
          ${chip('histView', 'best', view === 'best', 'Leaderboard', '', 'hv-best')}
          ${chip('histView', 'recent', view === 'recent', 'Recent', '', 'hv-recent')}
        </div>
        <div class="hist-list">${list.map((h, i) => {
          const open = state.histOpen === h.key;
          return `<button class="hist ${h.champion ? 'champ' : ''} ${open ? 'open' : ''}" data-nav data-key="h-${h.key}" data-action="toggleHist" data-arg="${h.key}" ${!resume && i === 0 ? 'data-autofocus' : ''}>
          <div class="hist-badge">${view === 'best' ? `<span class="rank r${i + 1}">${i + 1}</span>` : h.champion ? '&#127942;' : esc(h.compShort || '')}</div>
          <div class="hist-main"><b>${h.champion ? '&#127942; ' : ''}${esc(h.name)}</b><span class="muted">${esc(h.compName || '')} ${esc(h.eraLabel || '')} &middot; ${esc(h.formation)} &middot; ${esc(h.date)} &middot; ${h.rerollsUsed} reroll${h.rerollsUsed === 1 ? '' : 's'} used</span>
            <span class="hist-stars">${(h.stars || []).map((p) => esc(p)).join(' &middot; ')}</span></div>
          <div class="hist-stat"><small>OVR</small><b>${h.rating}</b></div>
          <div class="hist-result">${esc(h.result)}</div>
          ${open ? `<div class="hist-xi">${h.xi ? h.xi.map((x) => `<span class="xi-pill ${x.t ? 'toty' : ''}"><b>${x.o}</b><i>${esc(x.p)}</i>${esc(x.c)}</span>`).join('') : '<span class="muted">Line-ups are saved for seasons finished from now on.</span>'}</div>` : ''}
        </button>`;
        }).join('')}</div>
        <div class="action-row"><button class="btn ${state.confirmClear ? 'btn-danger' : ''}" data-nav data-key="clear" data-action="clearHistory">${state.confirmClear ? 'Tap Again To Clear Everything' : 'Clear History'}</button></div>`
        : `<section class="panel empty-state"><p class="lead">No seasons yet. Finish one and it shows up here.</p>
          <button class="btn btn-primary" data-nav data-key="go-draft" data-action="go" data-arg="setup" data-autofocus>Start A Draft</button></section>`}
    </div>`;
  };

  SCREENS.howto = () => `<div class="page">
    <h1 class="page-title">How To Play</h1>
    <div class="howto-grid">
      <section class="panel"><h2 class="panel-title">1 &middot; Pick a competition</h2><p>Premier League, Champions League or World Cup, in today's squads or Retro 2014/15. Then pick a formation.</p></section>
      <section class="panel"><h2 class="panel-title">2 &middot; Spin</h2><p>The wheel lands on a random team from that competition. You draft one of their players.</p></section>
      <section class="panel"><h2 class="panel-title">3 &middot; Pick the position</h2><p>Only players for the spots you still need show up. Choose one, then tap where they play on the pitch.</p></section>
      <section class="panel"><h2 class="panel-title">4 &middot; Reroll</h2><p>Don't like the team you landed on? You get <b class="accent">${REROLLS} free rerolls</b> per draft. Need more? Get them in the Store with coins. Coins come from season results: win a trophy, reach a final, or finish top 4.</p></section>
      <section class="panel"><h2 class="panel-title">5 &middot; Play the season</h2><p>Your XI replaces the weakest team in the competition. Watch matches live, fast-forward with Quick Sim, or sim ahead. Level knockout games go to a penalty shootout you take yourself.</p></section>
      <section class="panel"><h2 class="panel-title">6 &middot; Formats</h2><p>Premier League: one round of fixtures. Champions League: the 8-game league phase (or 2014/15 groups), then knockouts. World Cup: groups, then knockouts.</p></section>
    </div>
    <section class="panel"><h2 class="panel-title">Controls</h2><p>Mouse or touch works everywhere. Keyboard: arrows move, Enter selects, Esc goes back, S spins, R rerolls, P pauses a match, Q / E switch tabs.</p></section>
  </div>`;

  // ---------- draft actions ----------
  function spin(isReroll = false) {
    if (!draft || draft.phase === 'spinning' || draft.phase === 'done') return;
    if (draft.phase === 'choose' && !isReroll) return;
    const all = DB[draft.era].comps[draft.comp];
    const fits = (p) => !draft.used.has(p.name) && openFits(p).best !== 'x';
    let pool = all.filter((t) => t.players.some(fits));
    if (!pool.length) pool = all.filter((t) => t.players.some((p) => !draft.used.has(p.name)));
    let options = pool.filter((t) => t.id !== draft.lastTeamId);
    if (!options.length) options = pool;
    const target = rand(options);

    const TARGET_INDEX = 26;
    draft.pendingId = target.id;
    draft.reelItems = Array.from({ length: TARGET_INDEX + 4 }, (_, i) => (i === TARGET_INDEX ? target : rand(all)));
    draft.phase = 'spinning';
    draft.landed = null;
    draft.selected = null;
    render();

    const reel = $('#reel');
    const strip = $('#reel-strip');
    if (!reel || !strip) { land(target); return; }
    if (window.innerWidth <= 1000) reel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Measure in layout pixels (offsetLeft/offsetWidth), the same units translateX uses. On-screen sizes
    // (getBoundingClientRect) change when the page is zoomed, which made the wheel stop between teams.
    const hit = strip.children[TARGET_INDEX];
    const centre = () => reel.clientWidth / 2 - (hit.offsetLeft + hit.offsetWidth / 2);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      strip.style.transition = 'transform 2.4s cubic-bezier(.12,.75,.16,1)';
      strip.style.transform = `translateX(${centre()}px)`;
    }));
    setTimeout(() => {
      if (!hit.isConnected) return;
      // if anything moved during the spin (rotation, resize), settle exactly on the team
      strip.style.transition = 'transform 0.15s ease-out';
      strip.style.transform = `translateX(${centre()}px)`;
      hit.classList.add('hit');
    }, 2420);
    setTimeout(() => land(target), 3000);
  }

  function land(team) {
    if (!draft || draft.phase !== 'spinning') return;
    draft.landed = team;
    draft.lastTeamId = team.id;
    draft.phase = 'choose';
    draft.adOffer = canWatchAd() && Math.random() < AD_CHANCE;
    if (state.screen !== 'draft') return;
    draft.justLanded = true;
    render(true);
    draft.justLanded = false;
    if (window.innerWidth <= 1000) $('.landed').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function reroll() {
    if (!draft || draft.phase !== 'choose') return;
    if (draft.rerolls > 0) draft.rerolls--;
    else if (wallet.rerolls > 0) { wallet.rerolls--; draft.boughtUsed = (draft.boughtUsed || 0) + 1; saveWallet(); }
    else { openSheet({ type: 'rerolls' }); return; }
    spin(true);
  }

  function pickPlayer(uid) {
    if (!draft || draft.phase !== 'choose') return;
    const p = DB[draft.era].players[uid];
    if (!p || draft.used.has(p.name)) return;
    draft.selected = draft.selected === uid ? null : uid;
    render();
    if (!draft.selected) return;
    // focus the best open spot for this player
    const rank = { n: 0, a: 1, x: 2 };
    let best = -1;
    draft.slots.forEach((s, i) => {
      if (s.player) return;
      if (best < 0 || rank[fitOf(s.pos, p.pos)] < rank[fitOf(draft.slots[best].pos, p.pos)]) best = i;
    });
    const el = screenEl.querySelector(`[data-key="slot-${best}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      if (window.innerWidth <= 1000) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function placeAt(i) {
    i = +i;
    if (!draft) return;
    const slot = draft.slots[i];
    if (slot.player) return;
    if (draft.phase === 'idle') { toast('Spin for a team first.'); return; }
    if (draft.phase !== 'choose') return;
    if (!draft.selected) { toast('Pick a player from the list first.'); return; }
    const p = DB[draft.era].players[draft.selected];
    if (!canPlace(slot, p)) { toast(`${p.card} can't play ${slot.pos}. Pick a highlighted spot.`); return; }
    slot.player = p;
    draft.used.add(p.name);
    draft.landed = null;
    draft.selected = null;
    draft.phase = draft.slots.every((s) => s.player) ? 'done' : 'idle';
    render(true);
    if (window.innerWidth <= 1000) $('.draft-right').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function swapSlot(i) {
    i = +i;
    if (squadSel === null) { squadSel = i; render(); return; }
    if (squadSel !== i) {
      const a = draft.slots[squadSel], b = draft.slots[i];
      [a.player, b.player] = [b.player, a.player];
    }
    squadSel = null;
    render();
  }

  function seasonReward() {
    if (!season) return null;
    if (season.fmt === 'league') {
      if (!season.done) return null;
      const hit = REWARDS.league.find(([pos]) => season.position <= pos);
      return hit ? { label: hit[1], coins: hit[2] } : null;
    }
    if (season.done && season.champion === 0) return { label: `Win the ${COMPS[season.comp].name}`, coins: REWARDS.cup.Champion };
    const coins = REWARDS.cup[season.exitRound];
    return coins ? { label: season.exitRound === 'Final' ? 'Reach the final' : 'Reach the semi-finals', coins } : null;
  }

  function rewardHTML() {
    const r = seasonReward();
    return r ? `<div class="reward-box"><i class="coin"></i><b>+${fmtNum(r.coins)} coins</b><span>${esc(r.label)}</span></div>`
      : '<div class="reward-box none"><span>No coin reward this time. Win it, or go deep, to earn coins.</span></div>';
  }

  function finishSeason() {
    if (!season) return;
    if (live) { clearTimeout(live.timer); live = null; }
    const champion = season.done && season.champion === 0;
    const reward = (season.done || season.exitRound) ? seasonReward() : null;
    if (reward) { wallet.coins += reward.coins; saveWallet(); toast(`+${fmtNum(reward.coins)} coins: ${reward.label}`); }
    let result;
    if (season.fmt === 'league' && season.done) result = `${champion ? 'Champions! ' : ''}Finished ${ordinal(season.position)} with ${season.table[0].pts} pts`;
    else if (champion) {
      const fin = season.log[season.log.length - 1];
      result = `Won the Final ${fin.gf}-${fin.ga}${fin.pens ? ` (${fin.pens} pens)` : ''} vs ${fin.opp}`;
    } else result = season.exit || `Left during the ${stageLabel()}`;
    const st = squadStats(draft.slots);
    // how far you went, for ranking on the leaderboard
    let tier;
    if (season.fmt === 'league') tier = season.done ? (season.position === 1 ? 100 : season.position <= 4 ? 60 : Math.max(5, 45 - season.position)) : 5;
    else if (champion) tier = 100;
    else tier = { Final: 80, 'Semi-Final': 65, 'Quarter-Final': 50, 'Round of 16': 35, 'Knockout Play-off': 25 }[season.exitRound] || 15;
    const entry = {
      id: Date.now(), score: tier * 10 + st.rating,
      xi: draft.slots.map((sl) => ({ c: sl.player.card, p: sl.pos, o: effOvr(sl), t: sl.player.toty ? 1 : 0 })),
      name: draft.name, formation: draft.formation, rating: st.rating, champion, result,
      compName: COMPS[season.comp].name, compShort: COMPS[season.comp].short, eraLabel: DB[season.era].label,
      rerollsUsed: REROLLS - draft.rerolls + (draft.boughtUsed || 0), date: new Date().toLocaleDateString(),
      stars: draft.slots.map((s) => s.player).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => p.card),
    };
    saveHistory([entry, ...loadHistory()]);
    state.lastResult = entry;
    season = null;
    draft = null;
    state.screen = 'trophy';
    render(true);
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- action dispatch ----------
  const actions = {
    go, back,
    quickSetup: (arg) => {
      const [comp, era] = arg.split('|');
      Object.assign(state.setup, { comp, era });
      if (draft || season) { state.screen = 'setup'; render(true); } else go('setup');
    },
    setEra: (e) => { state.setup.era = e; render(); },
    setComp: (c) => { state.setup.comp = c; render(); },
    setFormation: (f) => { state.setup.formation = f; render(); },
    startDraft: newDraft,
    discardDraft: () => { draft = null; state.screen = 'setup'; render(true); },
    spin: () => spin(false), reroll, pickPlayer, placeAt, swapSlot,
    confirmSquad: () => { state.screen = 'squad'; render(true); },
    startSeason: () => {
      const input = $('#squad-name');
      if (input) draft.name = input.value.trim() || 'NextHalf XI';
      squadSel = null;
      buildSeason();
      state.screen = 'season';
      render(true);
    },
    watchMatch: () => startMatchday(true),
    quickMatch: () => startMatchday(true, 'quick'),
    // the user has a bye (top 8 in the league phase): play out the round without them
    simRound: () => { startMatchday(false); render(true); },
    simToEnd: () => {
      let guard = 200;
      while (season && !season.done && guard--) startMatchday(false);
      render(true);
    },
    leaveMatch: () => { live = null; state.screen = 'season'; render(true); },
    skipMatch: skipLive,
    togglePause: () => {
      if (!live || live.over) return;
      live.paused = !live.paused;
      if (!live.paused) scheduleTick();
      $('#match-actions').innerHTML = liveActions();
      hintsEl.innerHTML = hints();
    },
    setSpeed: (s) => {
      state.speed = s;
      store(SPEED_KEY, s);
      if (live) live.speedKey = null;
      if (live && !live.over) {
        $('#match-actions').innerHTML = liveActions();
        if (!live.paused) scheduleTick();
      }
    },
    finishSeason,
    // tap twice to confirm (pop-up dialogs are not available everywhere)
    buy,
    confirmBuy: (id) => { grant(id); state.sheet = null; renderSheet(); render(); },
    closeSheet,
    pkAim, pkShoot, pkDive,
    watchAd: () => { if (canWatchAd()) showRewardedAd(); },
    collectAd: () => {
      if (!draft || !state.sheet || state.sheet.type !== 'ad' || state.sheet.elapsed < AD_SECONDS) return;
      draft.rerolls++;
      draft.adsWatched = (draft.adsWatched || 0) + 1;
      draft.adOffer = false;
      closeSheet();
      render();
      toast('+1 reroll added');
    },
    histView: (v) => { state.histView = v; render(); },
    toggleHist: (k) => { state.histOpen = state.histOpen === k ? null : k; render(); },
    clearHistory: () => {
      if (state.confirmClear) { saveHistory([]); state.confirmClear = false; } else state.confirmClear = true;
      render();
    },
  };

  document.addEventListener('click', (e) => {
    if (state.sheet && !e.target.closest('#sheet')) return;
    const tab = e.target.closest('.tab');
    if (tab) { switchTab(tab.dataset.tab); return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el.dataset.arg);
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'squad-name' && draft) draft.name = e.target.value.trim() || 'NextHalf XI';
  });

  function switchTab(tab) {
    if (live && !live.over) { toast('Finish or skip the match first.'); return; }
    if (live && live.shootout && live.shootout.phase !== 'done') { toast('Finish the penalty shootout first.'); return; }
    if (draft && draft.phase === 'spinning') return;
    if (live && live.over) live = null;
    go(tab);
  }

  // ---------- keyboard / spatial nav ----------
  function moveFocus(dir) {
    const root = state.sheet ? $('#sheet') : screenEl;
    const els = [...root.querySelectorAll('[data-nav]')].filter((e) => !e.disabled && e.tabIndex !== -1 && e.offsetParent !== null);
    if (!els.length) return;
    const cur = document.activeElement;
    if (!els.includes(cur)) { els[0].focus(); return; }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const e of els) {
      if (e === cur) continue;
      const rr = e.getBoundingClientRect();
      const dx = rr.left + rr.width / 2 - cx, dy = rr.top + rr.height / 2 - cy;
      const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      if (main <= 2) continue;
      const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      const score = main + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
      return;
    }
    const dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (dirs[e.key]) { e.preventDefault(); moveFocus(dirs[e.key]); return; }
    const k = e.key.toLowerCase();
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (k === 'q' || k === 'e') {
      const idx = TAB_ORDER.indexOf(TAB_FOR[state.screen]);
      switchTab(TAB_ORDER[(idx + (k === 'e' ? 1 : TAB_ORDER.length - 1)) % TAB_ORDER.length]);
    } else if (k === 's' && state.screen === 'draft') spin(false);
    else if (k === 'r' && state.screen === 'draft') reroll();
    else if (k === 'p' && state.screen === 'match') actions.togglePause();
    else if (e.key === ' ' && live && live.shootout && live.shootout.phase === 'power') { e.preventDefault(); pkShoot(); }
  });

  if (restoreCurrent()) setTimeout(() => toast(season ? 'Welcome back. Your season is saved.' : 'Welcome back. Your draft is saved.'), 400);
  render(true);
})();

(() => {
  'use strict';

  const REROLLS = 5;
  const HISTORY_KEY = 'nexthalf.history';
  const SPEED_KEY = 'nexthalf.speed';
  // milliseconds per match minute: "normal" plays a match in about a minute
  const SPEEDS = { slow: 1000, normal: 650, fast: 220 };

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

  function tier(ovr) {
    if (ovr >= 87) return 'elite';
    if (ovr >= 75) return 'gold';
    if (ovr >= 65) return 'silver';
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
    all.forEach((t) => {
      t.players = t.players.split(';').map((s) => {
        const [name, pos, ovr, nat] = s.split(',');
        best[name] = Math.max(best[name] || 0, +ovr);
        return { uid: `${era}:${t.id}:${name}`, name, pos, ovr: +ovr, nation: t.type === 'nation' ? t.code : nat, team: t };
      });
    });
    all.forEach((t) => {
      // the same player keeps one rating across club and country
      t.players.forEach((p) => { p.ovr = best[p.name]; players[p.uid] = p; });
      const top = t.players.map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11);
      t.strength = Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 10) / 10;
      teams[t.id] = t;
    });
    DB[era] = {
      label: E.label, teams, players,
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
      wc: `${n} nations. 4 groups of 4, then knockouts.`,
    }[compFormat(comp, era)];
  }

  // ---------- positions & rating ----------
  function fitOf(slotPos, playerPos) {
    const f = POSITION_FIT[slotPos];
    if (f.n.includes(playerPos)) return 'n';
    if (f.a.includes(playerPos)) return 'a';
    return 'x';
  }
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
  const saveHistory = (list) => store(HISTORY_KEY, list.slice(0, 40));

  // ---------- state ----------
  const state = {
    screen: 'home',
    setup: { era: 'now', comp: 'pl', formation: '4-3-3' },
    db: { era: 'now', comp: 'pl', view: null },
    speed: SPEEDS[store(SPEED_KEY)] ? store(SPEED_KEY) : 'normal',
    lastResult: null,
  };
  let draft = null;
  let squadSel = null;
  let season = null;
  let live = null;

  const currentEra = () => (season ? season.era : draft ? draft.era : state.screen === 'teams' ? state.db.era : state.setup.era);

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
  const TAB_FOR = { home: 'home', setup: 'setup', draft: 'setup', squad: 'setup', season: 'setup', match: 'setup', trophy: 'setup', squads: 'squads', teams: 'teams', howto: 'howto' };
  const TAB_ORDER = ['home', 'setup', 'squads', 'teams', 'howto'];

  function go(screen) {
    state.confirmClear = false;
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
    if (state.screen === 'teams' && state.db.view) { state.db.view = null; render(); return; }
    const map = { setup: 'home', draft: 'setup-force', squad: 'draft', squads: 'home', teams: 'home', howto: 'home', trophy: 'home' };
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

    screenEl.className = 'screen screen-' + state.screen;
    screenEl.innerHTML = (SCREENS[state.screen] || SCREENS.home)();
    hintsEl.innerHTML = hints();
    if (resetFocus) window.scrollTo(0, 0);

    let el = focusKey ? screenEl.querySelector(`[data-key="${CSS.escape(focusKey)}"]`) : null;
    if (!el || el.disabled) el = screenEl.querySelector('[data-autofocus]:not([disabled])');
    if (el) el.focus({ preventScroll: true });
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
      if (draft.phase === 'choose') out.push(hint('R', `Reroll (${draft.rerolls})`, draft.rerolls ? 'reroll' : '', 'x'));
    }
    if (s === 'match' && live && !live.over) out.push(hint('P', live.paused ? 'Resume' : 'Pause', 'togglePause', 'y'));
    out.push(`<span class="hint-spacer"></span><span class="hint-keys">Arrows navigate &middot; Q / E switch tabs</span>`);
    return out.join('');
  }

  function card(p, opts = {}) {
    const { ovr = p.ovr, pos = p.pos, size = '', extra = '' } = opts;
    return `<div class="card tier-${tier(p.ovr)} ${size} ${extra}">
      <div class="card-shine"></div>
      <div class="card-top"><div class="card-ovr">${ovr}</div><div class="card-pos">${pos}</div></div>
      <div class="card-kit">${shirt(p.team.kit)}</div>
      <div class="card-name">${esc(shortName(p.name))}</div>
      <div class="card-team"><span class="card-flag">${flag(p.nation)}</span> ${esc(p.team.short)}</div>
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
          if (sel) {
            const fit = fitOf(s.pos, sel.pos);
            cls = 'fit-' + fit;
            tag = `<small>${fit === 'n' ? sel.ovr : sel.ovr - penalty(fit)}</small>`;
          }
          inner = `<div class="slot-empty"><span>${s.pos}</span>${tag}</div>`;
        }
        if (mode === 'draft') {
          const usable = !s.player && sel;
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
          <div class="tile-badge">5 free rerolls</div>
          <div class="tile-label"><small>${resume ? 'Continue' : 'Play'}</small>${resume ? 'Resume' : 'Draft Mode'}</div>
        </button>
        ${compTile('pl', 'now', '2025/26')}
        ${compTile('ucl', 'now', '2025/26')}
        <button class="tile tile-retro" data-nav data-key="t-retro" data-action="quickSetup" data-arg="pl|retro">
          <div class="tile-art art-stat"><b>14/15</b><span>Squads &amp; ratings</span><span>from 2015</span></div>
          <div class="tile-label"><small>Throwback</small>Retro Mode</div>
        </button>
        ${compTile('wc', 'now', 'Nations')}
        <button class="tile" data-nav data-key="t-squads" data-action="go" data-arg="squads">
          <div class="tile-art art-stat"><b>${titles}</b><span>Trophies</span><span>${hist.length} seasons played</span></div>
          <div class="tile-label"><small>History</small>My Squads</div>
        </button>
        <button class="tile" data-nav data-key="t-teams" data-action="go" data-arg="teams">
          <div class="tile-art art-kits">${DB.now.comps.pl.slice(0, 6).map((t) => shirt(t.kit)).join('')}</div>
          <div class="tile-label"><small>Browse squads</small>Database</div>
        </button>
        <button class="tile" data-nav data-key="t-howto" data-action="go" data-arg="howto">
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
          ${chip('setEra', 'now', s.era === 'now', '2025/26', 'Current squads', 'era-now')}
          ${chip('setEra', 'retro', s.era === 'retro', 'Retro 2014/15', 'Squads as they were in 2015', 'era-retro')}
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
    return `<div class="reroll-pips" title="Rerolls left">${Array.from({ length: REROLLS }, (_, i) => `<i class="${i < draft.rerolls ? 'on' : ''}"></i>`).join('')}<span>${draft.rerolls} reroll${draft.rerolls === 1 ? '' : 's'} left</span></div>`;
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
    const open = draft.slots.filter((s) => !s.player).map((s) => s.pos);
    const rows = t.players.map((p) => {
      const taken = draft.used.has(p.name);
      const nat = [...new Set(open.filter((pos) => fitOf(pos, p.pos) === 'n'))];
      const alt = [...new Set(open.filter((pos) => fitOf(pos, p.pos) === 'a'))];
      const best = nat.length ? 'n' : alt.length ? 'a' : 'x';
      return { p, taken, nat, alt, best };
    }).sort((a, b) => (a.taken - b.taken) || ('nax'.indexOf(a.best) - 'nax'.indexOf(b.best)) || (b.p.ovr - a.p.ovr));
    const first = rows.find((r) => !r.taken);
    const selected = draft.selected;
    return `<section class="panel panel-tall">${head}${steps(selected ? 2 : 1)}
      <div class="landed ${draft.justLanded ? 'anim' : ''}">
        <div class="landed-kit">${shirt(t.kit, 'big')}</div>
        <div class="landed-info"><small>You landed on</small><b>${esc(t.name)}</b><span class="muted">${t.type === 'nation' ? flag(t.code) + ' ' : ''}${esc(t.league)} &middot; ${t.strength} avg</span></div>
        <button class="btn btn-reroll" data-nav data-key="reroll" data-action="reroll" ${draft.rerolls ? '' : 'disabled'}><span class="btn-glyph x">R</span>Reroll<small>${draft.rerolls} left</small></button>
      </div>
      ${selected ? `<div class="place-hint">Now tap a spot on the pitch for <b>${esc(DB[draft.era].players[selected].name)}</b>. <span class="c-n">Green</span> = natural, <span class="c-a">amber</span> = -3, <span class="c-x">red</span> = -10.</div>` : ''}
      <div class="player-list">
        ${rows.map(({ p, taken, nat, alt, best }) => {
          const badge = taken ? '<span class="fit taken">In squad</span>'
            : best === 'n' ? `<span class="fit n">Fits ${nat.join(' / ')}</span>`
            : best === 'a' ? `<span class="fit a">${alt.join(' / ')} (-3)</span>`
            : '<span class="fit x">No natural spot (-10)</span>';
          return `<button class="prow ${taken ? 'taken' : ''} ${selected === p.uid ? 'picked' : ''}" data-nav data-key="p-${esc(p.uid)}" data-action="pickPlayer" data-arg="${esc(p.uid)}" ${taken ? 'disabled' : ''} ${!selected && p === first?.p ? 'data-autofocus' : ''}>
            <span class="prow-ovr tier-${tier(p.ovr)}">${p.ovr}</span>
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

  function startMatchday(watch) {
    const fx = currentFixtures();
    const uf = season.userOut ? null : fx.find((f) => f.a === 0 || f.b === 0);
    const others = fx.filter((f) => f !== uf).map(quickMatch);
    if (!uf || !watch) {
      commitMatchday(uf ? [quickMatch(uf), ...others] : others);
      return;
    }
    live = buildLive(uf, others);
    state.screen = 'match';
    render(true);
    live.shown = live.feed.length;
    scheduleTick(1200);
  }

  function commitMatchday(results) {
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
    if (mine && mine.winner !== 0) { season.userOut = true; season.exit = `Knocked out in the ${ko.names[ko.r]}`; }
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
  function scheduleTick(delay) {
    clearTimeout(live.timer);
    live.timer = setTimeout(tick, delay ?? SPEEDS[state.speed]);
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
    if (!live.over && !live.skipping) scheduleTick(m === 45 ? SPEEDS[state.speed] * 4 : undefined);
  }

  function finishLive() {
    clearTimeout(live.timer);
    live.over = true;
    const A = season.entries[live.f.a], B = season.entries[live.f.b];
    live.feed.unshift({ min: 'FT', text: `Full time: ${A.name} ${live.ga} - ${live.gb} ${B.name}.`, cls: 'sys' });
    const p = live.res.pens;
    if (p) {
      live.feed.unshift({ min: 'PEN', text: `Shoot-out: ${p.seq.map(([s, g]) => `${(s === 'a' ? A : B).short} ${g ? '✔' : '✖'}`).join('  ')}`, cls: 'sys' });
      live.feed.unshift({ min: 'PEN', text: `${(p.a > p.b ? A : B).name} win ${Math.max(p.a, p.b)}-${Math.min(p.a, p.b)} on penalties!`, cls: 'goal side-' + (p.a > p.b ? 'a' : 'b') });
    }
    live.others.forEach((o) => { o.ga = o.r.ga; o.gb = o.r.gb; });
    commitMatchday([live.res, ...live.others.map((o) => o.r)]);
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
    $('#ball').style.transitionDuration = Math.min(SPEEDS[state.speed], 700) + 'ms';
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
    if (live.over) {
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
    if (!live.over) {
      return `<div class="speed-row">${Object.keys(SPEEDS).map((s) => `<button class="chip mini ${state.speed === s ? 'on' : ''}" data-nav data-key="spd-${s}" data-action="setSpeed" data-arg="${s}"><b>${s}</b></button>`).join('')}</div>
        <button class="btn wide" data-nav data-key="pause" data-action="togglePause">${live.paused ? 'Resume' : 'Pause'}</button>
        <button class="btn wide" data-nav data-key="skip" data-action="skipMatch">Skip To Full Time</button>`;
    }
    const userSide = live.f.a === 0 ? 'a' : 'b';
    const r = live.res;
    const userGoals = userSide === 'a' ? r.ga : r.gb, oppGoals = userSide === 'a' ? r.gb : r.ga;
    const won = r.winner === 0, drew = r.winner === null;
    return `<div class="result ${won ? 'win' : drew ? 'draw' : 'lose'}">${won ? 'Win' : drew ? 'Draw' : 'Defeat'}</div>
      <div class="muted center">${userGoals} - ${oppGoals}${r.pens ? ' (pens)' : ''}</div>
      <button class="btn btn-primary wide" data-nav data-key="continue" data-action="leaveMatch" data-autofocus>Continue</button>`;
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
      <div class="live-pitch">
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
            <div id="match-actions" class="match-actions">${liveActions()}</div>
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
        <button class="btn btn-primary wide" data-nav data-key="finish" data-action="finishSeason" data-autofocus>Save &amp; Finish</button>
      </section>`;
    } else if (season.userOut) {
      main = `<section class="panel next-card">
        <h2 class="panel-title">Eliminated</h2>
        <p class="lead">${esc(season.exit)}.</p>
        <p class="muted">Next up: ${esc(stageLabel())}</p>
        <button class="btn btn-primary wide" data-nav data-key="simend" data-action="simToEnd" data-autofocus>See Who Wins</button>
        <button class="btn wide" data-nav data-key="finish" data-action="finishSeason">Save &amp; Finish Now</button>
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
          <button class="btn" data-nav data-key="quick" data-action="quickMatch">Quick Sim</button>
          <button class="btn" data-nav data-key="simend" data-action="simToEnd">Sim To End</button>
        </div>
        <p class="muted center small-note">Play Match runs live at ${state.speed} speed (about ${Math.round((SPEEDS[state.speed] * 90) / 1000)}s).</p>
      </section>`;
    }

    return `<div class="page">
      ${head}
      <div class="season-grid">
        <div>${main}${lastResultsHTML()}${formHTML()}</div>
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

  SCREENS.squads = () => {
    const hist = loadHistory();
    return `<div class="page">
      <h1 class="page-title">My Squads</h1>
      ${hist.length ? `<div class="hist-list">${hist.map((h, i) => `<div class="hist ${h.champion ? 'champ' : ''}" data-nav tabindex="0" data-key="h-${i}" ${i === 0 ? 'data-autofocus' : ''}>
          <div class="hist-badge">${h.champion ? '&#127942;' : esc(h.compShort || '')}</div>
          <div class="hist-main"><b>${esc(h.name)}</b><span class="muted">${esc(h.compName || '')} ${esc(h.eraLabel || '')} &middot; ${esc(h.formation)} &middot; ${esc(h.date)} &middot; ${h.rerollsUsed} reroll${h.rerollsUsed === 1 ? '' : 's'} used</span>
            <span class="hist-stars">${(h.stars || []).map((p) => esc(p)).join(' &middot; ')}</span></div>
          <div class="hist-stat"><small>OVR</small><b>${h.rating}</b></div>
          <div class="hist-result">${esc(h.result)}</div>
        </div>`).join('')}</div>
        <div class="action-row"><button class="btn ${state.confirmClear ? 'btn-danger' : ''}" data-nav data-key="clear" data-action="clearHistory">${state.confirmClear ? 'Tap Again To Clear Everything' : 'Clear History'}</button></div>`
        : `<section class="panel empty-state"><p class="lead">No seasons yet. Finish one and it shows up here.</p>
          <button class="btn btn-primary" data-nav data-key="go-draft" data-action="go" data-arg="setup" data-autofocus>Start A Draft</button></section>`}
    </div>`;
  };

  SCREENS.teams = () => {
    const d = state.db;
    const db = DB[d.era];
    if (d.view) {
      const t = db.teams[d.view];
      return `<div class="page">
        <div class="team-head">${shirt(t.kit, 'huge')}<div><h1 class="page-title">${esc(t.name)}</h1><div class="muted">${db.label} &middot; ${t.type === 'nation' ? flag(t.code) + ' ' : ''}${esc(t.league)} &middot; ${t.strength} avg top XI</div></div></div>
        <div class="card-grid">${t.players.slice().sort((a, b) => b.ovr - a.ovr).map((p, i) => `<div class="card-cell" data-nav tabindex="0" data-key="c-${i}" ${i === 0 ? 'data-autofocus' : ''}>${card(p)}</div>`).join('')}</div>
      </div>`;
    }
    const list = db.comps[d.comp].slice().sort((a, b) => b.strength - a.strength);
    return `<div class="page">
      <h1 class="page-title">Database</h1>
      <div class="chip-row small">
        ${chip('dbEra', 'now', d.era === 'now', '2025/26', '', 'dbe-now')}
        ${chip('dbEra', 'retro', d.era === 'retro', 'Retro 14/15', '', 'dbe-retro')}
      </div>
      <div class="chip-row small">
        ${['pl', 'ucl', 'wc'].map((c) => chip('dbComp', c, d.comp === c, COMPS[c].name, '', 'dbc-' + c)).join('')}
      </div>
      <div class="team-grid">${list.map((t) => `<button class="team-tile" data-nav data-key="team-${t.id}" data-action="viewTeam" data-arg="${t.id}">
        ${shirt(t.kit, 'big')}<b>${esc(t.name)}</b><small>${t.type === 'nation' ? flag(t.code) + ' ' : ''}${esc(t.league)}</small><span class="team-str">${Math.round(t.strength)}</span></button>`).join('')}</div>
    </div>`;
  };

  SCREENS.howto = () => `<div class="page">
    <h1 class="page-title">How To Play</h1>
    <div class="howto-grid">
      <section class="panel"><h2 class="panel-title">1 &middot; Pick a competition</h2><p>Premier League, Champions League or World Cup, in today's squads or Retro 2014/15. Then pick a formation.</p></section>
      <section class="panel"><h2 class="panel-title">2 &middot; Spin</h2><p>The wheel lands on a random team from that competition. You draft one of their players.</p></section>
      <section class="panel"><h2 class="panel-title">3 &middot; Pick the position</h2><p>Choose a player, then tap where they play on the pitch. Natural spot: full rating. Similar spot: -3. Wrong spot: -10.</p></section>
      <section class="panel"><h2 class="panel-title">4 &middot; Reroll (free)</h2><p>Don't like the team you landed on? You get <b class="accent">${REROLLS} rerolls</b> per draft. Free, always.</p></section>
      <section class="panel"><h2 class="panel-title">5 &middot; Play the season</h2><p>Your XI replaces the weakest team in the competition. Watch every match live, or sim ahead.</p></section>
      <section class="panel"><h2 class="panel-title">6 &middot; Formats</h2><p>Premier League: one round of fixtures. Champions League: the 8-game league phase (or 2014/15 groups), then knockouts. World Cup: groups, then knockouts.</p></section>
    </div>
    <section class="panel"><h2 class="panel-title">Controls</h2><p>Mouse or touch works everywhere. Keyboard: arrows move, Enter selects, Esc goes back, S spins, R rerolls, P pauses a match, Q / E switch tabs.</p></section>
  </div>`;

  // ---------- draft actions ----------
  function spin(isReroll = false) {
    if (!draft || draft.phase === 'spinning' || draft.phase === 'done') return;
    if (draft.phase === 'choose' && !isReroll) return;
    const all = DB[draft.era].comps[draft.comp];
    const pool = all.filter((t) => t.players.some((p) => !draft.used.has(p.name)));
    let options = pool.filter((t) => t.id !== draft.lastTeamId);
    if (!options.length) options = pool;
    const target = rand(options);

    const TARGET_INDEX = 26;
    draft.reelItems = Array.from({ length: TARGET_INDEX + 4 }, (_, i) => (i === TARGET_INDEX ? target : rand(all)));
    draft.phase = 'spinning';
    draft.landed = null;
    draft.selected = null;
    render();

    const reel = $('#reel');
    const strip = $('#reel-strip');
    if (!reel || !strip) { land(target); return; }
    if (window.innerWidth <= 1000) reel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const item = strip.children[0].getBoundingClientRect().width;
    const jitter = (Math.random() - 0.5) * item * 0.6;
    const offset = -(TARGET_INDEX * item) + reel.clientWidth / 2 - item / 2 + jitter;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      strip.style.transition = 'transform 2.4s cubic-bezier(.12,.75,.16,1)';
      strip.style.transform = `translateX(${offset}px)`;
    }));
    setTimeout(() => land(target), 2550);
  }

  function land(team) {
    if (!draft || draft.phase !== 'spinning') return;
    draft.landed = team;
    draft.lastTeamId = team.id;
    draft.phase = 'choose';
    if (state.screen !== 'draft') return;
    draft.justLanded = true;
    render(true);
    draft.justLanded = false;
    if (window.innerWidth <= 1000) $('.landed').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function reroll() {
    if (!draft || draft.phase !== 'choose') return;
    if (draft.rerolls <= 0) { toast('No rerolls left. Pick a player.'); return; }
    draft.rerolls--;
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

  function finishSeason() {
    if (!season) return;
    if (live) { clearTimeout(live.timer); live = null; }
    const champion = season.done && season.champion === 0;
    let result;
    if (season.fmt === 'league' && season.done) result = `${champion ? 'Champions! ' : ''}Finished ${ordinal(season.position)} with ${season.table[0].pts} pts`;
    else if (champion) {
      const fin = season.log[season.log.length - 1];
      result = `Won the Final ${fin.gf}-${fin.ga}${fin.pens ? ` (${fin.pens} pens)` : ''} vs ${fin.opp}`;
    } else result = season.exit || `Left during the ${stageLabel()}`;
    const st = squadStats(draft.slots);
    const entry = {
      name: draft.name, formation: draft.formation, rating: st.rating, champion, result,
      compName: COMPS[season.comp].name, compShort: COMPS[season.comp].short, eraLabel: DB[season.era].label,
      rerollsUsed: REROLLS - draft.rerolls, date: new Date().toLocaleDateString(),
      stars: draft.slots.map((s) => s.player).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => shortName(p.name)),
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
    quickMatch: () => { startMatchday(false); render(true); },
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
      if (live && !live.over) {
        $('#match-actions').innerHTML = liveActions();
        if (!live.paused) scheduleTick();
      }
    },
    finishSeason,
    dbEra: (e) => { state.db.era = e; state.db.view = null; render(); },
    dbComp: (c) => { state.db.comp = c; render(); },
    viewTeam: (id) => { state.db.view = id; render(true); },
    // tap twice to confirm (pop-up dialogs are not available everywhere)
    clearHistory: () => {
      if (state.confirmClear) { saveHistory([]); state.confirmClear = false; } else state.confirmClear = true;
      render();
    },
  };

  document.addEventListener('click', (e) => {
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
    if (draft && draft.phase === 'spinning') return;
    if (live && live.over) live = null;
    if (tab === 'teams') state.db.view = null;
    go(tab);
  }

  // ---------- keyboard / spatial nav ----------
  function moveFocus(dir) {
    const els = [...screenEl.querySelectorAll('[data-nav]')].filter((e) => !e.disabled && e.tabIndex !== -1 && e.offsetParent !== null);
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
  });

  render(true);
})();

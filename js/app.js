(() => {
  'use strict';

  const REROLLS = 5;
  const ROUNDS = ['Quarter-Final', 'Semi-Final', 'Final'];
  const STORAGE_KEY = 'draft15.history';

  const $ = (sel, root = document) => root.querySelector(sel);
  const screenEl = $('#screen');
  const hintsEl = $('#hints');

  // ---------- helpers ----------
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
    return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
  }

  const SHORT_NAMES = { 'Vinicius Jr': 'Vinicius Jr', 'Kim Min-jae': 'Kim', 'Marc-Andre ter Stegen': 'ter Stegen' };
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
    let defs = `<clipPath id="${id}c"><path d="${body}"/></clipPath>`;
    let fill = c1;
    let overlay = '';
    if (style === 'stripes') {
      defs += `<pattern id="${id}p" width="7" height="48" patternUnits="userSpaceOnUse"><rect width="7" height="48" fill="${c1}"/><rect width="3.5" height="48" fill="${c2}"/></pattern>`;
      fill = `url(#${id}p)`;
    } else if (style === 'checks') {
      defs += `<pattern id="${id}p" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${c1}"/><rect width="4" height="4" fill="${c2}"/><rect x="4" y="4" width="4" height="4" fill="${c2}"/></pattern>`;
      fill = `url(#${id}p)`;
    } else if (style === 'band') {
      overlay = `<rect x="20" y="0" width="8" height="48" fill="${c2}" clip-path="url(#${id}c)"/><rect x="19" y="0" width="1" height="48" fill="#fff" clip-path="url(#${id}c)"/><rect x="28" y="0" width="1" height="48" fill="#fff" clip-path="url(#${id}c)"/>`;
    } else if (style === 'sleeves') {
      overlay = `<path d="M4 11 L17 5 L14 17 L13 19.5 L8 22 Z M44 11 L31 5 L34 17 L35 19.5 L40 22 Z" fill="${c2}"/>`;
    }
    return `<svg class="shirt ${cls}" viewBox="0 0 48 48" aria-hidden="true"><defs>${defs}</defs>
      <path d="${body}" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>${overlay}
      <path d="M18 5.5 Q24 12 30 5.5" fill="none" stroke="${style === 'solid' || style === 'sleeves' ? c2 : '#fff'}" stroke-width="2"/>
      <path d="${body}" fill="url(#shade)" opacity=".35"/></svg>`;
  }
  // shared shading gradient
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs></svg>`);

  // ---------- data prep ----------
  const PLAYERS = {};
  TEAMS.forEach((t) => {
    t.players = t.players.split(';').map((s) => {
      const [name, pos, ovr, nat] = s.split(',');
      const p = { uid: t.id + ':' + name, name, pos, ovr: +ovr, nation: t.type === 'nation' ? t.code : nat, team: t };
      PLAYERS[p.uid] = p;
      return p;
    });
    const top = t.players.map((p) => p.ovr).sort((a, b) => b - a).slice(0, 11);
    t.strength = Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 10) / 10;
  });

  function poolTeams(mode) {
    if (mode === 'clubs') return TEAMS.filter((t) => t.type === 'club');
    if (mode === 'nations') return TEAMS.filter((t) => t.type === 'nation');
    return TEAMS;
  }

  // ---------- chemistry & rating ----------
  function fitOf(slotPos, playerPos) {
    const f = POSITION_FIT[slotPos];
    if (f.n.includes(playerPos)) return 'n';
    if (f.a.includes(playerPos)) return 'a';
    return 'x';
  }

  function effOvr(slot) {
    const fit = fitOf(slot.pos, slot.player.pos);
    return slot.player.ovr - (fit === 'a' ? 3 : fit === 'x' ? 10 : 0);
  }

  const steps = (n, th) => th.filter((x) => n >= x).length;

  function computeChem(slots) {
    const counts = {};
    const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
    const keysFor = (p) => (p.team.type === 'club'
      ? ['C:' + p.team.id, 'L:' + p.team.league, 'N:' + p.nation]
      : ['R:' + p.team.league, 'N:' + p.nation]);

    const elig = slots.filter((s) => s.player && fitOf(s.pos, s.player.pos) !== 'x');
    elig.forEach((s) => keysFor(s.player).forEach(bump));

    let total = 0;
    slots.forEach((s) => {
      s.chem = 0;
      if (!s.player || fitOf(s.pos, s.player.pos) === 'x') return;
      let pts = 0;
      keysFor(s.player).forEach((k) => {
        const th = k[0] === 'L' || k[0] === 'R' ? [3, 5, 8] : [2, 5, 8];
        pts += steps(counts[k], th);
      });
      s.chem = Math.min(3, pts);
      total += s.chem;
    });
    return total;
  }

  function squadStats(slots) {
    const filled = slots.filter((s) => s.player);
    const chem = computeChem(slots);
    const rating = filled.length ? Math.round(filled.reduce((a, s) => a + effOvr(s), 0) / filled.length) : 0;
    const strength = rating + (chem / 33) * 4;
    const stars = clamp(Math.round(((strength - 72) / 3.6) * 2) / 2, 0.5, 5);
    return { chem, rating, strength, stars };
  }

  function starsHTML(n) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span class="star ${n >= i ? 'on' : n >= i - 0.5 ? 'half' : ''}">&#9733;</span>`;
    return `<span class="stars">${h}</span>`;
  }

  // ---------- storage ----------
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* storage unavailable */ }
  }

  // ---------- state ----------
  const state = { screen: 'home', setup: { mode: 'mixed', formation: '4-3-3' }, teamFilter: 'all', viewTeam: null };
  let draft = null;
  let squadSel = null;
  let tour = null;
  let match = null;

  function newDraft(formation, mode) {
    draft = {
      formation, mode,
      slots: FORMATIONS[formation].map(([pos, x, y]) => ({ pos, x, y, player: null, chem: 0 })),
      rerolls: REROLLS, active: 0, landed: null, phase: 'idle', used: new Set(), lastTeamId: null,
      name: 'Draft XI',
    };
    squadSel = null;
    tour = null;
    go('draft');
  }

  // ---------- navigation ----------
  const TAB_FOR = { home: 'home', setup: 'setup', draft: 'setup', squad: 'setup', match: 'setup', squads: 'squads', teams: 'teams', howto: 'howto' };
  const TAB_ORDER = ['home', 'setup', 'squads', 'teams', 'howto'];

  function go(screen) {
    if (screen === 'setup' && draft && state.screen !== 'draft') {
      // the Play tab resumes whatever is in progress
      if (match || tour) screen = 'match';
      else if (draft.phase === 'done') screen = 'squad';
      else if (draft.slots.some((s) => s.player) || draft.phase !== 'idle') screen = 'draft';
    }
    state.screen = screen;
    render(true);
  }

  function back() {
    const map = { setup: 'home', draft: 'setup', squad: 'draft', squads: 'home', teams: 'home', howto: 'home' };
    if (state.screen === 'teams' && state.viewTeam) { state.viewTeam = null; render(); return; }
    if (state.screen === 'draft' && draft && draft.phase === 'spinning') return;
    if (state.screen === 'match') return;
    if (state.screen === 'setup' || state.screen === 'draft') { state.screen = map[state.screen]; render(true); return; }
    if (map[state.screen]) { state.screen = map[state.screen]; render(true); }
  }

  // ---------- rendering ----------
  let lastFocusKey = null;

  function render(resetFocus = false) {
    const active = document.activeElement;
    lastFocusKey = !resetFocus && active && active.dataset ? active.dataset.key : null;

    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === TAB_FOR[state.screen]));
    const hist = loadHistory();
    const titles = hist.filter((h) => h.champion).length;
    $('#profile-sub').textContent = `${titles} Title${titles === 1 ? '' : 's'} · ${hist.length} Draft${hist.length === 1 ? '' : 's'}`;

    const fn = SCREENS[state.screen] || SCREENS.home;
    screenEl.className = 'screen screen-' + state.screen;
    screenEl.innerHTML = fn();
    hintsEl.innerHTML = hints();
    if (resetFocus) window.scrollTo(0, 0);
    restoreFocus();
  }

  function restoreFocus() {
    let el = lastFocusKey ? screenEl.querySelector(`[data-key="${CSS.escape(lastFocusKey)}"]`) : null;
    if (!el || el.disabled) el = screenEl.querySelector('[data-autofocus]:not([disabled])');
    if (el) el.focus({ preventScroll: true });
  }

  function hint(key, label, action, cls = '') {
    return `<button class="hint ${cls}" ${action ? `data-action="${action}"` : 'disabled'}><span class="btn-glyph">${key}</span>${label}</button>`;
  }

  function hints() {
    const s = state.screen;
    const out = [hint('A', 'Select', '', 'a')];
    if (s !== 'home' && s !== 'match') out.push(hint('B', 'Back', 'back', 'b'));
    if (s === 'draft' && draft) {
      if (draft.phase === 'idle') out.push(hint('S', 'Spin', 'spin', 'y'));
      if (draft.phase === 'choose') out.push(hint('R', `Reroll (${draft.rerolls})`, draft.rerolls ? 'reroll' : '', 'x'));
    }
    out.push(`<span class="hint-spacer"></span><span class="hint-keys">Arrows navigate &middot; Q / E switch tabs</span>`);
    return out.join('');
  }

  // ----- player card -----
  function card(p, opts = {}) {
    const { ovr = p.ovr, pos = p.pos, size = '', chem = null, extra = '' } = opts;
    const chemDots = chem === null ? '' : `<div class="chem-dots">${[1, 2, 3].map((i) => `<i class="${chem >= i ? 'on' : ''}"></i>`).join('')}</div>`;
    return `<div class="card tier-${tier(p.ovr)} ${size} ${extra}">
      <div class="card-shine"></div>
      <div class="card-top"><div class="card-ovr">${ovr}</div><div class="card-pos">${pos}</div></div>
      <div class="card-kit">${shirt(p.team.kit)}</div>
      <div class="card-name">${esc(shortName(p.name))}</div>
      <div class="card-team"><span class="card-flag">${flag(p.nation)}</span> ${esc(p.team.short)}</div>
      ${chemDots}
    </div>`;
  }

  // ----- pitch -----
  function pitch(slots, { mode, selected = null, active = null }) {
    const links = linkLines(slots);
    return `<div class="pitch">
      <div class="pitch-lines"><div class="pl-half"></div><div class="pl-circle"></div><div class="pl-box top"></div><div class="pl-box bottom"></div><div class="pl-six top"></div><div class="pl-six bottom"></div></div>
      <svg class="links" viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>
      ${slots.map((s, i) => {
        const isActive = mode === 'draft' && i === active;
        const isSel = selected === i;
        const disabled = mode === 'draft' ? (s.player || draft.phase === 'spinning') : false;
        const action = mode === 'draft' ? 'selectSlot' : 'swapSlot';
        let inner;
        if (s.player) {
          const fit = fitOf(s.pos, s.player.pos);
          inner = card(s.player, { ovr: effOvr(s), pos: s.pos, size: 'sm', chem: s.chem, extra: fit === 'x' ? 'oop' : fit === 'a' ? 'alt' : '' });
        } else {
          inner = `<div class="slot-empty"><span>${s.pos}</span></div>`;
        }
        return `<button class="slot ${isActive ? 'active' : ''} ${isSel ? 'selected' : ''} ${s.player ? 'filled' : ''}" style="left:${s.x}%;top:${s.y}%"
          data-nav data-key="slot-${i}" data-action="${action}" data-arg="${i}" ${disabled ? 'tabindex="-1"' : ''} aria-label="${s.pos}${s.player ? ': ' + esc(s.player.name) : ' empty'}">${inner}</button>`;
      }).join('')}
    </div>`;
  }

  // chemistry link lines between nearby filled slots
  function linkLines(slots) {
    let out = '';
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j];
        const d = Math.hypot(a.x - b.x, (a.y - b.y) * 1.3);
        if (d > 34) continue;
        let cls = 'none';
        if (a.player && b.player) {
          const pa = a.player, pb = b.player;
          let score = 0;
          if (pa.team.id === pb.team.id) score += 2;
          else if (pa.team.league === pb.team.league) score += 1;
          if (pa.nation === pb.nation) score += 1;
          cls = score >= 2 ? 'strong' : score === 1 ? 'weak' : 'bad';
        }
        out += `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
      }
    }
    return out;
  }

  // ---------- screens ----------
  const SCREENS = {};

  SCREENS.home = () => {
    const hist = loadHistory();
    const best = hist.reduce((m, h) => Math.max(m, h.rating), 0);
    const inProgress = draft && (draft.slots.some((s) => s.player) || tour);
    return `<div class="page">
      <h1 class="page-title">Home</h1>
      <div class="tiles">
        <button class="tile tile-hero" data-nav data-key="t-draft" data-action="go" data-arg="setup" data-autofocus>
          <div class="tile-art art-pitch">${miniFormation('4-3-3')}</div>
          <div class="tile-badge">5 free rerolls</div>
          <div class="tile-label"><small>${inProgress ? 'Continue' : 'Play'}</small>${inProgress ? 'Resume Draft' : 'Draft Mode'}</div>
        </button>
        <button class="tile" data-nav data-key="t-quick" data-action="quickDraft">
          <div class="tile-art art-dice">${shirt(rand(TEAMS).kit, 'big')}${shirt(rand(TEAMS).kit, 'big')}</div>
          <div class="tile-label"><small>Random formation</small>Quick Draft</div>
        </button>
        <button class="tile" data-nav data-key="t-squads" data-action="go" data-arg="squads">
          <div class="tile-art art-stat"><b>${hist.length}</b><span>Squads saved</span>${best ? `<span>Best ${best} OVR</span>` : ''}</div>
          <div class="tile-label"><small>History</small>My Squads</div>
        </button>
        <button class="tile" data-nav data-key="t-teams" data-action="go" data-arg="teams">
          <div class="tile-art art-kits">${TEAMS.slice(0, 6).map((t) => shirt(t.kit)).join('')}</div>
          <div class="tile-label"><small>${TEAMS.length} teams</small>Squad Database</div>
        </button>
        <button class="tile" data-nav data-key="t-howto" data-action="go" data-arg="howto">
          <div class="tile-art art-stat"><b>?</b><span>Rules, chemistry</span><span>and rerolls</span></div>
          <div class="tile-label"><small>Learn</small>How To Play</div>
        </button>
      </div>
    </div>`;
  };

  function miniFormation(f) {
    return `<div class="mini-form">${FORMATIONS[f].map(([, x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('')}</div>`;
  }

  SCREENS.setup = () => {
    const s = state.setup;
    const modes = [
      ['mixed', 'Mixed', 'Clubs and nations'],
      ['clubs', 'Clubs', `${TEAMS.filter((t) => t.type === 'club').length} top clubs`],
      ['nations', 'Nations', `${TEAMS.filter((t) => t.type === 'nation').length} national teams`],
    ];
    return `<div class="page">
      <h1 class="page-title">Draft Setup</h1>
      <section class="panel">
        <h2 class="panel-title">Team Pool</h2>
        <div class="chip-row">
          ${modes.map(([id, label, sub]) => `<button class="chip ${s.mode === id ? 'on' : ''}" data-nav data-key="mode-${id}" data-action="setMode" data-arg="${id}" ${s.mode === id ? 'data-autofocus' : ''}><b>${label}</b><small>${sub}</small></button>`).join('')}
        </div>
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
        <span class="muted">You get <b class="accent">${REROLLS} rerolls</b> per draft. No coins. No packs.</span>
      </div>
    </div>`;
  };

  SCREENS.draft = () => {
    if (!draft) return SCREENS.setup();
    const st = squadStats(draft.slots);
    const filled = draft.slots.filter((s) => s.player).length;
    const slot = draft.slots[draft.active];
    return `<div class="page draft-layout">
      <div class="draft-left">
        <div class="squad-head">
          <div><h1 class="page-title">Draft &middot; ${draft.formation}</h1><div class="muted">${filled}/11 picked &middot; ${esc(modeLabel(draft.mode))}</div></div>
          <div class="stat-boxes">
            <div class="stat-box"><small>Rating</small><b>${st.rating || '--'}</b></div>
            <div class="stat-box"><small>Chemistry</small><b>${st.chem}<i>/33</i></b></div>
          </div>
        </div>
        ${pitch(draft.slots, { mode: 'draft', active: draft.active })}
      </div>
      <div class="draft-right">${draftPanel(slot)}</div>
    </div>`;
  };

  function modeLabel(m) { return { mixed: 'Clubs + Nations', clubs: 'Clubs only', nations: 'Nations only' }[m]; }

  function rerollPips() {
    return `<div class="reroll-pips" title="Rerolls left">${Array.from({ length: REROLLS }, (_, i) => `<i class="${i < draft.rerolls ? 'on' : ''}"></i>`).join('')}<span>${draft.rerolls} reroll${draft.rerolls === 1 ? '' : 's'} left</span></div>`;
  }

  function draftPanel(slot) {
    if (draft.phase === 'done') {
      return `<section class="panel panel-tall">
        <h2 class="panel-title">Squad Complete</h2>
        <p class="lead">All 11 spots are filled. Check your chemistry, swap players around, then take your XI into a knockout tournament.</p>
        ${rerollPips()}
        <button class="btn btn-primary wide" data-nav data-key="confirm" data-action="confirmSquad" data-autofocus>Confirm Squad</button>
      </section>`;
    }
    const head = `<div class="panel-title-row"><h2 class="panel-title">Team Selection</h2>${rerollPips()}</div>
      <div class="slot-info">Filling: <b class="pos-tag">${slot.pos}</b><span class="muted">Natural: ${POSITION_FIT[slot.pos].n.join(', ')}${POSITION_FIT[slot.pos].a.length ? ` &middot; OK: ${POSITION_FIT[slot.pos].a.join(', ')}` : ''}</span></div>`;

    if (draft.phase === 'idle') {
      return `<section class="panel panel-tall">${head}
        <div class="reel reel-idle"><div class="reel-marker"></div><div class="reel-strip">${shuffle(poolTeams(draft.mode)).slice(0, 7).map(reelItem).join('')}</div></div>
        <button class="btn btn-primary wide" data-nav data-key="spin" data-action="spin" data-autofocus>Spin For A Team</button>
        <p class="muted center">Tap an empty spot on the pitch to change which position you fill.</p>
      </section>`;
    }
    if (draft.phase === 'spinning') {
      return `<section class="panel panel-tall">${head}
        <div class="reel" id="reel"><div class="reel-marker"></div><div class="reel-strip" id="reel-strip">${draft.reelItems.map(reelItem).join('')}</div></div>
        <button class="btn btn-primary wide" disabled>Spinning...</button>
      </section>`;
    }
    // choose
    const t = draft.landed;
    const list = t.players
      .map((p) => ({ p, fit: fitOf(slot.pos, p.pos), taken: draft.used.has(p.name) }))
      .sort((a, b) => (a.taken - b.taken) || ('nax'.indexOf(a.fit) - 'nax'.indexOf(b.fit)) || (b.p.ovr - a.p.ovr));
    const firstPick = list.find((r) => !r.taken);
    return `<section class="panel panel-tall">${head}
      <div class="landed">
        <div class="landed-kit">${shirt(t.kit, 'big')}</div>
        <div class="landed-info"><small>You landed on</small><b>${esc(t.name)}</b><span class="muted">${t.type === 'nation' ? flag(t.code) + ' National team' : esc(t.league)} &middot; ${t.strength} avg</span></div>
        <button class="btn btn-reroll" data-nav data-key="reroll" data-action="reroll" ${draft.rerolls ? '' : 'disabled'}><span class="btn-glyph x">R</span>Reroll<small>${draft.rerolls} left</small></button>
      </div>
      <div class="player-list">
        ${list.map(({ p, fit, taken }) => {
          const eff = p.ovr - (fit === 'a' ? 3 : fit === 'x' ? 10 : 0);
          const badge = taken ? '<span class="fit taken">In squad</span>'
            : fit === 'n' ? '<span class="fit n">Natural</span>'
            : fit === 'a' ? `<span class="fit a">${eff} OVR here</span>`
            : `<span class="fit x">${eff} out of pos</span>`;
          return `<button class="prow ${taken ? 'taken' : ''}" data-nav data-key="p-${esc(p.uid)}" data-action="pick" data-arg="${esc(p.uid)}" ${taken ? 'disabled' : ''} ${p === firstPick?.p ? 'data-autofocus' : ''}>
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

  SCREENS.squad = () => {
    if (!draft) return SCREENS.setup();
    const st = squadStats(draft.slots);
    const oop = draft.slots.filter((s) => s.player && fitOf(s.pos, s.player.pos) === 'x').length;
    return `<div class="page draft-layout">
      <div class="draft-left">
        <div class="squad-head">
          <div><h1 class="page-title">Squad &middot; ${draft.formation}</h1><div class="muted">Select two players to swap them</div></div>
        </div>
        ${pitch(draft.slots, { mode: 'squad', selected: squadSel })}
      </div>
      <div class="draft-right">
        <section class="panel panel-tall">
          <h2 class="panel-title">Squad Overview</h2>
          <label class="field"><small>Squad name</small><input id="squad-name" maxlength="24" value="${esc(draft.name)}" data-nav data-key="name"></label>
          <div class="overview">
            <div class="ov-big"><small>Rating</small><b>${st.rating}</b></div>
            <div class="ov-big"><small>Chemistry</small><b>${st.chem}<i>/33</i></b></div>
            <div class="ov-big"><small>Team</small>${starsHTML(st.stars)}</div>
          </div>
          <div class="chem-bar"><i style="width:${(st.chem / 33) * 100}%"></i></div>
          ${oop ? `<p class="warn">${oop} player${oop > 1 ? 's are' : ' is'} out of position (0 chemistry, -10 OVR). Try swapping.</p>` : ''}
          <ul class="tips">
            <li><b class="c-strong">Green</b> links: same club, or same league and nation.</li>
            <li><b class="c-weak">Amber</b> links: same league or nation.</li>
            <li>Each player earns up to 3 chemistry from club, league and nation counts.</li>
          </ul>
          <button class="btn btn-primary wide" data-nav data-key="tour" data-action="startTournament" data-autofocus>Start Tournament</button>
          <button class="btn wide" data-nav data-key="newdraft" data-action="go" data-arg="setup-new">New Draft</button>
        </section>
      </div>
    </div>`;
  };

  SCREENS.match = () => {
    if (!tour) return SCREENS.home();
    const opp = tour.opps[tour.round];
    const st = squadStats(draft.slots);
    const bracket = `<div class="bracket">${ROUNDS.map((r, i) => {
      const res = tour.results[i];
      const cls = res ? (res.won ? 'won' : 'lost') : i === tour.round ? 'current' : '';
      return `<div class="br ${cls}"><small>${r}</small><b>${esc(tour.opps[i].short)}</b>${res ? `<span>${res.score}</span>` : ''}</div>`;
    }).join('')}</div>`;

    if (!match) {
      return `<div class="page">
        <h1 class="page-title">${ROUNDS[tour.round]}</h1>
        ${bracket}
        <div class="versus">
          <div class="vs-side">${shirt(['#0b1e3a', '#2ad2ff', 'band'], 'huge')}<b>${esc(draft.name)}</b><span>${st.rating} OVR &middot; ${st.chem} CHEM</span>${starsHTML(st.stars)}</div>
          <div class="vs-mid">VS</div>
          <div class="vs-side">${shirt(opp.kit, 'huge')}<b>${esc(opp.name)}</b><span>${Math.round(opp.strength)} OVR</span>${starsHTML(clamp(Math.round(((opp.strength + 2 - 72) / 3.6) * 2) / 2, 0.5, 5))}</div>
        </div>
        <div class="action-row center">
          <button class="btn btn-primary" data-nav data-key="kickoff" data-action="kickoff" data-autofocus>Kick Off</button>
          <button class="btn" data-nav data-key="abandon" data-action="abandon">Back To Squad</button>
        </div>
      </div>`;
    }
    return `<div class="page">
      <div class="scorebug">
        <span class="sb-team">${esc(draft.name.slice(0, 3).toUpperCase())}</span>
        <span class="sb-score" id="sb-score">${match.su} - ${match.so}</span>
        <span class="sb-team">${esc(opp.short)}</span>
        <span class="sb-clock" id="sb-clock">${match.min}'</span>
      </div>
      <h1 class="page-title center">${ROUNDS[tour.round]}</h1>
      <div class="match-grid">
        <section class="panel">
          <h2 class="panel-title">Match Feed</h2>
          <ul class="feed" id="feed">${match.feed.map(feedLine).join('')}</ul>
        </section>
        <section class="panel">
          <h2 class="panel-title">Match Stats</h2>
          <div id="mstats">${matchStats()}</div>
          <div id="match-actions" class="match-actions">${matchActions()}</div>
        </section>
      </div>
      <div class="goal-flash" id="goal-flash">GOAL!</div>
    </div>`;
  };

  function feedLine(f) {
    return `<li class="fl ${f.cls || ''}"><span class="fl-min">${f.min}</span><span>${esc(f.text)}</span></li>`;
  }

  function matchStats() {
    const m = match;
    const row = (label, a, b) => {
      const tot = a + b || 1;
      return `<div class="ms-row"><b>${a}</b><div class="ms-bar"><i style="width:${(a / tot) * 100}%"></i></div><b>${b}</b><small>${label}</small></div>`;
    };
    return row('Possession %', m.poss, 100 - m.poss) + row('Shots', m.shots.u, m.shots.o) + row('On target', m.sot.u, m.sot.o);
  }

  function matchActions() {
    if (!match.over) return `<button class="btn wide" data-nav data-key="skip" data-action="skipMatch" data-autofocus>Skip To Full Time</button>`;
    const won = match.won;
    const last = tour.round === ROUNDS.length - 1;
    let msg, btn;
    if (won && last) { msg = `<div class="result win">Champions!</div>`; btn = `<button class="btn btn-primary wide" data-nav data-key="finish" data-action="finishTour" data-autofocus>Lift The Trophy</button>`; }
    else if (won) { msg = `<div class="result win">You Win</div>`; btn = `<button class="btn btn-primary wide" data-nav data-key="next" data-action="nextRound" data-autofocus>Next: ${ROUNDS[tour.round + 1]}</button>`; }
    else { msg = `<div class="result lose">Eliminated</div>`; btn = `<button class="btn btn-primary wide" data-nav data-key="finish" data-action="finishTour" data-autofocus>Save &amp; Exit</button>`; }
    return msg + (match.pens ? `<div class="muted center">Penalties ${match.pens.su} - ${match.pens.so}</div>` : '') + btn;
  }

  SCREENS.trophy = () => {
    const h = state.lastResult;
    return `<div class="page center-page">
      <div class="trophy ${h.champion ? '' : 'dim'}">&#127942;</div>
      <h1 class="page-title center">${h.champion ? 'Champions' : 'Tournament Over'}</h1>
      <p class="lead center">${esc(h.name)} &middot; ${h.rating} OVR &middot; ${h.chem} chemistry<br>${esc(h.result)}</p>
      <div class="action-row center">
        <button class="btn btn-primary" data-nav data-key="again" data-action="go" data-arg="setup-new" data-autofocus>Draft Again</button>
        <button class="btn" data-nav data-key="mysquads" data-action="go" data-arg="squads">My Squads</button>
      </div>
    </div>`;
  };

  SCREENS.squads = () => {
    const hist = loadHistory();
    return `<div class="page">
      <h1 class="page-title">My Squads</h1>
      ${hist.length ? `<div class="hist-list">${hist.map((h, i) => `<div class="hist ${h.champion ? 'champ' : ''}" data-nav tabindex="0" data-key="h-${i}" ${i === 0 ? 'data-autofocus' : ''}>
          <div class="hist-badge">${h.champion ? '&#127942;' : esc(h.formation)}</div>
          <div class="hist-main"><b>${esc(h.name)}</b><span class="muted">${esc(h.formation)} &middot; ${esc(h.date)} &middot; ${h.rerollsUsed} reroll${h.rerollsUsed === 1 ? '' : 's'} used</span>
            <span class="hist-stars">${h.stars.map((p) => esc(p)).join(' &middot; ')}</span></div>
          <div class="hist-stat"><small>OVR</small><b>${h.rating}</b></div>
          <div class="hist-stat"><small>CHEM</small><b>${h.chem}</b></div>
          <div class="hist-result">${esc(h.result)}</div>
        </div>`).join('')}</div>
        <div class="action-row"><button class="btn" data-nav data-key="clear" data-action="clearHistory">Clear History</button></div>`
        : `<section class="panel empty-state"><p class="lead">No squads yet. Finish a tournament and it shows up here.</p>
          <button class="btn btn-primary" data-nav data-key="go-draft" data-action="go" data-arg="setup" data-autofocus>Start A Draft</button></section>`}
    </div>`;
  };

  SCREENS.teams = () => {
    if (state.viewTeam) {
      const t = TEAMS.find((x) => x.id === state.viewTeam);
      return `<div class="page">
        <div class="team-head">${shirt(t.kit, 'huge')}<div><h1 class="page-title">${esc(t.name)}</h1><div class="muted">${t.type === 'nation' ? flag(t.code) + ' National team' : esc(t.league)} &middot; ${t.strength} avg top XI</div></div></div>
        <div class="card-grid">${t.players.slice().sort((a, b) => b.ovr - a.ovr).map((p, i) => `<div class="card-cell" data-nav tabindex="0" data-key="c-${i}" ${i === 0 ? 'data-autofocus' : ''}>${card(p)}</div>`).join('')}</div>
      </div>`;
    }
    const f = state.teamFilter;
    const list = f === 'all' ? TEAMS : TEAMS.filter((t) => t.type === f);
    return `<div class="page">
      <h1 class="page-title">Squad Database</h1>
      <div class="chip-row small">
        ${[['all', 'All'], ['club', 'Clubs'], ['nation', 'Nations']].map(([id, l]) => `<button class="chip ${f === id ? 'on' : ''}" data-nav data-key="tf-${id}" data-action="setTeamFilter" data-arg="${id}" ${f === id ? 'data-autofocus' : ''}><b>${l}</b></button>`).join('')}
      </div>
      <div class="team-grid">${list.map((t) => `<button class="team-tile" data-nav data-key="team-${t.id}" data-action="viewTeam" data-arg="${t.id}">
        ${shirt(t.kit, 'big')}<b>${esc(t.name)}</b><small>${t.type === 'nation' ? flag(t.code) + ' ' + esc(t.league) : esc(t.league)}</small><span class="team-str">${Math.round(t.strength)}</span></button>`).join('')}</div>
    </div>`;
  };

  SCREENS.howto = () => `<div class="page">
    <h1 class="page-title">How To Play</h1>
    <div class="howto-grid">
      <section class="panel"><h2 class="panel-title">1 &middot; Pick a setup</h2><p>Choose a team pool (clubs, nations or both) and a formation.</p></section>
      <section class="panel"><h2 class="panel-title">2 &middot; Spin</h2><p>Each empty spot gets a spin. The wheel lands on a random team and you pick one of their players for that spot.</p></section>
      <section class="panel"><h2 class="panel-title">3 &middot; Reroll (free)</h2><p>Don't like the team you landed on? You get <b class="accent">${REROLLS} rerolls</b> per draft to spin again. They're free, always.</p></section>
      <section class="panel"><h2 class="panel-title">4 &middot; Positions</h2><p>Natural position: full rating. Similar position: -3 OVR. Out of position: -10 OVR and zero chemistry.</p></section>
      <section class="panel"><h2 class="panel-title">5 &middot; Chemistry</h2><p>Players earn chemistry (max 3 each, 33 total) by sharing a club, league or nation with teammates. National team players link by nation and confederation.</p></section>
      <section class="panel"><h2 class="panel-title">6 &middot; Tournament</h2><p>Take your XI through a Quarter-Final, Semi-Final and Final against real squads. Rating and chemistry both matter. Draws go to penalties.</p></section>
    </div>
    <section class="panel"><h2 class="panel-title">Controls</h2><p>Mouse or touch works everywhere. On keyboard: arrows move, Enter selects, Esc goes back, S spins, R rerolls, Q / E switch tabs.</p></section>
  </div>`;

  // ---------- draft actions ----------
  function selectSlot(i) {
    i = +i;
    if (!draft || draft.phase === 'spinning' || draft.slots[i].player) return;
    draft.active = i;
    render();
  }

  function spin(isReroll = false) {
    if (!draft || draft.phase === 'spinning' || draft.phase === 'done') return;
    if (draft.phase === 'choose' && !isReroll) return;
    const pool = poolTeams(draft.mode).filter((t) => t.players.some((p) => !draft.used.has(p.name)));
    let options = pool.filter((t) => t.id !== draft.lastTeamId);
    if (!options.length) options = pool;
    const target = rand(options);

    const all = poolTeams(draft.mode);
    const TARGET_INDEX = 26;
    draft.reelItems = Array.from({ length: TARGET_INDEX + 4 }, (_, i) => (i === TARGET_INDEX ? target : rand(all)));
    draft.phase = 'spinning';
    draft.landed = null;
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
    render(true);
    if (window.innerWidth <= 1000) $('.landed').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function reroll() {
    if (!draft || draft.phase !== 'choose') return;
    if (draft.rerolls <= 0) { toast('No rerolls left. Pick a player.'); return; }
    draft.rerolls--;
    spin(true);
  }

  function pick(uid) {
    if (!draft || draft.phase !== 'choose') return;
    const slot = draft.slots[draft.active];
    const p = PLAYERS[uid];
    if (!p || slot.player || draft.used.has(p.name)) return;
    slot.player = p;
    draft.used.add(p.name);
    draft.landed = null;
    const next = draft.slots.findIndex((s) => !s.player);
    draft.active = next === -1 ? 0 : next;
    draft.phase = next === -1 ? 'done' : 'idle';
    render(true);
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

  function readSquadName() {
    const input = $('#squad-name');
    if (input && draft) draft.name = input.value.trim() || 'Draft XI';
  }

  // ---------- tournament ----------
  function startTournament() {
    readSquadName();
    squadSel = null;
    const sorted = TEAMS.slice().sort((a, b) => a.strength - b.strength);
    const third = Math.floor(sorted.length / 3);
    const opps = [
      rand(sorted.slice(0, third)),
      rand(sorted.slice(third, third * 2)),
      rand(sorted.slice(third * 2)),
    ];
    tour = { opps, round: 0, results: [] };
    match = null;
    go('match');
  }

  function poisson(l) {
    const L = Math.exp(-l);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  const SCORE_WEIGHT = { ST: 6, LW: 4, RW: 4, CAM: 4, LM: 3, RM: 3, CM: 2, CDM: 1, LB: 0.6, RB: 0.6, LWB: 0.8, RWB: 0.8, CB: 0.6, GK: 0 };
  function weighted(list) {
    const tot = list.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * tot;
    for (const x of list) { r -= x.w; if (r <= 0) return x.name; }
    return list[0].name;
  }

  function kickoff() {
    const opp = tour.opps[tour.round];
    const st = squadStats(draft.slots);
    const d = st.strength - (opp.strength + 2);
    const lamU = clamp(1.4 * Math.exp(d / 9), 0.25, 4);
    const lamO = clamp(1.4 * Math.exp(-d / 9), 0.25, 4);
    const gu = poisson(lamU), go_ = poisson(lamO);

    const uPlayers = draft.slots.map((s) => ({ name: s.player.name, w: SCORE_WEIGHT[s.pos] }));
    const oPlayers = opp.players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11).map((p) => ({ name: p.name, w: SCORE_WEIGHT[p.pos] }));
    const uAll = uPlayers.map((p) => ({ ...p, w: 1 }));
    const oAll = oPlayers.map((p) => ({ ...p, w: 1 }));
    const minute = () => 1 + Math.floor(Math.random() * 90);

    const events = [];
    const addGoals = (n, side, pl) => {
      for (let i = 0; i < n; i++) {
        const scorer = weighted(pl);
        const assist = Math.random() < 0.7 ? weighted(pl.filter((p) => p.name !== scorer).map((p) => ({ ...p, w: p.w + 1 }))) : null;
        events.push({ min: minute(), side, type: 'goal', text: `GOAL! ${scorer} scores${assist ? `, assisted by ${assist}` : ''}.` });
      }
    };
    addGoals(gu, 'u', uPlayers);
    addGoals(go_, 'o', oPlayers);

    const flavour = [
      (n, t) => [`${n} fires just wide.`, 'chance'],
      (n, t) => [`Big save! The keeper denies ${n}.`, 'save'],
      (n, t) => [`${n} rattles the woodwork!`, 'chance'],
      (n, t) => [`Yellow card for ${n}.`, 'card'],
      (n, t) => [`Corner to ${t}.`, ''],
      (n, t) => [`${n} drives forward for ${t}.`, ''],
    ];
    const nf = 9 + Math.floor(Math.random() * 6);
    const uShare = clamp(0.5 + d / 30, 0.25, 0.75);
    for (let i = 0; i < nf; i++) {
      const side = Math.random() < uShare ? 'u' : 'o';
      const n = weighted(side === 'u' ? uAll : oAll);
      const [text, type] = rand(flavour)(n, side === 'u' ? draft.name : opp.name);
      events.push({ min: minute(), side, type, text });
    }
    events.sort((a, b) => a.min - b.min);

    const shotsU = gu + events.filter((e) => e.side === 'u' && (e.type === 'chance' || e.type === 'save')).length + Math.floor(Math.random() * 4);
    const shotsO = go_ + events.filter((e) => e.side === 'o' && (e.type === 'chance' || e.type === 'save')).length + Math.floor(Math.random() * 4);
    match = {
      events, i: 0, min: 0, su: 0, so: 0, over: false, won: false, pens: null, d,
      poss: Math.round(clamp(50 + d * 1.5 + (Math.random() - 0.5) * 8, 30, 70)),
      final: { shots: { u: shotsU, o: shotsO }, sot: { u: gu + events.filter((e) => e.side === 'u' && e.type === 'save').length, o: go_ + events.filter((e) => e.side === 'o' && e.type === 'save').length } },
      shots: { u: 0, o: 0 }, sot: { u: 0, o: 0 },
      feed: [{ min: "0'", text: `Kick off! ${draft.name} vs ${opp.name}.`, cls: 'sys' }],
    };
    render(true);
    match.shown = match.feed.length;
    match.timer = setInterval(tick, 75);
  }

  function tick() {
    if (!match || match.over) return;
    match.min++;
    let goal = false;
    while (match.i < match.events.length && match.events[match.i].min <= match.min) {
      const e = match.events[match.i++];
      if (e.type === 'goal') { e.side === 'u' ? match.su++ : match.so++; goal = e.side; }
      match.feed.unshift({ min: e.min + "'", text: e.text, cls: (e.type === 'goal' ? 'goal ' : '') + e.side });
    }
    if (match.min === 45) match.feed.unshift({ min: "45'", text: `Half time: ${match.su} - ${match.so}.`, cls: 'sys' });
    // stats creep up toward the final numbers
    const f = match.min / 90;
    ['u', 'o'].forEach((s) => {
      match.shots[s] = Math.round(match.final.shots[s] * f);
      match.sot[s] = Math.min(match.shots[s], Math.round(match.final.sot[s] * f));
    });
    if (match.min >= 90) endMatch();
    updateMatchDOM(goal);
  }

  function skipMatch() {
    if (!match || match.over) return;
    match.skipping = true;
    while (!match.over) tick();
  }

  function endMatch() {
    clearInterval(match.timer);
    match.over = true;
    match.feed.unshift({ min: "90'", text: `Full time: ${match.su} - ${match.so}.`, cls: 'sys' });
    let won = match.su > match.so;
    let score = `${match.su}-${match.so}`;
    if (match.su === match.so) {
      const pu = clamp(0.76 + match.d / 80, 0.6, 0.9);
      const po = clamp(0.76 - match.d / 80, 0.6, 0.9);
      match.pens = shootout(pu, po);
      won = match.pens.su > match.pens.so;
      match.feed.unshift({ min: 'PEN', text: `Penalties: ${match.pens.seq.map(([s, g]) => (s === 'u' ? 'You ' : 'Opp ') + (g ? 'scored' : 'missed')).join(', ')}.`, cls: 'sys' });
      match.feed.unshift({ min: 'PEN', text: `${won ? draft.name : tour.opps[tour.round].name} win ${Math.max(match.pens.su, match.pens.so)}-${Math.min(match.pens.su, match.pens.so)} on penalties!`, cls: 'goal ' + (won ? 'u' : 'o') });
      score += ` (${match.pens.su}-${match.pens.so}p)`;
    }
    match.won = won;
    tour.results[tour.round] = { won, score };
  }

  function shootout(pu, po) {
    const seq = [];
    let su = 0, so = 0, ku = 0, ko = 0;
    const decided = () => su > so + (5 - ko) || so > su + (5 - ku);
    while (ku < 5 || ko < 5) {
      const g = Math.random() < pu; ku++; su += g; seq.push(['u', g]); if (decided()) break;
      const h = Math.random() < po; ko++; so += h; seq.push(['o', h]); if (decided()) break;
    }
    while (su === so) {
      const g = Math.random() < pu; su += g; seq.push(['u', g]);
      const h = Math.random() < po; so += h; seq.push(['o', h]);
    }
    return { seq, su, so };
  }

  function updateMatchDOM(goal) {
    if (state.screen !== 'match') return;
    const score = $('#sb-score');
    if (!score) return;
    score.textContent = `${match.su} - ${match.so}`;
    $('#sb-clock').textContent = match.over ? 'FT' : match.min + "'";
    const fresh = match.feed.length - match.shown;
    if (fresh > 0) $('#feed').insertAdjacentHTML('afterbegin', match.feed.slice(0, fresh).map(feedLine).join(''));
    match.shown = match.feed.length;
    $('#mstats').innerHTML = matchStats();
    if (goal && !match.skipping) {
      const fl = $('#goal-flash');
      fl.classList.remove('show', 'opp');
      void fl.offsetWidth;
      fl.classList.add('show');
      if (goal === 'o') fl.classList.add('opp');
    }
    if (match.over) {
      $('#match-actions').innerHTML = matchActions();
      const btn = $('#match-actions [data-autofocus]');
      if (btn) btn.focus();
    }
  }

  function nextRound() {
    match = null;
    tour.round++;
    render(true);
  }

  function finishTour() {
    const champion = tour.results.length === ROUNDS.length && tour.results.every((r) => r.won);
    const lastIdx = tour.results.length - 1;
    const lastRes = tour.results[lastIdx];
    const result = champion ? `Won the Final ${lastRes.score} vs ${tour.opps[lastIdx].name}`
      : `Lost in the ${ROUNDS[lastIdx]} ${lastRes.score} vs ${tour.opps[lastIdx].name}`;
    const st = squadStats(draft.slots);
    const stars = draft.slots.map((s) => s.player).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => shortName(p.name));
    const entry = {
      name: draft.name, formation: draft.formation, rating: st.rating, chem: st.chem, champion, result,
      rerollsUsed: REROLLS - draft.rerolls, stars, date: new Date().toLocaleDateString(),
    };
    saveHistory([entry, ...loadHistory()]);
    state.lastResult = entry;
    match = null;
    tour = null;
    draft = null;
    state.screen = 'trophy';
    render(true);
  }

  function abandon() {
    match = null;
    tour = null;
    state.screen = 'squad';
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
    go: (arg) => {
      if (arg === 'setup-new') { draft = null; tour = null; match = null; state.screen = 'setup'; render(true); return; }
      go(arg);
    },
    back,
    setMode: (m) => { state.setup.mode = m; render(); },
    setFormation: (f) => { state.setup.formation = f; render(); },
    startDraft: () => newDraft(state.setup.formation, state.setup.mode),
    quickDraft: () => newDraft(rand(Object.keys(FORMATIONS)), 'mixed'),
    selectSlot, spin: () => spin(false), reroll, pick, swapSlot,
    confirmSquad: () => { state.screen = 'squad'; render(true); },
    startTournament, kickoff, skipMatch, nextRound, finishTour, abandon,
    setTeamFilter: (f) => { state.teamFilter = f; render(); },
    viewTeam: (id) => { state.viewTeam = id; render(true); },
    clearHistory: () => { if (confirm('Clear all saved squads?')) { saveHistory([]); render(true); } },
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
    if (e.target.id === 'squad-name' && draft) draft.name = e.target.value.trim() || 'Draft XI';
  });

  function switchTab(tab) {
    if (match && !match.over) return toast('Finish the match first.');
    if (draft && draft.phase === 'spinning') return;
    if (tab === 'teams') state.viewTeam = null;
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
    const typing = e.target.tagName === 'INPUT';
    const dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (typing) {
      if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
      return;
    }
    if (dirs[e.key]) { e.preventDefault(); moveFocus(dirs[e.key]); return; }
    const k = e.key.toLowerCase();
    if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (k === 'q' || k === 'e') {
      const idx = TAB_ORDER.indexOf(TAB_FOR[state.screen]);
      const next = TAB_ORDER[(idx + (k === 'e' ? 1 : TAB_ORDER.length - 1)) % TAB_ORDER.length];
      switchTab(next);
    } else if (k === 's' && state.screen === 'draft') spin(false);
    else if (k === 'r' && state.screen === 'draft') reroll();
    else if (e.key === ' ' && state.screen === 'match' && match && !match.over) { e.preventDefault(); skipMatch(); }
  });

  render(true);
})();

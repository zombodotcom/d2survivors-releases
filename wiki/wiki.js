/* D2 Survivors wiki: the shared shell (top bar, sidebar, search) and the
   pages drawn from data.json. data.json is written by the game itself
   (d2survivors.exe --wiki-json data.json), so the numbers are the game's. */
(function () {
  'use strict';

  var CLASSES = [
    ['sor', 'Sorceress'], ['ama', 'Amazon'], ['nec', 'Necromancer'], ['pal', 'Paladin'],
    ['ass', 'Assassin'], ['dru', 'Druid'], ['bar', 'Barbarian'], ['war', 'Warlock']
  ];
  var NAV = [
    ['Start', [['index.html', 'Overview: a run'], ['controls.html', 'Controls'], ['faq.html', 'FAQ and troubleshooting']]],
    ['Classes', CLASSES.map(function (c) { return [c[0] + '.html', c[1]]; })],
    ['Reference', [
      ['skills.html', 'All skills'], ['items.html', 'Run items and chests'], ['shrines.html', 'Shrines'],
      ['acts.html', 'Acts, bosses, super-uniques'], ['talents.html', 'Talent tree'], ['armory.html', 'Armory']
    ]]
  ];
  // Text pages the search knows by their sections.
  var TOPICS = [
    ['Controls: keyboard', 'controls.html#keyboard'], ['Controls: gamepad', 'controls.html#keyboard'],
    ['Spell review keys (spells.bat)', 'controls.html#review'],
    ['Steam edition of D2R', 'faq.html#steam'], ['check_d2r.bat and d2r_check.txt', 'faq.html#steam'],
    ['D2R not found', 'faq.html#notfound'], ['Windows warning: unknown app', 'faq.html#smartscreen'],
    ['Updating to a new build', 'faq.html#update'], ['perf.log and slow frames', 'faq.html#perf'],
    ['Video memory, graphics card', 'faq.html#vram'], ['The game crashed: crash.txt', 'faq.html#crash'],
    ['Files beside the exe', 'faq.html#files'], ['Does it start D2R or Battle.net?', 'faq.html#d2r'],
    ['Leveling and experience', 'index.html#leveling'], ['Level-up cards', 'index.html#cards'],
    ['Rerolls', 'index.html#cards'], ['Boss rewards', 'index.html#bosses'], ['Endless mode', 'index.html#endless'],
    ['Gold and chests', 'items.html#chests'], ['Magic find and chest rarity', 'items.html#chests'],
    ['Shards', 'talents.html#shards'], ['Super-unique mods', 'acts.html#mods'], ['Events before the boss', 'acts.html#events'],
    ['Champions and uniques', 'acts.html#elites']
  ];

  var page = document.body.getAttribute('data-page') || '';
  var here = location.pathname.split('/').pop() || 'index.html';

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function mmss(s) { s = +s; return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function className(code) {
    for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i][0] === code) return CLASSES[i][1];
    return code;
  }
  function chip(text, cls, href) {
    return href ? '<a class="chip ' + (cls || '') + '" href="' + href + '">' + esc(text) + '</a>'
      : '<span class="chip ' + (cls || '') + '">' + esc(text) + '</span>';
  }
  function skillHref(s) { return s.class + '.html#skill-' + slug(s.name); }
  var KIND = {
    spell: 'Spell', melee: 'Attack', passive: 'Passive', aura: 'Aura', summon: 'Summon',
    spirit: 'Spirit', trap: 'Trap', curse: 'Curse', warcry: 'Warcry'
  };

  var dataP = null;
  function data() {
    if (!dataP) {
      dataP = fetch('data.json').then(function (r) {
        if (!r.ok) throw new Error('data.json: ' + r.status);
        return r.json();
      });
    }
    return dataP;
  }

  // ---------- shell ----------
  function shell() {
    var main = document.querySelector('main');
    var top = el('header', 'top');
    top.innerHTML = '<div class="in">' +
      '<button class="menu-btn" type="button" aria-label="Menu">Menu</button>' +
      '<a class="brand" href="index.html">D2 Survivors<span>WIKI</span></a>' +
      '<div class="search"><input type="search" placeholder="Search skills, items, monsters..." aria-label="Search the wiki" autocomplete="off"><div class="results"></div></div>' +
      '<div class="links"><a href="../index.html">Home</a><a href="../index.html#updates">Updates</a>' +
      '<a href="https://github.com/zombodotcom/d2survivors-releases/releases/latest/download/d2survivors.zip">Download</a></div></div>';
    var side = el('aside', 'side');
    var nav = '';
    NAV.forEach(function (g) {
      nav += '<h4>' + esc(g[0]) + '</h4>';
      g[1].forEach(function (p) {
        nav += '<a href="' + p[0] + '"' + (p[0] === here ? ' class="cur"' : '') + '>' + esc(p[1]) + '</a>';
      });
    });
    side.innerHTML = nav;
    var lay = el('div', 'layout');
    document.body.insertBefore(top, document.body.firstChild);
    main.parentNode.insertBefore(lay, main);
    lay.appendChild(side);
    lay.appendChild(main);
    var foot = el('footer', '', 'Numbers on these pages come from the game itself: <code>d2survivors.exe --wiki-json</code> writes them from its tables. ' +
      '<span id="buildname"></span> A fan project, not affiliated with or endorsed by Blizzard Entertainment.');
    main.appendChild(foot);
    top.querySelector('.menu-btn').addEventListener('click', function () {
      document.body.classList.toggle('menu');
    });
    side.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') document.body.classList.remove('menu');
    });
    top.querySelector('.search input').addEventListener('focus', function () { document.body.classList.remove('menu'); });
    search(top.querySelector('.search input'), top.querySelector('.results'));
  }

  // ---------- search ----------
  var index = null;
  function buildIndex(d) {
    var ix = [];
    function add(t, s, u) { ix.push({ t: t, s: s || '', u: u, l: (t + ' ' + (s || '')).toLowerCase() }); }
    NAV.forEach(function (g) { g[1].forEach(function (p) { add(p[1], 'Page', p[0]); }); });
    TOPICS.forEach(function (t) { add(t[0], 'Topic', t[1]); });
    if (!d) return ix;
    d.classes.forEach(function (c) {
      c.builds.forEach(function (b) {
        add(b.name, c.name + ' build: ' + b.skills.slice(0, 4).join(', '), c.code + '.html#build-' + b.key);
      });
    });
    d.skills.forEach(function (s) {
      add(s.name, className(s.class) + ' ' + (KIND[s.kind] || s.kind).toLowerCase() + (s.element ? ', ' + s.element : ''), skillHref(s));
    });
    d.items.forEach(function (it) { add(it.name, it.rarity + ' run item: ' + it.stats.join(', '), 'items.html#item-' + slug(it.name)); });
    d.shrines.forEach(function (sh) { add(sh.name, sh.boost || 'Shrine', 'shrines.html#shrine-' + slug(sh.name)); });
    d.acts.forEach(function (a, i) {
      add(a.boss, a.name + ' boss', 'acts.html#act-' + (i + 1));
      a.roster.forEach(function (m) { add(m.name, a.name + ' monster, level ' + m.level, 'acts.html#act-' + (i + 1)); });
      a.supers.forEach(function (sp) { add(sp.name, a.name + ' super-unique (' + sp.kind + ')' + (sp.mods ? ': ' + sp.mods : ''), 'acts.html#sup-' + slug(sp.name)); });
    });
    var seen = {};
    d.classes.forEach(function (c) {
      c.talents.forEach(function (t) {
        var key = t.key + (t.key === 'start' || seen[t.key] === undefined ? '' : '');
        if (t.key === 'start' || ['mastery', 'strike', 'lore', 'shield', 'burst', 'wolverine', 'iron', 'demonic'].indexOf(t.key) >= 0) {
          add(t.name, c.name + ' talent: ' + t.lines[0], 'talents.html#' + c.code);
        } else if (!seen[key]) {
          seen[key] = 1;
          add(t.name, 'Talent: ' + t.lines[0], 'talents.html#t-' + t.key);
        }
      });
    });
    d.armory.forEach(function (g) {
      add(g.name, 'Armory ' + (g.set ? 'set item' : 'unique') + ', ' + g.base, 'armory.html?q=' + encodeURIComponent(g.name));
    });
    return ix;
  }

  function search(input, box) {
    var sel = -1;
    function ensure() {
      if (index) return Promise.resolve(index);
      return data().then(function (d) { index = buildIndex(d); return index; },
        function () { index = buildIndex(null); return index; });
    }
    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { box.classList.remove('on'); return; }
      ensure().then(function (ix) {
        var words = q.split(/\s+/);
        var hits = [];
        ix.forEach(function (e) {
          if (!words.every(function (w) { return e.l.indexOf(w) >= 0; })) return;
          var t = e.t.toLowerCase();
          var score = t === q ? 0 : t.indexOf(q) === 0 ? 1 : t.indexOf(q) >= 0 ? 2 : 3;
          hits.push([score, e]);
        });
        hits.sort(function (a, b) { return a[0] - b[0] || a[1].t.length - b[1].t.length; });
        sel = -1;
        box.innerHTML = hits.length ? hits.slice(0, 40).map(function (h) {
          return '<a href="' + esc(h[1].u) + '">' + esc(h[1].t) + '<small>' + esc(h[1].s) + '</small></a>';
        }).join('') : '<div class="none">Nothing found.</div>';
        box.classList.add('on');
      });
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { ensure(); if (input.value.trim()) run(); });
    input.addEventListener('keydown', function (e) {
      var links = box.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!links.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
        links[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        var a = links[sel >= 0 ? sel : 0];
        if (a) { box.classList.remove('on'); location.href = a.getAttribute('href'); }
      } else if (e.key === 'Escape') {
        box.classList.remove('on'); input.blur();
      }
    });
    box.addEventListener('click', function () { box.classList.remove('on'); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) box.classList.remove('on');
    });
  }

  // Scrolls to and flashes the hash's target once a page is drawn.
  function toHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var t = document.getElementById(id);
    if (!t) return;
    t.scrollIntoView();
    t.classList.remove('hit');
    void t.offsetWidth;
    t.classList.add('hit');
  }
  window.addEventListener('hashchange', toHash);

  // ---------- skill helpers ----------
  var NOT_MAIN = ['Casts every', 'Pulses every', 'Weapon Damage', 'Damage bonus', 'Damage penalty', 'Damage Type'];
  // The line that says most about a skill: its damage, else its first.
  function mainIdx(s) {
    for (var i = 0; i < s.labels.length; i++) {
      var l = s.labels[i];
      if (/Damage$/.test(l) && NOT_MAIN.indexOf(l) < 0) return i;
    }
    for (var j = 0; j < s.labels.length; j++) if (NOT_MAIN.indexOf(s.labels[j]) < 0) return j;
    return 0;
  }
  function everyOf(s) {
    var i = s.labels.indexOf('Casts every');
    if (i < 0) i = s.labels.indexOf('Pulses every');
    if (i < 0) return null;
    var a = s.levels[0][i], b = s.levels[s.levels.length - 1][i];
    return a === b ? a : a + ' to ' + b;
  }
  function cadence(s) {
    if (s.kind === 'passive') return 'Passive';
    var e = everyOf(s);
    if (s.kind === 'aura') return e ? 'Always on, pulses every ' + e : 'Always on';
    return e ? 'Casts every ' + e : '';
  }
  function cell(s, lvIdx, i, d) {
    var v = s.levels[lvIdx][i];
    if (s.labels[i] === 'Weapon Damage') return esc(d.rules.weapon_damage);
    return esc(v === '' ? '-' : v);
  }
  // The card's lines at a few levels; a line that never changes shows once.
  function levelTable(s, d, full) {
    var lvls = full ? s.levels.map(function (_, i) { return i; }) : [0, 4, 9, 14, 19];
    if (full) {
      var h = '<div class="tw"><table><thead><tr><th class="n">Level</th>' +
        s.labels.map(function (l) { return '<th>' + esc(l) + '</th>'; }).join('') + '</tr></thead><tbody>';
      lvls.forEach(function (li) {
        h += '<tr><td class="n">' + (li + 1) + '</td>' + s.labels.map(function (_, i) {
          return '<td class="nw">' + cell(s, li, i, d) + '</td>';
        }).join('') + '</tr>';
      });
      return h + '</tbody></table></div>';
    }
    var t = '<div class="tw"><table><thead><tr><th></th>' + lvls.map(function (li) {
      return '<th class="n">Lv ' + (li + 1) + '</th>';
    }).join('') + '</tr></thead><tbody>';
    s.labels.forEach(function (l, i) {
      var same = s.levels.every(function (row) { return row[i] === s.levels[0][i]; });
      t += '<tr><td>' + esc(l) + '</td>';
      if (same) t += '<td colspan="' + lvls.length + '" class="dim">' + cell(s, 0, i, d) + ' (every level)</td>';
      else t += lvls.map(function (li) { return '<td class="n nw">' + cell(s, li, i, d) + '</td>'; }).join('');
      t += '</tr>';
    });
    return t + '</tbody></table></div>';
  }
  function skillCard(s, d, cls) {
    var builds = cls.builds.filter(function (b) { return s.builds.indexOf(b.key) >= 0; });
    var starts = cls.builds.filter(function (b) { return !b.all && b.start === s.name; });
    var h = '<div class="frame skill" id="skill-' + slug(s.name) + '"><header><h3>' + esc(s.name) + '</h3>' +
      chip(KIND[s.kind] || s.kind, 'k') + (s.element ? '<span class="chip el-' + s.element + '">' + esc(s.element) + '</span>' : '') +
      '</header>';
    if (s.desc) h += '<div class="desc">' + esc(s.desc.charAt(0).toUpperCase() + s.desc.slice(1)) + '</div>';
    h += '<div class="facts">';
    h += '<div><span>Opens at level</span> ' + s.unlock_level + ' <span class="dim">(D2: ' + s.req_level + ')</span></div>';
    var c = cadence(s);
    if (c) h += '<div>' + esc(c) + '</div>';
    if (s.prereqs.length) h += '<div><span>Needs</span> ' + s.prereqs.map(esc).join(', ') + '</div>';
    if (builds.length) h += '<div><span>Builds</span> ' + builds.map(function (b) {
      return '<a href="#build-' + b.key + '">' + esc(b.name) + '</a>';
    }).join(', ') + '</div>';
    if (starts.length) h += '<div><span>Starting skill of</span> ' + starts.map(function (b) { return esc(b.name); }).join(', ') + '</div>';
    h += '</div>';
    if (s.synergies.length) {
      h += '<div class="facts" style="grid-template-columns:1fr"><div><span>Synergies</span> ' + s.synergies.map(function (y) {
        return '+' + y.pct + '% damage per level of ' + esc(y.name) + (y.in_game ? '' : ' <span class="dim">(not in the game)</span>');
      }).join('; ') + '</div></div>';
    }
    h += levelTable(s, d, false);
    h += '<details><summary>All 20 levels</summary>' + levelTable(s, d, true) + '</details>';
    return h + '</div>';
  }

  // ---------- pages ----------
  var R = {};

  R.overview = function (d, m) {
    var r = d.rules;
    var unlock = r.unlock.map(function (u) { return '<tr><td class="n">' + u[0] + '</td><td class="n">' + u[1] + '</td></tr>'; }).join('');
    m.innerHTML =
      '<h1>D2 Survivors wiki</h1>' +
      '<p class="lead">How a run works, what every class and skill does in this game, and where the items, shrines and bosses come in. ' +
      'Skills here are not D2\'s exactly: they cast themselves, and the numbers are this game\'s.</p>' +
      '<div class="grid g4" style="margin-bottom:8px">' +
      CLASSES.map(function (c) {
        return '<a class="frame box" style="text-decoration:none;padding:0;overflow:hidden" href="' + c[0] + '.html">' +
          '<img class="cpic" loading="lazy" alt="' + c[1] + '" src="../img/cls/' + c[0] + '.webp">' +
          '<div style="padding:8px 12px;font:700 16px Cinzel,serif;color:var(--gold2)">' + c[1] + '</div></a>';
      }).join('') + '</div>' +

      '<h2 id="run">A run</h2>' +
      '<p>Pick a class and one of its builds. You only move: your skills cast themselves at the nearest monsters. ' +
      'A run goes through five acts. Each act\'s boss comes at <b>' + mmss(r.boss_secs) + '</b>, with ' + r.boss_life_x + ' times her D2 life. ' +
      'Kill her and the next act starts a few seconds later. After Baal you win the run, and can keep going in <a href="#endless">Endless</a>.</p>' +
      '<p>New monster kinds join each act as the clock runs (see <a href="acts.html">Acts</a>). Super-uniques and set-piece events break up the waves before each boss.</p>' +

      '<h2 id="leveling">Leveling</h2>' +
      '<ul class="plain">' +
      '<li>Kills give experience. Below level ' + r.fast_levels + ' it counts double, so the first skills come quickly.</li>' +
      '<li>The run keeps a monster level that rises by one every 20 seconds. When you are behind it, kills give more: +15% for each level behind, up to ' +
      r.catch_up[r.catch_up.length - 1] + '%.</li>' +
      '<li>Each level adds life: your class\'s base, plus its gain per level (see each class page).</li>' +
      '</ul>' +

      '<h2 id="cards">Level-up cards</h2>' +
      '<ul class="plain">' +
      '<li>Each level deals <b>' + r.hand + ' cards</b> (one more with the Insight talent). The game pauses while they are up. Pick one with <kbd>1</kbd>-<kbd>4</kbd> or a click.</li>' +
      '<li>A card either learns a new skill or raises one you have by a level, up to level <b>' + r.max_skill + '</b>. There are no free skill points.</li>' +
      '<li>Cards only offer your build\'s skills. "All Skills" offers every skill of the class.</li>' +
      '<li>While you can learn a new skill, one is always in the hand.</li>' +
      '<li>You can know <b>' + r.skill_slots + ' skills</b>. After that, every card raises one you have.</li>' +
      '<li>A skill opens at a player level set by its D2 required level, so every tier opens within a run. ' +
      'D2\'s prerequisites still apply, except ones this game does not cast or your build leaves out.</li>' +
      '<li><b>Rerolls</b> (<kbd>R</kbd>) deal the hand again. You get them from the Second Thoughts talent.</li>' +
      '</ul>' +
      '<div class="tw" style="max-width:340px"><table><thead><tr><th class="n">D2 required level</th><th class="n">Opens at level</th></tr></thead><tbody>' + unlock + '</tbody></table></div>' +

      '<h2 id="bosses">Boss rewards</h2>' +
      '<p>An act boss gives three times her experience, refills your life, and deals a reward hand: each card raises a skill you have by <b>' + r.boss_levels +
      ' levels</b> (up to ' + r.max_skill + '). She always drops an item for the <a href="armory.html">Armory</a>.</p>' +

      '<h2 id="loot">Gold, chests and shrines</h2>' +
      '<p>Kills drop gold now and then (' + r.gold_chance + '% of them). Gold opens <a href="items.html#chests">chests</a>, each dealing a hand of ' + r.item_hand +
      ' <a href="items.html">run items</a>; each chest costs more than the last. <a href="shrines.html">Shrines</a> give a ' + r.blessing_secs + '-second boost. ' +
      'Run items last for the run only.</p>' +

      '<h2 id="between">Between runs</h2>' +
      '<p>A run banks <b>shards</b>: one per ' + r.gold_per_shard + ' gold picked up, ' + r.act_shards + ' per act cleared and ' + r.victory_shards +
      ' for a victory. Spend them on the class\'s <a href="talents.html">talent tree</a> (<kbd>T</kbd>). ' +
      'Items from bosses go to the class\'s stash; wear them in the <a href="armory.html">Armory</a> (<kbd>I</kbd>) and a few of their properties apply at the next run\'s start.</p>' +

      '<h2 id="endless">Endless</h2>' +
      '<p>After Baal, Endless keeps the run going. Monster life and damage rise by ' + r.endless_pct_per_min + '% every minute. ' +
      'An event comes every ' + r.ambush_endless_every + ' seconds, and super-uniques come ' + r.super_endless_first + ' seconds in, then once every ' + r.super_endless_every + ' seconds.</p>';
  };

  R.cls = function (d, m) {
    var code = document.body.getAttribute('data-class');
    var c = d.classes.filter(function (x) { return x.code === code; })[0];
    if (!c) { m.innerHTML = '<p>Unknown class.</p>'; return; }
    var skills = d.skills.filter(function (s) { return s.class === code; });
    skills.sort(function (a, b) { return a.req_level - b.req_level || c.skills.indexOf(a.name) - c.skills.indexOf(b.name); });
    var passives = skills.filter(function (s) { return s.kind === 'passive' || s.kind === 'aura'; });
    var h = '<div class="hero"><img class="pic" alt="' + esc(c.name) + '" src="../img/cls/' + code + '.webp"><div>' +
      '<h1>' + esc(c.name) + '</h1>' +
      '<div class="stats"><div><b>' + c.life + '</b>life at level 1</div><div><b>+' + c.life_per_level + '</b>life per level</div>' +
      '<div><b>' + skills.length + '</b>skills</div><div><b>' + (c.builds.length - 1) + '</b>builds</div></div>' +
      '<p class="dim">Life per level is the class\'s own gain plus five points of vitality, as D2 counts it. ' +
      'Starts with <b>' + esc(c.first_skill) + '</b> in "All Skills"; each build names its own starting skill.</p>' +
      '<div class="chips">' + skills.map(function (s) { return chip(s.name, '', '#skill-' + slug(s.name)); }).join('') + '</div>' +
      '</div></div>';

    h += '<h2 id="builds">Builds</h2><div class="grid g2">';
    c.builds.forEach(function (b) {
      h += '<div class="frame box build" id="build-' + b.key + '"><h3>' + esc(b.name) + '</h3><p>' + esc(b.blurb) + '</p>';
      h += '<div class="chips">';
      if (b.all) h += '<span class="chip k">every ' + esc(c.name) + ' skill</span>';
      else b.skills.forEach(function (n) {
        var s = d.skills.filter(function (x) { return x.name === n; })[0];
        h += chip(n, n === b.start ? 'start' : '', s ? '#skill-' + slug(n) : null);
      });
      h += '</div><div class="row">Starts with <b>' + esc(b.start) + '</b>' + (b.javelins ? '. Holds javelins.' : '') + '</div></div>';
    });
    h += '</div>';

    if (passives.length) {
      h += '<h2 id="passives">Passives and auras</h2><p class="lead">Never cast: they work as soon as they are learned. ' +
        'Talents are on the <a href="talents.html#' + code + '">talent tree</a> page.</p><div class="chips" style="margin-bottom:8px">' +
        passives.map(function (s) { return chip(s.name + ' (' + (KIND[s.kind] || s.kind) + ')', '', '#skill-' + slug(s.name)); }).join('') + '</div>';
    }

    h += '<h2 id="skills">Skills</h2><p class="lead">What each skill\'s level-up card shows, from the game\'s own numbers, without synergies. ' +
      'Synergy percents add to a skill\'s damage for each level of the other skill. Yards are D2 yards; times are seconds.</p>';
    skills.forEach(function (s) { h += skillCard(s, d, c); });

    h += '<h2 id="talents">Talents</h2><div class="tw"><table><thead><tr><th>Talent</th><th class="n">Ranks</th><th>At max rank</th><th>Shards per rank</th></tr></thead><tbody>' +
      c.talents.map(function (t) {
        return '<tr><td>' + esc(t.name) + '</td><td class="n">' + t.ranks + '</td><td>' + esc(t.lines[t.lines.length - 1]) + '</td><td>' + t.costs.join(', ') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    m.innerHTML = h;
  };

  // A sortable table: cols [{h, n (numeric), v(row) -> sort value, f(row) -> html}].
  function sortTable(host, cols, rows, init) {
    var key = init == null ? -1 : init, dir = 1;
    function draw() {
      var rs = rows();
      if (key >= 0) {
        var c = cols[key];
        rs = rs.slice().sort(function (a, b) {
          var x = c.v(a), y = c.v(b);
          if (x === y) return 0;
          if (x === null || x === undefined || x === '') return 1;
          if (y === null || y === undefined || y === '') return -1;
          return (x < y ? -1 : 1) * dir;
        });
      }
      var h = '<div class="tw"><table><thead><tr>' + cols.map(function (c, i) {
        return '<th class="sort' + (c.n ? ' n' : '') + (i === key ? (dir > 0 ? ' up' : ' down') : '') + '" data-i="' + i + '">' + esc(c.h) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rs.map(function (r) {
        return '<tr>' + cols.map(function (c) { return '<td' + (c.n ? ' class="n"' : '') + '>' + c.f(r) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
      host.innerHTML = h;
      host.querySelectorAll('th').forEach(function (th) {
        th.addEventListener('click', function () {
          var i = +th.getAttribute('data-i');
          if (i === key) dir = -dir; else { key = i; dir = 1; }
          draw();
        });
      });
      return rs.length;
    }
    return draw;
  }
  function options(list, all) {
    return '<option value="">' + esc(all) + '</option>' + list.map(function (o) {
      return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>';
    }).join('');
  }
  function num(s) { var m = String(s).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function qs(k) { var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }

  R.skills = function (d, m) {
    var kinds = [], elems = [];
    d.skills.forEach(function (s) {
      if (kinds.indexOf(s.kind) < 0) kinds.push(s.kind);
      if (s.element && elems.indexOf(s.element) < 0) elems.push(s.element);
    });
    m.innerHTML = '<h1>All skills</h1><p class="lead">Every skill the game casts, ' + d.skills.length + ' in all. Click a column to sort; a name opens the skill on its class page. ' +
      'Damage is the card\'s main line at levels 1 and 20, without synergies.</p>' +
      '<div class="filters"><input type="search" id="f-q" placeholder="Filter by name or description">' +
      '<select id="f-c">' + options(CLASSES, 'Every class') + '</select>' +
      '<select id="f-k">' + options(kinds.map(function (k) { return [k, KIND[k] || k]; }), 'Every kind') + '</select>' +
      '<select id="f-e">' + options(elems.sort().map(function (e) { return [e, e]; }), 'Every element') + '</select>' +
      '<span class="count" id="f-n"></span></div><div id="tbl"></div>';
    var f = { q: m.querySelector('#f-q'), c: m.querySelector('#f-c'), k: m.querySelector('#f-k'), e: m.querySelector('#f-e') };
    f.c.value = qs('class');
    function main(s, li) { var i = mainIdx(s); return s.labels[i] === 'Weapon Damage' ? '' : s.levels[li][i]; }
    var cols = [
      { h: 'Skill', v: function (s) { return s.name; }, f: function (s) { return '<a href="' + skillHref(s) + '">' + esc(s.name) + '</a>'; } },
      { h: 'Class', v: function (s) { return className(s.class); }, f: function (s) { return esc(className(s.class)); } },
      { h: 'Kind', v: function (s) { return s.kind; }, f: function (s) { return esc(KIND[s.kind] || s.kind); } },
      { h: 'Element', v: function (s) { return s.element; }, f: function (s) { return '<span class="el-' + s.element + '">' + esc(s.element) + '</span>'; } },
      { h: 'Opens', n: 1, v: function (s) { return s.unlock_level; }, f: function (s) { return s.unlock_level; } },
      { h: 'Every', n: 1, v: function (s) { return num(everyOf(s)); }, f: function (s) { var e = everyOf(s); return e ? esc(e) : '<span class="dim">' + (s.kind === 'passive' ? 'passive' : 'always on') + '</span>'; } },
      { h: 'Main line', v: function (s) { return s.labels[mainIdx(s)]; }, f: function (s) { return esc(s.labels[mainIdx(s)] || ''); } },
      { h: 'Lv 1', n: 1, v: function (s) { return num(main(s, 0)); }, f: function (s) { return esc(main(s, 0)); } },
      { h: 'Lv 20', n: 1, v: function (s) { return num(main(s, s.levels.length - 1)); }, f: function (s) { return esc(main(s, s.levels.length - 1)); } },
      { h: 'Builds', v: function (s) { return s.builds.length; }, f: function (s) {
        var c = d.classes.filter(function (x) { return x.code === s.class; })[0];
        return s.builds.map(function (k) {
          var b = c.builds.filter(function (x) { return x.key === k; })[0];
          return b ? '<a href="' + s.class + '.html#build-' + k + '">' + esc(b.name.replace(' ' + c.name, '')) + '</a>' : '';
        }).join(', ');
      } }
    ];
    var draw = sortTable(m.querySelector('#tbl'), cols, function () {
      var q = f.q.value.trim().toLowerCase();
      return d.skills.filter(function (s) {
        return (!f.c.value || s.class === f.c.value) && (!f.k.value || s.kind === f.k.value) &&
          (!f.e.value || s.element === f.e.value) &&
          (!q || (s.name + ' ' + s.desc).toLowerCase().indexOf(q) >= 0);
      });
    });
    function redraw() { m.querySelector('#f-n').textContent = draw() + ' skills'; }
    ['q', 'c', 'k', 'e'].forEach(function (k) { f[k].addEventListener('input', redraw); });
    redraw();
  };

  R.items = function (d, m) {
    var r = d.rules;
    function pct(w) { var t = w.reduce(function (a, b) { return a + b; }, 0); return w.map(function (x) { return (100 * x / t).toFixed(1) + '%'; }); }
    var a = pct(r.rarity_weights), b = pct(r.rarity_weights_free);
    var names = ['Normal', 'Magic', 'Rare', 'Unique'];
    var h = '<h1>Run items and chests</h1><p class="lead">Run items are D2\'s gems, charms, jewels, rings, amulets and uniques, as passive stats for one run. ' +
      'Each copy adds its stats again; none levels up. They are gone when the run ends.</p>';
    h += '<h2 id="chests">Gold and chests</h2><ul class="plain">' +
      '<li>' + r.gold_chance + '% of kills drop gold. Gold flies to you within ' + r.magnet_yards + ' yards (more with Greed and some items).</li>' +
      '<li>' + r.chests + ' chests lie on the field (more with magic find). Opening one costs gold, more each time; it deals ' + r.item_hand + ' items and you keep one.</li>' +
      '<li>Magic find raises the odds of Magic, Rare and Unique items. A super-unique\'s free chest deals as if with +' + r.free_find + '% magic find.</li></ul>';
    h += '<div class="grid g2"><div class="tw"><table><thead><tr><th class="n">Chest</th><th class="n">Gold</th></tr></thead><tbody>' +
      r.chest_prices.map(function (p, i) { return '<tr><td class="n">' + (i + 1) + '</td><td class="n">' + p + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="tw"><table><thead><tr><th>Rarity</th><th class="n">Bought chest</th><th class="n">Free chest</th></tr></thead><tbody>' +
      names.map(function (n, i) { return '<tr><td class="q-' + n + '">' + n + '</td><td class="n">' + a[i] + '</td><td class="n">' + b[i] + '</td></tr>'; }).join('') +
      '</tbody></table><p class="dim" style="padding:8px 10px;margin:0;font-size:13px">With no magic find. Magic find multiplies every rarity above Normal.</p></div></div>';
    h += '<h2 id="list">Every run item</h2>';
    names.forEach(function (n) {
      var its = d.items.filter(function (i) { return i.rarity === n; });
      h += '<h3 class="q-' + n + '" style="margin-top:14px">' + n + '</h3><div class="tw"><table><thead><tr><th>Item</th><th>Gives</th></tr></thead><tbody>' +
        its.map(function (i) {
          return '<tr id="item-' + slug(i.name) + '"><td class="q-' + n + ' nw">' + esc(i.name) + '</td><td>' + i.stats.map(esc).join('<br>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    m.innerHTML = h;
  };

  R.shrines = function (d, m) {
    var r = d.rules;
    m.innerHTML = '<h1>Shrines</h1><p class="lead">D2\'s shrines, as short boosts. ' + r.shrines + ' stand on the field at a time; walk into one to take it. ' +
      'A used shrine\'s replacement comes ' + r.shrine_gap_secs + ' seconds later.</p>' +
      '<div class="tw"><table><thead><tr><th>Shrine</th><th>Blessing</th><th class="n">Lasts</th></tr></thead><tbody>' +
      d.shrines.map(function (s) {
        return '<tr id="shrine-' + slug(s.name) + '"><td class="nw">' + esc(s.name) + '</td><td>' +
          (s.boost ? esc(s.boost) : 'Pulls every gold pile on the field to you at once') + '</td><td class="n">' + (s.secs ? s.secs + 's' : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="dim">Mana Recharge\'s "Faster Cast Rate" makes every skill\'s cooldown shorter. Armor\'s damage cut counts toward the 75% cap on damage taken.</p>';
  };

  R.acts = function (d, m) {
    var r = d.rules;
    var h = '<h1>Acts, bosses and super-uniques</h1><p class="lead">Five acts, a boss closing each at ' + mmss(r.boss_secs) +
      '. New monster kinds join as the clock runs; their D2 levels make each act tougher than the last.</p>';
    h += '<div class="chips" style="margin-bottom:6px">' + d.acts.map(function (a, i) { return chip(a.name + ': ' + a.boss, '', '#act-' + (i + 1)); }).join('') +
      chip('Super-unique mods', '', '#mods') + chip('Events', '', '#events') + chip('Champions and uniques', '', '#elites') + '</div>';
    d.acts.forEach(function (a, i) {
      h += '<h2 id="act-' + (i + 1) + '">' + esc(a.name) + '</h2><div class="frame act">' +
        '<div class="boss">' + esc(a.boss) + '</div><p class="dim">Comes at ' + mmss(r.boss_secs) + ', D2 level ' + a.boss_level + ', with ' + r.boss_life_x +
        ' times her D2 life. ' + (a.boss_spells ? 'Casts ' + a.boss_spells + ' kinds of spell besides her blows.' : (a.boss === 'Diablo' ? 'Fights with his own seven skills.' : 'Fights hand to hand.')) +
        ' Always drops an Armory item of level ' + a.armory_levels[0] + '-' + (a.armory_levels[1] > 900 ? 'any' : a.armory_levels[1]) + '.</p>' +
        '<div class="grid g2"><div><h3>Monsters</h3><div class="tw"><table><thead><tr><th>Monster</th><th class="n">Level</th><th class="n">Joins at</th></tr></thead><tbody>' +
        a.roster.map(function (mo) { return '<tr><td>' + esc(mo.name) + '</td><td class="n">' + mo.level + '</td><td class="n">' + mmss(mo.from_secs) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div><div><h3>Super-uniques</h3><div class="tw"><table><thead><tr><th>Name</th><th>Mods</th><th class="n">Pack</th></tr></thead><tbody>' +
        a.supers.map(function (s) {
          return '<tr id="sup-' + slug(s.name) + '"><td><span class="q-Unique">' + esc(s.name) + '</span><br><small class="dim">' + esc(s.kind) + '</small></td><td>' +
            esc(s.mods || '-') + '</td><td class="n">' + s.pack + '</td></tr>';
        }).join('') + '</tbody></table></div></div></div></div>';
    });
    h += '<h2 id="supers">How super-uniques come</h2><ul class="plain">' +
      '<li>' + r.supers_per_act + ' per act, picked from the act\'s list by the run\'s seed. They come at ' +
      r.super_at_permille.map(function (p) { return (p / 10) + '%'; }).join(', ') + ' of the time to the boss, never before ' + r.super_from_secs + ' seconds into the act. One is out at a time.</li>' +
      '<li>Each brings a pack of its kind: ' + r.super_pack[0] + ' to ' + r.super_pack[1] + ', from its D2 group size.</li>' +
      '<li>Killing one drops a free chest (as if with +' + r.free_find + '% magic find) and a big pile of gold. One in ' + r.super_item_odds + ' also drops an Armory item.</li></ul>';
    h += '<h2 id="mods">Super-unique mods</h2><div class="tw"><table><thead><tr><th>Mod</th><th>In this game</th></tr></thead><tbody>' +
      [['Extra Strong', 'Hits 50% harder.'], ['Extra Fast', 'Moves 1.5 times as fast.'], ['Cursed', 'Its hits do 33% more.'],
        ['Mana Burn', 'Its hits do 25% more.'], ['Spectral Hit', 'Its hits do 25% more.'],
        ['Magic Resistant', 'Takes 60% of fire, cold and lightning damage.'], ['Stone Skin', 'Takes half physical damage.'],
        ['Fire Enchanted', 'Bursts into fire when it dies.'], ['Cold Enchanted', 'Bursts into ice when it dies.'],
        ['Lightning Enchanted', 'Throws charged bolts when struck, at most every ' + r.super_bolts_every + 's.'],
        ['Teleportation', 'Blinks next to you every ' + r.super_blink_every + 's while more than ' + r.super_blink_far_yards + ' yards away.'],
        ['Aura Enchanted', 'Monsters within ' + r.super_aura_yards + ' yards of it hit 25% harder.']
      ].map(function (x) { return '<tr><td class="nw">' + x[0] + '</td><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<h2 id="events">Events before the boss</h2><p>In the last ' + Math.round(d.ambush[0].secs_before_boss) + ' seconds before each boss, four events come in an order shuffled by the run\'s seed, then a surge. ' +
      'None comes in an act\'s first ' + r.ambush_from_secs + ' seconds.</p><div class="tw"><table><thead><tr><th class="n">Slot</th><th>Event</th><th>Banner</th><th>What happens</th></tr></thead><tbody>' +
      d.ambush.map(function (a, i) {
        var what = {
          Champions: 'A unique monster with a D2-style name and a pack of blue-named champions.',
          Ring: 'A closed ring of monsters just off screen, closing in.',
          Stampede: 'Rows of one kind charging straight across the field.',
          Treasure: 'A hoarder that flees and gets away after ' + r.treasure_secs + ' seconds unless caught. It carries a level\'s worth of experience.',
          Surge: 'The whole act\'s roster at once, just before the boss.'
        }[a.name] || '';
        return '<tr><td class="n">' + (a.name === 'Surge' ? 'last' : (i + 1)) + '<br><small class="dim">' + mmss(a.secs_before_boss) + ' before</small></td><td>' + esc(a.name) + '</td><td class="dim">' + esc(a.banner) + '</td><td>' + esc(what) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="dim">The four shuffled events take the slots in the order shown; the times are when each slot goes off.</p>';
    h += '<h2 id="elites">Champions and uniques</h2><div class="tw"><table><thead><tr><th>Monster</th><th class="n">Life</th><th class="n">Damage</th><th class="n">Experience</th></tr></thead><tbody>' +
      d.elites.map(function (e) {
        return '<tr><td>' + esc(e.name) + '</td><td class="n">x' + e.life + '</td><td class="n">' + e.damage_pct + '%</td><td class="n">x' + e.xp + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="dim">Against a normal monster of the same kind.</p>';
    m.innerHTML = h;
  };

  R.talents = function (d, m) {
    var r = d.rules;
    var classNodes = {};
    var generic = d.classes[0].talents.filter(function (t, i, all) {
      return d.classes.every(function (c) { return c.talents.some(function (u) { return u.key === t.key && u.name === t.name; }); });
    });
    var gkeys = generic.map(function (t) { return t.key; });
    function rows(ts, pre) {
      return '<div class="tw"><table><thead><tr><th>Talent</th><th class="n">Ranks</th><th>Each rank</th><th>Shards per rank</th><th class="n">Total</th></tr></thead><tbody>' +
        ts.map(function (t) {
          var total = t.costs.reduce(function (a, b) { return a + b; }, 0);
          return '<tr id="t-' + (pre ? pre + '-' : '') + t.key + '"><td class="nw">' + esc(t.name) + '</td><td class="n">' + t.ranks + '</td><td>' + t.lines.map(function (l, i) {
            return '<span class="dim">' + (i + 1) + ':</span> ' + esc(l);
          }).join('<br>') + '</td><td class="nw">' + t.costs.join(', ') + '</td><td class="n">' + total + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var h = '<h1>Talent tree</h1><p class="lead">Between runs, shards buy talents per class (<kbd>T</kbd> on the class screen, death screen or Esc menu). ' +
      'Ranks apply at the next run\'s start. Talents add no randomness: a seed plays the same with any ranks, only stronger.</p>';
    h += '<h2 id="shards">Shards</h2><ul class="plain"><li>1 shard per ' + r.gold_per_shard + ' gold picked up.</li><li>' + r.act_shards +
      ' per act cleared.</li><li>' + r.victory_shards + ' for a victory (Baal slain).</li><li>Each rank of a talent costs more: 1, 3, 6, 10, 15 times its first rank.</li></ul>';
    h += '<h2 id="generic">Every class</h2>' + rows(generic);
    h += '<h2 id="classes">Each class\'s own</h2><p class="lead">Every class also has a starting-skill node (its build\'s starting skill) and one node of its own.</p>';
    d.classes.forEach(function (c) {
      var own = c.talents.filter(function (t) { return gkeys.indexOf(t.key) < 0; });
      h += '<h3 id="' + c.code + '" style="margin-top:18px"><a href="' + c.code + '.html" style="text-decoration:none">' + esc(c.name) + '</a></h3>' + rows(own, c.code);
    });
    m.innerHTML = h;
  };

  R.armory = function (d, m) {
    var r = d.rules;
    var places = [];
    d.armory.forEach(function (g) { if (places.indexOf(g.place) < 0) places.push(g.place); });
    var h = '<h1>Armory</h1><p class="lead">Act bosses always drop a real D2 unique or set item; a super-unique does one time in ' + r.super_item_odds + '. ' +
      'The item fits the act by its level, and goes to the class\'s stash. Worn in the Armory (<kbd>I</kbd>) between runs, a few of its properties apply at the next run\'s start, mapped onto the run\'s stats.</p>';
    h += '<div class="frame note"><b>Rules.</b> An item gives at most ' + r.armory_lines + ' bonuses, its strongest. Worn items together give at most: ' +
      r.armory_caps.map(function (c) { return esc(c[0]); }).join(', ') + '. Items made for one class only drop for that class. ' +
      'Item levels by act: ' + d.acts.map(function (a) { return a.name + ' ' + a.armory_levels[0] + '-' + (a.armory_levels[1] > 900 ? 'up' : a.armory_levels[1]); }).join(', ') + '. ' +
      'Like talents, items add no randomness.</div>';
    h += '<div class="filters"><input type="search" id="f-q" placeholder="Filter by name, set, base or bonus">' +
      '<select id="f-c">' + options(CLASSES, 'Any class') + '</select>' +
      '<select id="f-p">' + options(places.map(function (p) { return [p, p]; }), 'Every slot') + '</select>' +
      '<select id="f-a">' + options(d.acts.map(function (a, i) { return [String(i), a.name + ' (' + a.boss + ')']; }), 'Every act') + '</select>' +
      '<select id="f-t"><option value="">Uniques and sets</option><option value="u">Uniques</option><option value="s">Set items</option></select>' +
      '<span class="count" id="f-n"></span></div><div id="tbl"></div>';
    m.innerHTML = h;
    var f = { q: m.querySelector('#f-q'), c: m.querySelector('#f-c'), p: m.querySelector('#f-p'), a: m.querySelector('#f-a'), t: m.querySelector('#f-t') };
    f.q.value = qs('q');
    function lines(g) {
      if (Array.isArray(g.bonuses)) return g.bonuses;
      var c = f.c.value;
      if (c && g.bonuses[c]) return g.bonuses[c];
      return null;
    }
    function fits(g, c) {
      if (g.class) return g.class === c;
      return Array.isArray(g.bonuses) || !!g.bonuses[c];
    }
    var cols = [
      { h: 'Item', v: function (g) { return g.name; }, f: function (g) {
        return '<span class="' + (g.set ? 'q-Set' : 'q-Unique') + '">' + esc(g.name) + '</span>' + (g.set ? '<br><small class="dim">' + esc(g.set) + '</small>' : '');
      } },
      { h: 'Base', v: function (g) { return g.base; }, f: function (g) {
        return esc(g.base) + (g.two_hand ? ' <small class="dim">(two hands)</small>' : '') + (g.class ? '<br><small class="dim">' + esc(className(g.class)) + ' only</small>' : '');
      } },
      { h: 'Slot', v: function (g) { return g.place; }, f: function (g) { return esc(g.place); } },
      { h: 'Level', n: 1, v: function (g) { return g.lvl; }, f: function (g) { return g.lvl; } },
      { h: 'Acts', v: function (g) { return g.acts.length ? g.acts[0] : 9; }, f: function (g) {
        return g.acts.length ? g.acts.map(function (a) { return ['I', 'II', 'III', 'IV', 'V'][a]; }).join(', ') : '<span class="dim">filler</span>';
      } },
      { h: 'In a run', v: function (g) { var l = lines(g); return l ? l.join() : ''; }, f: function (g) {
        var l = lines(g);
        if (l) return l.map(esc).join('<br>');
        return '<span class="dim">Depends on the class: pick one above.</span>';
      } }
    ];
    var draw = sortTable(m.querySelector('#tbl'), cols, function () {
      var q = f.q.value.trim().toLowerCase();
      return d.armory.filter(function (g) {
        if (f.c.value && !fits(g, f.c.value)) return false;
        if (f.p.value && g.place !== f.p.value) return false;
        if (f.a.value && g.acts.indexOf(+f.a.value) < 0) return false;
        if (f.t.value === 'u' && g.set) return false;
        if (f.t.value === 's' && !g.set) return false;
        if (q) {
          var b = Array.isArray(g.bonuses) ? g.bonuses : Object.keys(g.bonuses).map(function (k) { return g.bonuses[k].join(' '); });
          if ((g.name + ' ' + g.set + ' ' + g.base + ' ' + b.join(' ')).toLowerCase().indexOf(q) < 0) return false;
        }
        return true;
      });
    }, 3);
    function redraw() { m.querySelector('#f-n').textContent = draw() + ' items'; }
    Object.keys(f).forEach(function (k) { f[k].addEventListener('input', redraw); });
    redraw();
  };

  // ---------- start ----------
  shell();
  var main = document.querySelector('main');
  var host = document.getElementById('content') || main;
  var render = { overview: R.overview, 'class': R.cls, skills: R.skills, items: R.items, shrines: R.shrines, acts: R.acts, talents: R.talents, armory: R.armory }[page];
  data().then(function (d) {
    var b = document.getElementById('buildname');
    if (b && d.build && d.build !== 'dev') b.textContent = 'Data from build ' + d.build + '.';
    if (render) {
      host.innerHTML = '';
      render(d, host);
    }
    toHash();
  }, function (err) {
    if (render) host.innerHTML = '<p class="loading">Could not load the wiki data (' + esc(err.message) + '). The pages need to be served over http, not opened as files.</p>';
  });
  if (!render) toHash();
}());

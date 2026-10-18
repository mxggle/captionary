// The hero demo: a subtitle line you can click, drag across or Shift+click, and the look-up card the
// extension shows on a video site. Answers are written by hand for this page; in the extension they
// come from the dictionary, the translator and the AI the learner connects.
(() => {
  'use strict';

  const W = (t, pos, tr, ex, extra = {}) => ({ t, pos, tr, ex, ...extra });

  const DEMOS = {
    es: {
      lang: 'es',
      speech: 'es-ES',
      hint: 'Try it. Click a word in the top line, or drag across “se dio cuenta”.',
      translation: 'In the end, my brother realized I was right.',
      start: 6,
      line: [
        W('Al', 'contraction', 'to the; at the', 'A contraction of *a* + *el*. With *final* it makes *al final*, “in the end”.', { chunk: 'alfinal' }),
        ' ',
        W('final', 'noun', 'end', '*Final* is “end”. *Al final* is a set phrase: “in the end”, “eventually”.', { chunk: 'alfinal' }),
        ', ',
        W('mi', 'determiner', 'my', '*Mi* means “my”.', { warn: 'Without an accent. *Mí*, with one, means “me” after a preposition.' }),
        ' ',
        W('hermano', 'noun', 'brother', '*Hermano* is “brother”. *Hermana* is “sister”, and *hermanos* can mean “siblings”.'),
        ' ',
        W('se', 'pronoun', 'himself (reflexive)', 'Here *se* belongs to *darse cuenta*: the verb is used reflexively, so word by word it reads “he gave himself account”.', { chunk: 'cuenta' }),
        ' ',
        W('dio', 'verb', 'gave', '*Dio* is the past tense of *dar*, “to give”. With *se* and *cuenta* it means “realized”.', { chunk: 'cuenta' }),
        ' ',
        W('cuenta', 'noun', 'bill; account', 'On its own *cuenta* is a bill or an account. In this line it’s part of *darse cuenta*, “to realize”.', {
          chunk: 'cuenta',
          warn: 'Don’t read it as “bill” here.',
        }),
        ' ',
        W('de', 'preposition', 'of; from', '*Darse cuenta de algo* is “to realize something”, so this *de* belongs to the phrase before it.', { chunk: 'cuenta' }),
        ' ',
        W('que', 'conjunction', 'that', '*Que* is “that”. It introduces what he realized.'),
        ' ',
        W('yo', 'pronoun', 'I', '*Yo* is “I”. Spanish usually leaves it out; here it adds stress: *I* was the one who was right.'),
        ' ',
        W('tenía', 'verb', 'had', '*Tenía* is the imperfect of *tener*, “to have”. With *razón* it means “was right”.', { chunk: 'razon' }),
        ' ',
        W('razón', 'noun', 'reason', '*Razón* is “reason”. *Tener razón* means “to be right”.', {
          chunk: 'razon',
          warn: 'Spanish says you “have reason”; English says you “are right”.',
        }),
        '.',
      ],
      phrases: {
        alfinal: {
          range: [0, 1],
          base: 'al final',
          tr: 'in the end',
          meaning: 'in the end, eventually',
          ex: '*Al final* means “in the end” or “eventually”. It’s a set phrase, so read it as one unit.',
        },
        cuenta: {
          range: [4, 6],
          base: 'darse cuenta',
          tr: 'realized',
          meaning: 'to realize, to notice',
          ex: '*Darse cuenta (de)* means “to realize” or “to notice”. *Se dio cuenta* is the past: “he realized”. The same pattern gives *me di cuenta*, “I realized”.',
          warn: 'No single word in it means “realize”.',
        },
        razon: {
          range: [10, 11],
          base: 'tener razón',
          tr: 'was right',
          meaning: 'to be right',
          ex: '*Tener razón* means “to be right”. *Tenía razón* is the imperfect: “I was right”.',
        },
      },
    },
    ja: {
      lang: 'ja',
      speech: 'ja-JP',
      hint: 'Try it. Click a word in the top line, or drag across “気がついたら”.',
      translation: 'Before I knew it, it was already morning.',
      start: 0,
      line: [
        W('気', 'noun', 'mind; attention', '*気* (ki) is “mind” or “attention”. *気がつく*, literally “attention attaches”, means “to notice”.', { chunk: 'kigatsuku' }),
        W('が', 'particle', 'subject marker', '*が* marks *気* as the subject of *つく*.', { chunk: 'kigatsuku' }),
        W('ついたら', 'verb', 'when it attached', '*ついたら* is *つく* (“to attach”) with *～たら* (“when”). After *気が* it means “when I noticed”.', {
          chunk: 'kigatsuku',
        }),
        '、',
        W('もう', 'adverb', 'already', '*もう* means “already”. With a past verb it stresses that the change has already happened.'),
        W('朝', 'noun', 'morning', '*朝* (asa) is “morning”. *朝になる*, “to become morning”, is how Japanese says morning comes.', { chunk: 'asa' }),
        W('に', 'particle', 'into; to', '*に* marks what something turns into, as in *朝になる*.', { chunk: 'asa' }),
        W('なっていた', 'verb', 'had become', '*なっていた* is *なる* (“to become”) in the *～ていた* form: a state that was already in place.', { chunk: 'asa' }),
        '。',
      ],
      phrases: {
        kigatsuku: {
          range: [0, 2],
          base: '気がつく',
          tr: 'before I knew it',
          meaning: 'to notice',
          ex: '*気がつく* means “to notice” or “to come to”. With *～たら*, *気がついたら* is a set way to say “before I knew it”.',
        },
        asa: {
          range: [4, 6],
          base: '朝になる',
          tr: 'it had become morning',
          meaning: 'morning comes',
          ex: '*朝になる* means “morning comes”. *になっていた* says it was already morning by the time I noticed.',
        },
      },
    },
  };

  const $ = (id) => document.getElementById(id);
  const demo = $('demo');
  const player = $('player');
  const orig = $('cap-orig');
  const trLine = $('cap-tr');
  const card = $('lk');
  const hint = $('demo-hint');
  if (!demo || !player || !orig || !trLine || !card) return;

  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  const state = {
    lang: 'es',
    sel: null, // [first, last] word index
    entry: null,
    explain: false,
    saved: { es: {}, ja: {} }, // dictionary form -> { status, range }
  };

  let words = []; // word objects for the current line, in order
  let buttons = []; // their buttons
  let gaps = []; // the text between words

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const md = (s) => esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>');
  const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

  // ---------- the line ----------
  function renderLine() {
    const d = DEMOS[state.lang];
    orig.lang = d.lang;
    orig.textContent = '';
    words = [];
    buttons = [];
    gaps = [];
    for (const part of d.line) {
      if (typeof part === 'string') {
        // The text between two words, so a selection or an underline can run across it.
        const g = document.createElement('span');
        g.className = 'gap';
        g.textContent = part;
        g.dataset.after = String(words.length - 1);
        gaps.push(g);
        orig.append(g);
        continue;
      }
      const i = words.length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'w';
      b.textContent = part.t;
      b.dataset.i = String(i);
      words.push(part);
      buttons.push(b);
      orig.append(b);
    }
    trLine.textContent = d.translation;
    trLine.lang = 'en';
    if (hint) hint.textContent = d.hint;
    paintLine();
  }

  function paintLine() {
    const learning = Object.values(state.saved[state.lang]).filter((s) => s.status === 'learning');
    const sel = state.sel;
    buttons.forEach((b, i) => {
      b.classList.toggle('is-sel', !!sel && i >= sel[0] && i <= sel[1]);
      b.classList.toggle('is-learn', learning.some((s) => i >= s.range[0] && i <= s.range[1]));
    });
    gaps.forEach((g) => {
      const i = Number(g.dataset.after);
      g.classList.toggle('is-sel', !!sel && i >= sel[0] && i < sel[1]);
      g.classList.toggle('is-learn', learning.some((s) => i >= s.range[0] && i < s.range[1]));
    });
  }

  // The text exactly as written between two words, separators included.
  function textOf([a, b]) {
    const d = DEMOS[state.lang];
    let out = '';
    let i = -1;
    for (const part of d.line) {
      if (typeof part === 'string') {
        if (i >= a && i < b) out += part;
        continue;
      }
      i += 1;
      if (i >= a && i <= b) out += part.t;
    }
    return out.trim();
  }

  // ---------- what a selection looks up ----------
  function resolve(range, fromChunk) {
    const d = DEMOS[state.lang];
    const [a, b] = range;
    if (a === b && !fromChunk) {
      const w = words[a];
      return { kind: 'word', text: w.t, pos: w.pos, tr: w.tr, ex: w.ex, warn: w.warn, base: w.t, chunk: w.chunk ? d.phrases[w.chunk] : null, range };
    }
    // A selection inside a known phrase, or a phrase with at most one extra word, looks up that phrase.
    let best = null;
    for (const p of Object.values(d.phrases)) {
      const overlap = Math.min(b, p.range[1]) - Math.max(a, p.range[0]) + 1;
      const extra = b - a + 1 - overlap;
      if (overlap >= 2 && extra <= 1 && (!best || overlap > best.overlap)) best = { p, overlap };
    }
    const text = textOf(range);
    if (best) {
      const p = best.p;
      return { kind: 'phrase', text, pos: 'phrase', tr: p.tr, ex: p.ex, warn: p.warn, base: p.base, chunk: null, range };
    }
    const gloss = words
      .slice(a, b + 1)
      .map((w) => w.tr.split(';')[0])
      .join(' · ');
    return {
      kind: 'other',
      text,
      pos: '',
      tr: gloss,
      ex: 'That’s a word-by-word gloss. This page only knows a few phrases; in the extension, your tutor explains any selection in the context of the line.',
      base: text,
      chunk: null,
      range,
    };
  }

  function open(range, { fromChunk = false, explain = false, quiet = false } = {}) {
    state.sel = [Math.min(...range), Math.max(...range)];
    state.entry = resolve(state.sel, fromChunk);
    // Following a phrase the tutor named explains it at once, as the extension does.
    state.explain = explain || fromChunk;
    paintLine();
    renderCard(!quiet);
  }

  function close() {
    state.sel = null;
    state.entry = null;
    card.hidden = true;
    paintLine();
  }

  // ---------- the card ----------
  function renderCard(animate) {
    const e = state.entry;
    if (!e) return;
    const d = DEMOS[state.lang];
    const saved = state.saved[state.lang][e.base];
    const learning = saved?.status === 'learning';
    const known = saved?.status === 'known';
    const showChunk = state.explain && e.chunk;

    let html = '<div class="lk-body">';
    html += '<div class="lk-head">';
    html += `<span class="lk-word" lang="${d.lang}">${esc(e.text)}</span>`;
    if (canSpeak) html += `<button type="button" class="lk-icon" data-act="speak" aria-label="Listen">${icon('i-speaker')}</button>`;
    if (e.pos) html += `<span class="lk-pos">${esc(e.pos)}</span>`;
    html += `<button type="button" class="lk-icon" data-act="close" aria-label="Close (Esc)"${e.pos ? '' : ' style="margin-left:auto"'}>${icon('i-close')}</button>`;
    html += '</div>';
    html += `<div class="lk-tr">${esc(e.tr)}</div>`;
    if (showChunk) {
      const c = e.chunk;
      html += `<button type="button" class="lk-chunk" data-act="chunk" title="Look up “${esc(textOf(c.range))}” instead">`;
      html += `<span class="lk-chunk-label">Phrase</span><span class="lk-chunk-text" lang="${d.lang}">${esc(c.base)}</span>`;
      html += `<span class="lk-chunk-meaning">${esc(c.meaning)}</span>${icon('i-chevron')}</button>`;
    }
    html += '<div class="lk-sep"></div>';
    html += '<div class="lk-actions">';
    html += `<button type="button" class="lk-btn" data-act="save" aria-pressed="${learning}">${learning ? icon('i-bookmark-on', 'is-learn') : icon('i-bookmark')}${learning ? 'Learning' : 'Save'}</button>`;
    html += `<button type="button" class="lk-btn" data-act="known" aria-pressed="${known}">${icon('i-check')}Known</button>`;
    html += `<button type="button" class="lk-btn" data-act="explain" aria-pressed="${state.explain}">${icon('i-spark')}Explain</button>`;
    html += '</div>';
    if (saved && e.base !== e.text) {
      html += `<p class="lk-note">Saved as <b lang="${d.lang}">${esc(e.base)}</b>, its dictionary form.</p>`;
    }
    if (state.explain) {
      html += '<div class="lk-sep"></div><div class="lk-ai">';
      html += `<p>${md(e.ex)}</p>`;
      if (e.warn) html += `<p class="lk-warn">⚠ ${md(e.warn)}</p>`;
      if (e.kind !== 'other') html += '<p class="lk-meta">Sample answer. In Captionary, the AI you connect writes this.</p>';
      html += '</div>';
    }
    html += '</div><span class="lk-arrow" aria-hidden="true"></span>';

    card.innerHTML = html;
    card.setAttribute('aria-label', `Look-up: ${e.text}`);
    card.hidden = false;
    if (animate) {
      card.classList.remove('is-in');
      void card.offsetWidth;
      card.classList.add('is-in');
    }
    place();
  }

  function setStatus(status) {
    const e = state.entry;
    const book = state.saved[state.lang];
    if (book[e.base]?.status === status) delete book[e.base];
    else book[e.base] = { status, range: e.range };
    paintLine();
    renderCard(false);
  }

  card.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || !state.entry) return;
    const act = btn.dataset.act;
    if (act === 'close') return close();
    if (act === 'save') return setStatus('learning');
    if (act === 'known') return setStatus('known');
    if (act === 'explain') {
      state.explain = !state.explain;
      return renderCard(false);
    }
    if (act === 'chunk' && state.entry.chunk) return open(state.entry.chunk.range, { fromChunk: true });
    if (act === 'speak' && canSpeak) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(state.entry.text);
      u.lang = DEMOS[state.lang].speech;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    }
  });

  // ---------- placing the card over the video ----------
  function place() {
    if (card.hidden || !state.sel) return;
    const docked = player.clientWidth < 640;
    demo.classList.toggle('is-docked', docked);
    if (docked) {
      card.style.left = card.style.top = '';
      card.style.removeProperty('--lk-max');
      return;
    }
    const box = demo.getBoundingClientRect();
    const frame = player.getBoundingClientRect();
    const picked = buttons.slice(state.sel[0], state.sel[1] + 1).map((b) => b.getBoundingClientRect());
    const top = Math.min(...picked.map((r) => r.top));
    const left = Math.min(...picked.map((r) => r.left));
    const right = Math.max(...picked.map((r) => r.right));
    const centre = (left + right) / 2;

    card.style.setProperty('--lk-max', `${Math.max(140, top - frame.top - 24)}px`);
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const minX = frame.left + 10;
    const maxX = frame.right - w - 10;
    const x = Math.min(Math.max(centre - w / 2, minX), maxX);
    card.style.left = `${x - box.left}px`;
    card.style.top = `${top - box.top - h - 12}px`;
    card.style.setProperty('--ax', `${Math.min(Math.max(centre - x, 18), w - 18)}px`);
  }

  if ('ResizeObserver' in window) new ResizeObserver(place).observe(player);
  else window.addEventListener('resize', place);
  if (document.fonts?.ready) document.fonts.ready.then(place);

  // ---------- selecting: click, drag, Shift+click ----------
  let anchor = null;
  let dragging = false;

  const wordAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const b = el && el.closest ? el.closest('.w') : null;
    return b && orig.contains(b) ? Number(b.dataset.i) : null;
  };

  orig.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('.w');
    if (!b || ev.button !== 0) return;
    ev.preventDefault();
    const i = Number(b.dataset.i);
    if (ev.shiftKey && state.sel && anchor !== null) {
      open([anchor, i]);
      return;
    }
    anchor = i;
    dragging = true;
    state.sel = [i, i];
    paintLine();
  });

  window.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const i = wordAt(ev.clientX, ev.clientY);
    if (i === null) return;
    state.sel = [Math.min(anchor, i), Math.max(anchor, i)];
    paintLine();
  });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    if (state.sel) open(state.sel);
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', () => {
    dragging = false;
  });

  // Keyboard: Enter or Space on a word looks it up; Shift+Enter stretches the selection to it.
  orig.addEventListener('click', (ev) => {
    if (ev.detail !== 0) return; // pointer clicks are handled above
    const b = ev.target.closest('.w');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (ev.shiftKey && state.sel && anchor !== null) open([anchor, i]);
    else {
      anchor = i;
      open([i, i]);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !card.hidden) close();
  });

  // ---------- language switch ----------
  const seg = document.querySelectorAll('.seg [data-lang]');
  seg.forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === state.lang) return;
      state.lang = btn.dataset.lang;
      seg.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      anchor = null;
      renderLine();
      start();
    }),
  );

  // Open on a word whose meaning changes inside a phrase, with the tutor's answer already in, so the
  // page shows the point before anyone clicks.
  function start() {
    const i = DEMOS[state.lang].start;
    anchor = i;
    open([i, i], { explain: true, quiet: true });
  }

  renderLine();
  start();
})();

/* UI wiring: input, keyboard navigation, highlighting. The algorithm is in search.js. */
(function () {
  'use strict';
  const { buildIndex, createSearcher } = window.Autocomplete;

  // data.js declares the dataset as a global; try the usual names.
  function loadDataset() {
    const getters = [() => data, () => countries, () => DATA, () => dataset, () => items, () => list];
    for (const get of getters) {
      try { const v = get(); if (Array.isArray(v) && v.length) return v; } catch (e) { /* not declared */ }
    }
    return [];
  }

  const items = loadDataset();
  const searcher = createSearcher(buildIndex(items), { limit: 10 });

  const input = document.getElementById('search');
  const list = document.getElementById('results');
  const status = document.getElementById('status');
  const picked = document.getElementById('picked');
  document.getElementById('meta').textContent = items.length
    ? items.length + ' entries loaded from data.js'
    : 'No dataset found: check that data.js declares an array';

  let current = [];
  let active = -1;

  function appendHighlighted(el, label, ranges) {
    let pos = 0;
    for (const [s, e] of ranges) {
      if (s > pos) el.append(label.slice(pos, s));
      const mark = document.createElement('mark');
      mark.textContent = label.slice(s, e);
      el.append(mark);
      pos = e;
    }
    if (pos < label.length) el.append(label.slice(pos));
  }

  function note(text, cls) {
    const li = document.createElement('li');
    li.className = cls;
    li.setAttribute('role', 'presentation');
    li.textContent = text;
    return li;
  }

  function open() { list.hidden = false; input.setAttribute('aria-expanded', 'true'); }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(i) {
    active = i;
    [...list.querySelectorAll('[role="option"]')].forEach((li, n) => {
      const on = n === i;
      li.classList.toggle('active', on);
      li.setAttribute('aria-selected', String(on));
      if (on) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    });
  }

  function render() {
    const raw = input.value;
    const { results, total } = searcher.search(raw);
    current = results;
    list.replaceChildren();
    if (!raw.trim()) { close(); status.textContent = ''; return; }

    results.forEach((r, i) => {
      const li = document.createElement('li');
      li.id = 'opt-' + i;
      li.dataset.index = i;
      li.setAttribute('role', 'option');
      appendHighlighted(li, r.label, r.ranges);
      list.append(li);
    });
    if (!results.length) list.append(note('No match for “' + raw.trim() + '”', 'empty'));
    else if (total > results.length) list.append(note('+ ' + (total - results.length) + ' more, keep typing', 'more'));

    status.textContent = total + (total === 1 ? ' result' : ' results');
    open();
    setActive(results.length ? 0 : -1);
  }

  function choose(i) {
    if (!current[i]) return;
    input.value = current[i].label;
    picked.textContent = 'Selected: ' + current[i].label;
    close();
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    const isOpen = !list.hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { render(); return; }
      if (!current.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((active + step + current.length) % current.length);
    } else if (e.key === 'Enter' && isOpen && active >= 0) {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      if (isOpen) close(); else input.value = '';
    }
  });

  // mousedown (not click) so the input keeps focus and blur doesn't close the list first
  list.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const li = e.target.closest('[role="option"]');
    if (li) choose(Number(li.dataset.index));
  });
  list.addEventListener('mousemove', (e) => {
    const li = e.target.closest('[role="option"]');
    if (li && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index));
  });

  document.querySelectorAll('[data-try]').forEach((btn) =>
    btn.addEventListener('click', () => { input.value = btn.dataset.try; input.focus(); render(); }));
})();

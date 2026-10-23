/* Auto-completion engine. No dependencies, no DOM.
 *
 * 1. normalize(): lowercase, strip accents, drop apostrophes, punctuation -> space.
 *    "Côte d'Ivoire" and "cote d'ivoire" both become "cote divoire".
 * 2. buildIndex(): normalizes every entry once, so a keystroke only does cheap string checks.
 * 3. createSearcher(): matches anywhere in the text (mid-word), ranks the matches, and
 *    narrows the search to the previous matches when the user keeps typing.
 */
(function (root) {
  'use strict';

  const SPECIAL = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };
  const APOSTROPHES = /['’‘ʼʹ`´]/;

  // Returns the normalized text and, for each normalized char, the index of the
  // original char it came from (used to highlight the original label).
  function normalize(text) {
    let norm = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (APOSTROPHES.test(ch)) continue;
      let n = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      n = SPECIAL[n] || n;
      for (const k of n) {
        const c = /[\p{L}\p{N}]/u.test(k) ? k : ' ';
        if (c === ' ' && (norm === '' || norm[norm.length - 1] === ' ')) continue; // collapse spaces
        norm += c;
        map.push(i);
      }
    }
    if (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop(); }
    return { norm, map };
  }

  function defaultLabel(item) {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      for (const k of ['name', 'label', 'title', 'country', 'city', 'value', 'text']) {
        if (typeof item[k] === 'string') return item[k];
      }
      const first = Object.values(item).find((v) => typeof v === 'string');
      if (first) return first;
    }
    return String(item == null ? '' : item);
  }

  function buildIndex(items, getLabel = defaultLabel) {
    const entries = [];
    items.forEach((item, id) => {
      const label = getLabel(item);
      const { norm, map } = normalize(label);
      if (norm) entries.push({ id, item, label, norm, map });
    });
    return entries;
  }

  // Lower rank = better. null = no match.
  //   0 exact | 1 starts with query | 2 a word starts with query | 3 query inside a word
  //   4 every word of the query appears somewhere (any order)
  function rank(norm, q, tokens) {
    const idx = norm.indexOf(q);
    if (idx !== -1) {
      if (norm === q) return { rank: 0, pos: 0 };
      if (idx === 0) return { rank: 1, pos: 0 };
      if (norm[idx - 1] === ' ') return { rank: 2, pos: idx };
      return { rank: 3, pos: idx };
    }
    if (tokens.length > 1) {
      for (const t of tokens) if (!norm.includes(t)) return null;
      return { rank: 4, pos: 0 };
    }
    return null;
  }

  // Ranges [start, end) in the ORIGINAL label to highlight.
  function findRanges(entry, q, tokens) {
    const parts = entry.norm.includes(q)
      ? [[entry.norm.indexOf(q), q.length]]
      : tokens.map((t) => [entry.norm.indexOf(t), t.length]);
    const out = parts
      .filter(([s]) => s >= 0)
      .map(([s, len]) => [entry.map[s], entry.map[s + len - 1] + 1])
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of out) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    return merged;
  }

  function createSearcher(entries, { limit = 10 } = {}) {
    let prevQuery = '';
    let prevMatches = entries;

    function search(rawQuery) {
      const q = normalize(rawQuery).norm;
      if (!q) { prevQuery = ''; prevMatches = entries; return { query: '', total: 0, results: [] }; }
      const tokens = q.split(' ');

      // Typing more characters can only remove matches, so search the previous matches only.
      const pool = prevQuery && q.startsWith(prevQuery) ? prevMatches : entries;

      const matches = [];
      for (const entry of pool) {
        const r = rank(entry.norm, q, tokens);
        if (r) matches.push({ entry, rank: r.rank, pos: r.pos });
      }
      prevQuery = q;
      prevMatches = matches.map((m) => m.entry);

      matches.sort((a, b) =>
        a.rank - b.rank || a.pos - b.pos ||
        a.entry.norm.length - b.entry.norm.length ||
        (a.entry.norm < b.entry.norm ? -1 : 1));

      const results = matches.slice(0, limit).map((m) => ({
        id: m.entry.id,
        item: m.entry.item,
        label: m.entry.label,
        ranges: findRanges(m.entry, q, tokens),
      }));
      return { query: q, total: matches.length, results };
    }
    return { search };
  }

  const api = { normalize, buildIndex, createSearcher };
  root.Autocomplete = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==========================================================================
   The two write-only feeds.

   history — the Claude Code transcript: your prompts and what came of them.
   log     — the event log: incidents, purchases, notes. Never per-feature
             lines; agent output is a running count in the UI instead.
   ========================================================================== */

import { state, esc, $ } from './state.js';

const EMPTY_HISTORY = 'No history yet. Type <b>/ship</b> and press Enter.';

export function histPrompt(text) {
  const el = $('history');
  const empty = el.querySelector('.h-empty');
  if (empty) empty.remove();

  const you = document.createElement('div');
  you.className = 'h-you';
  you.innerHTML = '<span class="c">&gt;</span>' + esc(text);

  const res = document.createElement('div');
  res.className = 'h-res pending';
  res.textContent = 'working…';

  el.append(you, res);
  while (el.children.length > 120) el.firstChild.remove();
  el.scrollTop = el.scrollHeight;
  return res;
}

export function histPending(el, text) {
  if (!el) return;
  el.className = 'h-res pending';
  el.textContent = text;
  $('history').scrollTop = $('history').scrollHeight;
}

export function histResolve(el, html) {
  if (!el) return;
  el.className = 'h-res';
  el.innerHTML = html;
  $('history').scrollTop = $('history').scrollHeight;
}

export function clearHistory() {
  $('history').innerHTML = '<div class="h-empty">' + EMPTY_HISTORY + '</div>';
}

export function log(msg, cls) {
  const el = $('log');
  const d = document.createElement('div');
  const mm = String(Math.floor(state.elapsed / 60)).padStart(2, '0');
  const ss = String(Math.floor(state.elapsed % 60)).padStart(2, '0');
  d.className = cls || '';
  d.innerHTML = '<span class="t">' + mm + ':' + ss + '</span>' + msg;
  el.prepend(d);
  while (el.children.length > 80) el.lastChild.remove();
}

export function clearLog() { $('log').innerHTML = ''; }

export function flash(cls) {
  document.body.classList.remove(cls);
  void document.body.offsetWidth;   // restart the CSS animation
  document.body.classList.add(cls);
}

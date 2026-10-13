/**
 * Inline quiz editing on the SHOW view.
 *
 * The per-question edit button (`.quiz-edit-inline-button`) opens
 * `#modal-edit-quiz-inline` right on the same page (no navigation to /edit).
 * Supports manual edits and natural-language AI edits (reuses
 * `/api/tests/edit-quiz-ai`), and saves via `/api/tests/update-quizzes`, then
 * refreshes the page content via AJAX.
 *
 * Uses a single document-level click listener (event delegation) so it keeps
 * working after AJAX content replacements. Relies on `window.__showQuizData`,
 * which the show view re-injects on every render.
 */
window.InlineQuizEdit = (function () {
  'use strict';

  let currentQuizId = null;

  function el(id) { return document.getElementById(id); }

  function open(quizId) {
    const data = window.__showQuizData;
    if (!data) return;
    const quiz = (data.quizzes || []).find((q) => String(q.id) === String(quizId));
    if (!quiz) return;
    currentQuizId = quizId;

    el('inline-q-question').value = quiz.question || '';
    for (let i = 1; i <= 5; i++) {
      el('inline-q-opt' + i).value = quiz['opt' + i] || '';
      el('inline-q-correct-' + i).checked = String(quiz.correct_opts || '')
        .split(',').map((s) => s.trim()).includes(String(i));
    }
    let exp = quiz.opt6 || '';
    if (exp.startsWith('[Exp]')) exp = exp.slice(5).trim();
    el('inline-q-exp').value = exp;

    el('inline-ai-edit-instruction').value = '';
    el('inline-ai-edit-status').textContent = '';
    el('inline-edit-title').textContent = (quiz.number ? 'Edit question ' + quiz.number : 'Edit question');

    const modal = el('modal-edit-quiz-inline');
    if (modal) modal.classList.add('is-active');
  }

  function close() {
    const modal = el('modal-edit-quiz-inline');
    if (modal) modal.classList.remove('is-active');
    currentQuizId = null;
  }

  function collect() {
    const opts = {};
    for (let i = 1; i <= 5; i++) opts['opt' + i] = (el('inline-q-opt' + i).value || '').trim();
    const correct = [];
    for (let i = 1; i <= 5; i++) if (el('inline-q-correct-' + i).checked) correct.push(i);
    const exp = (el('inline-q-exp').value || '').trim();
    return {
      question: (el('inline-q-question').value || '').trim(),
      opt1: opts.opt1, opt2: opts.opt2, opt3: opts.opt3, opt4: opts.opt4, opt5: opts.opt5,
      opt6: exp ? '[Exp] ' + exp : '',
      correct_opts: correct.join(','),
    };
  }

  function applyToModal(quiz) {
    el('inline-q-question').value = quiz.question || '';
    for (let i = 1; i <= 5; i++) el('inline-q-opt' + i).value = quiz['opt' + i] || '';
    const correct = String(quiz.correct_opts || '').split(',').map((s) => s.trim());
    for (let i = 1; i <= 5; i++) el('inline-q-correct-' + i).checked = correct.includes(String(i));
    let exp = quiz.opt6 || '';
    if (exp.startsWith('[Exp]')) exp = exp.slice(5).trim();
    el('inline-q-exp').value = exp;
  }

  async function aiApply() {
    if (!currentQuizId) return;
    const data = window.__showQuizData;
    const instruction = (el('inline-ai-edit-instruction').value || '').trim();
    const status = el('inline-ai-edit-status');
    if (!instruction) {
      if (status) status.textContent = 'Write an instruction first.';
      return;
    }
    if (status) status.textContent = 'Thinking...';
    try {
      const res = await fetch('/api/tests/edit-quiz-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: data.testId,
          quizId: currentQuizId,
          instruction,
          quiz: collect(),
        }),
      });
      const json = await res.json();
      if (json.success && json.quiz) {
        applyToModal(json.quiz);
        const tokensMsg = typeof json.tokensUsed === 'number' ? ` (used ${json.tokensUsed.toLocaleString()} tokens)` : '';
        if (status) status.textContent = 'AI edit applied — review and save.' + tokensMsg;
      } else {
        if (status) status.textContent = json.error || 'AI edit failed.';
      }
    } catch (e) {
      if (status) status.textContent = 'AI edit failed: ' + e.message;
    }
  }

  async function save() {
    if (!currentQuizId) return;
    const data = window.__showQuizData;
    const quiz = (data.quizzes || []).find((q) => String(q.id) === String(currentQuizId));
    if (!quiz) return;
    const current = collect();
    const payload = {
      id: currentQuizId,
      number: quiz.number,
      prevNumber: quiz.number,
      question: current.question,
      correct_opts: current.correct_opts,
      opt1: current.opt1, opt2: current.opt2, opt3: current.opt3, opt4: current.opt4,
      opt5: current.opt5, opt6: current.opt6,
      image_url: quiz.image_url || '',
    };
    const saveBtn = el('inline-edit-save');
    if (saveBtn) saveBtn.disabled = true;
    try {
      const res = await fetch('/api/tests/update-quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newQuizzesIds: [],
          changedQuizzesIds: [currentQuizId],
          deletedQuizzesIds: [],
          test: { id: data.testId, userId: data.userId, quizzes: [payload] },
        }),
      });
      const json = await res.json();
      if (json.success) {
        close();
        if (typeof fetchBodyContent === 'function') fetchBodyContent(window.location.href);
        else window.location.reload();
      } else {
        alert(json.error || 'Could not save question');
        if (saveBtn) saveBtn.disabled = false;
      }
    } catch (e) {
      alert('Could not save question: ' + e.message);
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function init() {
    if (window.__InlineQuizEditInit) return;
    window.__InlineQuizEditInit = true;

    // Event delegation — survives AJAX content replacements
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('.quiz-edit-inline-button');
      if (openBtn) {
        e.preventDefault();
        e.stopPropagation();
        open(openBtn.dataset.quizId);
        return;
      }
      if (e.target.closest('#inline-ai-edit-button')) { aiApply(); return; }
      if (e.target.closest('#inline-edit-save')) { save(); return; }
      if (e.target.closest('[data-inline-edit-close]')) { close(); return; }
      if (e.target.closest('#modal-edit-quiz-inline .modal-background')) { close(); return; }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'inline-ai-edit-instruction') {
        e.preventDefault();
        aiApply();
      }
      if (e.key === 'Escape') close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init };
})();

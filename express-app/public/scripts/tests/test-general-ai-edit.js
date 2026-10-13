/**
 * General (whole-test/deck) AI Edit
 * Freeform instruction box: "add 2 more questions about X" / "add 2 more cards about X",
 * "remove question 3" / "remove card 3", "change the description"...
 * Flow: Generate (preview a diff, nothing saved yet) -> review -> Apply/Discard.
 *
 * Loaded once, globally (a `.general-ai-edit-box` can live either inline in test
 * show/edit pages, which get swapped via AJAX navigation, or statically inside the
 * shared "Edit test details" modal, which never gets swapped). Event delegation is
 * used throughout so this works for both without needing to rebind on navigation.
 */

(function () {
  'use strict';

  if (window.__generalAiEditDelegationBound) return;
  window.__generalAiEditDelegationBound = true;

  // Per-box state, keyed by the box element itself
  const state = new WeakMap();

  function getState(box) {
    if (!state.has(box)) state.set(box, { diff: null, testType: null });
    return state.get(box);
  }

  function setStatus(box, message, color) {
    const el = box.querySelector('.general-ai-edit-status');
    if (!el) return;
    el.innerHTML = message ? `<span class="has-text-${color || 'info'}">${message}</span>` : '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  // Build a compact HTML preview of a proposed diff for the review panel
  function renderChanges(box, diff, testType) {
    const changesEl = box.querySelector('.general-ai-edit-changes');
    if (!changesEl) return;

    const parts = [];
    const added = diff.added || [];
    const updated = diff.updated || [];
    const removedIds = diff.removedIds || [];
    const testUpdates = diff.testUpdates || {};

    if (added.length) {
      const label = testType === 'flashcards' ? 'front' : 'question';
      parts.push(`<p><b>+ ${added.length} added:</b></p><ul>` +
        added.map((item) => `<li>${escapeHtml(item[label] || item.front || item.question || '')}</li>`).join('') +
        '</ul>');
    }
    if (updated.length) {
      parts.push(`<p><b>~ ${updated.length} updated</b></p>`);
    }
    if (removedIds.length) {
      parts.push(`<p><b>&minus; ${removedIds.length} removed</b></p>`);
    }
    const metaChanged = ['name', 'topic', 'desc'].filter((k) => testUpdates[k]);
    if (metaChanged.length) {
      parts.push(`<p><b>Details changed:</b> ${metaChanged.join(', ')}</p>`);
    }
    if (!parts.length) {
      parts.push('<p><i>No changes proposed.</i></p>');
    }

    changesEl.innerHTML = parts.join('');
  }

  async function generate(box) {
    const testId = box.dataset.testId;
    const testType = box.dataset.testType;
    const input = box.querySelector('.general-ai-edit-instruction');
    const instruction = (input && input.value || '').trim();
    const applyBtn = box.querySelector('.general-ai-edit-apply');
    const reviewEl = box.querySelector('.general-ai-edit-review');

    if (!testId) {
      // Should never happen (the box's data-test-id is set before it can be shown),
      // but never fail silently - a no-op click with zero feedback looks like a
      // broken button rather than a real, debuggable error.
      setStatus(box, 'Could not find which test to edit - please close and reopen this dialog.', 'danger');
      return;
    }
    if (!instruction) {
      setStatus(box, 'Please describe the edit you want...', 'danger');
      return;
    }

    if (reviewEl) reviewEl.classList.add('is-hidden');
    if (applyBtn) applyBtn.disabled = true;
    setStatus(box, 'Thinking...', 'info');

    try {
      const response = await window.wsBrowserAI.fetch('/api/tests/edit-test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, instruction })
      });
      const data = await response.json();

      if (!data.success) throw new Error(data.error || 'AI edit failed');

      const st = getState(box);
      st.diff = data.diff;
      st.testType = data.testType || testType;

      const summaryEl = box.querySelector('.general-ai-edit-summary');
      if (summaryEl) summaryEl.textContent = data.summary || '';
      renderChanges(box, data.diff, st.testType);
      if (reviewEl) reviewEl.classList.remove('is-hidden');

      const tokensMsg = typeof data.tokensUsed === 'number' ? ` (used ${data.tokensUsed.toLocaleString()} tokens)` : '';
      setStatus(box, `Proposal ready. Review and apply below.${tokensMsg}`, 'success');
    } catch (error) {
      console.error('General AI edit error:', error);
      setStatus(box, 'AI edit failed: ' + error.message, 'danger');
    } finally {
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  async function apply(box) {
    const testId = box.dataset.testId;
    const st = getState(box);
    if (!st.diff) return;

    const confirmBtn = box.querySelector('.general-ai-edit-confirm');
    if (confirmBtn) confirmBtn.disabled = true;
    setStatus(box, 'Applying changes...', 'info');

    try {
      const response = await fetch('/api/tests/apply-test-edit-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId, diff: st.diff })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Could not apply changes');

      st.diff = null;

      // If this box lives inside the shared edit-test-details modal, close it first
      const modal = box.closest('.modal');
      if (modal && typeof closeModal === 'function') closeModal(modal);

      if (typeof fetchBodyContent === 'function') {
        fetchBodyContent(window.location.pathname);
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Apply general AI edit error:', error);
      setStatus(box, 'Could not apply changes: ' + error.message, 'danger');
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  function discard(box) {
    const st = getState(box);
    st.diff = null;
    const reviewEl = box.querySelector('.general-ai-edit-review');
    if (reviewEl) reviewEl.classList.add('is-hidden');
    setStatus(box, '');
  }

  // Reset a box back to its initial state (used when the shared modal opens for a
  // possibly different test - see openEditTestModal in general-actions.js)
  window.resetGeneralAiEditBox = function (box) {
    if (!box) return;
    const st = getState(box);
    st.diff = null;
    const input = box.querySelector('.general-ai-edit-instruction');
    if (input) input.value = '';
    const reviewEl = box.querySelector('.general-ai-edit-review');
    if (reviewEl) reviewEl.classList.add('is-hidden');
    setStatus(box, '');
  };

  document.addEventListener('click', (e) => {
    const applyBtn = e.target.closest('.general-ai-edit-apply');
    if (applyBtn) {
      const box = applyBtn.closest('.general-ai-edit-box');
      if (box) generate(box);
      return;
    }
    const confirmBtn = e.target.closest('.general-ai-edit-confirm');
    if (confirmBtn) {
      const box = confirmBtn.closest('.general-ai-edit-box');
      if (box) apply(box);
      return;
    }
    const discardBtn = e.target.closest('.general-ai-edit-discard');
    if (discardBtn) {
      const box = discardBtn.closest('.general-ai-edit-box');
      if (box) discard(box);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('.general-ai-edit-instruction');
    if (!input) return;
    e.preventDefault();
    const box = input.closest('.general-ai-edit-box');
    if (box) generate(box);
  });
})();

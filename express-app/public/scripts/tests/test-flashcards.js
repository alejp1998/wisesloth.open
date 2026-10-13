/**
 * Flashcards Study Module
 * Flip-card study view with quiz-style navigation:
 *  - numbered card links (same look as quiz questions)
 *  - prev / next / flip / shuffle controls
 *  - focused (expanded) fullscreen study mode
 *  - "make a test from these cards" (prefills the notes form)
 */

(function () {
  'use strict';

  // ============================================
  // STATE
  // ============================================
  const state = {
    cards: [],
    order: [],      // shuffled order of card indexes
    index: 0,
    flipped: false
  };

  // ============================================
  // DOM HELPERS
  // ============================================
  const DOM = {
    get: (id) => document.getElementById(id),
    getAll: (selector) => document.querySelectorAll(selector)
  };

  // ============================================
  // DATA (read from the `flashcards` global set by the page init script,
  // re-read on every init so AJAX re-navigations pick up fresh data)
  // ============================================
  function readData() {
    if (typeof flashcards === 'undefined' || !Array.isArray(flashcards)) return [];
    return flashcards.map((fc) => ({ id: fc.id, front: fc.front || '', back: fc.back || '' }));
  }

  // ============================================
  // RENDERING
  // ============================================
  function currentCard() {
    if (!state.order.length) return null;
    return state.cards[state.order[state.index]];
  }

  function renderCard() {
    const card = currentCard();
    const frontEl = DOM.get('flashcard-front-text');
    const backEl = DOM.get('flashcard-back-text');
    const counterEl = DOM.get('flashcard-counter');

    if (!card) {
      if (frontEl) frontEl.textContent = '';
      if (backEl) backEl.textContent = '';
      if (counterEl) counterEl.textContent = '0 / 0';
      return;
    }

    if (frontEl) frontEl.textContent = card.front || '';
    if (backEl) backEl.textContent = card.back || '';
    if (counterEl) counterEl.textContent = `${state.index + 1} / ${state.order.length}`;
  }

  // Render the numbered card links (kept in sync with the current display order)
  function renderLinks() {
    const container = DOM.get('flashcard-links');
    if (!container) return;
    if (!state.order.length) {
      container.innerHTML = '';
      return;
    }
    const fragment = document.createDocumentFragment();
    state.order.forEach((cardIndex, i) => {
      const link = document.createElement('div');
      link.className = 'flex-item-quiz-link flashcard-link';
      link.dataset.index = i;
      link.dataset.cardIndex = cardIndex;
      link.title = state.cards[cardIndex].front || `Card ${i + 1}`;
      link.textContent = i + 1;
      if (i === state.index) link.classList.add('is-active');
      fragment.appendChild(link);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
  }

  // Highlight the active link (used after direct navigation)
  function highlightActiveLink() {
    const links = DOM.getAll('#flashcard-links .flashcard-link');
    links.forEach((link) => {
      link.classList.toggle('is-active', Number(link.dataset.index) === state.index);
    });
  }

  function setFlipped(flipped) {
    state.flipped = flipped;
    const flashcardEl = DOM.get('flashcard');
    if (flashcardEl) flashcardEl.classList.toggle('flipped', flipped);
  }

  // ============================================
  // ACTIONS
  // ============================================
  function flip() {
    if (!state.order.length) return;
    setFlipped(!state.flipped);
  }

  function next() {
    if (!state.order.length) return;
    state.index = (state.index + 1) % state.order.length;
    setFlipped(false);
    renderCard();
    highlightActiveLink();
  }

  function prev() {
    if (!state.order.length) return;
    state.index = (state.index - 1 + state.order.length) % state.order.length;
    setFlipped(false);
    renderCard();
    highlightActiveLink();
  }

  function shuffle() {
    if (state.cards.length < 2) return;
    const indexes = state.cards.map((_, i) => i);
    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    state.order = indexes;
    state.index = 0;
    setFlipped(false);
    renderCard();
    renderLinks();
  }

  function goTo(index) {
    if (!state.order.length) return;
    if (index < 0 || index >= state.order.length) return;
    state.index = index;
    setFlipped(false);
    renderCard();
    highlightActiveLink();
  }

  // ============================================
  // FOCUSED (EXPANDED) MODE
  // ============================================
  let focusedOverlay = null;
  let deckHome = null; // { parent, nextSibling } where the deck lives normally

  function enterFocusedMode() {
    const deck = DOM.get('flashcard-deck');
    if (!deck || focusedOverlay) return;

    deckHome = { parent: deck.parentNode, nextSibling: deck.nextSibling };

    const overlay = document.createElement('div');
    overlay.className = 'flashcard-focused-overlay';
    overlay.id = 'flashcard-focused-overlay';

    const head = document.createElement('div');
    head.className = 'flashcard-focused-head';

    const title = document.createElement('span');
    title.className = 'flashcard-focused-title';
    title.innerHTML = '<span lang="en">Focused study</span><span lang="es">Estudio enfocado</span>';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'button is-light is-small is-rounded';
    closeBtn.id = 'flashcard-focused-close';
    closeBtn.title = 'Exit focused mode (Esc)';
    closeBtn.innerHTML = '<span class="icon is-small"><i class="fas fa-compress"></i></span>';

    head.appendChild(title);
    head.appendChild(closeBtn);
    overlay.appendChild(head);
    overlay.appendChild(deck);

    document.body.appendChild(overlay);
    document.body.classList.add('flashcard-focused');
    focusedOverlay = overlay;

    overlay.onclick = (e) => {
      if (e.target === overlay || e.target.closest('#flashcard-focused-close')) {
        exitFocusedMode();
      }
    };
  }

  function exitFocusedMode() {
    if (!focusedOverlay || !deckHome) return;
    const deck = DOM.get('flashcard-deck');
    if (deck && deckHome.parent) {
      deckHome.parent.insertBefore(deck, deckHome.nextSibling);
    }
    focusedOverlay.remove();
    focusedOverlay = null;
    deckHome = null;
    document.body.classList.remove('flashcard-focused');
  }

  // ============================================
  // MAKE A TEST FROM THESE CARDS
  // ============================================
  function makeTestFromCards() {
    if (state.cards.length) {
      const text = state.cards
        .map((card, i) => `Q${i + 1}: ${card.front}\nA${i + 1}: ${card.back}`)
        .join('\n\n');
      try {
        sessionStorage.setItem('wisesloth_flashcards_to_notes', JSON.stringify({ text }));
      } catch (e) {
        // sessionStorage unavailable - fall through to plain navigation
      }
    }
    if (typeof fetchBodyContent === 'function') fetchBodyContent('/tests/new?type=notes');
    else window.location.href = '/tests/new?type=notes';
  }

  // ============================================
  // BINDING
  // ============================================
  function bindControls() {
    const flashcardEl = DOM.get('flashcard');
    if (flashcardEl) {
      flashcardEl.onclick = (e) => {
        // Ignore clicks on the control buttons themselves
        if (e.target.closest('.flashcard-controls')) return;
        flip();
      };
    }

    const flipBtn = DOM.get('flashcard-flip');
    if (flipBtn) flipBtn.onclick = flip;

    const nextBtn = DOM.get('flashcard-next');
    if (nextBtn) nextBtn.onclick = next;

    const prevBtn = DOM.get('flashcard-prev');
    if (prevBtn) prevBtn.onclick = prev;

    const shuffleBtn = DOM.get('flashcard-shuffle');
    if (shuffleBtn) shuffleBtn.onclick = shuffle;

    const editCurrentBtn = DOM.get('flashcard-edit-current');
    if (editCurrentBtn) {
      editCurrentBtn.onclick = () => {
        const card = currentCard();
        if (card && typeof FlashcardsEditor !== 'undefined' && FlashcardsEditor.openSingleCard) {
          FlashcardsEditor.openSingleCard(card.id);
        }
      };
    }

    const expandBtn = DOM.get('flashcard-expand');
    if (expandBtn) expandBtn.onclick = enterFocusedMode;

    // Delegate clicks on the numbered card links (they are rebuilt on shuffle)
    const linksContainer = DOM.get('flashcard-links');
    if (linksContainer) {
      linksContainer.onclick = (e) => {
        const link = e.target.closest('.flashcard-link');
        if (!link) return;
        goTo(Number(link.dataset.index));
      };
    }

    const makeTestBtn = DOM.get('make-test-from-cards-button');
    if (makeTestBtn) makeTestBtn.onclick = makeTestFromCards;
  }

  function bindKeyboard() {
    document.removeEventListener('keydown', handleKeydown);
    document.addEventListener('keydown', handleKeydown);
  }

  function handleKeydown(e) {
    // Only handle keys when the flashcards deck is present and visible
    if (!DOM.get('flashcard-deck')) return;
    // Don't hijack keys while typing in an input
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape' && focusedOverlay) {
      e.preventDefault();
      exitFocusedMode();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === ' ') {
      e.preventDefault();
      flip();
    }
  }

  // ============================================
  // INIT
  // ============================================
  window.initFlashcardsView = function () {
    state.cards = readData();
    if (!state.cards.length) {
      // Still bind so re-visits work even if data is missing
      bindControls();
      return;
    }
    // Preserve existing shuffle order across re-inits, but reset index safely
    if (state.order.length !== state.cards.length) {
      state.order = state.cards.map((_, i) => i);
    }
    state.index = Math.min(state.index, state.order.length - 1);
    setFlipped(false);
    renderCard();
    renderLinks();
    bindControls();
    bindKeyboard();
  };

  // Initial run (full page load; on AJAX nav the handleCurrentState hook calls initFlashcardsView)
  if (document.readyState === 'complete') {
    if (typeof window.initFlashcardsView === 'function') window.initFlashcardsView();
  } else {
    document.addEventListener('DOMContentLoaded', () => window.initFlashcardsView());
  }
})();

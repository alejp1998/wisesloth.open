/**
 * Flashcards Editor Module
 * Handles editing flashcards: front/back textareas, add/delete cards,
 * save (batch upsert), and AI-editing individual cards.
 */

const FlashcardsEditor = (function () {
  'use strict';

  // ============================================
  // CONFIGURATION & CONSTANTS
  // ============================================
  const CONFIG = {
    API_ENDPOINT: '/api/tests/update-flashcards',
    AI_API_ENDPOINT: '/api/tests/edit-flashcard-ai'
  };

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const state = {
    test: null,
    cards: [],
    deletedIds: [],
    unsavedChanges: false,
    localLang: 'en',
    aiTargetId: null,
    singleCardId: null
  };

  // ============================================
  // DOM HELPERS
  // ============================================
  const DOM = {
    get: (id) => document.getElementById(id),
    getAll: (selector) => document.querySelectorAll(selector),
    show: (el) => el && el.classList.remove('is-hidden'),
    hide: (el) => el && el.classList.add('is-hidden'),
    enable: (el) => el && (el.disabled = false),
    disable: (el) => el && (el.disabled = true)
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const Utils = {
    generateUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    getText: (key) => {
      const texts = {
        savedTitle: { en: 'Changes saved successfully!', es: '¡Cambios guardados con éxito!' },
        savedText: { en: 'Continue editing or view the flashcards.', es: 'Continúa editando o mira las tarjetas.' },
        cancelTitle: { en: 'Are you sure you want to cancel?', es: '¿Estás seguro de que deseas cancelar?' },
        cancelText: { en: 'You will lose any unsaved changes.', es: 'Perderás cualquier cambio no guardado.' },
        confirmYes: { en: 'Yes, cancel', es: 'Sí, cancelar' },
        confirmNo: { en: 'No, continue', es: 'No, continuar' },
        ok: { en: 'OK!', es: '¡OK!' },
        deleteConfirmPrefix: { en: 'Sure you want to delete flashcard "', es: 'Seguro que deseas eliminar la tarjeta "' },
        deleteConfirmSuffix: { en: '"? Once you save changes, this action cannot be undone.', es: '"? Una vez guardados los cambios, esta acción no se puede deshacer.' },
        noCards: { en: 'You must have at least one flashcard to save', es: 'Debes tener al menos una tarjeta para guardar' },
        noCardsText: { en: 'Add a flashcard and try again.', es: 'Añade una tarjeta e intenta de nuevo.' },
        fillFrontBack: { en: 'Both front and back must have a value.', es: 'Tanto el frente como el reverso deben tener un valor.' },
        errorTitle: { en: 'There was an error saving your changes', es: 'Hubo un error al guardar tus cambios' },
        errorText: { en: 'Check that every card has a front and a back.', es: 'Verifica que cada tarjeta tenga un frente y un reverso.' },
        editWithAI: { en: 'Edit with AI', es: 'Editar con IA' }
      };
      return texts[key]?.[state.localLang] || texts[key]?.en || '';
    }
  };

  // ============================================
  // CARD DOM HELPERS
  // ============================================
  const CardDOM = {
    getCardEl: (id) => DOM.get(`flashcard-${id}`),
    getFront: (id) => CardDOM.getCardEl(id)?.querySelector('.flashcard-front-input')?.value || '',
    getBack: (id) => CardDOM.getCardEl(id)?.querySelector('.flashcard-back-input')?.value || '',
    setFront: (id, value) => {
      const input = CardDOM.getCardEl(id)?.querySelector('.flashcard-front-input');
      if (input) input.value = value;
    },
    setBack: (id, value) => {
      const input = CardDOM.getCardEl(id)?.querySelector('.flashcard-back-input');
      if (input) input.value = value;
    },
    setNumber: (id, number) => {
      const numEl = CardDOM.getCardEl(id)?.querySelector('.flashcard-number');
      if (numEl) numEl.textContent = number;
    },
    remove: (id) => CardDOM.getCardEl(id)?.remove()
  };

  // Rebuild the cards array from the current DOM (source of truth)
  function readCardsFromDOM() {
    const cards = [];
    const els = DOM.getAll('.flashcard-edit-card');
    els.forEach((el) => {
      // Skip the hidden clone template (used only as a source for new cards)
      if (el.closest('#flashcard-edit-example')) return;
      const id = el.dataset.id;
      cards.push({
        id,
        number: cards.length + 1,
        front: el.querySelector('.flashcard-front-input')?.value || '',
        back: el.querySelector('.flashcard-back-input')?.value || ''
      });
    });
    return cards;
  }

  // Renumber all visible card tags from the DOM order
  function renumberCards() {
    const els = DOM.getAll('.flashcard-edit-card');
    els.forEach((el, index) => {
      const numEl = el.querySelector('.flashcard-number');
      if (numEl) numEl.textContent = index + 1;
    });
  }

  // ============================================
  // SAVE & CANCEL MODULE
  // ============================================
  const SaveCancel = {
    saveChanges: async (view = false) => {
      const cards = readCardsFromDOM();

      if (cards.length === 0) {
        Swal.fire({
          title: Utils.getText('noCards'),
          text: Utils.getText('noCardsText'),
          icon: 'warning',
          confirmButtonText: Utils.getText('ok')
        });
        return;
      }

      // Validate each card has front and back
      for (const card of cards) {
        if (!card.front.trim() || !card.back.trim()) {
          Swal.fire({
            title: Utils.getText('fillFrontBack'),
            icon: 'warning',
            confirmButtonText: Utils.getText('ok')
          });
          return;
        }
      }

      try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId: state.test.id,
            cards,
            deletedIds: state.deletedIds
          })
        });

        const data = await response.json();

        if (!data.success) {
          Swal.fire({
            title: Utils.getText('errorTitle'),
            text: data.error || Utils.getText('errorText'),
            icon: 'error',
            confirmButtonText: Utils.getText('ok')
          });
          return;
        }

        state.deletedIds = [];
        state.unsavedChanges = false;

        if (view) {
          fetchBodyContent(`/tests/${state.test.id}`);
          return;
        }

        Swal.fire({
          title: Utils.getText('savedTitle'),
          text: Utils.getText('savedText'),
          icon: 'success',
          confirmButtonText: Utils.getText('ok')
        });
      } catch (error) {
        console.error('Error saving flashcards:', error);
        Swal.fire({
          title: Utils.getText('errorTitle'),
          text: Utils.getText('errorText'),
          icon: 'error',
          confirmButtonText: Utils.getText('ok')
        });
      }
    },

    handleCancel: () => {
      Swal.fire({
        title: Utils.getText('cancelTitle'),
        text: Utils.getText('cancelText'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: Utils.getText('confirmYes'),
        cancelButtonText: Utils.getText('confirmNo'),
        reverseButtons: true
      }).then((result) => {
        if (result.isConfirmed) {
          fetchBodyContent(`/tests/${state.test.id}`);
        }
      });
    }
  };

  // ============================================
  // CARD OPERATIONS MODULE
  // ============================================
  const CardOps = {
    addCard: () => {
      const newId = Utils.generateUUID();
      const template = DOM.get('flashcard-edit-example');
      if (!template) return;

      const newCardEl = template.cloneNode(true);
      newCardEl.classList.remove('is-hidden');
      newCardEl.id = `flashcard-${newId}`;
      newCardEl.dataset.id = newId;
      newCardEl.dataset.number = '1';

      // Clear inputs
      newCardEl.querySelector('.flashcard-front-input').value = '';
      newCardEl.querySelector('.flashcard-back-input').value = '';

      // Bind buttons
      const aiButton = newCardEl.querySelector('.flashcard-ai-edit-button');
      aiButton.dataset.id = newId;
      aiButton.onclick = () => AISection.open(newId);

      const deleteButton = newCardEl.querySelector('.flashcard-delete-button');
      deleteButton.dataset.id = newId;
      deleteButton.onclick = () => CardOps.deleteCard(newId);

      DOM.get('flashcards-els').appendChild(newCardEl);
      renumberCards();
      state.unsavedChanges = true;
    },

    deleteCard: async (id) => {
      const cardEl = CardDOM.getCardEl(id);
      if (!cardEl) return;
      const front = CardDOM.getFront(id) || 'Untitled';
      const confirmMessage = `${Utils.getText('deleteConfirmPrefix')}${front}${Utils.getText('deleteConfirmSuffix')}`;

      const userConfirmed = await showSweetConfirm(confirmMessage);
      if (userConfirmed) {
        CardDOM.remove(id);
        if (!state.deletedIds.includes(id)) state.deletedIds.push(id);
        renumberCards();
        state.unsavedChanges = true;
      }
    }
  };

  // ============================================
  // AI EDIT MODULE
  // ============================================
  const AISection = {
    open: (id) => {
      state.aiTargetId = id;
      const modal = DOM.get('modal-ai-edit-flashcard');
      if (!modal) return;
      const instruction = DOM.get('flashcard-ai-instruction');
      if (instruction) instruction.value = '';
      AISection.status('');
      DOM.show(modal);
      modal.classList.add('is-active');
      if (instruction) instruction.focus();
    },

    close: () => {
      const modal = DOM.get('modal-ai-edit-flashcard');
      if (modal) modal.classList.remove('is-active');
      state.aiTargetId = null;
    },

    status: (message, color = 'info') => {
      const statusEl = DOM.get('flashcard-ai-status');
      if (statusEl) {
        if (message) {
          DOM.show(statusEl);
          statusEl.innerHTML = `<p class="has-text-${color}">${message}</p>`;
        } else {
          statusEl.innerHTML = '';
          DOM.hide(statusEl);
        }
      }
    },

    run: async () => {
      const id = state.aiTargetId;
      if (!id) return;

      const instruction = (DOM.get('flashcard-ai-instruction')?.value || '').trim();
      if (!instruction) {
        AISection.status(
          state.localLang === 'es' ? 'Describe el cambio que quieres...' : 'Please describe the edit you want...',
          'danger'
        );
        return;
      }

      const applyButton = DOM.get('flashcard-ai-apply-button');
      DOM.disable(applyButton);
      AISection.status(
        state.localLang === 'es' ? 'Editando con IA...' : 'Editing with AI...',
        'info'
      );

      try {
        const response = await window.wsBrowserAI.fetch(CONFIG.AI_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId: state.test.id,
            flashcardId: id,
            instruction,
            front: CardDOM.getFront(id),
            back: CardDOM.getBack(id)
          })
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.error || 'AI edit failed');

        // Fill the card fields with the AI result (review before saving)
        CardDOM.setFront(id, data.flashcard.front || '');
        CardDOM.setBack(id, data.flashcard.back || '');
        state.unsavedChanges = true;

        const instructionInput = DOM.get('flashcard-ai-instruction');
        if (instructionInput) instructionInput.value = '';
        const tokensMsg = typeof data.tokensUsed === 'number'
          ? (state.localLang === 'es' ? ` (${data.tokensUsed.toLocaleString()} tokens usados)` : ` (used ${data.tokensUsed.toLocaleString()} tokens)`)
          : '';
        AISection.status(
          (state.localLang === 'es' ? 'Edición IA aplicada. Revisa y guarda.' : 'AI edit applied. Review and save.') + tokensMsg,
          'success'
        );
      } catch (error) {
        console.error('AI edit error:', error);
        AISection.status(
          state.localLang === 'es' ? 'La edición IA falló: ' + error.message : 'AI edit failed: ' + error.message,
          'danger'
        );
      } finally {
        DOM.enable(applyButton);
      }
    }
  };

  // ============================================
  // SINGLE CARD EDIT MODULE (show view, like the per-question quiz modal)
  // ============================================
  const SingleCardEdit = {
    open: (id) => {
      const card = state.cards.find((c) => String(c.id) === String(id));
      if (!card) return;
      state.singleCardId = id;
      const modal = DOM.get('modal-edit-flashcard-single');
      if (!modal) return;
      const frontEl = DOM.get('single-fc-front');
      const backEl = DOM.get('single-fc-back');
      if (frontEl) frontEl.value = card.front || '';
      if (backEl) backEl.value = card.back || '';
      const titleEl = DOM.get('single-fc-title');
      if (titleEl) {
        const num = card.number ? ` ${card.number}` : '';
        titleEl.innerHTML = `
          <span class="icon is-small has-text-warning"><i class="fas fa-edit"></i></span>
          <span lang="en">Edit card${num}</span>
          <span lang="es">Editar tarjeta${num}</span>`;
      }
      const instruction = DOM.get('single-fc-ai-instruction');
      if (instruction) instruction.value = '';
      SingleCardEdit.status('');
      DOM.show(modal);
      modal.classList.add('is-active');
      if (frontEl) frontEl.focus();
    },

    close: () => {
      const modal = DOM.get('modal-edit-flashcard-single');
      if (modal) modal.classList.remove('is-active');
      state.singleCardId = null;
    },

    status: (message, color = 'info') => {
      const statusEl = DOM.get('single-fc-ai-status');
      if (!statusEl) return;
      if (message) {
        statusEl.innerHTML = `<p class="has-text-${color}">${message}</p>`;
      } else {
        statusEl.innerHTML = '';
      }
    },

    aiApply: async () => {
      const id = state.singleCardId;
      if (!id) return;
      const instruction = (DOM.get('single-fc-ai-instruction')?.value || '').trim();
      if (!instruction) {
        SingleCardEdit.status(
          state.localLang === 'es' ? 'Describe el cambio que quieres...' : 'Please describe the edit you want...',
          'danger'
        );
        return;
      }
      const applyBtn = DOM.get('single-fc-ai-apply');
      DOM.disable(applyBtn);
      SingleCardEdit.status(state.localLang === 'es' ? 'Editando con IA...' : 'Editing with AI...', 'info');
      try {
        const response = await window.wsBrowserAI.fetch(CONFIG.AI_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId: state.test.id,
            flashcardId: id,
            instruction,
            front: DOM.get('single-fc-front')?.value || '',
            back: DOM.get('single-fc-back')?.value || ''
          })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'AI edit failed');
        const frontEl = DOM.get('single-fc-front');
        const backEl = DOM.get('single-fc-back');
        if (frontEl) frontEl.value = data.flashcard.front || '';
        if (backEl) backEl.value = data.flashcard.back || '';
        const instructionInput = DOM.get('single-fc-ai-instruction');
        if (instructionInput) instructionInput.value = '';
        const tokensMsg = typeof data.tokensUsed === 'number'
          ? (state.localLang === 'es' ? ` (${data.tokensUsed.toLocaleString()} tokens usados)` : ` (used ${data.tokensUsed.toLocaleString()} tokens)`)
          : '';
        SingleCardEdit.status(
          (state.localLang === 'es' ? 'Edición IA aplicada. Revisa y guarda.' : 'AI edit applied. Review and save.') + tokensMsg,
          'success'
        );
      } catch (error) {
        console.error('AI edit error:', error);
        SingleCardEdit.status(
          (state.localLang === 'es' ? 'La edición IA falló: ' : 'AI edit failed: ') + error.message,
          'danger'
        );
      } finally {
        DOM.enable(applyBtn);
      }
    },

    save: async () => {
      const id = state.singleCardId;
      if (!id) return;
      const front = (DOM.get('single-fc-front')?.value || '').trim();
      const back = (DOM.get('single-fc-back')?.value || '').trim();
      if (!front || !back) {
        SingleCardEdit.status(
          state.localLang === 'es' ? 'Tanto el frente como el reverso deben tener un valor.' : 'Both front and back must have a value.',
          'danger'
        );
        return;
      }
      const existing = state.cards.find((c) => String(c.id) === String(id)) || {};
      const saveBtn = DOM.get('single-fc-save');
      DOM.disable(saveBtn);
      SingleCardEdit.status(state.localLang === 'es' ? 'Guardando...' : 'Saving...', 'info');
      try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId: state.test.id,
            cards: [{ id, number: existing.number || 1, front, back }],
            deletedIds: []
          })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Save failed');
        SingleCardEdit.close();
        if (typeof fetchBodyContent === 'function') {
          fetchBodyContent(`/tests/${state.test.id}`);
        } else {
          window.location.reload();
        }
      } catch (error) {
        console.error('Error saving flashcard:', error);
        SingleCardEdit.status(
          (state.localLang === 'es' ? 'No se pudo guardar: ' : 'Could not save: ') + error.message,
          'danger'
        );
      } finally {
        DOM.enable(saveBtn);
      }
    },

    bind: () => {
      const modal = DOM.get('modal-edit-flashcard-single');
      if (!modal) return;
      const saveBtn = DOM.get('single-fc-save');
      if (saveBtn) saveBtn.onclick = () => SingleCardEdit.save();
      const applyBtn = DOM.get('single-fc-ai-apply');
      if (applyBtn) applyBtn.onclick = () => SingleCardEdit.aiApply();
      const instruction = DOM.get('single-fc-ai-instruction');
      if (instruction) {
        instruction.onkeydown = (e) => {
          if (e.key === 'Enter') { e.preventDefault(); SingleCardEdit.aiApply(); }
        };
      }
      modal.querySelectorAll('[data-single-fc-close]').forEach((btn) => {
        btn.onclick = () => SingleCardEdit.close();
      });
      const background = modal.querySelector('.modal-background');
      if (background) background.onclick = () => SingleCardEdit.close();
    }
  };

  // ============================================
  // EVENT LISTENERS MODULE
  // ============================================
  const EventListeners = {
    addSaveButtons: () => {
      DOM.getAll('.save-button').forEach(button => {
        button.onclick = async () => await SaveCancel.saveChanges(false);
      });
      DOM.getAll('.save-view-button').forEach(button => {
        button.onclick = async () => await SaveCancel.saveChanges(true);
      });
    },

    addCancelButtons: () => {
      DOM.getAll('.cancel-button').forEach(button => {
        button.onclick = () => SaveCancel.handleCancel();
      });
    },

    addCardButtons: () => {
      const addButton = DOM.get('flashcard-add-button');
      if (addButton) addButton.onclick = () => CardOps.addCard();

      DOM.getAll('.flashcard-delete-button').forEach(button => {
        button.onclick = () => {
          const id = button.dataset.id;
          CardOps.deleteCard(id);
        };
      });

      DOM.getAll('.flashcard-ai-edit-button').forEach(button => {
        button.onclick = () => {
          const id = button.dataset.id;
          AISection.open(id);
        };
      });
    },

    addAIModalButtons: () => {
      const applyButton = DOM.get('flashcard-ai-apply-button');
      if (applyButton) applyButton.onclick = () => AISection.run();

      const instruction = DOM.get('flashcard-ai-instruction');
      if (instruction) {
        instruction.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            AISection.run();
          }
        };
      }

      // Modal close (background + delete + cancel)
      const modal = DOM.get('modal-ai-edit-flashcard');
      if (modal) {
        const background = modal.querySelector('.modal-background');
        if (background) background.onclick = () => AISection.close();
        const deleteBtn = modal.querySelector('.modal-delete');
        if (deleteBtn) deleteBtn.onclick = () => AISection.close();
        modal.querySelectorAll('.modal-cancel').forEach(btn => {
          btn.onclick = () => AISection.close();
        });
      }
    },

    // Bind the single-card edit modal's own controls (save, AI apply, close).
    // Opening it is triggered externally (e.g. the study deck's "Edit" button
    // via FlashcardsEditor.openSingleCard).
    addSingleCardEditBindings: () => {
      SingleCardEdit.bind();
    },

    addAll: () => {
      EventListeners.addSaveButtons();
      EventListeners.addCancelButtons();
      EventListeners.addCardButtons();
      EventListeners.addAIModalButtons();
      EventListeners.addSingleCardEditBindings();
    }
  };

  // ============================================
  // INITIALIZATION
  // ============================================
  const init = () => {
    // Sync state from globals set by the page init script (test id is constant)
    if (typeof test !== 'undefined' && test) {
      state.test = test;
    }
    state.deletedIds = (typeof deletedFlashcardsIds !== 'undefined') ? deletedFlashcardsIds : [];
    state.localLang = (typeof localLang !== 'undefined') ? localLang : 'en';

    // Prefer fresh card data from the DOM (re-rendered on every navigation)
    const domCards = readCardsFromDOM();
    if (domCards.length > 0) {
      state.cards = domCards;
    } else if (typeof flashcards !== 'undefined' && flashcards) {
      state.cards = flashcards;
    }

    renumberCards();
    EventListeners.addAll();
  };

  // ============================================
  // PUBLIC API
  // ============================================
  return {
    init,
    addAllEventListeners: EventListeners.addAll,
    getState: () => state,
    openSingleCard: SingleCardEdit.open
  };
})();

// ============================================
// GLOBAL COMPATIBILITY LAYER
// ============================================
if (typeof test === 'undefined') var test;
if (typeof flashcards === 'undefined') var flashcards = [];
if (typeof deletedFlashcardsIds === 'undefined') var deletedFlashcardsIds = [];
if (typeof isFlashcardsEditInitialized === 'undefined') var isFlashcardsEditInitialized = false;
if (typeof isTestEditFlashcardsJSLoaded === 'undefined') var isTestEditFlashcardsJSLoaded = false;

// Global function for adding all event listeners
function addAllEditFlashcardsEventListeners() {
  // Sync globals to module state
  if (typeof test !== 'undefined' && test) {
    FlashcardsEditor.init();
  }

  // Sync module state back to globals
  const state = FlashcardsEditor.getState();
  test = state.test;
  flashcards = state.cards;
  deletedFlashcardsIds = state.deletedIds;
}

// Mark as loaded
isTestEditFlashcardsJSLoaded = true;

// Self-init on full page load. On AJAX navigation `handleCurrentState` calls
// `addAllEditFlashcardsEventListeners`, but on a direct page load nothing did -
// which left the "Edit card" buttons unbound. Re-binding is idempotent because
// every listener is assigned with `onclick` (replaces the previous handler).
(function selfInit() {
  const hasEditorUi =
    !!document.getElementById('modal-edit-flashcard-single') ||
    !!document.getElementById('flashcards-els');
  if (!hasEditorUi || isFlashcardsEditInitialized) return;

  const runInit = () => {
    if (isFlashcardsEditInitialized) return;
    if (typeof test !== 'undefined' && test) addAllEditFlashcardsEventListeners();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
})();

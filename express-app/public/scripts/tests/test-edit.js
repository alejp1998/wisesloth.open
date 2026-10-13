/**
 * Test Editor Module
 * Handles all functionality for editing existing tests
 */

const TestEditor = (function() {
  'use strict';

  // ============================================
  // CONFIGURATION & CONSTANTS
  // ============================================
  const CONFIG = {
    MAX_OPTIONS: 6,
    API_ENDPOINT: '/api/tests/update-quizzes'
  };

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const state = {
    test: null,
    newQuizzesIds: [],
    changedQuizzesIds: [],
    deletedQuizzesIds: [],
    saveButtons: [],
    unsavedChanges: false,
    localLang: 'en'
  };

  // ============================================
  // DOM HELPERS
  // ============================================
  const DOM = {
    get: (id) => document.getElementById(id),
    getAll: (selector) => document.querySelectorAll(selector),
    show: (el) => el?.classList.remove('is-hidden'),
    hide: (el) => el?.classList.add('is-hidden'),
    enable: (el) => el && (el.disabled = false),
    disable: (el) => el && (el.disabled = true),
    addClass: (el, cls) => el?.classList.add(cls),
    removeClass: (el, cls) => el?.classList.remove(cls),
    hasClass: (el, cls) => el?.classList.contains(cls),
    setHTML: (el, html) => el && (el.innerHTML = html)
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const Utils = {
    generateUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    updateFields: (originalObject, updateObject) => {
      for (const key in updateObject) {
        if (updateObject.hasOwnProperty(key) && originalObject.hasOwnProperty(key)) {
          originalObject[key] = updateObject[key];
        }
      }
    },

    intStrToCharStr: (inputString) => {
      if (!inputString) return '';
      const numbers = inputString.split(',');
      const letters = numbers.map(number => String.fromCharCode(parseInt(number) + 64));
      return letters.join(',');
    },

    getText: (key) => {
      const texts = {
        savedTitle: { en: 'Changes saved succesfully!', es: '¡Cambios guardados con éxito!' },
        savedText: { en: 'Continue editing or try the test.', es: 'Continúa editando o intenta el test.' },
        cancelTitle: { en: 'Are you sure you want to cancel?', es: '¿Estás seguro de que deseas cancelar?' },
        cancelText: { en: 'You will lose any unsaved changes.', es: 'Perderás cualquier cambio no guardado.' },
        confirmYes: { en: 'Yes, cancel', es: 'Sí, cancelar' },
        confirmNo: { en: 'No, continue', es: 'No, continuar' },
        ok: { en: 'OK!', es: '¡OK!' },
        cancel: { en: 'Cancel', es: 'Cancelar' },
        addQuestion: { en: 'Add question in position', es: 'Añadir pregunta en posición' },
        editQuiz: { en: 'Edit quiz', es: 'Editar pregunta' },
        deleteConfirmPrefix: { en: 'Sure you want to delete question "', es: 'Seguro que deseas eliminar la pregunta "' },
        deleteConfirmSuffix: { en: '"? Once you save changes, this action cannot be undone.', es: '"? Una vez guardados los cambios, esta acción no se puede deshacer.' },
        errorTitle: { en: 'There was an error saving your changes', es: 'Hubo un error al guardar tus cambios' },
        errorText: { en: 'Check that every question has at least one correct option selected and other potential issues.', es: 'Verifica que cada pregunta tenga al menos una opción correcta seleccionada y otros posibles problemas.' },
        noQuestions: { en: 'You must add at least one question to save changes', es: 'Debes agregar al menos una pregunta para guardar los cambios' },
        addQuestionText: { en: 'Add a question and try again.', es: 'Agrega una pregunta e intenta de nuevo.' },
        atLeastOneCorrect: { en: 'At least one correct option must be chosen. Select another option and then unselect this one.', es: 'Debes elegir al menos una opción correcta. Selecciona otra opción y luego desmarca esta.' },
        cannotSelectExp: { en: 'This option cannot be selected as correct because it is an explanation.', es: 'Esta opción no puede seleccionarse como correcta porque es una explicación.' },
        cannotSelectAll: { en: 'You cannot select all options as correct. Unselect another option and then select this one.', es: 'No puedes seleccionar todas las opciones como correctas. Desmarca otra opción y luego selecciona esta.' },
        enterQuestion: { en: 'Please enter a question.', es: 'Por favor ingresa una pregunta.' },
        atLeastTwoOptions: { en: 'At least options 1 and 2 must have a value.', es: 'Al menos las opciones 1 y 2 deben tener un valor.' },
        selectCorrectOption: { en: 'Please check at least one option as correct.', es: 'Por favor marca al menos una opción como correcta.' }
      };
      return texts[key]?.[state.localLang] || texts[key]?.en || '';
    }
  };

  // ============================================
  // SAVE & CANCEL MODULE
  // ============================================
  const SaveCancel = {
    saveChanges: async (view = false) => {
      // Check if there are any questions
      if (state.test.quizzes.length === 0) {
        Swal.fire({
          title: Utils.getText('noQuestions'),
          text: Utils.getText('addQuestionText'),
          icon: 'warning',
          confirmButtonText: Utils.getText('ok')
        });
        return;
      }

      try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            test: state.test,
            newQuizzesIds: state.newQuizzesIds,
            changedQuizzesIds: state.changedQuizzesIds,
            deletedQuizzesIds: state.deletedQuizzesIds
          })
        });

        if (response.ok) {
          // Reset tracking
          state.saveButtons.forEach(button => {
            button.disabled = true;
            state.unsavedChanges = false;
          });
          state.newQuizzesIds = [];
          state.changedQuizzesIds = [];
          state.deletedQuizzesIds = [];

          // Sync to globals
          newQuizzesIds = [];
          changedQuizzesIds = [];
          deletedQuizzesIds = [];
          unsavedChanges = false;

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

          // Remove all quiz links selected class
          DOM.getAll('.flex-item-quiz-link').forEach(link => {
            DOM.removeClass(link, 'selected');
          });
        } else {
          const error = await response.json();
          console.error(error.error);

          Swal.fire({
            title: Utils.getText('errorTitle'),
            text: Utils.getText('errorText'),
            icon: 'error',
            confirmButtonText: Utils.getText('ok')
          });
        }
      } catch (error) {
        console.error('Error:', error);
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
    },

    enableSaveButtons: () => {
      state.saveButtons.forEach(button => {
        button.disabled = false;
        state.unsavedChanges = true;
      });
      unsavedChanges = true;
    }
  };

  // ============================================
  // OPTION SELECTION MODULE
  // ============================================
  const OptionSelection = {
    selectOption: (element) => {
      const quizEl = element.closest('.quiz');
      const quizId = quizEl.id.split('-').slice(1).join('-');
      const checkboxInput = element.querySelector('input[type="checkbox"]');
      const quizLink = DOM.get(`quiz-link-${quizId}`);
      const quizEditAlert = quizEl.querySelector('.quiz-edit-alert');

      const quiz = state.test.quizzes.find(q => q.id === quizId);

      // Count other checked options
      const flexItems = quizEl.querySelectorAll('.flex-opt-clickable.is-edit');
      const nOtherFlexItems = flexItems.length - 1;
      let nOtherFlexItemsChecked = 0;

      flexItems.forEach(item => {
        if (item !== element) {
          const otherCheckbox = item.querySelector('input[type="checkbox"]');
          if (otherCheckbox.checked) {
            nOtherFlexItemsChecked++;
          }
        }
      });

      // Handle toggle logic
      if (checkboxInput.checked) {
        // Trying to uncheck
        if (nOtherFlexItemsChecked < 1) {
          DOM.show(quizEditAlert);
          quizEditAlert.innerHTML = Utils.getText('atLeastOneCorrect');
          return;
        }
        checkboxInput.checked = false;
        DOM.removeClass(element, 'correct');
      } else {
        // Trying to check
        const optionValue = element.querySelector('.option-text')?.innerHTML || '';
        if (optionValue.startsWith('[Exp]')) {
          DOM.show(quizEditAlert);
          quizEditAlert.innerHTML = Utils.getText('cannotSelectExp');
          return;
        }

        // Uncheck other options if only 2 total
        if (nOtherFlexItemsChecked === 1 && nOtherFlexItems === 1) {
          flexItems.forEach(item => {
            if (item !== element) {
              const otherCheckbox = item.querySelector('input[type="checkbox"]');
              otherCheckbox.checked = false;
              DOM.removeClass(item, 'correct');
            }
          });
        } else if (nOtherFlexItemsChecked === nOtherFlexItems) {
          DOM.show(quizEditAlert);
          quizEditAlert.innerHTML = Utils.getText('cannotSelectAll');
          return;
        }

        checkboxInput.checked = true;
        DOM.addClass(element, 'correct');
      }

      DOM.hide(quizEditAlert);

      // Update quiz correct options
      const checkboxes = document.querySelectorAll(`input[type="checkbox"][name="chosenOpts-${quizId}"]`);
      const chosenOptions = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      const chosenOptionsStr = chosenOptions.join(',');

      quiz.correct_opts = chosenOptionsStr;

      // Mark as changed
      if (!state.changedQuizzesIds.includes(quizId)) {
        state.changedQuizzesIds.push(quizId);
        changedQuizzesIds = state.changedQuizzesIds;
      }

      // Update quiz link
      DOM.addClass(quizLink, 'selected');
      quizLink.innerHTML = `<b>${quiz.number}</b>.${Utils.intStrToCharStr(quiz.correct_opts)}`;

      SaveCancel.enableSaveButtons();
    }
  };

  // ============================================
  // MODAL MODULE
  // ============================================
  const Modal = {
    alert: (message) => {
      const alertEl = document.querySelector('.modal-alert');
      if (alertEl) {
        DOM.show(alertEl);
        alertEl.innerHTML = `<p class="has-text-danger">${message}</p>`;
      }
    },

    openAddQuiz: (i) => {
      i = i > 0 ? i : state.test.quizzes.length + 1;

      const modalEditQuiz = DOM.get('modal-edit-quiz');
      const modalEditQuizButton = modalEditQuiz.querySelector('#modal-edit-quiz-button');
      const modalAddQuizButton = modalEditQuiz.querySelector('#modal-add-quiz-button');

      const newQuiz = {
        id: i,
        number: i,
        question: '',
        correct_opts: '',
        opt1: '', opt2: '', opt3: '', opt4: '', opt5: '', opt6: '',
        image_url: ''
      };

      const modalTitle = modalEditQuiz.querySelector('.modal-card-title');
      const modalQuiz = modalEditQuiz.querySelector('.modalQuiz');

      // AI edit is only useful for existing questions - hide it while adding
      AIEdit.reset();
      DOM.hide(modalEditQuiz.querySelector('.ai-edit-section'));

      modalTitle.innerHTML = `
        <span lang="en" class="${state.localLang === 'en' ? '' : 'is-hidden'}">${Utils.getText('addQuestion')} ${i}</span>
        <span lang="es" class="${state.localLang === 'es' ? '' : 'is-hidden'}">${Utils.getText('addQuestion')} ${i}</span>
      `;
      modalQuiz.innerHTML = QuizHTML.generateModalQuizHTML(newQuiz);
      modalQuiz.id = `quiz-${i}`;

      DOM.addClass(modalEditQuiz, 'is-active');
      DOM.addClass(modalEditQuizButton, 'is-hidden');
      DOM.removeClass(modalAddQuizButton, 'is-hidden');
    },

    openEditQuiz: (quizId) => {
      const modalEditQuiz = DOM.get('modal-edit-quiz');
      const modalEditQuizButton = modalEditQuiz.querySelector('#modal-edit-quiz-button');
      const modalAddQuizButton = modalEditQuiz.querySelector('#modal-add-quiz-button');

      const quiz = state.test.quizzes.find(q => q.id === quizId);

      const modalTitle = modalEditQuiz.querySelector('.modal-card-title');
      const modalQuiz = modalEditQuiz.querySelector('.modalQuiz');

      // Show + reset the AI edit section for existing questions
      AIEdit.reset();
      DOM.show(modalEditQuiz.querySelector('.ai-edit-section'));

      const enText = state.localLang === 'en' ? '' : 'is-hidden';
      const esText = state.localLang === 'es' ? '' : 'is-hidden';

      modalTitle.innerHTML = `
        <span lang="en" class="${enText}">Edit quiz ${quiz.number}</span>
        <span lang="es" class="${esText}">Editar pregunta ${quiz.number}</span>
      `;
      modalQuiz.innerHTML = QuizHTML.generateModalQuizHTML(quiz);
      modalQuiz.id = `quiz-${quizId}`;

      DOM.addClass(modalEditQuiz, 'is-active');
      DOM.removeClass(modalEditQuizButton, 'is-hidden');
      DOM.addClass(modalAddQuizButton, 'is-hidden');
    }
  };

  // ============================================
  // QUIZ HTML GENERATION MODULE
  // ============================================
  const QuizHTML = {
    generateOptionHTML: (optId, optValue, correctOpts) => {
      const optN = Number(optId.slice(3));
      const optLetter = String.fromCharCode(64 + optN);
      const checkedStr = correctOpts.includes(optN) ? 'checked' : '';

      // Don't show checkbox for option 6 (explanation slot)
      if (optN === 6) {
        return ''; // Will be handled separately as explanation field
      }

      return `
        <div class="qe-option-row">
          <label class="qe-option-letter" for="checkboxOpt${optN}" title="Mark as correct">${optLetter}</label>
          <textarea placeholder="Option ${optLetter}" type="text" id="inputOpt${optN}" class="textarea is-small qe-option-input" rows="1">${optValue}</textarea>
          <label class="qe-correct-toggle" title="Correct answer">
            <input type="checkbox" id="checkboxOpt${optN}" name="answers" value="${optN}" ${checkedStr}>
            <span class="qe-correct-box"><i class="fas fa-check"></i></span>
          </label>
        </div>`;
    },

    generateModalQuizHTML: (quiz) => {
      // Generate options HTML for options 1-5 only
      const optionsHTML = Object.entries(quiz)
        .filter(([key]) => key.startsWith('opt') && key !== 'opt6')
        .map(([optionId, optionValue]) => QuizHTML.generateOptionHTML(optionId, optionValue, quiz.correct_opts))
        .join('');

      // Extract explanation text (remove [Exp] prefix if present)
      const explanationValue = quiz.opt6 && quiz.opt6.startsWith('[Exp]')
        ? quiz.opt6.substring(5).trim()
        : (quiz.opt6 || '');

      return `
        <div class="field">
          <label class="label is-size-6">
            <span lang="en" class="${state.localLang === 'en' ? '' : 'is-hidden'}">Question</span>
            <span lang="es" class="${state.localLang === 'es' ? '' : 'is-hidden'}">Pregunta</span>
          </label>
          <div class="control">
            <textarea placeholder="Question ..." type="text" class="textarea is-small" rows="2" id="modalQuestion">${quiz.question}</textarea>
          </div>
        </div>
        <label class="label is-size-6">
          <span lang="en" class="${state.localLang === 'en' ? '' : 'is-hidden'}">Options</span>
          <span lang="es" class="${state.localLang === 'es' ? '' : 'is-hidden'}">Opciones</span>
        </label>
        ${optionsHTML}

        <!-- Hidden inputs for checkbox compatibility -->
        <input type="hidden" id="checkboxOpt6" name="answers" value="6">
        <input type="hidden" id="inputOpt6" value="${quiz.opt6 || ''}">

        <!-- Explanation field -->
        <div class="field" style="margin-top: 0.75rem;">
          <label class="label is-size-6">
            <span class="icon is-small has-text-info"><i class="fas fa-lightbulb"></i></span>
            <span lang="en" class="${state.localLang === 'en' ? '' : 'is-hidden'}">Explanation (optional)</span>
            <span lang="es" class="${state.localLang === 'es' ? '' : 'is-hidden'}">Explicación (opcional)</span>
          </label>
          <div class="control">
            <textarea id="inputExplanation" class="textarea is-small" rows="2" placeholder="${state.localLang === 'es' ? 'Añade una explicación para mostrar después de responder...' : 'Add an explanation to show after answering...'}">${explanationValue}</textarea>
          </div>
          <p class="help">
            <span lang="en" class="${state.localLang === 'en' ? '' : 'is-hidden'}">This will be shown to users after they answer the question.</span>
            <span lang="es" class="${state.localLang === 'es' ? '' : 'is-hidden'}">Esto se mostrará a los usuarios después de responder la pregunta.</span>
          </p>
        </div>`;
    },

    updateQuizHTML: (quizId) => {
      const quiz = state.test.quizzes.find(q => q.id === quizId);
      const quizEl = DOM.get(`quiz-${quizId}`);

      // Update question
      const quizTitle = quizEl.querySelector('.quiz-title');
      quizTitle.innerHTML = `${quiz.number}. ${quiz.question}`;

      // Update options
      const optionsContainer = quizEl.querySelector('.flex-container');

      // Helper to create a new option element
      const createOptionEl = (optionId, optionValue, isCorrect, letter) => {
        const optionEl = document.createElement('div');
        optionEl.id = optionId;
        optionEl.className = `option flex-opt-clickable is-edit${isCorrect ? ' correct' : ''}`;
        optionEl.innerHTML = `
          <input class="is-hidden" type="checkbox" name="chosenOpts-${quiz.id}" value="${optionId.slice(3)}"${isCorrect ? ' checked' : ''}>
          <p class="quiz-option subtitle is-5"><b>${letter}.</b> <span class="option-text">${optionValue}</span></p>
        `;
        return optionEl;
      };

      // Handle options 1-5 (regular options)
      for (let i = 1; i <= 5; i++) {
        const optionId = `opt${i}`;
        const optionValue = quiz[optionId];
        const letter = String.fromCharCode(64 + i);
        const isCorrect = quiz.correct_opts.includes(i);

        if (optionValue) {
          let optionEl = optionsContainer.querySelector(`#${optionId}`);

          if (!optionEl) {
            // Create new option element
            optionEl = createOptionEl(optionId, optionValue, isCorrect, letter);
            // Insert before explanation if exists, otherwise append
            const explanationEl = optionsContainer.querySelector('.quiz-explanation');
            if (explanationEl) {
              optionsContainer.insertBefore(optionEl, explanationEl);
            } else {
              optionsContainer.appendChild(optionEl);
            }
          } else {
            // Update existing option
            const optionTextEl = optionEl.querySelector('p');
            const optionCheckboxEl = optionEl.querySelector('input[type="checkbox"]');

            if (isCorrect) {
              DOM.addClass(optionEl, 'correct');
              optionCheckboxEl.checked = true;
            } else {
              DOM.removeClass(optionEl, 'correct');
              optionCheckboxEl.checked = false;
            }

            optionTextEl.innerHTML = `<b>${letter}.</b> <span class="option-text">${optionValue}</span>`;
          }
        } else {
          // Remove option if no value
          const optionEl = optionsContainer.querySelector(`#${optionId}`);
          if (optionEl) optionEl.remove();
        }
      }

      // Handle explanation (opt6)
      const existingExplanation = optionsContainer.querySelector('.quiz-explanation');
      if (existingExplanation) existingExplanation.remove();

      if (quiz.opt6 && quiz.opt6.startsWith('[Exp]')) {
        const explanationText = quiz.opt6.substring(5).trim();
        const explanationEl = document.createElement('div');
        explanationEl.className = 'quiz-explanation';
        explanationEl.style.fontSize = '0.8rem';
        explanationEl.innerHTML = `<i class="fas fa-lightbulb"></i>${explanationText}`;
        optionsContainer.appendChild(explanationEl);
      }
    }
  };

  // ============================================
  // QUIZ OPERATIONS MODULE
  // ============================================
  const QuizOps = {
    handleOptions: (modalEditQuiz) => {
      // Handle options 1-5
      const optionsData = Array.from({ length: 5 }, (_, index) => {
        const optionId = `opt${index + 1}`;
        const optionInput = modalEditQuiz.querySelector(`#inputOpt${index + 1}`);
        const optionCheckbox = modalEditQuiz.querySelector(`#checkboxOpt${index + 1}`);
        const optionValue = optionInput.value.trim();

        if (index > 0 && optionValue === '' && optionCheckbox.checked) {
          Modal.alert(`Option ${index + 1} must have a value if selected as correct.`);
          return null;
        }

        return { id: optionId, value: optionValue, checked: optionCheckbox.checked };
      });

      if (optionsData.includes(null)) return null;

      // Handle explanation (option 6)
      const explanationInput = modalEditQuiz.querySelector('#inputExplanation');
      const explanationValue = explanationInput ? explanationInput.value.trim() : '';

      // Add opt6 with [Exp] prefix if there's an explanation
      optionsData.push({
        id: 'opt6',
        value: explanationValue ? `[Exp]${explanationValue}` : '',
        checked: false
      });

      // Validate at least options 1 and 2
      if (optionsData[0].value === '' || optionsData[1].value === '') {
        Modal.alert(Utils.getText('atLeastTwoOptions'));
        return null;
      }

      // Validate at least one correct
      if (optionsData.slice(0, 5).every(opt => !opt.checked)) {
        Modal.alert(Utils.getText('selectCorrectOption'));
        return null;
      }

      // Validate sequential options (skip opt6/explanation)
      for (let i = 0; i < 4; i++) {
        const current = optionsData[i];
        const next = optionsData[i + 1];

        if (next.value !== '' && current.value === '') {
          Modal.alert(`Option ${i + 1} must have a value if option ${i + 2} has a value.`);
          return null;
        }
      }

      return optionsData;
    },

    decrementNumberAndModifyElements: (quizNumber) => {
      state.test.quizzes.forEach(quiz => {
        if (quiz.number > quizNumber) {
          quiz.prevNumber = quiz.number;
          quiz.number -= 1;

          if (!state.changedQuizzesIds.includes(quiz.id)) {
            state.changedQuizzesIds.push(quiz.id);
          }

          const addQuizEl = DOM.get(`add-quiz-button-${quiz.id}`);
          if (addQuizEl) addQuizEl.onclick = () => Modal.openAddQuiz(quiz.number);

          const quizLink = DOM.get(`quiz-link-${quiz.id}`);
          if (quizLink) quizLink.innerHTML = `<b>${quiz.number}</b>.${Utils.intStrToCharStr(quiz.correct_opts)}`;

          const questionEl = DOM.get(`quiz-${quiz.id}`)?.querySelector('.quiz-title');
          if (questionEl) questionEl.firstChild.nodeValue = `${quiz.number}. ${quiz.question}`;
        }
      });
      changedQuizzesIds = state.changedQuizzesIds;
    },

    incrementNumberAndModifyElements: (quizNumber) => {
      let postQuizId = '';

      state.test.quizzes.forEach(quiz => {
        if (quiz.number >= quizNumber) {
          if (quiz.number === quizNumber) postQuizId = quiz.id;

          quiz.prevNumber = quiz.number;
          quiz.number += 1;

          if (!state.changedQuizzesIds.includes(quiz.id)) {
            state.changedQuizzesIds.push(quiz.id);
          }

          const addQuizEl = DOM.get(`add-quiz-button-${quiz.id}`);
          if (addQuizEl) addQuizEl.onclick = () => Modal.openAddQuiz(quiz.number);

          const quizLink = DOM.get(`quiz-link-${quiz.id}`);
          if (quizLink) quizLink.innerHTML = `<b>${quiz.number}</b>.${Utils.intStrToCharStr(quiz.correct_opts)}`;

          const questionEl = DOM.get(`quiz-${quiz.id}`)?.querySelector('.quiz-title');
          if (questionEl) questionEl.firstChild.nodeValue = `${quiz.number}. ${quiz.question}`;
        }
      });

      changedQuizzesIds = state.changedQuizzesIds;
      return postQuizId;
    },

    createNewQuizElement: (newQuizId, quizNumber) => {
      // Clone quiz link template
      const newQuizLink = DOM.get('flex-item-quiz-link-edit-example').cloneNode(true);
      newQuizLink.id = `quiz-link-${newQuizId}`;
      newQuizLink.innerHTML = `<b>${quizNumber}</b>.${Utils.intStrToCharStr('')}`;
      newQuizLink.onclick = () => scrollToQuiz(newQuizLink, newQuizId);
      DOM.show(newQuizLink);

      // Clone quiz template
      const newQuizEl = DOM.get('quiz-edit-example').cloneNode(true);
      newQuizEl.id = `quiz-${newQuizId}`;
      DOM.show(newQuizEl);

      const newQuizEditButton = newQuizEl.querySelector('.quiz-edit-button');
      newQuizEditButton.onclick = () => Modal.openEditQuiz(newQuizId);

      const newQuizDeleteButton = newQuizEl.querySelector('.quiz-delete-button');
      newQuizDeleteButton.onclick = () => QuizOps.deleteQuiz(newQuizId);

      const imagePondEl = newQuizEl.querySelector('.filepond');
      imagePondEl.id = `quiz-image-pond-${newQuizId}`;
      if (typeof setUpImagePond === 'function') setUpImagePond(imagePondEl);

      // Clone add quiz template
      const newAddQuizEl = DOM.get('add-quiz-container-last').cloneNode(true);
      newAddQuizEl.id = `add-quiz-container-${newQuizId}`;

      const newAddQuizButtonEl = newAddQuizEl.querySelector('button');
      newAddQuizButtonEl.id = `add-quiz-button-${newQuizId}`;
      newAddQuizButtonEl.onclick = () => Modal.openAddQuiz(quizNumber);

      return { newQuizLink, newQuizEl, newAddQuizEl };
    },

    deleteQuizHTML: (quizId) => {
      DOM.get(`quiz-link-${quizId}`)?.remove();
      DOM.get(`quiz-${quizId}`)?.remove();
      DOM.get(`add-quiz-container-${quizId}`)?.remove();
    },

    addQuiz: () => {
      const modalAddQuiz = DOM.get('modal-edit-quiz');
      const modalQuizEl = modalAddQuiz.querySelector('.modalQuiz');
      const quizNumber = Number(modalQuizEl.id.split('-')[1]);
      const newQuizId = Utils.generateUUID();

      const questionValue = DOM.get('modalQuestion').value.trim();
      if (questionValue === '') {
        Modal.alert(Utils.getText('enterQuestion'));
        return;
      }

      const optionsData = QuizOps.handleOptions(modalAddQuiz);
      if (!optionsData) return;

      const chosenOptions = optionsData
        .filter(opt => opt.checked)
        .map(opt => opt.id.slice(3))
        .join(',');

      const newQuiz = {
        id: newQuizId,
        number: quizNumber,
        question: questionValue,
        correct_opts: chosenOptions,
        image_url: ''
      };

      optionsData.forEach(opt => { newQuiz[opt.id] = opt.value; });

      const postQuizId = QuizOps.incrementNumberAndModifyElements(quizNumber);
      const { newQuizLink, newQuizEl, newAddQuizEl } = QuizOps.createNewQuizElement(newQuizId, quizNumber);

      if (quizNumber <= state.test.quizzes.length) {
        const postQuizLink = DOM.get(`quiz-link-${postQuizId}`);
        const postAddQuizEl = DOM.get(`add-quiz-container-${postQuizId}`);
        postQuizLink.insertAdjacentElement('beforebegin', newQuizLink);
        postAddQuizEl.insertAdjacentElement('beforebegin', newAddQuizEl);
        postAddQuizEl.insertAdjacentElement('beforebegin', newQuizEl);
      } else {
        const quizLinks = document.querySelector('.quiz-links');
        const addQuizLastEl = DOM.get('add-quiz-container-last');
        quizLinks.appendChild(newQuizLink);
        addQuizLastEl.insertAdjacentElement('beforebegin', newAddQuizEl);
        addQuizLastEl.insertAdjacentElement('beforebegin', newQuizEl);
      }

      state.test.quizzes.push(newQuiz);
      state.newQuizzesIds.push(newQuizId);
      newQuizzesIds = state.newQuizzesIds;
      QuizHTML.updateQuizHTML(newQuizId);

      DOM.addClass(newQuizLink, 'selected');
      newQuizLink.innerHTML = `<b>${newQuiz.number}</b>.${Utils.intStrToCharStr(newQuiz.correct_opts)}`;

      SaveCancel.enableSaveButtons();

      if (typeof MathJax !== 'undefined') MathJax.typeset();

      EventListeners.addAll();
      closeModal(modalAddQuiz);
    },

    deleteQuiz: async (quizId) => {
      const quiz = state.test.quizzes.find(q => q.id === quizId);
      const confirmMessage = `${Utils.getText('deleteConfirmPrefix')}${quiz.question}${Utils.getText('deleteConfirmSuffix')}`;

      const userConfirmed = await showSweetConfirm(confirmMessage);

      if (userConfirmed) {
        QuizOps.decrementNumberAndModifyElements(quiz.number);
        state.test.quizzes = state.test.quizzes.filter(q => q.id !== quizId);
        state.deletedQuizzesIds.push(quizId);
        deletedQuizzesIds = state.deletedQuizzesIds;
        QuizOps.deleteQuizHTML(quizId);
        SaveCancel.enableSaveButtons();
      }
    },

    editQuiz: () => {
      const modalEditQuiz = DOM.get('modal-edit-quiz');
      const modalQuizEl = modalEditQuiz.querySelector('.modalQuiz');
      const quizId = modalQuizEl.id.split('-').slice(1).join('-');
      const quiz = state.test.quizzes.find(q => q.id === quizId);

      const questionValue = DOM.get('modalQuestion').value.trim();
      if (questionValue === '') {
        Modal.alert(Utils.getText('enterQuestion'));
        return;
      }

      const optionsData = QuizOps.handleOptions(modalEditQuiz);
      if (!optionsData) return;

      const chosenOptions = optionsData
        .filter(opt => opt.checked)
        .map(opt => opt.id.slice(3))
        .join(',');

      const updatedQuiz = {
        question: questionValue,
        correct_opts: chosenOptions
      };

      optionsData.forEach(opt => { updatedQuiz[opt.id] = opt.value; });
      Utils.updateFields(quiz, updatedQuiz);

      if (!state.changedQuizzesIds.includes(quizId)) {
        state.changedQuizzesIds.push(quizId);
        changedQuizzesIds = state.changedQuizzesIds;
      }

      QuizHTML.updateQuizHTML(quizId);

      const quizLink = DOM.get(`quiz-link-${quizId}`);
      quizLink.innerHTML = `<b>${quiz.number}</b>.${Utils.intStrToCharStr(quiz.correct_opts)}`;
      DOM.addClass(quizLink, 'selected');

      SaveCancel.enableSaveButtons();

      if (typeof MathJax !== 'undefined') MathJax.typeset();

      closeModal(modalEditQuiz);
    }
  };

  // ============================================
  // AI EDIT MODULE
  // ============================================
  const AIEdit = {
    collectQuizData: () => {
      // Gather the current modal fields into a DB-shaped quiz dict
      const question = (DOM.get('modalQuestion')?.value || '').trim();
      const opts = {};
      for (let i = 1; i <= 5; i++) {
        const input = DOM.get(`inputOpt${i}`);
        opts[`opt${i}`] = input ? input.value : '';
      }
      const explanation = (DOM.get('inputExplanation')?.value || '').trim();
      const correct = [];
      for (let i = 1; i <= 5; i++) {
        const cb = DOM.get(`checkboxOpt${i}`);
        if (cb && cb.checked) correct.push(i);
      }
      return {
        question,
        opt1: opts.opt1, opt2: opts.opt2, opt3: opts.opt3,
        opt4: opts.opt4, opt5: opts.opt5,
        opt6: explanation ? `[Exp]${explanation}` : '',
        correct_opts: correct.join(',')
      };
    },

    applyToModal: (quiz) => {
      DOM.get('modalQuestion').value = quiz.question || '';
      for (let i = 1; i <= 5; i++) {
        const input = DOM.get(`inputOpt${i}`);
        if (input) input.value = quiz[`opt${i}`] || '';
        const cb = DOM.get(`checkboxOpt${i}`);
        if (cb) cb.checked = false;
      }
      // Mark the correct options returned by the AI
      const correctOpts = (quiz.correct_opts || '').split(',').map(Number).filter(n => n >= 1 && n <= 5);
      correctOpts.forEach(n => {
        const cb = DOM.get(`checkboxOpt${n}`);
        if (cb) cb.checked = true;
      });
      const explanation = DOM.get('inputExplanation');
      if (explanation) {
        explanation.value = (quiz.opt6 && quiz.opt6.startsWith('[Exp]'))
          ? quiz.opt6.substring(5).trim()
          : (quiz.opt6 || '');
      }
    },

    status: (message, color = 'info') => {
      const statusEl = DOM.get('ai-edit-status');
      if (statusEl) {
        DOM.show(statusEl);
        statusEl.innerHTML = `<p class="has-text-${color}">${message}</p>`;
      }
    },

    reset: () => {
      const input = DOM.get('ai-edit-instruction');
      if (input) input.value = '';
      const statusEl = DOM.get('ai-edit-status');
      if (statusEl) {
        statusEl.innerHTML = '';
        DOM.hide(statusEl);
      }
    },

    run: async () => {
      const modalEditQuiz = DOM.get('modal-edit-quiz');
      const modalQuizEl = modalEditQuiz.querySelector('.modalQuiz');
      const quizId = modalQuizEl.id.split('-').slice(1).join('-');
      const instruction = (DOM.get('ai-edit-instruction')?.value || '').trim();

      if (!instruction) {
        AIEdit.status(
          state.localLang === 'es' ? 'Describe el cambio que quieres...' : 'Please describe the edit you want...',
          'danger'
        );
        return;
      }

      const quiz = AIEdit.collectQuizData();
      if (!quiz.question) {
        AIEdit.status(
          state.localLang === 'es' ? 'La pregunta está vacía...' : 'The question is empty...',
          'danger'
        );
        return;
      }

      const applyButton = DOM.get('ai-edit-apply-button');
      DOM.disable(applyButton);
      AIEdit.status(
        state.localLang === 'es' ? 'Editando con IA...' : 'Editing with AI...',
        'info'
      );

      try {
        const response = await window.wsBrowserAI.fetch('/api/tests/edit-quiz-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId: state.test.id,
            quizId,
            instruction,
            quiz
          })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'AI edit failed');

        AIEdit.applyToModal(data.quiz);
        DOM.get('ai-edit-instruction').value = '';
        const tokensMsg = typeof data.tokensUsed === 'number'
          ? (state.localLang === 'es' ? ` (${data.tokensUsed.toLocaleString()} tokens usados)` : ` (used ${data.tokensUsed.toLocaleString()} tokens)`)
          : '';
        AIEdit.status(
          (state.localLang === 'es' ? 'Edición IA aplicada. Revisa y guarda.' : 'AI edit applied. Review and save.') + tokensMsg,
          'success'
        );
      } catch (error) {
        console.error('AI edit error:', error);
        AIEdit.status(
          state.localLang === 'es' ? 'La edición IA falló: ' + error.message : 'AI edit failed: ' + error.message,
          'danger'
        );
      } finally {
        DOM.enable(applyButton);
      }
    }
  };

  // Scroll to the quiz targeted by ?focus=<quizId> when arriving from other views
  function handleEditFocusParam() {
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get('focus');
    if (!focusId) return;
    const quizEl = DOM.get(`quiz-${focusId}`);
    if (quizEl) {
      setTimeout(() => {
        quizEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        quizEl.classList.add('focused-quiz');
        // Flash highlight then remove
        setTimeout(() => quizEl.classList.remove('focused-quiz'), 3000);
      }, 300);
    }
  }

  // ============================================
  // EVENT LISTENERS MODULE
  // ============================================
  const EventListeners = {
    addSelectOption: () => {
      DOM.getAll('.flex-opt-clickable.is-edit').forEach(element => {
        element.onclick = () => OptionSelection.selectOption(element);
      });
    },

    addSaveButtons: () => {
      state.saveButtons = Array.from(DOM.getAll('.save-button'));
      saveButtons = state.saveButtons;

      state.saveButtons.forEach(button => {
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

    addOpenEditQuizModal: () => {
      const editButton = DOM.get('modal-edit-quiz-button');
      if (editButton) editButton.onclick = QuizOps.editQuiz;

      const addButton = DOM.get('modal-add-quiz-button');
      if (addButton) addButton.onclick = QuizOps.addQuiz;

      DOM.getAll('.quiz-edit-button').forEach(button => {
        button.onclick = () => {
          const quizId = button.dataset.quizId;
          Modal.openEditQuiz(quizId);
        };
      });
    },

    addDeleteQuiz: () => {
      DOM.getAll('.quiz-delete-button').forEach(button => {
        button.onclick = () => {
          const quizId = button.dataset.quizId;
          QuizOps.deleteQuiz(quizId);
        };
      });
    },

    addOpenAddQuizModal: () => {
      DOM.getAll('.add-quiz-button').forEach(button => {
        const quizNumber = Number(button.dataset.quizNumber);
        button.onclick = () => Modal.openAddQuiz(quizNumber);
      });
    },

    addAIEditListener: () => {
      const applyButton = DOM.get('ai-edit-apply-button');
      if (applyButton) {
        applyButton.onclick = () => AIEdit.run();
      }
      const instructionInput = DOM.get('ai-edit-instruction');
      if (instructionInput) {
        instructionInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            AIEdit.run();
          }
        };
      }
    },

    addAll: () => {
      EventListeners.addSelectOption();
      EventListeners.addSaveButtons();
      EventListeners.addCancelButtons();
      EventListeners.addOpenEditQuizModal();
      EventListeners.addDeleteQuiz();
      EventListeners.addOpenAddQuizModal();
      EventListeners.addAIEditListener();
      handleEditFocusParam();
    }
  };

  // ============================================
  // INITIALIZATION
  // ============================================
  const init = (testData, lang = 'en') => {
    state.test = testData;
    state.localLang = lang;
    state.newQuizzesIds = [];
    state.changedQuizzesIds = [];
    state.deletedQuizzesIds = [];

    EventListeners.addAll();
  };

  // ============================================
  // PUBLIC API
  // ============================================
  return {
    init,
    addAllEventListeners: EventListeners.addAll,
    getState: () => state,
    setState: (newState) => Object.assign(state, newState)
  };

})();

// ============================================
// GLOBAL COMPATIBILITY LAYER
// ============================================
// These global variables and functions maintain compatibility with existing code
// Use conditional assignment to avoid redeclaration errors

if (typeof test === 'undefined') var test;
if (typeof newQuizzesIds === 'undefined') var newQuizzesIds = [];
if (typeof changedQuizzesIds === 'undefined') var changedQuizzesIds = [];
if (typeof deletedQuizzesIds === 'undefined') var deletedQuizzesIds = [];
if (typeof saveButtons === 'undefined') var saveButtons = [];
if (typeof unsavedChanges === 'undefined') var unsavedChanges = false;
if (typeof isTestEditJSLoaded === 'undefined') var isTestEditJSLoaded = false;

// Global function for adding all event listeners
function addAllEditTestEventListeners() {
  // Sync globals to module state
  if (typeof test !== 'undefined' && test) {
    TestEditor.setState({
      test: test,
      localLang: (typeof localLang !== 'undefined' ? localLang : 'en'),
      newQuizzesIds: newQuizzesIds || [],
      changedQuizzesIds: changedQuizzesIds || [],
      deletedQuizzesIds: deletedQuizzesIds || []
    });
  }

  TestEditor.addAllEventListeners();

  // Ensure explanations are visible in edit mode (general-actions.js hides them by default)
  document.querySelectorAll('.quiz-explanation').forEach(el => el.classList.remove('is-hidden'));

  // Sync module state back to globals
  const state = TestEditor.getState();
  test = state.test;
  newQuizzesIds = state.newQuizzesIds;
  changedQuizzesIds = state.changedQuizzesIds;
  deletedQuizzesIds = state.deletedQuizzesIds;
  saveButtons = state.saveButtons;
  unsavedChanges = state.unsavedChanges;
}

// Mark as loaded
isTestEditJSLoaded = true;

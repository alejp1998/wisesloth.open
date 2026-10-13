/**
 * Test Creation Module
 * Handles all functionality for creating new tests from various sources
 */

const TestCreator = (function() {
  'use strict';

  // ============================================
  // CONFIGURATION & CONSTANTS
  // ============================================
  const CONFIG = {
    RANDOM_FACT_INTERVAL: 10, // seconds
    VALIDATION: {
      MIN_PAGES: 1,
      MAX_PAGES: 30,
      MIN_CHARS: 100,
      MAX_CHARS: 50000,
      MIN_INSTRUCTIONS_CHARS: 10,
      MIN_PERSONALITY_INSTRUCTIONS_CHARS: 30
    },
    PDF_WORKER_URL: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs',
    API_ENDPOINT: '/api/tests/new',
    API_ENDPOINT_FLASHCARDS: '/api/tests/new-flashcards',
    STORAGE_KEY: 'wisesloth_test_creation_settings'
  };

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const state = {
    isLocked: false,
    isRandomFactRunning: false,
    isNewTestModalAdPushed: false,
    pdf: {
      oldExam: { object: null, url: null, container: null, pages: null },
      notes: { object: null, url: null, container: null, pages: null }
    }
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
    wait: (seconds) => {
      const time = Math.max(seconds, 0);
      return new Promise(resolve => setTimeout(resolve, time * 1000));
    },

    countChars: (text) => (text || '').length,
    countWords: (text) => (text || '').split(/\s+/).filter(Boolean).length,

    sanitizeText: (text) => (text || '').replace(/\s+/g, ' ').trim(),

    createBilingualHTML: (en, es) => `
      <span lang="en">${en}</span>
      <span lang="es">${es}</span>
    `,

    showError: (container, enMsg, esMsg) => {
      DOM.show(container);
      DOM.setHTML(container, `<p>${Utils.createBilingualHTML(enMsg, esMsg)}</p>`);
    }
  };

  // ============================================
  // SETTINGS PERSISTENCE MODULE
  // ============================================
  const SettingsPersistence = {
    // Settings field mappings for each form type
    SETTINGS_MAP: {
      notes: {
        'notes-questions-select': 'nQuestions',
        'notes-options-select': 'nOptions',
        'notes-difficulty-select': 'difficulty'
      },
      creative: {
        'creative-language-select': 'language',
        'creative-questions-select': 'nQuestions',
        'creative-options-select': 'nOptions',
        'creative-difficulty-select': 'difficulty'
      },
      personality: {
        'personality-language-select': 'language',
        'personality-questions-select': 'nQuestions',
        'personality-options-select': 'nOptions'
      },
      flashcards: {
        'flashcards-cards-select': 'nCards'
      }
    },

    // Load saved settings from localStorage
    load: () => {
      try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        console.warn('Failed to load test creation settings:', e);
        return {};
      }
    },

    // Save settings to localStorage
    save: (formType, settings) => {
      try {
        const allSettings = SettingsPersistence.load();
        allSettings[formType] = { ...allSettings[formType], ...settings };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(allSettings));
      } catch (e) {
        console.warn('Failed to save test creation settings:', e);
      }
    },

    // Save current form values before submission
    saveFromForm: (formType) => {
      const fieldMap = SettingsPersistence.SETTINGS_MAP[formType];
      if (!fieldMap) return;

      const settings = {};
      Object.entries(fieldMap).forEach(([elementId, settingKey]) => {
        const element = DOM.get(elementId);
        if (element) {
          settings[settingKey] = element.value;
        }
      });

      SettingsPersistence.save(formType, settings);
    },

    // Apply saved settings to form fields
    applyToForm: (formType) => {
      const allSettings = SettingsPersistence.load();
      const savedSettings = allSettings[formType];
      if (!savedSettings) return;

      const fieldMap = SettingsPersistence.SETTINGS_MAP[formType];
      if (!fieldMap) return;

      Object.entries(fieldMap).forEach(([elementId, settingKey]) => {
        const element = DOM.get(elementId);
        const savedValue = savedSettings[settingKey];

        if (element && savedValue !== undefined) {
          // Check if the saved value exists in the select options
          if (element.tagName === 'SELECT') {
            const optionExists = Array.from(element.options).some(opt => opt.value === savedValue);
            if (optionExists) {
              element.value = savedValue;
            }
          } else {
            element.value = savedValue;
          }
        }
      });
    },

    // Apply all saved settings on initialization
    applyAll: () => {
      Object.keys(SettingsPersistence.SETTINGS_MAP).forEach(formType => {
        SettingsPersistence.applyToForm(formType);
      });
    },

    // Initialize change listeners to save settings on every change
    initChangeListeners: () => {
      Object.entries(SettingsPersistence.SETTINGS_MAP).forEach(([formType, fieldMap]) => {
        Object.entries(fieldMap).forEach(([elementId, settingKey]) => {
          const element = DOM.get(elementId);
          if (element) {
            element.addEventListener('change', () => {
              SettingsPersistence.save(formType, { [settingKey]: element.value });
            });
          }
        });
      });
    }
  };

  // ============================================
  // RANDOM FACTS MODULE
  // ============================================
  const RandomFacts = {
    start: () => {
      if (state.isRandomFactRunning) return;

      setInterval(() => {
        const processingOngoing = DOM.get('processing-ongoing');
        if (processingOngoing && !DOM.hasClass(processingOngoing, 'is-hidden')) {
          RandomFacts.display();
        }
      }, CONFIG.RANDOM_FACT_INTERVAL * 1000);

      state.isRandomFactRunning = true;
    },

    display: () => {
      if (!window.randomFacts?.length) return;

      const index = Math.floor(Math.random() * window.randomFacts.length);
      const fact = window.randomFacts[index];
      DOM.setHTML(DOM.get('processing-fact'), Utils.createBilingualHTML(fact.en, fact.es));
    }
  };

  // ============================================
  // PDF UPLOAD MODULE
  // ============================================
  const PDFUpload = {
    init: () => {
      if (typeof FilePond === 'undefined') return;

      FilePond.registerPlugin(FilePondPluginFileValidateSize);
      FilePond.registerPlugin(FilePondPluginFileValidateType);

      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.PDF_WORKER_URL;
      }
    },

    THUMBNAIL_MAX_WIDTH: 360,

    reset: () => {
      state.pdf = {
        oldExam: { object: null, url: null, pdfDoc: null, container: null, pages: null },
        notes: { object: null, url: null, pdfDoc: null, container: null, pages: null },
        flashcards: { object: null, url: null, pdfDoc: null, container: null, pages: null }
      };
    },

    getStateKey: (type) => type === 'oldexam' ? 'oldExam' : type,

    initialize: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      const container = DOM.get(`${type}-pdf-container`);
      const pages = DOM.get(`${type}-pdf-pages`);

      state.pdf[stateKey] = {
        ...state.pdf[stateKey],
        container,
        pages
      };

      const pond = FilePond.create(DOM.get(`${type}-file-input`), {
        allowMultiple: false,
        allowReplace: true,
        credits: false,
        labelIdle: Utils.createBilingualHTML(
          'Drag & Drop your PDF or <span class="filepond--label-action">Browse</span>',
          'Arrastra y suelta tu PDF o <span class="filepond--label-action">Busca</span>'
        ),
        allowFileSizeValidation: true,
        maxFileSize: '20MB',
        labelMaxFileSizeExceeded: 'File is too large',
        labelMaxFileSize: 'Maximum file size is 10MB',
        allowFileTypeValidation: true,
        acceptedFileTypes: ['application/pdf'],
        labelFileTypeNotAllowed: 'Please select a PDF file',
        fileValidateTypeLabelExpectedTypes: 'Expects .pdf'
      });

      pond.setOptions({
        onaddfile: (error, file) => !error && PDFUpload.handleFileAdd(type, file),
        onremovefile: (error, file) => !error && PDFUpload.handleFileRemove(type)
      });
    },

    handleFileAdd: (type, file) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];
      PDFUpload.releaseResources(type);

      pdfState.object = file.file;
      pdfState.url = URL.createObjectURL(file.file);

      pdfjsLib.getDocument({ url: pdfState.url, isEvalSupported: false }).promise
        .then(pdfDoc => {
          pdfState.pdfDoc = pdfDoc;
          return PDFUpload.renderPages(type, pdfDoc);
        })
        .then(() => PDFUpload.orderAndSelectPages(type))
        .catch(error => console.error('PDF error:', error));
    },

    handleFileRemove: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];
      PDFUpload.releaseResources(type);
      pdfState.object = null;

      if (pdfState.pages) pdfState.pages.innerHTML = '';
      DOM.hide(pdfState.container);
      PDFUpload.hideExtractedText(type);
    },

    // Revokes the blob URL and destroys the pdf.js document so decoded fonts/
    // pages don't linger in memory when a file is replaced or removed.
    releaseResources: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];
      if (pdfState.pdfDoc) {
        pdfState.pdfDoc.destroy();
        pdfState.pdfDoc = null;
      }
      if (pdfState.url) {
        URL.revokeObjectURL(pdfState.url);
        pdfState.url = null;
      }
    },

    renderPages: async (type, pdfDoc) => {
      const renderPromises = [];

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        renderPromises.push(
          pdfDoc.getPage(pageNum).then(page => {
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(1, PDFUpload.THUMBNAIL_MAX_WIDTH / baseViewport.width);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            return page.render({ canvasContext: context, viewport }).promise
              .then(() => {
                PDFUpload.createPageElement(type, pageNum, canvas);
                // Free the canvas's pixel backing store now that it's been
                // copied into a (much smaller) data URL image.
                canvas.width = 0;
                canvas.height = 0;
              });
          })
        );
      }

      return Promise.all(renderPromises);
    },

    createPageElement: (type, pageNum, canvas) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];

      const pageDiv = document.createElement('div');
      pageDiv.id = `pdf-page-${pageNum}`;
      pageDiv.className = 'pdf-page';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'select-page';
      checkbox.addEventListener('change', (e) => {
        pageDiv.classList.toggle('marked', e.target.checked);
        PDFUpload.extractTextFromSelected(type);
      });

      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      img.className = 'preview-image';

      pageDiv.append(img, checkbox);
      pdfState.pages.appendChild(pageDiv);
    },

    orderAndSelectPages: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];
      const pages = Array.from(pdfState.pages.querySelectorAll('.pdf-page'));

      pages.sort((a, b) => {
        const aNum = parseInt(a.id.split('-')[2]);
        const bNum = parseInt(b.id.split('-')[2]);
        return aNum - bNum;
      });

      pdfState.pages.innerHTML = '';
      pages.forEach(page => {
        pdfState.pages.appendChild(page);
        const pageNum = parseInt(page.id.split('-')[2]);
        if (pageNum < 10) {
          page.classList.add('marked');
          page.querySelector('.select-page').checked = true;
        }
      });

      DOM.show(pdfState.container);
      PDFUpload.extractTextFromSelected(type);

      if (typeof addPreviewImagesEventListeners === 'function') {
        addPreviewImagesEventListeners();
      }
    },

    extractTextFromSelected: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];

      if (!pdfState.pages || !pdfState.pdfDoc) return;

      const selectedPages = Array.from(pdfState.pages.querySelectorAll('.pdf-page.marked'));
      const pageNumbers = selectedPages.map(p => parseInt(p.id.split('-')[2]));

      const textPromises = pageNumbers.map(pageNum =>
        pdfState.pdfDoc.getPage(pageNum)
          .then(page => page.getTextContent())
          .then(content => content.items.map(item => item.str).join(' '))
      );

      Promise.all(textPromises).then(texts => {
        const fullText = Utils.sanitizeText(texts.join(' '));
        const textarea = DOM.get(`${type}-extracted-text`);
        if (textarea) textarea.value = fullText;
        DOM.show(DOM.get(`${type}-extracted-text-field`));
      });
    },

    hideExtractedText: (type) => {
      const textarea = DOM.get(`${type}-extracted-text`);
      if (textarea) textarea.value = '';
      DOM.hide(DOM.get(`${type}-extracted-text-field`));
    },

    getSelectedPagesCount: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      const pdfState = state.pdf[stateKey];
      if (!pdfState.pages) return 0;
      return pdfState.pages.querySelectorAll('.pdf-page.marked').length;
    },

    hasFile: (type) => {
      const stateKey = PDFUpload.getStateKey(type);
      return !!state.pdf[stateKey].url;
    }
  };

  // ============================================
  // CREATION GROUP NAVIGATION (Quiz/Test | Flashcards)
  // ============================================
  const GroupNavigation = {
    init: () => {
      DOM.getAll('.creation-group').forEach(btn => {
        btn.addEventListener('click', () => GroupNavigation.select(btn.dataset.group));
      });
    },

    select: (group) => {
      // Toggle group button states
      DOM.getAll('.creation-group').forEach(b => {
        if (b.dataset.group === group) DOM.addClass(b, 'is-active');
        else DOM.removeClass(b, 'is-active');
      });

      const quizBody = DOM.get('creation-quiz-group-body');
      const fcBody = DOM.get('creation-flashcards-group-body');

      if (group === 'flashcards') {
        DOM.addClass(quizBody, 'is-hidden');
        DOM.removeClass(fcBody, 'is-hidden');
        // Activate the flashcards tab through the existing tab system
        const fcToggle = DOM.get('tab-toggle-flashcards');
        if (fcToggle && typeof showTabContent === 'function') {
          showTabContent('tab-toggle-flashcards', 'tab-content-flashcards');
        }
      } else {
        DOM.removeClass(quizBody, 'is-hidden');
        DOM.addClass(fcBody, 'is-hidden');
        // Re-activate the current quiz subtab (oldexam / notes / creative)
        const activeQuizTab = quizBody.querySelector('.creation-tab.is-active');
        if (activeQuizTab && typeof showTabContent === 'function') {
          showTabContent(activeQuizTab.id, 'tab-content-' + activeQuizTab.id.split('-').slice(2).join('-'));
        }
      }

      const params = new URLSearchParams(window.location.search);
      params.set('group', group);
      window.history.replaceState({}, '', `${location.pathname}?${params}`);
    },

    selectFromURL: () => {
      const group = new URLSearchParams(window.location.search).get('group');
      if (group === 'flashcards') GroupNavigation.select('flashcards');
    }
  };

  // ============================================
  // TAB NAVIGATION MODULE
  // ============================================
  const TabNavigation = {
    addCardListeners: () => {
      DOM.getAll('.card.is-clickable').forEach(card => {
        card.addEventListener('click', () => TabNavigation.selectCard(card));
      });
    },

    selectCard: (selectedCard) => {
      DOM.getAll('.card.is-clickable').forEach(card => {
        if (card === selectedCard) {
          DOM.removeClass(card, 'is-unselected');

          const type = card.dataset.type;
          const params = new URLSearchParams(window.location.search);
          params.set('type', type);
          window.history.replaceState({}, '', `${location.pathname}?${params}`);

          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          DOM.get('tab-contents')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          DOM.addClass(card, 'is-unselected');
        }
      });
    },

    selectFromURL: () => {
      const type = new URLSearchParams(window.location.search).get('type');
      const cardMap = {
        oldexam: 'tab-toggle-oldexam',
        notes: 'tab-toggle-notes',
        instructions: 'tab-toggle-creative',
        personality: 'tab-toggle-personality',
        flashcards: 'tab-toggle-flashcards'
      };

      if (cardMap[type]) {
        DOM.get(cardMap[type])?.click();
      }
    }
  };

  // ============================================
  // HELP MODALS MODULE
  // ============================================
  const HelpModals = {
    init: () => {
      const modals = {
        '.from-old-exam-help': 'from-old-exam-help-modal',
        '.from-notes-or-text-help': 'from-notes-or-text-help-modal',
        '.from-instructions-help': 'from-instructions-help-modal',
        '.from-flashcards-help': 'from-flashcards-help-modal'
      };

      Object.entries(modals).forEach(([selector, modalId]) => {
        DOM.getAll(selector).forEach(btn => {
          btn.onclick = () => DOM.addClass(DOM.get(modalId), 'is-active');
        });
      });
    }
  };

  // ============================================
  // PROCESSING MODAL MODULE
  // ============================================
  const ProcessingModal = {
    show: () => {
      if (typeof restartStopwatch === 'function') {
        restartStopwatch();
      }

      DOM.addClass(DOM.get('processing-modal'), 'is-active');

    },

    hide: () => DOM.removeClass(DOM.get('processing-modal'), 'is-active'),

    showSuccess: (data, testType) => {
      DOM.setHTML(DOM.get('processing-succesful-title'), Utils.createBilingualHTML('All set!', '¡Todo listo!'));
      DOM.setHTML(DOM.get('processing-succesful-test-card'), data.testCardHTML);
      DOM.setHTML(DOM.get('processing-succesful-stats'), `<p>Estimated cost: $${Number(data.costUsd || 0).toFixed(6)} · Tokens: ${Number(data.tokensUsed || 0)}</p>`);

      const buttons = {
        try: { icon: 'fa-play', action: () => openModalTry(data.testId, testType, data.testName, data.nQuestions, window.username || 'Anonymous') },
        view: { icon: 'fa-eye', action: () => fetchBodyContent(`/tests/${data.testId}`) },
        edit: { icon: 'fa-edit', action: () => fetchBodyContent(`/tests/${data.testId}/edit`) }
      };

      Object.entries(buttons).forEach(([key, { icon, action }]) => {
        const btn = DOM.get(`processing-succesful-button-${key}`);
        // Flashcards have no "try" flow - hide that button for them
        if (testType === 'flashcards' && key === 'try') {
          DOM.hide(btn);
          return;
        }
        DOM.setHTML(btn, `<span class="icon"><i class="fas ${icon}"></i></span>`);
        btn.onclick = action;
      });

      DOM.hide(DOM.get('processing-ongoing'));
      DOM.show(DOM.get('processing-succesful'));

      if (typeof addAllEventListeners === 'function') {
        addAllEventListeners();
      }
    }
  };

  // ============================================
  // FORM VALIDATION MODULE
  // ============================================
  const Validation = {
    checkPageCount: (count, resultContainer) => {
      const { MIN_PAGES, MAX_PAGES } = CONFIG.VALIDATION;

      if (count < MIN_PAGES || count > MAX_PAGES) {
        Utils.showError(resultContainer,
          `Please select between ${MIN_PAGES} and ${MAX_PAGES} pages. ${count} pages were selected.`,
          `Por favor, seleccione entre ${MIN_PAGES} y ${MAX_PAGES} páginas. ${count} páginas fueron seleccionadas.`
        );
        return false;
      }
      return true;
    },

    checkCharCount: (text, resultContainer, isExtracted = false) => {
      const count = Utils.countChars(text);
      const { MIN_CHARS, MAX_CHARS } = CONFIG.VALIDATION;

      if (count < MIN_CHARS || count > MAX_CHARS) {
        const msgEn = isExtracted
          ? `Extracted text must contain between ${MIN_CHARS} and ${MAX_CHARS} characters. ${count} characters were extracted.`
          : `Text must contain between ${MIN_CHARS} and ${MAX_CHARS} characters. ${count} characters were entered.`;
        const msgEs = isExtracted
          ? `El texto extraído debe contener entre ${MIN_CHARS} y ${MAX_CHARS} caracteres. ${count} caracteres fueron extraídos.`
          : `El texto debe contener entre ${MIN_CHARS} y ${MAX_CHARS} caracteres. ${count} caracteres fueron introducidos.`;

        Utils.showError(resultContainer, msgEn, msgEs);
        return false;
      }
      return true;
    },

    checkInstructions: (text, resultContainer, minChars = CONFIG.VALIDATION.MIN_INSTRUCTIONS_CHARS) => {
      const count = Utils.countChars(text);

      if (count < minChars) {
        Utils.showError(resultContainer,
          `Instructions must contain at least ${minChars} characters. ${count} characters were entered.`,
          `Las instrucciones deben contener al menos ${minChars} caracteres. ${count} caracteres fueron introducidos.`
        );
        return false;
      }
      return true;
    }
  };

  // ============================================
  // TEST CREATION MODULE
  // ============================================
  const TestCreation = {
    createFromOldExam: async () => {
      const resultContainer = DOM.get('result-container-oldexam');
      DOM.hide(resultContainer);

      const formData = new FormData();
      formData.append('type', 'old-exam');

      const isPDFTab = !DOM.hasClass(DOM.get('tab-content-oldexamFromPDF'), 'is-hidden');

      if (isPDFTab) {
        if (!PDFUpload.hasFile('oldexam')) {
          Utils.showError(resultContainer, 'Please upload a PDF file.', 'Por favor, cargue un archivo PDF.');
          return;
        }

        const pageCount = PDFUpload.getSelectedPagesCount('oldexam');
        if (!Validation.checkPageCount(pageCount, resultContainer)) return;

        const text = DOM.get('oldexam-extracted-text')?.value || '';
        if (!Validation.checkCharCount(text, resultContainer, true)) return;

        formData.append('text', text);
      } else {
        const text = DOM.get('oldexam-content-input')?.value || '';
        const sourceUrl = DOM.get('oldexam-source-url')?.value.trim() || '';
        if (!sourceUrl && !Validation.checkCharCount(text, resultContainer)) return;
        formData.append('text', text);
        if (sourceUrl) formData.append('sourceUrl', sourceUrl);
      }

      await TestCreation.submitForm(formData, resultContainer, 'knowledge', true, CONFIG.API_ENDPOINT, 'oldexam');
    },

    createFromNotes: async () => {
      const resultContainer = DOM.get('result-container-notes');
      DOM.hide(resultContainer);

      const formData = new FormData();
      formData.append('type', 'notes');
      formData.append('nQuestions', DOM.get('notes-questions-select')?.value);
      formData.append('nOptions', DOM.get('notes-options-select')?.value);
      formData.append('difficulty', DOM.get('notes-difficulty-select')?.value);
      formData.append('instructions', DOM.get('notes-instructions-input')?.value || '');

      const isPDFTab = !DOM.hasClass(DOM.get('tab-content-notesFromPDF'), 'is-hidden');

      if (isPDFTab) {
        if (!PDFUpload.hasFile('notes')) {
          Utils.showError(resultContainer, 'Please upload a PDF file.', 'Por favor, cargue un archivo PDF.');
          return;
        }

        const pageCount = PDFUpload.getSelectedPagesCount('notes');
        if (!Validation.checkPageCount(pageCount, resultContainer)) return;

        const text = DOM.get('notes-extracted-text')?.value || '';
        if (!Validation.checkCharCount(text, resultContainer, true)) return;

        formData.append('text', text);
      } else {
        const text = DOM.get('notes-content-input')?.value || '';
        const sourceUrl = DOM.get('notes-source-url')?.value.trim() || '';
        if (!sourceUrl && !Validation.checkCharCount(text, resultContainer)) return;
        formData.append('text', text);
        if (sourceUrl) formData.append('sourceUrl', sourceUrl);
      }

      await TestCreation.submitForm(formData, resultContainer, 'knowledge', true, CONFIG.API_ENDPOINT, 'notes');
    },

    createFromScratch: async () => {
      const resultContainer = DOM.get('result-container-creative');
      DOM.hide(resultContainer);

      const instructions = DOM.get('creative-instructions-input')?.value || '';

      ProcessingModal.show();

      if (!Validation.checkInstructions(instructions, resultContainer)) {
        ProcessingModal.hide();
        return;
      }

      const formData = new FormData();
      formData.append('type', 'instructions');
      formData.append('language', DOM.get('creative-language-select')?.value);
      formData.append('nQuestions', DOM.get('creative-questions-select')?.value);
      formData.append('nOptions', DOM.get('creative-options-select')?.value);
      formData.append('difficulty', DOM.get('creative-difficulty-select')?.value);
      formData.append('instructions', instructions);

      await TestCreation.submitForm(formData, resultContainer, 'knowledge', false, CONFIG.API_ENDPOINT, 'instructions');
    },

    createPersonality: async () => {
      const resultContainer = DOM.get('result-container-personality');
      DOM.hide(resultContainer);

      const instructions = DOM.get('personality-instructions-input')?.value || '';

      if (!Validation.checkInstructions(instructions, resultContainer, CONFIG.VALIDATION.MIN_PERSONALITY_INSTRUCTIONS_CHARS)) {
        return;
      }

      ProcessingModal.show();

      const formData = new FormData();
      formData.append('type', 'personality');
      formData.append('language', DOM.get('personality-language-select')?.value);
      formData.append('nQuestions', DOM.get('personality-questions-select')?.value);
      formData.append('nOptions', DOM.get('personality-options-select')?.value);
      formData.append('instructions', instructions);

      await TestCreation.submitForm(formData, resultContainer, 'personality', false, CONFIG.API_ENDPOINT, 'personality');
    },

    createFlashcards: async () => {
      const resultContainer = DOM.get('result-container-flashcards');
      DOM.hide(resultContainer);

      const formData = new FormData();
      formData.append('type', 'flashcards');
      formData.append('nCards', DOM.get('flashcards-cards-select')?.value);
      formData.append('instructions', DOM.get('flashcards-instructions-input')?.value || '');

      const isPDFTab = !DOM.hasClass(DOM.get('tab-content-flashcardsFromPDF'), 'is-hidden');

      if (isPDFTab) {
        if (!PDFUpload.hasFile('flashcards')) {
          Utils.showError(resultContainer, 'Please upload a PDF file.', 'Por favor, cargue un archivo PDF.');
          return;
        }

        const pageCount = PDFUpload.getSelectedPagesCount('flashcards');
        if (!Validation.checkPageCount(pageCount, resultContainer)) return;

        const text = DOM.get('flashcards-extracted-text')?.value || '';
        if (!Validation.checkCharCount(text, resultContainer, true)) return;

        formData.append('text', text);
      } else {
        const text = DOM.get('flashcards-content-input')?.value || '';
        const sourceUrl = DOM.get('flashcards-source-url')?.value.trim() || '';
        if (!sourceUrl && !Validation.checkCharCount(text, resultContainer)) return;
        formData.append('text', text);
        if (sourceUrl) formData.append('sourceUrl', sourceUrl);
      }

      await TestCreation.submitForm(formData, resultContainer, 'flashcards', true, CONFIG.API_ENDPOINT_FLASHCARDS, 'flashcards');
    },

    submitForm: async (formData, resultContainer, testType, showModal = true, endpoint = CONFIG.API_ENDPOINT, configKey = '') => {
      // Attach the selected skills/preferences so the AI can tailor the creation
      // (always-applied skills + the ones active for this creation type)
      const selectedSkills = window.UserSkills ? await window.UserSkills.getSelectedAsync(configKey) : [];
      if (selectedSkills.length) {
        formData.append('skills', JSON.stringify(selectedSkills));
      }

      if (showModal) ProcessingModal.show();

      try {
        const response = await window.wsBrowserAI.fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.success) {
          ProcessingModal.showSuccess(data, testType);
        } else {
          ProcessingModal.hide();
          Utils.showError(resultContainer, data.error, data.error);
        }
      } catch (error) {
        console.error('Error:', error);
        ProcessingModal.hide();
        Utils.showError(resultContainer, error.message, error.message);
      }
    },

    setLanguageFromLocal: () => {
      // Only set language from browser locale if no saved preference exists
      const savedSettings = SettingsPersistence.load();

      const languageSelects = [
        { id: 'creative-language-select', formType: 'creative' },
        { id: 'personality-language-select', formType: 'personality' }
      ];

      languageSelects.forEach(({ id, formType }) => {
        const select = DOM.get(id);
        if (!select || !document.documentElement.lang) return;

        // Skip if user already has a saved language preference for this form
        if (savedSettings[formType]?.language) return;

        // Set language based on browser locale
        Array.from(select.options).forEach(opt => {
          if (opt.textContent.includes(`(${document.documentElement.lang})`)) {
            opt.selected = true;
          }
        });
      });
    }
  };

  // ============================================
  // BUTTON EVENT HANDLERS
  // ============================================
  const ButtonHandlers = {
    createClickHandler: (handler) => {
      let isProcessing = false;

      return async function(e) {
        if (isProcessing) return;
        isProcessing = true;

        try {
          await handler();
        } finally {
          isProcessing = false;
        }
      };
    },

    init: () => {
      const buttons = {
        'oldexam-test-button': TestCreation.createFromOldExam,
        'notes-test-button': TestCreation.createFromNotes,
        'creative-test-button': TestCreation.createFromScratch,
        'personality-test-button': TestCreation.createPersonality,
        'flashcards-test-button': TestCreation.createFlashcards
      };

      Object.entries(buttons).forEach(([id, handler]) => {
        const btn = DOM.get(id);
        if (btn) {
          btn.onclick = ButtonHandlers.createClickHandler(handler);
          btn.disabled = btn.dataset.canCreate !== 'true' && !window.wsBrowserAI?.isActive();
        }
      });
    }
  };

  // ============================================
  // FLASHCARDS → NOTES PREFILL
  // ============================================
  // When the user clicks "Make a test from these cards" on a flashcards view,
  // test-flashcards.js stores the card text in sessionStorage and navigates to
  // /tests/new?type=notes. Here we prefill the "From text" notes area so the
  // generated test is actually based on those cards.
  const FlashcardsPrefill = {
    consume: () => {
      let data = null;
      try {
        data = JSON.parse(sessionStorage.getItem('wisesloth_flashcards_to_notes') || 'null');
      } catch (e) {
        data = null;
      }
      if (!data || !data.text) return;

      const textarea = DOM.get('notes-content-input');
      if (textarea) {
        textarea.value = data.text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        // Switch the notes sub-tab to "From text" so the content is visible
        const fromTextTab = DOM.get('tab-toggle-notesFromText');
        if (fromTextTab && typeof showTabContent === 'function') {
          showTabContent('tab-toggle-notesFromText', 'tab-content-notesFromText');
        }
      }

      // Clean up so a manual revisit doesn't re-apply it
      try {
        sessionStorage.removeItem('wisesloth_flashcards_to_notes');
      } catch (e) { /* ignore */ }
    }
  };

  // ============================================
  // PUBLIC API
  // ============================================
  return {
    init: () => {
      // Creation groups (Quiz/Test | Flashcards)
      GroupNavigation.init();
      GroupNavigation.selectFromURL();

      // Tab navigation
      if (typeof addTabToggleEventListeners === 'function') {
        addTabToggleEventListeners();
      }
      TabNavigation.addCardListeners();
      TabNavigation.selectFromURL();

      // Prefill notes from flashcards (if we just came from a cards view)
      FlashcardsPrefill.consume();


      // PDF handling
      PDFUpload.init();
      PDFUpload.reset();
      PDFUpload.initialize('oldexam');
      PDFUpload.initialize('notes');
      PDFUpload.initialize('flashcards');

      // Help modals
      HelpModals.init();

      // Apply saved settings from localStorage (before language override)
      SettingsPersistence.applyAll();

      // Initialize change listeners to save settings on change
      SettingsPersistence.initChangeListeners();

      // Language selection (only override if no saved language setting)
      TestCreation.setLanguageFromLocal();

      // Button handlers
      ButtonHandlers.init();

      // Random facts
      RandomFacts.start();
    },

    // Safe re-init for AJAX re-visits (the full init runs once on first load).
    // Only re-selects the creation tab from the URL and consumes any pending
    // flashcards→notes prefill - everything here is idempotent on fresh DOM.
    safeReinit: () => {
      GroupNavigation.selectFromURL();
      if (typeof addTabToggleEventListeners === 'function') {
        addTabToggleEventListeners();
      }
      TabNavigation.selectFromURL();
      FlashcardsPrefill.consume();
    },

  };
})();

// ============================================
// GLOBAL EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================
var testCreationLocked = false;
var isReplaceRandomFactRunning = false;



function addAllNewTestEventListeners() {
  TestCreator.init();
}

// Expose a safe re-init so handleCurrentState can refresh the creation tab
// selection + consume a pending flashcards prefill on AJAX re-visits.
window.initNewTestView = function () {
  if (typeof TestCreator !== 'undefined' && TestCreator.safeReinit) {
    TestCreator.safeReinit();
  }
};

// Mark as loaded
var isTestNewJSLoaded = true;

/**
 * User Skills / Preferences
 *
 * A skill has 3 fields:
 *   - title      (the skill name, e.g. "Diagrams")
 *   - description (what the AI should actually do with it)
 *   - types      (semicolon-separated creation types it affects, or "always")
 *
 * Surfaces:
 *  1. Creation page (#skills-selector-container — the tiny button inside the
 *     creation-tabs row): opens #modal-skills with the current creation type
 *     preselected. A count badge shows how many skills are active for that type.
 *  2. Profile (#skills-editor-container): "Manage skills" button opens the same
 *     modal.
 *  3. #modal-skills: read / edit / add skills, separated into Default skills
 *     (view-only detail, per-user selection persisted in a cookie) and My
 *     skills (fully editable via /api/skills, persisted per user).
 *
 * Selection model: a skill applies to a creation type when its `types` include
 * that type or "always". For DEFAULT skills the per-user selection is stored in
 * a cookie (works without login); for OWN skills the types live in the DB.
 *
 * Exposes window.UserSkills = { reload, getSelectedAsync, openModal }.
 */
window.UserSkills = (function () {
  'use strict';

  const API = '/api/skills';
  const OVERRIDES_COOKIE = 'wisesloth_skill_config';
  // All config keys
  const TYPES = ['oldexam', 'notes', 'instructions', 'personality', 'flashcards', 'always'];
  // The visible creation types (used to normalize "all of them" back to "always")
  const VISIBLE_TYPES = ['oldexam', 'notes', 'instructions', 'flashcards'];
  // Human labels accepted in the types field
  const TYPE_ALIASES = {
    always: ['always', 'all', 'everywhere'],
    oldexam: ['oldexam', 'old exam', 'old-exam', 'exam'],
    notes: ['notes', 'note', 'text'],
    instructions: ['instructions', 'from scratch', 'scratch', 'creative'],
    flashcards: ['flashcards', 'flashcard'],
    personality: ['personality'],
  };

  // Per-row type icons shown on each skill item (the selection mechanism)
  const TYPE_ICONS = [
    { key: 'always', icon: 'fa-infinity', label: 'Always', labelEs: 'Siempre' },
    { key: 'oldexam', icon: 'fa-file-alt', label: 'Old Exam', labelEs: 'Examen Antiguo' },
    { key: 'notes', icon: 'fa-sticky-note', label: 'Notes', labelEs: 'Notas' },
    { key: 'instructions', icon: 'fa-magic', label: 'From Scratch', labelEs: 'Desde Cero' },
    { key: 'flashcards', icon: 'fa-layer-group', label: 'Flashcards', labelEs: 'Flashcards' },
  ];

  // ---------- module state ----------
  let loggedIn = false;
  let modalDefaults = [];      // [{title, description, types}]
  let ownSkillsCache = [];     // [{id, skill, description, types}]
  let defaultsOverrides = {};  // { [title]: 'types;...' } per-user selection for defaults (cookie)
  let dirtyOwn = {};           // { [id]: { title, desc, types } } pending own-skill edits
  let readyPromise = null;

  // ---------- helpers ----------

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function api(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  // Parse a semicolon-separated types string into a Set of canonical keys
  function parseTypes(str) {
    const keys = new Set();
    String(str || '').split(';').forEach((tok) => {
      const t = tok.trim().toLowerCase();
      if (!t) return;
      for (const [key, aliases] of Object.entries(TYPE_ALIASES)) {
        if (key === t || aliases.includes(t)) { keys.add(key); return; }
      }
    });
    return keys;
  }

  function canonicalTypesString(str) {
    return Array.from(parseTypes(str)).join(';');
  }

  // ---------- persistence ----------

  function saveOverridesCookie() {
    try {
      const val = encodeURIComponent(JSON.stringify(defaultsOverrides));
      document.cookie = OVERRIDES_COOKIE + '=' + val + '; path=/; max-age=31536000; SameSite=Lax';
    } catch (e) { /* ignore */ }
  }

  function loadOverridesCookie() {
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + OVERRIDES_COOKIE + '=([^;]*)'));
      if (!m) return {};
      const parsed = JSON.parse(decodeURIComponent(m[1]));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  // ---------- data loading ----------

  async function loadSkills() {
    ownSkillsCache = [];
    try {
      const res = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      ownSkillsCache = Array.isArray(data.skills) ? data.skills : [];
    } catch (e) {
      ownSkillsCache = [];
    }
  }

  function whenReady() {
    if (!loggedIn) return Promise.resolve();
    if (!readyPromise) {
      readyPromise = loadSkills().then(() => {
        renderSelectorBar();
        renderProfileButton();
      });
    }
    return readyPromise;
  }

  // ---------- selection logic ----------

  // Effective types for a DEFAULT skill: per-user cookie override or preset
  function defaultTypesFor(title) {
    if (defaultsOverrides[title] !== undefined) return parseTypes(defaultsOverrides[title]);
    const d = modalDefaults.find((x) => x.title === title);
    return parseTypes(d ? d.types : 'always');
  }

  function activeForDefault(title, type) {
    const keys = defaultTypesFor(title);
    return keys.has('always') || keys.has(type);
  }

  function activeForOwn(skill, type) {
    const keys = parseTypes(skill.types);
    return keys.has('always') || keys.has(type);
  }

  // Combined active skills for a creation type, formatted for the AI
  function computeSelected(configKey) {
    const out = [];
    const push = (title, desc) => {
      const s = desc ? (title + ': ' + desc) : title;
      if (!out.includes(s)) out.push(s);
    };
    modalDefaults.forEach((d) => { if (activeForDefault(d.title, configKey)) push(d.title, d.description); });
    ownSkillsCache.forEach((s) => { if (activeForOwn(s, configKey)) push(s.skill, s.description); });
    return out;
  }

  // Toggle a type in a keys set.
  //  - Checking "always": exclusive → only "always" applies (individual types drop).
  //  - Unchecking "always": deselects everything (skill applies to nothing).
  //  - Checking the final missing visible type: collapses the explicit list to "always".
  //  - Unchecking a specific type while "always" is on: turns "always" off and
  //    keeps every other type except the clicked one.
  function toggleTypes(keys, type, checked) {
    if (checked) {
      if (type === 'always') {
        // "Always" is exclusive: selecting it replaces the individual types
        keys.clear();
        keys.add('always');
      } else {
        keys.add(type);
        if (VISIBLE_TYPES.every((t) => keys.has(t))) {
          keys.clear();
          keys.add('always');
        }
      }
    } else {
      if (type === 'always') {
        // Turning "always" off deselects every type (nothing applies)
        keys.clear();
      } else if (keys.has('always')) {
        // Deactivating a specific type while "always" is on → explicit list without it
        keys.clear();
        VISIBLE_TYPES.forEach((t) => { if (t !== type) keys.add(t); });
      } else {
        keys.delete(type);
      }
    }
  }

  // Toggle a specific type on/off for a skill (the per-row icon clicks)
  function toggleSkill(kind, title, typeKey, checked) {
    if (kind === 'default') {
      const keys = defaultTypesFor(title);
      toggleTypes(keys, typeKey, checked);
      const next = Array.from(keys).join(';');
      const preset = modalDefaults.find((d) => d.title === title);
      const presetStr = canonicalTypesString(preset ? preset.types : 'always');
      if (canonicalTypesString(next) === presetStr) {
        delete defaultsOverrides[title];
      } else {
        defaultsOverrides[title] = next;
      }
      saveOverridesCookie();
    } else {
      const skill = ownSkillsCache.find((s) => s.title === title || s.skill === title);
      if (!skill) return;
      const keys = parseTypes(skill.types);
      toggleTypes(keys, typeKey, checked);
      skill.types = Array.from(keys).join(';');
      dirtyOwn[skill.id] = { title: skill.skill, desc: skill.description, types: skill.types };
    }
    renderSelectorBar();
    renderProfileButton();
  }

  // ---------- creation-page tiny button ----------

  // There can be several chips on the creation page (one per form, next to
  // each "Do the magic!" button) — they all share the .creation-skills-btn
  // class and carry the skills-mini-count badge. The profile editor button
  // (inside #skills-editor-container) also uses .creation-skills-btn but has
  // its own handler, so it is excluded here.
  function getSelectorContainers() {
    return Array.from(document.querySelectorAll('.creation-skills-btn'))
      .filter(el => !el.closest('#skills-editor-container'));
  }

  function getSelectorContainer() {
    return getSelectorContainers()[0] || null;
  }

  function getCurrentCreationType() {
    const activeTab = document.querySelector('.creation-tab.is-active');
    const t = activeTab ? activeTab.getAttribute('data-type') : null;
    return TYPES.includes(t) ? t : 'instructions';
  }

  function renderSelectorBar() {
    getSelectorContainers().forEach(container => {
      const countEl = container.querySelector('.skills-mini-count');
      if (countEl) {
        const count = computeSelected(getCurrentCreationType()).length;
        countEl.textContent = count > 0 ? String(count) : '';
      }
    });
  }

  function initSelectorBar() {
    getSelectorContainers().forEach(container => {
      if (container.dataset.barInit === '1') return;
      container.dataset.barInit = '1';

      // The tiny button itself opens the modal with the current creation type
      container.addEventListener('click', (e) => {
        e.preventDefault();
        openSkillsModal(getCurrentCreationType());
      });
    });

    // Keep the count badges in sync with the active creation tab
    const tabsContainer = document.querySelector('.creation-tabs');
    if (tabsContainer) {
      tabsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.creation-tab')) setTimeout(renderSelectorBar, 0);
      });
    }
  }

  // ---------- profile button ----------

  function getEditorContainer() {
    return document.getElementById('skills-editor-container');
  }

  function renderProfileButton() {
    const container = getEditorContainer();
    if (!container) return;
    const label = container.querySelector('#skills-profile-count');
    if (!label) return;
    // Same badge behavior as the create-view button: empty when there are no own skills
    label.textContent = ownSkillsCache.length > 0 ? String(ownSkillsCache.length) : '';
  }

  function initProfileButton() {
    const container = getEditorContainer();
    if (!container || container.dataset.profileInit === '1') return;
    container.dataset.profileInit = '1';
    const btn = container.querySelector('#open-skills-modal-btn');
    if (btn) btn.addEventListener('click', () => openSkillsModal('always'));
  }

  // ---------- modal ----------

  function getModal() {
    return document.getElementById('modal-skills');
  }

  function openSkillsModal(type) {
    const modalEl = getModal();
    if (!modalEl) return;
    modalEl.classList.add('is-active');
    document.documentElement.classList.add('is-clipped');
    whenReady().then(renderModal);
  }

  // Persist any pending changes (own-skill edits + default overrides) — called
  // whenever the modal closes, so no explicit Save button is needed.
  async function persistChanges() {
    if (loggedIn) {
      const ids = Object.keys(dirtyOwn);
      for (const id of ids) {
        const d = dirtyOwn[id];
        if (!d.title) continue;
        await api(API + '/' + id, 'PUT', { skill: d.title, description: d.desc, types: d.types });
      }
      dirtyOwn = {};
    }
    saveOverridesCookie();
    renderSelectorBar();
    renderProfileButton();
  }

  function closeSkillsModal() {
    const modalEl = getModal();
    if (!modalEl) return;
    modalEl.classList.remove('is-active');
    if (!document.querySelector('.modal.is-active')) {
      document.documentElement.classList.remove('is-clipped');
    }
    persistChanges();
  }

  function rowHtml(kind, title, description, typesSet, extra) {
    const desc = description || '';
    const shortDesc = desc.length > 60 ? desc.slice(0, 60) + '\u2026' : desc;
    // When "always" is active it is the only one shown active; the specific
    // type icons are deactivated. A divider separates "always" from the rest.
    const alwaysOn = typesSet.has('always');
    let iconsHtml = '';
    TYPE_ICONS.forEach((t, i) => {
      if (i === 1) iconsHtml += '<span class="skill-type-divider"></span>';
      const active = alwaysOn ? t.key === 'always' : typesSet.has(t.key);
      iconsHtml +=
        '<button type="button" class="skill-type-icon' + (active ? ' is-active' : '') + '" data-type="' + t.key + '" title="' + t.label + ' / ' + t.labelEs + '">' +
          '<i class="fas ' + t.icon + '"></i>' +
        '</button>';
    });
    return (
      '<div class="skill-checkbox-item" data-kind="' + kind + '" data-title="' + escapeHtml(title) + '" title="Click to view / edit">' +
        '<div class="skill-checkbox-body">' +
          '<span class="skill-checkbox-title">' + escapeHtml(title) + '</span>' +
          (shortDesc ? '<span class="skill-checkbox-desc">' + escapeHtml(shortDesc) + '</span>' : '') +
        '</div>' +
        '<span class="skill-type-icons" role="group" aria-label="Types">' + iconsHtml + '</span>' +
        (extra || '') +
      '</div>'
    );
  }

  function renderModal() {
    const modalEl = getModal();
    if (!modalEl || !modalEl.classList.contains('is-active')) return;
    closeDetail();

    // Context hint
    const context = modalEl.querySelector('#skills-modal-context');
    if (context) {
      context.innerHTML =
        '<span lang="en">Each skill shows the creation types it affects. Click a type icon to toggle it; click a skill to view / edit it.</span>' +
        '<span lang="es">Cada habilidad muestra los tipos de creación a los que afecta. Pulsa un icono de tipo para activarlo o desactivarlo; pulsa una habilidad para verla / editarla.</span>';
    }

    // Default skills
    const defaultsEl = modalEl.querySelector('#skills-modal-defaults');
    if (defaultsEl) {
      defaultsEl.innerHTML = modalDefaults.map((d) =>
        rowHtml('default', d.title, d.description, defaultTypesFor(d.title),
          '<span class="skill-example-badge"><span lang="en">example</span><span lang="es">ejemplo</span></span>')
      ).join('') || '<p class="is-size-7 has-text-grey"><span lang="en">No default skills.</span><span lang="es">No hay habilidades por defecto.</span></p>';
    }

    // My skills
    const ownEl = modalEl.querySelector('#skills-modal-own');
    if (ownEl) {
      ownEl.innerHTML = ownSkillsCache.map((s) =>
        rowHtml('own', s.skill, s.description, parseTypes(s.types), '')
      ).join('') || '<p class="is-size-7 has-text-grey"><span lang="en">No custom skills yet.</span><span lang="es">Aún no hay habilidades propias.</span></p>';
    }

    updateCounts();

    // Add form + login note
    const addRow = modalEl.querySelector('#skills-modal-add-row');
    const loginNote = modalEl.querySelector('#skills-modal-login-note');
    if (addRow) addRow.classList.toggle('is-hidden', !loggedIn);
    if (loginNote) loginNote.classList.toggle('is-hidden', loggedIn);
  }

  function updateCounts() {
    const modalEl = getModal();
    if (!modalEl) return;
    const dc = modalEl.querySelector('#skills-modal-defaults-count');
    if (dc) dc.textContent = String(modalDefaults.length);
    const oc = modalEl.querySelector('#skills-modal-own-count');
    if (oc) oc.textContent = String(ownSkillsCache.length);
  }

  // Update only a row's type icons (without re-rendering, so an open detail stays)
  function refreshRowIcons(kind, title) {
    const modalEl = getModal();
    if (!modalEl) return;
    const listId = kind === 'default' ? '#skills-modal-defaults' : '#skills-modal-own';
    const row = Array.from(modalEl.querySelectorAll(listId + ' .skill-checkbox-item')).find((r) => r.dataset.title === title);
    if (!row) return;
    const typesSet = kind === 'default'
      ? defaultTypesFor(title)
      : parseTypes((ownSkillsCache.find((s) => s.skill === title) || {}).types || '');
    const alwaysOn = typesSet.has('always');
    row.querySelectorAll('.skill-type-icon').forEach((ic) => {
      ic.classList.toggle('is-active', alwaysOn ? ic.dataset.type === 'always' : typesSet.has(ic.dataset.type));
    });
  }

  // ---------- skill detail panel (view for defaults, edit for own) ----------

  let openDetailEl = null;
  let openDetailRow = null;

  function clearRowHighlight() {
    const modalEl = getModal();
    if (!modalEl) return;
    modalEl.querySelectorAll('.skill-checkbox-item.is-selected').forEach((r) => r.classList.remove('is-selected'));
  }

  function closeDetail() {
    if (openDetailEl) {
      openDetailEl.remove();
      openDetailEl = null;
    }
    const modalEl = getModal();
    if (modalEl) {
      const pane = modalEl.querySelector('#skills-detail-pane');
      if (pane) pane.innerHTML = '';
    }
    clearRowHighlight();
    openDetailRow = null;
  }

  // Build the detail panel element for a skill (view-only for defaults)
  function buildDetail(kind, title) {
    const modalEl = getModal();
    let detail;
    if (kind === 'default') {
      const d = modalDefaults.find((x) => x.title === title) || { title, description: '', types: '' };
      detail = document.createElement('div');
      detail.className = 'skill-detail-panel';
      detail.innerHTML =
        '<p class="skill-detail-label"><span lang="en">Title</span><span lang="es">Título</span></p>' +
        '<input class="input is-small" readonly value="' + escapeHtml(d.title) + '">' +
        '<p class="skill-detail-label"><span lang="en">Description</span><span lang="es">Descripción</span></p>' +
        '<textarea class="textarea is-small skill-detail-desc" readonly rows="12">' + escapeHtml(d.description || '') + '</textarea>' +
        '<p class="help"><span lang="en">Default skills can\u2019t be edited. You can only toggle which creation types they affect with the icons in the list.</span><span lang="es">Las habilidades por defecto no se pueden editar. Solo puedes cambiar los tipos de creación a los que afectan con los iconos de la lista.</span></p>';
    } else {
      const s = ownSkillsCache.find((x) => x.skill === title) || ownSkillsCache.find((x) => x.title === title);
      if (!s) return null;
      detail = document.createElement('div');
      detail.className = 'skill-detail-panel';
      detail.innerHTML =
        '<p class="skill-detail-label"><span lang="en">Title</span><span lang="es">Título</span></p>' +
        '<input class="input is-small skill-detail-title" maxlength="200" value="' + escapeHtml(s.skill) + '">' +
        '<p class="skill-detail-label"><span lang="en">Description (what it should do)</span><span lang="es">Descripción (qué debe hacer)</span></p>' +
        '<textarea class="textarea is-small skill-detail-desc" rows="12" maxlength="1000">' + escapeHtml(s.description || '') + '</textarea>' +
        '<p class="help"><span lang="en">Changes are saved automatically when you close this window. Toggle which creation types this skill affects with the icons in the list.</span><span lang="es">Los cambios se guardan automáticamente al cerrar esta ventana. Cambia los tipos de creación a los que afecta esta habilidad con los iconos de la lista.</span></p>' +
        '<div class="buttons is-right skill-detail-actions">' +
          '<button type="button" class="button is-small is-danger is-light skill-detail-delete"><span lang="en">Delete</span><span lang="es">Eliminar</span></button>' +
        '</div>';
      const deleteBtn = detail.querySelector('.skill-detail-delete');
      const titleInput = detail.querySelector('.skill-detail-title');
      const descInput = detail.querySelector('.skill-detail-desc');
      // Capture edits live so they persist when the modal closes
      titleInput.addEventListener('input', () => {
        s.skill = titleInput.value.trim();
        dirtyOwn[s.id] = { title: s.skill, desc: s.description, types: s.types };
      });
      descInput.addEventListener('input', () => {
        s.description = descInput.value.trim();
        dirtyOwn[s.id] = { title: s.skill, desc: s.description, types: s.types };
      });
      deleteBtn.addEventListener('click', async () => {
        if (!window.confirm('Delete this skill?')) return;
        const data = await api(API + '/' + s.id, 'DELETE');
        if (data.success) {
          const idx = ownSkillsCache.findIndex((x) => x.id === s.id);
          if (idx !== -1) ownSkillsCache.splice(idx, 1);
          delete dirtyOwn[s.id];
          renderModal();
        }
      });
    }
    return detail;
  }

  // Open the detail: desktop renders it in the right pane (row highlighted),
  // mobile inserts it inline under the tapped row.
  function openDetail(kind, title) {
    closeDetail();
    const modalEl = getModal();
    const listId = kind === 'default' ? '#skills-modal-defaults' : '#skills-modal-own';
    const listEl = modalEl.querySelector(listId);
    const row = Array.from(listEl.querySelectorAll('.skill-checkbox-item')).find((r) => r.dataset.title === title);
    if (!row) return;

    const detail = buildDetail(kind, title);
    if (!detail) return;

    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    if (isDesktop) {
      row.classList.add('is-selected');
      openDetailRow = row;
      const pane = modalEl.querySelector('#skills-detail-pane');
      if (pane) pane.appendChild(detail);
    } else {
      row.after(detail);
    }
    openDetailEl = detail;
  }

  // ---------- modal init ----------

  function initModal() {
    const modalEl = getModal();
    if (!modalEl || modalEl.dataset.modalInit === '1') return;
    modalEl.dataset.modalInit = '1';

    // Collapsible sections
    modalEl.querySelectorAll('.skills-modal-section-title').forEach((title) => {
      title.addEventListener('click', () => {
        const section = title.closest('.skills-modal-section');
        const collapsed = section.classList.toggle('is-collapsed');
        title.setAttribute('aria-expanded', String(!collapsed));
      });
    });

    // Icon clicks toggle a type (without closing an open detail); row clicks open the detail
    const defaultsList = modalEl.querySelector('#skills-modal-defaults');
    const ownList = modalEl.querySelector('#skills-modal-own');
    const bindList = (listEl, kind) => {
      if (!listEl) return;
      listEl.addEventListener('click', (e) => {
        const icon = e.target.closest('.skill-type-icon');
        if (icon) {
          const row = icon.closest('.skill-checkbox-item');
          if (!row) return;
          const title = row.dataset.title;
          const typeKey = icon.dataset.type;
          const typesSet = kind === 'default'
            ? defaultTypesFor(title)
            : parseTypes((ownSkillsCache.find((s) => s.skill === title) || {}).types || '');
          // Click semantics:
          //  - "always" icon: activates always when off; when on, deselects ALL.
          //  - specific type while "always" is on: turns always off AND that
          //    type off (explicit list without it).
          //  - specific type while "always" is off: plain toggle of that type
          //    (checking the last one collapses back to "always").
          const alwaysOn = typesSet.has('always');
          let checked;
          if (typeKey === 'always') {
            checked = !alwaysOn;
          } else if (alwaysOn) {
            checked = false;
          } else {
            checked = !typesSet.has(typeKey);
          }
          toggleSkill(kind, title, typeKey, checked);
          refreshRowIcons(kind, title);
          updateCounts();
          return;
        }
        const row = e.target.closest('.skill-checkbox-item');
        if (row) openDetail(kind, row.dataset.title);
      });
    };
    bindList(defaultsList, 'default');
    bindList(ownList, 'own');

    // Add skill (title + description + types)
    const addBtn = modalEl.querySelector('#skills-modal-add-btn');
    const addTitle = modalEl.querySelector('#skills-modal-add-title');
    const addDesc = modalEl.querySelector('#skills-modal-add-desc');
    const addTypes = modalEl.querySelector('#skills-modal-add-types');
    const addSkill = async () => {
      const title = (addTitle.value || '').trim();
      if (!title) { addTitle.focus(); return; }
      const desc = (addDesc.value || '').trim();
      const types = canonicalTypesString(addTypes.value) || 'always';
      const data = await api(API, 'POST', { skill: title, description: desc, types });
      if (data.success) {
        ownSkillsCache.push({ id: data.skill.id, skill: data.skill.skill, description: data.skill.description, types: data.skill.types });
        addTitle.value = '';
        addDesc.value = '';
        addTypes.value = '';
        renderModal();
      }
    };
    if (addBtn) addBtn.addEventListener('click', addSkill);
    if (addTitle) addTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSkill(); });

    // Done / close: closing the modal persists any pending changes
    const doneBtn = modalEl.querySelector('#skills-modal-done');
    if (doneBtn) doneBtn.addEventListener('click', closeSkillsModal);

    // Close: delete button, background, cancel, Escape
    const closeBtn = modalEl.querySelector('.modal-delete');
    if (closeBtn) closeBtn.addEventListener('click', closeSkillsModal);
    const cancelBtn = modalEl.querySelector('.modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSkillsModal);
    modalEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-background')) closeSkillsModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.classList.contains('is-active')) closeSkillsModal();
    });
  }

  // ---------- public API ----------

  function reload() {
    const selectorContainer = getSelectorContainer();
    const editorContainer = getEditorContainer();
    const container = selectorContainer || editorContainer;
    if (!container) return;

    const readDefaults = (el) => {
      try { return JSON.parse(el.dataset.defaults || '[]'); } catch (e) { return []; }
    };

    if (selectorContainer) {
      loggedIn = selectorContainer.dataset.loggedIn === 'true';
      modalDefaults = readDefaults(selectorContainer);
    } else {
      loggedIn = true;
      modalDefaults = readDefaults(editorContainer);
    }

    defaultsOverrides = loadOverridesCookie();
    dirtyOwn = {};

    initModal();
    initSelectorBar();
    initProfileButton();
    renderSelectorBar();
    renderProfileButton();
    whenReady();
  }

  // Combined active skills for a creation type (always + type-specific),
  // formatted as "Title: description" for the AI prompt
  async function getSelectedAsync(configKey) {
    await whenReady();
    return computeSelected(configKey);
  }

  // Open the skills modal for a given type (e.g. 'oldexam', 'always')
  function openModal(type) {
    return openSkillsModal(type);
  }

  // Auto-init on first full page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reload);
  } else {
    reload();
  }

  return { reload, getSelectedAsync, openModal };
})();

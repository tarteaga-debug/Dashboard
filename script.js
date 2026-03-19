/* ═══════════════════════════════════════════════════
   RESEARCH COMMAND CENTER — script.js
   AI-Assisted Sewing Patternmaking Dashboard
═══════════════════════════════════════════════════ */

'use strict';

/* ─── STORAGE HELPERS ─── */
const store = {
    get: (key, fallback = null) => {
        try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
        catch { return fallback; }
    },
    set: (key, value) => {
        try { localStorage.setItem(key, JSON.stringify(value)); }
        catch (e) { console.warn('localStorage write failed:', e); }
    }
};

/* ─── ID GENERATOR ─── */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ─── DATE HELPERS ─── */
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function today() { return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }

/* ─── SIDEBAR NAVIGATION ─── */
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');
const dateDisplay = document.getElementById('currentDate');

if (dateDisplay) dateDisplay.textContent = today();

function activateSection(sectionId) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.section === sectionId));
    sections.forEach(s => {
        const isTarget = s.id === 'section-' + sectionId;
        if (isTarget) {
            s.classList.add('active');
            // trigger CSS transition
            requestAnimationFrame(() => { s.style.opacity = '1'; s.style.transform = 'translateY(0)'; });
        } else {
            s.classList.remove('active');
        }
    });
    store.set('activeSection', sectionId);
}

navItems.forEach(item => {
    item.addEventListener('click', () => activateSection(item.dataset.section));
});

/* ─── MODAL HELPERS ─── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

/* ─── DELETE CONFIRMATION ─── */
let pendingDelete = null;

function confirmDelete(callback) {
    pendingDelete = callback;
    openModal('confirmModal');
}

document.getElementById('closeConfirmModal').addEventListener('click', () => closeModal('confirmModal'));
document.getElementById('cancelDeleteBtn').addEventListener('click', () => { pendingDelete = null; closeModal('confirmModal'); });
document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    if (pendingDelete) { pendingDelete(); pendingDelete = null; }
    closeModal('confirmModal');
});

/* ══════════════════════════════════════════════════
   SECTION 1 — PROJECT OVERVIEW
══════════════════════════════════════════════════ */
const OV_FIELDS = ['ov-focus', 'ov-question', 'ov-goals', 'ov-deliverable', 'ov-status', 'ov-phase', 'ov-deadline'];

function initOverview() {
    const saved = store.get('overview', {});
    OV_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && saved[id] !== undefined) el.value = saved[id];
        if (el) el.addEventListener('input', saveOverview);
        if (el) el.addEventListener('change', saveOverview);
    });

    // Progress slider
    const slider = document.getElementById('progressSlider');
    const bar = document.getElementById('progressBar');
    const valueEl = document.getElementById('progressValue');

    const prog = store.get('overviewProgress', 0);
    slider.value = prog;
    bar.style.width = prog + '%';
    valueEl.textContent = prog + '%';

    slider.addEventListener('input', () => {
        bar.style.width = slider.value + '%';
        valueEl.textContent = slider.value + '%';
        store.set('overviewProgress', Number(slider.value));
    });
}

function saveOverview() {
    const data = {};
    OV_FIELDS.forEach(id => { const el = document.getElementById(id); if (el) data[id] = el.value; });
    store.set('overview', data);
}

/* ══════════════════════════════════════════════════
   SECTION 2 — READING LIBRARY
══════════════════════════════════════════════════ */
let sources = store.get('sources', []);
let editingSourceId = null;

function saveSources() { store.set('sources', sources); }

function renderSources() {
    const grid = document.getElementById('sourcesGrid');
    const statusF = document.getElementById('filterStatus').value;
    const tagF = document.getElementById('filterTag').value.trim().toLowerCase();

    let filtered = sources.filter(s => {
        const matchStatus = statusF === 'all' || s.status === statusF;
        const matchTag = !tagF || (s.tags || []).some(t => t.toLowerCase().includes(tagF));
        return matchStatus && matchTag;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">◉</div>
      <div class="empty-state-text">No sources yet — add your first research entry</div>
    </div>`;
        return;
    }

    grid.innerHTML = filtered.map(s => `
    <div class="luxury-card source-card" data-id="${s.id}">
      <div class="source-card-header">
        <div>
          <div class="source-card-title">${esc(s.title)}</div>
          ${s.author ? `<div class="source-card-author">${esc(s.author)}</div>` : ''}
        </div>
        <div class="source-card-actions">
          <button class="btn-icon edit-source" data-id="${s.id}" title="Edit">✎</button>
          <button class="btn-icon delete delete-source" data-id="${s.id}" title="Delete">✕</button>
        </div>
      </div>
      <div>
        <span class="source-status-badge badge-${s.status}">${s.status}</span>
      </div>
      ${s.tags && s.tags.length ? `<div class="source-tags">${s.tags.map(t => `<span class="source-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${s.link ? `<a class="source-link" href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.link)}</a>` : ''}
      ${s.notes ? `<div class="source-notes">${esc(s.notes)}</div>` : ''}
    </div>
  `).join('');

    grid.querySelectorAll('.edit-source').forEach(btn => {
        btn.addEventListener('click', () => openSourceModal(btn.dataset.id));
    });
    grid.querySelectorAll('.delete-source').forEach(btn => {
        btn.addEventListener('click', () => {
            confirmDelete(() => {
                sources = sources.filter(s => s.id !== btn.dataset.id);
                saveSources(); renderSources();
            });
        });
    });
}

function openSourceModal(id = null) {
    editingSourceId = id;
    const modal = document.getElementById('sourceModal');
    document.getElementById('sourceModalTitle').textContent = id ? 'Edit Source' : 'Add Source';
    const fields = ['src-title', 'src-author', 'src-link', 'src-tags', 'src-status', 'src-notes'];

    if (id) {
        const s = sources.find(x => x.id === id);
        if (s) {
            document.getElementById('src-title').value = s.title || '';
            document.getElementById('src-author').value = s.author || '';
            document.getElementById('src-link').value = s.link || '';
            document.getElementById('src-tags').value = (s.tags || []).join(', ');
            document.getElementById('src-status').value = s.status || 'unread';
            document.getElementById('src-notes').value = s.notes || '';
        }
    } else {
        fields.forEach(f => { const el = document.getElementById(f); if (el) el.value = f === 'src-status' ? 'unread' : ''; });
    }
    openModal('sourceModal');
}

function saveSource() {
    const title = document.getElementById('src-title').value.trim();
    if (!title) { alert('Please enter a title.'); return; }

    const entry = {
        id: editingSourceId || uid(),
        title: title,
        author: document.getElementById('src-author').value.trim(),
        link: document.getElementById('src-link').value.trim(),
        tags: document.getElementById('src-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        status: document.getElementById('src-status').value,
        notes: document.getElementById('src-notes').value.trim(),
        updatedAt: new Date().toISOString()
    };

    if (editingSourceId) {
        sources = sources.map(s => s.id === editingSourceId ? entry : s);
    } else {
        entry.createdAt = entry.updatedAt;
        sources.unshift(entry);
    }
    saveSources(); renderSources(); closeModal('sourceModal');
}

function initLibrary() {
    document.getElementById('addSourceBtn').addEventListener('click', () => openSourceModal());
    document.getElementById('closeSourceModal').addEventListener('click', () => closeModal('sourceModal'));
    document.getElementById('cancelSourceModal').addEventListener('click', () => closeModal('sourceModal'));
    document.getElementById('saveSourceBtn').addEventListener('click', saveSource);
    document.getElementById('filterStatus').addEventListener('change', renderSources);
    document.getElementById('filterTag').addEventListener('input', renderSources);
    renderSources();
}

/* ══════════════════════════════════════════════════
   SECTION 3 — WEEKLY PLAN (Weeks 5–11)
══════════════════════════════════════════════════ */
const DEFAULT_WEEKS = [
    { week: 5, goal: 'Literature review & research foundation', tasks: ['Identify 10 key sources', 'Map AI patternmaking landscape', 'Set up research database'] },
    { week: 6, goal: 'Deep dive reading & source annotation', tasks: ['Annotate all sources in library', 'Draft research question', 'Create concept map'] },
    { week: 7, goal: 'AI tool exploration & first prompts', tasks: ['Test 3+ AI tools for drafting', 'Log initial prompt experiments', 'Document tool affordances'] },
    { week: 8, goal: 'Pattern prototyping with AI assistance', tasks: ['Generate first AI-assisted draft', 'Compare to manual pattern', 'Photograph prototype'] },
    { week: 9, goal: 'Iteration & analysis', tasks: ['Refine pattern based on feedback', 'Document iteration process', 'Begin writing methods section'] },
    { week: 10, goal: 'Writing, synthesis & revision', tasks: ['Draft full findings section', 'Integrate visual documentation', 'Peer review draft'] },
    { week: 11, goal: 'Final deliverable & presentation', tasks: ['Finalize written report', 'Prepare presentation materials', 'Submit final project'] },
];

let weeksData = store.get('weeksData', null);
if (!weeksData) {
    weeksData = DEFAULT_WEEKS.map(w => ({ ...w, done: [], notes: '' }));
    store.set('weeksData', weeksData);
}

function saveWeeks() { store.set('weeksData', weeksData); updateTimeline(); }

function updateTimeline() {
    let totalTasks = 0, doneTasks = 0;
    weeksData.forEach(w => { totalTasks += w.tasks.length; doneTasks += w.done.length; });
    const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
    document.getElementById('timelineFill').style.width = pct + '%';
}

function renderWeeks() {
    const grid = document.getElementById('weeksGrid');
    grid.innerHTML = weeksData.map((w, wi) => {
        const pct = w.tasks.length ? Math.round((w.done.length / w.tasks.length) * 100) : 0;
        return `
    <div class="luxury-card week-card" data-wi="${wi}">
      <div class="week-card-header">
        <span class="week-number">Week ${w.week}</span>
        <span class="week-progress">${w.done.length}/${w.tasks.length} tasks · ${pct}%</span>
      </div>
      <div class="week-goal">${esc(w.goal)}</div>
      <ul class="task-list">
        ${w.tasks.map((task, ti) => {
            const isDone = w.done.includes(ti);
            return `<li class="task-item" data-wi="${wi}" data-ti="${ti}">
            <div class="task-checkbox ${isDone ? 'checked' : ''}"></div>
            <span class="task-label ${isDone ? 'done' : ''}">${esc(task)}</span>
            <button class="btn-icon delete remove-task" data-wi="${wi}" data-ti="${ti}" title="Remove task">✕</button>
          </li>`;
        }).join('')}
      </ul>
      <div class="week-add-task">
        <input type="text" class="luxury-input new-task-input" placeholder="Add a task…" data-wi="${wi}" />
        <button class="btn-gold add-task-btn" data-wi="${wi}">Add</button>
      </div>
      <div class="week-notes luxury-card" style="padding:12px;margin-top:12px;background:rgba(0,0,0,0.2)">
        <label class="field-label" style="margin-top:0">NOTES</label>
        <textarea class="luxury-textarea week-note-area" data-wi="${wi}" rows="2" placeholder="Week notes…">${esc(w.notes || '')}</textarea>
      </div>
    </div>`;
    }).join('');

    // Task checkboxes
    grid.querySelectorAll('.task-item').forEach(item => {
        item.querySelector('.task-checkbox').addEventListener('click', (e) => {
            e.stopPropagation();
            const wi = Number(item.dataset.wi), ti = Number(item.dataset.ti);
            const idx = weeksData[wi].done.indexOf(ti);
            if (idx > -1) weeksData[wi].done.splice(idx, 1);
            else weeksData[wi].done.push(ti);
            saveWeeks(); renderWeeks();
        });
    });

    // Remove task
    grid.querySelectorAll('.remove-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wi = Number(btn.dataset.wi), ti = Number(btn.dataset.ti);
            weeksData[wi].tasks.splice(ti, 1);
            weeksData[wi].done = weeksData[wi].done.filter(d => d !== ti).map(d => d > ti ? d - 1 : d);
            saveWeeks(); renderWeeks();
        });
    });

    // Add task
    grid.querySelectorAll('.add-task-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const wi = Number(btn.dataset.wi);
            const input = grid.querySelector(`.new-task-input[data-wi="${wi}"]`);
            const text = input.value.trim();
            if (!text) return;
            weeksData[wi].tasks.push(text);
            input.value = '';
            saveWeeks(); renderWeeks();
        });
    });

    // Also allow Enter in task input
    grid.querySelectorAll('.new-task-input').forEach(input => {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const wi = Number(input.dataset.wi);
                const text = input.value.trim();
                if (!text) return;
                weeksData[wi].tasks.push(text);
                input.value = '';
                saveWeeks(); renderWeeks();
            }
        });
    });

    // Notes
    grid.querySelectorAll('.week-note-area').forEach(area => {
        area.addEventListener('input', () => {
            const wi = Number(area.dataset.wi);
            weeksData[wi].notes = area.value;
            store.set('weeksData', weeksData);
        });
    });

    updateTimeline();
}

function initWeekly() { renderWeeks(); }

/* ══════════════════════════════════════════════════
   SECTION 4 — PROMPT LOG
══════════════════════════════════════════════════ */
let prompts = store.get('prompts', []);
let editingPromptId = null;

function savePrompts() { store.set('prompts', prompts); }

function renderPrompts() {
    const list = document.getElementById('promptsList');
    if (!prompts.length) {
        list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">◎</div>
      <div class="empty-state-text">No prompt entries yet — log your first AI experiment</div>
    </div>`;
        return;
    }

    list.innerHTML = prompts.map(p => `
    <div class="luxury-card prompt-card" data-id="${p.id}">
      <div class="prompt-card-header">
        <div class="prompt-meta">
          <span class="prompt-timestamp">${formatDate(p.createdAt)}</span>
          ${p.model ? `<span class="prompt-model-badge">${esc(p.model)}</span>` : ''}
        </div>
        <div class="prompt-card-actions">
          <button class="btn-icon edit-prompt" data-id="${p.id}" title="Edit">✎</button>
          <button class="btn-icon delete delete-prompt" data-id="${p.id}" title="Delete">✕</button>
        </div>
      </div>
      <div class="prompt-text-label">Prompt</div>
      <div class="prompt-text">${esc(p.prompt)}</div>
      ${p.output ? `<div class="prompt-field">
        <div class="prompt-field-label">Output Summary</div>
        <div class="prompt-field-value">${esc(p.output)}</div>
      </div>` : ''}
      ${p.next ? `<div class="prompt-field">
        <div class="prompt-field-label">What I Changed Next</div>
        <div class="prompt-field-value">${esc(p.next)}</div>
      </div>` : ''}
    </div>
  `).join('');

    list.querySelectorAll('.edit-prompt').forEach(btn => {
        btn.addEventListener('click', () => openPromptModal(btn.dataset.id));
    });
    list.querySelectorAll('.delete-prompt').forEach(btn => {
        btn.addEventListener('click', () => {
            confirmDelete(() => {
                prompts = prompts.filter(p => p.id !== btn.dataset.id);
                savePrompts(); renderPrompts();
            });
        });
    });
}

function openPromptModal(id = null) {
    editingPromptId = id;
    document.getElementById('promptModalTitle').textContent = id ? 'Edit Prompt Entry' : 'New Prompt Entry';
    if (id) {
        const p = prompts.find(x => x.id === id);
        if (p) {
            document.getElementById('pr-prompt').value = p.prompt || '';
            document.getElementById('pr-model').value = p.model || '';
            document.getElementById('pr-output').value = p.output || '';
            document.getElementById('pr-next').value = p.next || '';
        }
    } else {
        ['pr-prompt', 'pr-model', 'pr-output', 'pr-next'].forEach(f => document.getElementById(f).value = '');
    }
    openModal('promptModal');
}

function savePrompt() {
    const prompt = document.getElementById('pr-prompt').value.trim();
    if (!prompt) { alert('Please enter a prompt.'); return; }

    const entry = {
        id: editingPromptId || uid(),
        prompt: prompt,
        model: document.getElementById('pr-model').value.trim(),
        output: document.getElementById('pr-output').value.trim(),
        next: document.getElementById('pr-next').value.trim(),
        updatedAt: new Date().toISOString()
    };

    if (editingPromptId) {
        prompts = prompts.map(p => p.id === editingPromptId ? { ...p, ...entry } : p);
    } else {
        entry.createdAt = entry.updatedAt;
        prompts.unshift(entry);
    }
    savePrompts(); renderPrompts(); closeModal('promptModal');
}

function initPrompts() {
    document.getElementById('addPromptBtn').addEventListener('click', () => openPromptModal());
    document.getElementById('closePromptModal').addEventListener('click', () => closeModal('promptModal'));
    document.getElementById('cancelPromptModal').addEventListener('click', () => closeModal('promptModal'));
    document.getElementById('savePromptBtn').addEventListener('click', savePrompt);
    renderPrompts();
}

/* ══════════════════════════════════════════════════
   SECTION 5 — EXPERIMENT LOG
══════════════════════════════════════════════════ */
let experiments = store.get('experiments', []);
let editingExperimentId = null;

function saveExperiments() { store.set('experiments', experiments); }

function renderExperiments() {
    const list = document.getElementById('experimentsList');
    if (!experiments.length) {
        list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">◉</div>
      <div class="empty-state-text">No experiments yet — document your first hands-on exploration</div>
    </div>`;
        return;
    }

    list.innerHTML = experiments.map(exp => `
    <div class="luxury-card experiment-card" data-id="${exp.id}">
      <div class="experiment-header" data-id="${exp.id}">
        <div>
          <div class="experiment-title">${esc(exp.title)}</div>
          <div class="experiment-meta">${formatDate(exp.createdAt)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-icon edit-experiment" data-id="${exp.id}" title="Edit">✎</button>
          <button class="btn-icon delete delete-experiment" data-id="${exp.id}" title="Delete">✕</button>
          <span class="experiment-toggle">▼</span>
        </div>
      </div>
      <div class="experiment-body">
        <div class="experiment-content">
          ${exp.screenshotData ? `<img class="experiment-screenshot" src="${exp.screenshotData}" alt="Experiment screenshot" />` : ''}
          ${exp.tried ? `<div class="experiment-section">
            <div class="experiment-section-label">What I Tried</div>
            <div class="experiment-section-value">${esc(exp.tried)}</div>
          </div>` : ''}
          ${exp.outcome ? `<div class="experiment-section">
            <div class="experiment-section-label">Outcome</div>
            <div class="experiment-section-value">${esc(exp.outcome)}</div>
          </div>` : ''}
          ${exp.next ? `<div class="experiment-section">
            <div class="experiment-section-label">Next Step</div>
            <div class="experiment-section-value">${esc(exp.next)}</div>
          </div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

    // Toggle expand/collapse
    list.querySelectorAll('.experiment-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-icon') || e.target.closest('.btn-icon')) return;
            const card = header.closest('.experiment-card');
            card.classList.toggle('open');
        });
    });

    list.querySelectorAll('.edit-experiment').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openExperimentModal(btn.dataset.id); });
    });
    list.querySelectorAll('.delete-experiment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete(() => {
                experiments = experiments.filter(x => x.id !== btn.dataset.id);
                saveExperiments(); renderExperiments();
            });
        });
    });
}

function openExperimentModal(id = null) {
    editingExperimentId = id;
    document.getElementById('experimentModalTitle').textContent = id ? 'Edit Experiment' : 'New Experiment';
    if (id) {
        const exp = experiments.find(x => x.id === id);
        if (exp) {
            document.getElementById('exp-title').value = exp.title || '';
            document.getElementById('exp-tried').value = exp.tried || '';
            document.getElementById('exp-outcome').value = exp.outcome || '';
            document.getElementById('exp-next').value = exp.next || '';
            document.getElementById('exp-screenshot').value = '';
        }
    } else {
        ['exp-title', 'exp-tried', 'exp-outcome', 'exp-next'].forEach(f => document.getElementById(f).value = '');
        document.getElementById('exp-screenshot').value = '';
    }
    openModal('experimentModal');
}

function saveExperiment() {
    const title = document.getElementById('exp-title').value.trim();
    if (!title) { alert('Please enter a title.'); return; }

    const fileInput = document.getElementById('exp-screenshot');
    const file = fileInput.files[0];

    const finalize = (screenshotData) => {
        const entry = {
            id: editingExperimentId || uid(),
            title: title,
            tried: document.getElementById('exp-tried').value.trim(),
            outcome: document.getElementById('exp-outcome').value.trim(),
            next: document.getElementById('exp-next').value.trim(),
            screenshotData: screenshotData,
            updatedAt: new Date().toISOString()
        };
        if (editingExperimentId) {
            const existing = experiments.find(x => x.id === editingExperimentId);
            entry.createdAt = existing ? existing.createdAt : entry.updatedAt;
            if (!screenshotData && existing) entry.screenshotData = existing.screenshotData;
            experiments = experiments.map(x => x.id === editingExperimentId ? entry : x);
        } else {
            entry.createdAt = entry.updatedAt;
            experiments.unshift(entry);
        }
        saveExperiments(); renderExperiments(); closeModal('experimentModal');
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = e => finalize(e.target.result);
        reader.readAsDataURL(file);
    } else {
        finalize(null);
    }
}

function initExperiments() {
    document.getElementById('addExperimentBtn').addEventListener('click', () => openExperimentModal());
    document.getElementById('closeExperimentModal').addEventListener('click', () => closeModal('experimentModal'));
    document.getElementById('cancelExperimentModal').addEventListener('click', () => closeModal('experimentModal'));
    document.getElementById('saveExperimentBtn').addEventListener('click', saveExperiment);
    renderExperiments();
}

/* ══════════════════════════════════════════════════
   SECTION 6 — LINKS
══════════════════════════════════════════════════ */
const DEFAULT_LINKS = [
    { id: uid(), title: 'Milanote Research Board', url: 'https://app.milanote.com', category: 'Milanote', desc: 'Visual research mood board and concept maps', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Project GitHub Repository', url: 'https://github.com', category: 'GitHub', desc: 'Code, pattern files, and version history', createdAt: new Date().toISOString() },
    { id: uid(), title: 'ChatGPT / GPT-4o', url: 'https://chat.openai.com', category: 'AI Tools', desc: 'Primary AI tool for pattern prompt experiments', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Claude by Anthropic', url: 'https://claude.ai', category: 'AI Tools', desc: 'Secondary AI for long-form synthesis', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Google Gemini', url: 'https://gemini.google.com', category: 'AI Tools', desc: 'Multimodal AI exploration', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Vogue Patterns', url: 'https://voguepatterns.mccall.com', category: 'Research', desc: 'Commercial pattern reference library', createdAt: new Date().toISOString() },
    { id: uid(), title: 'Figma', url: 'https://figma.com', category: 'Design', desc: 'Pattern layout and design mockups', createdAt: new Date().toISOString() },
];

let links = store.get('links', null);
let editingLinkId = null;
let activeLinkCat = 'all';

if (!links) { links = DEFAULT_LINKS; store.set('links', links); }

function saveLinks() { store.set('links', links); }

function renderLinks() {
    const grid = document.getElementById('linksGrid');
    const filtered = activeLinkCat === 'all' ? links : links.filter(l => l.category === activeLinkCat);

    if (!filtered.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">◈</div>
      <div class="empty-state-text">No links in this category yet</div>
    </div>`;
        return;
    }

    grid.innerHTML = filtered.map(l => `
    <div class="luxury-card link-card" data-id="${l.id}">
      <div class="link-card-header">
        <div class="link-card-title">${esc(l.title)}</div>
        <div class="link-card-actions">
          <button class="btn-icon edit-link" data-id="${l.id}" title="Edit">✎</button>
          <button class="btn-icon delete delete-link" data-id="${l.id}" title="Delete">✕</button>
        </div>
      </div>
      <span class="link-card-cat">${esc(l.category)}</span>
      ${l.desc ? `<div class="link-card-desc">${esc(l.desc)}</div>` : ''}
      <a class="link-card-url" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a>
    </div>
  `).join('');

    grid.querySelectorAll('.edit-link').forEach(btn => {
        btn.addEventListener('click', () => openLinkModal(btn.dataset.id));
    });
    grid.querySelectorAll('.delete-link').forEach(btn => {
        btn.addEventListener('click', () => {
            confirmDelete(() => {
                links = links.filter(l => l.id !== btn.dataset.id);
                saveLinks(); renderLinks();
            });
        });
    });
}

function openLinkModal(id = null) {
    editingLinkId = id;
    document.getElementById('linkModalTitle').textContent = id ? 'Edit Link' : 'Add Link';
    if (id) {
        const l = links.find(x => x.id === id);
        if (l) {
            document.getElementById('lnk-title').value = l.title || '';
            document.getElementById('lnk-url').value = l.url || '';
            document.getElementById('lnk-category').value = l.category || 'Other';
            document.getElementById('lnk-desc').value = l.desc || '';
        }
    } else {
        document.getElementById('lnk-title').value = '';
        document.getElementById('lnk-url').value = '';
        document.getElementById('lnk-category').value = 'Research';
        document.getElementById('lnk-desc').value = '';
    }
    openModal('linkModal');
}

function saveLink() {
    const title = document.getElementById('lnk-title').value.trim();
    const url = document.getElementById('lnk-url').value.trim();
    if (!title || !url) { alert('Please enter a title and URL.'); return; }

    const entry = {
        id: editingLinkId || uid(),
        title: title,
        url: url,
        category: document.getElementById('lnk-category').value,
        desc: document.getElementById('lnk-desc').value.trim(),
        updatedAt: new Date().toISOString()
    };

    if (editingLinkId) {
        const existing = links.find(x => x.id === editingLinkId);
        entry.createdAt = existing ? existing.createdAt : entry.updatedAt;
        links = links.map(l => l.id === editingLinkId ? entry : l);
    } else {
        entry.createdAt = entry.updatedAt;
        links.unshift(entry);
    }
    saveLinks(); renderLinks(); closeModal('linkModal');
}

function initLinks() {
    document.getElementById('addLinkBtn').addEventListener('click', () => openLinkModal());
    document.getElementById('closeLinkModal').addEventListener('click', () => closeModal('linkModal'));
    document.getElementById('cancelLinkModal').addEventListener('click', () => closeModal('linkModal'));
    document.getElementById('saveLinkBtn').addEventListener('click', saveLink);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeLinkCat = btn.dataset.cat;
            renderLinks();
        });
    });

    renderLinks();
}

/* ─── ESCAPE HELPER (XSS prevention) ─── */
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ─── INIT ALL ─── */
document.addEventListener('DOMContentLoaded', () => {
    initOverview();
    initLibrary();
    initWeekly();
    initPrompts();
    initExperiments();
    initLinks();

    // Restore last active section
    const lastSection = store.get('activeSection', 'overview');
    activateSection(lastSection);
});

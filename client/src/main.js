import { renderRole } from './render.js';
import { filterTargets, flagBelowMinimum, runway } from './rules.js';
import { mountDiagram } from './ikigai.js';
import { mountWizard } from './wizard.js';
import { requestMap } from './client.js';
import { validateFile, extractText, redact } from './resume.js';
import { playStory } from './story.js';
import rolesData from './data/roles.json';

const { fields, roles } = rolesData;

/* ── State ── */
const state = {
  roleId: 'claims',
  retrain: 'weeks',
  savingsMonths: 5,
  minIncome: 42000,
};

/* ── DOM refs ── */
const $fields = document.getElementById('fields');
const $roles = document.getElementById('roles');
const $savings = document.getElementById('savings');
const $savingsVal = document.getElementById('savings-val');
const $minIncome = document.getElementById('min-income');
const $minIncomeVal = document.getElementById('min-income-val');
const $retrain = document.getElementById('retrain');

/* ── Helpers ── */
function fieldForRole(id) {
  for (const [f, ids] of Object.entries(fields)) {
    if (ids.includes(id)) return f;
  }
  return Object.keys(fields)[0];
}

function buildChips(role) {
  const chips = [];
  for (const l of role.loves) chips.push({ kind: 'love', text: l });
  for (const g of role.good_at) chips.push({ kind: 'good', text: g });
  for (const n of role.world_needs) chips.push({ kind: 'need', text: n });
  return chips;
}

function buildView() {
  const role = roles[state.roleId];
  const { targets, note } = filterTargets(role.targets, state.retrain);
  const flagged = flagBelowMinimum(targets, state.minIncome);
  const rw = runway(state.savingsMonths);
  return {
    headline: role.headline,
    story: role.story,
    chips: buildChips(role),
    targets: flagged,
    note,
    bridge: role.bridge,
    runway: rw,
    goneLabel: `(${role.lost_role} — gone)`,
  };
}

function render() {
  renderRole(document.body, buildView());
}

/* ── Tab helpers ── */
function setPressed(container, activeBtn) {
  for (const btn of container.querySelectorAll('.tab:not(.ai)')) {
    btn.setAttribute('aria-pressed', btn === activeBtn ? 'true' : 'false');
  }
}

/** Find the button whose data attribute matches value, focus it. */
function focusTab(container, attr, value) {
  const btn = container.querySelector(`[${attr}="${value}"]`);
  if (btn) btn.focus();
}

function buildFieldTabs() {
  $fields.replaceChildren();
  for (const f of Object.keys(fields)) {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.textContent = f;
    btn.dataset.field = f;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      const firstRole = fields[f][0];
      selectRole(firstRole);
    });
    $fields.appendChild(btn);
  }
}

function buildRoleTabs() {
  $roles.replaceChildren();
  const currentField = fieldForRole(state.roleId);
  const roleIds = fields[currentField];
  for (const id of roleIds) {
    const role = roles[id];
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.textContent = role.lost_role;
    btn.dataset.role = id;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => selectRole(id));
    $roles.appendChild(btn);
  }
  // Other… (AI) tab
  const aiBtn = document.createElement('button');
  aiBtn.className = 'tab ai';
  aiBtn.textContent = 'Other… (AI)';
  aiBtn.addEventListener('click', openWizard);
  $roles.appendChild(aiBtn);

  // Upload resume tab
  const resumeBtn = document.createElement('button');
  resumeBtn.className = 'tab ai';
  resumeBtn.textContent = 'Upload resume';
  resumeBtn.addEventListener('click', openResumeUpload);
  $roles.appendChild(resumeBtn);
}

function updateFieldPressed() {
  const currentField = fieldForRole(state.roleId);
  for (const btn of $fields.querySelectorAll('.tab')) {
    btn.setAttribute('aria-pressed', btn.dataset.field === currentField ? 'true' : 'false');
  }
}

function updateRolePressed() {
  for (const btn of $roles.querySelectorAll('.tab:not(.ai)')) {
    btn.setAttribute('aria-pressed', btn.dataset.role === state.roleId ? 'true' : 'false');
  }
}

/* ── Diagram ── */
const diagram = mountDiagram(document.getElementById('diagram'));
let runToken = 0;
let currentStory = null;

/* ── Public ── */
let prevField = null;

export function selectRole(id) {
  if (currentStory) stopStory();
  const newField = fieldForRole(id);
  const fieldChanged = newField !== prevField;
  state.roleId = id;
  const role = roles[id];
  // Pre-fill controls from role defaults
  state.savingsMonths = role.defaults.savings_months;
  state.minIncome = role.defaults.min_income * 12; // monthly → annual
  state.retrain = role.defaults.retrain;
  syncControls();

  if (fieldChanged) {
    // Rebuild role tabs for the new field
    buildRoleTabs();
  }
  // Update aria-pressed in place — no DOM destruction, focus preserved
  updateFieldPressed();
  updateRolePressed();
  prevField = newField;

  // Restore focus to the relevant tab if field changed (the clicked field tab itself
  // was rebuilt along with role tabs, so we refocus it)
  if (fieldChanged) {
    focusTab($fields, 'data-field', newField);
  }

  showResults();
  render();
  animateDiagram();
}

async function animateDiagram(opts) {
  const token = ++runToken;
  const role = roles[state.roleId];
  const { targets } = filterTargets(role.targets, state.retrain);
  diagram.reset();
  diagram.setGone(role.lost_role + ' — gone');
  await diagram.fill(['love', 'good', 'need'], opts);
  if (token !== runToken) return; // stale click
  diagram.light(targets.length);
}

function syncControls() {
  $savings.value = state.savingsMonths;
  $savingsVal.textContent = state.savingsMonths + ' mo';
  $minIncome.value = state.minIncome;
  $minIncomeVal.textContent = '$' + Math.round(state.minIncome / 1000) + 'k';
  $retrain.value = state.retrain;
}

/* ── Control event listeners ── */
$savings.addEventListener('input', () => {
  state.savingsMonths = Number($savings.value);
  $savingsVal.textContent = state.savingsMonths + ' mo';
  render();
});

$minIncome.addEventListener('input', () => {
  state.minIncome = Number($minIncome.value);
  $minIncomeVal.textContent = '$' + Math.round(state.minIncome / 1000) + 'k';
  render();
});

$retrain.addEventListener('change', () => {
  state.retrain = $retrain.value;
  render();
});

/* ── Wizard ── */
const $wizardArea = document.getElementById('wizard-area');
const $note = document.getElementById('note');

const $results = document.getElementById('results');

function wizardDefaults() {
  const role = roles[state.roleId];
  return {
    role: '',
    years: role.defaults.years,
    savings_months: role.defaults.savings_months,
    min_income: role.defaults.min_income * 12,
    retrain: role.defaults.retrain,
    loves: [...role.defaults.loves],
    enjoyed_most: [...role.defaults.enjoyed_most],
    good_at: [...role.defaults.good_at],
    world_needs: [...role.defaults.world_needs],
    help_who: [...role.defaults.help_who],
  };
}

function showResults() {
  $results.hidden = false;
}

function openWizard() {
  mountWizard($wizardArea, wizardDefaults(), handleWizardSubmit);
  $wizardArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleWizardSubmit(req) {
  const res = await requestMap(req);

  if (res.source === 'ai' && res.result) {
    renderAiResult(req, res.result, null);
  } else if (res.source === 'fallback' && res.roleId) {
    // Render the fallback role
    state.roleId = res.roleId;
    state.retrain = req.retrain || 'weeks';
    state.savingsMonths = req.savings_months || 5;
    state.minIncome = req.min_income || 42000;
    syncControls();
    render();
    animateDiagram();
    showNote(res.note);
  }

  showResults();
}

function renderAiResult(req, result, noteText) {
  const { targets } = filterTargets(result.targets, req.retrain || 'weeks');
  const flagged = flagBelowMinimum(targets, req.min_income || 0);
  const rw = runway(req.savings_months || 0);

  const view = {
    headline: 'Your pivot map',
    story: req.role ? `From "${req.role}" — here is where the overlap points.` : 'Based on your resume.',
    chips: buildChipsFromArrays(req.loves, req.good_at, req.world_needs, result.inferred),
    targets: flagged,
    note: noteText,
    bridge: result.bridge,
    runway: rw,
    goneLabel: req.role ? `(${req.role} — gone)` : '',
  };

  renderRole(document.body, view);

  // Animate diagram with inferred circle kinds
  const kinds = [];
  if ((req.loves && req.loves.length) || result.inferred?.loves?.length) kinds.push('love');
  if ((req.good_at && req.good_at.length) || result.inferred?.good_at?.length) kinds.push('good');
  if ((req.world_needs && req.world_needs.length) || result.inferred?.world_needs?.length) kinds.push('need');
  if (kinds.length === 0) kinds.push('love', 'good', 'need');
  const token = ++runToken;
  diagram.reset();
  if (req.role) diagram.setGone(req.role + ' — gone');
  diagram.fill(kinds).then(() => {
    if (token !== runToken) return;
    diagram.light(targets.length);
  });
}

function buildChipsFromArrays(loves, goodAt, worldNeeds, inferred) {
  const chips = [];
  for (const t of (loves || [])) chips.push({ kind: 'love', text: t });
  if (inferred?.loves) for (const t of inferred.loves) {
    if (!loves?.includes(t)) chips.push({ kind: 'love', text: t });
  }
  for (const t of (goodAt || [])) chips.push({ kind: 'good', text: t });
  if (inferred?.good_at) for (const t of inferred.good_at) {
    if (!goodAt?.includes(t)) chips.push({ kind: 'good', text: t });
  }
  for (const t of (worldNeeds || [])) chips.push({ kind: 'need', text: t });
  if (inferred?.world_needs) for (const t of inferred.world_needs) {
    if (!worldNeeds?.includes(t)) chips.push({ kind: 'need', text: t });
  }
  return chips;
}

function showNote(text) {
  if ($note) {
    $note.textContent = text || '';
    $note.hidden = !text;
  }
}

/* ── Resume upload ── */
const $resumeArea = document.getElementById('resume-area');

function openResumeUpload() {
  $resumeArea.hidden = false;
  $resumeArea.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'resume-upload';

  const heading = document.createElement('h3');
  heading.className = 'disp';
  heading.textContent = 'Upload resume';
  wrap.appendChild(heading);

  const privacy = document.createElement('p');
  privacy.className = 'resume-privacy mono';
  privacy.textContent = 'Your resume text is sent to DeepSeek to generate suggestions. Contact details are removed first. Nothing is stored.';
  wrap.appendChild(privacy);

  // File input
  const fileLabel = document.createElement('label');
  fileLabel.className = 'wiz-label';
  fileLabel.textContent = 'Choose a file ';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,.docx,.txt';
  fileLabel.appendChild(fileInput);
  wrap.appendChild(fileLabel);

  // Paste textarea
  const pasteLabel = document.createElement('label');
  pasteLabel.className = 'wiz-label';
  const pasteLabelText = document.createElement('span');
  pasteLabelText.textContent = 'Or paste resume text';
  pasteLabel.appendChild(pasteLabelText);
  const pasteArea = document.createElement('textarea');
  pasteArea.className = 'wiz-input resume-paste';
  pasteArea.rows = 4;
  pasteLabel.appendChild(pasteArea);
  wrap.appendChild(pasteLabel);

  // Job profile input
  const profileLabel = document.createElement('label');
  profileLabel.className = 'wiz-label';
  const profileLabelText = document.createElement('span');
  profileLabelText.textContent = 'Current or most recent job profile (optional)';
  profileLabel.appendChild(profileLabelText);
  const profileInput = document.createElement('input');
  profileInput.type = 'text';
  profileInput.className = 'wiz-input';
  profileInput.maxLength = 60;
  profileLabel.appendChild(profileInput);
  wrap.appendChild(profileLabel);

  // Error area
  const errorEl = document.createElement('div');
  errorEl.className = 'resume-error mono';
  wrap.appendChild(errorEl);

  // Preview
  const previewLabel = document.createElement('div');
  previewLabel.className = 'wiz-chip-label';
  previewLabel.textContent = 'Redacted preview';
  previewLabel.hidden = true;
  wrap.appendChild(previewLabel);
  const previewEl = document.createElement('pre');
  previewEl.className = 'resume-preview';
  previewEl.hidden = true;
  wrap.appendChild(previewEl);

  let redactedText = '';

  async function processFile(file) {
    errorEl.textContent = '';
    previewEl.hidden = true;
    previewLabel.hidden = true;
    redactedText = '';

    const v = validateFile(file);
    if (!v.ok) {
      errorEl.textContent = v.error;
      return;
    }
    try {
      const raw = await extractText(file);
      redactedText = redact(raw);
      previewEl.textContent = redactedText;
      previewEl.hidden = false;
      previewLabel.hidden = false;
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) processFile(fileInput.files[0]);
  });

  pasteArea.addEventListener('input', () => {
    const text = pasteArea.value.trim();
    if (text) {
      redactedText = redact(text);
      previewEl.textContent = redactedText;
      previewEl.hidden = false;
      previewLabel.hidden = false;
      errorEl.textContent = '';
    } else {
      redactedText = '';
      previewEl.hidden = true;
      previewLabel.hidden = true;
    }
  });

  // Nav
  const nav = document.createElement('div');
  nav.className = 'wiz-nav';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn alt';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { $resumeArea.hidden = true; });
  nav.appendChild(cancelBtn);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn';
  sendBtn.textContent = 'Send to AI';
  sendBtn.disabled = true;
  sendBtn.addEventListener('click', async () => {
    if (!redactedText && !profileInput.value.trim()) {
      errorEl.textContent = 'Add a resume or a job profile first';
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    const role = roles[state.roleId];
    const req = {
      role: profileInput.value.trim().slice(0, 60),
      resume_text: redactedText || undefined,
      years: role.defaults.years,
      savings_months: role.defaults.savings_months,
      min_income: role.defaults.min_income * 12,
      retrain: role.defaults.retrain,
      loves: [],
      enjoyed_most: [],
      good_at: [],
      world_needs: [],
      help_who: [],
    };

    const res = await requestMap(req);

    if (res.source === 'ai' && res.result) {
      renderAiResult(req, res.result, null);
    } else if (res.source === 'fallback' && res.roleId) {
      state.roleId = res.roleId;
      state.retrain = req.retrain || 'weeks';
      state.savingsMonths = req.savings_months || 5;
      state.minIncome = req.min_income || 42000;
      syncControls();
      render();
      animateDiagram();
      showNote(res.note);
    }

    showResults();
    $resumeArea.hidden = true;
  });
  nav.appendChild(sendBtn);
  wrap.appendChild(nav);

  // Enable send button when there's a preview or profile
  const checkSend = () => {
    sendBtn.disabled = !redactedText && !profileInput.value.trim();
    sendBtn.textContent = 'Send to AI';
  };
  const obs = new MutationObserver(checkSend);
  obs.observe(previewEl, { childList: true, characterData: true, subtree: true });
  profileInput.addEventListener('input', checkSend);
  pasteArea.addEventListener('input', checkSend);
  fileInput.addEventListener('change', () => setTimeout(checkSend, 100));

  $resumeArea.appendChild(wrap);
}

/* ── Story mode ── */
const $captionBar = document.getElementById('caption-bar');
const $btnStory = document.getElementById('btn-story');

function showCaption(text) {
  if ($captionBar) {
    $captionBar.textContent = text || '';
    $captionBar.hidden = !text;
  }
}

function stopStory() {
  if (currentStory) {
    currentStory.stop();
    currentStory = null;
  }
  $btnStory.textContent = '▶ Play Maria’s story';
}

function startStory() {
  stopStory();
  currentStory = playStory({
    diagram,
    selectRole,
    showCaption,
    openWizard,
  });
  $btnStory.textContent = '■ Stop story';
  currentStory.done.then(() => {
    if (currentStory) {
      currentStory = null;
      $btnStory.textContent = '▶ Play Maria’s story';
    }
  });
}

$btnStory.addEventListener('click', () => {
  if (currentStory) stopStory(); else startStory();
});

/* ── Button wiring ── */
document.getElementById('btn-wizard').addEventListener('click', openWizard);

/* ── Init ── */
buildFieldTabs();
buildRoleTabs();
updateFieldPressed();
// Mount wizard active — user answers questions first, then results render
mountWizard($wizardArea, wizardDefaults(), handleWizardSubmit);

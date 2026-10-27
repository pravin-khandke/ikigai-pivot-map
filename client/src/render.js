/**
 * render.js — cards, bridge, runway panel. Never touches document at import time.
 * Uses createElement/textContent only (never innerHTML with dynamic strings).
 *
 * @typedef {{ kind: 'love'|'good'|'need', text: string }} Chip
 * @typedef {{ title: string, why_it_fits: string, circles: string[], skill_gap: string[], est_pay_range: {min:number,max:number}, est_weeks_to_ready: number, belowMin: boolean }} TargetView
 * @typedef {{ headline: string, story: string, chips: Chip[], targets: TargetView[], note: string|null, bridge: {steps: string[]}, runway: {months:number, spare:number, label:string}, goneLabel: string }} RoleView
 */

const CIRCLE_COLORS = { love: 'var(--love)', good: 'var(--good)', need: 'var(--need)' };
const CIRCLE_ORDER = ['love', 'good', 'need'];
const DAY_RANGES = ['1–30', '31–60', '61–90'];

function formatPay(n) {
  return '$' + Math.round(n / 1000) + 'k';
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderChips(container, chips) {
  container.replaceChildren();
  for (const c of chips) {
    const span = el('span', `chip c-${c.kind}`, c.text);
    container.appendChild(span);
  }
  // "PAID FOR · collapsed" chip
  const paid = el('span', 'chip c-paid', 'PAID FOR · collapsed');
  container.appendChild(paid);
}

function renderCard(t, i) {
  const card = el('article', 'card');
  if (t.belowMin) {
    const warn = el('span', 'warn mono', 'BELOW YOUR MINIMUM');
    card.appendChild(warn);
  }
  card.appendChild(el('h3', 'disp', t.title));

  // fit dots
  const fit = el('div', 'fit');
  for (const circle of CIRCLE_ORDER) {
    const dot = el('i', 'dot');
    dot.style.background = t.circles.includes(circle) ? CIRCLE_COLORS[circle] : '#ccc';
    fit.appendChild(dot);
  }
  fit.appendChild(document.createTextNode(` fits ${t.circles.length} of 3 circles`));
  card.appendChild(fit);

  card.appendChild(el('p', null, t.why_it_fits));

  // skill gap
  const gap = el('div', 'gap');
  gap.appendChild(document.createTextNode('Gap: '));
  for (const g of t.skill_gap) {
    gap.appendChild(el('span', null, g));
  }
  card.appendChild(gap);

  // pay row
  const pay = el('div', 'pay mono');
  const payLeft = el('div');
  payLeft.appendChild(document.createTextNode(`${formatPay(t.est_pay_range.min)}–${formatPay(t.est_pay_range.max)}`));
  payLeft.appendChild(el('div', 'est', 'est. pay'));
  const payRight = el('div');
  payRight.appendChild(document.createTextNode(`≈ ${t.est_weeks_to_ready} wks`));
  payRight.appendChild(el('div', 'est', 'est. ready'));
  pay.appendChild(payLeft);
  pay.appendChild(payRight);
  card.appendChild(pay);

  return card;
}

function renderBridgeSteps(container, steps) {
  container.replaceChildren();
  for (let i = 0; i < steps.length; i++) {
    const step = el('div', 'step');
    step.appendChild(el('b', 'mono', `DAYS ${DAY_RANGES[i]}`));
    step.appendChild(el('div', null, steps[i]));
    container.appendChild(step);
  }
}

/**
 * Compute runway bar percentages.
 * Fill = savings months, marker = 3 months (90-day line).
 * Scale = max(savings, 3) * 1.25, so both are always visible.
 * @param {number} months
 * @returns {{ fillPct: number, markerPct: number }}
 */
export function runwayBar(months) {
  const scale = Math.max(months, 3) * 1.25;
  const fillPct = scale === 0 ? 0 : Math.min(100, Math.max(0, (months / scale) * 100));
  const markerPct = scale === 0 ? 0 : Math.min(100, Math.max(0, (3 / scale) * 100));
  return { fillPct, markerPct };
}

function renderRunway(container, rw) {
  container.replaceChildren();
  const label = el('div', 'mono est');
  label.style.color = '#cfc7b4';
  label.textContent = 'Runway (your savings)';
  container.appendChild(label);

  const big = el('div', 'big disp');
  big.appendChild(el('span', null, String(rw.months)));
  const unit = el('span');
  unit.style.fontSize = '20px';
  unit.style.fontWeight = '400';
  unit.textContent = ' months';
  big.appendChild(unit);
  big.appendChild(document.createTextNode(' '));
  big.appendChild(el('span', 'est', 'est.'));
  container.appendChild(big);

  // bar
  const { fillPct, markerPct } = runwayBar(rw.months);
  const bar = el('div', 'bar');
  const fill = el('i');
  fill.style.width = fillPct + '%';
  bar.appendChild(fill);
  const marker = el('u');
  marker.style.left = markerPct + '%';
  bar.appendChild(marker);
  container.appendChild(bar);

  const note = el('small', 'mono', `▲ 90-day bridge ends · ${rw.label}`);
  container.appendChild(note);

  // copy button
  const btnWrap = el('div');
  btnWrap.style.marginTop = '16px';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn alt copy-plan';
  copyBtn.style.background = 'var(--paper)';
  copyBtn.style.boxShadow = 'none';
  copyBtn.style.fontSize = '12px';
  copyBtn.textContent = 'Copy my 90-day plan';
  btnWrap.appendChild(copyBtn);
  container.appendChild(btnWrap);
}

/**
 * Render a full role view into the page.
 * @param {HTMLElement} root - page root (document.body or #app)
 * @param {RoleView} view
 */
export function renderRole(root, view) {
  const $ = (id) => root.querySelector('#' + id) ?? document.getElementById(id);

  // headline — use textContent, split italic part
  const h1 = $('h1');
  if (h1) {
    h1.replaceChildren();
    // Split on the italic part (the part the mockup puts in <em>)
    // headline is plain text; italics done via a convention marker isn't in the data,
    // so we just set it as text
    h1.textContent = view.headline;
  }

  const lede = $('lede');
  if (lede) lede.textContent = view.story;

  const gone = $('gone-label');
  if (gone) gone.textContent = view.goneLabel;

  const chips = $('chips');
  if (chips) renderChips(chips, view.chips);

  // cards
  const cards = $('cards');
  if (cards) {
    cards.replaceChildren();
    for (let i = 0; i < view.targets.length; i++) {
      cards.appendChild(renderCard(view.targets[i], i));
    }
  }

  // note
  const noteEl = $('note');
  if (noteEl) {
    noteEl.textContent = view.note ?? '';
    noteEl.hidden = !view.note;
  }

  // bridge
  const steps = $('steps');
  if (steps) renderBridgeSteps(steps, view.bridge.steps);

  const runway = $('runway');
  if (runway) renderRunway(runway, view.runway);

  // Wire copy button
  const copyBtn = root.querySelector('.copy-plan') ?? document.querySelector('.copy-plan');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(buildPlanText(view)).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy my 90-day plan'; }, 1500);
      }).catch(() => {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => { copyBtn.textContent = 'Copy my 90-day plan'; }, 1500);
      });
    };
  }
}

/**
 * Build a plain-text 90-day plan for clipboard copy.
 * Pure function — no DOM access.
 * @param {RoleView} view
 * @returns {string}
 */
export function buildPlanText(view) {
  const lines = [];
  lines.push('YOUR 90-DAY BRIDGE PLAN');
  lines.push('');
  for (let i = 0; i < view.bridge.steps.length; i++) {
    lines.push(`DAYS ${DAY_RANGES[i]}`);
    lines.push(view.bridge.steps[i]);
    lines.push('');
  }
  lines.push('TARGET ROLES');
  for (const t of view.targets) {
    lines.push(`- ${t.title} (est. ${formatPay(t.est_pay_range.min)}–${formatPay(t.est_pay_range.max)}, est. ${t.est_weeks_to_ready} wks)`);
  }
  lines.push('');
  lines.push(`RUNWAY: est. ${view.runway.months} months — est. ${view.runway.label}`);
  lines.push('');
  lines.push('Estimates, not promises. Session only, nothing stored.');
  return lines.join('\n');
}

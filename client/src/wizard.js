/**
 * wizard.js — 5-panel wizard for custom role mapping.
 * Uses textContent only, never innerHTML with dynamic strings.
 * No document access at import time.
 */
import chipsData from './data/chips.json' with { type: 'json' };

const PANELS = [
  {
    id: 'context',
    title: 'Context',
    fields: [
      { key: 'role', type: 'text', label: 'Your lost or at-risk role', max: 60 },
      { key: 'years', type: 'range', label: 'Years of experience', min: 0, max: 40, step: 1 },
    ],
  },
  {
    id: 'love',
    title: 'What you love',
    chips: [
      { key: 'loves', label: 'What makes time disappear?', source: 'loves', max: 3 },
      { key: 'enjoyed_most', label: 'Which part of your old job did you enjoy most?', source: 'enjoyed_most', max: 3 },
    ],
  },
  {
    id: 'good',
    title: 'What you are good at',
    chips: [
      { key: 'good_at', label: 'What do people ask you for help with?', source: 'good_at', max: 3 },
    ],
  },
  {
    id: 'need',
    title: 'What the world needs',
    chips: [
      { key: 'world_needs', label: 'Which problems do you care about?', source: 'world_needs', max: 2 },
      { key: 'help_who', label: 'Who would you most like to help?', source: 'help_who', max: 2 },
    ],
  },
  {
    id: 'paid',
    title: 'Paid for',
    fields: [
      { key: 'savings_months', type: 'range', label: 'Months of savings', min: 0, max: 24, step: 1 },
      { key: 'min_income', type: 'range', label: 'Min. annual income', min: 0, max: 150000, step: 1000, format: (v) => '$' + Math.round(v / 1000) + 'k' },
      { key: 'retrain', type: 'select', label: 'Open to retraining', options: [
        { value: 'none', text: 'None' },
        { value: 'weeks', text: 'Weeks (up to 8)' },
        { value: 'months', text: 'Months (up to 26)' },
      ] },
    ],
  },
];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * @param {HTMLElement} root
 * @param {object} defaults - pre-filled values
 * @param {(req: object) => void} onSubmit
 */
export function mountWizard(root, defaults, onSubmit) {
  root.replaceChildren();

  const values = { ...defaults };

  const wrap = el('div', 'wizard');

  let currentPanel = 0;

  function renderPanel() {
    wrap.replaceChildren();
    const panel = PANELS[currentPanel];

    const heading = el('h3', 'disp', panel.title);
    wrap.appendChild(heading);

    // Fields
    if (panel.fields) {
      for (const f of panel.fields) {
        const label = el('label', 'wiz-label');
        label.appendChild(el('span', null, f.label));

        if (f.type === 'text') {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'wiz-input';
          input.maxLength = f.max || 60;
          input.value = values[f.key] || '';
          input.addEventListener('input', () => { values[f.key] = input.value; });
          label.appendChild(input);
        } else if (f.type === 'range') {
          const row = el('div', 'wiz-range-row');
          const input = document.createElement('input');
          input.type = 'range';
          input.min = f.min;
          input.max = f.max;
          input.step = f.step;
          input.value = values[f.key] ?? f.min;
          const valSpan = el('span', 'val mono', f.format ? f.format(input.value) : String(input.value));
          input.addEventListener('input', () => {
            values[f.key] = Number(input.value);
            valSpan.textContent = f.format ? f.format(input.value) : String(input.value);
          });
          row.appendChild(input);
          row.appendChild(valSpan);
          label.appendChild(row);
        } else if (f.type === 'select') {
          const select = document.createElement('select');
          select.className = 'wiz-select';
          for (const opt of f.options) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.text;
            if (values[f.key] === opt.value) o.selected = true;
            select.appendChild(o);
          }
          select.addEventListener('change', () => { values[f.key] = select.value; });
          label.appendChild(select);
        }

        wrap.appendChild(label);
      }
    }

    // Chip groups
    if (panel.chips) {
      for (const cg of panel.chips) {
        wrap.appendChild(el('div', 'wiz-chip-label', cg.label));
        const chipWrap = el('div', 'chips');
        const selected = values[cg.key] || [];
        values[cg.key] = selected; // ensure array ref

        for (const chipText of chipsData[cg.source] || []) {
          const btn = document.createElement('button');
          btn.className = 'chip c-' + panel.id;
          btn.textContent = chipText;
          const isOn = selected.includes(chipText);
          if (isOn) btn.classList.add('on');

          btn.addEventListener('click', () => {
            const idx = selected.indexOf(chipText);
            if (idx >= 0) {
              selected.splice(idx, 1);
              btn.classList.remove('on');
            } else if (selected.length < cg.max) {
              selected.push(chipText);
              btn.classList.add('on');
            }
          });
          chipWrap.appendChild(btn);
        }
        wrap.appendChild(chipWrap);
      }
    }

    // Nav buttons
    const nav = el('div', 'wiz-nav');
    if (currentPanel > 0) {
      const back = el('button', 'btn alt', 'Back');
      back.addEventListener('click', () => { currentPanel--; renderPanel(); });
      nav.appendChild(back);
    }
    if (currentPanel < PANELS.length - 1) {
      const skip = el('button', 'btn alt', 'Skip');
      skip.addEventListener('click', () => { currentPanel++; renderPanel(); });
      nav.appendChild(skip);

      const next = el('button', 'btn', 'Next');
      next.addEventListener('click', () => { currentPanel++; renderPanel(); });
      nav.appendChild(next);
    } else {
      const submit = el('button', 'btn', 'Build my map');
      submit.addEventListener('click', () => {
        submit.disabled = true;
        submit.textContent = 'Building...';
        onSubmit({
          role: (values.role || '').slice(0, 60),
          years: Number(values.years) || 0,
          savings_months: Number(values.savings_months) || 0,
          min_income: Number(values.min_income) || 0,
          retrain: values.retrain || 'weeks',
          loves: values.loves || [],
          enjoyed_most: values.enjoyed_most || [],
          good_at: values.good_at || [],
          world_needs: values.world_needs || [],
          help_who: values.help_who || [],
        });
      });
      nav.appendChild(submit);
    }
    wrap.appendChild(nav);
  }

  renderPanel();
  root.appendChild(wrap);
}

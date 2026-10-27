/**
 * ikigai.js — SVG Ikigai diagram with animated circle fills.
 * Uses CSS transitions on transform/opacity only.
 * Respects prefers-reduced-motion.
 */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/**
 * @param {HTMLElement} container
 * @returns {{ reset(): void, fill(kinds: string[], opts?: {duration?: number}): Promise<void>, light(count: number): void, setGone(label: string): void }}
 */
export function mountDiagram(container) {
  container.replaceChildren();

  const svg = svgEl('svg', { viewBox: '0 0 360 360', width: '100%', height: '100%' });
  svg.style.display = 'block';

  // defs for mix-blend
  const defs = svgEl('defs', {});
  svg.appendChild(defs);

  const CX = 180, CY = 180, R = 100, OFF = 50;

  const circles = {
    love: { cx: CX - OFF * 0.6, cy: CY - OFF * 0.5, color: 'var(--love)' },
    good: { cx: CX + OFF * 0.6, cy: CY - OFF * 0.5, color: 'var(--good)' },
    need: { cx: CX, cy: CY + OFF * 0.5, color: 'var(--need)' },
  };

  const circleEls = {};

  for (const [kind, c] of Object.entries(circles)) {
    const el = svgEl('circle', { cx: c.cx, cy: c.cy, r: R, fill: c.color, 'fill-opacity': '0.35' });
    el.style.mixBlendMode = 'multiply';
    el.style.transform = 'scale(0)';
    el.style.transformOrigin = `${c.cx}px ${c.cy}px`;
    el.style.opacity = '0';
    el.style.willChange = 'transform, opacity';
    svg.appendChild(el);
    circleEls[kind] = el;
  }

  // Dashed paid circle (always visible outline)
  const paid = svgEl('circle', {
    cx: CX, cy: CY, r: R * 0.45,
    fill: 'none', stroke: 'var(--paid)', 'stroke-width': '2', 'stroke-dasharray': '6 4',
    'fill-opacity': '0',
  });
  svg.appendChild(paid);

  // Center badge
  const badge = svgEl('text', { x: CX, y: CY + 5, 'text-anchor': 'middle', 'font-family': "'JetBrains Mono', monospace", 'font-size': '13', fill: 'var(--ink)' });
  badge.style.opacity = '0';
  svg.appendChild(badge);

  // Gone label below
  const goneText = svgEl('text', { x: CX, y: CY + R + 40, 'text-anchor': 'middle', 'font-family': "'JetBrains Mono', monospace", 'font-size': '11', fill: 'var(--mute)' });
  svg.appendChild(goneText);

  container.appendChild(svg);

  function setTransition(el, dur) {
    if (REDUCED.matches || dur <= 0) {
      el.style.transition = 'none';
    } else {
      el.style.transition = `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`;
    }
  }

  function reset() {
    for (const el of Object.values(circleEls)) {
      el.style.transition = 'none';
      el.style.transform = 'scale(0)';
      el.style.opacity = '0';
    }
    badge.style.opacity = '0';
    badge.textContent = '';
  }

  /**
   * Animate circles in. Returns a promise that resolves when done.
   * @param {string[]} kinds
   * @param {{ duration?: number }} [opts]
   */
  function fill(kinds, opts) {
    const duration = opts?.duration ?? 2000;
    const perCircle = kinds.length > 0 ? duration / kinds.length : 0;

    if (REDUCED.matches || perCircle <= 0) {
      for (const k of kinds) {
        const el = circleEls[k];
        if (!el) continue;
        el.style.transition = 'none';
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let i = 0;
      function next() {
        if (i >= kinds.length) { resolve(); return; }
        const el = circleEls[kinds[i]];
        if (!el) { i++; next(); return; }
        setTransition(el, perCircle * 0.8);
        // Force reflow so transition fires
        void el.getBoundingClientRect();
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
        i++;
        setTimeout(next, perCircle);
      }
      next();
    });
  }

  function light(count) {
    badge.textContent = count + ' ROLES light up';
    badge.style.opacity = '1';
  }

  function setGone(label) {
    goneText.textContent = label;
  }

  return { reset, fill, light, setGone };
}

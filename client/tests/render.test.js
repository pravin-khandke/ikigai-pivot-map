import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanText, runwayBar } from '../src/render.js';

const view = {
  headline: 'Your job left. Three circles stayed.',
  story: 'Maria processed claims.',
  chips: [
    { kind: 'love', text: 'helping people' },
    { kind: 'good', text: 'spotting errors' },
    { kind: 'need', text: 'health' },
  ],
  targets: [
    {
      title: 'Patient Billing Advocate',
      why_it_fits: 'Same claims logic.',
      circles: ['love', 'good', 'need'],
      skill_gap: ['medical coding', 'appeals writing'],
      est_pay_range: { min: 48000, max: 62000 },
      est_weeks_to_ready: 8,
      belowMin: false,
    },
  ],
  note: null,
  bridge: {
    steps: [
      'Contract claims-audit gigs while you start a 6-week billing-coding course.',
      'Finish certificate; apply to 10 billing-advocate and navigator roles.',
      'Interview, then start. Gig income covers the gap.',
    ],
  },
  runway: { months: 5, spare: 2, label: '2 months spare' },
  goneLabel: '(claims job — gone)',
};

describe('buildPlanText', () => {
  it('contains DAYS 1–30 header', () => {
    const text = buildPlanText(view);
    assert.ok(text.includes('DAYS 1–30'), 'missing DAYS 1–30');
  });

  it('contains all 3 bridge steps', () => {
    const text = buildPlanText(view);
    for (const step of view.bridge.steps) {
      assert.ok(text.includes(step), `missing step: ${step}`);
    }
  });

  it('contains the runway label with est.', () => {
    const text = buildPlanText(view);
    assert.ok(text.includes('est. 2 months spare'), 'missing runway label with est.');
  });

  it('contains "estimates, not promises"', () => {
    const text = buildPlanText(view);
    assert.ok(
      text.toLowerCase().includes('estimates, not promises'),
      'missing disclaimer'
    );
  });

  it('passes XSS string through unchanged as text', () => {
    const xssView = {
      ...view,
      targets: [
        {
          ...view.targets[0],
          title: '<img src=x onerror=alert(1)>',
        },
      ],
    };
    const text = buildPlanText(xssView);
    assert.ok(
      text.includes('<img src=x onerror=alert(1)>'),
      'XSS string should pass through as literal text'
    );
  });
});

describe('runwayBar', () => {
  it('0 months: empty fill, marker visible', () => {
    const { fillPct, markerPct } = runwayBar(0);
    assert.equal(fillPct, 0, 'fill should be 0');
    assert.ok(markerPct > 0, 'marker should be visible');
    assert.ok(fillPct < markerPct, 'fill should be left of marker (short)');
  });

  it('2 months (short): fill < marker', () => {
    const { fillPct, markerPct } = runwayBar(2);
    assert.ok(fillPct > 0, 'fill should be > 0');
    assert.ok(fillPct < markerPct, 'fill should be left of marker when short');
    assert.ok(fillPct <= 100 && markerPct <= 100, 'both within 0..100');
  });

  it('3 months (exact): fill equals marker', () => {
    const { fillPct, markerPct } = runwayBar(3);
    assert.equal(fillPct, markerPct, 'fill should equal marker at exactly 3');
    assert.ok(fillPct <= 100 && markerPct <= 100, 'both within 0..100');
  });

  it('5 months (spare): fill > marker', () => {
    const { fillPct, markerPct } = runwayBar(5);
    assert.ok(fillPct > markerPct, 'fill should be right of marker when spare');
    assert.ok(fillPct <= 100 && markerPct <= 100, 'both within 0..100');
  });

  it('24 months: fill > marker, both within 0..100', () => {
    const { fillPct, markerPct } = runwayBar(24);
    assert.ok(fillPct > markerPct, 'fill should be right of marker');
    assert.ok(fillPct <= 100, 'fill within 100');
    assert.ok(markerPct > 0 && markerPct <= 100, 'marker within 0..100');
  });
});

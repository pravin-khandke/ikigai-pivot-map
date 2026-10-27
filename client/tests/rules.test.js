import test from 'node:test';
import assert from 'node:assert/strict';
import { RETRAIN_WEEKS, filterTargets, flagBelowMinimum, runway } from '../src/rules.js';

const mk = (id, w, max) => ({ id, est_weeks_to_ready: w, est_pay_range: { min: max - 10000, max } });
const targets = () => [mk('a', 3, 46000), mk('b', 6, 62000), mk('c', 14, 90000)];
const ids = (r) => r.targets.map((t) => t.id);

test('RETRAIN_WEEKS values', () => {
  assert.deepEqual(RETRAIN_WEEKS, { none: 0, weeks: 8, months: 26 });
});

test('none: no target fits, returns nearest with note', () => {
  const r = filterTargets(targets(), 'none');
  assert.deepEqual(ids(r), ['a']);
  assert.equal(r.note, 'needs more retraining than you chose');
});

test('weeks keeps 3 and 6 week targets, note null', () => {
  const r = filterTargets(targets(), 'weeks');
  assert.deepEqual(ids(r), ['a', 'b']);
  assert.equal(r.note, null);
});

test('months keeps all', () => {
  const r = filterTargets(targets(), 'months');
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
  assert.equal(r.note, null);
});

test('none keeps zero-week targets', () => {
  const r = filterTargets([mk('z', 0, 1), mk('a', 3, 1)], 'none');
  assert.deepEqual(ids(r), ['z']);
  assert.equal(r.note, null);
});

test('flagBelowMinimum', () => {
  const r = flagBelowMinimum(targets(), 50000);
  assert.equal(r[0].belowMin, true);
  assert.equal(r[1].belowMin, false);
});

test('flagBelowMinimum huge min flags all, no NaN', () => {
  const r = flagBelowMinimum(targets(), 1e9);
  assert.ok(r.every((t) => t.belowMin === true));
});

test('runway', () => {
  assert.deepEqual(runway(5), { months: 5, spare: 2, label: '2 months spare' });
  assert.equal(runway(2).label, 'short by 1 month');
  assert.equal(runway(0).label, 'short by 3 months');
  assert.equal(runway(3).label, '0 months spare');
});

test('inputs are not mutated', () => {
  const t = targets();
  const snap = structuredClone(t);
  filterTargets(t, 'none');
  flagBelowMinimum(t, 50000);
  assert.deepEqual(t, snap);
  assert.ok(!('belowMin' in t[0]));
});

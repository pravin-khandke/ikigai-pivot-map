import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const chips = load('chips.json');
const { fields, roles } = load('roles.json');
const GROUPS = ['loves', 'good_at', 'world_needs', 'enjoyed_most', 'help_who'];
const ids = Object.values(fields).flat();

test('6 roles in 3 fields', () => {
  assert.equal(Object.keys(fields).length, 3);
  assert.equal(ids.length, 6);
  assert.equal(Object.keys(roles).length, 6);
});

for (const id of ids) {
  test(`role ${id} is valid`, () => {
    const r = roles[id];
    assert.ok(r, 'role exists');
    for (const k of ['id', 'field', 'lost_role', 'persona', 'headline', 'story'])
      assert.ok(r[k], `missing ${k}`);
    assert.equal(r.targets.length, 3);
    for (const t of r.targets) {
      assert.ok(t.skill_gap.length >= 2 && t.skill_gap.length <= 3);
      assert.ok(t.est_pay_range.min < t.est_pay_range.max);
      assert.ok(t.est_weeks_to_ready > 0);
      assert.ok(t.circles.every((c) => ['love', 'good', 'need'].includes(c)));
    }
    assert.equal(r.bridge.steps.length, 3);
    assert.ok(r.bridge.runway_months >= 0);
    for (const g of GROUPS) {
      for (const c of r[g]) assert.ok(chips[g].includes(c), `${g}: ${c}`);
      for (const c of r.defaults[g]) assert.ok(chips[g].includes(c), `defaults.${g}: ${c}`);
    }
  });
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nearestRole, requestMap } from '../src/client.js';
import rolesData from '../src/data/roles.json' with { type: 'json' };

describe('nearestRole', () => {
  it('matches "claims adjuster" to claims', () => {
    assert.equal(nearestRole('claims adjuster', rolesData, 'copy'), 'claims');
  });

  it('falls back when no match', () => {
    assert.equal(nearestRole('qwerty', rolesData, 'copy'), 'copy');
  });

  it('matches by persona name', () => {
    assert.equal(nearestRole('Maria', rolesData, 'copy'), 'claims');
  });

  it('matches by target title', () => {
    assert.equal(nearestRole('bookkeeper', rolesData, 'copy'), 'data');
  });
});

describe('requestMap', () => {
  const baseReq = {
    role: 'paralegal',
    years: 5,
    savings_months: 3,
    min_income: 40000,
    retrain: 'weeks',
  };

  it('returns fallback on 500 response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500 });
    const res = await requestMap(baseReq, fetchImpl);
    assert.equal(res.source, 'fallback');
    assert.ok(res.roleId);
    assert.ok(res.note.includes('AI was unavailable'));
  });

  it('returns fallback on network error', async () => {
    const fetchImpl = async () => { throw new Error('network fail'); };
    const res = await requestMap(baseReq, fetchImpl);
    assert.equal(res.source, 'fallback');
    assert.ok(res.note.includes('AI was unavailable'));
  });

  it('returns fallback on timeout', async () => {
    const fetchImpl = () => new Promise(() => {}); // never resolves
    const res = await requestMap(baseReq, fetchImpl, 50); // 50ms timeout
    assert.equal(res.source, 'fallback');
    assert.ok(res.note.includes('AI was unavailable'));
  });

  it('returns ai result on 200', async () => {
    const validResponse = {
      targets: [
        { title: 'A', why_it_fits: 'x', circles: ['love'], skill_gap: ['y'], est_pay_range: { min: 40000, max: 60000 }, est_weeks_to_ready: 4 },
        { title: 'B', why_it_fits: 'x', circles: ['good'], skill_gap: ['y'], est_pay_range: { min: 40000, max: 60000 }, est_weeks_to_ready: 4 },
        { title: 'C', why_it_fits: 'x', circles: ['need'], skill_gap: ['y'], est_pay_range: { min: 40000, max: 60000 }, est_weeks_to_ready: 4 },
      ],
      bridge: { steps: ['a', 'b', 'c'], runway_months: 3 },
    };
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => validResponse,
    });
    const res = await requestMap(baseReq, fetchImpl);
    assert.equal(res.source, 'ai');
    assert.equal(res.result.targets.length, 3);
  });
});

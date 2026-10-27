/**
 * client.js — API client with nearest-role fallback.
 * Pure functions where possible; no DOM access.
 */
import rolesData from './data/roles.json' with { type: 'json' };

const FALLBACK_NOTE = 'Estimate from the nearest sample role. AI was unavailable.';

/**
 * Find the closest hardcoded role by keyword match on lost_role, persona, and target titles.
 * @param {string} roleText
 * @param {object} data - roles.json shape
 * @param {string} fallbackId - returned when nothing matches
 * @returns {string}
 */
export function nearestRole(roleText, data, fallbackId) {
  const q = roleText.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [id, role] of Object.entries(data.roles)) {
    let score = 0;
    // Check lost_role
    if (role.lost_role.toLowerCase().includes(q) || q.includes(role.lost_role.toLowerCase())) score += 3;
    // Check persona
    if (role.persona && role.persona.toLowerCase() === q) score += 3;
    // Check id
    if (q.includes(id)) score += 2;
    // Check target titles
    for (const t of role.targets) {
      if (t.title.toLowerCase().includes(q) || q.includes(t.title.toLowerCase())) score += 1;
    }
    // Word overlap
    const words = q.split(/\s+/);
    for (const w of words) {
      if (w.length < 3) continue;
      if (role.lost_role.toLowerCase().includes(w)) score += 1;
      for (const t of role.targets) {
        if (t.title.toLowerCase().includes(w)) score += 0.5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return best || fallbackId;
}

/**
 * POST /api/map with timeout and fallback.
 * @param {object} req - MapRequest
 * @param {typeof fetch} [fetchImpl]
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<{source: 'ai'|'fallback', result?: object, roleId?: string, note?: string}>}
 */
export async function requestMap(req, fetchImpl = fetch, timeoutMs = 8000) {
  const fallback = () => {
    const roleId = nearestRole(req.role || '', rolesData, 'claims');
    return { source: 'fallback', roleId, note: FALLBACK_NOTE };
  };

  try {
    const controller = new AbortController();
    const timeout = new Promise((_, reject) => {
      setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs);
    });

    const resp = await Promise.race([
      (fetchImpl || fetch)('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      }),
      timeout,
    ]);

    if (!resp.ok) return fallback();

    const result = await resp.json();
    return { source: 'ai', result };
  } catch {
    return fallback();
  }
}

import { readFileSync } from 'node:fs';
import { buildMessages } from './prompt.js';

const chips = JSON.parse(readFileSync(new URL('../src/data/chips.json', import.meta.url), 'utf8'));
const CHIP_GROUPS = ['loves', 'enjoyed_most', 'good_at', 'world_needs', 'help_who'];
const RETRAIN_VALUES = new Set(['none', 'weeks', 'months']);
const MAX_BODY = 65536; // 64 KB

let apiKeyMissing = false;

/* ── validateRequest ─────────────────────────────── */

/** @param {unknown} body */
export function validateRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' };
  const b = /** @type {Record<string,any>} */ (body);

  // Strip control chars, trim, truncate
  let role = typeof b.role === 'string' ? b.role.replace(/[\x00-\x1f\x7f]/g, '').trim() : '';
  role = role.slice(0, 60);

  let resume_text = typeof b.resume_text === 'string'
    ? b.resume_text.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 6000)
    : undefined;
  if (resume_text === '') resume_text = undefined;

  if (!role && !resume_text) return { ok: false, error: 'Role is required when no resume is provided' };

  // Validate chips
  for (const g of CHIP_GROUPS) {
    const arr = b[g];
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      if (!chips[g]?.includes(c)) return { ok: false, error: `Unknown chip "${c}" in ${g}` };
    }
  }

  // Validate retrain
  const retrain = b.retrain;
  if (!RETRAIN_VALUES.has(retrain)) return { ok: false, error: `retrain must be none|weeks|months` };

  // Clamp numbers
  const years = clamp(Number(b.years) || 0, 0, 40);
  const savings_months = clamp(Number(b.savings_months) || 0, 0, 24);
  const min_income = clamp(Number(b.min_income) || 0, 0, 300000);

  const value = {
    role,
    years,
    savings_months,
    min_income,
    retrain,
    loves: (b.loves || []).slice(),
    enjoyed_most: (b.enjoyed_most || []).slice(),
    good_at: (b.good_at || []).slice(),
    world_needs: (b.world_needs || []).slice(),
    help_who: (b.help_who || []).slice(),
  };
  if (resume_text !== undefined) value.resume_text = resume_text;

  return { ok: true, value };
}

/* ── validateResponse ────────────────────────────── */

/** @param {unknown} raw */
export function validateResponse(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Not an object' };
  const r = /** @type {Record<string,any>} */ (raw);

  if (!Array.isArray(r.targets) || r.targets.length !== 3) {
    return { ok: false, error: 'Expected exactly 3 targets' };
  }
  if (!r.bridge || !Array.isArray(r.bridge.steps) || r.bridge.steps.length !== 3) {
    return { ok: false, error: 'Bridge must have 3 steps' };
  }

  const targets = r.targets.map((t) => {
    if (!t || typeof t.title !== 'string') return null;
    return {
      title: t.title,
      why_it_fits: String(t.why_it_fits || ''),
      circles: Array.isArray(t.circles) ? t.circles : [],
      skill_gap: Array.isArray(t.skill_gap) ? t.skill_gap : [],
      est_pay_range: {
        min: clamp(Number(t.est_pay_range?.min) || 20000, 20000, 250000),
        max: clamp(Number(t.est_pay_range?.max) || 20000, 20000, 250000),
      },
      est_weeks_to_ready: clamp(Number(t.est_weeks_to_ready) || 1, 1, 52),
    };
  });
  if (targets.includes(null)) return { ok: false, error: 'Invalid target shape' };

  const result = {
    targets,
    bridge: {
      steps: r.bridge.steps.map(String),
      ...(r.bridge.runway_months != null && { runway_months: Number(r.bridge.runway_months) }),
    },
  };

  // Filter inferred chips to chips.json
  if (r.inferred && typeof r.inferred === 'object') {
    result.inferred = {};
    for (const g of ['loves', 'good_at', 'world_needs']) {
      const arr = r.inferred[g];
      result.inferred[g] = Array.isArray(arr) ? arr.filter((c) => chips[g]?.includes(c)) : [];
    }
  }

  return { ok: true, value: result };
}

/* ── createRateLimiter ───────────────────────────── */

/** @param {number} limit @param {number} windowMs */
export function createRateLimiter(limit = 10, windowMs = 60000) {
  /** @type {Map<string, {count: number, reset: number}>} */
  const buckets = new Map();
  return (ip) => {
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || now > b.reset) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(ip, b);
    }
    b.count++;
    return b.count <= limit;
  };
}

/* ── handleMap ───────────────────────────────────── */

const rateLimiter = createRateLimiter();

/**
 * Connect-style handler for POST /api/map.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
export async function handleMap(req, res, deps) {
  const json = (status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // Parse body with size cap
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return json(e.status || 400, { error: e.message });
  }

  // Validate request
  const vr = validateRequest(body);
  if (!vr.ok) return json(400, { error: vr.error });

  // Rate limit
  const ip = req.socket?.remoteAddress || 'unknown';
  if (!rateLimiter(ip)) return json(429, { error: 'Rate limit exceeded' });

  // Call DeepSeek
  const fetchFn = deps?.fetchImpl;

  // Check API key only when using real fetch
  if (!fetchFn && !process.env.DEEPSEEK_API_KEY) {
    if (!apiKeyMissing) {
      console.warn('[api] DEEPSEEK_API_KEY not set — requests will return 502');
      apiKeyMissing = true;
    }
    return json(502, { error: 'LLM service unavailable' });
  }
  const messages = buildMessages(vr.value);

  try {
    const resp = await (fetchFn || fetch)('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return json(502, { error: 'LLM request failed' });

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = content ? JSON.parse(typeof content === 'string' ? content : JSON.stringify(content)) : data;

    const vResp = validateResponse(parsed);
    if (!vResp.ok) return json(502, { error: 'Invalid LLM response' });

    return json(200, vResp.value);
  } catch {
    return json(502, { error: 'LLM service error' });
  }
}

/* ── helpers ─────────────────────────────────────── */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Read Connect request body with 64KB cap */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        const err = new Error('Payload too large');
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

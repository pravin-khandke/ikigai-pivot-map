export const RETRAIN_WEEKS = { none: 0, weeks: 8, months: 26 };

const MIN_RUNWAY_MONTHS = 3;

export function filterTargets(targets, retrain) {
  const limit = RETRAIN_WEEKS[retrain];
  const kept = targets.filter((t) => t.est_weeks_to_ready <= limit);
  if (kept.length > 0 || targets.length === 0) return { targets: kept, note: null };
  const nearest = targets.reduce((a, b) => (b.est_weeks_to_ready < a.est_weeks_to_ready ? b : a));
  return { targets: [nearest], note: 'needs more retraining than you chose' };
}

export function flagBelowMinimum(targets, minIncome) {
  return targets.map((t) => ({ ...t, belowMin: t.est_pay_range.max < minIncome }));
}

export function runway(savingsMonths) {
  const spare = savingsMonths - MIN_RUNWAY_MONTHS;
  const n = Math.abs(spare);
  const label = spare >= 0 ? `${n} months spare` : `short by ${n} ${n === 1 ? 'month' : 'months'}`;
  return { months: savingsMonths, spare, label };
}

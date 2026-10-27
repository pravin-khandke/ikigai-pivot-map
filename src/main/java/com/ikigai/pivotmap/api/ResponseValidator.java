package com.ikigai.pivotmap.api;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Port of {@code validateResponse} from server/api.js. The model is treated as
 * untrusted: wrong shapes are rejected and out-of-range numbers are clamped
 * rather than passed through to the page.
 */
public final class ResponseValidator {

    private static final double PAY_MIN = 20000;
    private static final double PAY_MAX = 250000;
    private static final List<String> INFERRED_GROUPS = List.of("loves", "good_at", "world_needs");

    private ResponseValidator() {
    }

    public static Result<Map<String, Object>> validate(Object raw, Chips chips) {
        if (!(raw instanceof Map<?, ?> r)) {
            return Result.err("Not an object");
        }
        if (!(r.get("targets") instanceof List<?> targets) || targets.size() != 3) {
            return Result.err("Expected exactly 3 targets");
        }
        if (!(r.get("bridge") instanceof Map<?, ?> bridge)) {
            return Result.err("Bridge must have 3 steps");
        }
        if (!(bridge.get("steps") instanceof List<?> steps) || steps.size() != 3) {
            return Result.err("Bridge must have 3 steps");
        }

        List<Map<String, Object>> cleanTargets = new ArrayList<>();
        for (Object candidate : targets) {
            if (!(candidate instanceof Map<?, ?> target) || !(target.get("title") instanceof String title)) {
                return Result.err("Invalid target shape");
            }
            Map<?, ?> pay = target.get("est_pay_range") instanceof Map<?, ?> p ? p : Map.of();
            Map<String, Object> clean = new LinkedHashMap<>();
            clean.put("title", title);
            clean.put("why_it_fits", target.get("why_it_fits") == null ? "" : String.valueOf(target.get("why_it_fits")));
            clean.put("circles", list(target.get("circles")));
            clean.put("skill_gap", list(target.get("skill_gap")));
            Map<String, Object> range = new LinkedHashMap<>();
            range.put("min", narrow(clamp(number(pay.get("min"), PAY_MIN), PAY_MIN, PAY_MAX)));
            range.put("max", narrow(clamp(number(pay.get("max"), PAY_MIN), PAY_MIN, PAY_MAX)));
            clean.put("est_pay_range", range);
            clean.put("est_weeks_to_ready", narrow(clamp(number(target.get("est_weeks_to_ready"), 1), 1, 52)));
            cleanTargets.add(clean);
        }

        Map<String, Object> cleanBridge = new LinkedHashMap<>();
        List<String> cleanSteps = new ArrayList<>();
        for (Object step : steps) {
            cleanSteps.add(step == null ? "null" : String.valueOf(step));
        }
        cleanBridge.put("steps", cleanSteps);
        if (bridge.get("runway_months") != null) {
            cleanBridge.put("runway_months", narrow(number(bridge.get("runway_months"), 0)));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("targets", cleanTargets);
        result.put("bridge", cleanBridge);

        if (r.get("inferred") instanceof Map<?, ?> inferred) {
            Map<String, Object> kept = new LinkedHashMap<>();
            for (String group : INFERRED_GROUPS) {
                List<String> filtered = new ArrayList<>();
                if (inferred.get(group) instanceof List<?> values) {
                    for (Object value : values) {
                        if (value instanceof String chip && chips.known(group, chip)) {
                            filtered.add(chip);
                        }
                    }
                }
                kept.put(group, filtered);
            }
            result.put("inferred", kept);
        }

        return Result.ok(result);
    }

    private static List<String> list(Object value) {
        List<String> out = new ArrayList<>();
        if (value instanceof List<?> items) {
            for (Object item : items) {
                out.add(item == null ? "null" : String.valueOf(item));
            }
        }
        return out;
    }

    private static double number(Object value, double fallback) {
        double parsed = RequestValidator.number(value, fallback);
        return parsed == 0 ? fallback : parsed;
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    /** Whole numbers serialise without a trailing .0, the way JavaScript writes them. */
    private static Object narrow(double value) {
        return value == Math.rint(value) ? (Object) (long) value : (Object) value;
    }
}

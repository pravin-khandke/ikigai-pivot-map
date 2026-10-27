package com.ikigai.pivotmap.api;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Port of {@code validateRequest} from server/api.js. Every message string matches the
 * JavaScript original, because the client shows them verbatim.
 */
public final class RequestValidator {

    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\x00-\\x1f\\x7f]");
    private static final Set<String> RETRAIN_VALUES = Set.of("none", "weeks", "months");
    private static final int MAX_ROLE = 60;
    private static final int MAX_RESUME = 6000;

    private RequestValidator() {
    }

    public static Result<ValidatedRequest> validate(Object body, Chips chips) {
        if (!(body instanceof Map<?, ?> b)) {
            return Result.err("Invalid request body");
        }

        String role = b.get("role") instanceof String text ? clean(text) : "";
        role = truncate(role, MAX_ROLE);

        String resume = b.get("resume_text") instanceof String text ? clean(text) : null;
        if (resume != null) {
            resume = truncate(resume, MAX_RESUME);
            if (resume.isEmpty()) {
                resume = null;
            }
        }

        if (role.isEmpty() && resume == null) {
            return Result.err("Role is required when no resume is provided");
        }

        for (String group : Chips.GROUPS) {
            Object value = b.get(group);
            if (!(value instanceof List<?> list)) {
                continue;
            }
            for (Object chip : list) {
                if (!(chip instanceof String text) || !chips.known(group, text)) {
                    return Result.err("Unknown chip \"" + stringify(chip) + "\" in " + group);
                }
            }
        }

        String retrain = b.get("retrain") instanceof String text ? text : null;
        if (retrain == null || !RETRAIN_VALUES.contains(retrain)) {
            return Result.err("retrain must be none|weeks|months");
        }

        return Result.ok(new ValidatedRequest(
                role,
                clamp(number(b.get("years"), 0), 0, 40),
                clamp(number(b.get("savings_months"), 0), 0, 24),
                clamp(number(b.get("min_income"), 0), 0, 300000),
                retrain,
                strings(b.get("loves")),
                strings(b.get("enjoyed_most")),
                strings(b.get("good_at")),
                strings(b.get("world_needs")),
                strings(b.get("help_who")),
                resume));
    }

    /** Trim, then drop control characters the way the JavaScript replace does. */
    static String clean(String value) {
        return CONTROL_CHARS.matcher(value).replaceAll("").trim();
    }

    static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** Number(x) || 0 from the JavaScript: null, blank and garbage all become the default. */
    static double number(Object value, double fallback) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        if (value instanceof String text) {
            try {
                return Double.parseDouble(text.trim());
            } catch (NumberFormatException e) {
                return fallback;
            }
        }
        return fallback;
    }

    static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static List<String> strings(Object value) {
        List<String> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof String text) {
                    out.add(text);
                }
            }
        }
        return List.copyOf(out);
    }

    private static String stringify(Object value) {
        if (value instanceof Double d && d == Math.rint(d)) {
            return String.valueOf(d.longValue());
        }
        return value == null ? "null" : String.valueOf(value);
    }

    /** Prints a number the way JavaScript template interpolation would. */
    static String format(double value) {
        if (value == Math.rint(value) && !Double.isInfinite(value)) {
            return String.format(Locale.ROOT, "%d", (long) value);
        }
        return String.valueOf(value);
    }
}

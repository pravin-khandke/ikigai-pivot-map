package com.ikigai.pivotmap.api;

import java.util.List;

/**
 * Validated profile input, the Java twin of the object returned by
 * {@code validateRequest} in the original server/api.js.
 *
 * <p>Numbers stay {@code double} because the JavaScript source clamps rather than
 * rounds, and the prompt prints them the way JavaScript would.
 */
public record ValidatedRequest(
        String role,
        double years,
        double savingsMonths,
        double minIncome,
        String retrain,
        List<String> loves,
        List<String> enjoyedMost,
        List<String> goodAt,
        List<String> worldNeeds,
        List<String> helpWho,
        String resumeText) {
}

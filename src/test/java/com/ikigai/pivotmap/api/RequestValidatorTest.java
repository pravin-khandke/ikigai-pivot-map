package com.ikigai.pivotmap.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

/**
 * Port of the validateRequest block in client/tests/api.test.js, same cases and
 * same expectations, so the Java API cannot drift from the JavaScript original.
 */
class RequestValidatorTest {

    private static Chips chips;

    @BeforeAll
    static void loadChips() {
        chips = new Chips(new ObjectMapper());
    }

    private static Map<String, Object> validBody(Object... overrides) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("role", "UX Designer");
        body.put("years", 5);
        body.put("loves", List.of("helping people"));
        body.put("good_at", List.of("explaining"));
        body.put("world_needs", List.of("health"));
        body.put("enjoyed_most", List.of("finding errors"));
        body.put("help_who", List.of("patients"));
        body.put("savings_months", 4);
        body.put("min_income", 40000);
        body.put("retrain", "weeks");
        for (int i = 0; i < overrides.length; i += 2) {
            body.put((String) overrides[i], overrides[i + 1]);
        }
        return body;
    }

    @Test
    @DisplayName("rejects unknown chip")
    void rejectsUnknownChip() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("loves", List.of("skydiving")), chips);
        assertThat(result.ok()).isFalse();
        assertThat(result.error()).containsIgnoringCase("chip");
    }

    @Test
    void clampsSavingsMonthsTo24() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("savings_months", 999), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().savingsMonths()).isEqualTo(24);
    }

    @Test
    void stripsControlCharactersFromRole() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("role", "UX\u0000\u0007 Designer"), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().role()).isEqualTo("UX Designer");
    }

    @Test
    void truncatesRoleTo60() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("role", "A".repeat(61)), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().role()).hasSize(60);
    }

    @Test
    void rejectsEmptyRoleWithNoResume() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("role", ""), chips);
        assertThat(result.ok()).isFalse();
        assertThat(result.error()).containsIgnoringCase("role");
    }

    @Test
    void acceptsResumeOnlyRequest() {
        Result<ValidatedRequest> result = RequestValidator.validate(
                validBody("role", "", "resume_text", "I have 5 years of experience."), chips);
        assertThat(result.ok()).isTrue();
    }

    @Test
    void clampsYearsTo40() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("years", 100), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().years()).isEqualTo(40);
    }

    @Test
    void clampsMinIncomeTo300000() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("min_income", 999999), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().minIncome()).isEqualTo(300000);
    }

    @Test
    void rejectsWhitespaceOnlyRoleWithNoResume() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("role", "   "), chips);
        assertThat(result.ok()).isFalse();
        assertThat(result.error()).containsIgnoringCase("role");
    }

    @Test
    void acceptsWhitespaceOnlyRoleWithResume() {
        Result<ValidatedRequest> result = RequestValidator.validate(
                validBody("role", "   ", "resume_text", "I worked 5 years."), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().role()).isEmpty();
    }

    @Test
    void treatsWhitespaceOnlyResumeAsAbsent() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("resume_text", "   "), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().resumeText()).isNull();
    }

    @Test
    void rejectsInvalidRetrain() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("retrain", "years"), chips);
        assertThat(result.ok()).isFalse();
    }

    @Test
    void truncatesResumeTo6000() {
        Result<ValidatedRequest> result = RequestValidator.validate(validBody("resume_text", "x".repeat(7000)), chips);
        assertThat(result.ok()).isTrue();
        assertThat(result.value().resumeText()).hasSize(6000);
    }

    @Test
    void rejectsNonObjectBody() {
        assertThat(RequestValidator.validate("nope", chips).error()).isEqualTo("Invalid request body");
        assertThat(RequestValidator.validate(null, chips).ok()).isFalse();
    }
}

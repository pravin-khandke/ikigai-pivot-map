package com.ikigai.pivotmap.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

/** Port of the validateResponse and buildMessages blocks in client/tests/api.test.js. */
class ResponseValidatorTest {

    private static Chips chips;

    @BeforeAll
    static void loadChips() {
        chips = new Chips(new ObjectMapper());
    }

    private static Map<String, Object> validLlmResponse() {
        List<Map<String, Object>> targets = new ArrayList<>();
        targets.add(target("A", "love", 50000, 70000, 6));
        targets.add(target("B", "good", 40000, 60000, 4));
        targets.add(target("C", "need", 45000, 65000, 8));

        Map<String, Object> bridge = new LinkedHashMap<>();
        bridge.put("steps", List.of("step 1", "step 2", "step 3"));
        bridge.put("runway_months", 4);

        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("targets", targets);
        raw.put("bridge", bridge);
        return raw;
    }

    private static Map<String, Object> target(String title, String circle, int min, int max, int weeks) {
        Map<String, Object> range = new LinkedHashMap<>();
        range.put("min", min);
        range.put("max", max);
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("title", title);
        target.put("why_it_fits", "fits");
        target.put("circles", List.of(circle));
        target.put("skill_gap", List.of("gap"));
        target.put("est_pay_range", range);
        target.put("est_weeks_to_ready", weeks);
        return target;
    }

    @Test
    void clampsPayToOneHundredThousand() {
        Map<String, Object> raw = validLlmResponse();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> targets = (List<Map<String, Object>>) raw.get("targets");
        targets.set(0, target("A", "love", 1_000_000_000, 1_000_000_000, 6));

        Result<Map<String, Object>> result = ResponseValidator.validate(raw, chips);
        assertThat(result.ok()).isTrue();
        @SuppressWarnings("unchecked")
        Map<String, Object> pay = (Map<String, Object>) firstTarget(result).get("est_pay_range");
        assertThat(pay.get("min")).isEqualTo(250000L);
        assertThat(pay.get("max")).isEqualTo(250000L);
    }

    @Test
    void clampsWeeksZeroToOne() {
        Map<String, Object> raw = validLlmResponse();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> targets = (List<Map<String, Object>>) raw.get("targets");
        Map<String, Object> first = target("A", "love", 50000, 70000, 0);
        targets.set(0, first);

        Result<Map<String, Object>> result = ResponseValidator.validate(raw, chips);
        assertThat(result.ok()).isTrue();
        assertThat(firstTarget(result).get("est_weeks_to_ready")).isEqualTo(1L);
    }

    @Test
    void rejectsTwoTargets() {
        Map<String, Object> raw = validLlmResponse();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> targets = (List<Map<String, Object>>) raw.get("targets");
        targets.remove(2);

        Result<Map<String, Object>> result = ResponseValidator.validate(raw, chips);
        assertThat(result.ok()).isFalse();
        assertThat(result.error()).isEqualTo("Expected exactly 3 targets");
    }

    @Test
    void filtersInferredChipsToKnownVocabulary() {
        Map<String, Object> raw = validLlmResponse();
        Map<String, Object> inferred = new LinkedHashMap<>();
        inferred.put("loves", List.of("helping people", "FAKE CHIP"));
        inferred.put("good_at", List.of("explaining"));
        inferred.put("world_needs", List.of("safety", "alien invasion"));
        raw.put("inferred", inferred);

        Result<Map<String, Object>> result = ResponseValidator.validate(raw, chips);
        assertThat(result.ok()).isTrue();
        @SuppressWarnings("unchecked")
        Map<String, Object> kept = (Map<String, Object>) result.value().get("inferred");
        assertThat(kept.get("loves")).isEqualTo(List.of("helping people"));
        assertThat(kept.get("world_needs")).isEqualTo(List.of("safety"));
    }

    @Test
    void rejectsBridgeWithoutThreeSteps() {
        Map<String, Object> raw = validLlmResponse();
        raw.put("bridge", Map.of("steps", List.of("only one")));
        assertThat(ResponseValidator.validate(raw, chips).ok()).isFalse();
    }

    @Test
    void omitsRunwayWhenAbsent() {
        Map<String, Object> raw = validLlmResponse();
        raw.put("bridge", Map.of("steps", List.of("a", "b", "c")));
        Result<Map<String, Object>> result = ResponseValidator.validate(raw, chips);
        assertThat(result.ok()).isTrue();
        @SuppressWarnings("unchecked")
        Map<String, Object> bridge = (Map<String, Object>) result.value().get("bridge");
        assertThat(bridge).doesNotContainKey("runway_months");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstTarget(Result<Map<String, Object>> result) {
        return ((List<Map<String, Object>>) result.value().get("targets")).get(0);
    }
}

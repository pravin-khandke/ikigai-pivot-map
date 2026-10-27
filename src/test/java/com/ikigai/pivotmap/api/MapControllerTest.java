package com.ikigai.pivotmap.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import tools.jackson.databind.ObjectMapper;

/** Port of the handleMap block in client/tests/api.test.js, driven through MockMvc. */
class MapControllerTest {

    private MockMvc mvc;
    private ObjectMapper mapper;
    private StubLlm stub;

    /** Stand-in for the provider, so the tests never touch the network. */
    static final class StubLlm implements LlmClient {

        Object reply;
        LlmClient.LlmException failure;

        @Override
        public Object complete(List<Map<String, String>> messages) throws LlmException {
            if (failure != null) {
                throw failure;
            }
            return reply;
        }
    }

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
        stub = new StubLlm();
        mvc = MockMvcBuilders
                .standaloneSetup(new MapController(mapper, new Chips(mapper), stub, new RateLimiter()))
                .build();
    }

    private String validBody() {
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
        return mapper.writeValueAsString(body);
    }

    private Map<String, Object> validReply() {
        Map<String, Object> target = new LinkedHashMap<>();
        target.put("title", "A");
        target.put("why_it_fits", "fits");
        target.put("circles", List.of("love"));
        target.put("skill_gap", List.of("x"));
        target.put("est_pay_range", Map.of("min", 50000, "max", 70000));
        target.put("est_weeks_to_ready", 6);

        Map<String, Object> bridge = new LinkedHashMap<>();
        bridge.put("steps", List.of("one", "two", "three"));
        bridge.put("runway_months", 4);

        Map<String, Object> reply = new LinkedHashMap<>();
        reply.put("targets", List.of(target, target, target));
        reply.put("bridge", bridge);
        return reply;
    }

    @Test
    void rejectsGetWith405() throws Exception {
        mvc.perform(get("/api/map"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void responds502WhenModelReturnsWrongShape() throws Exception {
        stub.reply = Map.of("bad", "shape");
        mvc.perform(post("/api/map").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("Invalid LLM response"));
    }

    @Test
    void responds502WhenModelTimesOut() throws Exception {
        stub.failure = new LlmClient.LlmException("LLM service error");
        mvc.perform(post("/api/map").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isBadGateway());
    }

    @Test
    void responds200WithThreeTargets() throws Exception {
        stub.reply = validReply();
        String body = mvc.perform(post("/api/map").contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targets.length()").value(3))
                .andExpect(jsonPath("$.bridge.steps.length()").value(3))
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(body).contains("\"title\":\"A\"");
    }

    @Test
    void responds400OnInvalidRequest() throws Exception {
        mvc.perform(post("/api/map").contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Role is required when no resume is provided"));
    }

    @Test
    void responds400OnBrokenJson() throws Exception {
        mvc.perform(post("/api/map").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid JSON"));
    }

    @Test
    void responds413OnOversizedBody() throws Exception {
        String padding = "x".repeat(65536);
        String body = "{\"role\":\"" + padding + "\",\"retrain\":\"weeks\"}";
        mvc.perform(post("/api/map").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isPayloadTooLarge());
    }
}

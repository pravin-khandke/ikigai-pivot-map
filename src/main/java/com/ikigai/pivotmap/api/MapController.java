package com.ikigai.pivotmap.api;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.ObjectMapper;

/**
 * POST /api/map, the Java replacement for {@code handleMap} in server/api.js.
 *
 * <p>Status codes are part of the contract the browser relies on: 400 for a bad
 * request, 405 for the wrong method, 413 for an oversized body, 429 when the
 * address is over its allowance, 502 when the model is unavailable or answers with
 * an unusable shape.
 */
@RestController
public class MapController {

    private static final int MAX_BODY = 65536;

    private final ObjectMapper mapper;
    private final Chips chips;
    private final LlmClient llm;
    private final RateLimiter limiter;

    public MapController(ObjectMapper mapper, Chips chips, LlmClient llm, RateLimiter limiter) {
        this.mapper = mapper;
        this.chips = chips;
        this.llm = llm;
        this.limiter = limiter;
    }

    @PostMapping(path = "/api/map", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Object> map(@RequestBody(required = false) String body,
                                      HttpServletRequest request) {
        if (body != null && body.length() > MAX_BODY) {
            return error(HttpStatus.PAYLOAD_TOO_LARGE, "Payload too large");
        }

        Object parsed;
        try {
            parsed = body == null || body.isBlank() ? null : mapper.readValue(body, Object.class);
        } catch (Exception e) {
            return error(HttpStatus.BAD_REQUEST, "Invalid JSON");
        }

        Result<ValidatedRequest> validated = RequestValidator.validate(parsed, chips);
        if (!validated.ok()) {
            return error(HttpStatus.BAD_REQUEST, validated.error());
        }

        if (!limiter.allow(address(request))) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "Rate limit exceeded");
        }

        List<Map<String, String>> messages = PromptBuilder.buildMessages(validated.value());

        Object raw;
        try {
            raw = llm.complete(messages);
        } catch (LlmClient.LlmException e) {
            return error(HttpStatus.BAD_GATEWAY, e.getMessage());
        }

        Result<Map<String, Object>> checked = ResponseValidator.validate(raw, chips);
        if (!checked.ok()) {
            return error(HttpStatus.BAD_GATEWAY, "Invalid LLM response");
        }
        return ResponseEntity.ok(checked.value());
    }

    private static String address(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private static ResponseEntity<Object> error(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }
}

package com.ikigai.pivotmap.api;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

/**
 * DeepSeek chat-completions client, the Java replacement for the fetch call in
 * server/api.js. Two behaviours carry over: an eight second timeout, and a JSON
 * response format request so the reply parses without markup stripping.
 */
@Component
public class DeepSeekClient implements LlmClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(8);

    private final ObjectMapper mapper;
    private final String endpoint;
    private final String model;
    private final String apiKey;

    public DeepSeekClient(
            ObjectMapper mapper,
            @Value("${ikigai.deepseek.endpoint:https://api.deepseek.com/chat/completions}") String endpoint,
            @Value("${ikigai.deepseek.model:deepseek-chat}") String model,
            @Value("${DEEPSEEK_API_KEY:}") String apiKey) {
        this.mapper = mapper;
        this.endpoint = endpoint;
        this.model = model;
        this.apiKey = apiKey;
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public Object complete(List<Map<String, String>> messages) throws LlmException {
        if (!hasApiKey()) {
            throw new LlmException("LLM service unavailable");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("messages", messages);

        String body;
        try {
            body = HttpJson.postJson(endpoint, Map.of(
                    "Content-Type", "application/json",
                    "Authorization", "Bearer " + apiKey), mapper.writeValueAsString(payload), TIMEOUT);
        } catch (HttpJson.StatusException e) {
            throw new LlmException("LLM request failed", e);
        } catch (Exception e) {
            throw new LlmException("LLM service error", e);
        }

        try {
            Map<?, ?> data = mapper.readValue(body, Map.class);
            Object content = content(data);
            if (content == null) {
                throw new LlmException("Invalid LLM response");
            }
            if (content instanceof String text) {
                return mapper.readValue(text, Object.class);
            }
            return content;
        } catch (LlmException e) {
            throw e;
        } catch (Exception e) {
            throw new LlmException("Invalid LLM response", e);
        }
    }

    /** choices[0].message.content, or the whole body when the provider already parsed it. */
    private static Object content(Map<?, ?> data) {
        if (!(data.get("choices") instanceof List<?> choices) || choices.isEmpty()) {
            return null;
        }
        if (!(choices.get(0) instanceof Map<?, ?> choice)) {
            return null;
        }
        if (!(choice.get("message") instanceof Map<?, ?> message)) {
            return null;
        }
        return message.get("content");
    }
}

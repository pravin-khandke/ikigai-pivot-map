package com.ikigai.pivotmap.api;

import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

/**
 * The chip vocabulary from {@code data/chips.json}, loaded once and used to reject
 * unknown chips on the way in and to filter model-invented chips on the way out.
 */
@Component
public class Chips {

    /** Same order and names as CHIP_GROUPS in api.js. */
    public static final List<String> GROUPS =
            List.of("loves", "enjoyed_most", "good_at", "world_needs", "help_who");

    private final Map<String, Set<String>> byGroup;

    public Chips(ObjectMapper mapper) {
        this.byGroup = load(mapper);
    }

    private static Map<String, Set<String>> load(ObjectMapper mapper) {
        try (InputStream in = new ClassPathResource("data/chips.json").getInputStream()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> raw = mapper.readValue(in, Map.class);
            Map<String, Set<String>> out = new HashMap<>();
            for (String group : GROUPS) {
                Set<String> known = new LinkedHashSet<>();
                if (raw.get(group) instanceof List<?> list) {
                    for (Object chip : list) {
                        if (chip instanceof String text) {
                            known.add(text);
                        }
                    }
                }
                out.put(group, Set.copyOf(known));
            }
            return out;
        } catch (Exception e) {
            throw new IllegalStateException("cannot load data/chips.json", e);
        }
    }

    public boolean known(String group, String chip) {
        Set<String> known = byGroup.get(group);
        return known != null && known.contains(chip);
    }

    public Set<String> group(String group) {
        return byGroup.getOrDefault(group, Set.of());
    }
}

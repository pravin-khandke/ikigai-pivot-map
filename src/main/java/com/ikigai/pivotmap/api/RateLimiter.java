package com.ikigai.pivotmap.api;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Fixed-window per-address limiter, the same shape as {@code createRateLimiter} in
 * server/api.js: ten requests a minute per address by default.
 */
@Component
public class RateLimiter {

    private static final int DEFAULT_LIMIT = 10;
    private static final long DEFAULT_WINDOW_MS = 60_000;

    private final int limit;
    private final long windowMs;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimiter() {
        this(DEFAULT_LIMIT, DEFAULT_WINDOW_MS);
    }

    public RateLimiter(int limit, long windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    /** @return true when this request is within the allowance */
    public boolean allow(String address) {
        long now = System.currentTimeMillis();
        Bucket bucket = buckets.compute(address, (key, existing) -> {
            if (existing == null || now > existing.reset) {
                return new Bucket(1, now + windowMs);
            }
            existing.increment();
            return existing;
        });
        return bucket.count <= limit;
    }

    private static final class Bucket {

        private int count;
        private final long reset;

        Bucket(int count, long reset) {
            this.count = count;
            this.reset = reset;
        }

        void increment() {
            count++;
        }
    }
}

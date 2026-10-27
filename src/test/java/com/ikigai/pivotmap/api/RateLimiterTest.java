package com.ikigai.pivotmap.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Port of the createRateLimiter block in client/tests/api.test.js. */
class RateLimiterTest {

    @Test
    void allowsTenThenRejectsAndRecovers() throws InterruptedException {
        RateLimiter limiter = new RateLimiter(10, 100);

        for (int i = 1; i <= 10; i++) {
            assertThat(limiter.allow("1.2.3.4")).as("request %d should pass", i).isTrue();
        }
        assertThat(limiter.allow("1.2.3.4")).as("11th should be rejected").isFalse();
        assertThat(limiter.allow("5.6.7.8")).as("other address still works").isTrue();

        Thread.sleep(150);
        assertThat(limiter.allow("1.2.3.4")).as("recovers after the window").isTrue();
    }
}

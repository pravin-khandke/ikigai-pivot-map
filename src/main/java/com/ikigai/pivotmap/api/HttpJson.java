package com.ikigai.pivotmap.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/** Minimal JSON-over-HTTP helper so the API needs no extra HTTP client dependency. */
final class HttpJson {

    private HttpJson() {
    }

    /** Thrown when the provider answers with a status outside 2xx. */
    static final class StatusException extends RuntimeException {

        private final int status;

        StatusException(int status) {
            super("HTTP " + status);
            this.status = status;
        }

        int status() {
            return status;
        }
    }

    static String postJson(String url, Map<String, String> headers, String body, Duration timeout)
            throws Exception {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url))
                .timeout(timeout)
                .POST(HttpRequest.BodyPublishers.ofString(body));
        headers.forEach(request::header);

        HttpResponse<String> response =
                client.send(request.build(), HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new StatusException(response.statusCode());
        }
        return response.body();
    }
}

package com.ikigai.pivotmap.api;

import java.util.List;
import java.util.Map;

/** The one thing the controller needs from a model provider, so tests can stub it. */
public interface LlmClient {

    /**
     * Send the chat messages and return the parsed JSON object from the reply.
     *
     * @throws LlmException when the provider is unreachable, refuses, or answers with
     *                      something that is not JSON
     */
    Object complete(List<Map<String, String>> messages) throws LlmException;

    /** Message text is shown to the caller as the error body, so keep them short. */
    class LlmException extends Exception {

        public LlmException(String message) {
            super(message);
        }

        public LlmException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}

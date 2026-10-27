package com.ikigai.pivotmap.api;

/** Tiny Either-style result used by the request and response validators. */
public record Result<T>(boolean ok, T value, String error) {

    public static <T> Result<T> ok(T value) {
        return new Result<>(true, value, null);
    }

    public static <T> Result<T> err(String error) {
        return new Result<>(false, null, error);
    }
}

"use client";
import { useEffect } from "react";

// Patches window.fetch in dashboard pages to inject Authorization header
// for all /api/ requests, so pages with raw fetch() calls work with JWT auth.
export function AuthFetchPatch() {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url;

      if (url.startsWith("/api/")) {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("tradeops_token")
            : null;
        if (token) {
          const headers = new Headers((init?.headers as HeadersInit) ?? {});
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          init = { ...init, headers };
        }
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}

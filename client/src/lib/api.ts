// Helper function to make authenticated API calls
export async function authFetch(url: string, options: globalThis.RequestInit = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("auth:token") : null;
  const language =
    typeof window !== "undefined" ? window.localStorage.getItem("language") || "eu" : "eu";

  const headers = {
    "Content-Type": "application/json",
    "Accept-Language": language,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/** Multipart upload: do not set `Content-Type` so the browser sets the boundary. */
export async function authFetchFormData(url: string, formData: FormData) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("auth:token") : null;
  const language =
    typeof window !== "undefined" ? window.localStorage.getItem("language") || "eu" : "eu";

  return fetch(url, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
      "Accept-Language": language,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

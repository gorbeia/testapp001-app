// Helper function to make authenticated API calls
export async function authFetch(url: string, options: RequestInit = {}) {
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

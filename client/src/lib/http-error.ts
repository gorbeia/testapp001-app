const HTTP_STATUS_PREFIX = /^(\d{3}):/;

function messageFromUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/** Parse leading `NNN:` from errors thrown by {@link throwIfResNotOk} / {@link readJsonOrThrow}. */
export function getHttpErrorStatus(error: unknown): number | null {
  const m = messageFromUnknownError(error).match(HTTP_STATUS_PREFIX);
  return m ? parseInt(m[1], 10) : null;
}

/** True when the failed response was HTTP 403 (forbidden / access denied). */
export function isHttpForbidden(error: unknown): boolean {
  return getHttpErrorStatus(error) === 403;
}

export async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function readJsonOrThrow<T>(res: Response): Promise<T> {
  await throwIfResNotOk(res);
  return res.json() as Promise<T>;
}

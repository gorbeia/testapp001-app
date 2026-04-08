/** Info-level logs skipped in automated tests (integration uses `NODE_ENV=test`). */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(...args);
}

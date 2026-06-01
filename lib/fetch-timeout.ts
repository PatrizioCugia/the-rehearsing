/**
 * Demo-fatal guard: a fetch that cannot hang forever. Wraps fetch with an
 * AbortController so a slow or dropped upstream returns control to the caller
 * instead of stranding the UI on an "Analyzing the take." beat.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = 30_000
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

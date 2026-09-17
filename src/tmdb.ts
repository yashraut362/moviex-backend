export type TmdbResult = { status: number; body: unknown };
export type TmdbClient = (path: string, params?: Record<string, string>) => Promise<TmdbResult>;

const BASE = "https://api.themoviedb.org/3";

export function createTmdbClient(apiKey: string, fetchFn: typeof fetch = fetch): TmdbClient {
  return async (path, params = {}) => {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("api_key", apiKey);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    let res: Response;
    try {
      res = await fetchFn(url);
    } catch {
      return { status: 502, body: { error: "upstream unavailable" } };
    }

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body && typeof body === "object" && typeof (body as { status_message?: unknown }).status_message === "string"
          ? (body as { status_message: string }).status_message
          : "upstream error";
      return { status: res.status, body: { error: message } };
    }
    return { status: 200, body };
  };
}

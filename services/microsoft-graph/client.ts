const GRAPH = "https://graph.microsoft.com/v1.0";

export class MicrosoftGraphError extends Error {
  constructor(public readonly status: number, public readonly code?: string) {
    super(`GRAPH_${status}${code ? `_${code}` : ""}`);
  }
}

export class MicrosoftGraphClient {
  constructor(private readonly accessToken: string) {}

  async request<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(path.startsWith("https://") ? path : `${GRAPH}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
      throw new MicrosoftGraphError(response.status, body?.error?.code);
    }
    return response.json() as Promise<T>;
  }
}

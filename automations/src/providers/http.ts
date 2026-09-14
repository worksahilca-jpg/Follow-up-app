import type { HttpProvider } from './types.js';

export class FetchHttp implements HttpProvider {
  async post(url: string, body: unknown): Promise<{ status: number }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status}`);
    }
    return { status: res.status };
  }
}

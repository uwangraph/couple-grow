export const API_URL = 'https://couple-grow.uwangraph.workers.dev';

export async function readApiJson<T extends Record<string, unknown> = Record<string, unknown>>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return { error: 'Server mengembalikan respons yang tidak valid.' } as unknown as T;
  }
}

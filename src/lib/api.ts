import { API_BASE, API_ORIGIN } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** El AuthProvider registra aquí cómo renovar el token ante un 401. */
export function setRefreshHandler(handler: (() => Promise<string | null>) | null) {
  refreshHandler = handler;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // Fallo de red (backend apagado, IP/red equivocada, firewall)
    throw new ApiError(
      0,
      `No se pudo conectar con el servidor (${API_ORIGIN}). Verifica que el backend esté encendido y que el teléfono esté en la misma red.`,
    );
  }

  if (res.status === 401 && retry && refreshHandler) {
    const next = await refreshHandler();
    if (next) {
      accessToken = next;
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : (body.message ?? `Error ${res.status}`);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export interface UploadResult {
  key: string;
  url: string;
  mime: string;
  size: number;
}

/**
 * Sube un archivo local (foto, audio, video) al backend por multipart y
 * devuelve su `key` (`/uploads/...`). No fija Content-Type: fetch pone el
 * boundary correcto para FormData.
 */
async function upload(
  fileUri: string,
  opts?: { name?: string; type?: string },
): Promise<UploadResult> {
  const name = opts?.name ?? fileUri.split('/').pop() ?? 'file';
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name,
    type: opts?.type ?? 'application/octet-stream',
  } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError(0, `No se pudo subir el archivo (${API_ORIGIN}).`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`);
  }
  return (await res.json()) as UploadResult;
}

/** Construye la URL completa de un archivo servido por el backend. */
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith('http')) return key;
  if (key.startsWith('/')) return `${API_ORIGIN}${key}`;
  return null; // es una variante de avatar ilustrado, no una URL
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload,
};

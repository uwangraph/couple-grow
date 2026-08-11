/**
 * Helper untuk mengirim push notification via Firebase Cloud Messaging (FCM) HTTP v1.
 *
 * Menggunakan Service Account (JSON) yang dipasang sebagai secret
 * `FIREBASE_SERVICE_ACCOUNT` di Cloudflare Worker.
 *
 * Alur:
 *  1. Bangun JWT (RS256) yang ditandatangani dengan private key service account.
 *  2. Tukar JWT jadi Google OAuth2 access token.
 *  3. Kirim pesan ke FCM v1 API.
 */

type ServiceAccount = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri?: string;
};

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// Cache access token (berlaku ~1 jam, cache 55 menit).
let cachedToken: { token: string; expiresAt: number } | null = null;

function b64url(input: string | Uint8Array): string {
  let str: string;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    let bin = '';
    for (let i = 0; i < input.length; i++) bin += String.fromCharCode(input[i]);
    str = btoa(bin);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const toBase64Url = b64url;

/**
 * Import private key PEM (PKCS#8) ke CryptoKey untuk RS256 signing.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * Build & sign JWT untuk OAuth menggunakan private key service account.
 */
async function signJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = toBase64Url(JSON.stringify(header));
  const claimsB64 = toBase64Url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await importPrivateKey(sa.private_key);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    encoder.encode(signingInput)
  );
  const sigB64 = toBase64Url(new Uint8Array(signature));
  return `${signingInput}.${sigB64}`;
}

/**
 * Dapatkan OAuth2 access token dari Google, dengan caching.
 */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const jwt = await signJwt(sa);
  const tokenEndpoint = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`FCM oauth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresIn = (data.expires_in || 3600) * 1000;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresIn };
  return data.access_token;
}

/**
 * Kirim pesan push tunggal ke satu FCM token perangkat.
 * `data` adalah payload data yang diterima aplikasi (untuk navigasi dkk).
 */
export async function sendPush(
  serviceAccountJson: string,
  token: string,
  opts: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  if (!serviceAccountJson) return;
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch (_) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT bukan JSON valid');
  }

  const accessToken = await getAccessToken(sa);
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const message = {
    message: {
      token,
      notification: {
        title: opts.title,
        body: opts.body,
      },
      data: opts.data || {},
    },
  };

  const res = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    // Token tidak valid lagi (mis. app di-uninstall) → lempar agar pemanggil
    // bisa menghapus token dari DB.
    throw new Error(`FCM send failed: ${res.status} ${await res.text()}`);
  }
}

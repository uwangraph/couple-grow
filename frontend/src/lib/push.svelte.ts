import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { auth } from '$lib/auth.svelte';
import { API_URL } from '$lib/api';

let registeredForUser: string | null = null; // id user yang token-nya sudah didaftarkan
let listenersAttached = false;

/**
 * Inisialisasi push notification untuk aplikasi native (Capacitor).
 * Hanya aktif di platform native (Android/iOS), tidak di web.
 * Berjalan setiap kali layout app dimuat (saat user login).
 */
export async function initPushNotifications() {
  // Hanya untuk platform native (Android). Web/SvelteKit dev tidak perlu.
  if (!Capacitor.isNativePlatform()) return;
  if (!auth.token || !auth.user?.id) return;

  // Jika sudah terdaftar untuk user yang sama di sesi ini, lewati.
  if (registeredForUser === auth.user.id) return;

  try {
    await attachListenersOnce();
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive === 'denied') return;
    await PushNotifications.register();
  } catch (e) {
    // Gagal inisialisasi push jangan sampai mengganggu fungsi app.
    console.warn('Push init failed:', e);
  }
}

/**
 * Pasang listener sekali saja. 'registration' akan mengirim token ke backend.
 */
async function attachListenersOnce() {
  if (listenersAttached) return;
  listenersAttached = true;

  PushNotifications.addListener('registration', (token: Token) => {
    void registerTokenOnBackend(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('Push registration error:', err.error || err);
  });

  // Opsional: tangani saat notif diterima / diklik jika ingin navigasi.
  PushNotifications.addListener('pushNotificationActionPerformed', () => {
    // Bisa ditambahkan navigasi ke halaman terkait dari data notif.
  });
}

/**
 * Kirim token FCM perangkat ke backend agar backend bisa kirim push ke user ini.
 */
export async function registerTokenOnBackend(token: string) {
  if (!auth.token) return;
  try {
    await fetch(`${API_URL}/push/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ token }),
    });
    if (auth.user?.id) registeredForUser = auth.user.id;
  } catch (e) {
    console.warn('Register push token failed:', e);
  }
}

/**
 * Hapus token push perangkat di backend (mis. saat logout).
 */
export async function unregisterPushToken(token: string) {
  if (!auth.token) return;
  try {
    await fetch(`${API_URL}/push/token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (_) { /* non-blocking */ }
}

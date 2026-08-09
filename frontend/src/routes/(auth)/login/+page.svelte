<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import Icon from '$lib/Icon.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let email = $state('');
  let password = $state('');
  let errorMsg = $state('');
  let successMsg = $state('');
  let loading = $state(false);
  let mode = $state<'login' | 'forgot' | 'reset'>('login');
  let resetCode = $state('');
  let newPassword = $state('');
  let showPassword = $state(false);
  let showNewPassword = $state(false);
  let apkVersion = $state('');
  let apkDownloadUrl = $state('https://github.com/uwangraph/couple-grow/releases/latest');

  async function fetchLatestApk() {
    try {
      const response = await fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const latest = await response.json();
      apkVersion = latest.versionName || '';
      if (latest.downloadUrl) apkDownloadUrl = latest.downloadUrl;
    } catch (_) { /* keep the GitHub latest-release fallback */ }
  }

  onMount(() => {
    const qEmail = $page.url.searchParams.get('email');
    const qCode = $page.url.searchParams.get('code');
    if (qEmail && qCode) {
      email = qEmail;
      resetCode = qCode;
      mode = 'reset';
    }
    fetchLatestApk();
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    errorMsg = '';
    successMsg = '';
    loading = true;
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');
      auth.setToken(data.token);
      auth.setUser(data.user, data.partner || null);
      goto('/home');
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleForgotPassword(e: Event) {
    e.preventDefault();
    errorMsg = '';
    successMsg = '';
    loading = true;
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kode reset');
      successMsg = data.message || 'Jika email terdaftar, kode reset akan dikirim.';
      mode = 'reset';
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleResetPassword(e: Event) {
    e.preventDefault();
    errorMsg = '';
    successMsg = '';
    loading = true;
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: resetCode, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal reset password');
      successMsg = data.message || 'Password berhasil diubah.';
      password = '';
      resetCode = '';
      newPassword = '';
      mode = 'login';
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<form onsubmit={mode === 'login' ? handleLogin : mode === 'forgot' ? handleForgotPassword : handleResetPassword}>
  <h2 class="auth-title">
    {mode === 'login' ? 'Masuk ke Akunmu' : mode === 'forgot' ? 'Lupa Password' : 'Reset Password'}
  </h2>

  {#if errorMsg}
    <div class="auth-error" style="margin-bottom: 16px;">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="auth-success" style="margin-bottom: 16px;">{successMsg}</div>
  {/if}

  <div style="margin-bottom: 16px;">
    <label for="email" class="auth-label">Email</label>
    <input type="email" id="email" bind:value={email} required class="auth-input" placeholder="nama@email.com" />
  </div>

  {#if mode === 'login'}
    <div style="margin-bottom: 10px;">
      <label for="password" class="auth-label">Password</label>
      <div class="password-wrap">
        <input
          type={showPassword ? 'text' : 'password'}
          id="password"
          bind:value={password}
          required
          class="auth-input"
          placeholder="••••••••"
        />
        <button
          type="button"
          class="password-toggle"
          onclick={() => showPassword = !showPassword}
          aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          {#if showPassword}
            <!-- Eye-off icon -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          {:else}
            <!-- Eye icon -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          {/if}
        </button>
      </div>
    </div>
    <button type="button" class="link-button" onclick={() => { mode = 'forgot'; errorMsg = ''; successMsg = ''; }}>Lupa password?</button>
  {:else if mode === 'reset'}
    <div style="margin-bottom: 16px;">
      <label for="reset-code" class="auth-label">Kode Reset</label>
      <input type="text" id="reset-code" bind:value={resetCode} required maxlength={6} class="auth-input" placeholder="000000" />
    </div>
    <div style="margin-bottom: 24px;">
      <label for="new-password" class="auth-label">Password Baru</label>
      <div class="password-wrap">
        <input
          type={showNewPassword ? 'text' : 'password'}
          id="new-password"
          bind:value={newPassword}
          required
          minlength={6}
          class="auth-input"
          placeholder="Minimal 6 karakter"
        />
        <button
          type="button"
          class="password-toggle"
          onclick={() => showNewPassword = !showNewPassword}
          aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          {#if showNewPassword}
            <!-- Eye-off icon -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          {:else}
            <!-- Eye icon -->
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          {/if}
        </button>
      </div>
    </div>
  {/if}

  <button type="submit" disabled={loading} class="auth-btn flex items-center justify-center gap-2">
    {#if loading}
      <Icon name="loading" class="w-5 h-5 animate-spin invert" /> Memproses...
    {:else if mode === 'forgot'}
      Buat Kode Reset
    {:else if mode === 'reset'}
      Simpan Password
    {:else}
      Masuk
    {/if}

  </button>

  {#if mode === 'login'}
    <div class="apk-download-section">
      <div class="auth-divider"><span>atau</span></div>
      <a class="apk-download-btn" href={apkDownloadUrl} target="_blank" rel="noreferrer">
        Download APK{apkVersion ? ` v${apkVersion}` : ''}
      </a>
      <p class="apk-download-note">Versi Android terbaru, langsung dari GitHub Release</p>
    </div>
  {/if}

  <p style="text-align: center; font-size: 13px; color: #64748B; margin: 20px 0 0 0; font-family: Inter, sans-serif;">
    {#if mode === 'login'}
      Belum punya akun? <a href="/register" class="auth-link">Daftar sekarang</a>
    {:else}
      Ingat password? <button type="button" class="inline-auth-link" onclick={() => { mode = 'login'; errorMsg = ''; successMsg = ''; }}>Masuk</button>
    {/if}
  </p>
</form>

<style>
  .auth-title { font-size: 22px; font-weight: 900; color: #30435F; margin: 0 0 24px; font-family: 'Nunito', sans-serif; }
  .link-button {
    display: block;
    margin: 0 0 24px auto;
    padding: 0;
    border: none;
    background: transparent;
    color: #6BAFF2;
    font: 600 13px Inter, sans-serif;
    cursor: pointer;
  }
  .inline-auth-link {
    border: none;
    background: transparent;
    color: #6BAFF2;
    font: 600 13px Inter, sans-serif;
    cursor: pointer;
    padding: 0;
  }
  .apk-download-section { margin-top: 18px; text-align: center; }
  .auth-divider { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; color: #94A3B8; font-size: 11px; font-weight: 700; }
  .auth-divider::before, .auth-divider::after { content: ''; height: 1px; flex: 1; background: rgba(148,163,184,.28); }
  .apk-download-btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 13px 16px; box-sizing: border-box; border: 1.5px solid rgba(107,175,242,.45); border-radius: 14px; background: rgba(234,245,254,.72); color: #4F96E5; font: 800 14px 'Nunito', sans-serif; text-decoration: none; transition: transform .15s ease, background .15s ease; }
  .apk-download-btn:hover { background: rgba(219,234,254,.9); transform: translateY(-1px); }
  .apk-download-btn:active { transform: scale(.98); }
  .apk-download-note { margin: 8px 0 0; color: #94A3B8; font: 600 10px 'Nunito', sans-serif; }
</style>

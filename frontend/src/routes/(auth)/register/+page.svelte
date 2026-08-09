<script lang="ts">
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import Icon from '$lib/Icon.svelte';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let errorMsg = $state('');
  let loading = $state(false);
  let showPassword = $state(false);

  async function handleRegister(e: Event) {
    e.preventDefault();
    errorMsg = '';
    loading = true;
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Registrasi gagal');
      goto('/login');
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<form onsubmit={handleRegister}>
  <h2 style="font-size: 20px; font-weight: 700; color: #30435F; margin: 0 0 24px 0; font-family: Inter, sans-serif;">Buat Akun Baru</h2>

  {#if errorMsg}
    <div class="auth-error" style="margin-bottom: 16px;">{errorMsg}</div>
  {/if}

  <div style="margin-bottom: 16px;">
    <label for="name" class="auth-label">Nama Panggilan</label>
    <input type="text" id="name" bind:value={name} required class="auth-input" placeholder="Panggil aku..." />
  </div>

  <div style="margin-bottom: 16px;">
    <label for="email" class="auth-label">Email</label>
    <input type="email" id="email" bind:value={email} required class="auth-input" placeholder="nama@email.com" />
  </div>

  <div style="margin-bottom: 24px;">
    <label for="password" class="auth-label">Password</label>
    <div class="password-wrap">
      <input
        type={showPassword ? 'text' : 'password'}
        id="password"
        bind:value={password}
        required
        class="auth-input"
        placeholder="Min. 8 karakter"
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

  <button type="submit" disabled={loading} class="auth-btn flex items-center justify-center gap-2">
    {#if loading}
      <Icon name="loading" class="w-5 h-5 animate-spin invert" /> Memproses...
    {:else}
      Daftar Sekarang
    {/if}

  </button>

  <p style="text-align: center; font-size: 13px; color: #64748B; margin: 20px 0 0 0; font-family: Inter, sans-serif;">
    Sudah punya akun? <a href="/login" class="auth-link">Masuk di sini</a>
  </p>
</form>

<script lang="ts">
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import Icon from '$lib/Icon.svelte';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let errorMsg = $state('');
  let loading = $state(false);

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
      const data = await res.json();
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
  <h2 style="font-size: 20px; font-weight: 700; color: #2D3A5E; margin: 0 0 24px 0; font-family: Inter, sans-serif;">Buat Akun Baru</h2>

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
    <input type="password" id="password" bind:value={password} required class="auth-input" placeholder="Min. 8 karakter" />
  </div>

  <button type="submit" disabled={loading} class="auth-btn flex items-center justify-center gap-2">
    {#if loading}
      <Icon name="loading" class="w-5 h-5 animate-spin invert" /> Memproses...
    {:else}
      Daftar Sekarang <Icon name="arrow" class="w-4 h-4 invert" />
    {/if}

  </button>

  <p style="text-align: center; font-size: 13px; color: #8898c0; margin: 20px 0 0 0; font-family: Inter, sans-serif;">
    Sudah punya akun? <a href="/login" class="auth-link">Masuk di sini</a>
  </p>
</form>

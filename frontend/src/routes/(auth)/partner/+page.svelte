<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let inviteCode = $state('');
  let generatedCode = $state<string | null>(null);
  let errorMsg = $state('');
  let loading = $state(false);
  let copied = $state(false);

  onMount(() => {
    if (!auth.token) {
      goto('/login');
    }
  });

  async function generateCode() {
    if (!auth.token) {
      errorMsg = 'Sesi berakhir. Silakan masuk kembali.';
      goto('/login');
      return;
    }
    errorMsg = '';
    loading = true;
    try {
      const res = await fetch(`${API_URL}/partner/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        }
      });
      const data = await readApiJson<{ code?: string; error?: string }>(res);
      if (!res.ok || !data.code) throw new Error(data.error || 'Gagal membuat kode');
      generatedCode = data.code;
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }

  async function connectPartner() {
    if (!inviteCode) return;
    if (!auth.token) {
      errorMsg = 'Sesi berakhir. Silakan masuk kembali.';
      goto('/login');
      return;
    }
    errorMsg = '';
    loading = true;
    try {
      const res = await fetch(`${API_URL}/partner/connect`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ code: inviteCode })
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan');
      
      // Refresh both user and partner data from the server after connecting.
      await auth.init();
      goto('/wallet');
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }

  async function copyCode() {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {
      errorMsg = 'Kode tidak bisa disalin. Kamu bisa menyalinnya secara manual.';
    }
  }
</script>

<div class="partner-page">
  <div class="intro">
    <span class="intro-icon"><Icon name="couple" size={25} /></span>
    <p class="eyebrow">LANGKAH BERIKUTNYA</p>
    <h2>Lebih seru berdua.</h2>
    <p>Hubungkan akun untuk mulai mencatat dan merencanakan bersama pasanganmu.</p>
  </div>

  {#if errorMsg}<div class="error" role="alert">{errorMsg}</div>{/if}

  <section class="option-card">
    <div class="option-heading"><span class="step">01</span><div><h3>Bagikan kodemu</h3><p>Kirim kode undangan ini ke pasanganmu.</p></div></div>
    {#if generatedCode}
      <div class="code-display" aria-label="Kode undanganmu">{generatedCode}</div>
      <button type="button" class="primary-btn" onclick={copyCode}>{copied ? 'Tersalin!' : 'Salin kode'}</button>
    {:else}
      <button type="button" class="primary-btn" onclick={generateCode} disabled={loading}>{loading ? 'Menyiapkan...' : 'Buat kode undangan'}</button>
    {/if}
  </section>

  <div class="divider"><span>atau</span></div>

  <section class="option-card">
    <div class="option-heading"><span class="step">02</span><div><h3>Pakai kode pasangan</h3><p>Masukkan kode yang pasanganmu bagikan.</p></div></div>
    <label for="partner-invite-code" class="field-label">Kode undangan</label>
    <input id="partner-invite-code" type="text" bind:value={inviteCode} placeholder="6 digit kode" class="code-input" maxlength="6" autocomplete="off" autocapitalize="characters" oninput={() => inviteCode = inviteCode.toUpperCase().replace(/[^A-Z0-9]/g, '')} />
    <button type="button" onclick={connectPartner} disabled={loading || inviteCode.length !== 6} class="primary-btn">{loading ? 'Menghubungkan...' : 'Hubungkan akun'}</button>
  </section>

  <button type="button" onclick={() => goto('/home')} class="skip-btn">Nanti saja, ke beranda <span aria-hidden="true">→</span></button>
</div>

<style>
  .partner-page { font-family:'Nunito',sans-serif; color:#172033; }
  .intro { text-align:center; margin-bottom:28px; }
  .intro-icon { width:64px; height:64px; margin:0 auto 18px; display:grid; place-items:center; color:#fff; border-radius:22px; background:linear-gradient(145deg,#60a5fa,#1d4ed8); box-shadow:0 12px 26px rgba(37,99,235,.22); }
  .eyebrow { margin:0 0 8px; color:#2563eb; font-size:11px; font-weight:900; letter-spacing:.13em; }
  h2 { margin:0 0 10px; font-size:clamp(26px,7vw,32px); line-height:1.2; letter-spacing:-.03em; font-weight:900; }
  .intro > p:last-child { max-width:320px; margin:0 auto; color:#5c708d; font-size:14px; line-height:1.55; }
  .option-card { padding:20px; border:1px solid #dce9fa; border-radius:22px; background:rgba(248,251,255,.96); box-shadow:0 8px 24px rgba(30,91,162,.06); }
  .option-heading { display:flex; align-items:flex-start; gap:12px; margin-bottom:18px; }
  .step { display:grid; place-items:center; flex:none; width:36px; height:36px; border-radius:12px; color:#2563eb; background:#e8f2ff; font-size:12px; font-weight:900; }
  h3 { margin:0 0 4px; font-size:16px; font-weight:900; }
  .option-heading p { margin:0; color:#64748b; font-size:13px; line-height:1.45; }
  .code-display { margin-bottom:14px; padding:14px; border:1px dashed #8bbdf9; border-radius:14px; background:#fff; color:#1d4ed8; text-align:center; font-size:28px; font-weight:900; letter-spacing:.2em; user-select:all; }
  .primary-btn { width:100%; min-height:48px; border:0; border-radius:14px; background:#2563eb; color:#fff; font:800 15px 'Nunito',sans-serif; box-shadow:0 8px 18px rgba(37,99,235,.18); cursor:pointer; }
  .primary-btn:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
  .divider { display:flex; align-items:center; gap:12px; margin:18px 0; color:#64748b; font-size:12px; font-weight:800; text-transform:uppercase; }
  .divider::before,.divider::after { content:''; height:1px; background:#e2e8f0; flex:1; }
  .field-label { display:block; margin-bottom:8px; color:#475569; font-size:13px; font-weight:800; }
  .code-input { width:100%; box-sizing:border-box; min-height:50px; margin-bottom:12px; padding:10px 12px; border:1px solid #dbeafe; border-radius:14px; background:#fff; outline:0; text-align:center; color:#172033; font:800 18px 'Nunito',sans-serif; letter-spacing:.15em; }
  .code-input:focus { border-color:#60a5fa; box-shadow:0 0 0 3px rgba(37,99,235,.12); }
  .code-input::placeholder { letter-spacing:normal; font-size:14px; color:#94a3b8; }
  .error { margin-bottom:16px; padding:12px 14px; border-radius:12px; background:#fff1f2; color:#be123c; font-size:13px; font-weight:700; }
  .skip-btn { display:block; min-height:44px; margin:20px auto 0; padding:10px 14px; border:0; background:none; color:#526984; font:800 14px 'Nunito',sans-serif; cursor:pointer; }
  .skip-btn span { color:#2563eb; margin-left:4px; }
</style>

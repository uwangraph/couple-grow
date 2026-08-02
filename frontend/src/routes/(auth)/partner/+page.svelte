<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let inviteCode = $state('');
  let generatedCode = $state<string | null>(null);
  let errorMsg = $state('');
  let loading = $state(false);

  onMount(() => {
    if (!auth.token) {
      goto('/login');
    }
  });

  async function generateCode() {
    if (!auth.token) {
      errorMsg = 'Session expired. Please login again.';
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kode');
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
      errorMsg = 'Session expired. Please login again.';
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan');
      
      // Update user state to reflect connection
      if (auth.user) {
        auth.setUser({ ...auth.user, partner_id: 'connected' });
      }
      goto('/wallet');
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h2 class="text-xl font-semibold text-text-navy mb-2">Hubungkan Pasangan</h2>
    <p class="text-sm text-gray-500">Berikan kodemu atau masukkan kode dari pasanganmu untuk mulai.</p>
  </div>

  {#if errorMsg}
    <div class="p-3 bg-warning/20 text-warning rounded-lg text-sm">{errorMsg}</div>
  {/if}

  <div class="p-4 border border-white/60 bg-white/50 backdrop-blur-md rounded-xl shadow-[0_4px_16px_rgba(107,175,242,0.08)]">
    <h3 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
      <Icon name="dice" class="w-4 h-4 opacity-70" /> Buat Kode Undangan
    </h3>
    {#if generatedCode}
      <div class="text-center">
        <div class="text-3xl font-bold tracking-widest text-primary mb-2">{generatedCode}</div>
        <p class="text-xs text-gray-500">Berikan kode ini ke pasanganmu.</p>
      </div>
    {:else}
      <button onclick={generateCode} disabled={loading} class="w-full py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        <Icon name="dice" class="w-4 h-4 invert" /> Generate Kode
      </button>
    {/if}
  </div>

  <div class="relative flex py-2 items-center">
    <div class="flex-grow border-t border-white/60"></div>
    <span class="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">atau</span>
    <div class="flex-grow border-t border-white/60"></div>
  </div>

  <div>
    <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
      <Icon name="link" class="w-4 h-4 opacity-70" /> Masukkan Kode Pasangan
    </h3>
    <div class="flex space-x-2">
      <input type="text" bind:value={inviteCode} placeholder="Kode 6 digit" class="flex-1 px-4 py-2 border border-white/60 bg-white/50 backdrop-blur-md rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none uppercase text-center tracking-widest transition-all" maxlength="6" />
      <button onclick={connectPartner} disabled={loading || inviteCode.length !== 6} class="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
        Hubungkan
      </button>
    </div>
  </div>

  <div class="pt-6 text-center">
    <button onclick={() => goto('/home')} class="text-sm font-semibold text-gray-500 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto">
      Lewati dulu, masuk ke aplikasi <Icon name="arrow" class="w-3 h-3 opacity-50" />
    </button>
  </div>
</div>

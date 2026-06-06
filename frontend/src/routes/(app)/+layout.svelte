<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ICONS } from '$lib/icons';

  let { children } = $props();

  const tabs = [
    { name: 'Beranda', icon: ICONS.home, path: '/home' },
    { name: 'Dompet', icon: ICONS.wallet, path: '/wallet' },
    { name: 'Tabungan', icon: ICONS.savings, path: '/savings' },
    { name: 'Chat', icon: ICONS.chat, path: '/chat' },
    { name: 'Profil', icon: ICONS.profile, path: '/profile' },
  ];

  onMount(() => {
    if (!auth.token) goto('/login');
    else if (page.url.pathname === '/') goto('/home');
  });

  let currentPath = $derived(page.url.pathname);
</script>

<div style="display: flex; flex-direction: column; height: 100svh; overflow: hidden; background: #E8EEF9; font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; position: relative;">
  <!-- Main Content -->
  <main style="flex: 1; overflow-y: auto; padding-bottom: 72px; display: flex; flex-direction: column;">
    {#if auth.user && !auth.user.partner_id}
      <div style="background: linear-gradient(90deg, #F4A2A2, #f5baba); color: white; padding: 10px 16px; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 4px 15px rgba(244,162,162,0.3); z-index: 40; display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span>🔗 Belum terhubung dengan pasangan.</span>
        <a href="/profile" style="color: white; text-decoration: underline; font-weight: 800; white-space: nowrap;">Hubungkan →</a>
      </div>
    {/if}

    <div style="flex: 1; overflow-y: auto;">
      {@render children()}
    </div>
  </main>

  <!-- Bottom Tab Bar -->
  <nav style="position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid rgba(108,145,209,0.1); box-shadow: 0 -4px 30px rgba(44,58,94,0.08); display: flex; justify-content: space-around; align-items: center; height: 68px; z-index: 50;">
    {#each tabs as tab}
      {@const isActive = currentPath === tab.path || (tab.path !== '/home' && currentPath.startsWith(tab.path))}
      <a href={tab.path} style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; height: 100%; text-decoration: none; position: relative; transition: all 0.2s ease; color: {isActive ? '#6C91D1' : '#aab4cc'};">
        {#if isActive}
          <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 32px; height: 3px; background: linear-gradient(90deg, #6C91D1, #A28BDF); border-radius: 0 0 4px 4px;"></div>
        {:else}
          <div style="height: 3px;"></div>
        {/if}
        <img src={tab.icon} alt={tab.name} style="width: 24px; height: 24px; margin-bottom: 4px; transition: transform 0.2s; transform: {isActive ? 'scale(1.1)' : 'scale(1)'}; filter: {isActive ? 'none' : 'grayscale(100%) opacity(0.5)'};" />
        <span style="font-size: 10px; font-weight: {isActive ? '700' : '500'}; letter-spacing: 0.01em;">{tab.name}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  :global(#svelte) {
    height: 100%;
  }
</style>

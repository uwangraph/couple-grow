<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  import { toast } from '$lib/toast.svelte';

  let { children } = $props();

  const tabs = [
    { name: 'Beranda', icon: 'home', path: '/home' },
    { name: 'Dompet', icon: 'wallet', path: '/wallet' },
    { name: 'Tabungan', icon: 'savings', path: '/savings' },
    { name: 'Chat', icon: 'chat', path: '/chat' },
    { name: 'Profil', icon: 'profile', path: '/profile' },
  ];

  onMount(() => {
    if (!auth.token) goto('/login');
    else if (page.url.pathname === '/') goto('/home');
  });

  let currentPath = $derived(page.url.pathname);
</script>

<div class="app-container">
  <!-- Main Content -->
  <main style="flex: 1; overflow-y: auto; padding-bottom: {currentPath === '/chat' ? '0' : '72px'}; display: flex; flex-direction: column;">
    {#if auth.user && !auth.user.partner_id}
      <div style="background: linear-gradient(90deg, #7DBAF2, #A99BE8); color: white; padding: 10px 16px; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 4px 15px rgba(107,175,242,0.25); z-index: 40; display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span>🔗 Belum terhubung dengan pasangan.</span>
        <a href="/profile" style="color: white; text-decoration: underline; font-weight: 800; white-space: nowrap;">Hubungkan →</a>
      </div>
    {/if}

    <div style="flex: 1; overflow-y: auto;">
      {@render children()}
    </div>
  </main>

  <!-- Global Toasts -->
  <div class="toast-container">
    {#each toast.toasts as t (t.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="toast-item toast-item--{t.type}" onclick={() => toast.dismiss(t.id)}>
        <span class="toast-icon">
          {#if t.type === 'success'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {:else if t.type === 'error'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          {/if}
        </span>
        <span class="toast-message">{t.message}</span>
      </div>
    {/each}
  </div>

  <!-- Bottom Tab Bar -->
  {#if currentPath !== '/chat'}
    <nav class="app-nav glass-nav">
      {#each tabs as tab}
        {@const isActive = currentPath === tab.path || (tab.path !== '/home' && currentPath.startsWith(tab.path))}
        <a href={tab.path} style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; height: 100%; text-decoration: none; position: relative; transition: all 0.2s ease; color: {isActive ? '#5B9FE8' : '#94A3B8'};">
          {#if isActive}
            <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 32px; height: 3px; background: linear-gradient(90deg, #6BAFF2, #A58BE8); border-radius: 0 0 4px 4px;"></div>
          {:else}
            <div style="height: 3px;"></div>
          {/if}
          <div style="margin-bottom: 4px; transition: transform 0.2s; transform: {isActive ? 'scale(1.1)' : 'scale(1)'}; opacity: {isActive ? '1' : '0.5'};">
            <Icon name={tab.icon} size={24} />
          </div>
          <span style="font-size: 10px; font-weight: {isActive ? '700' : '500'}; letter-spacing: 0.01em;">{tab.name}</span>
        </a>
      {/each}
    </nav>
  {/if}
</div>

<style>
  :global(#svelte) {
    height: 100%;
  }
  
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100svh;
    overflow: hidden;
    position: relative;
    margin: 0 auto;
    width: 100%;
    max-width: 100%; /* Full width for mobile and tablet */
    background: transparent; /* Use body background */
  }

  .app-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 100%; /* Full width for mobile and tablet */
    display: flex;
    justify-content: space-around;
    align-items: center;
    height: 68px;
    z-index: 50;
  }

  /* Force Mobile size on Laptops (>= 1024px) */
  @media (min-width: 1024px) {
    .app-container {
      max-width: 480px;
      box-shadow: 0 0 40px rgba(0,0,0,0.1);
      background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .app-nav {
      max-width: 480px;
    }
  }

  /* Global Toast Styles */
  .toast-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 90%;
    max-width: 360px;
    pointer-events: none;
  }
  .toast-item {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 18px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 8px rgba(0, 0, 0, 0.04);
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
  }
  .toast-item:active {
    transform: scale(0.97);
    opacity: 0.9;
  }
  
  .toast-item--success {
    background: rgba(240, 253, 244, 0.93);
    border: 1.5px solid rgba(74, 222, 128, 0.4);
    color: #166534;
  }
  .toast-item--success .toast-icon {
    color: #22C55E;
    background: #DCFCE7;
  }

  .toast-item--error {
    background: rgba(254, 242, 242, 0.93);
    border: 1.5px solid rgba(248, 113, 113, 0.4);
    color: #991B1B;
  }
  .toast-item--error .toast-icon {
    color: #EF4444;
    background: #FEE2E2;
  }

  .toast-item--info {
    background: rgba(239, 246, 255, 0.93);
    border: 1.5px solid rgba(96, 165, 250, 0.4);
    color: #1E3A8A;
  }
  .toast-item--info .toast-icon {
    color: #3B82F6;
    background: #DBEAFE;
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateY(-16px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>

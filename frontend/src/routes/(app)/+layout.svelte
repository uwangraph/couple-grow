<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { Capacitor } from '@capacitor/core';

  import { toast } from '$lib/toast.svelte';
  import { readApiJson } from '$lib/api';
  import { initPushNotifications } from '$lib/push.svelte';

  let { children } = $props();

  const tabs = [
    { name: 'Beranda', icon: 'home', path: '/home' },
    { name: 'Dompet', icon: 'wallet', path: '/wallet' },
    { name: 'Tabungan', icon: 'savings', path: '/savings' },
    { name: 'Chat', icon: 'chat', path: '/chat' },
    { name: 'Profil', icon: 'profile', path: '/profile' },
  ];

  onMount(async () => {
    if (!auth.token) {
      goto('/login');
      return;
    }
    await auth.init();
    if (!auth.token) return;
    if (page.url.pathname === '/') goto('/home');
    checkForAppUpdate();
    void initPushNotifications();
  });

  let currentPath = $derived(page.url.pathname);
  const hideBottomNav = $derived(
    currentPath === '/chat' ||
    currentPath.startsWith('/notes') ||
    currentPath.startsWith('/wishlist')
  );
  let showUpdateModal = $state(false);
  let latestVersionName = $state('');
  let latestVersionUrl = $state('');

  async function checkForAppUpdate() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const installed = await (window as any).Capacitor?.Plugins?.App?.getInfo();
      if (!installed) return;
      const response = await fetch('https://couple-grow.pages.dev/app-version.json?t=' + Date.now());
      if (!response.ok) return;
      const latest = await readApiJson<{ versionCode?: string; versionName?: string; downloadUrl?: string }>(response);
      if (Number(latest.versionCode) > Number(installed.build)) {
        latestVersionName = latest.versionName || `Versi ${latest.versionCode}`;
        latestVersionUrl = latest.downloadUrl || '';
        showUpdateModal = true;
      }
    } catch (_) { /* update check is non-blocking */ }
  }
</script>

<div class="app-container">
  {#if showUpdateModal}
    <div class="update-overlay" role="dialog" aria-modal="true">
      <div class="update-card">
        <div class="update-icon"><Icon name="savings" size={28} /></div>
        <h2>Update tersedia</h2>
        <p>Versi terbaru CoupleGrow ({latestVersionName}) sudah tersedia. Update sekarang untuk mendapatkan fitur terbaru.</p>
        <div class="update-actions">
          {#if latestVersionUrl}
            <a class="update-primary" href={latestVersionUrl} target="_blank" rel="noreferrer" download>Update Sekarang</a>
          {:else}
            <button class="update-primary" onclick={() => showUpdateModal = false}>Update Sekarang</button>
          {/if}
          <button class="update-secondary" onclick={() => showUpdateModal = false}>Nanti</button>
        </div>
      </div>
    </div>
  {/if}
  <!-- Main Content -->
  <main style="flex: 1; overflow-y: auto; padding-bottom: {hideBottomNav ? '0' : '104px'}; display: flex; flex-direction: column;">
    {#if auth.user && !auth.user.partner_id}
      <div style="background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(33, 150, 243,0.2); color: #475569; padding: 10px 16px; text-align: center; font-size: 13px; font-weight: 600; z-index: 40; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span>🔗 Belum terhubung dengan pasangan.</span>
        <a href="/profile" style="color: #1976D2; text-decoration: none; font-weight: 700; white-space: nowrap;">Hubungkan →</a>
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
  {#if !hideBottomNav}
    <nav class="app-nav">
      {#each tabs as tab}
        {@const isActive = currentPath === tab.path || (tab.path !== '/home' && currentPath.startsWith(tab.path))}
        <a href={tab.path} class="nav-tab {isActive ? 'nav-tab--active' : ''}">
          <span class="nav-tile">
            <Icon name={tab.icon} size={21} />
          </span>
          <span class="nav-label">{tab.name}</span>
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

  .update-overlay { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 24px; background: rgba(30,41,59,.42); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
  .update-card { width: min(100%, 360px); padding: 28px 22px 22px; border: none; border-radius: 28px; background: #FFFFFF;  box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06); text-align: center; }
  .update-icon { width: 58px; height: 58px; display: grid; place-items: center; margin: 0 auto 14px; border-radius: 18px; color: #2196F3; background: #E7F4FE; }
  .update-card h2 { margin: 0 0 8px; color: #1E293B; font-size: 20px; font-weight: 900; }
  .update-card p { margin: 0 0 22px; color: #64748B; font-size: 13px; line-height: 1.55; }
  .update-actions { display: flex; flex-direction: column; gap: 8px; }
  .update-primary, .update-secondary { display: block; width: 100%; padding: 13px; border: 0; border-radius: 14px; font: inherit; font-weight: 800; text-align: center; text-decoration: none; cursor: pointer; }
  .update-primary { color: white; background: linear-gradient(135deg,#2196F3,#64B5F6); box-shadow: 0 8px 20px rgba(33,150,243,.3); }
  .update-secondary { color: #64748B; background: rgba(226,232,240,.7); }

  /* Dock clay mengambang — menggantikan bilah nav menempel di tepi layar */
  .app-nav {
    position: fixed;
    bottom: max(14px, env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 24px);
    max-width: 456px;
    display: flex;
    justify-content: space-around;
    align-items: center;
    gap: 2px;
    height: 74px;
    padding: 0 6px;
    border-radius: 30px;
    background: linear-gradient(150deg, #FFFFFF 0%, #EDF6FE 100%);
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.95),
      inset -4px -6px 12px rgba(33, 150, 243, 0.12),
      8px 14px 30px rgba(21, 101, 192, 0.16),
      2px 4px 10px rgba(21, 101, 192, 0.08);
    z-index: 50;
  }
  .nav-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 100%;
    text-decoration: none;
    color: #94A3B8;
    transition: color 0.2s ease;
  }
  .nav-tile {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 32%;
    transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.22s ease, background 0.22s ease;
  }
  .nav-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  /* Tab aktif diangkat sebagai ubin clay */
  .nav-tab--active { color: #1976D2; }
  .nav-tab--active .nav-tile {
    color: #fff;
    transform: translateY(-3px);
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.35),
      4px 7px 14px rgba(21, 101, 192, 0.3);
  }
  .nav-tab--active .nav-label { font-weight: 800; }
  .nav-tab:active .nav-tile { transform: translateY(1px) scale(0.94); }

  /* Force Mobile size on Laptops (>= 1024px) */
  @media (min-width: 1024px) {
    .app-container {
      max-width: 480px;
      box-shadow: 0 0 40px rgba(0,0,0,0.1);
      /* Keep mostly transparent so the colorful ambient body shows through */
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .app-nav {
      max-width: 456px;
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
    color: #5CC8AC;
    background: #E1F4EE;
  }

  .toast-item--error {
    background: rgba(254, 242, 242, 0.93);
    border: 1.5px solid rgba(248, 113, 113, 0.4);
    color: #B04058;
  }
  .toast-item--error .toast-icon {
    color: #EF7C97;
    background: #FBE4EA;
  }

  .toast-item--info {
    background: rgba(239, 246, 255, 0.93);
    border: 1.5px solid rgba(96, 165, 250, 0.4);
    color: #1E3A8A;
  }
  .toast-item--info .toast-icon {
    color: #2196F3;
    background: #EAF4FE;
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

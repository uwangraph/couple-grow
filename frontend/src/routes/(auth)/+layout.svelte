<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  let { children } = $props();
  let apkVersion = $state('');
  let apkDownloadUrl = $state('');
  let apkLoading = $state(true);

  onMount(async () => {
    try {
      const response = await fetch(`/app-version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const latest = await response.json();
      apkVersion = latest.versionName || '';
      if (latest.downloadUrl) apkDownloadUrl = latest.downloadUrl;
    } catch (_) {
      apkDownloadUrl = '';
    } finally {
      apkLoading = false;
    }
  });
</script>

<div class="auth-shell min-h-screen relative overflow-hidden flex items-center justify-center p-6">
  <!-- Decorative blobs -->
  <div class="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-40" style="background: rgba(91,141,239,0.35); filter: blur(50px);"></div>
  <div class="absolute bottom-[-60px] left-[-60px] w-80 h-80 rounded-full opacity-40" style="background: rgba(142,123,240,0.30); filter: blur(60px);"></div>

  <!-- Card -->
  <div class="auth-card relative w-full max-w-sm z-10">
    <!-- Logo -->
    <div class="text-center mb-8">
      <div class="logo-mark inline-flex items-center justify-center rounded-2xl mb-4">
        <img src="/logo-couplegrow.png" alt="CoupleGrow" />
      </div>
      <h1 style="font-size: 25px; font-weight: 900; color: #30435F; margin: 0 0 4px 0; font-family: Nunito, sans-serif;">CoupleGrow</h1>
      <p style="font-size: 13px; color: #64748B; margin: 0; font-family: Inter, sans-serif;">Tumbuh bersama, dari sekarang</p>
    </div>

    {@render children()}
  </div>

  {#if page.url.pathname === '/login'}
    <div class="apk-download-section z-10">
      {#if apkDownloadUrl}
        <a class="apk-download-btn" href={apkDownloadUrl} target="_blank" rel="noreferrer" download>
          Download APK{apkVersion ? ` v${apkVersion}` : ''}
        </a>
      {:else}
        <button class="apk-download-btn" type="button" disabled>
          {apkLoading ? 'Menyiapkan APK...' : 'APK belum tersedia'}
        </button>
      {/if}
      <p>Tersedia untuk perangkat Android</p>
    </div>
  {/if}
</div>

<style>
  .auth-shell { flex-direction: column; gap: 14px; background: linear-gradient(135deg, #EEF2FE 0%, #F2F0FE 100%); font-family: 'Nunito', sans-serif; }
  .auth-card { background: rgba(255,255,255,.72); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); border: 1px solid rgba(255,255,255,.9); border-radius: 28px; padding: 36px 32px; box-shadow: 0 25px 60px rgba(91,141,239,.16); }
  .logo-mark { width: 78px; height: 78px; background: linear-gradient(135deg, #EEF2FE, #F6F4FE); border: 2px solid rgba(91,141,239,.4); box-shadow: 0 8px 24px rgba(91,141,239,.22), 0 0 0 4px rgba(255,255,255,.45); overflow: hidden; }
  .logo-mark img { width: 76px; height: 76px; object-fit: contain; }
  .apk-download-section { width: 100%; max-width: 384px; text-align: center; }
  .apk-download-btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 13px 16px; box-sizing: border-box; border: 1.5px solid rgba(107,175,242,.45); border-radius: 16px; background: rgba(255,255,255,.62); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); color: #4F96E5; box-shadow: 0 8px 24px rgba(91,141,239,.12); font: 800 14px 'Nunito', sans-serif; text-decoration: none; transition: transform .15s ease, background .15s ease; }
  .apk-download-btn:hover { background: rgba(255,255,255,.82); transform: translateY(-1px); }
  .apk-download-btn:active { transform: scale(.98); }
  .apk-download-btn:disabled { cursor: wait; opacity: .65; }
  .apk-download-section p { margin: 7px 0 0; color: #94A3B8; font: 600 10px 'Nunito', sans-serif; }
  :global(body) {
    margin: 0;
    font-family: 'Nunito', sans-serif;
  }

  :global(.auth-input) {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid rgba(207, 231, 252, 0.8);
    border-radius: 14px;
    font-size: 14px;
    font-family: 'Nunito', sans-serif;
    color: #30435F;
    background: rgba(255, 255, 255, 0.6);
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }
  :global(.auth-input:focus) {
    border-color: #5B8DEF;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 0 4px rgba(91, 141, 239, 0.15);
  }
  :global(.auth-label) {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #64748B;
    margin-bottom: 6px;
    font-family: 'Nunito', sans-serif;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  :global(.auth-btn) {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    font-family: 'Nunito', sans-serif;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    background: linear-gradient(135deg, #5B8DEF, #4772E8);
    box-shadow: 0 6px 20px rgba(91, 141, 239, 0.35);
  }
  :global(.auth-btn:hover:not(:disabled)) {
    transform: translateY(-1px);
    box-shadow: 0 8px 25px rgba(91, 141, 239, 0.45);
  }
  :global(.auth-btn:active:not(:disabled)) {
    transform: translateY(0);
  }
  :global(.auth-btn:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }
  :global(.auth-error) {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.3);
    color: #BE123C;
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
  }
  :global(.auth-success) {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #15803d;
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
  }
  :global(.password-wrap) {
    position: relative;
    width: 100%;
  }
  :global(.password-wrap .auth-input) {
    width: 100%;
    padding-right: 46px;
  }
  :global(.password-toggle) {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: #94A3B8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    transition: background 0.15s, color 0.15s;
  }
  :global(.password-toggle:hover) { background: rgba(91, 141, 239, 0.1); color: #5B8DEF; }
  :global(.auth-link) {
    color: #5B8DEF;
    font-weight: 600;
    text-decoration: none;
  }
  :global(.auth-link:hover) {
    text-decoration: underline;
  }
</style>

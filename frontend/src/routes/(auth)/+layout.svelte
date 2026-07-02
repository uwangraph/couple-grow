<script lang="ts">
  import Icon from '$lib/Icon.svelte';
  let { children } = $props();
</script>

<div class="min-h-screen relative overflow-hidden flex items-center justify-center p-6" style="background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%);">
  <!-- Decorative blobs -->
  <div class="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-20" style="background: rgba(255,255,255,0.3); filter: blur(40px);"></div>
  <div class="absolute bottom-[-60px] left-[-60px] w-80 h-80 rounded-full opacity-20" style="background: rgba(255,255,255,0.3); filter: blur(60px);"></div>

  <!-- Card -->
  <div class="relative w-full max-w-sm z-10" style="background: rgba(255,255,255,0.95); border-radius: 28px; padding: 36px 32px; box-shadow: 0 25px 60px rgba(44, 58, 94, 0.25), 0 0 0 1px rgba(255,255,255,0.5);">
    <!-- Logo -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style="background: linear-gradient(135deg, #3B82F6, #60A5FA); box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);">
        <Icon name="couple" size={32} style="color: white;" />
      </div>
      <h1 style="font-size: 24px; font-weight: 700; color: #2D3A5E; margin: 0 0 4px 0; font-family: Inter, sans-serif;">CoupleGrow</h1>
      <p style="font-size: 13px; color: #8898c0; margin: 0; font-family: Inter, sans-serif;">Tumbuh bersama, dari sekarang</p>
    </div>

    {@render children()}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Inter', sans-serif;
  }

  :global(.auth-input) {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e8eef9;
    border-radius: 14px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    color: #2D3A5E;
    background: #f8faff;
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }
  :global(.auth-input:focus) {
    border-color: #3B82F6;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
  }
  :global(.auth-label) {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #6b7b99;
    margin-bottom: 6px;
    font-family: 'Inter', sans-serif;
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
    font-family: 'Inter', sans-serif;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    background: linear-gradient(135deg, #3B82F6, #60A5FA);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  }
  :global(.auth-btn:hover:not(:disabled)) {
    transform: translateY(-1px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
  }
  :global(.auth-btn:active:not(:disabled)) {
    transform: translateY(0);
  }
  :global(.auth-btn:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }
  :global(.auth-error) {
    background: #fff5f5;
    border: 1px solid #F4A2A2;
    color: #c96060;
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
  }
  :global(.auth-success) {
    background: #f0fdf4;
    border: 1px solid #86efac;
    color: #15803d;
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
  }
  :global(.auth-link) {
    color: #3B82F6;
    font-weight: 600;
    text-decoration: none;
  }
  :global(.auth-link:hover) {
    text-decoration: underline;
  }
</style>

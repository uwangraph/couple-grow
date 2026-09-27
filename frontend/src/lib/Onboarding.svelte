<script lang="ts">
  import Icon from './Icon.svelte';
  import { browser } from '$app/environment';

  let show = $state(false);
  let currentStep = $state(0);

  const steps = [
    {
      title: 'Tumbuh bareng, mulai di sini.',
      description: 'Satu ruang untuk merencanakan uang, tujuan, dan cerita kalian berdua.',
      icon: 'couple',
      color: '#2563EB'
    },
    {
      title: 'Keuangan lebih jelas.',
      description: 'Catat pemasukan dan pengeluaran, lalu lihat siapa yang menambahkan atau memperbaruinya.',
      icon: 'wallet',
      color: '#1683D8'
    },
    {
      title: 'Wujudkan tujuan bersama.',
      description: 'Susun anggaran, tabungan, dan wishlist. Progres kecil pun terasa berarti.',
      icon: 'savings',
      color: '#1571C9'
    },
    {
      title: 'Siap melangkah berdua?',
      description: 'Hubungkan pasanganmu, lalu mulai dari hal yang paling penting buat kalian.',
      icon: 'sparkles',
      color: '#2563EB'
    }
  ];

  export function start() {
    if (browser) {
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeenOnboarding) {
        show = true;
        currentStep = 0;
      }
    }
  }

  function next() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    } else {
      finish();
    }
  }

  function skip() {
    finish();
  }

  function previous() {
    if (currentStep > 0) currentStep--;
  }

  function finish() {
    if (browser) {
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
    show = false;
  }

  function focusDialog(node: HTMLElement) {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => node.focus());
    return { destroy: () => previousFocus?.focus() };
  }

  $effect(() => {
    if (browser && show) {
      document.body.style.overflow = 'hidden';
    } else if (browser) {
      document.body.style.overflow = '';
    }
  });
</script>

{#if show}
  <div class="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Pengenalan CoupleGrow" tabindex="-1" use:focusDialog onkeydown={(e) => { if (e.key === 'Escape') skip(); }}>
    <div class="onboarding-content">
      <img class="onboarding-logo" src="/logo-couplegrow.png" alt="CoupleGrow" />
      <p class="step-counter">KENALAN DULU · {currentStep + 1} / {steps.length}</p>
      <!-- Progress dots -->
      <div class="progress-dots" aria-hidden="true">
        {#each steps as _, i}
          <div class="dot {i === currentStep ? 'dot--active' : ''} {i < currentStep ? 'dot--done' : ''}"></div>
        {/each}
      </div>

      <!-- Current step -->
      <div class="step-content">
        <div class="step-icon" style="background:{steps[currentStep].color}22;color:{steps[currentStep].color}">
          <Icon name={steps[currentStep].icon} size={48} />
        </div>
        <h2 class="step-title">{steps[currentStep].title}</h2>
        <p class="step-desc">{steps[currentStep].description}</p>
      </div>

      <!-- Actions -->
      <div class="onboarding-actions">
        {#if currentStep < steps.length - 1}
          <button type="button" class="btn-skip" onclick={currentStep === 0 ? skip : previous}>{currentStep === 0 ? 'Lewati' : 'Kembali'}</button>
          <button type="button" class="btn-next" onclick={next}>
            Lanjut
            <Icon name="arrow" size={16} />
          </button>
        {:else}
          <button type="button" class="btn-skip" onclick={previous}>Kembali</button>
          <button type="button" class="btn-next" onclick={finish}>Mulai sekarang <Icon name="arrow" size={16} /></button>
        {/if}
      </div>
      {#if currentStep > 0 && currentStep < steps.length - 1}
        <button type="button" class="skip-link" onclick={skip}>Lewati panduan</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, rgba(234,245,254,.95), rgba(241,248,254,.95));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .onboarding-content {
    background: #FFFFFF;
    border: 1px solid rgba(255,255,255,.9);
    border-radius: 32px;
    padding: 28px 24px 24px;
    max-width: 420px;
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    width: 100%;
    text-align: center;
    box-shadow: 0 24px 55px rgba(21, 101, 192, 0.14);
    animation: slide-up 0.3s ease-out;
  }
  .onboarding-logo { width: 78px; height: 78px; object-fit: contain; margin: -12px auto 16px; display: block; padding: 3px; border: 1px solid rgba(33,150,243,.3); border-radius: 20px; background: linear-gradient(135deg, #E7F4FE, #F5FAFF); box-shadow: 0 8px 20px rgba(33,150,243,.12); }
  .step-counter { margin: 0 0 14px; color:#2563eb; font-size:11px; font-weight:900; letter-spacing:.12em; }

  @keyframes slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 26px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #E2E8F0;
    transition: all 0.3s;
  }

  .dot--active {
    width: 24px;
    border-radius: 4px;
    background: #2196F3;
  }

  .dot--done {
    background: #4FBFA3;
  }

  .step-content {
    margin-bottom: 28px;
  }

  .step-icon {
    width: 88px;
    height: 88px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    box-shadow: inset 0 0 0 1px rgba(37,99,235,.08);
  }

  .step-title {
    font-family: 'Nunito', sans-serif;
    font-size: 24px;
    font-weight: 900;
    color: #1E293B;
    margin: 0 0 12px;
  }

  .step-desc {
    font-family: 'Nunito', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #526984;
    line-height: 1.6;
    margin: 0;
  }

  .onboarding-actions {
    display: flex;
    gap: 12px;
  }
  .skip-link { min-height:44px; margin-top:12px; padding:10px; border:0; background:transparent; color:#526984; font:800 14px 'Nunito',sans-serif; cursor:pointer; }

  .btn-skip {
    flex: 1;
    padding: 14px 24px;
    background: rgba(241, 245, 249, 0.8);
    color: #475569;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-skip:hover {
    background: #E2E8F0;
  }

  .btn-next {
    flex: 2;
    padding: 14px 24px;
    background: linear-gradient(145deg, #2196F3, #64B5F6);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow:0 8px 18px rgba(37,99,235,.22);
    transition: all 0.2s;
  }

  .btn-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(33,150,243,0.45);
  }

  .btn-next:active {
    transform: translateY(0);
  }

  @media (max-height:680px) {
    .onboarding-content { padding-block:18px; }
    .progress-dots,.step-content { margin-bottom:18px; }
    .step-icon { width:68px; height:68px; margin-bottom:12px; }
  }

</style>

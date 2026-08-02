<script lang="ts">
  import Icon from './Icon.svelte';
  import { browser } from '$app/environment';

  let show = $state(false);
  let currentStep = $state(0);

  const steps = [
    {
      title: 'Selamat Datang di CoupleGrow! 👋',
      description: 'Aplikasi untuk kelola keuangan dan impian bersama pasangan',
      icon: 'couple',
      color: '#6BAFF2'
    },
    {
      title: 'Dompet Bersama 💰',
      description: 'Catat semua pemasukan dan pengeluaran berdua dalam satu tempat',
      icon: 'wallet',
      color: '#10B981'
    },
    {
      title: 'Tabungan & Target 🎯',
      description: 'Buat target tabungan untuk impian bersama dan pantau progressnya',
      icon: 'savings',
      color: '#6BAFF2'
    },
    {
      title: 'Wishlist Impian ✨',
      description: 'Catat semua impian yang pengen diwujudkan bareng',
      icon: 'sparkles',
      color: '#6BAFF2'
    },
    {
      title: 'Budget & Analytics 📊',
      description: 'Atur budget bulanan dan lihat analisis keuangan kalian',
      icon: 'sparkles',
      color: '#F59E0B'
    },
    {
      title: 'Siap Mulai! 🚀',
      description: 'Yuk mulai kelola keuangan bersama dengan lebih baik!',
      icon: 'success',
      color: '#10B981'
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

  function finish() {
    if (browser) {
      localStorage.setItem('hasSeenOnboarding', 'true');
    }
    show = false;
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
  <div class="onboarding-overlay">
    <div class="onboarding-content">
      <img class="onboarding-logo" src="/logo-couplegrow.png" alt="CoupleGrow" />
      <!-- Progress dots -->
      <div class="progress-dots">
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
          <button class="btn-skip" onclick={skip}>Lewati</button>
          <button class="btn-next" onclick={next}>
            Lanjut
            <Icon name="arrow" size={16} />
          </button>
        {:else}
          <button class="btn-finish" onclick={finish}>Mulai Sekarang!</button>
        {/if}
      </div>
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
    padding: 32px;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .onboarding-content {
    background: rgba(255, 255, 255, 0.76);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 32px;
    padding: 40px 32px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(59,130,246,.15);
    animation: slide-up 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  .onboarding-logo { width: 78px; height: 78px; object-fit: contain; margin: -12px auto 14px; display: block; padding: 3px; border: 2px solid rgba(107,175,242,.45); border-radius: 20px; background: linear-gradient(135deg, #EAF5FE, #F5FAFF); box-shadow: 0 0 0 4px rgba(255,255,255,.45), 0 8px 20px rgba(107,175,242,.18); }

  @keyframes slide-up {
    from { transform: translateY(40px) scale(0.9); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 32px;
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
    background: #6BAFF2;
  }

  .dot--done {
    background: #10B981;
  }

  .step-content {
    margin-bottom: 32px;
  }

  .step-icon {
    width: 100px;
    height: 100px;
    border-radius: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    animation: bounce 0.6s ease;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .step-title {
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 800;
    color: #1E293B;
    margin: 0 0 12px;
  }

  .step-desc {
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 500;
    color: #64748B;
    line-height: 1.6;
    margin: 0;
  }

  .onboarding-actions {
    display: flex;
    gap: 12px;
  }

  .btn-skip {
    flex: 1;
    padding: 14px 24px;
    background: rgba(241, 245, 249, 0.8);
    color: #64748B;
    border: none;
    border-radius: 16px;
    font-family: 'Inter', sans-serif;
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
    background: linear-gradient(135deg, #5FA8EF, #83BDF5);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 8px 24px rgba(107,175,242,0.35);
    transition: all 0.2s;
  }

  .btn-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(107,175,242,0.45);
  }

  .btn-next:active {
    transform: translateY(0);
  }

  .btn-finish {
    width: 100%;
    padding: 16px 24px;
    background: linear-gradient(135deg, #5FA8EF, #83BDF5);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(107,175,242,.35);
    transition: all 0.2s;
  }

  .btn-finish:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(16,185,129,0.45);
  }

  .btn-finish:active {
    transform: scale(0.98);
  }
</style>

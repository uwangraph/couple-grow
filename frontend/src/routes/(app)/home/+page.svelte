<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import Onboarding from '$lib/Onboarding.svelte';

  let transactions = $state<any[]>([]);
  let savings = $state<any[]>([]);
  let loading = $state(true);
  let onboarding: any;

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Selamat malam' : hour < 12 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const greetingEmoji = hour < 5 ? '🌙' : hour < 12 ? '☀️' : hour < 15 ? '🌤️' : hour < 18 ? '🌅' : '🌙';
  let showPartnerModal = $state(false);

  onMount(async () => {
    await Promise.all([fetchTransactions(), fetchSavings()]);
    loading = false;
    
    // Start onboarding after data loaded
    setTimeout(() => {
      if (onboarding) onboarding.start();
    }, 500);
  });

  function handleUnauthorized() {
    auth.logout();
    goto('/login');
  }

  async function fetchTransactions() {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (res.ok) transactions = (data.transactions || []).slice(0, 5);
    } catch(e) {}
  }

  async function fetchSavings() {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/savings`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (res.ok) savings = data.savings || [];
    } catch(e) {}
  }

  let totalBalance = $derived(
    transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0)
  );
  let totalIncome = $derived(transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0));
  let totalExpense = $derived(transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0));

  function formatRp(num: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }
  function formatCompact(num: number) {
    if (num >= 1000000) return `Rp ${(num/1000000).toFixed(1)}jt`;
    if (num >= 1000) return `Rp ${(num/1000).toFixed(0)}rb`;
    return `Rp ${num}`;
  }
</script>

<div class="home-root">

  <!-- Partner Modal -->
  {#if showPartnerModal && auth.partner}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Profil Pasangan" tabindex="0" onclick={(e) => { if (e.target === e.currentTarget) showPartnerModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showPartnerModal = false; }}>
      <div class="modal">
        <div class="pm-handle"></div>

        <!-- Avatar -->
        <div class="pm-avatar-wrap">
          {#if auth.partner.avatar}
            <img src={auth.partner.avatar} alt={auth.partner.name} class="pm-avatar-img" />
          {:else}
            <div class="pm-avatar-placeholder">
              <Icon name="couple" size={36} />
            </div>
          {/if}
        </div>

        <!-- Name -->
        <p class="pm-name">{auth.partner.name}</p>

        <!-- Info rows -->
        <div class="pm-info-list">
          <div class="pm-info-row">
            <div class="pm-info-icon">
              <Icon name="phone" size={15} />
            </div>
            <div>
              <p class="pm-info-label">No. Telepon</p>
              <p class="pm-info-val {!(auth.partner as any).phone ? 'pm-info-empty' : ''}">{(auth.partner as any).phone || 'Belum diisi'}</p>
            </div>
          </div>
          <div class="pm-info-row">
            <div class="pm-info-icon">
              <Icon name="birthday" size={15} />
            </div>
            <div>
              <p class="pm-info-label">Tanggal Lahir</p>
              <p class="pm-info-val {!(auth.partner as any).birthday ? 'pm-info-empty' : ''}">
                {(auth.partner as any).birthday
                  ? new Date((auth.partner as any).birthday).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Belum diisi'}
              </p>
            </div>
          </div>
          <div class="pm-info-row">
            <div class="pm-info-icon">
              <Icon name="couple" size={15} />
            </div>
            <div>
              <p class="pm-info-label">Hari Jadian</p>
              <p class="pm-info-val {!(auth.partner as any).anniversary ? 'pm-info-empty' : ''}">
                {(auth.partner as any).anniversary
                  ? new Date((auth.partner as any).anniversary).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Belum diisi'}
              </p>
            </div>
          </div>
          <div class="pm-info-row">
            <div class="pm-info-icon">
              <Icon name="notes" size={15} />
            </div>
            <div>
              <p class="pm-info-label">Bio</p>
              <p class="pm-info-val {!(auth.partner as any).bio ? 'pm-info-empty' : ''}">{(auth.partner as any).bio || 'Belum diisi'}</p>
            </div>
          </div>
        </div>

        <button onclick={() => showPartnerModal = false} class="pm-close-btn">Tutup</button>
      </div>
    </div>
  {/if}

  <!-- Header -->
  <div class="header">
    <div class="blob b1"></div>
    <div class="blob b2"></div>

    <div class="header-top">
      <div>
        <p class="greeting-sub">{greeting} {greetingEmoji}</p>
        <h1 class="greeting-name">{auth.user?.name || 'Pengguna'}</h1>
        {#if auth.partner}
          <button class="partner-line" style="background:none; border:none; cursor:pointer; padding:0; text-align:left;" onclick={() => showPartnerModal = true}>
            <Icon name="couple" size={16} /> Bersama
            {#if auth.partner.avatar}
              <img src={auth.partner.avatar} alt={auth.partner.name} class="partner-inline-img" />
            {/if}
            <strong style="text-decoration: underline;">{auth.partner.name}</strong>
          </button>
        {:else if auth.user?.partner_id}
          <button class="partner-line" style="background:none; border:none; cursor:pointer; padding:0; text-align:left; text-decoration: underline;" onclick={() => showPartnerModal = true}>
            <Icon name="couple" size={16} /> Terhubung dengan pasangan
          </button>
        {:else}
          <a href="/partner" class="partner-cta">
            <Icon name="link" size={14} /> Hubungkan pasangan →
          </a>
        {/if}
      </div>
      <button class="notification-btn" onclick={() => goto('/notifications')} aria-label="Buka notifikasi">
        <Icon name="bell" size={22} />
      </button>
    </div>

    <!-- Balance Card (within header, slightly offset) -->
    <div class="balance-card">
      <p class="balance-label">Saldo Bersama</p>
      {#if loading}
        <div class="skeleton skeleton--balance"></div>
      {:else}
        <h2 class="balance-amount">{formatRp(totalBalance)}</h2>
      {/if}
      <div class="balance-split">
        <div class="balance-item balance-item--in">
          <span class="balance-item-icon">↑</span>
          <div>
            <p class="balance-item-label">Masuk</p>
            <p class="balance-item-val">{loading ? '...' : formatCompact(totalIncome)}</p>
          </div>
        </div>
        <div class="balance-item-sep"></div>
        <div class="balance-item balance-item--out">
          <span class="balance-item-icon">↓</span>
          <div>
            <p class="balance-item-label">Keluar</p>
            <p class="balance-item-val">{loading ? '...' : formatCompact(totalExpense)}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button class="quick-btn quick-btn--expense" onclick={() => goto('/wallet')}>
        <div class="quick-icon quick-icon--red">
          <Icon name="expense" size={20} />
        </div>
        <span>Catat Pengeluaran</span>
      </button>
      
      <button class="quick-btn quick-btn--income" onclick={() => goto('/wallet')}>
        <div class="quick-icon quick-icon--green">
          <Icon name="income" size={20} />
        </div>
        <span>Catat Pemasukan</span>
      </button>
      
      <button class="quick-btn quick-btn--saving" onclick={() => goto('/savings')}>
        <div class="quick-icon quick-icon--blue">
          <Icon name="savings" size={20} />
        </div>
        <span>Nabung</span>
      </button>
      
      <button class="quick-btn quick-btn--wish" onclick={() => goto('/wishlist')}>
        <div class="quick-icon quick-icon--pink">
          <Icon name="sparkles" size={20} />
        </div>
        <span>Wishlist</span>
      </button>
    </div>

    <!-- Quick Actions -->
    <div class="section">
      <p class="section-title">Menu Cepat</p>
      <div class="quick-grid">
        {#each [
          { icon: 'wallet',  label: 'Dompet',   path: '/wallet',  color: '#6BAFF2', bg: '#EFF6FF' },
          { icon: 'savings', label: 'Tabungan',  path: '/savings', color: '#A58BE8', bg: '#F5F3FF' },
          { icon: 'notes',   label: 'Notes',    path: '/notes',   color: '#F59E0B', bg: '#FFFBEB' },
          { icon: 'chat',    label: 'Chat',     path: '/chat',    color: '#F43F5E', bg: '#FFF1F2' },
        ] as q}
          <a href={q.path} class="quick-item">
            <div class="quick-icon" style="background:{q.bg}; color:{q.color};">
              <Icon name={q.icon} size={22} />
            </div>
            <span class="quick-label">{q.label}</span>
          </a>
        {/each}
      </div>
    </div>

    <!-- Active Savings -->
    {#if savings.length > 0}
      <div class="section">
        <div class="section-header">
          <p class="section-title">Tabungan Aktif</p>
          <a href="/savings" class="section-more">Lihat semua →</a>
        </div>
        <div class="savings-list">
          {#each savings.slice(0, 2) as s}
            {@const pct = Math.min(Math.round((s.current_amount / s.target_amount) * 100), 100)}
            <div class="savings-card">
              <div class="savings-row">
                <div>
                  <p class="savings-name">{s.name}</p>
                  <p class="savings-sub">{formatCompact(s.current_amount)} / {formatCompact(s.target_amount)}</p>
                </div>
                <div class="savings-pct-badge">{pct}%</div>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:{pct}%"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Recent Transactions -->
    <div class="section">
      <div class="section-header">
        <p class="section-title">Transaksi Terbaru</p>
        <a href="/wallet" class="section-more">Lihat semua →</a>
      </div>

      {#if loading}
        {#each [1,2,3] as _}
          <div class="skeleton skeleton--row"></div>
        {/each}
      {:else if transactions.length === 0}
        <div class="empty-state">
          <Icon name="empty" size={36} style="opacity:0.5;margin-bottom:10px;" />
          <p>Belum ada transaksi.</p>
          <a href="/wallet" class="empty-link">Catat sekarang →</a>
        </div>
      {:else}
        {#each transactions as t}
          <a href="/wallet" class="tx-row">
            <div class="tx-icon {t.type === 'income' ? 'tx-icon--in' : 'tx-icon--out'}">
              <Icon name={t.type === 'income' ? 'income' : 'expense'} size={18} />
            </div>
            <div class="tx-info">
              <p class="tx-cat">{t.category}</p>
              <p class="tx-date">
                {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                {t.note ? '· ' + t.note : ''}
              </p>
            </div>
            <span class="tx-amount {t.type === 'income' ? 'tx-amount--in' : 'tx-amount--out'}">
              {t.type === 'income' ? '+' : '-'}{formatCompact(t.amount)}
            </span>
          </a>
        {/each}
      {/if}
    </div>

    <div style="height:32px;"></div>
  </div>
</div>

<Onboarding bind:this={onboarding} />

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .home-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
  }

  /* Header dengan gradient biru-Ungu */
  .header {
    background: linear-gradient(160deg, #8FC5F7 0%, #6BAFF2 55%, #9CCCF8 100%);
    padding: 32px 20px 80px;
    position: relative;
    overflow: hidden;
  }
  .blob {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .b1 { width: 180px; height: 180px; top: -50px; right: -50px; }
  .b2 { width: 100px; height: 100px; bottom: 20px; left: -20px; }

  .header-top { position: relative; z-index: 1; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .notification-btn { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.45); border-radius: 14px; background: rgba(255,255,255,.2); color: white; cursor: pointer; }
  .greeting-sub { font-size: 13px; color: rgba(255,255,255,0.75); margin: 0 0 4px; }
  .greeting-name { font-size: 24px; font-weight: 900; color: white; margin: 0 0 8px; }
  .partner-line { font-size: 13px; color: rgba(255,255,255,0.85); margin: 0; display: flex; align-items: center; gap: 5px; }
  .partner-inline-img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
  .partner-cta { font-size: 12px; color: rgba(255,255,255,0.9); text-decoration: underline; }

  /* Balance Card */
  .balance-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 24px;
    padding: 22px;
    margin: 0 0 -48px;
    box-shadow: 0 10px 40px rgba(59,130,246,0.15);
    position: relative;
    z-index: 2;
  }
  .balance-label {
    font-size: 11px;
    font-weight: 800;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 6px;
  }

  /* Quick Actions */
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .quick-btn {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 18px;
    padding: 16px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 800;
    color: #1E293B;
    text-align: center;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  }

  .quick-btn:active {
    transform: scale(0.95);
  }

  .quick-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }

  .quick-btn:hover .quick-icon {
    transform: scale(1.1);
  }

  .quick-icon--red {
    background: linear-gradient(135deg, #FFF1F2, #FFE4E6);
    color: #F43F5E;
  }

  .quick-icon--green {
    background: linear-gradient(135deg, #F0FDF4, #DCFCE7);
    color: #22C55E;
  }

  .quick-icon--blue {
    background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
    color: #6BAFF2;
  }

  .quick-icon--pink {
    background: linear-gradient(135deg, #FDF2F8, #FCE7F3);
    color: #EC4899;
  }

  .balance-label {
    font-size: 11px;
    font-weight: 800;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 6px;
  }
  .balance-amount {
    font-size: 30px;
    font-weight: 900;
    color: #1E293B;
    margin: 0 0 18px;
  }
  .balance-split { display: flex; gap: 0; }
  .balance-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
  }
  .balance-item--in { background: #F0FDF4; }
  .balance-item--out { background: #FFF1F2; }
  .balance-item-sep { width: 10px; }
  .balance-item-icon { font-size: 18px; font-weight: 900; }
  .balance-item--in .balance-item-icon { color: #22C55E; }
  .balance-item--out .balance-item-icon { color: #F43F5E; }
  .balance-item-label { font-size: 11px; font-weight: 700; color: #94A3B8; margin: 0 0 2px; }
  .balance-item--in .balance-item-val { color: #15803D; }
  .balance-item--out .balance-item-val { color: #BE123C; }
  .balance-item-val { font-size: 14px; font-weight: 800; margin: 0; }

  /* Body */
  .body {
    padding: 64px 16px 0;
    position: relative;
    z-index: 1;
  }

  /* Sections */
  .section { margin-bottom: 22px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .section-title { font-size: 13px; font-weight: 900; color: #1E293B; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .section-more { font-size: 12px; font-weight: 700; color: #6BAFF2; text-decoration: none; }

  /* Quick Actions */
  .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .quick-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    padding: 14px 4px;
    box-shadow: 0 4px 16px rgba(59,130,246,0.08);
    transition: transform 0.15s;
  }
  .quick-item:active { transform: scale(0.95); }
  .quick-icon {
    width: 46px;
    height: 46px;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .quick-label { font-size: 11px; font-weight: 800; color: #1E293B; }

  /* Savings */
  .savings-list { display: flex; flex-direction: column; gap: 10px; }
  .savings-card {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    padding: 16px;
    box-shadow: 0 4px 16px rgba(59,130,246,0.08);
  }
  .savings-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .savings-name { font-weight: 800; color: #1E293B; font-size: 14px; margin: 0 0 3px; }
  .savings-sub { font-size: 12px; color: #94A3B8; margin: 0; }
  .savings-pct-badge {
    font-size: 18px;
    font-weight: 900;
    color: #A58BE8;
    background: #F5F3FF;
    padding: 4px 10px;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .progress-track { height: 7px; background: #EDE9FE; border-radius: 99px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #A58BE8, #A78BFA); border-radius: 99px; transition: width 0.5s ease; }

  /* Transactions */
  .tx-row {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 18px;
    padding: 12px 14px;
    margin-bottom: 8px;
    text-decoration: none;
    box-shadow: 0 3px 12px rgba(59,130,246,0.06);
    transition: transform 0.12s;
  }
  .tx-row:active { transform: scale(0.98); }
  .tx-icon {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }
  .tx-icon--in { background: rgba(34,197,94,0.12); }
  .tx-icon--out { background: rgba(244,63,94,0.12); }
  .tx-info { flex: 1; min-width: 0; }
  .tx-cat { font-weight: 800; color: #1E293B; font-size: 13px; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-date { font-size: 11px; color: #94A3B8; margin: 0; }
  .tx-amount { font-weight: 900; font-size: 13px; flex-shrink: 0; }
  .tx-amount--in { color: #15803D; }
  .tx-amount--out { color: #BE123C; }

  /* Empty */
  .empty-state {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    padding: 28px;
    text-align: center;
    box-shadow: 0 4px 16px rgba(59,130,246,0.06);
    color: #94A3B8;
    font-size: 13px;
    font-weight: 600;
  }
  .empty-link { color: #6BAFF2; font-weight: 700; text-decoration: none; display: block; margin-top: 8px; }

  /* Skeletons */
  .skeleton { border-radius: 14px; background: linear-gradient(90deg, #EFF6FF 25%, #E0E7FF 50%, #EFF6FF 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  .skeleton--balance { height: 36px; width: 60%; margin-bottom: 18px; }
  .skeleton--row { height: 60px; margin-bottom: 8px; }

  /* Modal Styles */
  .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background:rgba(30,41,59,0.45); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index:100; display:flex; align-items:flex-end; justify-content:center; }
  .modal { background:rgba(255,255,255,0.92); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-top: 1px solid rgba(255,255,255,0.8); padding: 20px 24px 48px; border-radius: 28px 28px 0 0; width: 100%; max-width: 540px; text-align:center; box-shadow: 0 -8px 40px rgba(59,130,246,0.1); animation: slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes slide-up { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .pm-handle { width: 44px; height: 5px; background: #E2E8F0; border-radius: 99px; margin: 0 auto 20px; }
  .pm-avatar-wrap { margin-bottom: 14px; }
  .pm-avatar-img { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid white; box-shadow: 0 4px 20px rgba(99,102,241,0.2); }
  .pm-avatar-placeholder { width: 88px; height: 88px; border-radius: 50%; background: linear-gradient(135deg, #EEF2FF, #E0E7FF); color: #7FA8EA; display: flex; align-items: center; justify-content: center; margin: 0 auto; box-shadow: 0 4px 20px rgba(99,102,241,0.15); }
  .pm-name { font-size: 20px; font-weight: 900; color: #1E293B; margin: 0 0 6px; }
  .pm-bio { font-size: 13px; color: #64748B; font-weight: 600; font-style: italic; margin: 0 0 20px; line-height: 1.5; }
  .pm-info-list { display: flex; flex-direction: column; margin-bottom: 24px; background: #F8FAFC; border-radius: 18px; overflow: hidden; text-align: left; }
  .pm-info-row { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-bottom: 1px solid #F1F5F9; }
  .pm-info-row:last-child { border-bottom: none; }
  .pm-info-icon { width: 34px; height: 34px; border-radius: 10px; background: #EFF6FF; color: #6BAFF2; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pm-info-label { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px; }
  .pm-info-val { font-size: 14px; font-weight: 700; color: #1E293B; margin: 0; }
  .pm-info-empty { color: #CBD5E1 !important; font-style: italic; font-weight: 600 !important; }
  .pm-close-btn { width: 100%; padding: 14px; background: #EFF6FF; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; color: #6BAFF2; transition: background 0.2s; }
  .pm-close-btn:hover { background: #DBEAFE; }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>

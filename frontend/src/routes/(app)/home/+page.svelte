<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
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
      if (!res.ok) throw new Error('Gagal memuat transaksi');
      const data = await readApiJson<{ transactions?: any[] }>(res);
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
      if (!res.ok) throw new Error('Gagal memuat tabungan');
      const data = await readApiJson<{ savings?: any[] }>(res);
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
    <div class="header-top">
      <div>
        <p class="greeting-sub">{greeting} {greetingEmoji}</p>
        <h1 class="greeting-name">{auth.user?.name || 'Pengguna'}</h1>
        {#if auth.partner}
          <button class="partner-line" style="background:none; border:none; cursor:pointer; padding:0; text-align:left;" onclick={() => showPartnerModal = true}>
            <span class="partner-chip">
              <Icon name="couple" size={14} />
              {#if auth.partner.avatar}
                <img src={auth.partner.avatar} alt={auth.partner.name} class="partner-inline-img" />
              {/if}
              {auth.partner.name}
            </span>
          </button>
        {:else if auth.user?.partner_id}
          <button class="partner-line" style="background:none; border:none; cursor:pointer; padding:0; text-align:left;" onclick={() => showPartnerModal = true}>
            <span class="partner-chip"><Icon name="couple" size={14} /> Terhubung dengan pasangan</span>
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

    <!-- Balance Card -->
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
      
      <button class="quick-btn quick-btn--notes" onclick={() => goto('/notes')}>
        <div class="quick-icon quick-icon--amber">
          <Icon name="notes" size={20} />
        </div>
        <span>Catatan</span>
      </button>
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

  /* -----------------------------------------------------------
     Home Header — clean & minimal
     ----------------------------------------------------------- */
  .header {
    padding: 24px 20px 6px;
    position: relative;
    overflow: hidden;
    font-family: 'Nunito', sans-serif;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 22px;
  }
  .notification-btn {
    border-radius: var(--clay-radius-tile);
    box-shadow:
      inset 4px 4px 8px rgba(255, 255, 255, 0.95),
      inset -3px -5px 10px rgba(33, 150, 243, 0.14),
      4px 7px 14px rgba(21, 101, 192, 0.12);
    display: grid; place-items: center; width: 42px; height: 42px;
    border: none;
    background: linear-gradient(150deg, #FFFFFF 0%, #EAF4FE 100%);
    color: #1976D2;
    cursor: pointer;
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .notification-btn:active {
    transform: translateY(2px);
    box-shadow:
      inset 4px 5px 10px rgba(25, 118, 210, 0.20),
      inset -3px -3px 8px rgba(255, 255, 255, 0.9),
      1px 2px 5px rgba(21, 101, 192, 0.08);
  }
  .greeting-sub { font-size: 13px; color: #64748B; margin: 0 0 2px; font-weight: 600; }
  .greeting-name { font-size: 26px; font-weight: 800; color: #1F2937; margin: 0 0 10px; letter-spacing: -0.02em; }
  .partner-line { font-size: 13px; margin: 0; display: flex; align-items: center; gap: 5px; font-weight: 600; }
  .partner-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.75);
    border: 1px solid rgba(203,213,225,0.7);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12px; font-weight: 600; color: #475569;
  }
  .partner-inline-img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
  .partner-cta { font-size: 13px; color: #1976D2; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }

  /* Balance Card — Apple liquid glass */
  .balance-card {
    background: linear-gradient(150deg, #E7F3FD 0%, #D2E9FB 100%);
    border-radius: var(--clay-radius-lg);
    padding: 22px;
    box-shadow:
      inset 6px 6px 12px rgba(255, 255, 255, 0.85),
      inset -5px -7px 14px rgba(25, 118, 210, 0.14),
      6px 10px 22px rgba(21, 101, 192, 0.12),
      2px 3px 6px rgba(21, 101, 192, 0.07);
  }
  .balance-label {
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 8px;
  }
  .balance-amount {
    font-size: 36px;
    font-weight: 800;
    color: #1F2937;
    margin: 0 0 20px;
    letter-spacing: -0.02em;
  }
  .balance-split { display: flex; gap: 0; }
  .balance-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
  }
  .balance-item {
    border-radius: var(--clay-radius-sm);
    box-shadow:
      inset 3px 3px 7px rgba(25, 118, 210, 0.13),
      inset -2px -2px 5px rgba(255, 255, 255, 0.9);
  }
  .balance-item--in { background: rgba(79, 191, 163, 0.14); }
  .balance-item--out { background: rgba(239, 124, 151, 0.14); }
  .balance-item-sep { width: 8px; }
  .balance-item-icon { font-size: 16px; font-weight: 800; }
  .balance-item--in .balance-item-icon { color: #35A88C; }
  .balance-item--out .balance-item-icon { color: #E2637F; }
  .balance-item-label { font-size: 11px; font-weight: 600; color: #64748B; margin: 0 0 2px; }
  .balance-item--in .balance-item-val { color: #2F9A80; }
  .balance-item--out .balance-item-val { color: #D2566F; }
  .balance-item-val { font-size: 14px; font-weight: 700; margin: 0; }

  /* Quick Actions */
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
    gap: 10px;
    margin-bottom: 26px;
  }

  .quick-btn {
    background: linear-gradient(150deg, #FFFFFF 0%, #EAF4FE 100%);
    border: none;
    border-radius: var(--clay-radius);
    padding: 15px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: #1F2937;
    text-align: center;
    box-shadow:
      inset 4px 4px 8px rgba(255, 255, 255, 0.95),
      inset -3px -5px 10px rgba(33, 150, 243, 0.13),
      4px 7px 16px rgba(21, 101, 192, 0.11);
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .quick-btn:active {
    transform: translateY(2px);
    box-shadow:
      inset 4px 5px 10px rgba(25, 118, 210, 0.20),
      inset -3px -3px 8px rgba(255, 255, 255, 0.9),
      1px 2px 5px rgba(21, 101, 192, 0.08);
  }

  .quick-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--clay-radius-tile);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: transform 0.2s;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.55),
      inset -3px -4px 8px rgba(13, 71, 161, 0.35),
      4px 7px 14px rgba(21, 101, 192, 0.26),
      1px 2px 4px rgba(21, 101, 192, 0.16);
  }
  .quick-btn:hover .quick-icon { transform: scale(1.06) rotate(-3deg); }

  /* Semua ubin tetap di keluarga biru; dua warna pendukung diredam
     agar tidak melawan warna brand. */
  .quick-icon--red { background: linear-gradient(145deg, #F7A9BC 0%, #EF7C97 55%, #E2637F 100%); }
  .quick-icon--green { background: linear-gradient(145deg, #8ED9C6 0%, #4FBFA3 55%, #35A88C 100%); }
  .quick-icon--blue { background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%); }
  .quick-icon--pink { background: linear-gradient(145deg, #7CC5F8 0%, #1E88E5 55%, #1565C0 100%); }
  .quick-icon--amber { background: linear-gradient(145deg, #B3E5FC 0%, #4FC3F7 55%, #29B6F6 100%); }

  /* Body */
  .body {
    padding: 22px 20px 0;
    position: relative;
    z-index: 1;
  }

  /* Sections */
  .section { margin-bottom: 28px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .section-title { font-size: 16px; font-weight: 800; color: #1F2937; margin: 0; letter-spacing: -0.01em; }
  .section-more { font-size: 13px; font-weight: 600; color: #1976D2; text-decoration: none; }

  /* Savings */
  .savings-list { display: flex; flex-direction: column; gap: 10px; }
  .savings-card {
    background: #FFFFFF;
    border-radius: var(--clay-radius);
    padding: 17px;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
  }
  .savings-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .savings-name { font-weight: 700; color: #1F2937; font-size: 14px; margin: 0 0 3px; }
  .savings-sub { font-size: 12px; color: #94A3B8; margin: 0; }
  .savings-pct-badge {
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    padding: 5px 12px;
    border-radius: 14px;
    flex-shrink: 0;
    box-shadow:
      inset 2px 2px 4px rgba(255, 255, 255, 0.4),
      inset -2px -3px 6px rgba(13, 71, 161, 0.3),
      2px 4px 9px rgba(21, 101, 192, 0.22);
  }
  /* Track dibuat cekung, isian dibuat menonjol */
  .progress-track {
    height: 11px;
    background: #DAEBFA;
    border-radius: 99px;
    padding: 2px;
    box-shadow:
      inset 3px 3px 6px rgba(25, 118, 210, 0.20),
      inset -2px -2px 5px rgba(255, 255, 255, 0.95);
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%);
    border-radius: 99px;
    transition: width 0.5s ease;
    box-shadow:
      inset 1px 1px 2px rgba(255, 255, 255, 0.5),
      inset -1px -2px 4px rgba(13, 71, 161, 0.3);
  }

  /* Transactions */
  .tx-row {
    display: flex;
    align-items: center;
    background: #FFFFFF;
    border-radius: var(--clay-radius);
    padding: 13px 15px;
    margin-bottom: 10px;
    text-decoration: none;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      5px 8px 18px rgba(21, 101, 192, 0.09),
      2px 3px 6px rgba(21, 101, 192, 0.05);
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .tx-row:active {
    transform: translateY(2px);
    box-shadow:
      inset 4px 5px 10px rgba(25, 118, 210, 0.16),
      inset -3px -3px 8px rgba(255, 255, 255, 0.9),
      1px 2px 5px rgba(21, 101, 192, 0.06);
  }
  .tx-icon {
    width: 42px;
    height: 42px;
    border-radius: var(--clay-radius-tile);
    color: #fff;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.3),
      3px 5px 11px rgba(21, 101, 192, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }
  .tx-icon--in { background: linear-gradient(145deg, #8ED9C6 0%, #4FBFA3 55%, #35A88C 100%); }
  .tx-icon--out { background: linear-gradient(145deg, #F7A9BC 0%, #EF7C97 55%, #E2637F 100%); }
  .tx-info { flex: 1; min-width: 0; }
  .tx-cat { font-weight: 700; color: #1F2937; font-size: 13px; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-date { font-size: 11px; color: #94A3B8; margin: 0; }
  .tx-amount { font-weight: 800; font-size: 13px; flex-shrink: 0; }
  .tx-amount--in { color: #2F9A80; }
  .tx-amount--out { color: #D2566F; }

  /* Empty */
  .empty-state {
    background: #E6F2FD;
    box-shadow:
      inset 4px 4px 9px rgba(25, 118, 210, 0.14),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95);
    border: none;
    border-radius: var(--clay-radius);
    padding: 30px;
    text-align: center;
    color: #5B6B85;
    font-size: 13px;
    font-weight: 600;
  }
  .empty-link { color: #1976D2; font-weight: 700; text-decoration: none; display: block; margin-top: 8px; }

  /* Skeletons */
  .skeleton { border-radius: 12px; background: linear-gradient(90deg, #EEF2F7 25%, #E2E8F0 50%, #EEF2F7 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
  .skeleton--balance { height: 36px; width: 60%; margin-bottom: 18px; }
  .skeleton--row { height: 60px; margin-bottom: 8px; }

  /* Modal Styles */
  .modal-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background:rgba(30,41,59,0.45); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index:100; display:flex; align-items:flex-end; justify-content:center; }
  .modal { background:rgba(255,255,255,0.92);  border-top: 1px solid rgba(255,255,255,0.8); padding: 20px 24px 48px; border-radius: 28px 28px 0 0; width: 100%; max-width: 540px; text-align:center; box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06); animation: slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1); }
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
  .pm-info-icon { width: 34px; height: 34px; border-radius: 10px; background: #EFF6FF; color: #2196F3; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pm-info-label { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 2px; }
  .pm-info-val { font-size: 14px; font-weight: 700; color: #1E293B; margin: 0; }
  .pm-info-empty { color: #CBD5E1 !important; font-style: italic; font-weight: 600 !important; }
  .pm-close-btn { width: 100%; padding: 14px; background: #EFF6FF; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; color: #2196F3; transition: background 0.2s; }
  .pm-close-btn:hover { background: #DBEAFE; }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>

<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { toast } from '$lib/toast.svelte';

  let budgets = $state<any[]>([]);
  let transactions = $state<any[]>([]);
  let loading = $state(true);
  let loadError = $state('');

  let showModal = $state(false);
  let editingBudget = $state<any>(null);
  let category = $state('');
  let amount = $state('');

  // Predefined categories
  const categories = [
    { name: 'Makanan & Minuman', icon: 'food', color: '#F59E0B' },
    { name: 'Transportasi', icon: 'transport', color: '#2196F3' },
    { name: 'Belanja', icon: 'shopping', color: '#EC4899' },
    { name: 'Hiburan', icon: 'entertainment', color: '#A58BE8' },
    { name: 'Tagihan', icon: 'bills', color: '#EF7C97' },
    { name: 'Kesehatan', icon: 'health', color: '#5CC8AC' },
    { name: 'Pendidikan', icon: 'education', color: '#0EA5E9' },
    { name: 'Lainnya', icon: 'other', color: '#64748B' }
  ];

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await fetchData();
  });

  function handleUnauthorized() {
    auth.logout();
    goto('/login');
  }

  async function fetchData() {
    loading = true;
    loadError = '';
    try {
      // Fetch budgets
      const budgetRes = await fetch(`${API_URL}/budgets`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (budgetRes.status === 401) { handleUnauthorized(); return; }
      const budgetData = await readApiJson<{ budgets?: any[]; error?: string }>(budgetRes);
      if (!budgetRes.ok) throw new Error(budgetData.error || 'Gagal memuat anggaran');
      budgets = budgetData.budgets || [];

      // Fetch current month transactions for comparison
      const txnRes = await fetch(`${API_URL}/transactions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (txnRes.status === 401) { handleUnauthorized(); return; }
      if (txnRes.ok) {
        const data = await readApiJson<{ transactions?: any[] }>(txnRes);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        transactions = (data.transactions || []).filter((t: any) => {
          const txnDate = new Date(t.created_at);
          return t.type === 'expense' && 
                 txnDate.getMonth() + 1 === currentMonth && 
                 txnDate.getFullYear() === currentYear;
        });
      } else throw new Error('Gagal memuat transaksi');
    } catch(e) {
      loadError = e instanceof Error ? e.message : 'Anggaran belum bisa dimuat.';
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    editingBudget = null;
    category = '';
    amount = '';
    showModal = true;
  }

  function openEditModal(budget: any) {
    editingBudget = budget;
    category = budget.category;
    amount = budget.amount.toString();
    showModal = true;
  }

  async function saveBudget(e: Event) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({
          category,
          amount: parseInt(amount)
        })
      });

      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Gagal menyimpan budget');

      showModal = false;
      await fetchData();
      toast.success(editingBudget ? 'Budget berhasil diupdate!' : 'Budget berhasil ditambahkan!');
    } catch(e: any) {
      toast.error(e.message || 'Gagal menyimpan budget');
    }
  }

  async function deleteBudget(id: number) {
    if (!confirm('Hapus budget ini?')) return;
    
    try {
      const res = await fetch(`${API_URL}/budgets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });

      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Gagal menghapus budget');

      await fetchData();
      toast.success('Budget berhasil dihapus!');
    } catch(e: any) {
      toast.error(e.message || 'Gagal menghapus budget');
    }
  }

  function getSpentAmount(cat: string) {
    return transactions
      .filter(t => t.category === cat)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function formatRp(num: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }

  function formatCompact(num: number) {
    if (num >= 1000000) return `${(num/1000000).toFixed(1)}jt`;
    if (num >= 1000) return `${(num/1000).toFixed(0)}rb`;
    return `${num}`;
  }

  function getCategoryIcon(cat: string) {
    const found = categories.find(c => c.name === cat);
    return found ? found.icon : 'other';
  }

  function getCategoryColor(cat: string) {
    const found = categories.find(c => c.name === cat);
    return found ? found.color : '#64748B';
  }

  let totalBudget = $derived(budgets.reduce((sum, b) => sum + b.amount, 0));
  let totalSpent = $derived(transactions.filter(t => budgets.some(b => b.category === t.category)).reduce((sum, t) => sum + t.amount, 0));
  let overallPercentage = $derived(totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0);
</script>

<div class="budget-root">
  
  <!-- Header -->
  <div class="header">
    <div class="header-inner">
      <a href="/wallet" class="back-link"><Icon name="back" size={18} /> Kembali ke Dompet</a>
      <div class="header-top">
        <div>
          <p class="header-sub">Kelola Pengeluaran</p>
          <h1 class="header-title">
            Anggaran <Icon name="wallet" size={24} />
          </h1>
          <p class="header-description">Atur pengeluaran bulanan supaya rencana tetap terasa ringan.</p>
        </div>
        <button class="create-btn" onclick={openCreateModal}>
          + Atur
        </button>
      </div>

      <!-- Overall Summary -->
      {#if !loading && !loadError && budgets.length > 0}
        <div class="summary-card">
          <div class="summary-row">
            <div>
              <p class="summary-label">Total Terpakai</p>
              <p class="summary-amount">Rp {formatCompact(totalSpent)}</p>
            </div>
            <div style="text-align:right;">
              <p class="summary-label">Total Anggaran</p>
              <p class="summary-amount">Rp {formatCompact(totalBudget)}</p>
            </div>
          </div>
          <div class="summary-track">
            <div class="summary-fill" style="width:{Math.min(overallPercentage,100)}%"></div>
          </div>
          <div class="summary-meta">
            <span>{budgets.length} kategori</span>
            <span class="summary-pct {overallPercentage > 90 ? 'summary-pct--warning' : ''}">{overallPercentage}% terpakai</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    {#if loading}
      <div class="budget-list" aria-label="Memuat anggaran">
        {#each [1, 2] as _}
          <div class="budget-skeleton">
            <div class="budget-skeleton-icon"></div>
            <div class="budget-skeleton-copy"><div></div><div></div></div>
            <div class="budget-skeleton-track"></div>
          </div>
        {/each}
      </div>

    {:else if loadError}
      <div class="empty-state" role="alert">
        <div class="empty-icon"><Icon name="wallet" size={36} /></div>
        <p class="empty-title">Anggaran belum bisa dimuat</p>
        <p class="empty-sub">{loadError}</p>
        <button type="button" class="empty-cta" onclick={fetchData}>Coba lagi</button>
      </div>

    {:else if budgets.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="wallet" size={36} />
        </div>
        <p class="empty-title">Belum ada anggaran</p>
        <p class="empty-sub">Mulai dari satu kategori agar pengeluaran bulanan lebih terarah.</p>
        <button class="empty-cta" onclick={openCreateModal}>Atur anggaran pertama</button>
      </div>

    {:else}
      <div class="budget-list">
        {#each budgets as budget}
          {@const spent = getSpentAmount(budget.category)}
          {@const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0}
          {@const remaining = budget.amount - spent}
          {@const isWarning = percentage >= 80}
          {@const isOver = percentage >= 100}

          <div class="budget-card {isOver ? 'budget-card--over' : ''}">
            <div class="budget-header">
              <div class="budget-icon" style="background:linear-gradient(145deg, {getCategoryColor(budget.category)}CC, {getCategoryColor(budget.category)});">
                <Icon name={getCategoryIcon(budget.category)} size={23} />
              </div>
              <div class="budget-info">
                <h3 class="budget-name">{budget.category}</h3>
                <p class="budget-limit">Anggaran: {formatRp(budget.amount)}</p>
              </div>
              <div class="budget-menu">
                <button type="button" class="menu-btn" onclick={() => openEditModal(budget)} aria-label="Edit anggaran {budget.category}">
                  <Icon name="edit" size={16} />
                </button>
                <button type="button" class="menu-btn menu-btn--delete" onclick={() => deleteBudget(budget.id)} aria-label="Hapus anggaran {budget.category}">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>

            <div class="budget-progress">
              <div class="budget-track">
                <div 
                  class="budget-fill {isWarning ? 'budget-fill--warning' : ''} {isOver ? 'budget-fill--over' : ''}" 
                  style="width:{Math.min(percentage,100)}%"
                ></div>
              </div>
            </div>

            <div class="budget-amounts">
              <div class="budget-amount-item">
                <p class="budget-amount-label">Terpakai</p>
                <p class="budget-amount-val budget-amount-val--spent">{formatRp(spent)}</p>
              </div>
              <div class="budget-amount-item" style="text-align:right;">
                {#if isOver}
                  <p class="budget-amount-label">Melebihi anggaran</p>
                  <p class="budget-amount-val budget-amount-val--over">{formatRp(Math.abs(remaining))}</p>
                {:else}
                  <p class="budget-amount-label">Sisa</p>
                  <p class="budget-amount-val budget-amount-val--remaining">{formatRp(remaining)}</p>
                {/if}
              </div>
            </div>

            {#if isOver}
              <div class="budget-warning">
                <Icon name="error" size={16} />
                <span>Melebihi anggaran {percentage - 100}%</span>
              </div>
            {:else if isWarning}
              <div class="budget-alert">
                <Icon name="error" size={16} />
                <span>Hampir habis! Sisa {100 - percentage}%</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div style="height:32px;"></div>
  </div>

  <!-- Modal Set/Edit Budget -->
  {#if showModal}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label={editingBudget ? 'Edit anggaran' : 'Atur anggaran baru'} tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="wallet" size={24} />
          </div>
          <div>
            <h3 class="modal-title">{editingBudget ? 'Edit Anggaran' : 'Atur Anggaran Baru'}</h3>
            <p class="modal-subtitle">Tentukan batas pengeluaran bulanan</p>
          </div>
        </div>
        <form class="modal-form" onsubmit={saveBudget}>
          <div class="form-group">
            <label class="form-label" for="budget-category">Kategori</label>
            {#if editingBudget}
              <input
                id="budget-category"
                type="text"
                bind:value={category}
                disabled
                class="form-input form-input--disabled"
              />
            {:else}
              <select id="budget-category" bind:value={category} required class="form-input">
                <option value="">Pilih Kategori</option>
                {#each categories as cat}
                  <option value={cat.name}>{cat.name}</option>
                {/each}
              </select>
            {/if}
          </div>
          <div class="form-group">
            <label class="form-label" for="budget-amount">Anggaran per Bulan (Rp)</label>
            <input
              id="budget-amount"
              type="number"
              bind:value={amount}
              required
              min="1"
              placeholder="0"
              class="form-input form-input--amount"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showModal = false}>Batal</button>
            <button type="submit" class="modal-submit">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .budget-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
  }

  /* Header */
  .header {
    padding:24px 22px 28px;
    position: relative;
    flex-shrink: 0;
    font-family: 'Nunito', sans-serif;
    border-radius:0 0 28px 28px;
    background:linear-gradient(155deg,#1D4ED8,#2563EB 55%,#3B82F6);
    box-shadow:0 12px 26px rgba(37,99,235,.18);
  }

  .header-inner { position:relative; max-width:760px; margin:auto; }
  .back-link { display:inline-flex; align-items:center; gap:6px; min-height:44px; margin-bottom:10px; color:#dbeafe; font-size:14px; font-weight:900; text-decoration:none; }
  .back-link:hover { color:#fff; }
  .header-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:18px; }
  .header-sub { font-size:11px; color:#DBEAFE; margin:0 0 6px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; }
  .header-title { display:flex; align-items:center; gap:8px; font-size:29px; font-weight:900; color:#fff; margin:0; letter-spacing:-.03em; }
  .header-description { max-width:300px; margin:8px 0 0; color:#EFF6FF; font-size:14px; line-height:1.45; font-weight:700; }

  .create-btn {
    background:rgba(255,255,255,.18);
    color: #ffffff;
    border:1px solid rgba(255,255,255,.35);
    border-radius: 12px;
    min-height:44px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.15s, filter 0.2s;
    flex-shrink: 0;
    box-shadow:0 5px 14px rgba(15,55,140,.13);
  }
  .create-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
  .create-btn:active { transform: scale(0.96); }

  /* Summary Card */
  .summary-card {
    background:rgba(255,255,255,.17);
    border:1px solid rgba(255,255,255,.28);
    border-radius:20px;
    padding:17px;
    box-shadow:0 8px 22px rgba(15,55,140,.12);
  }
  .summary-row { display:flex; justify-content:space-between; gap:14px; margin-bottom:14px; }
  .summary-label { font-size:11px; color:#DBEAFE; margin:0 0 4px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
  .summary-amount { font-size:18px; font-weight:900; color:#fff; margin:0; }
  .summary-track { height:10px; background:rgba(255,255,255,.22); border-radius:99px; padding:2px; margin-bottom:10px; }
  .summary-fill { height:100%; background:#fff; border-radius:99px; transition:width .6s ease; }
  .summary-meta { display:flex; justify-content:space-between; gap:8px; font-size:11px; color:#DBEAFE; font-weight:700; }
  .summary-pct { color:#fff; font-weight:900; }
  .summary-pct--warning { color:#FDE68A; }

  /* Body */
  .body { max-width:760px; margin:auto; padding:24px 16px calc(24px + env(safe-area-inset-bottom)); }

  /* Empty */
  .empty-state { text-align:center; padding:60px 20px; border-radius:22px; background:rgba(255,255,255,.7); }
  .empty-icon { width:72px; height:72px; margin:0 auto 16px; color:#2563EB; display:grid; place-items:center; border-radius:22px; background:#E7F1FF; }
  .empty-title { font-size:17px; font-weight:900; color:#172033; margin:0 0 6px; }
  .empty-sub { font-size:12px; line-height:1.5; color:#64748B; margin:0 0 22px; }
  .empty-cta {
    background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 13px 24px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s, transform 0.15s;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }
  .empty-cta:hover { filter: brightness(1.12); transform: translateY(-1px); }

  /* Budget List */
  .budget-list { display: flex; flex-direction: column; gap: 14px; }

  /* Budget Card */
  .budget-card {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 1px 2px rgba(31,41,55,0.04);
    transition: transform 0.15s;
  }
  .budget-card--over {
    border-color: rgba(239, 124, 151, 0.4);
    background: #ffffff;
  }
  .budget-card:active { transform: scale(0.99); }

  .budget-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  
  .budget-icon {
    width: 48px;
    height: 48px;
    border-radius: 32%;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.45),
      inset -3px -4px 8px rgba(13, 71, 161, 0.28),
      4px 6px 13px rgba(21, 101, 192, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 24px;
    color:#fff;
  }

  .budget-info { flex: 1; min-width: 0; }
  .budget-name { font-size: 15px; font-weight: 700; color: #1F2937; margin: 0 0 3px; }
  .budget-limit { font-size: 11px; color: #64748B; margin: 0; font-weight: 600; }

  .budget-menu { display: flex; gap: 6px; flex-shrink: 0; }
  .menu-btn {
    width: 32px;
    height: 32px;
    border-radius: 16px;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.32),
      4px 6px 13px rgba(21, 101, 192, 0.22);
  }
  .menu-btn:hover { background: rgba(33, 150, 243, 0.2); }
  .menu-btn:active { transform: scale(0.92); }
  .menu-btn--delete { background: linear-gradient(145deg, #F7A9BC 0%, #EF7C97 55%, #E2637F 100%); color: #fff; }
  .menu-btn--delete:hover { background: linear-gradient(145deg, #F7A9BC 0%, #EF7C97 55%, #E2637F 100%); }

  /* Progress */
  .budget-progress { margin-bottom: 12px; }
  .budget-track { height: 11px; background: #DAEBFA; border-radius: 99px; padding: 2px; box-shadow: inset 3px 3px 6px rgba(25, 118, 210, 0.20), inset -2px -2px 5px rgba(255, 255, 255, 0.95); }
  .budget-fill { height: 100%; background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%); border-radius: 99px; transition: width 0.6s ease; box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }
  .budget-fill--warning { background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%); box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }
  .budget-fill--over { background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%); box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }

  /* Amounts */
  .budget-amounts { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .budget-amount-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 3px; }
  .budget-amount-val { font-size: 13px; font-weight: 700; color: #1F2937; margin: 0; }
  .budget-amount-val--spent { color: #2F9A80; }
  .budget-amount-val--remaining { color: #1976D2; }
  .budget-amount-val--over { color: #D2566F; }

  /* Alerts */
  .budget-warning, .budget-alert {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .budget-warning {
    background: rgba(239, 124, 151, 0.1);
    border: 1px solid rgba(239, 124, 151, 0.4);
    color: #D2566F;
  }
  .budget-alert {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #B45309;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(30,41,59,0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: #FFFFFF;
    border-top: 1px solid rgba(255,255,255,0.8);
    border-radius: 28px 28px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 40px;
    animation: slide-up 0.25s ease;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
  }
  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .modal-handle { width: 44px; height: 5px; background: #E0E7FF; border-radius: 99px; margin: 0 auto 20px; }

  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .modal-icon-circle {
    width: 50px;
    height: 50px;
    border-radius: 16px;
    background: #EFF6FF;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #2196F3;
    flex-shrink: 0;
  }
  .modal-title { font-size: 17px; font-weight: 900; color: #1E293B; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #94A3B8; margin: 0; font-weight: 700; }

  /* Form */
  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px;
    border: none;
    border-radius: 22px;
    font-size: 15px;
    font-weight: 700;
    color: #1E293B;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #E6F2FD;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.13),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95);
  }
  .form-input:focus {
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.18),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95),
      0 0 0 3px rgba(33, 150, 243, 0.16);
  }
  .form-input--amount { font-size: 24px; font-weight: 900; }
  .form-input--disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; }

  .modal-actions { display: flex; gap: 12px; padding-top: 4px; }
  .modal-cancel {
    flex: 1;
    padding: 14px;
    background: #F0F4FF;
    color: #94A3B8;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }
  .modal-submit {
    flex: 2;
    padding: 14px;
    background: linear-gradient(145deg, #2196F3, #4F96E5);
    color: white;
    border: none;
    border-radius: 22px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
    transition: transform 0.12s;
  }
  .modal-submit:active { transform: scale(0.97); }

  /* Refined product surface */
  .budget-card, .empty-state {
    border: 1px solid rgba(255,255,255,.92);
    box-shadow: 0 8px 20px rgba(30,64,175,.06);
  }
  .budget-skeleton { display:grid; grid-template-columns:48px 1fr; column-gap:13px; row-gap:17px; min-height:126px; padding:18px; border:1px solid #e3edfa; border-radius:18px; background:rgba(255,255,255,.85); }
  .budget-skeleton-icon,.budget-skeleton-copy div,.budget-skeleton-track { background:linear-gradient(100deg,#e8f1fb,#f8fbff,#e8f1fb); background-size:200% 100%; animation:budget-shimmer 1.4s ease-in-out infinite; }
  .budget-skeleton-icon { width:48px; height:48px; border-radius:14px; }
  .budget-skeleton-copy { display:flex; flex-direction:column; justify-content:center; gap:9px; }
  .budget-skeleton-copy div { width:65%; height:12px; border-radius:7px; }
  .budget-skeleton-copy div:last-child { width:42%; height:9px; }
  .budget-skeleton-track { grid-column:1 / -1; height:9px; border-radius:99px; }
  @keyframes budget-shimmer { to { background-position-x:-200%; } }
  .budget-card { border-radius: 18px; }
  .budget-track { box-shadow:none; background:#E8EEF7; }
  .budget-fill, .budget-fill--warning, .budget-fill--over { background:#2563EB; box-shadow:none; }
  .menu-btn { border-radius: 10px; box-shadow: none; }
  .empty-cta, .modal-submit { background:#2563EB; box-shadow:0 8px 18px rgba(37,99,235,.22); border-radius:14px; }
  .form-input { border: 1px solid #E2E8F0; box-shadow: none; background: #F8FAFC; border-radius: 12px; }
  .form-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .budget-card--over { border-color:#fecdd3; background:#fffafb; }
  .budget-name { font-weight:900; overflow-wrap:anywhere; }
  .budget-limit { overflow-wrap:anywhere; }
  .budget-icon { border-radius:15px; box-shadow:0 6px 14px rgba(30,64,175,.14); }
  .budget-menu { gap:8px; }
  .menu-btn { width:44px; height:44px; border:1px solid #dbeafe; background:#eff6ff; color:#2563eb; }
  .menu-btn:hover { background:#dbeafe; }
  .menu-btn--delete,.menu-btn--delete:hover { border-color:#ffe4e6; background:#fff1f2; color:#e11d48; }
  .budget-amount-item { min-width:0; max-width:50%; }
  .budget-amount-val { font-size:clamp(12px,3.8vw,16px); font-weight:900; overflow-wrap:anywhere; }
  .budget-amount-val--spent { color:#172033; }
  .budget-amount-val--remaining { color:#1d4ed8; }
  .budget-fill--warning { background:#f59e0b; }
  .budget-fill--over { background:#e11d48; }
  .modal { max-height:calc(100dvh - 32px); overflow-y:auto; padding-bottom:max(24px,env(safe-area-inset-bottom)); box-shadow:0 -18px 40px rgba(15,55,140,.14); }
  .modal-cancel { color:#475569; background:#f1f5f9; border-radius:12px; }
  @media (max-width:380px) {
    .budget-card { padding:15px; }
    .budget-header { gap:8px; }
    .budget-icon { width:42px; height:42px; }
    .budget-menu { gap:5px; }
    .menu-btn { width:44px; height:44px; }
    .modal { padding-inline:18px; }
  }
</style>

<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { toast } from '$lib/toast.svelte';

  let budgets = $state<any[]>([]);
  let transactions = $state<any[]>([]);
  let loading = $state(true);

  let showModal = $state(false);
  let editingBudget = $state<any>(null);
  let category = $state('');
  let amount = $state('');

  // Predefined categories
  const categories = [
    { name: 'Makanan & Minuman', icon: 'food', color: '#F59E0B' },
    { name: 'Transportasi', icon: 'transport', color: '#6BAFF2' },
    { name: 'Belanja', icon: 'shopping', color: '#EC4899' },
    { name: 'Hiburan', icon: 'entertainment', color: '#A58BE8' },
    { name: 'Tagihan', icon: 'bills', color: '#EF4444' },
    { name: 'Kesehatan', icon: 'health', color: '#22C55E' },
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
    try {
      // Fetch budgets
      const budgetRes = await fetch(`${API_URL}/budgets`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (budgetRes.status === 401) { handleUnauthorized(); return; }
      if (budgetRes.ok) {
        const data = await budgetRes.json();
        budgets = data.budgets || [];
      }

      // Fetch current month transactions for comparison
      const txnRes = await fetch(`${API_URL}/transactions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (txnRes.ok) {
        const data = await txnRes.json();
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        transactions = (data.transactions || []).filter((t: any) => {
          const txnDate = new Date(t.created_at);
          return t.type === 'expense' && 
                 txnDate.getMonth() + 1 === currentMonth && 
                 txnDate.getFullYear() === currentYear;
        });
      }
    } catch(e) {
      console.error('Failed to fetch data:', e);
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
    return found ? found.icon : '📦';
  }

  function getCategoryColor(cat: string) {
    const found = categories.find(c => c.name === cat);
    return found ? found.color : '#64748B';
  }

  let totalBudget = $derived(budgets.reduce((sum, b) => sum + b.amount, 0));
  let totalSpent = $derived(transactions.reduce((sum, t) => sum + t.amount, 0));
  let overallPercentage = $derived(totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0);
</script>

<div class="budget-root">
  
  <!-- Header -->
  <div class="header">
    <div class="header-inner">
      <div class="header-top">
        <div>
          <p class="header-sub">Kelola Pengeluaran</p>
          <h1 class="header-title" style="display: flex; align-items: center; gap: 8px;">
            Budget <Icon name="wallet" size={24} />
          </h1>
        </div>
        <button class="create-btn" onclick={openCreateModal}>
          + Set Budget
        </button>
      </div>

      <!-- Overall Summary -->
      {#if budgets.length > 0}
        <div class="summary-card">
          <div class="summary-row">
            <div>
              <p class="summary-label">Total Terpakai</p>
              <p class="summary-amount">Rp {formatCompact(totalSpent)}</p>
            </div>
            <div style="text-align:right;">
              <p class="summary-label">Total Budget</p>
              <p class="summary-amount">Rp {formatCompact(totalBudget)}</p>
            </div>
          </div>
          <div class="summary-track">
            <div class="summary-fill" style="width:{overallPercentage}%"></div>
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
      <div class="loading-wrap">
        <div class="spinner"></div>
      </div>

    {:else if budgets.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="empty" size={56} />
        </div>
        <p class="empty-title">Belum ada budget</p>
        <p class="empty-sub">Yuk atur budget bulanan per kategori!</p>
        <button class="empty-cta" onclick={openCreateModal}>+ Set Budget Pertama</button>
      </div>

    {:else}
      <div class="budget-list">
        {#each budgets as budget}
          {@const spent = getSpentAmount(budget.category)}
          {@const percentage = Math.min(Math.round((spent / budget.amount) * 100), 100)}
          {@const remaining = budget.amount - spent}
          {@const isWarning = percentage >= 80}
          {@const isOver = percentage >= 100}

          <div class="budget-card {isOver ? 'budget-card--over' : ''}">
            <div class="budget-header">
              <div class="budget-icon" style="background:{getCategoryColor(budget.category)}22; color:{getCategoryColor(budget.category)}">
                <span class="budget-emoji">{getCategoryIcon(budget.category)}</span>
              </div>
              <div class="budget-info">
                <h3 class="budget-name">{budget.category}</h3>
                <p class="budget-limit">Budget: {formatRp(budget.amount)}</p>
              </div>
              <div class="budget-menu">
                <button class="menu-btn" onclick={() => openEditModal(budget)}>
                  <Icon name="edit" size={16} />
                </button>
                <button class="menu-btn menu-btn--delete" onclick={() => deleteBudget(budget.id)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>

            <div class="budget-progress">
              <div class="budget-track">
                <div 
                  class="budget-fill {isWarning ? 'budget-fill--warning' : ''} {isOver ? 'budget-fill--over' : ''}" 
                  style="width:{percentage}%"
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
                  <p class="budget-amount-label">Over Budget</p>
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
                <span>Melebihi budget {Math.abs(percentage - 100)}%!</span>
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="wallet" size={24} />
          </div>
          <div>
            <h3 class="modal-title">{editingBudget ? 'Edit Budget' : 'Set Budget Baru'}</h3>
            <p class="modal-subtitle">Atur budget bulanan</p>
          </div>
        </div>
        <form class="modal-form" onsubmit={saveBudget}>
          <div class="form-group">
            <label class="form-label">Kategori</label>
            {#if editingBudget}
              <input
                type="text"
                bind:value={category}
                disabled
                class="form-input form-input--disabled"
              />
            {:else}
              <select bind:value={category} required class="form-input">
                <option value="">Pilih Kategori</option>
                {#each categories as cat}
                  <option value={cat.name}>{cat.icon} {cat.name}</option>
                {/each}
              </select>
            {/if}
          </div>
          <div class="form-group">
            <label class="form-label">Budget per Bulan (Rp)</label>
            <input
              type="number"
              bind:value={amount}
              required
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

  /* Header — clean & minimal */
  .header {
    padding: 26px 18px 18px;
    position: relative;
    flex-shrink: 0;
    font-family: 'Nunito', sans-serif;
  }

  .header-inner { position: relative; }
  .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
  .header-sub { font-size: 12px; color: #94A3B8; margin: 0 0 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .header-title { font-size: 24px; font-weight: 800; color: #1F2937; margin: 0; }

  .create-btn {
    background: #0B9E6B;
    color: #ffffff;
    border: 1px solid #0B9E6B;
    border-radius: 12px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.12s, background 0.2s;
    flex-shrink: 0;
  }
  .create-btn:hover { background: #059669; }
  .create-btn:active { transform: scale(0.96); }

  /* Summary Card */
  .summary-card {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 1px 2px rgba(31,41,55,0.04);
  }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .summary-label { font-size: 10px; color: #94A3B8; margin: 0 0 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-amount { font-size: 18px; font-weight: 800; color: #1F2937; margin: 0; }
  .summary-track { height: 8px; background: #E2E8F0; border-radius: 99px; overflow: hidden; margin-bottom: 8px; }
  .summary-fill { height: 100%; background: linear-gradient(90deg, #10B981, #34D399); border-radius: 99px; transition: width 0.6s ease; }
  .summary-meta { display: flex; justify-content: space-between; font-size: 12px; color: #64748B; font-weight: 600; }
  .summary-pct { color: #059669; font-weight: 700; }
  .summary-pct--warning { color: #D97706; }

  /* Body */
  .body { padding: 18px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E0E7FF; border-top-color: #6BAFF2; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Empty */
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { margin-bottom: 14px; color: #94A3B8; display: flex; justify-content: center; }
  .empty-title { font-size: 16px; font-weight: 900; color: #1E293B; margin: 0 0 6px; }
  .empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 22px; }
  .empty-cta {
    background: #0B9E6B;
    color: white;
    border: 1px solid #0B9E6B;
    border-radius: 12px;
    padding: 13px 24px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
  }
  .empty-cta:hover { background: #059669; }

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
    border-color: rgba(239, 68, 68, 0.4);
    background: #ffffff;
  }
  .budget-card:active { transform: scale(0.99); }

  .budget-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  
  .budget-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 24px;
  }

  .budget-info { flex: 1; min-width: 0; }
  .budget-name { font-size: 15px; font-weight: 700; color: #1F2937; margin: 0 0 3px; }
  .budget-limit { font-size: 11px; color: #64748B; margin: 0; font-weight: 600; }

  .budget-menu { display: flex; gap: 6px; flex-shrink: 0; }
  .menu-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(91, 141, 239, 0.1);
    color: #4772E8;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .menu-btn:hover { background: rgba(91, 141, 239, 0.2); }
  .menu-btn:active { transform: scale(0.92); }
  .menu-btn--delete { background: rgba(239, 68, 68, 0.1); color: #DC2626; }
  .menu-btn--delete:hover { background: rgba(239, 68, 68, 0.2); }

  /* Progress */
  .budget-progress { margin-bottom: 12px; }
  .budget-track { height: 8px; background: #E2E8F0; border-radius: 99px; overflow: hidden; }
  .budget-fill { height: 100%; background: linear-gradient(90deg, #10B981, #34D399); border-radius: 99px; transition: width 0.6s ease; }
  .budget-fill--warning { background: linear-gradient(90deg, #F59E0B, #FCD34D); }
  .budget-fill--over { background: linear-gradient(90deg, #EF4444, #FCA5A5); }

  /* Amounts */
  .budget-amounts { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .budget-amount-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 3px; }
  .budget-amount-val { font-size: 13px; font-weight: 700; color: #1F2937; margin: 0; }
  .budget-amount-val--spent { color: #059669; }
  .budget-amount-val--remaining { color: #4772E8; }
  .budget-amount-val--over { color: #DC2626; }

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
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #DC2626;
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
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255,255,255,0.8);
    border-radius: 28px 28px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 40px;
    animation: slide-up 0.25s ease;
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
    color: #6BAFF2;
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
    border: 2px solid #E0E7FF;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    color: #1E293B;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #F8FAFC;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #6BAFF2; }
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
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(34,197,94,0.3);
    transition: transform 0.12s;
  }
  .modal-submit:active { transform: scale(0.97); }
</style>

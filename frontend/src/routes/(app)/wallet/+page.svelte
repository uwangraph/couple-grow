<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ICONS } from '$lib/icons';

  let transactions = $state<any[]>([]);
  let stats = $state<{ monthly: any[]; categories: any[] }>({ monthly: [], categories: [] });
  let loading = $state(true);
  let activeTab = $state<'history' | 'stats'>('history');

  let showModal = $state(false);
  let amount = $state('');
  let type = $state('expense');
  let category = $state('');
  let note = $state('');

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await Promise.all([fetchTransactions(), fetchStats()]);
  });

  async function fetchTransactions() {
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) transactions = data.transactions || [];
    } catch(e) {} finally { loading = false; }
  }

  async function fetchStats() {
    try {
      const res = await fetch(`${API_URL}/transactions/stats`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) stats = data;
    } catch(e) {}
  }

  async function addTransaction(e: Event) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(amount), type, category, note })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showModal = false;
      amount = ''; category = ''; note = '';
      await Promise.all([fetchTransactions(), fetchStats()]);
    } catch(e: any) { alert(e.message); }
  }

  let totalBalance = $derived(
    transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0)
  );
  let totalIncome = $derived(transactions.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0));
  let totalExpense = $derived(transactions.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0));

  function formatRp(num: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }
  function shortMonth(ym: string) {
    const [y, m] = ym.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('id-ID', { month: 'short' });
  }
  let maxBarValue = $derived(
    Math.max(...stats.monthly.map(s => Math.max(s.total_income || 0, s.total_expense || 0)), 1)
  );
</script>

<div class="wallet-root">

  <!-- Balance Header -->
  <div class="header">
    <div class="blob b1"></div>
    <div class="blob b2"></div>

    <div class="header-inner">
      <p class="balance-label">Total Saldo Bersama</p>
      <h2 class="balance-amount">{formatRp(totalBalance)}</h2>
      <div class="balance-row">
        <div class="balance-chip balance-chip--in">
          <span class="chip-arrow">↑</span>
          <div>
            <p class="chip-label">Masuk</p>
            <p class="chip-val">{formatRp(totalIncome)}</p>
          </div>
        </div>
        <div class="balance-chip balance-chip--out">
          <span class="chip-arrow">↓</span>
          <div>
            <p class="chip-label">Keluar</p>
            <p class="chip-val">{formatRp(totalExpense)}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs + Add Button -->
  <div class="tab-bar">
    <button
      class="tab {activeTab === 'history' ? 'tab--active' : ''}"
      onclick={() => activeTab = 'history'}
    >
      📋 Riwayat
    </button>
    <button
      class="tab {activeTab === 'stats' ? 'tab--active' : ''}"
      onclick={() => activeTab = 'stats'}
    >
      📊 Statistik
    </button>
    <button class="add-btn" onclick={() => showModal = true}>
      + Catat
    </button>
  </div>

  <!-- Content -->
  <div class="content">

    {#if loading}
      <div class="loading-wrap">
        <div class="spinner"></div>
      </div>

    {:else if activeTab === 'history'}
      <div class="list">
        {#if transactions.length === 0}
          <div class="empty-state">
            <img src={ICONS.empty} alt="kosong" style="width:40px;height:40px;opacity:0.4;margin-bottom:12px;" />
            <p>Belum ada transaksi</p>
            <button class="empty-link" onclick={() => showModal = true}>Catat sekarang →</button>
          </div>
        {/if}
        {#each transactions as t}
          <div class="tx-row">
            <div class="tx-icon {t.type === 'income' ? 'tx-icon--in' : 'tx-icon--out'}">
              <img src={t.type === 'income' ? ICONS.income : ICONS.expense} alt="type" style="width:18px;height:18px;" />
            </div>
            <div class="tx-info">
              <p class="tx-cat">{t.category}</p>
              <p class="tx-date">
                {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                {t.note ? '· ' + t.note : ''}
              </p>
            </div>
            <span class="tx-amount {t.type === 'income' ? 'tx-amount--in' : 'tx-amount--out'}">
              {t.type === 'income' ? '+' : '-'}{formatRp(t.amount)}
            </span>
          </div>
        {/each}
      </div>

    {:else}
      <!-- Stats -->
      <div class="stats-list">

        <!-- Bar Chart -->
        <div class="stat-card">
          <p class="stat-card-title">📈 Grafik 6 Bulan Terakhir</p>
          {#if stats.monthly.length === 0}
            <p class="stat-empty">Belum ada data statistik</p>
          {:else}
            <div class="bar-chart">
              {#each stats.monthly as s}
                <div class="bar-col">
                  <div class="bars">
                    <div class="bar bar--in" style="height:{Math.max(((s.total_income || 0) / maxBarValue) * 100, 4)}%;"></div>
                    <div class="bar bar--out" style="height:{Math.max(((s.total_expense || 0) / maxBarValue) * 100, 4)}%;"></div>
                  </div>
                  <p class="bar-label">{shortMonth(s.month)}</p>
                </div>
              {/each}
            </div>
            <div class="bar-legend">
              <div class="legend-item"><div class="legend-dot legend-dot--in"></div><span>Masuk</span></div>
              <div class="legend-item"><div class="legend-dot legend-dot--out"></div><span>Keluar</span></div>
            </div>
          {/if}
        </div>

        <!-- Categories -->
        <div class="stat-card">
          <p class="stat-card-title">🏷️ Pengeluaran Terbesar Bulan Ini</p>
          {#if stats.categories.length === 0}
            <p class="stat-empty">Belum ada pengeluaran bulan ini</p>
          {:else}
            {@const maxCat = Math.max(...stats.categories.map(c => c.total), 1)}
            <div class="cat-list">
              {#each stats.categories as cat, i}
                <div class="cat-item">
                  <div class="cat-header">
                    <span class="cat-name">{cat.category}</span>
                    <span class="cat-val">{formatRp(cat.total)}</span>
                  </div>
                  <div class="cat-track">
                    <div class="cat-fill" style="width:{(cat.total / maxCat) * 100}%; opacity: {1 - i * 0.12};"></div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Modal -->
  {#if showModal}
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <h3 class="modal-title">✍️ Catat Transaksi</h3>

        <!-- Type toggle -->
        <div class="type-toggle">
          <button
            class="type-btn {type === 'expense' ? 'type-btn--out' : ''}"
            onclick={() => type = 'expense'}
          >
            <img src={ICONS.expense} alt="expense" style="width:16px;height:16px;" />
            Pengeluaran
          </button>
          <button
            class="type-btn {type === 'income' ? 'type-btn--in' : ''}"
            onclick={() => type = 'income'}
          >
            <img src={ICONS.income} alt="income" style="width:16px;height:16px;" />
            Pemasukan
          </button>
        </div>

        <form class="modal-form" onsubmit={addTransaction}>
          <div class="form-group">
            <label class="form-label">Nominal (Rp)</label>
            <input
              type="number"
              bind:value={amount}
              required
              placeholder="0"
              class="form-input form-input--amount"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <input type="text" bind:value={category} required placeholder="Contoh: Makan" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <input type="text" bind:value={note} placeholder="Opsional" class="form-input" />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showModal = false}>Batal</button>
            <button type="submit" class="modal-submit">💾 Simpan</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .wallet-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: #F7F5FF;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .header {
    background: linear-gradient(145deg, #7B6EF6 0%, #9D8FF5 55%, #B8A9F5 100%);
    padding: 28px 22px 32px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }
  .blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.07); }
  .b1 { width: 150px; height: 150px; top: -40px; right: -40px; }
  .b2 { width: 90px; height: 90px; bottom: 0; left: -20px; }
  .header-inner { position: relative; z-index: 1; }
  .balance-label { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px; }
  .balance-amount { font-size: 30px; font-weight: 900; color: white; margin: 0 0 18px; }
  .balance-row { display: flex; gap: 10px; }
  .balance-chip {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255,255,255,0.15);
  }
  .chip-arrow { font-size: 18px; font-weight: 900; }
  .balance-chip--in .chip-arrow { color: #a3f0c4; }
  .balance-chip--out .chip-arrow { color: #f0a3a3; }
  .chip-label { font-size: 10px; color: rgba(255,255,255,0.65); margin: 0 0 2px; font-weight: 700; text-transform: uppercase; }
  .chip-val { font-size: 13px; font-weight: 800; color: white; margin: 0; }

  /* Tab bar */
  .tab-bar {
    display: flex;
    gap: 8px;
    padding: 14px 16px;
    background: white;
    border-bottom: 1.5px solid #EAE6FF;
    flex-shrink: 0;
    align-items: center;
  }
  .tab {
    flex: 1;
    padding: 9px 0;
    border-radius: 12px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    background: #F7F5FF;
    color: #aab4cc;
  }
  .tab--active { background: #7B6EF6; color: white; border-color: #7B6EF6; }
  .add-btn {
    padding: 9px 16px;
    background: #F0FDF4;
    color: #15803d;
    border: 2px solid #86efac;
    border-radius: 12px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }
  .add-btn:hover { background: #dcfce7; }

  /* Content */
  .content { flex: 1; overflow-y: auto; padding: 14px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 40px 0; }
  .spinner {
    width: 28px; height: 28px;
    border: 3px solid #EAE6FF;
    border-top-color: #7B6EF6;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Transactions */
  .list { display: flex; flex-direction: column; gap: 8px; }
  .tx-row {
    display: flex;
    align-items: center;
    background: white;
    border-radius: 18px;
    padding: 12px 14px;
    box-shadow: 0 3px 12px rgba(123,110,246,0.06);
  }
  .tx-icon { width: 40px; height: 40px; border-radius: 13px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; }
  .tx-icon--in { background: rgba(91,168,130,0.12); }
  .tx-icon--out { background: rgba(224,96,96,0.12); }
  .tx-info { flex: 1; min-width: 0; }
  .tx-cat { font-weight: 800; color: #2D2A5E; font-size: 13px; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-date { font-size: 11px; color: #aab4cc; margin: 0; }
  .tx-amount { font-weight: 900; font-size: 13px; flex-shrink: 0; }
  .tx-amount--in { color: #15803d; }
  .tx-amount--out { color: #dc2626; }

  /* Empty */
  .empty-state { background: white; border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 3px 12px rgba(123,110,246,0.06); color: #aab4cc; font-size: 13px; font-weight: 700; }
  .empty-link { color: #7B6EF6; font-weight: 800; background: none; border: none; font-family: 'Nunito', sans-serif; font-size: 13px; cursor: pointer; margin-top: 10px; display: block; }

  /* Stats */
  .stats-list { display: flex; flex-direction: column; gap: 14px; }
  .stat-card { background: white; border-radius: 22px; padding: 18px; box-shadow: 0 3px 14px rgba(123,110,246,0.07); }
  .stat-card-title { font-size: 14px; font-weight: 800; color: #2D2A5E; margin: 0 0 16px; }
  .stat-empty { font-size: 13px; color: #aab4cc; text-align: center; padding: 12px 0; margin: 0; }

  /* Bar Chart */
  .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 120px; gap: 6px; margin-bottom: 12px; }
  .bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; }
  .bars { display: flex; align-items: flex-end; gap: 2px; width: 100%; height: 108px; }
  .bar { flex: 1; border-radius: 5px 5px 0 0; transition: height 0.5s ease; min-height: 4px; }
  .bar--in { background: #5ba882; opacity: 0.75; }
  .bar--out { background: #E06070; opacity: 0.75; }
  .bar-label { font-size: 10px; color: #aab4cc; margin: 4px 0 0; font-weight: 700; }
  .bar-legend { display: flex; justify-content: center; gap: 18px; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #888; font-weight: 700; }
  .legend-dot { width: 10px; height: 10px; border-radius: 3px; }
  .legend-dot--in { background: #5ba882; }
  .legend-dot--out { background: #E06070; }

  /* Categories */
  .cat-list { display: flex; flex-direction: column; gap: 12px; }
  .cat-item {}
  .cat-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .cat-name { font-size: 13px; font-weight: 800; color: #2D2A5E; }
  .cat-val { font-size: 12px; color: #888; font-weight: 700; }
  .cat-track { height: 7px; background: #F3F1FF; border-radius: 99px; overflow: hidden; }
  .cat-fill { height: 100%; background: linear-gradient(90deg, #7B6EF6, #B8A9F5); border-radius: 99px; transition: width 0.5s ease; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(45,42,94,0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: white;
    border-radius: 28px 28px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 36px;
    animation: slide-up 0.25s ease;
  }
  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .modal-handle { width: 44px; height: 5px; background: #E0DBFF; border-radius: 99px; margin: 0 auto 18px; }
  .modal-title { font-size: 18px; font-weight: 900; color: #2D2A5E; margin: 0 0 18px; }

  /* Type Toggle */
  .type-toggle { display: flex; gap: 10px; margin-bottom: 18px; }
  .type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    border-radius: 16px;
    border: 2px solid #EAE6FF;
    background: #F7F5FF;
    color: #aab4cc;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }
  .type-btn--in { border-color: #86efac; background: #F0FDF4; color: #15803d; }
  .type-btn--out { border-color: #fca5a5; background: #FFF5F5; color: #dc2626; }

  /* Form */
  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .form-row { display: flex; gap: 12px; }
  .form-label { font-size: 11px; font-weight: 800; color: #aab4cc; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 12px 14px;
    border: 2px solid #EAE6FF;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    color: #2D2A5E;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #FAFAFF;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #7B6EF6; }
  .form-input--amount { font-size: 22px; font-weight: 900; }

  .modal-actions { display: flex; gap: 12px; margin-top: 4px; }
  .modal-cancel {
    flex: 1;
    padding: 14px;
    background: #F7F5FF;
    color: #aab4cc;
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
    background: linear-gradient(135deg, #7B6EF6, #9D8FF5);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(123,110,246,0.3);
  }
</style>
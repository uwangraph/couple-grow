<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { swipe } from '$lib/swipe';
  import { toast } from '$lib/toast.svelte';
  import { 
    FileText as NotesIcon, 
    TrendingUp as TrendingUpIcon,
    Inbox as EmptyIcon,
    TrendingDown as ExpenseIcon,
    ArrowUpCircle as IncomeIcon
  } from '@lucide/svelte';

  let transactions = $state<any[]>([]);
  let stats = $state<{ monthly: any[]; categories: any[] }>({ monthly: [], categories: [] });
  let loading = $state(true);
  let activeTab = $state<'history' | 'stats'>('history');

  // Add transaction modal
  let showModal = $state(false);
  let amount = $state('');
  let type = $state('expense');
  let category = $state('');
  let note = $state('');

  // Edit transaction modal
  let showEditModal = $state(false);
  let editingTx = $state<any>(null);
  let editAmount = $state('');
  let editType = $state('expense');
  let editCategory = $state('');
  let editNote = $state('');

  // Delete confirm
  let showDeleteConfirm = $state(false);
  let deletingTx = $state<any>(null);

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await Promise.all([fetchTransactions(), fetchStats()]);
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
      if (res.ok) transactions = data.transactions || [];
    } catch(e) {} finally { loading = false; }
  }

  async function fetchStats() {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/transactions/stats`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (res.ok) stats = data;
    } catch(e) {}
  }

  async function addTransaction(e: Event) {
    e.preventDefault();
    if (!auth.token) { goto('/login'); return; }
    try {
      const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(amount), type, category, note })
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error((await res.json()).error);
      showModal = false;
      amount = ''; category = ''; note = '';
      await Promise.all([fetchTransactions(), fetchStats()]);
      toast.success('Transaksi berhasil ditambahkan!');
    } catch(e: any) { toast.error(e.message || 'Gagal menambahkan transaksi'); }
  }

  function openEdit(tx: any) {
    editingTx = tx;
    editAmount = tx.amount.toString();
    editType = tx.type;
    editCategory = tx.category;
    editNote = tx.note || '';
    showEditModal = true;
  }

  function openDelete(tx: any) {
    deletingTx = tx;
    showDeleteConfirm = true;
  }

  async function updateTransaction(e: Event) {
    e.preventDefault();
    if (!editingTx) return;
    try {
      const res = await fetch(`${API_URL}/transactions/${editingTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({
          amount: parseInt(editAmount),
          type: editType,
          category: editCategory,
          note: editNote || null
        })
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal mengupdate transaksi');
      showEditModal = false;
      await Promise.all([fetchTransactions(), fetchStats()]);
      toast.success('Transaksi berhasil diupdate!');
    } catch(e: any) { toast.error(e.message || 'Gagal mengupdate transaksi'); }
  }

  async function deleteTransaction() {
    if (!deletingTx) return;
    try {
      const res = await fetch(`${API_URL}/transactions/${deletingTx.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal menghapus transaksi');
      showDeleteConfirm = false;
      await Promise.all([fetchTransactions(), fetchStats()]);
      toast.success('Transaksi berhasil dihapus!');
    } catch(e: any) { toast.error(e.message || 'Gagal menghapus transaksi'); }
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
    if (num >= 1_000_000) return `${(num/1_000_000).toFixed(1)}jt`;
    if (num >= 1_000) return `${(num/1_000).toFixed(0)}rb`;
    return `${num}`;
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
          <div class="chip-icon">
            <Icon name="income" size={18} />
          </div>
          <div>
            <p class="chip-label">Masuk</p>
            <p class="chip-val">{formatRp(totalIncome)}</p>
          </div>
        </div>
        <div class="balance-chip balance-chip--out">
          <div class="chip-icon">
            <Icon name="expense" size={18} />
          </div>
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
      style="display: flex; align-items: center; justify-content: center; gap: 6px;"
    >
      <NotesIcon size={16} /> Riwayat
    </button>
    <button
      class="tab {activeTab === 'stats' ? 'tab--active' : ''}"
      onclick={() => activeTab = 'stats'}
      style="display: flex; align-items: center; justify-content: center; gap: 6px;"
    >
      <TrendingUpIcon size={16} /> Statistik
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
            <EmptyIcon size={40} aria-hidden="true" style="opacity:0.4;margin-bottom:12px;" />
            <p>Belum ada transaksi</p>
            <button class="empty-link" onclick={() => showModal = true}>Catat sekarang →</button>
          </div>
        {/if}
        {#if transactions.length > 0}
          <p class="swipe-hint">← geser untuk hapus · geser untuk edit →</p>
        {/if}
        {#each transactions as t}
          {@const TransactionIcon = t.type === 'income' ? IncomeIcon : ExpenseIcon}
          <div class="tx-wrap">
            <!-- Swipe action backgrounds -->
            <div class="tx-action tx-action--delete" aria-hidden="true">
              <Icon name="trash" size={20} />
              <span>Hapus</span>
            </div>
            <div class="tx-action tx-action--edit" aria-hidden="true">
              <Icon name="edit" size={20} />
              <span>Edit</span>
            </div>
            <!-- The actual row -->
            <div
              class="tx-row"
              use:swipe={{
                onSwipeLeft: () => openDelete(t),
                onSwipeRight: () => openEdit(t),
                threshold: 72
              }}
            >
              <div class="tx-icon {t.type === 'income' ? 'tx-icon--in' : 'tx-icon--out'}">
                <TransactionIcon size={18} aria-hidden="true" />
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
          </div>
        {/each}
      </div>

    {:else}
      <!-- Stats -->
      <div class="stats-list">

        <!-- Bar Chart → Line Chart SVG -->
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon stat-card-icon--blue">
              <Icon name="income" size={18} />
            </div>
            <p class="stat-card-title">Grafik 6 Bulan Terakhir</p>
          </div>
          {#if stats.monthly.length === 0}
            <p class="stat-empty">Belum ada data statistik</p>
          {:else}
            {@const W = 320}
            {@const H = 140}
            {@const PAD = { t: 16, r: 12, b: 28, l: 44 }}
            {@const CW = W - PAD.l - PAD.r}
            {@const CH = H - PAD.t - PAD.b}
            {@const maxV = Math.max(...stats.monthly.flatMap(s => [s.total_income || 0, s.total_expense || 0]), 1)}
            {@const points = (key: string) => stats.monthly.map((s, i) => {
              const x = PAD.l + (i / Math.max(stats.monthly.length - 1, 1)) * CW;
              const y = PAD.t + CH - ((s[key] || 0) / maxV) * CH;
              return `${x},${y}`;
            })}
            {@const lineIn = points('total_income').join(' ')}
            {@const lineOut = points('total_expense').join(' ')}
            {@const areaIn = `${PAD.l},${PAD.t + CH} ` + points('total_income').join(' ') + ` ${PAD.l + CW},${PAD.t + CH}`}
            {@const areaOut = `${PAD.l},${PAD.t + CH} ` + points('total_expense').join(' ') + ` ${PAD.l + CW},${PAD.t + CH}`}
            {@const yTicks = [0, 0.25, 0.5, 0.75, 1]}

            <svg viewBox="0 0 {W} {H}" class="line-chart-svg" aria-label="Grafik 6 bulan terakhir">
              <defs>
                <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#22C55E" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#22C55E" stop-opacity="0"/>
                </linearGradient>
                <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#F43F5E" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#F43F5E" stop-opacity="0"/>
                </linearGradient>
              </defs>

              <!-- Grid lines + Y labels -->
              {#each yTicks as t}
                {@const y = PAD.t + CH - t * CH}
                <line x1={PAD.l} y1={y} x2={PAD.l + CW} y2={y} stroke="#E2E8F0" stroke-width="1"/>
                <text x={PAD.l - 4} y={y + 3.5} text-anchor="end" class="chart-axis-text">
                  {t === 0 ? '0' : formatCompact(t * maxV)}
                </text>
              {/each}

              <!-- Area fills -->
              <polygon points={areaIn} fill="url(#gradIn)"/>
              <polygon points={areaOut} fill="url(#gradOut)"/>

              <!-- Lines -->
              <polyline points={lineIn} fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points={lineOut} fill="none" stroke="#F43F5E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- Dots + X labels -->
              {#each stats.monthly as s, i}
                {@const x = PAD.l + (i / Math.max(stats.monthly.length - 1, 1)) * CW}
                {@const yIn = PAD.t + CH - ((s.total_income || 0) / maxV) * CH}
                {@const yOut = PAD.t + CH - ((s.total_expense || 0) / maxV) * CH}

                <!-- income dot -->
                <circle cx={x} cy={yIn} r="4" fill="white" stroke="#22C55E" stroke-width="2.5"/>
                <!-- expense dot -->
                <circle cx={x} cy={yOut} r="4" fill="white" stroke="#F43F5E" stroke-width="2.5"/>

                <!-- X label -->
                <text x={x} y={H - 6} text-anchor="middle" class="chart-axis-text">
                  {shortMonth(s.month)}
                </text>
              {/each}
            </svg>

            <div class="chart-legend">
              <div class="chart-legend-item">
                <span class="chart-legend-dot" style="background:#22C55E"></span>
                <span>Masuk</span>
              </div>
              <div class="chart-legend-item">
                <span class="chart-legend-dot" style="background:#F43F5E"></span>
                <span>Keluar</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Categories → Donut Chart SVG -->
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-icon stat-card-icon--rose">
              <Icon name="expense" size={18} />
            </div>
            <p class="stat-card-title">Pengeluaran Terbesar Bulan Ini</p>
          </div>
          {#if stats.categories.length === 0}
            <p class="stat-empty">Belum ada pengeluaran bulan ini</p>
          {:else}
            {@const maxCat = Math.max(...stats.categories.map(c => c.total), 1)}
            {@const totalCat = stats.categories.reduce((sum, c) => sum + c.total, 0)}
            {@const COLORS = ['#3B82F6','#F43F5E','#22C55E','#F59E0B','#A855F7','#0EA5E9','#EC4899','#14B8A6']}
            {@const top5 = stats.categories.slice(0, 5)}

            <!-- Donut chart -->
            <div class="donut-wrap">
              <svg viewBox="0 0 120 120" class="donut-svg" aria-label="Donut chart pengeluaran">
                <defs>
                  {#each top5 as cat, i}
                    <linearGradient id="dg{i}" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color={COLORS[i]} stop-opacity="1"/>
                      <stop offset="100%" stop-color={COLORS[i]} stop-opacity="0.7"/>
                    </linearGradient>
                  {/each}
                </defs>
                {#each top5 as cat, i}
                  {@const pct = cat.total / totalCat}
                  {@const prev = top5.slice(0, i).reduce((s, c) => s + c.total / totalCat, 0)}
                  {@const startAngle = prev * 2 * Math.PI - Math.PI / 2}
                  {@const endAngle = (prev + pct) * 2 * Math.PI - Math.PI / 2}
                  {@const R = 48}
                  {@const r = 30}
                  {@const x1 = 60 + R * Math.cos(startAngle)}
                  {@const y1 = 60 + R * Math.sin(startAngle)}
                  {@const x2 = 60 + R * Math.cos(endAngle)}
                  {@const y2 = 60 + R * Math.sin(endAngle)}
                  {@const ix1 = 60 + r * Math.cos(startAngle)}
                  {@const iy1 = 60 + r * Math.sin(startAngle)}
                  {@const ix2 = 60 + r * Math.cos(endAngle)}
                  {@const iy2 = 60 + r * Math.sin(endAngle)}
                  {@const large = pct > 0.5 ? 1 : 0}
                  <path
                    d="M {x1} {y1} A {R} {R} 0 {large} 1 {x2} {y2} L {ix2} {iy2} A {r} {r} 0 {large} 0 {ix1} {iy1} Z"
                    fill="url(#dg{i})"
                    stroke="white"
                    stroke-width="2"
                  />
                {/each}
                <!-- Center text -->
                <text x="60" y="56" text-anchor="middle" class="donut-center-label">Total</text>
                <text x="60" y="70" text-anchor="middle" class="donut-center-value">{formatCompact(totalCat)}</text>
              </svg>
            </div>

            <!-- Category list -->
            <div class="cat-list">
              {#each top5 as cat, i}
                {@const pct = Math.round((cat.total / totalCat) * 100)}
                <div class="cat-item">
                  <div class="cat-row">
                    <span class="cat-dot" style="background:{COLORS[i]}"></span>
                    <span class="cat-name">{cat.category}</span>
                    <div class="cat-right">
                      <span class="cat-pct">{pct}%</span>
                      <span class="cat-val">{formatRp(cat.total)}</span>
                    </div>
                  </div>
                  <div class="cat-track">
                    <div class="cat-fill" style="width:{(cat.total / maxCat) * 100}%; background:{COLORS[i]}"></div>
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
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="wallet" size={22} />
          </div>
          <div>
            <h3 class="modal-title">Catat Transaksi</h3>
            <p class="modal-subtitle">Masukkan detail transaksi</p>
          </div>
        </div>

        <!-- Type toggle -->
        <div class="type-toggle">
          <button
            class="type-btn {type === 'expense' ? 'type-btn--out' : ''}"
            onclick={() => type = 'expense'}
          >
            <ExpenseIcon size={16} aria-hidden="true" />
            Pengeluaran
          </button>
          <button
            class="type-btn {type === 'income' ? 'type-btn--in' : ''}"
            onclick={() => type = 'income'}
          >
            <IncomeIcon size={16} aria-hidden="true" />
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
            <button type="submit" class="modal-submit">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal Edit Transaksi -->
  {#if showEditModal && editingTx}
    <div class="modal-overlay" role="dialog" aria-modal="true" onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle" style="background:#F0FDF4;color:#22C55E;">
            <Icon name="edit" size={22} />
          </div>
          <div>
            <h3 class="modal-title">Edit Transaksi</h3>
            <p class="modal-subtitle">{editingTx.category}</p>
          </div>
        </div>
        <form onsubmit={updateTransaction} class="modal-form">
          <!-- Type toggle -->
          <div class="type-toggle">
            <button type="button" class="type-btn {editType === 'expense' ? 'type-btn--out' : ''}" onclick={() => editType = 'expense'}>
              Pengeluaran
            </button>
            <button type="button" class="type-btn {editType === 'income' ? 'type-btn--in' : ''}" onclick={() => editType = 'income'}>
              Pemasukan
            </button>
          </div>
          <label class="modal-label" for="edit-amount">Nominal (Rp)</label>
          <input id="edit-amount" type="number" bind:value={editAmount} required placeholder="0" class="modal-input modal-input--amount" />
          <label class="modal-label" for="edit-category">Kategori</label>
          <input id="edit-category" type="text" bind:value={editCategory} required placeholder="Makan, Transportasi..." class="modal-input" />
          <label class="modal-label" for="edit-note">Catatan (opsional)</label>
          <input id="edit-note" type="text" bind:value={editNote} placeholder="Tambahkan catatan..." class="modal-input" />
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showEditModal = false}>Batal</button>
            <button type="submit" class="modal-submit modal-submit--green">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Konfirmasi Hapus -->
  {#if showDeleteConfirm && deletingTx}
    <div class="modal-overlay" role="dialog" aria-modal="true" onclick={(e) => { if (e.target === e.currentTarget) showDeleteConfirm = false; }}>
      <div class="modal" style="text-align:center;">
        <div class="modal-handle"></div>
        <div class="delete-icon">
          <Icon name="trash" size={30} />
        </div>
        <h3 class="delete-title">Hapus Transaksi?</h3>
        <p class="delete-msg">
          <strong>{deletingTx.category}</strong> sebesar
          <strong>{formatRp(deletingTx.amount)}</strong> akan dihapus permanen.
        </p>
        <div class="modal-actions">
          <button class="modal-cancel" onclick={() => showDeleteConfirm = false}>Batal</button>
          <button class="modal-submit modal-submit--red" onclick={deleteTransaction}>Hapus</button>
        </div>
      </div>
    </div>
  {/if}

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .wallet-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .header {
    background: linear-gradient(145deg, #3B82F6 0%, #2563EB 50%, #0EA5E9 100%);
    padding: 28px 22px 32px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }
  .blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.08); }
  .b1 { width: 150px; height: 150px; top: -40px; right: -40px; }
  .b2 { width: 90px; height: 90px; bottom: 0; left: -20px; }
  .header-inner { position: relative; z-index: 1; }
  .balance-label { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px; }
  .balance-amount { font-size: 30px; font-weight: 900; color: white; margin: 0 0 18px; }
  .balance-row { display: flex; gap: 10px; }
  .balance-chip {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 20px;

    /* Liquid Glass */
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      inset 0 -1px 0 rgba(0, 0, 0, 0.06);
    transition: all 0.2s;
  }
  .balance-chip:active {
    background: rgba(255, 255, 255, 0.18);
    transform: scale(0.98);
  }

  .chip-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .balance-chip--in .chip-icon {
    background: rgba(134, 239, 172, 0.2);
    color: #86EFAC;
  }
  .balance-chip--out .chip-icon {
    background: rgba(253, 164, 175, 0.2);
    color: #FDA4AF;
  }
  .chip-label { font-size: 10px; color: rgba(255,255,255,0.6); margin: 0 0 3px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
  .chip-val { font-size: 16px; font-weight: 900; color: white; margin: 0; }

  /* Tab bar */
  .tab-bar {
    display: flex;
    gap: 8px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.5);
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
    background: rgba(255, 255, 255, 0.4);
    color: #64748B;
  }
  .tab--active { background: #3B82F6; color: white; border-color: #3B82F6; }
  .add-btn {
    padding: 9px 16px;
    background: #F0FDF4;
    color: #15803D;
    border: 2px solid #86EFAC;
    border-radius: 12px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }
  .add-btn:hover { background: #DCFCE7; }

  /* Content */
  .content { flex: 1; overflow-y: auto; padding: 14px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 40px 0; }
  .spinner {
    width: 28px; height: 28px;
    border: 3px solid #E0E7FF;
    border-top-color: #3B82F6;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Transactions */
  .list { display: flex; flex-direction: column; gap: 8px; }

  /* Swipe hint */
  .swipe-hint {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: #CBD5E1;
    margin: 0 0 10px;
    letter-spacing: 0.02em;
    animation: hint-fade 0.4s ease 1.5s both, hint-out 0.4s ease 30s both;
  }

  @keyframes hint-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes hint-out {
    to { opacity: 0; height: 0; margin: 0; overflow: hidden; }
  }

  /* Swipe wrapper */
  .tx-wrap {
    position: relative;
    border-radius: 18px;
    overflow: hidden;
  }

  /* Action reveal backgrounds - hidden by default */
  .tx-action {
    position: absolute;
    top: 0; bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 80px;
    font-size: 11px;
    font-weight: 900;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .tx-action--delete {
    right: 0;
    background: linear-gradient(135deg, #F43F5E, #E11D48);
    color: white;
    border-radius: 0 18px 18px 0;
  }
  .tx-action--edit {
    left: 0;
    background: linear-gradient(135deg, #22C55E, #16A34A);
    color: white;
    border-radius: 18px 0 0 18px;
  }

  .tx-row {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 18px;
    padding: 12px 14px;
    box-shadow: 0 3px 12px rgba(59,130,246,0.06);
  }
  .tx-icon { width: 40px; height: 40px; border-radius: 13px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; }
  .tx-icon--in { background: rgba(34,197,94,0.12); }
  .tx-icon--out { background: rgba(244,63,94,0.12); }
  .tx-info { flex: 1; min-width: 0; }
  .tx-cat { font-weight: 800; color: #1E293B; font-size: 13px; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-date { font-size: 11px; color: #94A3B8; margin: 0; }
  .tx-amount { font-weight: 900; font-size: 13px; flex-shrink: 0; }
  .tx-amount--in { color: #15803D; }
  .tx-amount--out { color: #BE123C; }

  /* Empty */
  .empty-state { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 3px 12px rgba(59,130,246,0.06); color: #94A3B8; font-size: 13px; font-weight: 700; }
  .empty-link { color: #3B82F6; font-weight: 800; background: none; border: none; font-family: 'Nunito', sans-serif; font-size: 13px; cursor: pointer; margin-top: 10px; display: block; }

  /* Stats */
  .stats-list { display: flex; flex-direction: column; gap: 14px; }
  .stat-card { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 22px; padding: 18px; box-shadow: 0 3px 14px rgba(59,130,246,0.07); }
  .stat-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .stat-card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stat-card-icon--blue { background: #EFF6FF; color: #3B82F6; }
  .stat-card-icon--rose { background: #FFF1F2; color: #F43F5E; }
  .stat-card-title { font-size: 14px; font-weight: 900; color: #1E293B; margin: 0; }
  .stat-empty { font-size: 13px; color: #94A3B8; text-align: center; padding: 12px 0; margin: 0; }

  /* Line Chart SVG */
  .line-chart-svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
  :global(.chart-axis-text) {
    font-size: 9px;
    fill: #94A3B8;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
  }
  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding-top: 12px;
    border-top: 1px solid #F1F5F9;
    margin-top: 8px;
  }
  .chart-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748B;
    font-weight: 700;
  }
  .chart-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  /* Donut Chart */
  .donut-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }
  .donut-svg {
    width: 150px;
    height: 150px;
    filter: drop-shadow(0 4px 16px rgba(0,0,0,0.1));
  }
  :global(.donut-center-label) {
    font-size: 10px;
    fill: #94A3B8;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
  }
  :global(.donut-center-value) {
    font-size: 14px;
    fill: #1E293B;
    font-family: 'Nunito', sans-serif;
    font-weight: 900;
  }

  /* Categories */
  .cat-list { display: flex; flex-direction: column; gap: 12px; }
  .cat-item {}
  .cat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .cat-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .cat-name { font-size: 13px; font-weight: 800; color: #1E293B; flex: 1; }
  .cat-right { display: flex; align-items: center; gap: 8px; }
  .cat-pct { font-size: 11px; font-weight: 900; color: #3B82F6; background: #EFF6FF; padding: 2px 7px; border-radius: 6px; }
  .cat-val { font-size: 12px; color: #64748B; font-weight: 700; }
  .cat-track { height: 6px; background: #F1F5F9; border-radius: 99px; overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 99px; transition: width 0.7s cubic-bezier(.34,1.56,.64,1); opacity: 0.85; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(30,41,59,0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255,255,255,0.8);
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
  .modal-handle { width: 44px; height: 5px; background: #E0E7FF; border-radius: 99px; margin: 0 auto 18px; }
  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
  .modal-icon-circle {
    width: 48px; height: 48px; border-radius: 14px;
    background: #EFF6FF; color: #3B82F6;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .modal-title { font-size: 17px; font-weight: 900; color: #1E293B; margin: 0 0 2px; }
  .modal-subtitle { font-size: 12px; color: #94A3B8; font-weight: 700; margin: 0; }

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
    border: 2px solid #E0E7FF;
    background: #F0F4FF;
    color: #94A3B8;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }
  .type-btn--in { border-color: #86EFAC; background: #F0FDF4; color: #15803D; }
  .type-btn--out { border-color: #FDA4AF; background: #FFF1F2; color: #BE123C; }

  /* Form */
  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .form-row { display: flex; gap: 12px; }
  .form-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 12px 14px;
    border: 2px solid #E0E7FF;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    color: #1E293B;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #F8FAFC;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #3B82F6; }
  .form-input--amount { font-size: 22px; font-weight: 900; }

  .modal-actions { display: flex; gap: 12px; margin-top: 4px; }
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
    background: linear-gradient(135deg, #3B82F6, #2563EB);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(59,130,246,0.3);
    transition: transform 0.12s;
  }
  .modal-submit:active { transform: scale(0.97); }
  .modal-submit--green {
    background: linear-gradient(135deg, #22C55E, #16A34A);
    box-shadow: 0 6px 20px rgba(34,197,94,0.3);
  }
  .modal-submit--red {
    background: linear-gradient(135deg, #F43F5E, #E11D48);
    box-shadow: 0 6px 20px rgba(244,63,94,0.3);
  }
  .modal-form { display: flex; flex-direction: column; gap: 12px; }
  .modal-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .modal-input {
    padding: 12px 16px;
    border: 2px solid #E0E7FF;
    border-radius: 14px;
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
  .modal-input:focus { border-color: #3B82F6; }
  .modal-input--amount { font-size: 24px; font-weight: 900; }

  /* Delete confirm */
  .delete-icon {
    width: 58px; height: 58px; border-radius: 50%;
    background: #FFF1F2; color: #F43F5E;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 12px;
  }
  .delete-title { font-size: 18px; font-weight: 900; color: #1E293B; margin: 0 0 8px; }
  .delete-msg { font-size: 13px; color: #64748B; line-height: 1.5; margin: 0 0 20px; font-weight: 600; }
  .delete-msg strong { color: #1E293B; font-weight: 900; }
</style>

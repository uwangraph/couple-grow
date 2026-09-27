<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { swipe } from '$lib/swipe';
  import { toast } from '$lib/toast.svelte';

  let savings = $state<any[]>([]);
  let loading = $state(true);
  let loadError = $state('');

  let showModal = $state(false);
  let name = $state('');
  let targetAmount = $state('');

  let showTopupModal = $state(false);
  let selectedSaving = $state<any>(null);
  let topupAmount = $state('');

  let showDeductModal = $state(false);
  let selectedDeductSaving = $state<any>(null);
  let deductAmount = $state('');
  let deductNote = $state('');

  let showEditModal = $state(false);
  let selectedEditSaving = $state<any>(null);
  let editName = $state('');
  let editTargetAmount = $state('');
  let editDeadline = $state('');

  let showDeleteConfirm = $state(false);
  let selectedDeleteSaving = $state<any>(null);

  // History & Contribution tracking
  let showHistoryModal = $state(false);
  let selectedHistorySaving = $state<any>(null);
  let activities = $state<any[]>([]);
  let contributions = $state<any[]>([]);
  let loadingHistory = $state(false);

  function milestoneFromMetadata(value: unknown) {
    try {
      const metadata = typeof value === 'string' ? JSON.parse(value) : value;
      const percentage = Number(metadata?.percentage);
      return Number.isFinite(percentage) && percentage > 0 ? percentage : null;
    } catch { return null; }
  }

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await fetchSavings();
  });

  function handleUnauthorized() {
    auth.logout();
    goto('/login');
  }

  async function fetchSavings() {
    if (!auth.token) return;
    loadError = '';
    try {
      const res = await fetch(`${API_URL}/savings`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await readApiJson<{ savings?: any[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal memuat tabungan');
      savings = data.savings || [];
    } catch(e) { loadError = e instanceof Error ? e.message : 'Tabungan belum bisa dimuat.'; }
    finally { loading = false; }
  }

  async function createSaving(e: Event) {
    e.preventDefault();
    if (!auth.token) { goto('/login'); return; }
    try {
      const res = await fetch(`${API_URL}/savings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ name, target_amount: parseInt(targetAmount) })
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Gagal membuat mimpi/tabungan baru');
      showModal = false; name = ''; targetAmount = '';
      await fetchSavings();
      toast.success('Mimpi baru berhasil ditambahkan!');
    } catch(e: any) { toast.error(e.message || 'Gagal menambahkan mimpi'); }
  }

  async function topupSaving(e: Event) {
    e.preventDefault();
    if (!selectedSaving) return;
    try {
      const resTopup = await fetch(`${API_URL}/savings/${selectedSaving.id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(topupAmount) })
      });
      
      if (!resTopup.ok) throw new Error('Gagal melakukan top up tabungan');
      
      const topupData = await readApiJson<{ milestone?: number; error?: string }>(resTopup);

      const transactionRes = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(topupAmount), type: 'expense', category: 'Tabungan', note: 'Top up ' + selectedSaving.name })
      });
      if (!transactionRes.ok) throw new Error('Tabungan sudah bertambah, tetapi transaksi dompet gagal dibuat');
      showTopupModal = false; topupAmount = '';
      await fetchSavings();
      
      // Check for milestone celebration
      if (topupData.milestone) {
        showMilestoneCelebration(topupData.milestone, selectedSaving.name);
      } else {
        toast.success('Top up tabungan berhasil!');
      }
    } catch(e: any) { toast.error(e.message || 'Gagal melakukan top up'); }
  }

  // Milestone celebration state
  let showMilestone = $state(false);
  let milestonePercent = $state(0);
  let milestoneSavingName = $state('');

  function showMilestoneCelebration(percent: number, savingName: string) {
    milestonePercent = percent;
    milestoneSavingName = savingName;
    showMilestone = true;
    
    // Auto close after 5 seconds
    setTimeout(() => {
      showMilestone = false;
    }, 5000);
  }

  function openTopup(s: any) { selectedSaving = s; showTopupModal = true; }
  function openDeduct(s: any) { selectedDeductSaving = s; deductAmount = ''; deductNote = ''; showDeductModal = true; }
  function openEdit(s: any) {
    selectedEditSaving = s;
    editName = s.name;
    editTargetAmount = s.target_amount.toString();
    editDeadline = s.deadline || '';
    showEditModal = true;
  }
  function openDelete(s: any) { selectedDeleteSaving = s; showDeleteConfirm = true; }
  
  async function openHistory(s: any) {
    selectedHistorySaving = s;
    showHistoryModal = true;
    loadingHistory = true;
    
    try {
      // Fetch activities
      const resAct = await fetch(`${API_URL}/savings/${s.id}/activities`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (resAct.ok) {
        const dataAct = await readApiJson<{ activities?: any[] }>(resAct);
        activities = dataAct.activities || [];
      }
      
      // Fetch contributions
      const resCont = await fetch(`${API_URL}/savings/${s.id}/contributions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (resCont.ok) {
        const dataCont = await readApiJson<{ contributions?: any[] }>(resCont);
        contributions = dataCont.contributions || [];
      }
    } catch(e) {
      console.error('Failed to fetch history:', e);
    } finally {
      loadingHistory = false;
    }
  }
  
  function goToSavingChat(s: any) { goto(`/chat?saving_id=${s.id}&saving_name=${encodeURIComponent(s.name)}`); }

  async function deductSaving(e: Event) {
    e.preventDefault();
    if (!selectedDeductSaving) return;
    const amount = parseInt(deductAmount);
    if (amount <= 0) { toast.error('Nominal harus lebih dari 0'); return; }
    if (amount > selectedDeductSaving.current_amount) {
      toast.error('Nominal melebihi saldo tabungan yang tersedia');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/savings/${selectedDeductSaving.id}/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount })
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengurangi tabungan');

      // Catat ke dompet sebagai pemasukan (uang balik ke dompet)
      const transactionRes = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({
          amount,
          type: 'income',
          category: 'Tabungan',
          note: deductNote || `Tarik tabungan ${selectedDeductSaving.name}`
        })
      });
      if (!transactionRes.ok) throw new Error('Tabungan sudah berkurang, tetapi transaksi dompet gagal dibuat');

      showDeductModal = false; deductAmount = ''; deductNote = '';
      await fetchSavings();
      toast.success('Berhasil tarik uang dari tabungan!');
    } catch(e: any) { toast.error(e.message || 'Gagal mengurangi tabungan'); }
  }

  async function editSaving(e: Event) {
    e.preventDefault();
    if (!selectedEditSaving) return;
    try {
      const res = await fetch(`${API_URL}/savings/${selectedEditSaving.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({
          name: editName,
          target_amount: parseInt(editTargetAmount),
          deadline: editDeadline || null
        })
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengupdate tabungan');

      showEditModal = false;
      await fetchSavings();
      toast.success('Tabungan berhasil diupdate!');
    } catch(e: any) { toast.error(e.message || 'Gagal mengupdate tabungan'); }
  }

  async function deleteSaving() {
    if (!selectedDeleteSaving) return;
    try {
      const res = await fetch(`${API_URL}/savings/${selectedDeleteSaving.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus tabungan');

      showDeleteConfirm = false;
      await fetchSavings();
      toast.success('Tabungan berhasil dihapus!');
    } catch(e: any) { toast.error(e.message || 'Gagal menghapus tabungan'); }
  }

  function formatRp(num: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }
  function formatCompact(num: number) {
    if (num >= 1000000) return `${(num/1000000).toFixed(1)}jt`;
    if (num >= 1000) return `${(num/1000).toFixed(0)}rb`;
    return `${num}`;
  }
  function pct(current: number, target: number) {
    return target > 0 ? Math.max(0, Math.min(Math.floor((current / target) * 100), 100)) : 0;
  }

  let totalSaved = $derived(savings.reduce((a, s) => a + s.current_amount, 0));
  let totalTarget = $derived(savings.reduce((a, s) => a + s.target_amount, 0));
  let overallPct = $derived(totalTarget > 0 ? Math.min(Math.floor((totalSaved / totalTarget) * 100), 100) : 0);
</script>

<div class="savings-root">

  <!-- Header -->
  <div class="header">
    <div class="header-inner">
        <div class="header-top">
        <div>
          <p class="header-sub">Target Bersama</p>
          <h1 class="header-title">
            Tabungan <Icon name="wallet" size={24} />
          </h1>
          <p class="header-description">Setiap langkah kecil membawa kalian lebih dekat ke tujuan.</p>
        </div>
        <button class="create-btn" onclick={() => showModal = true}>
          + Buat Target
        </button>
      </div>

      <!-- Overall Summary Card -->
      {#if !loading && !loadError && savings.length > 0}
        <div class="summary-card">
          <div class="summary-row">
            <div>
              <p class="summary-label">Total Terkumpul</p>
              <p class="summary-amount">Rp {formatCompact(totalSaved)}</p>
            </div>
            <div style="text-align:right;">
              <p class="summary-label">Dari Total Target</p>
              <p class="summary-amount">Rp {formatCompact(totalTarget)}</p>
            </div>
          </div>
          <div class="summary-track">
            <div class="summary-fill" style="width:{overallPct}%"></div>
          </div>
          <div class="summary-meta">
            <span>{savings.length} target bersama</span>
            <span class="summary-pct">{overallPct}% tercapai</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    {#if loading}
      <div class="savings-list" aria-label="Memuat target tabungan">
        {#each [1, 2] as _}
          <div class="saving-skeleton">
            <div class="saving-skeleton-icon"></div>
            <div class="saving-skeleton-copy"><div></div><div></div></div>
            <div class="saving-skeleton-track"></div>
          </div>
        {/each}
      </div>

    {:else if loadError}
      <div class="empty-state" role="alert">
        <div class="empty-icon"><Icon name="savings" size={36} /></div>
        <p class="empty-title">Tabungan belum bisa dimuat</p>
        <p class="empty-sub">{loadError}</p>
        <button type="button" class="empty-cta" onclick={fetchSavings}>Coba lagi</button>
      </div>

    {:else if savings.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="savings" size={36} />
        </div>
        <p class="empty-title">Belum ada target tabungan</p>
        <p class="empty-sub">Liburan, rumah, atau hal kecil yang kalian tunggu—mulai dengan satu tujuan.</p>
        <button class="empty-cta" onclick={() => showModal = true}>Buat target pertama</button>
      </div>

    {:else}
      <div class="savings-list">
        {#each savings as s}
          {@const percent = pct(s.current_amount, s.target_amount)}
          {@const remaining = Math.max(0, s.target_amount - s.current_amount)}
          {@const isDone = percent >= 100}

          <a href="/savings/{s.id}"
            class="saving-card {isDone ? 'saving-card--done' : ''}"
            aria-label="Lihat tabungan {s.name}, {percent}% tercapai"
          >
            <!-- Card Header -->
            <div class="saving-header">
              <div class="saving-emoji-wrap {isDone ? 'saving-emoji-wrap--done' : ''}">
                <div class="saving-emoji">
                  <Icon name={isDone ? 'success' : 'savings'} size={24} />
                </div>
              </div>
              <div class="saving-meta" style="flex:1;">
                <h3 class="saving-name">{s.name}</h3>
                {#if s.deadline}
                  <p class="saving-deadline" style="display: flex; align-items: center; gap: 5px;">
                    <Icon name="calendar" size={12} />
                    {new Date(s.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                {/if}
                {#if s.creator_name}
                  <p class="saving-creator">Ditambahkan oleh {s.creator_name}</p>
                {/if}
              </div>
              <div class="saving-pct-badge {isDone ? 'saving-pct-badge--done' : ''}">
                {percent}%
              </div>
            </div>

            <!-- Progress -->
            <div class="saving-progress">
              <div class="progress-track">
                <div
                  class="progress-fill {isDone ? 'progress-fill--done' : ''}"
                  style="width:{percent}%"
                ></div>
              </div>
            </div>

            <!-- Amounts -->
            <div class="saving-amounts">
              <div class="amount-item">
                <p class="amount-label">Terkumpul</p>
                <p class="amount-val amount-val--collected">{formatRp(s.current_amount)}</p>
              </div>
              {#if !isDone}
                <div class="amount-item" style="text-align:right;">
                  <p class="amount-label">Kurang lagi</p>
                  <p class="amount-val amount-val--remaining">{formatRp(remaining)}</p>
                </div>
              {:else}
                <div class="amount-item" style="text-align:right;">
                  <p class="amount-label">Target</p>
                  <p class="amount-val">{formatRp(s.target_amount)}</p>
                </div>
              {/if}
            </div>

            <!-- Completed banner -->
            {#if isDone}
              <div class="done-banner">
                Target tercapai! Selamat!
              </div>
            {/if}
          </a>
        {/each}
      </div>
    {/if}

    <div style="height:32px;"></div>
  </div>

  <!-- Modal Buat Tabungan -->
  {#if showModal}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Buat target tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showModal = false; }} onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="wallet" size={24} />
          </div>
          <div>
            <h3 class="modal-title">Buat Target Tabungan</h3>
            <p class="modal-subtitle">Tentukan impian & nominalnya</p>
          </div>
        </div>
        <form class="modal-form" onsubmit={createSaving}>
          <div class="form-group">
            <label class="form-label" for="saving-name">Nama Target</label>
            <input
              id="saving-name"
              type="text"
              bind:value={name}
              required
              placeholder="Contoh: Liburan Bali"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="saving-target">Target Nominal (Rp)</label>
            <input
              id="saving-target"
              type="number"
              min="1"
              bind:value={targetAmount}
              required
              placeholder="0"
              class="form-input form-input--amount"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showModal = false}>Batal</button>
            <button type="submit" class="modal-submit">Buat Target</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal Topup -->
  {#if showTopupModal && selectedSaving}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Top up tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showTopupModal = false; }} onclick={(e) => { if (e.target === e.currentTarget) showTopupModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle modal-icon-circle--green">
            <Icon name="income" size={24} />
          </div>
          <div>
            <h3 class="modal-title">Top Up Tabungan</h3>
            <p class="modal-subtitle">{selectedSaving.name}</p>
          </div>
        </div>

        <!-- Progress mini di modal -->
        <div class="topup-progress">
          <div class="topup-progress-row">
            <span class="topup-label">Terkumpul</span>
            <span class="topup-label">{pct(selectedSaving.current_amount, selectedSaving.target_amount)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:{pct(selectedSaving.current_amount, selectedSaving.target_amount)}%"></div>
          </div>
          <div class="topup-progress-row">
            <span class="topup-amount-text">{formatRp(selectedSaving.current_amount)}</span>
            <span class="topup-label">Target: {formatRp(selectedSaving.target_amount)}</span>
          </div>
        </div>

        <form class="modal-form" onsubmit={topupSaving}>
          <div class="form-group">
            <label class="form-label" for="saving-topup">Nominal Top Up (Rp)</label>
            <input
              id="saving-topup"
              type="number"
              min="1"
              bind:value={topupAmount}
              required
              placeholder="0"
              class="form-input form-input--amount form-input--green"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showTopupModal = false}>Batal</button>
            <button type="submit" class="modal-submit modal-submit--green">Top Up</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal Deduct/Tarik -->
  {#if showDeductModal && selectedDeductSaving}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Tarik tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showDeductModal = false; }} onclick={(e) => { if (e.target === e.currentTarget) showDeductModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle modal-icon-circle--red">
            <Icon name="expense" size={24} />
          </div>
          <div>
            <h3 class="modal-title">Tarik Tabungan</h3>
            <p class="modal-subtitle">{selectedDeductSaving.name}</p>
          </div>
        </div>

        <!-- Progress mini di modal -->
        <div class="deduct-progress">
          <div class="topup-progress-row">
            <span class="topup-label">Tersedia</span>
            <span class="topup-amount-text">{formatRp(selectedDeductSaving.current_amount)}</span>
          </div>
        </div>

        <form class="modal-form" onsubmit={deductSaving}>
          <div class="form-group">
            <label class="form-label" for="saving-deduct">Nominal Tarik (Rp)</label>
            <input
              id="saving-deduct"
              type="number"
              min="1"
              bind:value={deductAmount}
              required
              placeholder="0"
              max={selectedDeductSaving.current_amount}
              class="form-input form-input--amount form-input--red"
            />
            <p class="deduct-hint">Maksimal: {formatRp(selectedDeductSaving.current_amount)}</p>
          </div>
          <div class="form-group">
            <label class="form-label" for="saving-deduct-note">Catatan (opsional)</label>
            <input
              id="saving-deduct-note"
              type="text"
              bind:value={deductNote}
              placeholder="Contoh: Pinjam dulu untuk bayar..."
              class="form-input"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showDeductModal = false}>Batal</button>
            <button type="submit" class="modal-submit modal-submit--red">Tarik</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal Edit -->
  {#if showEditModal && selectedEditSaving}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showEditModal = false; }} onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="edit" size={24} />
          </div>
          <div>
            <h3 class="modal-title">Edit Tabungan</h3>
            <p class="modal-subtitle">{selectedEditSaving.name}</p>
          </div>
        </div>
        <form class="modal-form" onsubmit={editSaving}>
          <div class="form-group">
            <label class="form-label" for="saving-edit-name">Nama Target</label>
            <input
              id="saving-edit-name"
              type="text"
              bind:value={editName}
              required
              placeholder="Contoh: Liburan Bali"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="saving-edit-target">Target Nominal (Rp)</label>
            <input
              id="saving-edit-target"
              type="number"
              min="1"
              bind:value={editTargetAmount}
              required
              placeholder="0"
              class="form-input form-input--amount"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="saving-edit-deadline">Deadline (opsional)</label>
            <input
              id="saving-edit-deadline"
              type="date"
              bind:value={editDeadline}
              class="form-input"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showEditModal = false}>Batal</button>
            <button type="submit" class="modal-submit">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Konfirmasi Hapus -->
  {#if showDeleteConfirm && selectedDeleteSaving}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Konfirmasi hapus tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showDeleteConfirm = false; }} onclick={(e) => { if (e.target === e.currentTarget) showDeleteConfirm = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="delete-confirm-icon">
          <Icon name="trash" size={32} />
        </div>
        <h3 class="delete-confirm-title">Hapus Tabungan?</h3>
        <p class="delete-confirm-msg">
          Tabungan <strong>"{selectedDeleteSaving.name}"</strong> dengan saldo
          <strong>{formatRp(selectedDeleteSaving.current_amount)}</strong> akan dihapus permanen.
          Aksi ini tidak bisa dibatalkan.
        </p>
        <div class="modal-actions">
          <button type="button" class="modal-cancel" onclick={() => showDeleteConfirm = false}>Batal</button>
          <button type="button" class="modal-submit modal-submit--red" onclick={deleteSaving}>Hapus</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal History & Contributions -->
  {#if showHistoryModal && selectedHistorySaving}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Riwayat tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showHistoryModal = false; }} onclick={(e) => { if (e.target === e.currentTarget) showHistoryModal = false; }}>
      <div class="modal modal--large">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="history" size={24} />
          </div>
          <div>
            <h3 class="modal-title">Riwayat Tabungan</h3>
            <p class="modal-subtitle">{selectedHistorySaving.name}</p>
          </div>
        </div>

        {#if loadingHistory}
          <div class="history-loading">
            <div class="spinner"></div>
          </div>
        {:else}
          <!-- Contributions Section -->
          {#if contributions.length > 0}
            <div class="history-section">
              <h4 class="history-section-title">Kontribusi</h4>
              <div class="contributions-grid">
                {#each contributions as contrib}
                  {@const totalContrib = contributions.reduce((sum, c) => sum + c.net_contribution, 0)}
                  {@const percentage = totalContrib > 0 ? Math.round((contrib.net_contribution / totalContrib) * 100) : 0}
                  <div class="contrib-card">
                    <div class="contrib-header">
                      <div class="contrib-avatar">
                        {#if contrib.avatar}
                          <img src={contrib.avatar} alt={contrib.name} />
                        {:else}
                          <div class="contrib-avatar-placeholder">{contrib.name.charAt(0)}</div>
                        {/if}
                      </div>
                      <div class="contrib-info">
                        <p class="contrib-name">{contrib.name}</p>
                        <p class="contrib-amount">{formatRp(contrib.net_contribution)}</p>
                      </div>
                      <div class="contrib-percentage">{percentage}%</div>
                    </div>
                    <div class="contrib-bar-wrap">
                      <div class="contrib-bar" style="width:{percentage}%"></div>
                    </div>
                    <div class="contrib-details">
                      <span class="contrib-detail-item">
                        <Icon name="income" size={12} /> {formatCompact(contrib.total_topup)}
                      </span>
                      {#if contrib.total_deduct > 0}
                        <span class="contrib-detail-item">
                          <Icon name="expense" size={12} /> {formatCompact(contrib.total_deduct)}
                        </span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Activities Section -->
          <div class="history-section">
            <h4 class="history-section-title">Aktivitas</h4>
            {#if activities.length === 0}
              <p class="history-empty">Belum ada aktivitas</p>
            {:else}
              <div class="activities-list">
                {#each activities as activity}
                  {@const milestone = milestoneFromMetadata(activity.metadata)}
                  {@const actType = activity.type}
                  {@const actIcon = actType === 'topup' ? 'income' : actType === 'deduct' ? 'expense' : actType === 'milestone' ? 'sparkles' : actType === 'created' ? 'success' : 'edit'}
                  {@const actColor = actType === 'topup' ? 'green' : actType === 'deduct' ? 'red' : actType === 'milestone' ? 'yellow' : 'blue'}
                  {@const actLabel = actType === 'topup' ? 'Top Up' : actType === 'deduct' ? 'Tarik' : actType === 'milestone' ? 'Milestone' : actType === 'created' ? 'Dibuat' : 'Diupdate'}
                  
                  <div class="activity-item">
                    <div class="activity-icon activity-icon--{actColor}">
                      <Icon name={actIcon} size={16} />
                    </div>
                    <div class="activity-content">
                      <p class="activity-title">
                        <strong>{activity.user_name}</strong> {actLabel}
                        {#if activity.amount > 0}
                          <span class="activity-amount">{formatRp(activity.amount)}</span>
                        {/if}
                      </p>
                      {#if activity.note}
                        <p class="activity-note">{activity.note}</p>
                      {/if}
                      {#if milestone}<p class="activity-milestone">Mencapai {milestone}%!</p>{/if}
                      <p class="activity-time">{new Date(activity.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <div class="modal-actions">
          <button type="button" class="modal-cancel" onclick={() => showHistoryModal = false}>Tutup</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Milestone Celebration -->
  {#if showMilestone}
    <div class="milestone-overlay" role="dialog" aria-modal="true" aria-label="Pencapaian tabungan" tabindex="-1" onkeydown={(e) => { if (e.key === 'Escape') showMilestone = false; }} onclick={(e) => { if (e.target === e.currentTarget) showMilestone = false; }}>
      <div class="milestone-card">
        <div class="confetti-container">
          <!-- Confetti animation -->
          {#each Array(50) as _, i}
            <div class="confetti" style="--i: {i}"></div>
          {/each}
        </div>
        
        <div class="milestone-icon">
          <Icon name="sparkles" size={64} />
        </div>
        
        <h2 class="milestone-title">Milestone Tercapai!</h2>
        <p class="milestone-percent">{milestonePercent}%</p>
        <p class="milestone-subtitle">{milestoneSavingName}</p>
        
        <div class="milestone-message">
          {#if milestonePercent === 25}
            <p>Awal yang bagus! Terus lanjutkan!</p>
          {:else if milestonePercent === 50}
            <p>Setengah jalan! Kamu hebat!</p>
          {:else if milestonePercent === 75}
            <p>Hampir sampai! Sedikit lagi!</p>
          {:else if milestonePercent === 100}
            <p>Target tercapai! Selamat!</p>
          {/if}
        </div>

        <button type="button" class="milestone-btn" onclick={() => showMilestone = false}>
          Tutup
        </button>
      </div>
    </div>
  {/if}

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .savings-root {
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
  .header-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:18px; }
  .header-sub { font-size:10px; color:#BFDBFE; margin:0 0 6px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; }
  .header-title { display:flex; align-items:center; gap:8px; font-size:29px; font-weight:900; color:#fff; margin:0; letter-spacing:-.03em; }
  .header-description { max-width:260px; margin:8px 0 0; color:#DBEAFE; font-size:12px; line-height:1.4; font-weight:600; }

  .create-btn {
    background:rgba(255,255,255,.18);
    color: #ffffff;
    border:1px solid rgba(255,255,255,.35);
    border-radius: 12px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 700;
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
  .summary-label { font-size:10px; color:#BFDBFE; margin:0 0 4px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
  .summary-amount { font-size:18px; font-weight:900; color:#fff; margin:0; }
  .summary-track { height:10px; background:rgba(255,255,255,.22); border-radius:99px; padding:2px; margin-bottom:10px; }
  .summary-fill { height:100%; background:#fff; border-radius:99px; transition:width .6s ease; }
  .summary-meta { display:flex; justify-content:space-between; gap:8px; font-size:11px; color:#DBEAFE; font-weight:700; }
  .summary-pct { color:#fff; font-weight:900; }

  /* Body */
  .body { max-width:760px; margin:auto; padding:24px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E0E7FF; border-top-color: #2196F3; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

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

  /* Savings List */
  .savings-list { display: flex; flex-direction: column; gap: 14px; }

  /* Saving Card */
  .saving-card {
    display:block;
    color:inherit;
    text-decoration:none;
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 1px 2px rgba(31,41,55,0.04);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .saving-card:hover { transform:translateY(-2px); box-shadow:0 12px 26px rgba(30,64,175,.11); }
  .saving-card:focus-visible { outline:3px solid #60A5FA; outline-offset:2px; }
  .saving-card--done {
    border-color: rgba(79, 191, 163, 0.4);
    background: #ffffff;
  }
  .saving-card:active { transform: scale(0.99); }

  .saving-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .saving-emoji-wrap {
    width: 48px;
    height: 48px;
    border-radius: 18px;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.32),
      4px 6px 13px rgba(21, 101, 192, 0.22);
  }
  .saving-emoji-wrap--done { background: linear-gradient(145deg, #8ED9C6 0%, #4FBFA3 55%, #35A88C 100%); color: #fff; }
  .saving-meta { flex: 1; min-width: 0; }
  .saving-name { font-size: 15px; font-weight: 700; color: #1F2937; margin: 0 0 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .saving-deadline { font-size: 11px; color: #64748B; margin: 0; font-weight: 600; }
  .saving-creator { font-size: 10px; color: #94A3B8; margin: 4px 0 0; font-weight: 600; }
  .swipe-hint { opacity: 0.5; font-size: 10px; animation: pulse 2s ease-in-out infinite; }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }

  .saving-pct-badge {
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    padding: 5px 12px;
    border-radius: 14px;
    flex-shrink: 0;
    line-height: 1.2;
    box-shadow: inset 2px 2px 4px rgba(255, 255, 255, 0.4), inset -2px -3px 6px rgba(13, 71, 161, 0.3), 2px 4px 9px rgba(21, 101, 192, 0.22);
  }
  /* Target tercapai ditandai ubin teal, bukan sekadar warna teks */
  .saving-pct-badge--done { background: linear-gradient(145deg, #8ED9C6 0%, #4FBFA3 55%, #35A88C 100%); color: #fff; }

  .saving-menu { display: flex; gap: 6px; flex-shrink: 0; }
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
  .saving-progress { margin-bottom: 12px; }
  .progress-track { height: 11px; background: #DAEBFA; border-radius: 99px; padding: 2px; box-shadow: inset 3px 3px 6px rgba(25, 118, 210, 0.20), inset -2px -2px 5px rgba(255, 255, 255, 0.95); }
  .progress-fill { height: 100%; background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%); border-radius: 99px; transition: width 0.6s ease; box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }
  .progress-fill--done { background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%); box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }

  /* Amounts */
  .saving-amounts { display: flex; justify-content: space-between; margin-bottom: 14px; }
  .amount-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 3px; }
  .amount-val { font-size: 13px; font-weight: 700; color: #1F2937; margin: 0; }
  .amount-val--collected { color: #2F9A80; }
  .amount-val--remaining { color: #D2566F; }

  /* Done banner */
  .done-banner {
    background: rgba(79, 191, 163, 0.1);
    border: 1px solid rgba(79, 191, 163, 0.4);
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    color: #2F9A80;
    text-align: center;
    margin-bottom: 14px;
  }

  /* Actions */
  .saving-actions { display: flex; gap: 10px; }
  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px;
    border-radius: 12px;
    border: none;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.12s, opacity 0.15s;
  }
  .action-btn:active { transform: scale(0.96); }
  .action-btn--topup { background: rgba(33, 150, 243,0.1); color: #1976D2; }
  .action-btn--topup:hover { background: rgba(33, 150, 243,0.18); }
  .action-btn--deduct { background: rgba(239,124,151,0.1); color: #D2566F; }
  .action-btn--deduct:hover { background: rgba(239,124,151,0.18); }
  .action-btn--history { background: rgba(245,158,11,0.12); color: #B45309; }
  .action-btn--history:hover { background: rgba(245,158,11,0.2); }
  .action-btn--chat { background: rgba(33, 150, 243,0.1); color: #1976D2; }
  .action-btn--chat:hover { background: rgba(33, 150, 243,0.18); }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(30,41,59,0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
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
  .modal-icon-circle--green { background: #F0F9F7; color: #5CC8AC; }
  .modal-icon-circle--red { background: #FDF4F6; color: #EF7C97; }
  .modal-title { font-size: 17px; font-weight: 900; color: #1E293B; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #94A3B8; margin: 0; font-weight: 700; }

  /* Topup progress mini */
  .topup-progress { background: #F0F4FF; border-radius: 16px; padding: 14px; margin-bottom: 18px; }
  .deduct-progress { background: #FDF4F6; border-radius: 16px; padding: 14px; margin-bottom: 18px; }
  .topup-progress-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .topup-progress-row:last-child { margin-bottom: 0; margin-top: 8px; }
  .topup-label { font-size: 11px; font-weight: 800; color: #94A3B8; }
  .topup-amount-text { font-size: 13px; font-weight: 900; color: #0EA5E9; }

  .deduct-hint { font-size: 11px; color: #EF7C97; margin: 4px 0 0; font-weight: 700; }

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
  .form-input--green:focus {
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.18),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95),
      0 0 0 3px rgba(33, 150, 243, 0.16);
  }
  .form-input--red:focus {
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.18),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95),
      0 0 0 3px rgba(33, 150, 243, 0.16);
  }

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
  .modal-submit--green {
    background: linear-gradient(135deg, #5CC8AC, #3FAF92);
    box-shadow: 0 6px 20px rgba(92,200,172,0.3);
  }
  .modal-submit--red {
    background: linear-gradient(135deg, #EF7C97, #D2566F);
    box-shadow: 0 6px 20px rgba(239,124,151,0.3);
  }

  /* Delete confirm */
  .delete-confirm-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #FDF4F6;
    color: #EF7C97;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }
  .delete-confirm-title {
    font-size: 19px;
    font-weight: 900;
    color: #1E293B;
    text-align: center;
    margin: 0 0 10px;
  }
  .delete-confirm-msg {
    font-size: 14px;
    color: #64748B;
    text-align: center;
    line-height: 1.5;
    margin: 0 0 24px;
    font-weight: 600;
  }
  .delete-confirm-msg strong {
    color: #1E293B;
    font-weight: 800;
  }

  /* History Modal */
  .modal--large {
    max-height: 80vh;
    overflow-y: auto;
  }

  .history-loading {
    display: flex;
    justify-content: center;
    padding: 40px 0;
  }

  .history-section {
    margin-bottom: 24px;
  }

  .history-section-title {
    font-size: 14px;
    font-weight: 900;
    color: #1E293B;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 14px;
  }

  .history-empty {
    text-align: center;
    color: #94A3B8;
    font-size: 13px;
    padding: 20px;
  }

  /* Contributions */
  .contributions-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .contrib-card {
    background: #F8FAFC;
    border-radius: 16px;
    padding: 14px;
    border: 1px solid #E2E8F0;
  }

  .contrib-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .contrib-avatar {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .contrib-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .contrib-avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2196F3, #4F96E5);
    color: white;
    font-weight: 900;
    font-size: 18px;
  }

  .contrib-info {
    flex: 1;
  }

  .contrib-name {
    font-size: 14px;
    font-weight: 800;
    color: #1E293B;
    margin: 0 0 2px;
  }

  .contrib-amount {
    font-size: 16px;
    font-weight: 900;
    color: #0EA5E9;
    margin: 0;
  }

  .contrib-percentage {
    font-size: 20px;
    font-weight: 900;
    color: #2196F3;
  }

  .contrib-bar-wrap { height: 11px; background: #DAEBFA; border-radius: 99px; padding: 2px; box-shadow: inset 3px 3px 6px rgba(25, 118, 210, 0.20), inset -2px -2px 5px rgba(255, 255, 255, 0.95); margin-bottom: 8px; }

  .contrib-bar {
    height: 100%;
    background: linear-gradient(90deg, #2196F3, #0EA5E9);
    border-radius: 99px;
    transition: width 0.6s ease;
  }

  .contrib-details {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #64748B;
    font-weight: 700;
  }

  .contrib-detail-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Activities */
  .activities-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .activity-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #F8FAFC;
    border-radius: 14px;
    border: 1px solid #E2E8F0;
  }

  .activity-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .activity-icon--green {
    background: #F0F9F7;
    color: #5CC8AC;
  }

  .activity-icon--red {
    background: #FDF4F6;
    color: #EF7C97;
  }

  .activity-icon--yellow {
    background: #FEF3C7;
    color: #F59E0B;
  }

  .activity-icon--blue {
    background: #EFF6FF;
    color: #2196F3;
  }

  .activity-content {
    flex: 1;
  }

  .activity-title {
    font-size: 13px;
    color: #1E293B;
    margin: 0 0 2px;
    font-weight: 600;
  }

  .activity-title strong {
    font-weight: 900;
  }

  .activity-amount {
    color: #0EA5E9;
    font-weight: 900;
  }

  .activity-note {
    font-size: 12px;
    color: #64748B;
    margin: 2px 0;
    font-weight: 600;
  }

  .activity-milestone {
    font-size: 12px;
    color: #F59E0B;
    margin: 2px 0;
    font-weight: 800;
  }

  .activity-time {
    font-size: 11px;
    color: #94A3B8;
    margin: 4px 0 0;
    font-weight: 700;
  }

  /* Milestone Celebration */
  .milestone-overlay {
    position: fixed;
    inset: 0;
    background: rgba(30,41,59,0.8);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .milestone-card {
    background: white;
    border-radius: 32px;
    padding: 40px 32px;
    max-width: 400px;
    text-align: center;
    position: relative;
    overflow: hidden;
    animation: pop-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  @keyframes pop-in {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .confetti-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    background: linear-gradient(135deg, #2196F3, #F59E0B, #EF7C97, #5CC8AC);
    top: -10px;
    left: calc(var(--i) * 2%);
    animation: confetti-fall 3s ease-out infinite;
    animation-delay: calc(var(--i) * 0.05s);
    border-radius: 2px;
  }

  @keyframes confetti-fall {
    to {
      transform: translateY(120vh) rotate(720deg);
      opacity: 0;
    }
  }

  .milestone-icon {
    width: 100px;
    height: 100px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FEF3C7, #FDE68A);
    color: #F59E0B;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: bounce 1s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .milestone-title {
    font-size: 28px;
    font-weight: 900;
    color: #1E293B;
    margin: 0 0 12px;
  }

  .milestone-percent {
    font-size: 64px;
    font-weight: 900;
    background: linear-gradient(135deg, #2196F3, #F59E0B);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
    line-height: 1;
  }

  .milestone-subtitle {
    font-size: 18px;
    font-weight: 800;
    color: #64748B;
    margin: 12px 0 20px;
  }

  .milestone-message {
    font-size: 16px;
    color: #1E293B;
    font-weight: 700;
    margin-bottom: 28px;
  }

  .milestone-btn {
    background: linear-gradient(145deg, #2196F3, #4F96E5);
    color: white;
    border: none;
    border-radius: 22px;
    padding: 14px 32px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
    transition: transform 0.2s;
  }

  .milestone-btn:hover {
    transform: scale(1.05);
  }

  .milestone-btn:active {
    transform: scale(0.95);
  }

  /* Refined product surface */
  .saving-card, .empty-state, .contrib-card {
    border: 1px solid rgba(255,255,255,.92);
    box-shadow: 0 8px 20px rgba(30,64,175,.06);
  }
  .saving-skeleton { display:grid; grid-template-columns:48px 1fr; column-gap:13px; row-gap:17px; min-height:126px; padding:18px; border:1px solid #e3edfa; border-radius:18px; background:rgba(255,255,255,.85); }
  .saving-skeleton-icon,.saving-skeleton-copy div,.saving-skeleton-track { background:linear-gradient(100deg,#e8f1fb,#f8fbff,#e8f1fb); background-size:200% 100%; animation:saving-shimmer 1.4s ease-in-out infinite; }
  .saving-skeleton-icon { width:48px; height:48px; border-radius:14px; }
  .saving-skeleton-copy { display:flex; flex-direction:column; justify-content:center; gap:9px; }
  .saving-skeleton-copy div { width:65%; height:12px; border-radius:7px; }
  .saving-skeleton-copy div:last-child { width:42%; height:9px; }
  .saving-skeleton-track { grid-column:1 / -1; height:9px; border-radius:99px; }
  @keyframes saving-shimmer { to { background-position-x:-200%; } }
  .saving-card { border-radius: 18px; }
  .saving-progress .progress-track, .contrib-bar-wrap { box-shadow: none; background: #E8EEF7; }
  .progress-fill, .contrib-bar { background: #2563EB; box-shadow: none; }
  .action-btn { border-radius: 10px; box-shadow: none; }
  .modal { box-shadow: 0 14px 30px rgba(15,23,42,.12); }
  .form-input { border: 1px solid #E2E8F0; box-shadow: none; background: #F8FAFC; border-radius: 12px; }
  .form-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .modal-submit, .milestone-btn { background: #2563EB; box-shadow: 0 8px 18px rgba(37,99,235,.22); border-radius: 14px; }
  .summary-row > div,.saving-amounts .amount-item { min-width:0; max-width:50%; }
  .summary-amount,.amount-val { overflow-wrap:anywhere; }
  .saving-card { min-width:0; border-color:#e3edfa; background:rgba(255,255,255,.94); }
  .saving-card:hover { border-color:#bfdbfe; transform:translateY(-2px); box-shadow:0 12px 26px rgba(30,64,175,.1); }
  .saving-meta { min-width:0; }
  .saving-name,.saving-creator { overflow-wrap:anywhere; }
  .saving-creator { color:#64748b; font-weight:700; }
  .amount-label { color:#64748b; font-weight:800; }
  .amount-val { font-size:clamp(12px,3.8vw,16px); font-weight:900; }
  .amount-val--collected { color:#1d4ed8; }
  .amount-val--remaining { color:#475569; }
  .progress-track { padding:0; height:9px; }
  .progress-fill--done { background:#168f78; }
  .modal { max-height:calc(100dvh - 32px); overflow-y:auto; padding-bottom:max(24px,env(safe-area-inset-bottom)); box-shadow:0 -18px 40px rgba(15,55,140,.14); }
  .form-input:not(.form-input--amount) { min-height:48px; font-size:16px; }
  .modal-cancel { color:#475569; background:#f1f5f9; border-radius:12px; }
  .modal-submit--green { background:#168f78; box-shadow:0 7px 16px rgba(22,143,120,.2); }
  .modal-submit--red { background:#df4264; box-shadow:0 7px 16px rgba(223,66,100,.2); }
  @media (max-width:380px) {
    .header { padding-inline:18px; }
    .body { padding-inline:14px; }
    .create-btn { padding-inline:10px; }
    .modal { padding-inline:18px; }
  }
</style>

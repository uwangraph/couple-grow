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
    try {
      const res = await fetch(`${API_URL}/savings`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await readApiJson<{ savings?: any[] }>(res);
      if (res.ok) savings = data.savings || [];
    } catch(e) {} finally { loading = false; }
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
    return Math.min(Math.floor((current / target) * 100), 100);
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
          <h1 class="header-title" style="display: flex; align-items: center; gap: 8px;">
            Tabungan <Icon name="wallet" size={24} />
          </h1>
        </div>
        <button class="create-btn" onclick={() => showModal = true}>
          + Buat Target
        </button>
      </div>

      <!-- Overall Summary Card -->
      {#if savings.length > 0}
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
            <span>{savings.length} target aktif</span>
            <span class="summary-pct">{overallPct}% tercapai</span>
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

    {:else if savings.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="empty" size={56} />
        </div>
        <p class="empty-title">Belum ada target tabungan</p>
        <p class="empty-sub">Yuk buat target impian bersama!</p>
        <button class="empty-cta" onclick={() => showModal = true}>+ Buat Target Pertama</button>
      </div>

    {:else}
      <div class="savings-list">
        {#each savings as s}
          {@const percent = pct(s.current_amount, s.target_amount)}
          {@const remaining = s.target_amount - s.current_amount}
          {@const isDone = percent >= 100}

          <div 
            class="saving-card {isDone ? 'saving-card--done' : ''}"
            onclick={() => goto(`/savings/${s.id}`)}
            style="cursor: pointer;"
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
          </div>
        {/each}
      </div>
    {/if}

    <div style="height:32px;"></div>
  </div>

  <!-- Modal Buat Tabungan -->
  {#if showModal}
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }}>
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
            <label class="form-label">Nama Target</label>
            <input
              type="text"
              bind:value={name}
              required
              placeholder="Contoh: Liburan Bali"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Target Nominal (Rp)</label>
            <input
              type="number"
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showTopupModal = false; }}>
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
            <label class="form-label">Nominal Top Up (Rp)</label>
            <input
              type="number"
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showDeductModal = false; }}>
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
            <label class="form-label">Nominal Tarik (Rp)</label>
            <input
              type="number"
              bind:value={deductAmount}
              required
              placeholder="0"
              max={selectedDeductSaving.current_amount}
              class="form-input form-input--amount form-input--red"
            />
            <p class="deduct-hint">Maksimal: {formatRp(selectedDeductSaving.current_amount)}</p>
          </div>
          <div class="form-group">
            <label class="form-label">Catatan (opsional)</label>
            <input
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }}>
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
            <label class="form-label">Nama Target</label>
            <input
              type="text"
              bind:value={editName}
              required
              placeholder="Contoh: Liburan Bali"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Target Nominal (Rp)</label>
            <input
              type="number"
              bind:value={editTargetAmount}
              required
              placeholder="0"
              class="form-input form-input--amount"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Deadline (opsional)</label>
            <input
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showDeleteConfirm = false; }}>
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
          <button class="modal-cancel" onclick={() => showDeleteConfirm = false}>Batal</button>
          <button class="modal-submit modal-submit--red" onclick={deleteSaving}>Hapus</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal History & Contributions -->
  {#if showHistoryModal && selectedHistorySaving}
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showHistoryModal = false; }}>
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
                      {#if activity.metadata}
                        {@const meta = JSON.parse(activity.metadata)}
                        {#if meta.percentage}
                          <p class="activity-milestone">Mencapai {meta.percentage}%!</p>
                        {/if}
                      {/if}
                      <p class="activity-time">{new Date(activity.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <div class="modal-actions">
          <button class="modal-cancel" onclick={() => showHistoryModal = false}>Tutup</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Milestone Celebration -->
  {#if showMilestone}
    <div class="milestone-overlay" onclick={() => showMilestone = false}>
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

        <button class="milestone-btn" onclick={() => showMilestone = false}>
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

  /* Savings List */
  .savings-list { display: flex; flex-direction: column; gap: 14px; }

  /* Saving Card */
  .saving-card {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 1px 2px rgba(31,41,55,0.04);
    transition: transform 0.15s;
  }
  .saving-card--done {
    border-color: rgba(16, 185, 129, 0.4);
    background: #ffffff;
  }
  .saving-card:active { transform: scale(0.99); }

  .saving-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .saving-emoji-wrap {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(91, 141, 239, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #4772E8;
  }
  .saving-emoji-wrap--done { background: rgba(16, 185, 129, 0.1); color: #059669; }
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
    font-weight: 700;
    color: #059669;
    background: rgba(16, 185, 129, 0.1);
    padding: 4px 10px;
    border-radius: 10px;
    flex-shrink: 0;
    line-height: 1.2;
  }
  .saving-pct-badge--done { background: rgba(16, 185, 129, 0.1); color: #059669; }

  .saving-menu { display: flex; gap: 6px; flex-shrink: 0; }
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
  .saving-progress { margin-bottom: 12px; }
  .progress-track { height: 8px; background: #E2E8F0; border-radius: 99px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #10B981, #34D399); border-radius: 99px; transition: width 0.6s ease; }
  .progress-fill--done { background: linear-gradient(90deg, #10B981, #34D399); }

  /* Amounts */
  .saving-amounts { display: flex; justify-content: space-between; margin-bottom: 14px; }
  .amount-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 3px; }
  .amount-val { font-size: 13px; font-weight: 700; color: #1F2937; margin: 0; }
  .amount-val--collected { color: #059669; }
  .amount-val--remaining { color: #DC2626; }

  /* Done banner */
  .done-banner {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.4);
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 700;
    color: #059669;
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
  .action-btn--topup { background: rgba(91, 141, 239,0.1); color: #4772E8; }
  .action-btn--topup:hover { background: rgba(91, 141, 239,0.18); }
  .action-btn--deduct { background: rgba(239,68,68,0.1); color: #DC2626; }
  .action-btn--deduct:hover { background: rgba(239,68,68,0.18); }
  .action-btn--history { background: rgba(245,158,11,0.12); color: #B45309; }
  .action-btn--history:hover { background: rgba(245,158,11,0.2); }
  .action-btn--chat { background: rgba(91, 141, 239,0.1); color: #4772E8; }
  .action-btn--chat:hover { background: rgba(91, 141, 239,0.18); }

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
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
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
  .modal-icon-circle--green { background: #F0FDF4; color: #22C55E; }
  .modal-icon-circle--red { background: #FFF1F2; color: #F43F5E; }
  .modal-title { font-size: 17px; font-weight: 900; color: #1E293B; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #94A3B8; margin: 0; font-weight: 700; }

  /* Topup progress mini */
  .topup-progress { background: #F0F4FF; border-radius: 16px; padding: 14px; margin-bottom: 18px; }
  .deduct-progress { background: #FFF1F2; border-radius: 16px; padding: 14px; margin-bottom: 18px; }
  .topup-progress-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .topup-progress-row:last-child { margin-bottom: 0; margin-top: 8px; }
  .topup-label { font-size: 11px; font-weight: 800; color: #94A3B8; }
  .topup-amount-text { font-size: 13px; font-weight: 900; color: #0EA5E9; }

  .deduct-hint { font-size: 11px; color: #F43F5E; margin: 4px 0 0; font-weight: 700; }

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
  .form-input--green:focus { border-color: #22C55E; }
  .form-input--red:focus { border-color: #F43F5E; }

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

  /* Delete confirm */
  .delete-confirm-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #FFF1F2;
    color: #F43F5E;
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
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
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
    color: #6BAFF2;
  }

  .contrib-bar-wrap {
    height: 6px;
    background: #E2E8F0;
    border-radius: 99px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .contrib-bar {
    height: 100%;
    background: linear-gradient(90deg, #6BAFF2, #0EA5E9);
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
    background: #F0FDF4;
    color: #22C55E;
  }

  .activity-icon--red {
    background: #FFF1F2;
    color: #F43F5E;
  }

  .activity-icon--yellow {
    background: #FEF3C7;
    color: #F59E0B;
  }

  .activity-icon--blue {
    background: #EFF6FF;
    color: #6BAFF2;
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
    background: linear-gradient(135deg, #6BAFF2, #F59E0B, #F43F5E, #22C55E);
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
    background: linear-gradient(135deg, #6BAFF2, #F59E0B);
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
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
    color: white;
    border: none;
    border-radius: 16px;
    padding: 14px 32px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(59,130,246,0.4);
    transition: transform 0.2s;
  }

  .milestone-btn:hover {
    transform: scale(1.05);
  }

  .milestone-btn:active {
    transform: scale(0.95);
  }
</style>

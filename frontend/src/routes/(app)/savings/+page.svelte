<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ICONS } from '$lib/icons';

  let savings = $state<any[]>([]);
  let loading = $state(true);

  let showModal = $state(false);
  let name = $state('');
  let targetAmount = $state('');

  let showTopupModal = $state(false);
  let selectedSaving = $state<any>(null);
  let topupAmount = $state('');

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await fetchSavings();
  });

  async function fetchSavings() {
    try {
      const res = await fetch(`${API_URL}/savings`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) savings = data.savings || [];
    } catch(e) {} finally { loading = false; }
  }

  async function createSaving(e: Event) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/savings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ name, target_amount: parseInt(targetAmount) })
      });
      if (!res.ok) throw new Error('Gagal buat tabungan');
      showModal = false; name = ''; targetAmount = '';
      await fetchSavings();
    } catch(e: any) { alert(e.message); }
  }

  async function topupSaving(e: Event) {
    e.preventDefault();
    if (!selectedSaving) return;
    try {
      await fetch(`${API_URL}/savings/${selectedSaving.id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(topupAmount) })
      });
      await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(topupAmount), type: 'expense', category: 'Tabungan', note: 'Top up ' + selectedSaving.name })
      });
      showTopupModal = false; topupAmount = '';
      await fetchSavings();
    } catch(e: any) { alert(e.message); }
  }

  function openTopup(s: any) { selectedSaving = s; showTopupModal = true; }
  function goToSavingChat(s: any) { goto(`/chat?saving_id=${s.id}&saving_name=${encodeURIComponent(s.name)}`); }

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
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="header-inner">
      <div class="header-top">
        <div>
          <p class="header-sub">Target Bersama</p>
          <h1 class="header-title" style="display: flex; align-items: center; gap: 8px;">
            Tabungan <svelte:component this={ICONS.wallet} size={24} />
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
          <svelte:component this={ICONS.empty} size={56} />
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

          <div class="saving-card {isDone ? 'saving-card--done' : ''}">
            <!-- Card Header -->
            <div class="saving-header">
              <div class="saving-emoji-wrap {isDone ? 'saving-emoji-wrap--done' : ''}">
                <div class="saving-emoji">
                  <svelte:component this={isDone ? ICONS.success : ICONS.savings} size={24} />
                </div>
              </div>
              <div class="saving-meta">
                <h3 class="saving-name">{s.name}</h3>
                {#if s.deadline}
                  <p class="saving-deadline" style="display: flex; align-items: center; gap: 5px;">
                    <svelte:component this={ICONS.calendar} size={12} />
                    {new Date(s.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
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
              <div class="done-banner" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svelte:component this={ICONS.sparkles} size={16} /> Target tercapai! Selamat!
              </div>
            {/if}

            <!-- Actions -->
            <div class="saving-actions">
              <button class="action-btn action-btn--topup" onclick={() => openTopup(s)}>
                <svelte:component this={ICONS.income} size={16} />
                Top Up
              </button>
              <button class="action-btn action-btn--chat" onclick={() => goToSavingChat(s)}>
                <svelte:component this={ICONS.chat} size={16} />
                Diskusi
              </button>
            </div>
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
            <svelte:component this={ICONS.wallet} size={24} />
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
            <svelte:component this={ICONS.income} size={24} />
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

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .savings-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: #F5F8FE;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(145deg, #4F7FE0 0%, #6B93E8 55%, #8DB2F0 100%);
    padding: 32px 20px 24px;
    position: relative;
    overflow: hidden;
  }
  .blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.07); }
  .b1 { width: 160px; height: 160px; top: -50px; right: -40px; }
  .b2 { width: 90px; height: 90px; bottom: -20px; left: -20px; }
  .header-inner { position: relative; z-index: 1; }
  .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.65); margin: 0 0 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .header-title { font-size: 24px; font-weight: 900; color: white; margin: 0; }

  .create-btn {
    background: white;
    color: #4F7FE0;
    border: none;
    border-radius: 14px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.12);
    white-space: nowrap;
    transition: transform 0.12s;
    flex-shrink: 0;
  }
  .create-btn:active { transform: scale(0.96); }

  /* Summary Card */
  .summary-card {
    background: rgba(255,255,255,0.18);
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 20px;
    padding: 16px;
    backdrop-filter: blur(4px);
  }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .summary-label { font-size: 11px; color: rgba(255,255,255,0.65); margin: 0 0 3px; font-weight: 700; }
  .summary-amount { font-size: 18px; font-weight: 900; color: white; margin: 0; }
  .summary-track { height: 8px; background: rgba(255,255,255,0.2); border-radius: 99px; overflow: hidden; margin-bottom: 8px; }
  .summary-fill { height: 100%; background: white; border-radius: 99px; transition: width 0.6s ease; }
  .summary-meta { display: flex; justify-content: space-between; font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 700; }
  .summary-pct { color: white; }

  /* ── Body ── */
  .body { padding: 18px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E6EFFF; border-top-color: #4F7FE0; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Empty */
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { margin-bottom: 14px; color: #aab4cc; display: flex; justify-content: center; }
  .empty-title { font-size: 16px; font-weight: 900; color: #2D2A5E; margin: 0 0 6px; }
  .empty-sub { font-size: 13px; color: #aab4cc; margin: 0 0 22px; }
  .empty-cta {
    background: linear-gradient(135deg, #4F7FE0, #6B93E8);
    color: white;
    border: none;
    border-radius: 16px;
    padding: 13px 24px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(123,110,246,0.3);
  }

  /* Savings List */
  .savings-list { display: flex; flex-direction: column; gap: 14px; }

  /* Saving Card */
  .saving-card {
    background: white;
    border-radius: 24px;
    padding: 18px;
    box-shadow: 0 4px 20px rgba(123,110,246,0.08);
    border: 2px solid transparent;
    transition: transform 0.15s;
  }
  .saving-card--done {
    border-color: #86efac;
    background: linear-gradient(to bottom right, #fff, #f0fdf4);
  }
  .saving-card:active { transform: scale(0.99); }

  .saving-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .saving-emoji-wrap {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    background: #F0F5FF;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #4F7FE0;
  }
  .saving-emoji-wrap--done { background: #f0fdf4; color: #15803d; }
  .saving-meta { flex: 1; min-width: 0; }
  .saving-name { font-size: 15px; font-weight: 900; color: #2D2A5E; margin: 0 0 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .saving-deadline { font-size: 11px; color: #aab4cc; margin: 0; font-weight: 700; }

  .saving-pct-badge {
    font-size: 20px;
    font-weight: 900;
    color: #4F7FE0;
    background: #F0F5FF;
    padding: 5px 11px;
    border-radius: 12px;
    flex-shrink: 0;
    line-height: 1;
  }
  .saving-pct-badge--done { background: #f0fdf4; color: #15803d; }

  /* Progress */
  .saving-progress { margin-bottom: 12px; }
  .progress-track { height: 8px; background: #F0F5FF; border-radius: 99px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #4F7FE0, #8DB2F0); border-radius: 99px; transition: width 0.6s ease; }
  .progress-fill--done { background: linear-gradient(90deg, #22c55e, #86efac); }

  /* Amounts */
  .saving-amounts { display: flex; justify-content: space-between; margin-bottom: 14px; }
  .amount-label { font-size: 10px; font-weight: 800; color: #aab4cc; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 3px; }
  .amount-val { font-size: 13px; font-weight: 800; color: #2D2A5E; margin: 0; }
  .amount-val--collected { color: #4F7FE0; }
  .amount-val--remaining { color: #E06070; }

  /* Done banner */
  .done-banner {
    background: #f0fdf4;
    border: 1.5px solid #86efac;
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 800;
    color: #15803d;
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
    border-radius: 14px;
    border: none;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.12s, opacity 0.15s;
  }
  .action-btn:active { transform: scale(0.96); }
  .action-btn--topup { background: #F0F5FF; color: #4F7FE0; }
  .action-btn--topup:hover { background: #E6EFFF; }
  .action-btn--chat { background: #F0FDF4; color: #15803d; }
  .action-btn--chat:hover { background: #dcfce7; }

  /* ── Modal ── */
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
    padding: 20px 22px 40px;
    animation: slide-up 0.25s ease;
  }
  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .modal-handle { width: 44px; height: 5px; background: #E0DBFF; border-radius: 99px; margin: 0 auto 20px; }

  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .modal-icon-circle {
    width: 50px;
    height: 50px;
    border-radius: 16px;
    background: #F0F5FF;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F7FE0;
    flex-shrink: 0;
  }
  .modal-icon-circle--green { background: #F0FDF4; color: #22c55e; }
  .modal-title { font-size: 17px; font-weight: 900; color: #2D2A5E; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #aab4cc; margin: 0; font-weight: 700; }

  /* Topup progress mini */
  .topup-progress { background: #F5F8FE; border-radius: 16px; padding: 14px; margin-bottom: 18px; }
  .topup-progress-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .topup-progress-row:last-child { margin-bottom: 0; margin-top: 8px; }
  .topup-label { font-size: 11px; font-weight: 800; color: #aab4cc; }
  .topup-amount-text { font-size: 13px; font-weight: 900; color: #4F7FE0; }

  /* Form */
  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 800; color: #aab4cc; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px;
    border: 2px solid #E6EFFF;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    color: #2D2A5E;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #FAFAFF;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #4F7FE0; }
  .form-input--amount { font-size: 24px; font-weight: 900; }
  .form-input--green:focus { border-color: #22c55e; }

  .modal-actions { display: flex; gap: 12px; padding-top: 4px; }
  .modal-cancel {
    flex: 1;
    padding: 14px;
    background: #F5F8FE;
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
    background: linear-gradient(135deg, #4F7FE0, #6B93E8);
    color: white;
    border: none;
    border-radius: 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(123,110,246,0.3);
    transition: transform 0.12s;
  }
  .modal-submit:active { transform: scale(0.97); }
  .modal-submit--green {
    background: linear-gradient(135deg, #22c55e, #5ba882);
    box-shadow: 0 6px 20px rgba(91,168,130,0.3);
  }
</style>

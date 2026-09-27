<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let loading = $state(true);
  let loadError = $state('');
  let spendingPattern = $state<any[]>([]);
  let categoryBreakdown = $state<any[]>([]);
  let monthComparison = $state<any>(null);
  let savingsVelocity = $state<any[]>([]);

  let patternPeriod = $state('week'); // week or month
  let breakdownPeriod = $state('month'); // month, 3months, year

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await fetchAnalytics();
  });

  async function fetchAnalytics() {
    loading = true;
    loadError = '';
    try {
      // Fetch all analytics in parallel
      const [patternRes, breakdownRes, comparisonRes, velocityRes] = await Promise.all([
        fetch(`${API_URL}/analytics/spending-pattern?period=${patternPeriod}`, {
          headers: { 'Authorization': `Bearer ${auth.token}` }
        }),
        fetch(`${API_URL}/analytics/category-breakdown?period=${breakdownPeriod}`, {
          headers: { 'Authorization': `Bearer ${auth.token}` }
        }),
        fetch(`${API_URL}/analytics/compare-months`, {
          headers: { 'Authorization': `Bearer ${auth.token}` }
        }),
        fetch(`${API_URL}/analytics/savings-velocity`, {
          headers: { 'Authorization': `Bearer ${auth.token}` }
        })
      ]);

      if ([patternRes, breakdownRes, comparisonRes, velocityRes].some(res => res.status === 401)) {
        auth.logout();
        goto('/login');
        return;
      }
      if ([patternRes, breakdownRes, comparisonRes, velocityRes].some(res => !res.ok)) {
        loadError = 'Sebagian data analitik belum bisa dimuat.';
      }

      if (patternRes.ok) {
        const data = await readApiJson<{ pattern?: any[] }>(patternRes);
        spendingPattern = data.pattern || [];
      }

      if (breakdownRes.ok) {
        const data = await readApiJson<{ breakdown?: any[] }>(breakdownRes);
        categoryBreakdown = data.breakdown || [];
      }

      if (comparisonRes.ok) {
        const data = await readApiJson<{ comparison?: any }>(comparisonRes);
        monthComparison = data.comparison;
      }

      if (velocityRes.ok) {
        const data = await readApiJson<{ velocity?: any[] }>(velocityRes);
        savingsVelocity = data.velocity || [];
      }
    } catch(e) {
      loadError = 'Analitik belum bisa dimuat. Periksa koneksi lalu coba lagi.';
    } finally {
      loading = false;
    }
  }

  async function changePatternPeriod(period: string) {
    try {
      const res = await fetch(`${API_URL}/analytics/spending-pattern?period=${period}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      if (!res.ok) throw new Error('Periode pengeluaran belum bisa dimuat.');
      const data = await readApiJson<{ pattern?: any[] }>(res);
      spendingPattern = data.pattern || [];
      patternPeriod = period;
      if (loadError.startsWith('Periode')) loadError = '';
    } catch {
      loadError = 'Periode pengeluaran belum bisa dimuat. Coba lagi.';
    }
  }

  async function changeBreakdownPeriod(period: string) {
    try {
      const res = await fetch(`${API_URL}/analytics/category-breakdown?period=${period}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      if (!res.ok) throw new Error('Periode kategori belum bisa dimuat.');
      const data = await readApiJson<{ breakdown?: any[] }>(res);
      categoryBreakdown = data.breakdown || [];
      breakdownPeriod = period;
      if (loadError.startsWith('Periode')) loadError = '';
    } catch {
      loadError = 'Periode kategori belum bisa dimuat. Coba lagi.';
    }
  }

  function formatRp(num: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }

  function formatCompact(num: number) {
    if (num >= 1000000) return `Rp ${(num/1000000).toFixed(1)}jt`;
    if (num >= 1000) return `Rp ${(num/1000).toFixed(0)}rb`;
    return `Rp ${num}`;
  }

  // Calculate max value for chart scaling
  let maxExpense = $derived(Math.max(...spendingPattern.map(p => p.expense || 0), 1));
  let totalBreakdown = $derived(categoryBreakdown.reduce((sum, c) => sum + c.total, 0));

  // Colors for pie chart
  const colors = ['#2563EB', '#38BDF8', '#14B8A6', '#818CF8', '#F59E0B', '#F472B6', '#64748B', '#60A5FA'];
</script>

<div class="analytics-root">
  
  <!-- Header -->
  <div class="header">
    <div class="header-inner">
        <button class="back-link" onclick={() => goto('/home')} aria-label="Kembali ke beranda"><Icon name="back" size={18} /> Kembali</button>
        <div class="header-top">
          <div>
            <p class="header-sub">Cerita dari angkamu</p>
            <h1 class="header-title">
              Analitik <Icon name="sparkles" size={24} />
            </h1>
            <p class="header-description">Lihat kebiasaan keuangan dan langkah kecil menuju tujuan bersama.</p>
          </div>
        </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    {#if loading}
      <div class="loading-wrap">
        <div class="spinner"></div>
      </div>
    {:else}

      {#if loadError}
        <div class="analytics-alert" role="alert">
          <span>{loadError}</span>
          <button type="button" onclick={fetchAnalytics}>Coba lagi</button>
        </div>
      {/if}

      <!-- Month Comparison Card -->
      {#if monthComparison}
        {@const current = monthComparison.current}
        {@const previous = monthComparison.previous}
        {@const diff = monthComparison.difference_percentage}
        {@const status = monthComparison.status}
        
        <div class="comparison-card">
          <div class="comparison-icon {status === 'hemat' ? 'comparison-icon--green' : status === 'boros' ? 'comparison-icon--red' : 'comparison-icon--gray'}">
            <Icon name={status === 'hemat' ? 'success' : status === 'boros' ? 'error' : 'check'} size={32} />
          </div>
          <h3 class="comparison-title">
            {#if status === 'hemat'}
              Pengeluaran turun {Math.abs(diff)}%
            {:else if status === 'boros'}
              Pengeluaran naik {Math.abs(diff)}%
            {:else}
              Pengeluaran sama dengan bulan lalu
            {/if}
          </h3>
          <div class="comparison-details">
            <div class="comparison-item">
              <p class="comparison-label">Bulan Ini</p>
              <p class="comparison-amount">{formatRp(current?.expense || 0)}</p>
              <p class="comparison-sub">{current?.expense_count || 0} transaksi</p>
            </div>
            <div class="comparison-item">
              <p class="comparison-label">Bulan Lalu</p>
              <p class="comparison-amount">{formatRp(previous?.expense || 0)}</p>
              <p class="comparison-sub">{previous?.expense_count || 0} transaksi</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Spending Pattern -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Pola Pengeluaran</h2>
          <div class="period-tabs">
            <button 
              class="period-tab {patternPeriod === 'week' ? 'period-tab--active' : ''}"
              onclick={() => changePatternPeriod('week')}
            >
              7 Hari
            </button>
            <button 
              class="period-tab {patternPeriod === 'month' ? 'period-tab--active' : ''}"
              onclick={() => changePatternPeriod('month')}
            >
              6 Bulan
            </button>
          </div>
        </div>

        {#if spendingPattern.length === 0}
          <p class="empty-text">Belum ada data pengeluaran</p>
        {:else}
          <div class="chart-container">
            <div class="bar-chart">
              {#each spendingPattern as point}
                {@const height = maxExpense > 0 ? (point.expense / maxExpense) * 100 : 0}
                <div class="bar-item">
                  <div class="bar-wrapper">
                    <div class="bar-fill" style="height:{height}%">
                      <span class="bar-value">{formatCompact(point.expense)}</span>
                    </div>
                  </div>
                  <p class="bar-label">
                    {#if patternPeriod === 'week'}
                      {new Date(point.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                    {:else}
                      {new Date(point.period + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
                    {/if}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Category Breakdown -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Pengeluaran per Kategori</h2>
          <div class="period-tabs">
            <button 
              class="period-tab {breakdownPeriod === 'month' ? 'period-tab--active' : ''}"
              onclick={() => changeBreakdownPeriod('month')}
            >
              1 Bulan
            </button>
            <button 
              class="period-tab {breakdownPeriod === '3months' ? 'period-tab--active' : ''}"
              onclick={() => changeBreakdownPeriod('3months')}
            >
              3 Bulan
            </button>
            <button 
              class="period-tab {breakdownPeriod === 'year' ? 'period-tab--active' : ''}"
              onclick={() => changeBreakdownPeriod('year')}
            >
              1 Tahun
            </button>
          </div>
        </div>

        {#if categoryBreakdown.length === 0}
          <p class="empty-text">Belum ada data kategori</p>
        {:else}
          <!-- Pie Chart Visual -->
          <div class="pie-container">
            <svg viewBox="0 0 200 200" class="pie-chart">
              {#each categoryBreakdown as cat, i}
                {@const percentage = (cat.total / totalBreakdown) * 100}
                {@const previousSum = categoryBreakdown.slice(0, i).reduce((sum, c) => sum + c.total, 0)}
                {@const startAngle = (previousSum / totalBreakdown) * 360}
                {@const endAngle = startAngle + (percentage / 100) * 360}
                {@const largeArc = percentage > 50 ? 1 : 0}
                {@const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180)}
                {@const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180)}
                {@const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180)}
                {@const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180)}
                {@const path = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                
                <path d={path} fill={colors[i % colors.length]} opacity="0.9" />
              {/each}
              <circle cx="100" cy="100" r="50" fill="rgba(255,255,255,.92)" />
              <text x="100" y="96" text-anchor="middle" class="donut-caption">Total</text>
              <text x="100" y="113" text-anchor="middle" class="donut-value">{formatCompact(totalBreakdown)}</text>
            </svg>
          </div>

          <!-- Category List -->
          <div class="category-list">
            {#each categoryBreakdown as cat, i}
              {@const percentage = Math.round((cat.total / totalBreakdown) * 100)}
              <div class="category-item">
                <div class="category-color" style="background:{colors[i % colors.length]}"></div>
                <div class="category-info">
                  <p class="category-name">{cat.category}</p>
                  <p class="category-count">{cat.count} transaksi</p>
                </div>
                <div class="category-amount">
                  <p class="category-total">{formatCompact(cat.total)}</p>
                  <p class="category-percent">{percentage}%</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Savings Velocity -->
      {#if savingsVelocity.length > 0}
        <div class="section">
          <h2 class="section-title">Prediksi Target Tabungan</h2>
          <div class="velocity-list">
            {#each savingsVelocity as vel}
              {@const percentage = Math.min(Math.round((vel.current_amount / vel.target_amount) * 100), 100)}
              <div class="velocity-card">
                <div class="velocity-header">
                  <h3 class="velocity-name">{vel.name}</h3>
                  <div class="velocity-badge velocity-badge--{vel.velocity_status === 'on_track' ? 'green' : 'gray'}">
                    {vel.velocity_status === 'on_track' ? 'Sesuai rencana' : 'Perlu perhatian'}
                  </div>
                </div>
                <div class="velocity-progress">
                  <div class="velocity-track">
                    <div class="velocity-fill" style="width:{percentage}%"></div>
                  </div>
                  <p class="velocity-percent">{percentage}%</p>
                </div>
                <div class="velocity-stats">
                  <div class="velocity-stat">
                    <Icon name="calendar" size={14} />
                    <span>Rata-rata: {formatCompact(vel.avg_per_day)}/hari</span>
                  </div>
                  {#if vel.months_needed > 0}
                    <div class="velocity-stat">
                      <Icon name="sparkles" size={14} />
                      <span>Target tercapai dalam ~{vel.months_needed} bulan</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    {/if}

    <div style="height:32px;"></div>
  </div>

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .analytics-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
  }

  /* Header */
  .header {
    padding: 24px 22px 28px;
    position: relative;
    flex-shrink: 0;
    font-family: 'Nunito', sans-serif;
    background: linear-gradient(155deg, #1D4ED8, #2563EB 55%, #3B82F6);
    border-radius: 0 0 28px 28px;
    box-shadow: 0 12px 26px rgba(37,99,235,.18);
  }

  .header-inner { position: relative; }
  .back-link { display:inline-flex; align-items:center; gap:6px; min-height:44px; padding:0 8px 0 0; margin:0 0 14px; border:0; background:none; color:#dbeafe; font:800 13px 'Nunito',sans-serif; cursor:pointer; }
  .header-top { display: flex; align-items: flex-start; justify-content: space-between; }
  .header-sub { font-size: 11px; color: #bfdbfe; margin: 0 0 7px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; }
  .header-title { display:flex; align-items:center; gap:9px; font-size: 30px; font-weight: 900; color: #fff; margin: 0; letter-spacing:-.03em; }
  .header-description { max-width:330px; margin:8px 0 0; color:#dbeafe; font-size:13px; line-height:1.5; font-weight:600; }

  /* Body */
  .body { width:100%; box-sizing:border-box; padding:20px 16px calc(36px + env(safe-area-inset-bottom)); max-width:760px; margin:auto; }
  .analytics-alert { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; padding:14px 16px; border:1px solid #fecdd3; border-radius:14px; color:#9f1239; background:#fffafb; font-size:12px; font-weight:800; line-height:1.4; }
  .analytics-alert button { flex:none; min-height:40px; padding:0 12px; border:1px solid #fecdd3; border-radius:10px; color:#be123c; background:#fff; font:900 12px 'Nunito',sans-serif; cursor:pointer; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E2E8F0; border-top-color: #2196F3; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Comparison Card */
  .comparison-card {
    background: rgba(255,255,255,.9);
    border: 1px solid rgba(255,255,255,.95);
    border-radius: 22px;
    padding: 24px;
    margin-bottom: 20px;
    box-shadow: 0 10px 25px rgba(30,64,175,.07);
    text-align: center;
  }

  .comparison-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }

  .comparison-icon--green { background: rgba(79,191,163,0.1); color: #2F9A80; }
  .comparison-icon--red { background: rgba(239,124,151,0.1); color: #D2566F; }
  .comparison-icon--gray { background: rgba(100,116,139,0.1); color: #64748B; }

  .comparison-title {
    font-size: 18px;
    font-weight: 700;
    color: #1F2937;
    margin: 0 0 20px;
  }

  .comparison-details {
    display: flex;
    gap: 20px;
    justify-content: center;
  }

  .comparison-item {
    flex: 1;
    max-width: 150px;
  }

  .comparison-label {
    font-size: 11px;
    font-weight: 600;
    color: #94A3B8;
    text-transform: uppercase;
    margin: 0 0 4px;
  }

  .comparison-amount {
    font-size: 18px;
    font-weight: 700;
    color: #1F2937;
    margin: 0 0 2px;
  }

  .comparison-sub {
    font-size: 11px;
    color: #64748B;
    font-weight: 600;
    margin: 0;
  }

  /* Section */
  .section {
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(255,255,255,.95);
    border-radius: 22px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 10px 25px rgba(30,64,175,.07);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: #1F2937;
    margin: 0;
  }

  .period-tabs {
    display: flex;
    gap: 6px;
    background: #F1F5F9;
    padding: 4px;
    border-radius: 12px;
  }

  .period-tab {
    padding: 6px 12px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #64748B;
    cursor: pointer;
    transition: all 0.2s;
  }

  .period-tab--active {
    background: white;
    color: #1976D2;
    box-shadow: 0 1px 3px rgba(33, 150, 243,0.18);
  }

  .empty-text {
    text-align: center;
    color: #94A3B8;
    font-size: 13px;
    padding: 20px;
    font-weight: 600;
  }

  /* Bar Chart */
  .chart-container {
    overflow-x: auto;
    margin: 0 -8px;
    padding: 0 8px;
  }

  .bar-chart {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    height: 200px;
    min-width: max-content;
    padding: 10px 0;
  }

  .bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 50px;
  }

  .bar-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
  }

  .bar-fill {
    width: 100%;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%);
    border-radius: 8px 8px 0 0;
    position: relative;
    min-height: 20px;
    transition: height 0.6s ease;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 6px; box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }

  .bar-value {
    font-size: 10px;
    font-weight: 700;
    color: white;
    white-space: nowrap;
  }

  .bar-label {
    font-size: 10px;
    font-weight: 600;
    color: #64748B;
    text-align: center;
    margin: 0;
  }

  /* Pie Chart */
  .pie-container {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .pie-chart {
    width: 200px;
    height: 200px;
  }
  .donut-caption { font:700 11px 'Nunito',sans-serif; fill:#94a3b8; }
  .donut-value { font:900 13px 'Nunito',sans-serif; fill:#1e3a5f; }

  /* Category List */
  .category-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .category-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #F8FAFC;
    border-radius: 14px;
    border: 1px solid #E2E8F0;
  }

  .category-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .category-info {
    flex: 1;
  }

  .category-name {
    font-size: 14px;
    font-weight: 700;
    color: #1F2937;
    margin: 0 0 2px;
  }

  .category-count {
    font-size: 11px;
    color: #64748B;
    font-weight: 600;
    margin: 0;
  }

  .category-amount {
    text-align: right;
  }

  .category-total {
    font-size: 14px;
    font-weight: 700;
    color: #1F2937;
    margin: 0 0 2px;
  }

  .category-percent {
    font-size: 11px;
    font-weight: 600;
    color: #1976D2;
    margin: 0;
  }

  /* Velocity */
  .velocity-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .velocity-card {
    padding: 16px;
    background: #F8FAFC;
    border-radius: 16px;
    border: 1px solid #E2E8F0;
  }

  .velocity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .velocity-name {
    font-size: 15px;
    font-weight: 700;
    color: #1F2937;
    margin: 0;
  }

  .velocity-badge {
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
  }

  .velocity-badge--green {
    background: rgba(79,191,163,0.1); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10);
    color: #2F9A80;
  }

  .velocity-badge--gray {
    background: #F1F5F9;
    color: #64748B;
  }

  .velocity-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .velocity-track {
    flex: 1;
    height: 8px;
    background: #E2E8F0;
    border-radius: 99px;
    overflow: hidden;
  }

  .velocity-fill {
    height: 100%;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%);
    border-radius: 99px;
    transition: width 0.6s ease; box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }

  .velocity-percent {
    font-size: 14px;
    font-weight: 700;
    color: #2F9A80;
    margin: 0;
    min-width: 45px;
    text-align: right;
  }

  .velocity-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .velocity-stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748B;
    font-weight: 700;
  }

  /* Keep the insights readable on narrow phones, even with long rupiah amounts. */
  .comparison-card { text-align:left; padding:22px 20px; }
  .comparison-icon { margin:0 0 14px; border-radius:18px; }
  .comparison-title, .section-title { font-weight:900; }
  .comparison-details { gap:10px; justify-content:stretch; }
  .comparison-item { min-width:0; max-width:none; padding:14px; border:1px solid #e3edfa; border-radius:14px; background:#f8fbff; }
  .comparison-label { color:#64748b; }
  .comparison-amount { font-size:clamp(14px, 4vw, 20px); font-weight:900; overflow-wrap:anywhere; }
  .period-tabs { max-width:100%; overflow-x:auto; }
  .period-tab { white-space:nowrap; font-weight:800; }
  .period-tab--active { color:#1d4ed8; }
  @media (max-width:480px) {
    .section-header { align-items:stretch; flex-direction:column; }
    .period-tabs { box-sizing:border-box; width:100%; }
    .period-tab { flex:1; }
    .section { padding:18px 16px; }
    .comparison-details { gap:8px; }
    .comparison-item { padding:12px 10px; }
    .comparison-label { font-size:10px; }
  }
</style>

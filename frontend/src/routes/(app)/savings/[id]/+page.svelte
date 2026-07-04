<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { toast } from '$lib/toast.svelte';

  let { data } = $props();
  const id = data.id;

  let saving = $state<any>(null);
  let activities = $state<any[]>([]);
  let contributions = $state<any[]>([]);
  let loading = $state(true);

  let showTopupModal = $state(false);
  let showDeductModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteConfirm = $state(false);
  let showMilestone = $state(false);

  let topupAmount = $state('');
  let deductAmount = $state('');
  let deductNote = $state('');
  let editName = $state('');
  let editTargetAmount = $state('');
  let editDeadline = $state('');
  let milestonePercent = $state(0);

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await Promise.all([fetchSaving(), fetchActivities(), fetchContributions()]);
    loading = false;
  });

  async function fetchSaving() {
    try {
      const res = await fetch(`${API_URL}/savings/${id}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      if (res.ok) {
        const data = await res.json();
        saving = data.saving;
      }
    } catch(e) { console.error('fetchSaving error:', e); }
  }

  async function fetchActivities() {
    try {
      const res = await fetch(`${API_URL}/savings/${id}/activities`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.ok) activities = (await res.json()).activities || [];
    } catch(e) { console.error('fetchActivities error:', e); }
  }

  async function fetchContributions() {
    try {
      const res = await fetch(`${API_URL}/savings/${id}/contributions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.ok) contributions = (await res.json()).contributions || [];
    } catch(e) { console.error('fetchContributions error:', e); }
  }

  async function topupSaving(e: Event) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/savings/${id}/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(topupAmount) })
      });
      if (!res.ok) throw new Error('Gagal top up');
      const data = await res.json();
      await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount: parseInt(topupAmount), type: 'expense', category: 'Tabungan', note: 'Top up ' + saving?.name })
      });
      showTopupModal = false; topupAmount = '';
      await Promise.all([fetchSaving(), fetchActivities(), fetchContributions()]);
      if (data.milestone) {
        milestonePercent = data.milestone;
        showMilestone = true;
        setTimeout(() => { showMilestone = false; }, 5000);
      } else {
        toast.success('Top up berhasil!');
      }
    } catch(e: any) { toast.error(e.message || 'Gagal top up'); }
  }

  async function deductSaving(e: Event) {
    e.preventDefault();
    const amount = parseInt(deductAmount);
    if (amount > saving?.current_amount) { toast.error('Melebihi saldo tabungan'); return; }
    try {
      const res = await fetch(`${API_URL}/savings/${id}/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount, note: deductNote || null })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal tarik');
      await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ amount, type: 'income', category: 'Tabungan', note: deductNote || `Tarik tabungan ${saving?.name}` })
      });
      showDeductModal = false; deductAmount = ''; deductNote = '';
      await Promise.all([fetchSaving(), fetchActivities()]);
      toast.success('Berhasil tarik dari tabungan!');
    } catch(e: any) { toast.error(e.message || 'Gagal tarik'); }
  }

  async function editSaving(e: Event) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/savings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ name: editName, target_amount: parseInt(editTargetAmount), deadline: editDeadline || null })
      });
      if (!res.ok) throw new Error('Gagal update');
      showEditModal = false;
      await fetchSaving();
      toast.success('Tabungan berhasil diupdate!');
    } catch(e: any) { toast.error(e.message); }
  }

  async function deleteSaving() {
    try {
      const res = await fetch(`${API_URL}/savings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (!res.ok) throw new Error('Gagal hapus');
      toast.success('Tabungan berhasil dihapus!');
      goto('/savings');
    } catch(e: any) { toast.error(e.message); }
  }

  function openEdit() {
    editName = saving?.name || '';
    editTargetAmount = saving?.target_amount?.toString() || '';
    editDeadline = saving?.deadline || '';
    showEditModal = true;
  }

  function fmt(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  }
  function compact(n: number) {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `${(n/1_000).toFixed(0)}rb`;
    return `${n}`;
  }
  function pct(cur: number, tgt: number) { return Math.min(Math.floor((cur / tgt) * 100), 100); }
</script>

{#if loading}
  <div class="full-center"><div class="spinner"></div></div>

{:else if !saving}
  <div class="full-center" style="flex-direction:column;gap:16px;">
    <Icon name="empty" size={48} />
    <p style="color:#94A3B8;font-weight:700;">Tabungan tidak ditemukan</p>
    <button class="btn-back-plain" onclick={() => goto('/savings')}>← Kembali</button>
  </div>

{:else}
  {@const p = pct(saving.current_amount, saving.target_amount)}
  {@const isDone = p >= 100}
  {@const remaining = saving.target_amount - saving.current_amount}

<div class="root">

  <!-- HEADER -->
  <div class="header" class:header--done={isDone}>
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="inner">

      <!-- Top bar -->
      <div class="topbar">
        <button class="icon-btn" onclick={() => goto('/savings')} aria-label="Kembali">
          <Icon name="back" size={20} />
        </button>
        <div style="display:flex;gap:8px;">
          <button class="icon-btn" onclick={openEdit} aria-label="Edit">
            <Icon name="edit" size={18} />
          </button>
          <button class="icon-btn icon-btn--red" onclick={() => showDeleteConfirm = true} aria-label="Hapus">
            <Icon name="trash" size={18} />
          </button>
        </div>
      </div>

      <!-- Title -->
      <div class="title-row">
        <div class="saving-icon" class:saving-icon--done={isDone}>
          <Icon name={isDone ? 'success' : 'savings'} size={30} />
        </div>
        <div>
          <p class="label-small">Target Tabungan</p>
          <h1 class="saving-name">{saving.name}</h1>
          {#if saving.deadline}
            <p class="deadline-text">
              <Icon name="calendar" size={13} />
              Deadline {new Date(saving.deadline).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}
            </p>
          {/if}
        </div>
      </div>

      <!-- Progress card -->
      <div class="progress-card">
        <div class="progress-row">
          <div>
            <p class="label-small" style="color:rgba(255,255,255,.6)">Terkumpul</p>
            <p class="amount-white">{fmt(saving.current_amount)}</p>
          </div>
          <p class="pct-big">{p}%</p>
          <div style="text-align:right">
            <p class="label-small" style="color:rgba(255,255,255,.6)">Target</p>
            <p class="amount-white">{fmt(saving.target_amount)}</p>
          </div>
        </div>
        <div class="prog-track">
          <div class="prog-fill" class:prog-fill--done={isDone} style="width:{p}%"></div>
        </div>
        {#if isDone}
          <p class="prog-caption">Target tercapai! Selamat!</p>
        {:else}
          <p class="prog-caption">Kurang {fmt(remaining)} lagi</p>
        {/if}
      </div>

    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- Actions -->
    <div class="actions">
      <button class="act-btn act-btn--blue" onclick={() => showTopupModal = true}>
        <div class="act-icon act-icon--blue"><Icon name="income" size={24} /></div>
        <span>Top Up</span>
      </button>
      <button
        class="act-btn act-btn--red"
        class:act-btn--disabled={saving.current_amount === 0}
        onclick={() => saving.current_amount > 0 && (showDeductModal = true)}
      >
        <div class="act-icon act-icon--red"><Icon name="expense" size={24} /></div>
        <span>Tarik</span>
      </button>
      <button class="act-btn act-btn--purple" onclick={() => goto(`/chat?saving_id=${saving.id}&saving_name=${encodeURIComponent(saving.name)}`)}>
        <div class="act-icon act-icon--purple"><Icon name="chat" size={24} /></div>
        <span>Diskusi</span>
      </button>
    </div>

    <!-- Contributions -->
    {#if contributions.length > 0}
      <div class="card">
        <h2 class="card-title">Kontribusi</h2>
        <div class="contrib-list">
          {#each contributions as c}
            {@const totalC = contributions.reduce((s, x) => s + x.net_contribution, 0)}
            {@const cp = totalC > 0 ? Math.round((c.net_contribution / totalC) * 100) : 0}
            <div class="contrib-row">
              <div class="avatar">
                {#if c.avatar}<img src={c.avatar} alt={c.name} />{:else}<span>{c.name.charAt(0)}</span>{/if}
              </div>
              <div class="contrib-mid">
                <p class="contrib-name">{c.name}</p>
                <div class="cbar-wrap"><div class="cbar" style="width:{cp}%"></div></div>
              </div>
              <div class="contrib-right">
                <p class="contrib-amount">{compact(c.net_contribution)}</p>
                <p class="contrib-pct">{cp}%</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Activity Log -->
    <div class="card">
      <h2 class="card-title">Riwayat Aktivitas</h2>
      {#if activities.length === 0}
        <p class="empty-msg">Belum ada aktivitas</p>
      {:else}
        <div class="act-list">
          {#each activities as a}
            {@const iconName = a.type==='topup'?'income':a.type==='deduct'?'expense':a.type==='milestone'?'sparkles':a.type==='created'?'success':'edit'}
            {@const color = a.type==='topup'?'green':a.type==='deduct'?'red':a.type==='milestone'?'yellow':'blue'}
            {@const lbl = a.type==='topup'?'Top Up':a.type==='deduct'?'Tarik':a.type==='milestone'?'Milestone':a.type==='created'?'Dibuat':'Diupdate'}
            <div class="log-item">
              <div class="log-icon log-icon--{color}"><Icon name={iconName} size={15} /></div>
              <div class="log-body">
                <p class="log-title">
                  <strong>{a.user_name}</strong> — {lbl}
                  {#if a.amount > 0 && a.type !== 'created'}<span class="log-amount">{fmt(a.amount)}</span>{/if}
                </p>
                {#if a.note}<p class="log-note">{a.note}</p>{/if}
                {#if a.metadata}
                  {@const meta = JSON.parse(a.metadata)}
                  {#if meta.percentage}<p class="log-milestone">Mencapai {meta.percentage}%!</p>{/if}
                {/if}
                <p class="log-time">{new Date(a.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  </div>

</div>
{/if}

<!-- MODALS -->

{#if showTopupModal && saving}
<div class="overlay" role="dialog" aria-modal="true" onclick={(e)=>{if(e.target===e.currentTarget)showTopupModal=false;}}>
  <div class="modal">
    <div class="mhandle"></div>
    <div class="mhead"><div class="micon micon--green"><Icon name="income" size={20}/></div><div><p class="mtitle">Top Up Tabungan</p><p class="msub">{saving.name}</p></div></div>
    <div class="mprogress">
      <div class="mprow"><span>Terkumpul</span><span>{pct(saving.current_amount,saving.target_amount)}%</span></div>
      <div class="mtrack"><div class="mfill" style="width:{pct(saving.current_amount,saving.target_amount)}%"></div></div>
      <div class="mprow"><span class="mval">{fmt(saving.current_amount)}</span><span>/ {fmt(saving.target_amount)}</span></div>
    </div>
    <form onsubmit={topupSaving} class="mform">
      <label class="mlabel" for="topup-amt">Nominal (Rp)</label>
      <input id="topup-amt" type="number" bind:value={topupAmount} required placeholder="0" class="minput minput--big minput--green"/>
      <div class="mactions">
        <button type="button" class="mbtn-cancel" onclick={()=>showTopupModal=false}>Batal</button>
        <button type="submit" class="mbtn mbtn--green">Top Up</button>
      </div>
    </form>
  </div>
</div>
{/if}

{#if showDeductModal && saving}
<div class="overlay" role="dialog" aria-modal="true" onclick={(e)=>{if(e.target===e.currentTarget)showDeductModal=false;}}>
  <div class="modal">
    <div class="mhandle"></div>
    <div class="mhead"><div class="micon micon--red"><Icon name="expense" size={20}/></div><div><p class="mtitle">Tarik Tabungan</p><p class="msub">{saving.name}</p></div></div>
    <div class="minfo-red"><span>Saldo tersedia</span><span class="mval-red">{fmt(saving.current_amount)}</span></div>
    <form onsubmit={deductSaving} class="mform">
      <label class="mlabel" for="deduct-amt">Nominal (Rp)</label>
      <input id="deduct-amt" type="number" bind:value={deductAmount} required placeholder="0" max={saving.current_amount} class="minput minput--big minput--red"/>
      <p class="mhint">Maksimal: {fmt(saving.current_amount)}</p>
      <label class="mlabel" for="deduct-note">Catatan (opsional)</label>
      <input id="deduct-note" type="text" bind:value={deductNote} placeholder="Pinjam untuk..." class="minput"/>
      <div class="mactions">
        <button type="button" class="mbtn-cancel" onclick={()=>showDeductModal=false}>Batal</button>
        <button type="submit" class="mbtn mbtn--red">Tarik</button>
      </div>
    </form>
  </div>
</div>
{/if}

{#if showEditModal && saving}
<div class="overlay" role="dialog" aria-modal="true" onclick={(e)=>{if(e.target===e.currentTarget)showEditModal=false;}}>
  <div class="modal">
    <div class="mhandle"></div>
    <div class="mhead"><div class="micon"><Icon name="edit" size={20}/></div><div><p class="mtitle">Edit Tabungan</p><p class="msub">Ubah detail target</p></div></div>
    <form onsubmit={editSaving} class="mform">
      <label class="mlabel" for="edit-name">Nama Target</label>
      <input id="edit-name" type="text" bind:value={editName} required placeholder="Nama tabungan" class="minput"/>
      <label class="mlabel" for="edit-target">Target Nominal (Rp)</label>
      <input id="edit-target" type="number" bind:value={editTargetAmount} required placeholder="0" class="minput minput--big"/>
      <label class="mlabel" for="edit-deadline">Deadline (opsional)</label>
      <input id="edit-deadline" type="date" bind:value={editDeadline} class="minput"/>
      <div class="mactions">
        <button type="button" class="mbtn-cancel" onclick={()=>showEditModal=false}>Batal</button>
        <button type="submit" class="mbtn">Simpan</button>
      </div>
    </form>
  </div>
</div>
{/if}

{#if showDeleteConfirm && saving}
<div class="overlay" role="dialog" aria-modal="true" onclick={(e)=>{if(e.target===e.currentTarget)showDeleteConfirm=false;}}>
  <div class="modal" style="text-align:center;">
    <div class="mhandle"></div>
    <div class="del-icon"><Icon name="trash" size={30}/></div>
    <p class="del-title">Hapus Tabungan?</p>
    <p class="del-msg">Tabungan <strong>"{saving.name}"</strong> dengan saldo <strong>{fmt(saving.current_amount)}</strong> akan dihapus permanen.</p>
    <div class="mactions">
      <button class="mbtn-cancel" onclick={()=>showDeleteConfirm=false}>Batal</button>
      <button class="mbtn mbtn--red" onclick={deleteSaving}>Hapus</button>
    </div>
  </div>
</div>
{/if}

{#if showMilestone && saving}
<div class="overlay overlay--center" role="dialog" aria-modal="true" onclick={()=>showMilestone=false}>
  <div class="milestone">
    {#each Array(40) as _,i}<div class="confetti" style="--i:{i}"></div>{/each}
    <div class="ms-icon"><Icon name="sparkles" size={56}/></div>
    <h2 class="ms-title">Milestone!</h2>
    <p class="ms-pct">{milestonePercent}%</p>
    <p class="ms-name">{saving.name}</p>
    <p class="ms-msg">
      {#if milestonePercent===25}Awal yang bagus! Terus semangat!
      {:else if milestonePercent===50}Setengah jalan! Kalian hebat!
      {:else if milestonePercent===75}Hampir sampai! Sedikit lagi!
      {:else}Target tercapai! Selamat!{/if}
    </p>
    <button class="ms-btn" onclick={()=>showMilestone=false}>Tutup</button>
  </div>
</div>
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
  *{font-family:'Nunito',sans-serif;box-sizing:border-box;}

  .full-center{display:flex;justify-content:center;align-items:center;height:100vh;}
  .spinner{width:28px;height:28px;border:3px solid #E0E7FF;border-top-color:#3B82F6;border-radius:50%;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .btn-back-plain{padding:10px 20px;background:#EFF6FF;color:#3B82F6;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;}

  /* Header */
  .header{background:linear-gradient(145deg,#3B82F6,#2563EB,#1D4ED8);padding:24px 20px 88px;position:relative;overflow:hidden;}
  .header--done{background:linear-gradient(145deg,#22C55E,#16A34A,#15803D);}
  .blob{position:absolute;border-radius:50%;background:rgba(255,255,255,.08);}
  .b1{width:180px;height:180px;top:-50px;right:-40px;}
  .b2{width:90px;height:90px;bottom:20px;left:-20px;}
  .inner{position:relative;z-index:1;}

  .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
  .icon-btn{width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.2);border:none;color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;}
  .icon-btn:hover{background:rgba(255,255,255,.35);}
  .icon-btn--red:hover{background:rgba(244,63,94,.5);}

  .title-row{display:flex;gap:14px;align-items:flex-start;margin-bottom:22px;}
  .saving-icon{width:54px;height:54px;border-radius:18px;background:rgba(255,255,255,.2);color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .saving-icon--done{background:rgba(255,255,255,.25);}
  .label-small{font-size:11px;font-weight:800;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.06em;margin:0 0 3px;}
  .saving-name{font-size:22px;font-weight:900;color:white;margin:0 0 4px;}
  .deadline-text{font-size:12px;color:rgba(255,255,255,.75);font-weight:700;margin:0;display:flex;align-items:center;gap:5px;}

  .progress-card{background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.25);border-radius:20px;padding:16px;}
  .progress-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .amount-white{font-size:15px;font-weight:900;color:white;margin:0;}
  .pct-big{font-size:28px;font-weight:900;color:white;}
  .prog-track{height:10px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden;margin-bottom:8px;}
  .prog-fill{height:100%;background:white;border-radius:99px;transition:width .6s ease;}
  .prog-fill--done{background:#86EFAC;}
  .prog-caption{font-size:12px;color:rgba(255,255,255,.75);font-weight:700;margin:0;text-align:center;}

  /* Body */
  .body{padding:20px 16px;}

  /* Actions */
  .actions{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
  .act-btn{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 8px;border-radius:20px;border:none;cursor:pointer;background:rgba(255,255,255,.7);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.5);box-shadow:0 4px 16px rgba(0,0,0,.05);transition:.2s;font-size:12px;font-weight:900;color:#1E293B;}
  .act-btn:active{transform:scale(.95);}
  .act-btn--disabled{opacity:.4;cursor:not-allowed;}
  .act-icon{width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;}
  .act-icon--blue{background:#EFF6FF;color:#3B82F6;}
  .act-icon--red{background:#FFF1F2;color:#F43F5E;}
  .act-icon--purple{background:#F5F3FF;color:#7C3AED;}

  /* Card */
  .card{background:rgba(255,255,255,.65);backdrop-filter:blur(12px);border-radius:24px;padding:20px;margin-bottom:16px;border:1px solid rgba(255,255,255,.5);}
  .card-title{font-size:15px;font-weight:900;color:#1E293B;margin:0 0 16px;}
  .empty-msg{text-align:center;color:#94A3B8;font-size:13px;font-weight:700;padding:16px 0;}

  /* Contributions */
  .contrib-list{display:flex;flex-direction:column;gap:12px;}
  .contrib-row{display:flex;align-items:center;gap:12px;}
  .avatar{width:40px;height:40px;border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#3B82F6,#6366F1);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px;}
  .avatar img{width:100%;height:100%;object-fit:cover;}
  .contrib-mid{flex:1;}
  .contrib-name{font-size:13px;font-weight:900;color:#1E293B;margin:0 0 4px;}
  .cbar-wrap{height:5px;background:#E2E8F0;border-radius:99px;overflow:hidden;}
  .cbar{height:100%;background:linear-gradient(90deg,#3B82F6,#6366F1);border-radius:99px;transition:width .6s;}
  .contrib-right{text-align:right;}
  .contrib-amount{font-size:14px;font-weight:900;color:#0EA5E9;margin:0 0 2px;}
  .contrib-pct{font-size:11px;font-weight:800;color:#94A3B8;margin:0;}

  /* Activity log */
  .act-list{display:flex;flex-direction:column;gap:10px;}
  .log-item{display:flex;gap:12px;padding:12px;background:#F8FAFC;border-radius:14px;border:1px solid #E2E8F0;}
  .log-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .log-icon--green{background:#F0FDF4;color:#22C55E;}
  .log-icon--red{background:#FFF1F2;color:#F43F5E;}
  .log-icon--yellow{background:#FEF3C7;color:#F59E0B;}
  .log-icon--blue{background:#EFF6FF;color:#3B82F6;}
  .log-body{flex:1;}
  .log-title{font-size:13px;color:#1E293B;margin:0 0 2px;font-weight:600;}
  .log-title strong{font-weight:900;}
  .log-amount{color:#0EA5E9;font-weight:900;}
  .log-note{font-size:11px;color:#64748B;margin:2px 0;font-weight:600;}
  .log-milestone{font-size:11px;color:#F59E0B;margin:2px 0;font-weight:800;}
  .log-time{font-size:10px;color:#94A3B8;margin:4px 0 0;font-weight:700;}

  /* Overlay/Modal */
  .overlay{position:fixed;inset:0;background:rgba(30,41,59,.45);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;z-index:100;}
  .overlay--center{align-items:center;background:rgba(30,41,59,.85);}
  .modal{background:rgba(255,255,255,.92);backdrop-filter:blur(20px);border-radius:28px 28px 0 0;width:100%;max-width:540px;padding:20px 22px 40px;animation:su .25s ease;max-height:85vh;overflow-y:auto;}
  @keyframes su{from{transform:translateY(40px);opacity:0;}to{transform:translateY(0);opacity:1;}}
  .mhandle{width:44px;height:5px;background:#E0E7FF;border-radius:99px;margin:0 auto 20px;}
  .mhead{display:flex;gap:14px;align-items:center;margin-bottom:18px;}
  .micon{width:46px;height:46px;border-radius:14px;background:#EFF6FF;color:#3B82F6;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .micon--green{background:#F0FDF4;color:#22C55E;}
  .micon--red{background:#FFF1F2;color:#F43F5E;}
  .mtitle{font-size:16px;font-weight:900;color:#1E293B;margin:0 0 2px;}
  .msub{font-size:12px;color:#94A3B8;margin:0;font-weight:700;}
  .mprogress{background:#F0F4FF;border-radius:14px;padding:12px;margin-bottom:16px;}
  .minfo-red{background:#FFF1F2;border-radius:14px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:800;color:#94A3B8;}
  .mprow{display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#94A3B8;margin-bottom:5px;}
  .mtrack{height:6px;background:#E0E7FF;border-radius:99px;overflow:hidden;margin-bottom:5px;}
  .mfill{height:100%;background:linear-gradient(90deg,#3B82F6,#6366F1);border-radius:99px;transition:width .6s;}
  .mval{font-size:13px;font-weight:900;color:#0EA5E9;}
  .mval-red{font-size:16px;font-weight:900;color:#F43F5E;}
  .mform{display:flex;flex-direction:column;gap:12px;}
  .mlabel{font-size:11px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;}
  .minput{padding:12px 16px;border:2px solid #E0E7FF;border-radius:14px;font-size:14px;font-weight:700;color:#1E293B;outline:none;background:#F8FAFC;transition:border-color .2s;width:100%;}
  .minput:focus{border-color:#3B82F6;}
  .minput--big{font-size:24px;font-weight:900;}
  .minput--green:focus{border-color:#22C55E;}
  .minput--red:focus{border-color:#F43F5E;}
  .mhint{font-size:11px;color:#F43F5E;margin:0;font-weight:700;}
  .mactions{display:flex;gap:10px;padding-top:4px;}
  .mbtn-cancel{flex:1;padding:14px;background:#F0F4FF;color:#94A3B8;border:none;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;}
  .mbtn{flex:2;padding:14px;background:linear-gradient(135deg,#3B82F6,#2563EB);color:white;border:none;border-radius:14px;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 6px 20px rgba(59,130,246,.3);transition:transform .12s;}
  .mbtn:active{transform:scale(.97);}
  .mbtn--green{background:linear-gradient(135deg,#22C55E,#16A34A);box-shadow:0 6px 20px rgba(34,197,94,.3);}
  .mbtn--red{background:linear-gradient(135deg,#F43F5E,#E11D48);box-shadow:0 6px 20px rgba(244,63,94,.3);}
  .del-icon{width:58px;height:58px;border-radius:50%;background:#FFF1F2;color:#F43F5E;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;}
  .del-title{font-size:18px;font-weight:900;color:#1E293B;margin:0 0 8px;}
  .del-msg{font-size:13px;color:#64748B;line-height:1.5;margin:0 0 20px;font-weight:600;}
  .del-msg strong{color:#1E293B;font-weight:900;}

  /* Milestone */
  .milestone{background:white;border-radius:28px;padding:36px 24px;text-align:center;position:relative;overflow:hidden;animation:pop .5s cubic-bezier(.68,-.55,.265,1.55);max-width:360px;width:90%;}
  @keyframes pop{from{transform:scale(.5);opacity:0;}to{transform:scale(1);opacity:1;}}
  .confetti{position:absolute;width:8px;height:8px;top:-8px;left:calc(var(--i)*2.5%);animation:fall 3s ease-out infinite;animation-delay:calc(var(--i)*.06s);border-radius:2px;background:linear-gradient(135deg,#3B82F6,#F59E0B,#F43F5E,#22C55E);}
  @keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:0;}}
  .ms-icon{width:84px;height:84px;margin:0 auto 14px;background:linear-gradient(135deg,#FEF3C7,#FDE68A);color:#F59E0B;border-radius:50%;display:flex;align-items:center;justify-content:center;animation:bonce 1s ease-in-out infinite;}
  @keyframes bonce{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
  .ms-title{font-size:22px;font-weight:900;color:#1E293B;margin:0 0 6px;}
  .ms-pct{font-size:52px;font-weight:900;background:linear-gradient(135deg,#3B82F6,#F59E0B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0;line-height:1;}
  .ms-name{font-size:15px;font-weight:800;color:#64748B;margin:8px 0 10px;}
  .ms-msg{font-size:14px;color:#1E293B;font-weight:700;margin:0 0 20px;}
  .ms-btn{background:linear-gradient(135deg,#3B82F6,#2563EB);color:white;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:900;cursor:pointer;}
</style>

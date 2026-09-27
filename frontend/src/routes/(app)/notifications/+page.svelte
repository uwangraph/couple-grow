<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  type Notification = {
    id: number;
    type: string;
    title: string;
    message: string;
    actor_name?: string | null;
    link?: string | null;
    created_at: string;
    is_read: number | boolean;
  };

  let notifications = $state<Notification[]>([]);
  let loading = $state(true);
  let errorMsg = $state('');

  onMount(() => { void loadNotifications(); });

  async function loadNotifications() {
    if (!auth.token) { goto('/login'); return; }
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${auth.token}` } });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      const data = await readApiJson<{ notifications?: Notification[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal memuat notifikasi');
      notifications = data.notifications || [];
      if (notifications.some(item => !item.is_read)) {
        void fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: { Authorization: `Bearer ${auth.token}` } }).catch(() => {});
      }
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : 'Notifikasi belum bisa dimuat.';
    } finally {
      loading = false;
    }
  }

  function formatDate(value: string) {
    const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function openNotification(item: Notification) {
    if (!item.is_read) {
      notifications = notifications.map(notification => notification.id === item.id ? { ...notification, is_read: true } : notification);
      void fetch(`${API_URL}/notifications/${item.id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${auth.token}` } }).catch(() => {});
    }
    if (item.link?.startsWith('/') && !item.link.startsWith('//')) goto(item.link);
  }

  function activityIcon(type: string) {
    if (type === 'transaction') return 'wallet';
    if (type === 'saving') return 'savings';
    if (type === 'wishlist') return 'sparkles';
    if (type === 'folder') return 'folder';
    if (type === 'note') return 'notes';
    if (type === 'chat') return 'chat';
    return 'bell';
  }
</script>

<div class="page">
  <header class="header">
    <div class="header-inner">
      <button type="button" class="back" onclick={() => goto('/home')} aria-label="Kembali ke beranda"><Icon name="back" size={18} /> Kembali</button>
      <div class="title-row">
        <span class="title-icon"><Icon name="bell" size={24} /></span>
        <div><p>AKTIVITAS BERSAMA</p><h1>Notifikasi</h1></div>
      </div>
      <p class="header-description">Semua kabar terbaru dari perjalanan kalian ada di sini.</p>
    </div>
  </header>

  <main>
    {#if loading}
      <div class="loading-list" aria-label="Memuat notifikasi">
        {#each [1, 2, 3] as _}<div class="skeleton"></div>{/each}
      </div>
    {:else if errorMsg}
      <div class="empty-state" role="alert">
        <span class="empty-icon"><Icon name="bell" size={32} /></span>
        <strong>Belum bisa memuat kabar</strong>
        <span>{errorMsg}</span>
        <button type="button" class="retry" onclick={loadNotifications}>Coba lagi</button>
      </div>
    {:else if notifications.length === 0}
      <div class="empty-state">
        <span class="empty-icon"><Icon name="bell" size={32} /></span>
        <strong>Belum ada kabar baru</strong>
        <span>Aktivitas kalian akan muncul di sini. Mulai dari rencana kecil bersama.</span>
        <div class="empty-actions">
          <a href="/notes">Buat catatan</a>
          <a href="/wishlist">Lihat wishlist</a>
        </div>
      </div>
    {:else}
      <div class="list-heading"><h2>Terbaru</h2><span>{notifications.length} kabar</span></div>
      <div class="notification-list">
        {#each notifications as item (item.id)}
          <button type="button" class="item {item.is_read ? '' : 'unread'}" onclick={() => openNotification(item)}>
            <span class="item-icon item-icon--{item.type}"><Icon name={activityIcon(item.type)} size={20} /></span>
            <span class="content">
              <span class="item-title">{item.title}{#if !item.is_read}<span class="unread-dot" aria-label="Belum dibaca"></span>{/if}</span>
              <span class="item-message">{item.message}</span>
              <span class="item-meta">{#if item.actor_name}<span class="item-actor">{item.actor_name}</span><span aria-hidden="true">·</span>{/if}<span class="item-date">{formatDate(item.created_at)}</span></span>
            </span>
            {#if item.link}<span class="item-arrow" aria-hidden="true">→</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  .page { min-height:100%; color:#172033; font-family:'Nunito',sans-serif; }
  .header { padding:calc(24px + env(safe-area-inset-top)) 22px 28px; border-radius:0 0 28px 28px; background:linear-gradient(155deg,#1d4ed8,#2563eb 55%,#3b82f6); box-shadow:0 12px 26px rgba(37,99,235,.18); }
  .header-inner { max-width:760px; margin:auto; }
  .back { display:inline-flex; align-items:center; gap:6px; min-height:44px; margin:0 0 14px; padding:0 8px 0 0; border:0; background:none; color:#dbeafe; font:800 13px 'Nunito',sans-serif; cursor:pointer; }
  .title-row { display:flex; align-items:center; gap:13px; }
  .title-icon { width:49px; height:49px; flex:none; display:grid; place-items:center; border:1px solid rgba(255,255,255,.3); border-radius:16px; color:white; background:rgba(255,255,255,.15); }
  .title-row p { margin:0 0 3px; color:#bfdbfe; font-size:10px; font-weight:900; letter-spacing:.12em; }
  .title-row h1 { margin:0; color:white; font-size:29px; font-weight:900; letter-spacing:-.03em; }
  .header-description { margin:13px 0 0; color:#dbeafe; font-size:12px; font-weight:600; line-height:1.5; }
  main { max-width:760px; margin:auto; padding:24px 16px 40px; }
  .list-heading { display:flex; align-items:baseline; justify-content:space-between; margin:0 3px 14px; }
  .list-heading h2 { margin:0; font-size:17px; font-weight:900; }
  .list-heading span { color:#64748b; font-size:11px; font-weight:700; }
  .notification-list { display:grid; gap:10px; }
  .item { display:flex; align-items:flex-start; gap:12px; width:100%; padding:15px; border:1px solid rgba(255,255,255,.95); border-radius:18px; background:rgba(255,255,255,.88); box-shadow:0 8px 22px rgba(30,64,175,.06); color:inherit; text-align:left; cursor:pointer; transition:transform .15s ease,box-shadow .15s ease; }
  .item:hover { transform:translateY(-2px); box-shadow:0 12px 26px rgba(30,64,175,.1); }
  .item.unread { border-color:#bfdbfe; background:linear-gradient(120deg,#fff,#eff6ff); }
  .item-icon { width:42px; height:42px; flex:none; display:grid; place-items:center; border-radius:13px; background:#e7f1ff; color:#2563eb; }
  .item-icon--saving { background:#e8f8f4; color:#168f78; }
  .item-icon--wishlist { background:#fff4e4; color:#b8680b; }
  .item-icon--note,.item-icon--folder { background:#edf2ff; color:#4f5ecb; }
  .content { min-width:0; flex:1; display:flex; flex-direction:column; gap:4px; }
  .item-title { display:flex; align-items:center; gap:7px; color:#172033; font-size:13px; font-weight:900; line-height:1.35; }
  .unread-dot { width:7px; height:7px; flex:none; border-radius:50%; background:#2563eb; }
  .item-message { color:#64748b; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
  .item-meta { display:flex; align-items:center; gap:6px; margin-top:4px; color:#94a3b8; font-size:10px; font-weight:700; }
  .item-actor { max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#2563eb; font-weight:900; }
  .item-date { color:#64748b; font-weight:700; }
  .item-arrow { align-self:center; color:#60a5fa; font-size:21px; }
  .empty-state { min-height:min(460px,60svh); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:11px; padding:28px 20px; border:1px solid rgba(255,255,255,.85); border-radius:24px; background:rgba(255,255,255,.52); box-shadow:0 10px 28px rgba(30,64,175,.04); text-align:center; }
  .empty-icon { width:76px; height:76px; display:grid; place-items:center; margin-bottom:6px; border:1px solid rgba(255,255,255,.95); border-radius:24px; background:rgba(255,255,255,.75); color:#60a5fa; box-shadow:0 12px 25px rgba(30,64,175,.08); }
  .empty-state strong { font-size:17px; font-weight:900; }
  .empty-state > span:last-of-type { max-width:255px; color:#64748b; font-size:12px; line-height:1.6; }
  .empty-actions { display:flex; flex-wrap:wrap; justify-content:center; gap:9px; margin-top:8px; }
  .empty-actions a { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:0 15px; border:1px solid #bfdbfe; border-radius:12px; color:#1d4ed8; background:#fff; text-decoration:none; font-size:12px; font-weight:900; }
  .empty-actions a:first-child { border-color:#2563eb; color:#fff; background:#2563eb; }
  .retry { min-height:44px; margin-top:7px; padding:10px 18px; border:0; border-radius:11px; background:#2563eb; color:#fff; font:800 12px 'Nunito',sans-serif; cursor:pointer; }
  .loading-list { display:grid; gap:10px; }
  .skeleton { height:88px; border-radius:18px; background:linear-gradient(100deg,rgba(255,255,255,.6),rgba(255,255,255,.95),rgba(255,255,255,.6)); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  @keyframes shimmer { to { background-position-x:-200%; } }
</style>

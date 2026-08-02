<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let notifications = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (!auth.token) return goto('/login');
    const res = await fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${auth.token}` } });
    const data = await res.json();
    notifications = data.notifications || [];
    loading = false;
    await fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: { Authorization: `Bearer ${auth.token}` } });
  });

  function openNotification(item: any) {
    if (!item.is_read) fetch(`${API_URL}/notifications/${item.id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${auth.token}` } });
    if (item.link) goto(item.link);
  }
</script>

<div class="page">
  <header class="header">
    <div class="header-inner">
      <button class="back" onclick={() => goto('/home')} aria-label="Kembali"><Icon name="back" size={20} /> Kembali</button>
      <div class="title-row"><div><p>Aktivitas terbaru</p><h1>Notifikasi <Icon name="bell" size={24} /></h1></div></div>
    </div>
  </header>
  <main>
    {#if loading}<div class="empty">Memuat notifikasi...</div>
    {:else if notifications.length === 0}<div class="empty"><Icon name="bell" size={42} /><strong>Belum ada notifikasi</strong><span>Aktivitas baru bersama pasangan akan muncul di sini.</span></div>
    {:else}
      {#each notifications as item (item.id)}
        <button class="item {item.is_read ? '' : 'unread'}" onclick={() => openNotification(item)}>
          <div class="icon"><Icon name={item.type === 'transaction' ? 'wallet' : item.type === 'chat' ? 'chat' : 'bell'} size={20} /></div>
          <div class="content"><strong>{item.title}</strong><span>{item.message}</span><small>{item.created_at}</small></div>
          <Icon name="arrow" size={18} />
        </button>
      {/each}
    {/if}
  </main>
</div>

<style>
  .page { min-height: 100%; background: transparent; color: #1F2937; }
  .header { padding: 22px 20px 18px; position: relative; border-radius: 0 0 24px 24px; background: #ffffff; }
  .header-inner { position: relative; }
  .back { display:flex; align-items:center; gap:6px; border:0; background:none; color:#4772E8; font:inherit; font-size:12px; font-weight:600; cursor:pointer; padding:0; margin-bottom:18px; }
  .title-row p { margin:0 0 5px; font-size:12px; font-weight:600; color:#94A3B8; }
  .title-row h1 { margin:0; display:flex; align-items:center; gap:8px; font-size:26px; font-weight:800; color:#1F2937; }
  main { padding:18px 16px 30px; }
  .item { width:100%; display:flex; align-items:center; gap:12px; padding:15px 12px; margin-bottom:10px; border:1px solid rgba(226,232,240,0.8); border-radius:16px; background:#ffffff; color:inherit; text-align:left; cursor:pointer; box-shadow:0 1px 2px rgba(31,41,55,0.04); }
  .item.unread { border-color:rgba(91, 141, 239,0.4); background:rgba(239,246,252,0.6); }
  .icon { width:42px; height:42px; display:grid; place-items:center; flex-shrink:0; border-radius:12px; background:rgba(91, 141, 239,0.1); color:#4772E8; }
  .content { flex:1; display:flex; flex-direction:column; gap:3px; }.content strong { font-size:14px; font-weight:700; color:#1F2937; }.content span { font-size:13px; color:#64748B; }.content small { font-size:10px; color:#94A3B8; }
  .empty { min-height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#94A3B8; text-align:center; }.empty strong { color:#64748B; }.empty span { max-width:260px; font-size:13px; }
</style>

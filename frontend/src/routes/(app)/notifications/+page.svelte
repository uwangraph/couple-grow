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
    <button class="back" onclick={() => goto('/home')} aria-label="Kembali"><Icon name="back" size={20} /> Kembali</button>
    <div class="title-row"><div><p>Aktivitas terbaru</p><h1>Notifikasi <Icon name="bell" size={24} /></h1></div></div>
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
  .page { min-height: 100%; background: #F8FBFF; color: #30435F; }
  .header { padding: 22px 20px 26px; color: white; background: linear-gradient(135deg, #6BAFF2, #A58BE8); border-radius: 0 0 28px 28px; }
  .back { display:flex; align-items:center; gap:6px; border:0; background:none; color:white; font:inherit; font-size:12px; font-weight:700; cursor:pointer; padding:0; margin-bottom:22px; }
  .title-row p { margin:0 0 5px; opacity:.8; font-size:13px; font-weight:700; }.title-row h1 { margin:0; display:flex; align-items:center; gap:8px; font-size:26px; }
  main { padding:18px 16px 30px; }.item { width:100%; display:flex; align-items:center; gap:12px; padding:15px 12px; margin-bottom:10px; border:1px solid #E8EEF8; border-radius:18px; background:white; color:inherit; text-align:left; cursor:pointer; box-shadow:0 4px 14px rgba(48,67,95,.04); }.item.unread { border-color:#BFDDFB; background:#F2F8FF; }.icon { width:42px; height:42px; display:grid; place-items:center; flex-shrink:0; border-radius:14px; background:#EAF5FE; color:#5B9FE8; }.content { flex:1; display:flex; flex-direction:column; gap:3px; }.content strong { font-size:14px; }.content span { font-size:13px; color:#64748B; }.content small { font-size:10px; color:#94A3B8; }.empty { min-height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#94A3B8; text-align:center; }.empty strong { color:#64748B; }.empty span { max-width:260px; font-size:13px; }
</style>

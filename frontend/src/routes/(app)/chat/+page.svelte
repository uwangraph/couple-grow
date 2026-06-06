<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, onDestroy, tick } from 'svelte';
  import { ICONS } from '$lib/icons';

  // Support chat per-saving via query params
  let savingId = $derived(page.url.searchParams.get('saving_id'));
  let savingName = $derived(page.url.searchParams.get('saving_name'));
  let chatTitle = $derived(savingName ? `${decodeURIComponent(savingName)}` : 'Pasanganku');
  let chatSubtitle = $derived(savingName ? 'Chat Tabungan' : 'Global Chat');

  let messages = $state<any[]>([]);
  let newMessage = $state('');
  let ws = $state<WebSocket | null>(null);
  let roomId = $state<string | null>(null);
  let chatContainer: HTMLElement;
  let connected = $state(false);
  let toast = $state<string | null>(null);

  onMount(async () => {
    if (!auth.token) return goto('/login');
    await fetchHistory();
    connectWebSocket();
  });

  onDestroy(() => {
    if (ws) ws.close();
  });

  async function fetchHistory() {
    try {
      let url = `${API_URL}/chat/history`;
      if (savingId) url += `?saving_id=${savingId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await res.json();
      if (res.ok) {
        roomId = data.room_id;
        messages = data.messages || [];
        scrollToBottom();
      }
    } catch(e) {}
  }

  function connectWebSocket() {
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/chat/ws';
    const params = new URLSearchParams({ token: auth.token || '' });
    if (savingId) params.set('saving_id', savingId);
    ws = new WebSocket(`${wsUrl}?${params.toString()}`);
    
    ws.onopen = () => { connected = true; };
    ws.onclose = () => { connected = false; };
    ws.onerror = () => { connected = false; };
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat' && msg.data?.sender_id !== auth.user?.id) {
          messages = [...messages, msg.data];
          scrollToBottom();
          // Show toast notification for incoming messages
          showToast(`Pesan baru: "${msg.data.message}"`);
        }
      } catch(e) {}
    };
  }

  function showToast(text: string) {
    toast = text;
    setTimeout(() => { toast = null; }, 3000);
  }

  async function sendMessage(e: Event) {
    e.preventDefault();
    if (!newMessage.trim() || !roomId) return;
    
    const msgText = newMessage.trim();
    newMessage = '';

    const tempMsg = { id: Date.now(), sender_id: auth.user?.id, message: msgText, created_at: new Date().toISOString() };
    messages = [...messages, tempMsg];
    scrollToBottom();

    try {
      const res = await fetch(`${API_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ room_id: roomId, message: msgText })
      });
      const data = await res.json();
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat', data: data.message || tempMsg }));
      }
    } catch(e) {}
  }

  async function scrollToBottom() {
    await tick();
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }
</script>

<div class="h-full flex flex-col bg-[#E8EEF9] relative">
  <!-- Toast Notification -->
  {#if toast}
    <div class="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-text-navy text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap max-w-[80%] truncate flex items-center gap-2">
      <img src={ICONS.bell} alt="bell" class="w-4 h-4" /> {toast}
    </div>
  {/if}

  <!-- Header -->
  <div class="bg-white px-4 py-4 flex items-center shadow-sm z-10 rounded-b-2xl flex-shrink-0">
    {#if savingId}
      <button onclick={() => goto('/savings')} class="mr-3 p-2 hover:bg-gray-100 rounded-full">
        <svg class="w-5 h-5 text-text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      </button>
    {/if}
    <div class="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-xl mr-3 flex-shrink-0">
      <img src={savingId ? ICONS.savings : ICONS.couple} alt="icon" class="w-6 h-6" />
    </div>
    <div class="flex-1">
      <h2 class="font-bold text-text-navy leading-tight text-sm flex items-center gap-2">
        <img src={savingId ? ICONS.savings : ICONS.chat} alt="type" class="w-4 h-4 opacity-70" /> {chatTitle}
      </h2>
      <p class="text-xs flex items-center {connected ? 'text-success' : 'text-gray-400'}">
        <span class="w-2 h-2 rounded-full mr-1 inline-block {connected ? 'bg-success' : 'bg-gray-300'}"></span>
        {chatSubtitle} • {connected ? 'Terhubung' : 'Offline'}
      </p>
    </div>
  </div>

  <!-- Messages -->
  <div class="flex-1 overflow-y-auto p-4 space-y-3" bind:this={chatContainer}>
    {#if messages.length === 0}
      <div class="flex h-full items-center justify-center text-center text-gray-400 text-sm min-h-[200px]">
        <div>
          <img src={savingId ? ICONS.savings : ICONS.chat} alt="empty" class="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p class="text-sm font-medium">{savingId ? 'Belum ada diskusi tabungan ini.' : 'Belum ada obrolan.'}</p>
          <p class="text-xs mt-1 text-gray-300">Sapa pasanganmu sekarang!</p>
        </div>
      </div>
    {/if}
    {#each messages as msg}
      {@const isMine = msg.sender_id === auth.user?.id}
      <div class="flex {isMine ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[78%] rounded-2xl px-4 py-2.5 {isMine ? 'bg-primary text-white rounded-tr-sm shadow-sm' : 'bg-white text-text-navy rounded-tl-sm shadow-sm border border-gray-100'}">
          <p class="text-sm leading-relaxed">{msg.message}</p>
          <p class="text-[10px] mt-1 opacity-60 text-right">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
      </div>
    {/each}
  </div>

  <!-- Input -->
  <div class="p-3 bg-white border-t border-gray-100 flex-shrink-0">
    <form onsubmit={sendMessage} class="flex items-center space-x-2">
      <input
        type="text"
        bind:value={newMessage}
        placeholder="Ketik pesan..."
        class="flex-1 bg-gray-50 border border-gray-200 px-4 py-3 rounded-full text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      />
      <button
        type="submit"
        disabled={!newMessage.trim()}
        class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40 shadow-md"
      >
        <svg class="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
        </svg>
      </button>
    </form>
  </div>
</div>

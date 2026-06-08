<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, onDestroy, tick } from 'svelte';
  import { ICONS } from '$lib/icons';

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

<div class="chat-root">

  <!-- Toast Notification -->
  {#if toast}
    <div class="toast-notif">
      <svelte:component this={ICONS.chat} size={16} /> {toast}
    </div>
  {/if}

  <!-- Header -->
  <div class="chat-header">
    <div class="header-row">
      {#if savingId}
        <button class="back-btn" onclick={() => goto('/savings')}>
          <svelte:component this={ICONS.arrow} size={20} style="transform: rotate(180deg)" />
        </button>
      {/if}

      <div class="header-avatar {savingId ? 'header-avatar--savings' : 'header-avatar--chat'}">
        <svelte:component this={savingId ? ICONS.savings : ICONS.chat} size={22} />
      </div>

      <div class="header-info">
        <h2 class="header-title">{chatTitle}</h2>
        <p class="header-status {connected ? 'header-status--online' : 'header-status--offline'}">
          <span class="status-dot"></span>
          {chatSubtitle} • {connected ? 'Terhubung' : 'Offline'}
        </p>
      </div>
    </div>
  </div>

  <!-- Messages -->
  <div class="messages-area" bind:this={chatContainer}>
    {#if messages.length === 0}
      <div class="empty-chat">
        <div class="empty-icon">
          <svelte:component this={savingId ? ICONS.savings : ICONS.chat} size={48} />
        </div>
        <p class="empty-title">{savingId ? 'Belum ada diskusi tabungan' : 'Belum ada obrolan'}</p>
        <p class="empty-sub">Sapa pasanganmu sekarang! 👋</p>
      </div>
    {/if}

    {#each messages as msg}
      {@const isMine = msg.sender_id === auth.user?.id}
      <div class="msg-container {isMine ? 'msg-container--mine' : 'msg-container--theirs'}">
        <div class="msg-bubble {isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs'}">
          <p class="msg-text">{msg.message}</p>
          <p class="msg-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
      </div>
    {/each}
  </div>

  <!-- Input -->
  <div class="input-area">
    <form class="input-form" onsubmit={sendMessage}>
      <input
        type="text"
        bind:value={newMessage}
        placeholder="Ketik pesan..."
        class="msg-input"
      />
      <button
        type="submit"
        disabled={!newMessage.trim()}
        class="send-btn {newMessage.trim() ? 'send-btn--active' : ''}"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
        </svg>
      </button>
    </form>
  </div>

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .chat-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: #F8F9FD;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Toast */
  .toast-notif {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    background: #2D2A5E;
    color: white;
    font-size: 13px;
    font-weight: 800;
    padding: 9px 16px;
    border-radius: 99px;
    box-shadow: 0 8px 24px rgba(45,42,94,0.25);
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    max-width: 85%;
    animation: slide-down 0.3s ease;
  }
  @keyframes slide-down { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

  /* Header */
  .chat-header {
    background: white;
    padding: 14px 16px;
    border-bottom: 1.5px solid #EEF2F9;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(79,127,224,0.06);
  }
  .header-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: #F0F5FF;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F7FE0;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .back-btn:hover { background: #E6EFFF; }

  .header-avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .header-avatar--chat { background: #F0F5FF; }
  .header-avatar--savings { background: #FFF0F7; }

  .header-info { flex: 1; min-width: 0; }
  .header-title { font-size: 15px; font-weight: 900; color: #2D2A5E; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-status {
    font-size: 12px;
    color: #aab4cc;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
  }
  .header-status--online { color: #22c55e; }
  .header-status--offline { color: #aab4cc; }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .header-status--online .status-dot { background: #22c55e; }
  .header-status--offline .status-dot { background: #aab4cc; }

  /* Messages */
  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: thin;
    scrollbar-color: #D9E2F0 transparent;
  }
  .messages-area::-webkit-scrollbar { width: 6px; }
  .messages-area::-webkit-scrollbar-track { background: transparent; }
  .messages-area::-webkit-scrollbar-thumb { background: #D9E2F0; border-radius: 3px; }

  /* Empty */
  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    text-align: center;
    color: #aab4cc;
  }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 15px; font-weight: 900; color: #2D2A5E; margin: 0 0 5px; }
  .empty-sub { font-size: 13px; color: #aab4cc; margin: 0; }

  /* Messages */
  .msg-container {
    display: flex;
    margin-bottom: 2px;
  }
  .msg-container--mine { justify-content: flex-end; }
  .msg-container--theirs { justify-content: flex-start; }

  .msg-bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 18px;
    line-height: 1.4;
    animation: fade-in 0.2s ease;
  }
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .msg-bubble--mine {
    background: linear-gradient(135deg, #4F7FE0, #6B93E8);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 3px 12px rgba(79,127,224,0.25);
  }
  .msg-bubble--theirs {
    background: white;
    color: #2D2A5E;
    border-bottom-left-radius: 4px;
    border: 1.5px solid #EEF2F9;
  }

  .msg-text { font-size: 14px; font-weight: 600; margin: 0 0 3px; word-wrap: break-word; }
  .msg-time {
    font-size: 11px;
    margin: 0;
    opacity: 0.65;
    text-align: right;
    font-weight: 700;
  }

  /* Input */
  .input-area {
    padding: 12px 14px;
    background: white;
    border-top: 1.5px solid #EEF2F9;
    flex-shrink: 0;
    box-shadow: 0 -2px 8px rgba(79,127,224,0.05);
  }
  .input-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .msg-input {
    flex: 1;
    border: 2px solid #EEF2F9;
    border-radius: 24px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #2D2A5E;
    outline: none;
    background: #F8F9FD;
    transition: all 0.2s;
  }
  .msg-input::placeholder { color: #D9E2F0; }
  .msg-input:focus {
    border-color: #4F7FE0;
    background: white;
    box-shadow: 0 0 0 3px rgba(79,127,224,0.08);
  }

  .send-btn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: none;
    background: #F0F5FF;
    color: #aab4cc;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .send-btn--active {
    background: linear-gradient(135deg, #4F7FE0, #6B93E8);
    color: white;
    box-shadow: 0 4px 14px rgba(79,127,224,0.35);
  }
  .send-btn--active:hover { transform: scale(1.05); }
  .send-btn--active:active { transform: scale(0.95); }
</style>
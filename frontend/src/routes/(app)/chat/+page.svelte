<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, onDestroy, tick } from 'svelte';
  import { MessageSquare, ChevronRight, PiggyBank } from '@lucide/svelte';
  import Icon from '$lib/Icon.svelte';
  import MediaPreview from '$lib/components/MediaPreview.svelte';
  import { Capacitor } from '@capacitor/core';

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
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let isLeaving = false;
  let toast = $state<string | null>(null);
  let fileInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;
  
  let replyingTo = $state<any | null>(null);
  let attachment = $state<File | null>(null);
  let attachmentPreview = $state<string | null>(null);
  
  let isRecording = $state(false);
  let mediaRecorder = $state<MediaRecorder | null>(null);
  let audioChunks = $state<Blob[]>([]);
  
  let contextMenuVisible = $state(false);
  let contextMenuPos = $state({ x: 0, y: 0 });
  let contextMessage = $state<any | null>(null);
  let longPressTimer: any = null;
  let pinnedMessage = $derived(messages.find(m => m.is_pinned));

  // Context menu membuka ke atas atau bawah dari bubble (konsep khwarizmi)
  let menuDirection = $state<'up' | 'down'>('down');


  // Swipe-to-reply state
  let swipeMsgId = $state<number | null>(null);
  let swipeStartX = $state(0);
  let swipeStartY = $state(0);
  let swipeCurrentX = $state(0);
  let swipeActive = $state(false);

  function swipeDown(e: any, msg: any) {
    if (msg.is_deleted) return;
    const point = e.touches ? e.touches[0] : e;
    swipeMsgId = msg.id;
    swipeStartX = point.clientX;
    swipeStartY = point.clientY;
    swipeCurrentX = 0;
    swipeActive = true;
  }

  function swipeMove(e: any, msg: any) {
    if (!swipeActive || swipeMsgId !== msg.id) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - swipeStartX;
    const dy = point.clientY - swipeStartY;
    // Hanya aktif jika dominan horizontal ke kanan
    if (Math.abs(dx) > Math.abs(dy) * 1.2 && dx > 0) {
      swipeCurrentX = Math.min(dx, 80);
      // Jangan trigger context menu saat swipe berlangsung
      if (longPressTimer) clearTimeout(longPressTimer);
    }
  }

  function swipeUp(e: any, msg: any) {
    if (!swipeActive || swipeMsgId !== msg.id) return;
    const point = e && e.touches ? e.touches[0] : e;
    // dx dari posisi akhir jika punya event, fallback ke offset yg sudah terekam
    let dx = swipeCurrentX;
    if (point && typeof point.clientX === 'number') {
      const raw = point.clientX - swipeStartX;
      if (raw > dx) dx = raw;
    }
    swipeActive = false;
    swipeMsgId = null;
    swipeCurrentX = 0;
    if (dx > 45) {
      handleReply(msg);
    }
  }

  function swipeCancel() {
    swipeActive = false;
    swipeMsgId = null;
    swipeCurrentX = 0;
  }

  // Media preview state
  let mediaPreview = $state<{ type: 'image'|'file'|'audio'; url: string; name?: string; caption?: string|null } | null>(null);

  // Emoji picker state
  let showEmojiPicker = $state(false);
  const emojiList = ['😀','😄','😁','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😎','🥳','🤩','😏','😢','😭','😤','😡','🤯','😳','🥺','🤗','🤔','🤭','😐','🙄','😴','🤤','🤢','🤠','👻','👽','🤖','💀','👋','👍','👎','👌','✌️','🤞','🤝','🙏','💪','🫶','❤️','💔','💯','✨','🔥','🎉','🎊','🎁','🌈','⭐','🌙','☀️','☕','🍕','🍔','🍩','🍺','⚽','🏆','🎮','🎵','🎶','📚','💡','💰','📅','📍','🚀','✈️','🌍','🍀'];

  // Camera (web) state — getUserMedia untuk desktop
  let showCameraModal = $state(false);
  let cameraStream = $state<MediaStream | null>(null);
  let cameraError = $state('');
  let cameraMode = $state<'viewfinder' | 'preview'>('viewfinder');
  let capturedPhoto = $state<string | null>(null);

  async function openCamera() {
    // Di platform native (Capacitor/Android), pakai input capture → buka kamera native.
    if (Capacitor.isNativePlatform()) {
      cameraInput.click();
      return;
    }
    // Di web/desktop: buka kamera via getUserMedia.
    cameraMode = 'viewfinder';
    capturedPhoto = null;
    cameraError = '';
    showCameraModal = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      cameraStream = stream;
      await tick();
      const video = document.getElementById('camera-video') as HTMLVideoElement | null;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
    } catch (e: any) {
      cameraStream = null;
      cameraError = e?.name === 'NotAllowedError'
        ? 'Akses kamera ditolak. Izinkan kamera di browser untuk mengambil foto.'
        : 'Kamera tidak tersedia di perangkat ini.';
    }
  }

  function capturePhotoFromCamera() {
    const video = document.getElementById('camera-video') as HTMLVideoElement | null;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.85);
    cameraMode = 'preview';
  }

  function useCapturedPhoto() {
    if (!capturedPhoto) return;
    // Konversi dataURL ke File, lalu set sebagai attachment.
    fetch(capturedPhoto)
      .then(res => res.blob())
      .then((blob) => {
        const file = new File([blob], 'foto_$(Date.now()).jpg', { type: 'image/jpeg' });
        attachment = file;
        attachmentPreview = URL.createObjectURL(blob);
        if (!newMessage) newMessage = 'Foto';
        closeCameraModal();
      })
      .catch(() => closeCameraModal());
  }

  function retakePhoto() {
    capturePhotoFromCamera(); // re-capture current video
    cameraMode = 'preview';
    capturedPhoto = null;
    // kembali ke viewfinder
    cameraMode = 'viewfinder';
    capturedPhoto = null;
  }

  function closeCameraModal() {
    showCameraModal = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    capturedPhoto = null;
    cameraMode = 'viewfinder';
  }

  function openMediaPreview(msg: any) {
    if (!msg.file_url) return;
    const type = (msg.type === 'image' || msg.type === 'audio') ? msg.type : 'file';
    mediaPreview = {
      type,
      url: msg.file_url,
      name: msg.message && msg.message !== '🎤 Voice Note' ? msg.message : undefined,
      caption: msg.message && msg.message !== '🎤 Voice Note' ? msg.message : null,
    };
  }

  onMount(async () => {
    if (!auth.token) return goto('/login');
    await fetchHistory();
    connectWebSocket();
    // Tutup context-menu saat klik di luar menu (tanpa overlay)
    const onDocDown = (e: any) => {
      if (!contextMenuVisible) return;
      const menu = (e.target as HTMLElement)?.closest?.('.ctx-bubble-menu');
      if (!menu) closeContextMenu();
    };
    window.addEventListener('mousedown', onDocDown);
    window.addEventListener('touchstart', onDocDown);
    documentDownListener = onDocDown;
  });

  let documentDownListener: ((e: any) => void) | null = null;

  onDestroy(() => {
    isLeaving = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    if (documentDownListener) {
      window.removeEventListener('mousedown', documentDownListener);
      window.removeEventListener('touchstart', documentDownListener);
    }
  });

  async function fetchHistory() {
    try {
      let url = `${API_URL}/chat/history`;
      if (savingId) url += `?saving_id=${savingId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await readApiJson<{ room_id?: string; messages?: any[] }>(res);
      if (res.ok) {
        roomId = data.room_id || null;
        messages = data.messages || [];
        scrollToBottom();
      }
    } catch(e) {}
  }

  function sendReadReceipt() {
    // Kirim status 'read' ke server: pesan sampai id ini sudah dilihat pengguna.
    // Server menandai pesan dari pasangan (id <= last_seen_id) sbg dibaca
    // & memberitahu pasangan agar pesan mereka tampil centang biru.
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let lastSeenId = 0;
    for (const m of messages) {
      if (!m.is_deleted && m.id > lastSeenId) lastSeenId = m.id;
    }
    if (lastSeenId <= 0) return;
    ws.send(JSON.stringify({ type: 'read', data: { last_id: lastSeenId } }));
  }

  function connectWebSocket() {
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/chat/ws';
    const params = new URLSearchParams({ token: auth.token || '' });
    if (savingId) params.set('saving_id', savingId);
    try {
      ws = new WebSocket(`${wsUrl}?${params.toString()}`);
    } catch (e) { ws = null; }
    if (!ws) return;
    
    ws.onopen = () => { connected = true; reconnectAttempts = 0; sendReadReceipt(); };
    ws.onclose = async () => {
      connected = false;
      if (!auth.token) return;
      if (isLeaving) return;
      // Verifikasi token lewat REST sebelum memutuskan reconnect
      // (jika token invalid/expired untuk WebSocket, cek juga ke REST)
      if (reconnectAttempts >= 3) {
        try {
          const check = await fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
          if (!check.ok) { auth.logout(); goto('/login'); return; }
        } catch (_) { /* network error — coba lagi */ }
        // REST ok tapi WebSocket ditolak → mungkin masalah routing, coba lagi
      }
      if (!reconnectTimer) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 8000);
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectWebSocket();
        }, delay);
      }
    };
    ws.onerror = () => { connected = false; };
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'delete') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, is_deleted: true } : m);
        } else if (msg.type === 'pin') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, is_pinned: msg.data.is_pinned } : m);
        } else if (msg.type === 'star') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, is_starred: msg.data.is_starred } : m);
        } else if (msg.type === 'edit') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, message: msg.data.message, is_edited: true } : m);
        } else if (msg.type === 'react') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, reactions: msg.data.reactions } : m);
        } else if (msg.type === 'read') {
          // Pesan dari kita yang sudah dibaca pasangan → 2 centang biru
          const lastId = msg.data?.last_id;
          if (lastId != null) {
            messages = messages.map(m =>
              m.sender_id === auth.user?.id && m.id <= lastId ? { ...m, is_read: 1 } : m
            );
          }
        } else if (msg.type === 'chat' && msg.data) {
          const optimisticIndex = messages.findIndex(m =>
            m.id >= 1000000000000 &&
            m.sender_id === msg.data.sender_id &&
            m.message === msg.data.message
          );
          if (optimisticIndex >= 0) {
            messages = messages.map((m, index) => index === optimisticIndex ? msg.data : m);
          } else if (!messages.some(m => m.id === msg.data.id)) {
            messages = [...messages, msg.data];
          }
          scrollToBottom();
          if (msg.data.sender_id !== auth.user?.id) {
            showToast(`Pesan baru${msg.data.type !== 'text' ? ' (' + msg.data.type + ')' : ': "' + msg.data.message + '"'}`);
            // Beri tahu pasangan bahwa pesan mereka sudah terbaca
            sendReadReceipt();
          }
        }
      } catch(e) {}
    };
  }

  function handleTouchStart(e: any, msg: any) {
    if (msg.is_deleted) return;
    longPressTimer = setTimeout(() => {
      const touch = e.touches ? e.touches[0] : e;
      contextMenuPos = { x: touch.clientX, y: touch.clientY };
      // Tentukan arah buka menu: jika bubble dekat bawah, buka ke atas
      const el = document.getElementById('msg-' + msg.id);
      if (el && typeof window !== 'undefined') {
        const rect = el.getBoundingClientRect();
        menuDirection = (rect.bottom + 360 > window.innerHeight) ? 'up' : 'down';
      } else {
        menuDirection = (touch.clientY + 360 > window.innerHeight) ? 'up' : 'down';
      }
      contextMessage = msg;
      contextMenuVisible = true;
    }, 500); // 500ms long press
  }

  function handleTouchEnd() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  function closeContextMenu() {
    contextMenuVisible = false;
    contextMessage = null;
  }

  function showToast(text: string) {
    toast = text;
    setTimeout(() => { toast = null; }, 3000);
  }

  async function sendMessage(e?: Event) {
    if (e) e.preventDefault();
    if (!roomId) return;
    
    let msgText = newMessage.trim();
    let msgType = 'text';
    let fileUrl = null;
    
    if (attachmentPreview) {
      msgType = attachment?.type.startsWith('image/') ? 'image' : 'file';
      fileUrl = attachmentPreview; // Optimistic
    }
    
    if (!msgText && !attachmentPreview) return;
    
    newMessage = '';
    const tempCreatedAt = new Date().toISOString();
    const tempMsg = { 
      id: Date.now(), 
      sender_id: auth.user?.id, 
      message: msgText, 
      type: msgType,
      file_url: fileUrl,
      reply_to_id: replyingTo?.id || null,
      created_at: tempCreatedAt,
      _sent: true // menandai belum mendapat ack dari server (1 centang)
    };
    
    messages = [...messages, tempMsg];
    scrollToBottom();

    let uploadedUrl = null;
    if (attachment) {
      const formData = new FormData();
      formData.append('file', attachment);
      try {
        const uploadRes = await fetch(`${API_URL}/chat/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}` },
          body: formData
        });
        if (!uploadRes.ok) throw new Error('Upload gagal');
        const uploadData = await readApiJson<{ url?: string }>(uploadRes);
        if (!uploadData.url) throw new Error('Upload gagal');
        uploadedUrl = uploadData.url;
        tempMsg.file_url = uploadedUrl;
      } catch (e) {
        showToast('Gagal mengunggah file');
        return;
      }
    }
    
    const replyId = replyingTo?.id;
    replyingTo = null;
    attachment = null;
    attachmentPreview = null;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', data: {
        sender_id: auth.user?.id,
        message: msgText,
        type: msgType,
        file_url: uploadedUrl,
        reply_to_id: replyId
      }}));
    } else {
      showToast('Chat sedang menghubungkan ulang');
    }
  }

  async function deleteMessage(id: number) {
    if (!confirm('Hapus pesan ini?')) return;
    try {
      messages = messages.map(m => m.id === id ? { ...m, is_deleted: true } : m);
      await fetch(`${API_URL}/chat/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'delete', data: { id } }));
      }
    } catch (e) {}
  }

  let pinDurationVisible = $state(false);
  let pinTargetMsg = $state<any | null>(null);

  function openPinMenu(msg: any) {
    pinTargetMsg = msg;
    if (msg.is_pinned) {
      // Unpin immediately
      const isPinnedNow = false;
      messages = messages.map(m => m.id === msg.id ? { ...m, is_pinned: isPinnedNow } : m);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pin', data: { id: msg.id, is_pinned: isPinnedNow } }));
      }
    } else {
      pinDurationVisible = true;
    }
  }

  function pinWithDuration(hours: number) {
    if (!pinTargetMsg) return;
    messages = messages.map(m => m.id === pinTargetMsg.id ? { ...m, is_pinned: true } : m);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'pin', data: { id: pinTargetMsg.id, is_pinned: true, duration_hours: hours } }));
    }
    pinDurationVisible = false;
    pinTargetMsg = null;
  }

  function toggleStar(msg: any) {
    const isStarredNow = !msg.is_starred;
    messages = messages.map(m => m.id === msg.id ? { ...m, is_starred: isStarredNow } : m);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'star', data: { id: msg.id, is_starred: isStarredNow } }));
    }
  }

  let editingMsg = $state<any | null>(null);
  let editText = $state('');

  function startEdit(msg: any) {
    editingMsg = msg;
    editText = msg.message;
  }

  function cancelEdit() {
    editingMsg = null;
    editText = '';
  }

  function submitEdit() {
    if (!editingMsg || !editText.trim()) return;
    const newText = editText.trim();
    messages = messages.map(m => m.id === editingMsg.id ? { ...m, message: newText, is_edited: true } : m);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'edit', data: { id: editingMsg.id, message: newText } }));
    }
    editingMsg = null;
    editText = '';
  }

  function sendReaction(msg: any, emoji: string) {
    const userId = auth.user?.id;
    if (!userId) return;
    const reactionsObj = msg.reactions ? JSON.parse(msg.reactions) : {};
    // Toggle same reaction off
    if (reactionsObj[userId] === emoji) {
      delete reactionsObj[userId];
    } else {
      reactionsObj[userId] = emoji;
    }
    const reactionsStr = JSON.stringify(reactionsObj);
    messages = messages.map(m => m.id === msg.id ? { ...m, reactions: reactionsStr } : m);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'react', data: { id: msg.id, emoji: reactionsObj[userId] || null } }));
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => showToast('Pesan disalin'));
  }

  function getReactionSummary(reactionsStr: string | null): {emoji: string, count: number}[] {
    if (!reactionsStr) return [];
    try {
      const obj: Record<string, string> = JSON.parse(reactionsStr);
      const counts: Record<string, number> = {};
      for (const emoji of Object.values(obj)) {
        counts[emoji] = (counts[emoji] || 0) + 1;
      }
      return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
    } catch(e) { return []; }
  }

  function getDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();
    
    if (isToday) return 'Hari ini';
    if (isYesterday) return 'Kemarin';

    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return d.toLocaleDateString('id-ID', { weekday: 'long' });
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Build grouped messages with date dividers
  let messagesWithDividers = $derived.by(() => {
    const result: any[] = [];
    let lastDateLabel = '';
    for (const msg of messages) {
      const label = getDateLabel(msg.created_at);
      if (label !== lastDateLabel) {
        result.push({ isDivider: true, label });
        lastDateLabel = label;
      }
      result.push(msg);
    }
    return result;
  });

  function handleFileSelect(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    attachment = file;
    attachmentPreview = URL.createObjectURL(file);
    if (!newMessage) newMessage = file.name;
  }

  function handleCameraSelect(e: any) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    attachment = file;
    attachmentPreview = URL.createObjectURL(file);
    if (!newMessage) newMessage = file.name;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        attachment = file;
        attachmentPreview = URL.createObjectURL(file);
        newMessage = '🎤 Voice Note';
      };
      mediaRecorder.start();
      isRecording = true;
    } catch (e) {
      showToast('Gagal mengakses mikrofon');
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  function handleReply(msg: any) {
    replyingTo = msg;
  }

  function addEmoji(emoji: string) {
    newMessage += emoji;
    showEmojiPicker = false;
  }

  async function scrollToBottom() {
    await tick();
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }
</script>

<!-- Edit overlay -->
{#if editingMsg}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="context-overlay" onclick={cancelEdit}></div>
  <div class="edit-modal">
    <p class="edit-modal__title">Edit Pesan</p>
    <textarea class="edit-modal__input" bind:value={editText} rows="3"></textarea>
    <div class="edit-modal__actions">
      <button class="edit-modal__btn edit-modal__btn--cancel" onclick={cancelEdit}>Batal</button>
      <button class="edit-modal__btn edit-modal__btn--save" onclick={submitEdit}>Simpan</button>
    </div>
  </div>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- Pin duration modal -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if pinDurationVisible}
  <div class="context-overlay" onclick={() => { pinDurationVisible = false; pinTargetMsg = null; }}></div>
  <div class="pin-duration-modal">
    <p class="pin-duration__title">Sematkan selama</p>
    <button class="pin-duration__option" onclick={() => pinWithDuration(24)}>
      <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      24 Jam
    </button>
    <button class="pin-duration__option" onclick={() => pinWithDuration(24 * 7)}>
      <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      7 Hari
    </button>
    <button class="pin-duration__option" onclick={() => pinWithDuration(24 * 30)}>
      <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      30 Hari
    </button>
    <div class="context-divider"></div>
    <button class="pin-duration__option pin-duration__option--cancel" onclick={() => { pinDurationVisible = false; pinTargetMsg = null; }}>
      Batal
    </button>
  </div>
{/if}

<!-- Media Preview -->
<MediaPreview media={mediaPreview} onClose={() => mediaPreview = null} />

<!-- Web Camera Modal (desktop) -->
{#if showCameraModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cam-overlay" onclick={closeCameraModal}></div>
  <div class="cam-modal" role="dialog" aria-modal="true" aria-label="Ambil foto">
    <div class="cam-modal__header">
      <div>
        <p class="cam-modal__label">Kamera</p>
        <h2 class="cam-modal__title">{cameraMode === 'preview' ? 'Pratinjau Foto' : 'Ambil Foto'}</h2>
      </div>
      <button type="button" class="cam-modal__close" onclick={closeCameraModal} aria-label="Tutup kamera">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="cam-modal__body">
      {#if cameraError}
        <div class="cam-error">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>{cameraError}</p>
        </div>
      {:else if cameraMode === 'preview' && capturedPhoto}
        <img src={capturedPhoto} alt="Foto" class="cam-photo" />
      {:else}
        <video id="camera-video" class="cam-video" autoplay playsinline></video>
        <div class="cam-loading">
          <p>Menyiapkan kamera...</p>
        </div>
      {/if}
    </div>

    <div class="cam-modal__footer">
      {#if cameraMode === 'preview' && capturedPhoto}
        <button type="button" class="cam-btn cam-btn--ghost" onclick={retakePhoto}>Ulangi</button>
        <button type="button" class="cam-btn cam-btn--primary" onclick={useCapturedPhoto}>Gunakan Foto</button>
      {:else if !cameraError}
        <button type="button" class="cam-btn cam-btn--primary" onclick={capturePhotoFromCamera}>
          <span class="cam-shutter"></span> Jepret
        </button>
      {/if}
    </div>
  </div>
{/if}

<div class="chat-root">

  <!-- Toast Notification -->
  {#if toast}
    <div class="toast-notif" role="alert" aria-live="polite">
      <MessageSquare size={16} /> {toast}
    </div>
  {/if}

  <!-- Header -->
  <div class="chat-header">
    <div class="header-row">
      <button class="back-btn" onclick={() => goto(savingId ? '/savings' : '/home')} aria-label="Kembali">
        <ChevronRight size={20} style="transform: rotate(180deg)" />
      </button>

      <div class="header-avatar {savingId ? 'header-avatar--savings' : 'header-avatar--chat'}">
        <Icon name={savingId ? 'savings' : 'chat'} size={22} />
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
  
  {#if pinnedMessage && !pinnedMessage.is_deleted}
    <div class="pinned-header" onclick={() => {
      const el = document.getElementById('msg-' + pinnedMessage.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }}>
      <div class="pinned-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19M12 17V3M9 3h6"/></svg>
      </div>
      <div class="pinned-content">
        <strong>Pesan Disematkan</strong>
        <p>{pinnedMessage.message || 'Media'}</p>
      </div>
    </div>
  {/if}

  <!-- Messages -->
  <div class="messages-area" bind:this={chatContainer} role="log" aria-label="Riwayat chat" aria-live="polite">
    {#if messages.length === 0}
      <div class="empty-chat">
        <div class="empty-icon">
          <Icon name={savingId ? 'savings' : 'chat'} size={48} />
        </div>
        <p class="empty-title">{savingId ? 'Belum ada diskusi tabungan' : 'Belum ada obrolan'}</p>
        <p class="empty-sub">Sapa pasanganmu sekarang!</p>
      </div>
    {/if}

    {#each messagesWithDividers as item}
      {#if item.isDivider}
        <div class="date-divider">
          <span class="date-divider__label">{item.label}</span>
        </div>
      {:else}
        {@const msg = item}
        {@const isMine = msg.sender_id === auth.user?.id}
        {@const reactions = getReactionSummary(msg.reactions)}
        <div id="msg-{msg.id}"
             class="msg-container {isMine ? 'msg-container--mine' : 'msg-container--theirs'} {swipeMsgId === msg.id && swipeActive ? 'msg-container--swiping' : ''}"
             style={swipeMsgId === msg.id && swipeActive ? `transform: translateX(${swipeCurrentX}px);` : ''}
             onmousedown={(e) => { handleTouchStart(e, msg); swipeDown(e, msg); }}
             onmousemove={(e) => { if (swipeActive && swipeMsgId === msg.id && (e.buttons === 1 || e.buttons > 0)) swipeMove(e, msg); }}
             ontouchstart={(e) => { handleTouchStart(e, msg); swipeDown(e, msg); }}
             ontouchmove={(e) => { if (swipeActive) e.preventDefault(); swipeMove(e, msg); }}
             ontouchend={(e) => { handleTouchEnd(); swipeUp(e, msg); }}
             ontouchcancel={() => { handleTouchEnd(); swipeCancel(); }}
             onmouseup={(e) => { handleTouchEnd(); swipeUp(e, msg); }}
             onmouseleave={(e) => { handleTouchEnd(); swipeUp(e, msg); }}
             role="button"
             tabindex="0">
          {#if swipeMsgId === msg.id && swipeActive && swipeCurrentX > 20}
            <div class="swipe-reply-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              Balas
            </div>
          {/if}
          <div class="msg-bubble {isMine ? 'msg-bubble--mine' : 'msg-bubble--theirs'}">
            {#if msg.is_pinned && !msg.is_deleted}
              <div class="msg-pinned-badge">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none"><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 17H19M12 17V3M9 3h6" stroke="currentColor" stroke-width="2" fill="none"/></svg>
              </div>
            {/if}
            {#if msg.is_deleted}
              <p class="msg-text msg-deleted">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                Pesan ini telah dihapus
              </p>
            {:else}
              {#if msg.reply_to_id}
                {@const replyMsg = messages.find(m => m.id === msg.reply_to_id)}
                {#if replyMsg && !replyMsg.is_deleted}
                  <div class="msg-reply-bubble">
                    <strong>{replyMsg.sender_id === auth.user?.id ? 'Kamu' : 'Pasangan'}</strong>
                    <p>{replyMsg.message || 'Media'}</p>
                  </div>
                {/if}
              {/if}
              
              {#if msg.type === 'image' && msg.file_url}
                <button type="button" class="msg-image-btn" onclick={(e) => { e.stopPropagation(); openMediaPreview(msg); }} aria-label="Pratinjau gambar">
                  <img src={msg.file_url} alt="Attachment" class="msg-image" />
                </button>
              {/if}
              {#if msg.type === 'file' && msg.file_url}
                <button type="button" class="msg-file-card" onclick={(e) => { e.stopPropagation(); openMediaPreview(msg); }} style="width:100%; text-align:left; background:none; border:none; padding:0; cursor:pointer;">
                  <div class="msg-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  </div>
                  <span class="msg-file-name">{msg.message && msg.message !== '🎤 Voice Note' ? msg.message : 'File'}</span>
                </button>
              {/if}
              {#if msg.type === 'audio' && msg.file_url}
                <div class="msg-vn">
                  <button class="msg-vn-play" onclick={(e) => { e.stopPropagation(); const audio = e.currentTarget.parentElement?.querySelector('audio'); if(audio) { audio.paused ? audio.play() : audio.pause(); } }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </button>
                  <button type="button" class="msg-vn-open" onclick={(e) => { e.stopPropagation(); openMediaPreview(msg); }} aria-label="Preview audio">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                  <div class="msg-vn-wave">
                    {#each Array(12) as _, i}
                      <div class="msg-vn-bar" style="height: {10 + Math.sin(i * 1.2) * 8}px;"></div>
                    {/each}
                  </div>
                  <audio src={msg.file_url} style="display:none"></audio>
                </div>
              {/if}
              
              {#if msg.message}
                <p class="msg-text">{msg.message}</p>
              {/if}
            {/if}
            <div class="msg-meta">
              {#if msg.is_edited && !msg.is_deleted}<span class="msg-edited">diperbarui</span>{/if}
              {#if msg.is_starred}<span class="msg-star"><svg width="10" height="10" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>{/if}
              <span class="msg-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              {#if isMine && !msg.is_deleted}
                {#if msg.is_read}
                  <span class="msg-tick msg-tick--read" aria-label="Dibaca">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                  </span>
                {:else if msg._sent}
                  <span class="msg-tick" aria-label="Terkirim">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                {:else}
                  <span class="msg-tick" aria-label="Terikirim ke server">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                  </span>
                {/if}
              {/if}
            </div>
          </div>
          {#if reactions.length > 0}
            <div class="reaction-badges {isMine ? 'reaction-badges--mine' : 'reaction-badges--theirs'}">
              {#each reactions as r}
                <span class="reaction-badge">{r.emoji} {r.count > 1 ? r.count : ''}</span>
              {/each}
            </div>
          {/if}

          {#if contextMenuVisible && contextMessage?.id === msg.id}
            <div class="ctx-bubble-menu {isMine ? 'ctx-bubble-menu--mine' : 'ctx-bubble-menu--theirs'} {menuDirection === 'up' ? 'ctx-bubble-menu--up' : 'ctx-bubble-menu--down'}">
              <!-- Emoji reactions bar -->
              <div class="reaction-bar">
                {#each ['❤️','👍','😂','😮','😢','🙏'] as emoji}
                  <button
                    class="reaction-btn {(contextMessage.reactions && auth.user?.id && JSON.parse(contextMessage.reactions)[auth.user.id] === emoji) ? 'reaction-btn--active' : ''}"
                    onclick={() => { sendReaction(contextMessage, emoji); closeContextMenu(); }}
                    aria-label={emoji}
                  >{emoji}</button>
                {/each}
              </div>
              <div class="context-divider"></div>

              <button class="context-item" onclick={() => { handleReply(contextMessage); closeContextMenu(); }}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6M3 10l6-6"/></svg>
                Balas
              </button>
              <button class="context-item" onclick={() => { copyText(contextMessage.message); closeContextMenu(); }}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Salin
              </button>
              <button class="context-item" onclick={() => { openPinMenu(contextMessage); closeContextMenu(); }}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19M12 17V3M9 3h6"/></svg>
                {contextMessage.is_pinned ? 'Batal Sematkan' : 'Sematkan'}
              </button>
              <button class="context-item" onclick={() => { toggleStar(contextMessage); closeContextMenu(); }}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill={contextMessage.is_starred ? '#FBBF24' : 'none'} stroke={contextMessage.is_starred ? '#FBBF24' : 'currentColor'} stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {contextMessage.is_starred ? 'Batal Bintangi' : 'Bintangi'}
              </button>
              {#if contextMessage.sender_id === auth.user?.id && !contextMessage.is_deleted}
                <button class="context-item" onclick={() => { startEdit(contextMessage); closeContextMenu(); }}>
                  <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              {/if}
              <button class="context-item" onclick={closeContextMenu}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Info
              </button>
              <button class="context-item" onclick={closeContextMenu}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Pilih pesan
              </button>
              {#if contextMessage.sender_id === auth.user?.id && !contextMessage.is_deleted}
                <div class="context-divider"></div>
                <button class="context-item context-item--danger" onclick={() => { deleteMessage(contextMessage.id); closeContextMenu(); }}>
                  <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Hapus
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- Input -->
  <div class="input-area">
    {#if replyingTo}
      <div class="reply-preview">
        <div class="reply-preview__bar"></div>
        <div class="reply-preview__content">
          <strong class="reply-preview__author">Membalas {replyingTo.sender_id === auth.user?.id ? 'Kamu' : 'Pasangan'}</strong>
          <p class="reply-preview__text">{replyingTo.message || 'Media'}</p>
        </div>
        <button type="button" class="reply-preview__close" onclick={() => replyingTo = null}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    {/if}
    {#if attachmentPreview}
      <div class="attachment-preview">
        {#if attachment?.type.startsWith('image/')}
          <img src={attachmentPreview} alt="Preview" class="attachment-thumb" />
        {:else if attachment?.type.startsWith('audio/')}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          <span style="font-size: 13px; font-weight: 700;">Voice Note siap dikirim</span>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <span style="font-size: 13px; font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{attachment?.name}</span>
        {/if}
        <button type="button" class="attachment-close" onclick={() => {attachment = null; attachmentPreview = null}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    {/if}
    <form class="input-form" onsubmit={sendMessage}>
      <input type="file" bind:this={fileInput} onchange={handleFileSelect} style="display: none;" accept="image/*,audio/*,.pdf,.doc,.docx" />
      <input type="file" bind:this={cameraInput} onchange={handleCameraSelect} style="display: none;" accept="image/*" capture="environment" />

      <div class="input-field">
        <button type="button" class="in-field-btn" onclick={(e) => { e.stopPropagation(); showEmojiPicker = !showEmojiPicker; }} aria-label="Emoji">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>

        {#if isRecording}
          <div class="recording-indicator">
            <span class="rec-dot"></span>
            Merekam...
          </div>
        {:else}
          <input
            type="text"
            bind:value={newMessage}
            placeholder="Ketik pesan..."
            class="msg-input"
            aria-label="Ketik pesan"
          />
        {/if}

        <button type="button" class="in-field-btn" onclick={() => fileInput.click()} aria-label="Lampiran">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>
        </button>
        <button type="button" class="in-field-btn" onclick={openCamera} aria-label="Ambil foto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>
        </button>
      </div>

      {#if isRecording}
        <button type="button" class="send-btn" onclick={stopRecording} aria-label="Hentikan rekaman">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
      {:else if !newMessage.trim() && !attachmentPreview}
        <button type="button" class="send-btn" onclick={startRecording} aria-label="Rekam pesan suara">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>
        </button>
      {:else}
        <button
          type="submit"
          disabled={!newMessage.trim() && !attachmentPreview}
          class="send-btn {(newMessage.trim() || attachmentPreview) ? 'send-btn--active' : ''}"
          aria-label="Kirim pesan"
        >
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      {/if}
    </form>

    {#if showEmojiPicker}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="emoji-overlay" onclick={() => showEmojiPicker = false}></div>
      <div class="emoji-picker">
        <div class="emoji-picker__grid">
          {#each emojiList as emoji}
            <button type="button" class="emoji-item" onclick={() => addEmoji(emoji)}>{emoji}</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .chat-root {
    font-family: 'Nunito', sans-serif;
    height: 100vh;
    height: 100dvh;
    background: transparent;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Toast */
  .toast-notif {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    background: #1E293B;
    color: white;
    font-size: 13px;
    font-weight: 800;
    padding: 9px 16px;
    border-radius: 99px;
    box-shadow: 0 8px 24px rgba(30,41,59,0.25);
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    max-width: 85%;
    animation: slide-down 0.3s ease;
  }
  @keyframes slide-down { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

  /* Header — clean & minimal */
  .chat-header {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(226,232,240,0.8);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 20;
    background: #ffffff;
  }
  .header-row {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }
  .back-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: rgba(91, 141, 239,0.1);
    border: 1px solid rgba(91, 141, 239,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4772E8;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .back-btn:hover { background: rgba(91, 141, 239,0.18); }
  .header-avatar {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .header-avatar--chat { background: rgba(91, 141, 239,0.1); color: #4772E8; }
  .header-avatar--savings { background: rgba(16,185,129,0.1); color: #059669; }

  .header-info { flex: 1; min-width: 0; }
  .header-title { font-size: 15px; font-weight: 700; color: #1F2937; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header-status {
    font-size: 12px;
    color: #64748B;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
  }
  .header-status--online { color: #059669; }
  .header-status--offline { color: #94A3B8; }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .header-status--online .status-dot { background: #10B981; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
  .header-status--offline .status-dot { background: #94A3B8; }

  /* Messages */
  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: thin;
    scrollbar-color: #CBD5E1 transparent;
  }
  .messages-area::-webkit-scrollbar { width: 6px; }
  .messages-area::-webkit-scrollbar-track { background: transparent; }
  .messages-area::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }

  /* Empty */
  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    text-align: center;
    color: #94A3B8;
  }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 15px; font-weight: 900; color: #1E293B; margin: 0 0 5px; }
  .empty-sub { font-size: 13px; color: #94A3B8; margin: 0; }

  /* Messages */
  .msg-container {
    display: flex;
    margin-bottom: 2px;
    position: relative;
    transition: transform 0.2s ease;
  }
  .msg-container--mine { justify-content: flex-end; }
  .msg-container--theirs { justify-content: flex-start; }
  .msg-container--swiping { transition: none; }

  .msg-bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 18px;
    line-height: 1.4;
    animation: fade-in 0.2s ease;
  }
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .msg-bubble--mine {
    background: linear-gradient(135deg, #5B8DEF, #4772E8);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 3px 12px rgba(71, 114, 232, 0.35);
  }
  .msg-bubble--theirs {
    background: linear-gradient(135deg, #8E7BF0, #7A63E6);
    color: white;
    border-bottom-left-radius: 4px;
    box-shadow: 0 3px 12px rgba(122, 99, 230, 0.35);
  }

  /* Swipe-to-reply hint */
  .swipe-reply-hint {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 20px;
    background: rgba(142,123,240,0.9);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(122,99,230,0.3);
    z-index: 5;
  }

  .msg-text { font-size: 14px; font-weight: 600; margin: 0 0 3px; word-wrap: break-word; }
  .msg-pinned-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    opacity: 0.75;
    background: rgba(255,255,255,0.2);
    border-radius: 999px;
    padding: 2px 8px;
    margin-bottom: 5px;
    letter-spacing: 0.3px;
  }
  .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 2px; }
  .msg-time { font-size: 11px; margin: 0; opacity: 0.65; font-weight: 700; }
  .msg-edited { font-size: 10px; opacity: 0.6; font-style: italic; }
  .msg-star { font-size: 11px; }
  .msg-tick { display: inline-flex; align-items: center; color: rgba(255,255,255,0.8); margin-left: 1px; }
  .msg-tick--read { color: #7FD3FF; }

  /* Date divider */
  .date-divider { display: flex; align-items: center; justify-content: center; margin: 12px 0 4px; }
  .date-divider__label { font-size: 12px; font-weight: 700; color: #64748B; background: #E2E8F0; border-radius: 999px; padding: 3px 12px; }
  
  /* Reaction badges */
  .reaction-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; padding: 0 4px; }
  .reaction-badges--mine { justify-content: flex-end; }
  .reaction-badges--theirs { justify-content: flex-start; }
  .reaction-badge { background: white; border: 1.5px solid #E2E8F0; border-radius: 999px; padding: 2px 7px; font-size: 13px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); cursor: pointer; }

  /* Message contents */
  .msg-image { max-width: 100%; border-radius: 10px; margin-bottom: 4px; display: block; }
  .msg-image-btn { display: block; width: 100%; padding: 0; border: none; background: none; cursor: pointer; }
  .msg-deleted { font-style: italic; opacity: 0.8; display: flex; align-items: center; gap: 6px; }

  /* File card */
  .msg-file-card { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.18); border-radius: 10px; padding: 10px 12px; margin-bottom: 4px; text-decoration: none; color: inherit; transition: background 0.15s; }
  .msg-file-card:hover { background: rgba(255,255,255,0.28); }
  .msg-file-icon { background: rgba(255,255,255,0.25); border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .msg-file-name { font-size: 13px; font-weight: 700; word-break: break-all; }

  /* Voice Note */
  .msg-vn { display: flex; align-items: center; gap: 10px; padding: 6px 4px; min-width: 180px; }
  .msg-vn-play { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.25); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: white; transition: background 0.15s; }
  .msg-vn-play:hover { background: rgba(255,255,255,0.4); }
  .msg-vn-open { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.18); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: white; transition: background 0.15s; }
  .msg-vn-open:hover { background: rgba(255,255,255,0.35); }
  .msg-vn-wave { display: flex; align-items: center; gap: 2px; flex: 1; }
  .msg-vn-bar { width: 3px; background: rgba(255,255,255,0.7); border-radius: 2px; flex-shrink: 0; }

  /* Reply preview bar above input */
  .reply-preview { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #EFF6FF; border-radius: 10px; margin-bottom: 8px; }
  .reply-preview__bar { width: 3px; height: 36px; background: #6BAFF2; border-radius: 3px; flex-shrink: 0; }
  .reply-preview__content { flex: 1; overflow: hidden; }
  .reply-preview__author { font-size: 12px; font-weight: 800; color: #6BAFF2; display: block; margin-bottom: 2px; }
  .reply-preview__text { margin: 0; font-size: 12px; color: #64748B; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .reply-preview__close { background: none; border: none; cursor: pointer; color: #94A3B8; padding: 4px; display: flex; align-items: center; }

  /* Attachment preview bar */
  .attachment-thumb { max-height: 60px; border-radius: 6px; }
  .attachment-close { background: none; border: none; cursor: pointer; color: #94A3B8; padding: 4px; display: flex; align-items: center; margin-left: auto; }

  /* Recording indicator */
  .recording-indicator { flex: 1; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #EF4444; padding: 0 8px; }
  .rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #EF4444; animation: pulse 1s infinite; flex-shrink: 0; }
  .action-btn:hover { opacity: 1; }
  .delete-btn { color: #F43F5E; }
  .msg-reply-bubble { background: rgba(0,0,0,0.1); border-left: 3px solid rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; font-size: 12px; }
  .attachment-preview { padding: 8px; display: flex; gap: 8px; align-items: center; background: #EFF6FF; border-radius: 8px; margin-bottom: 8px; }
  .attachment-preview img { max-height: 60px; border-radius: 4px; }

  @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

  /* Context Menu — menempel di bubble (konsep khwarizmi) */
  .ctx-bubble-menu {
    position: absolute;
    z-index: 300;
    background: rgba(255,255,255,0.96);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(31,60,110,0.22);
    width: 224px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    animation: menu-in 0.16s cubic-bezier(0.34,1.56,0.64,1);
  }
  /* Buka ke bawah (di bawah bubble) */
  .ctx-bubble-menu--down { top: calc(100% + 6px); }
  /* Buka ke atas (di atas bubble) */
  .ctx-bubble-menu--up { bottom: calc(100% + 6px); }
  /* Posisi horizontal: pesan sendiri di kanan, pesan pasangan di kiri */
  .ctx-bubble-menu--mine { right: 0; }
  .ctx-bubble-menu--theirs { left: 0; }
  @keyframes menu-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }

  /* Reaction Bar */
  .reaction-bar { display: flex; align-items: center; justify-content: space-around; padding: 14px 12px 10px; gap: 4px; }
  .reaction-btn { background: none; border: none; font-size: 26px; cursor: pointer; border-radius: 50%; padding: 6px; transition: transform 0.15s, background 0.15s; }
  .reaction-btn:hover { transform: scale(1.3); background: #F1F5F9; }
  .reaction-btn--active { background: #DBEAFE; transform: scale(1.15); }

  .context-item { padding: 13px 18px; border: none; background: none; text-align: left; font-size: 15px; font-weight: 600; color: #1E293B; cursor: pointer; display: flex; align-items: center; gap: 14px; transition: background 0.15s; width: 100%; }
  .context-item:hover { background: #F8FAFC; }
  .context-item--danger { color: #F43F5E; }
  .context-item--danger:hover { background: #FFF1F2; }
  .context-divider { height: 1px; background: #E2E8F0; margin: 2px 0; }
  .ctx-icon { width: 18px; height: 18px; flex-shrink: 0; }

  /* Edit Modal */
  .edit-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    width: min(340px, 90vw);
    z-index: 101;
    padding: 20px;
    animation: scale-in-center 0.18s ease;
  }
  @keyframes scale-in-center { from { opacity: 0; transform: translate(-50%,-50%) scale(0.9); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
  .edit-modal__title { font-size: 16px; font-weight: 800; color: #1E293B; margin: 0 0 12px; }
  .edit-modal__input { width: 100%; border: 1.5px solid #E0E7FF; border-radius: 10px; padding: 10px 12px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 600; resize: none; box-sizing: border-box; }
  .edit-modal__input:focus { outline: none; border-color: #6BAFF2; }
  .edit-modal__actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
  .edit-modal__btn { padding: 8px 20px; border-radius: 20px; border: none; font-weight: 700; cursor: pointer; font-size: 14px; }
  .edit-modal__btn--cancel { background: #F1F5F9; color: #64748B; }
  .edit-modal__btn--save { background: linear-gradient(135deg, #5B8DEF, #4772E8); color: white; }

  /* Pinned Message */
  .pinned-header { padding: 10px 16px; background: #ffffff; border-bottom: 1px solid rgba(226,232,240,0.8); display: flex; gap: 10px; align-items: center; cursor: pointer; transition: background 0.2s; flex-shrink: 0; z-index: 10; }
  .pinned-header:hover { background: #F8FAFC; }
  .pinned-icon { font-size: 16px; color: #4772E8; display: flex; }
  .pinned-content { flex: 1; overflow: hidden; }
  .pinned-content strong { display: block; font-size: 12px; color: #4772E8; margin-bottom: 2px; }
  .pinned-content p { margin: 0; font-size: 13px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Input — clean composer */
  .input-area {
    padding: 12px 14px;
    background: #ffffff;
    border-top: 1px solid rgba(226,232,240,0.8);
    flex-shrink: 0;
    position: relative;
    z-index: 20;
  }
  .input-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .input-field {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .in-field-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: #94A3B8;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .in-field-btn:hover { background: #fff; color: #5B8DEF; }
  .in-field-btn:first-child { left: 6px; }
  .in-field-btn:nth-child(3) { right: 42px; }
  .in-field-btn:nth-child(4) { right: 6px; }
  .recording-indicator {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 20px;
    border-radius: 24px;
    background: #F1F5F9;
    color: #EF4444;
    font-size: 14px;
    font-weight: 700;
  }
  .msg-input {
    width: 100%;
    border: 1px solid rgba(226,232,240,0.9);
    border-radius: 24px;
    padding: 11px 96px 11px 46px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #1F2937;
    outline: none;
    background: #F8FAFC;
    box-shadow: inset 0 2px 4px 0 rgba(148,163,184,0.1);
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .msg-input::placeholder { color: #94A3B8; }
  .msg-input:focus {
    border-color: #8E7BF0;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(142,123,240,0.18);
  }

  /* Emoji picker */
  .emoji-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: transparent;
  }
  .emoji-picker {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 14px;
    right: 14px;
    z-index: 41;
    max-height: 220px;
    overflow-y: auto;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid rgba(226,232,240,0.8);
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    box-shadow: 0 20px 50px -12px rgba(31,60,110,0.3), inset 0 1px 0 rgba(255,255,255,0.9);
  }
  .emoji-picker__grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  }
  .emoji-item {
    width: 100%;
    aspect-ratio: 1;
    border: none;
    background: transparent;
    font-size: 20px;
    cursor: pointer;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, transform 0.1s;
  }
  .emoji-item:hover { background: rgba(91,141,239,0.12); transform: scale(1.1); }

  .send-btn {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #5B8DEF, #8E7BF0);
    color: #ffffff;
    border-bottom: 2px solid rgba(122,99,230,0.9);
    box-shadow: 0 3px 0 0 rgba(82,98,222,0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .send-btn:hover:not(:disabled) { transform: translateY(1px); box-shadow: 0 2px 0 0 rgba(82,98,222,0.9); }
  .send-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: none; }
  .send-btn--active {
    background: linear-gradient(135deg, #5B8DEF, #4772E8);
  }

  /* Pin duration modal */
  .pin-duration-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    width: min(280px, 85vw);
    z-index: 101;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: scale-in 0.18s cubic-bezier(0.34,1.56,0.64,1);
  }
  .pin-duration__title {
    font-size: 13px;
    font-weight: 800;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 14px 18px 8px;
    margin: 0;
  }
  .pin-duration__option {
    padding: 13px 18px;
    border: none;
    background: none;
    text-align: left;
    font-size: 15px;
    font-weight: 600;
    color: #1E293B;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: background 0.15s;
    width: 100%;
  }
  .pin-duration__option:hover { background: #F8FAFC; }
  .pin-duration__option--cancel { color: #64748B; font-weight: 700; }

  /* Pinned badge icon only */
  .msg-pinned-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: rgba(255,255,255,0.25);
    border-radius: 50%;
    margin-bottom: 5px;
    opacity: 0.85;
  }

  /* Web camera modal (desktop) */
  .cam-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(15,23,42,0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .cam-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 61;
    width: 92%;
    max-width: 420px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.75);
    background: #fff;
    box-shadow: 0 24px 60px -12px rgba(31,60,110,0.35);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .cam-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(226,232,240,0.8);
  }
  .cam-modal__label {
    margin: 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #8E7BF0;
  }
  .cam-modal__title { margin: 2px 0 0; font-size: 16px; font-weight: 800; color: #1F2937; }
  .cam-modal__close {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    border: 1px solid rgba(226,232,240,0.9);
    background: #fff;
    color: #64748B;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 0 0 #E2E8F0;
    transition: all .15s ease;
  }
  .cam-modal__close:hover { transform: translateY(1px); box-shadow: 0 1px 0 0 #E2E8F0; }
  .cam-modal__close:active { transform: translateY(1px); box-shadow: none; }
  .cam-modal__body {
    position: relative;
    min-height: 320px;
    background: #0F172A;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .cam-video {
    width: 100%;
    height: 320px;
    object-fit: cover;
  }
  .cam-photo {
    width: 100%;
    max-height: 420px;
    object-fit: contain;
  }
  .cam-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #CBD5E1;
    font-size: 13px;
    font-weight: 700;
  }
  .cam-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 24px;
    text-align: center;
    color: #E2E8F0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
  }
  .cam-modal__footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-top: 1px solid rgba(226,232,240,0.8);
  }
  .cam-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    border: none;
    transition: all .15s ease;
  }
  .cam-btn--ghost {
    background: #F8FAFC;
    color: #475569;
    border: 1px solid rgba(226,232,240,0.9);
    box-shadow: 0 2px 0 0 #E2E8F0;
  }
  .cam-btn--ghost:hover { transform: translateY(1px); box-shadow: 0 1px 0 0 #E2E8F0; }
  .cam-btn--primary {
    color: #fff;
    background: linear-gradient(135deg,#5B8DEF,#8E7BF0);
    box-shadow: 0 3px 0 0 rgba(122,99,230,0.9);
  }
  .cam-btn--primary:hover { transform: translateY(1px); box-shadow: 0 2px 0 0 rgba(122,99,230,0.9); }
  .cam-btn--primary:active { transform: translateY(2px); box-shadow: none; }
  .cam-shutter {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
  }
</style>

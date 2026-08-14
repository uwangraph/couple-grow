<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, onDestroy, tick } from 'svelte';
  import { MessageSquare, ChevronRight } from '@lucide/svelte';
  import Icon from '$lib/Icon.svelte';
  import MediaPreview from '$lib/components/MediaPreview.svelte';
  import ForwardModal from '$lib/components/chat/ForwardModal.svelte';
  import RoomInfoPanel from '$lib/components/chat/RoomInfoPanel.svelte';
  import { Capacitor } from '@capacitor/core';

  let savingId = $derived(page.url.searchParams.get('saving_id'));
  let savingName = $derived(page.url.searchParams.get('saving_name'));
  let chatTitle = $derived(savingName ? `${decodeURIComponent(savingName)}` : 'Pasanganku');
  let chatSubtitle = $derived(savingName ? 'Chat Tabungan' : 'Global Chat');

  const VOICE_NOTE_LABEL = '🎤 Voice Note';
  const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // sesuai batas /chat/upload

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
  let imageInput: HTMLInputElement;
  let docInput: HTMLInputElement;
  let cameraInput: HTMLInputElement;

  let replyingTo = $state<any | null>(null);

  // Lampiran bisa lebih dari satu; teks yang diketik jadi caption lampiran pertama.
  type PendingFile = { file: File; previewUrl: string; type: 'image' | 'audio' | 'file' };
  let pendingFiles = $state<PendingFile[]>([]);

  let isSending = $state(false);
  let isUploading = $state(false);

  let contextMenuVisible = $state(false);
  let contextMessage = $state<any | null>(null);
  let longPressTimer: any = null;
  // Sematan yang sudah lewat masa berlakunya tidak ditampilkan.
  let pinnedMessage = $derived(messages.find(m =>
    m.is_pinned && !m.is_deleted &&
    (!m.pin_expires_at || new Date(m.pin_expires_at).getTime() > Date.now())
  ));

  // Context menu membuka ke atas atau bawah dari bubble (konsep khwarizmi)
  let menuDirection = $state<'up' | 'down'>('down');

  // Swipe-to-reply state
  let swipeMsgId = $state<number | string | null>(null);
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

  // ── Emoji picker berkategori ───────────────────────────────────
  let showEmojiPicker = $state(false);
  type EmojiCategory = 'wajah' | 'hewan' | 'makanan' | 'aktivitas' | 'perjalanan' | 'benda' | 'simbol';
  let emojiCategory = $state<EmojiCategory>('wajah');
  const emojiGroups: Record<EmojiCategory, string[]> = {
    wajah: ['😀','😄','😁','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😛','😜','🤪','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😢','😭','😤','😠','😡','🤯','😳','🥵','🥶','😱','😨','😰','😥','🥺','🤗','🤔','🤭','🤫','😐','😑','🙄','😮','😲','🥱','😴','🤤','😪','🤐','🤢','🤮','🤧','😷','🤒','🤕','🤠','🤡','👻','👽','🤖','💀','👋','✋','👍','👎','👌','🤌','✌️','🤞','🤟','🤙','👏','🙌','🤝','🙏','💪','🫶'],
    hewan: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦄','🐝','🐛','🦋','🐌','🐞','🐢','🐍','🦖','🐙','🦑','🦀','🐠','🐬','🐳','🦈','🌸','🌹','🌻','🌲','🌵','🍀','🌈','☀️','🌙','⭐','🌍'],
    makanan: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🥦','🥗','🍞','🥐','🧀','🥚','🍳','🥞','🍔','🍟','🍕','🌭','🍿','🍣','🍜','🍝','🍩','🍪','🍫','🍬','🍭','☕','🍰','🎂','🧋','🍺'],
    aktivitas: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥊','🥋','🛹','🎿','🏆','🥇','🥈','🥉','🎯','🎮','🕹️','🎲','🧩','🎭','🎨','🎬','🎤','🎧','🎹','🥁','🎺','🎸','🎻','🎉','🎊','🎁','🎈','🧸','🎳','🎣','🏹'],
    perjalanan: ['🚗','🚕','🚌','🏎️','🚓','🚑','🚒','🚚','🛵','🚲','🚏','✈️','🛫','🛬','🚀','🛸','🚁','⛵','🚤','⚓','🏠','🏢','🏫','🏰','🗼','🌋','🏖️','🏝️','🌅','🌃','🗺️','🧭','📍'],
    benda: ['⌚','📱','💻','⌨️','🖥️','🖨️','📷','📸','📹','🎥','📺','📻','🔋','🔌','💡','🔦','📚','📖','📝','📌','📎','📁','📂','📅','⏰','🔒','🔑','🔨','🛠️','🧰','💊','💰','💳','📦','🔍','🔬','🔭','📡'],
    simbol: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💯','✨','🔥','🌟','⚡','💥','💫','✅','❌','❓','❗','⭕','🔔','🔕','♻️','🔞','🆗','🆕','🔣','#️⃣','✔️'],
  };
  const emojiTabs: [EmojiCategory, string][] = [
    ['wajah', '😀'], ['hewan', '🐶'], ['makanan', '🍔'], ['aktivitas', '⚽'],
    ['perjalanan', '🚗'], ['benda', '💡'], ['simbol', '❤️'],
  ];

  // ── Menu lampiran ──────────────────────────────────────────────
  let showAttachMenu = $state(false);

  function toggleEmojiPicker() {
    showEmojiPicker = !showEmojiPicker;
    if (showEmojiPicker) showAttachMenu = false;
  }

  function toggleAttachMenu() {
    showAttachMenu = !showAttachMenu;
    if (showAttachMenu) showEmojiPicker = false;
  }

  // ── Kamera ─────────────────────────────────────────────────────
  let showCameraModal = $state(false);
  let cameraStream = $state<MediaStream | null>(null);
  let cameraError = $state('');
  let cameraMode = $state<'viewfinder' | 'preview'>('viewfinder');
  let capturedPhoto = $state<string | null>(null);
  let cameraFacing = $state<'environment' | 'user'>('environment');

  async function openCamera() {
    showAttachMenu = false;
    showEmojiPicker = false;
    // Di platform native (Capacitor/Android), pakai input capture → buka kamera native.
    if (Capacitor.isNativePlatform()) {
      cameraInput.click();
      return;
    }
    cameraMode = 'viewfinder';
    capturedPhoto = null;
    showCameraModal = true;
    await startCameraStream();
  }

  async function startCameraStream() {
    cameraError = '';
    try {
      cameraStream?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: cameraFacing } },
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

  async function switchCamera() {
    cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    await startCameraStream();
  }

  function capturePhotoFromCamera() {
    const video = document.getElementById('camera-video') as HTMLVideoElement | null;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Kamera depan tampil dicermin, jadi hasil jepretan ikut dicermin.
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.9);
    cameraMode = 'preview';
  }

  function useCapturedPhoto() {
    if (!capturedPhoto) return;
    // Konversi dataURL ke File, lalu tambahkan ke daftar lampiran.
    fetch(capturedPhoto)
      .then(res => res.blob())
      .then((blob) => {
        addPendingFile(new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        closeCameraModal();
      })
      .catch(() => closeCameraModal());
  }

  async function retakePhoto() {
    // Kembali ke viewfinder: elemen <video> dibuat ulang oleh {#if},
    // jadi stream harus dipasang lagi.
    capturedPhoto = null;
    cameraMode = 'viewfinder';
    await tick();
    const video = document.getElementById('camera-video') as HTMLVideoElement | null;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      await video.play().catch(() => {});
    }
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

  // ── Lampiran ───────────────────────────────────────────────────
  function fileKind(file: File): 'image' | 'audio' | 'file' {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  }

  function addPendingFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) return showToast('Ukuran file maksimal 15 MB');
    if (pendingFiles.length >= 10) return showToast('Maksimal 10 lampiran sekaligus');
    pendingFiles = [...pendingFiles, { file, previewUrl: URL.createObjectURL(file), type: fileKind(file) }];
  }

  function removePendingFile(index: number) {
    const item = pendingFiles[index];
    if (item) URL.revokeObjectURL(item.previewUrl);
    pendingFiles = pendingFiles.filter((_, i) => i !== index);
  }

  function clearPendingFiles() {
    for (const item of pendingFiles) URL.revokeObjectURL(item.previewUrl);
    pendingFiles = [];
  }

  function handleFileSelect(e: any) {
    const files: File[] = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of files) addPendingFile(file);
    showAttachMenu = false;
  }

  /** metadata pesan (caption, nama file, durasi VN, waveform). */
  function parseMeta(msg: any): Record<string, any> {
    if (!msg?.metadata) return {};
    if (typeof msg.metadata === 'object') return msg.metadata;
    try {
      const obj = JSON.parse(msg.metadata);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
  }

  function fileLabel(msg: any): string {
    const meta = parseMeta(msg);
    if (meta.name) return meta.name;
    return msg.message && msg.message !== VOICE_NOTE_LABEL ? msg.message : 'File';
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function openMediaPreview(msg: any) {
    if (!msg.file_url) return;
    const type = (msg.type === 'image' || msg.type === 'audio') ? msg.type : 'file';
    const meta = parseMeta(msg);
    const caption = meta.caption ?? (msg.message && msg.message !== VOICE_NOTE_LABEL && msg.message !== meta.name ? msg.message : null);
    mediaPreview = {
      type,
      url: msg.file_url,
      name: meta.name || caption || undefined,
      caption,
    };
  }

  // ── Voice note ─────────────────────────────────────────────────
  let isRecording = $state(false);
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let recordingSeconds = $state(0);
  let recordingWaveform = $state<number[]>([]);
  let recordingTimer: ReturnType<typeof setInterval> | null = null;
  let pendingVoiceNote = $state<{ blob: Blob; url: string; duration: number; waveform: number[] } | null>(null);
  let voiceNotePlaying = $state(false);
  let voiceNotePlayer: HTMLAudioElement | null = null;

  function formatRecordingTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function startRecording() {
    if (pendingVoiceNote) cancelPendingVoiceNote();
    showAttachMenu = false;
    showEmojiPicker = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pilih MIME yang didukung browser (webm/opus di Chrome, mp4/aac di Safari)
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = typeof MediaRecorder !== 'undefined'
        ? candidates.find(t => MediaRecorder.isTypeSupported(t)) || ''
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunks = [];

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const blobType = recorder.mimeType || mimeType || 'audio/webm';

      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close().catch(() => {});
        const blob = new Blob(audioChunks, { type: blobType });
        // Simpan sebagai pratinjau, jangan langsung kirim (pola WhatsApp).
        pendingVoiceNote = { blob, url: URL.createObjectURL(blob), duration: recordingSeconds, waveform: [...recordingWaveform] };
        voiceNotePlaying = false;
        if (voiceNotePlayer) { voiceNotePlayer.pause(); voiceNotePlayer = null; }
      };

      mediaRecorder = recorder;
      isRecording = true;
      recordingSeconds = 0;
      recordingWaveform = [];
      recorder.start();
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        recordingWaveform = [...recordingWaveform.slice(-29), Math.min(100, Math.max(12, (avg / 128) * 100))];
      }, 1000);
    } catch (e) {
      showToast('Gagal mengakses mikrofon');
    }
  }

  function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
    try { if (mediaRecorder.state === 'recording') mediaRecorder.requestData(); } catch (e) {}
    mediaRecorder.stop();
    isRecording = false;
  }

  function toggleVoiceNotePlay() {
    if (!pendingVoiceNote) return;
    if (voiceNotePlaying && voiceNotePlayer) {
      voiceNotePlayer.pause();
      voiceNotePlaying = false;
      return;
    }
    if (!voiceNotePlayer) {
      voiceNotePlayer = new Audio(pendingVoiceNote.url);
      voiceNotePlayer.onended = () => { voiceNotePlaying = false; voiceNotePlayer = null; };
      voiceNotePlayer.onerror = () => { voiceNotePlaying = false; voiceNotePlayer = null; };
    }
    voiceNotePlayer.play().catch(() => { voiceNotePlaying = false; });
    voiceNotePlaying = true;
  }

  function cancelPendingVoiceNote() {
    if (voiceNotePlayer) { voiceNotePlayer.pause(); voiceNotePlayer = null; }
    voiceNotePlaying = false;
    if (pendingVoiceNote) URL.revokeObjectURL(pendingVoiceNote.url);
    pendingVoiceNote = null;
  }

  async function sendPendingVoiceNote() {
    const vn = pendingVoiceNote;
    if (!vn) return;
    const ext = vn.blob.type.includes('mp4') ? 'm4a' : vn.blob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([vn.blob], `vn_${Date.now()}.${ext}`, { type: vn.blob.type || 'audio/webm' });
    const meta = { duration: vn.duration, waveform: vn.waveform };
    cancelPendingVoiceNote();
    await sendOne(file, VOICE_NOTE_LABEL, 'audio', meta);
  }

  // ── Pemutar voice note di bubble ───────────────────────────────
  let playingAudioId = $state<number | string | null>(null);
  let audioProgress = $state(0);
  let audioPlayer: HTMLAudioElement | null = null;

  function toggleAudio(msg: any) {
    if (playingAudioId === msg.id) {
      audioPlayer?.pause();
      playingAudioId = null;
      return;
    }
    audioPlayer?.pause();
    playingAudioId = msg.id;
    audioProgress = 0;
    audioPlayer = new Audio(msg.file_url);
    audioPlayer.onended = () => { playingAudioId = null; audioProgress = 0; };
    audioPlayer.onerror = () => { playingAudioId = null; showToast('Gagal memutar voice note'); };
    audioPlayer.ontimeupdate = () => {
      if (audioPlayer?.duration) audioProgress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    };
    audioPlayer.play().catch(() => { playingAudioId = null; });
  }

  /** Waveform stabil per pesan: dari metadata bila ada, kalau tidak dari id. */
  function waveformFor(msg: any): number[] {
    const meta = parseMeta(msg);
    if (Array.isArray(meta.waveform) && meta.waveform.length > 0) return meta.waveform;
    const seed = String(msg.id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return Array.from({ length: 24 }, (_, i) => 20 + ((seed * (i + 3)) % 70));
  }

  function audioDurationLabel(msg: any): string {
    const meta = parseMeta(msg);
    const duration = Number(meta.duration);
    return Number.isFinite(duration) && duration > 0 ? formatRecordingTime(duration) : '';
  }

  // ── Indikator mengetik ─────────────────────────────────────────
  let partnerTyping = $state(false);
  let typingSentAt = 0;
  let typingStopTimer: ReturnType<typeof setTimeout> | null = null;
  let partnerTypingTimer: ReturnType<typeof setTimeout> | null = null;

  function handleTyping() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Kirim ulang paling cepat tiap 2 detik supaya tidak membanjiri koneksi.
    const now = Date.now();
    if (now - typingSentAt > 2000) {
      typingSentAt = now;
      ws.send(JSON.stringify({ type: 'typing', data: { is_typing: true } }));
    }
    if (typingStopTimer) clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => {
      typingSentAt = 0;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing', data: { is_typing: false } }));
      }
    }, 2500);
  }

  function stopTypingSignal() {
    if (typingStopTimer) { clearTimeout(typingStopTimer); typingStopTimer = null; }
    typingSentAt = 0;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing', data: { is_typing: false } }));
    }
  }

  // ── Riwayat & pagination ───────────────────────────────────────
  let hasMore = $state(false);
  let isLoadingMore = $state(false);

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
    if (recordingTimer) clearInterval(recordingTimer);
    if (typingStopTimer) clearTimeout(typingStopTimer);
    if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
    if (ws) ws.close();
    audioPlayer?.pause();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    cancelPendingVoiceNote();
    clearPendingFiles();
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    if (documentDownListener) {
      window.removeEventListener('mousedown', documentDownListener);
      window.removeEventListener('touchstart', documentDownListener);
    }
  });

  async function fetchHistory() {
    try {
      let url = `${API_URL}/chat/history?limit=40`;
      if (savingId) url += `&saving_id=${savingId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await readApiJson<{ room_id?: string; messages?: any[]; has_more?: boolean; error?: string }>(res);
      if (res.ok) {
        roomId = data.room_id || null;
        hasMore = !!data.has_more;
        // Pesan optimistik yang belum di-ack dipertahankan di akhir daftar.
        const pending = messages.filter(m => m._pending);
        messages = [...(data.messages || []), ...pending];
        scrollToBottom();
      } else {
        showToast(data?.error || 'Gagal memuat riwayat chat');
      }
    } catch (e) {
      showToast('Gagal memuat riwayat chat');
    }
  }

  /** Muat pesan yang lebih lama, pertahankan posisi baca. */
  async function loadOlderMessages() {
    if (isLoadingMore || !hasMore) return;
    const oldest = messages.find(m => typeof m.id === 'number');
    if (!oldest) return;
    isLoadingMore = true;
    const previousHeight = chatContainer?.scrollHeight ?? 0;
    try {
      let url = `${API_URL}/chat/history?limit=40&before=${oldest.id}`;
      if (savingId) url += `&saving_id=${savingId}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await readApiJson<{ messages?: any[]; has_more?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat pesan lama');
      const older = data.messages || [];
      hasMore = !!data.has_more;
      if (older.length > 0) {
        messages = [...older, ...messages];
        await tick();
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight - previousHeight;
      }
    } catch (e: any) {
      showToast(e?.message || 'Gagal memuat pesan lama');
    } finally {
      isLoadingMore = false;
    }
  }

  function handleScroll() {
    if (chatContainer && chatContainer.scrollTop < 60) loadOlderMessages();
  }

  function sendReadReceipt() {
    // Kirim status 'read' ke server: pesan sampai id ini sudah dilihat pengguna.
    // Server menandai pesan dari pasangan (id <= last_seen_id) sbg dibaca
    // & memberitahu pasangan agar pesan mereka tampil centang biru.
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    let lastSeenId = 0;
    for (const m of messages) {
      // Pesan optimistik memakai id string — abaikan.
      if (typeof m.id === 'number' && !m.is_deleted && m.id > lastSeenId) lastSeenId = m.id;
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

    ws.onopen = async () => {
      connected = true;
      const wasReconnect = reconnectAttempts > 0;
      reconnectAttempts = 0;
      // Setelah putus koneksi, ambil ulang riwayat agar pesan yang terlewat masuk.
      if (wasReconnect) await fetchHistory();
      sendReadReceipt();
    };
    ws.onclose = async () => {
      connected = false;
      partnerTyping = false;
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
          messages = messages.map(m => {
            if (m.id === msg.data.id) return { ...m, is_pinned: msg.data.is_pinned, pin_expires_at: msg.data.pin_expires_at ?? null };
            // Hanya satu pesan tersemat per room.
            return msg.data.is_pinned && m.is_pinned ? { ...m, is_pinned: false, pin_expires_at: null } : m;
          });
        } else if (msg.type === 'star') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, is_starred: msg.data.is_starred } : m);
        } else if (msg.type === 'edit') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, message: msg.data.message, is_edited: true } : m);
        } else if (msg.type === 'react') {
          messages = messages.map(m => m.id === msg.data.id ? { ...m, reactions: msg.data.reactions } : m);
        } else if (msg.type === 'typing') {
          partnerTyping = !!msg.data?.is_typing;
          if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
          // Jaring pengaman bila sinyal "berhenti mengetik" tidak pernah sampai.
          if (partnerTyping) partnerTypingTimer = setTimeout(() => { partnerTyping = false; }, 6000);
        } else if (msg.type === 'read') {
          // Pesan dari kita yang sudah dibaca pasangan → 2 centang biru
          const lastId = msg.data?.last_id;
          if (lastId != null) {
            messages = messages.map(m =>
              m.sender_id === auth.user?.id && typeof m.id === 'number' && m.id <= lastId ? { ...m, is_read: 1 } : m
            );
          }
        } else if (msg.type === 'chat' && msg.data) {
          const incoming = msg.data;
          const isMine = incoming.sender_id === auth.user?.id;
          const wasAtBottom = isNearBottom();
          // Ganti placeholder optimistik berdasarkan client_id yang di-echo server.
          const optimisticIndex = incoming.client_id
            ? messages.findIndex(m => m.client_id === incoming.client_id)
            : -1;
          if (optimisticIndex >= 0) {
            const placeholder = messages[optimisticIndex];
            if (placeholder.file_url && placeholder.file_url.startsWith('blob:')) {
              URL.revokeObjectURL(placeholder.file_url);
            }
            messages = messages.map((m, index) => index === optimisticIndex ? incoming : m);
          } else if (!messages.some(m => m.id === incoming.id)) {
            messages = [...messages, incoming];
          }
          if (isMine || wasAtBottom) scrollToBottom();
          if (!isMine) {
            partnerTyping = false;
            showToast(`Pesan baru${incoming.type !== 'text' ? ' (' + incoming.type + ')' : ': "' + incoming.message + '"'}`);
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

  // ── Kirim pesan ────────────────────────────────────────────────

  /** Unggah satu file (bila ada) lalu kirim satu pesan lewat WebSocket. */
  async function sendOne(file: File | null, text: string, type: string, extraMeta: Record<string, any> = {}, replyId: number | null = null) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Chat sedang menghubungkan ulang, coba lagi sebentar');
      return false;
    }

    const clientId = `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localPreview = file ? URL.createObjectURL(file) : null;
    const meta: Record<string, any> = { ...extraMeta };
    if (file) {
      meta.name = file.name;
      meta.size = file.size;
    }
    if (text && type !== 'text') meta.caption = text;

    messages = [...messages, {
      id: clientId,
      client_id: clientId,
      sender_id: auth.user?.id,
      message: text,
      type,
      file_url: localPreview,
      metadata: meta,
      reply_to_id: replyId,
      created_at: new Date().toISOString(),
      _pending: true // belum ada ack dari server → 1 centang
    }];
    scrollToBottom();

    let uploadedUrl: string | null = null;
    if (file) {
      isUploading = true;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const uploadRes = await fetch(`${API_URL}/chat/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}` },
          body: formData
        });
        const uploadData = await readApiJson<{ url?: string; error?: string }>(uploadRes);
        if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData?.error || 'Upload gagal');
        uploadedUrl = uploadData.url;
      } catch (err: any) {
        messages = messages.filter(m => m.client_id !== clientId);
        if (localPreview) URL.revokeObjectURL(localPreview);
        showToast(err?.message || 'Gagal mengunggah file');
        return false;
      } finally {
        isUploading = false;
      }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      messages = messages.filter(m => m.client_id !== clientId);
      if (localPreview) URL.revokeObjectURL(localPreview);
      showToast('Koneksi terputus, pesan tidak terkirim');
      return false;
    }

    ws.send(JSON.stringify({ type: 'chat', data: {
      client_id: clientId,
      message: text,
      type,
      file_url: uploadedUrl,
      metadata: meta,
      reply_to_id: replyId
    }}));
    return true;
  }

  async function sendMessage(e?: Event) {
    if (e) e.preventDefault();
    if (isSending) return;

    // Voice note pratinjau punya alur kirimnya sendiri.
    if (pendingVoiceNote) return sendPendingVoiceNote();

    const files = [...pendingFiles];
    const text = newMessage.trim();
    if (!text && files.length === 0) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Chat sedang menghubungkan ulang, coba lagi sebentar');
      return;
    }

    const replyId = replyingTo?.id ?? null;
    isSending = true;
    newMessage = '';
    replyingTo = null;
    pendingFiles = [];
    stopTypingSignal();

    try {
      if (files.length === 0) {
        const ok = await sendOne(null, text, 'text', {}, replyId);
        if (!ok) newMessage = text;
        return;
      }
      // Teks yang diketik menjadi caption lampiran pertama (pola khwarizmi).
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        const caption = i === 0 ? text : '';
        const label = caption || (item.type === 'audio' ? VOICE_NOTE_LABEL : item.file.name);
        await sendOne(item.file, label, item.type, {}, i === 0 ? replyId : null);
        URL.revokeObjectURL(item.previewUrl);
      }
    } finally {
      isSending = false;
    }
  }

  async function deleteMessage(id: number | string) {
    // Pesan optimistik belum punya id server — tidak bisa dihapus.
    if (typeof id !== 'number') return;
    if (!confirm('Hapus pesan ini?')) return;
    const before = messages;
    messages = messages.map(m => m.id === id ? { ...m, is_deleted: true } : m);
    try {
      const res = await fetch(`${API_URL}/chat/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (!res.ok) throw new Error('gagal');
      // Beri tahu pasangan lewat WebSocket (REST sudah menyimpan perubahan).
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'delete', data: { id } }));
      }
    } catch (e) {
      messages = before;
      showToast('Gagal menghapus pesan');
    }
  }

  let pinDurationVisible = $state(false);
  let pinTargetMsg = $state<any | null>(null);

  function openPinMenu(msg: any) {
    if (typeof msg.id !== 'number') return;
    pinTargetMsg = msg;
    if (msg.is_pinned) {
      // Lepas sematan langsung
      if (sendWs({ type: 'pin', data: { id: msg.id, is_pinned: false } })) {
        messages = messages.map(m => m.id === msg.id ? { ...m, is_pinned: false, pin_expires_at: null } : m);
      }
      pinTargetMsg = null;
    } else {
      pinDurationVisible = true;
    }
  }

  function pinWithDuration(hours: number) {
    if (!pinTargetMsg) return;
    const target = pinTargetMsg;
    const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
    if (sendWs({ type: 'pin', data: { id: target.id, is_pinned: true, duration_hours: hours } })) {
      // Hanya satu pesan tersemat per room.
      messages = messages.map(m =>
        m.id === target.id
          ? { ...m, is_pinned: true, pin_expires_at: expiresAt }
          : (m.is_pinned ? { ...m, is_pinned: false, pin_expires_at: null } : m)
      );
    }
    pinDurationVisible = false;
    pinTargetMsg = null;
  }

  function toggleStar(msg: any) {
    if (typeof msg.id !== 'number') return;
    const isStarredNow = !msg.is_starred;
    if (sendWs({ type: 'star', data: { id: msg.id, is_starred: isStarredNow } })) {
      messages = messages.map(m => m.id === msg.id ? { ...m, is_starred: isStarredNow } : m);
    }
  }

  let editingMsg = $state<any | null>(null);
  let editText = $state('');

  function startEdit(msg: any) {
    if (typeof msg.id !== 'number') return;
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
    const targetId = editingMsg.id;
    if (sendWs({ type: 'edit', data: { id: targetId, message: newText } })) {
      messages = messages.map(m => m.id === targetId ? { ...m, message: newText, is_edited: true } : m);
    }
    editingMsg = null;
    editText = '';
  }

  function parseReactions(reactionsStr: string | null): Record<string, string> {
    if (!reactionsStr) return {};
    try {
      const obj = JSON.parse(reactionsStr);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
  }

  function sendReaction(msg: any, emoji: string) {
    const userId = auth.user?.id;
    if (!userId || typeof msg.id !== 'number') return;
    const reactionsObj = parseReactions(msg.reactions);
    // Reaksi yang sama ditekan lagi → dilepas
    if (reactionsObj[userId] === emoji) {
      delete reactionsObj[userId];
    } else {
      reactionsObj[userId] = emoji;
    }
    const reactionsStr = JSON.stringify(reactionsObj);
    if (sendWs({ type: 'react', data: { id: msg.id, emoji: reactionsObj[userId] || null } })) {
      messages = messages.map(m => m.id === msg.id ? { ...m, reactions: reactionsStr } : m);
    }
  }

  function copyText(text: string) {
    const value = (text || '').trim();
    if (!value) return showToast('Tidak ada teks untuk disalin');
    navigator.clipboard?.writeText(value)
      .then(() => showToast('Pesan disalin'))
      .catch(() => showToast('Gagal menyalin pesan'));
  }

  // ── Teruskan pesan ─────────────────────────────────────────────
  let showForwardModal = $state(false);
  let forwardSource = $state<any | null>(null);
  let forwardRooms = $state<any[]>([]);
  let isForwarding = $state(false);

  async function openForward(msg: any) {
    if (typeof msg.id !== 'number' || msg.is_deleted) return;
    forwardSource = msg;
    showForwardModal = true;
    try {
      const res = await fetch(`${API_URL}/chat/rooms`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await readApiJson<{ rooms?: any[] }>(res);
      // Room yang sedang dibuka tidak perlu jadi tujuan.
      forwardRooms = (data.rooms || []).filter(r => String(r.saving_id ?? '') !== String(savingId ?? ''));
    } catch (e) {
      forwardRooms = [];
      showToast('Gagal memuat daftar chat');
    }
  }

  async function submitForward(targets: any[]) {
    if (!forwardSource || targets.length === 0) return;
    isForwarding = true;
    try {
      const res = await fetch(`${API_URL}/chat/forward`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: forwardSource.id,
          targets: targets.map(t => ({ saving_id: t.saving_id })),
        }),
      });
      const data = await readApiJson<{ forwarded?: any[]; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || 'Gagal meneruskan pesan');
      showToast(`Pesan diteruskan ke ${data.forwarded?.length ?? 0} chat`);
      showForwardModal = false;
      forwardSource = null;
    } catch (e: any) {
      showToast(e?.message || 'Gagal meneruskan pesan');
    } finally {
      isForwarding = false;
    }
  }

  // ── Panel info & aksi room ─────────────────────────────────────
  let showRoomInfo = $state(false);

  let starredMessages = $derived(messages.filter(m => m.is_starred && !m.is_deleted));
  let mediaMessages = $derived(messages.filter(m => m.type === 'image' && m.file_url && !m.is_deleted));
  let fileMessages = $derived(messages.filter(m => (m.type === 'file' || m.type === 'audio') && m.file_url && !m.is_deleted));

  async function clearChat(includeStarred: boolean) {
    try {
      const res = await fetch(`${API_URL}/chat/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ saving_id: savingId, include_starred: includeStarred }),
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || 'Gagal membersihkan chat');
      // Pesan berbintang tetap ada kecuali diminta ikut dibersihkan.
      messages = includeStarred ? [] : messages.filter(m => m.is_starred && !m.is_deleted);
      hasMore = false;
      showRoomInfo = false;
      showToast('Chat dibersihkan untuk kamu');
    } catch (e: any) {
      showToast(e?.message || 'Gagal membersihkan chat');
    }
  }

  async function unstarAll() {
    try {
      const res = await fetch(`${API_URL}/chat/unstar-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ saving_id: savingId }),
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error || 'Gagal melepas bintang');
      messages = messages.map(m => m.is_starred ? { ...m, is_starred: 0 } : m);
      showToast('Semua bintang dilepas');
    } catch (e: any) {
      showToast(e?.message || 'Gagal melepas bintang');
    }
  }

  function jumpToMessage(id: number | string) {
    showRoomInfo = false;
    setTimeout(() => {
      const el = document.getElementById('msg-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else showToast('Pesan ada di riwayat lama, gulir ke atas untuk memuatnya');
    }, 60);
  }

  function getReactionSummary(reactionsStr: string | null): {emoji: string, count: number}[] {
    if (!reactionsStr) return [];
    const obj = parseReactions(reactionsStr);
    const counts: Record<string, number> = {};
    for (const emoji of Object.values(obj)) {
      counts[emoji] = (counts[emoji] || 0) + 1;
    }
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
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

  function handleCameraSelect(e: any) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) addPendingFile(file);
  }

  function handleReply(msg: any) {
    replyingTo = msg;
  }

  function addEmoji(emoji: string) {
    newMessage += emoji;
    handleTyping();
  }

  async function scrollToBottom() {
    await tick();
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  /** Pengguna sedang membaca di dasar daftar (jangan paksa scroll bila tidak). */
  function isNearBottom() {
    if (!chatContainer) return true;
    return chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 120;
  }

  /** Kirim event lewat WebSocket; beri tahu pengguna bila koneksi terputus. */
  function sendWs(payload: unknown) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    showToast('Koneksi terputus, perubahan belum tersimpan');
    return false;
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
        <video id="camera-video" class="cam-video {cameraFacing === 'user' ? 'cam-video--mirror' : ''}" autoplay playsinline></video>
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
        <button type="button" class="cam-btn cam-btn--ghost" onclick={switchCamera} aria-label="Ganti kamera depan/belakang">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
          {cameraFacing === 'user' ? 'Belakang' : 'Depan'}
        </button>
        <button type="button" class="cam-btn cam-btn--primary" onclick={capturePhotoFromCamera}>
          <svg class="cam-shutter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5"/>
            <path d="M12 2.5 8.2 9.1"/>
            <path d="m21.2 7.2-7.6 0"/>
            <path d="m18.6 17.6-3.8-6.6"/>
            <path d="M12 21.5 15.8 14.9"/>
            <path d="m2.8 16.8 7.6 0"/>
            <path d="M5.4 6.4 9.2 13"/>
          </svg>
          Jepret
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
        {#if partnerTyping}
          <p class="header-status header-status--typing">
            <span class="typing-dots"><span></span><span></span><span></span></span>
            sedang mengetik...
          </p>
        {:else}
          <p class="header-status {connected ? 'header-status--online' : 'header-status--offline'}">
            <span class="status-dot"></span>
            {chatSubtitle} • {connected ? 'Terhubung' : 'Offline'}
          </p>
        {/if}
      </div>

      <button class="header-action" onclick={() => (showRoomInfo = true)} aria-label="Info chat">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>
      </button>
    </div>
  </div>
  
  {#if pinnedMessage && !pinnedMessage.is_deleted}
    <button type="button" class="pinned-header" onclick={() => jumpToMessage(pinnedMessage.id)}>
      <div class="pinned-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19M12 17V3M9 3h6"/></svg>
      </div>
      <div class="pinned-content">
        <strong>Pesan Disematkan</strong>
        <p>{pinnedMessage.message || 'Media'}</p>
      </div>
    </button>
  {/if}

  <!-- Latar gelap saat menu pesan terbuka: hanya bubble terpilih & menu yang kontras -->
  {#if contextMenuVisible}
    <div class="ctx-overlay" aria-hidden="true"></div>
  {/if}

  <!-- Messages -->
  <div class="messages-area" bind:this={chatContainer} onscroll={handleScroll} role="log" aria-label="Riwayat chat" aria-live="polite">
    {#if hasMore}
      <div class="load-more">
        <button type="button" class="load-more__btn" onclick={loadOlderMessages} disabled={isLoadingMore}>
          {isLoadingMore ? 'Memuat...' : 'Muat pesan sebelumnya'}
        </button>
      </div>
    {/if}

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
             class="msg-container {isMine ? 'msg-container--mine' : 'msg-container--theirs'} {swipeMsgId === msg.id && swipeActive ? 'msg-container--swiping' : ''} {contextMenuVisible && contextMessage?.id === msg.id ? 'msg-container--selected' : ''} {reactions.length > 0 ? 'msg-container--reacted' : ''}"
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
              
              {#if msg.is_forwarded}
                <div class="msg-forwarded">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                  Diteruskan
                </div>
              {/if}

              {#if msg.type === 'image' && msg.file_url}
                <button type="button" class="msg-image-btn" onclick={(e) => { e.stopPropagation(); openMediaPreview(msg); }} aria-label="Pratinjau gambar">
                  <img src={msg.file_url} alt="Attachment" class="msg-image" />
                </button>
              {/if}
              {#if msg.type === 'file' && msg.file_url}
                {@const meta = parseMeta(msg)}
                <button type="button" class="msg-file-card" onclick={(e) => { e.stopPropagation(); openMediaPreview(msg); }} style="width:100%; text-align:left; background:none; border:none; padding:0; cursor:pointer;">
                  <div class="msg-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  </div>
                  <span class="msg-file-info">
                    <span class="msg-file-name">{fileLabel(msg)}</span>
                    {#if meta.size}<span class="msg-file-size">{formatBytes(meta.size)}</span>{/if}
                  </span>
                </button>
              {/if}
              {#if msg.type === 'audio' && msg.file_url}
                {@const bars = waveformFor(msg)}
                {@const duration = audioDurationLabel(msg)}
                <div class="msg-vn">
                  <button type="button" class="msg-vn-play" onclick={(e) => { e.stopPropagation(); toggleAudio(msg); }} aria-label={playingAudioId === msg.id ? 'Jeda' : 'Putar'}>
                    {#if playingAudioId === msg.id}
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                    {:else}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    {/if}
                  </button>
                  <div class="msg-vn-wave">
                    {#each bars as height, i}
                      {@const played = playingAudioId === msg.id && audioProgress >= ((i / bars.length) * 100)}
                      <div class="msg-vn-bar {played ? 'msg-vn-bar--played' : ''}" style="height: {Math.max(4, (height / 100) * 22)}px;"></div>
                    {/each}
                  </div>
                  {#if duration}<span class="msg-vn-time">{duration}</span>{/if}
                  <button type="button" class="msg-vn-open" onclick={(e) => { e.stopPropagation(); openMediaPreview(msg); }} aria-label="Buka voice note">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                </div>
              {/if}

              {#if msg.type === 'text'}
                {#if msg.message}<p class="msg-text">{msg.message}</p>{/if}
              {:else}
                {@const caption = parseMeta(msg).caption}
                {#if caption}<p class="msg-text msg-caption">{caption}</p>{/if}
              {/if}
            {/if}
            <div class="msg-meta">
              {#if msg.is_edited && !msg.is_deleted}<span class="msg-edited">diperbarui</span>{/if}
              {#if msg.is_starred}<span class="msg-star"><svg width="10" height="10" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FBBF24" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>{/if}
              <span class="msg-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              {#if isMine && !msg.is_deleted}
                {#if msg._pending}
                  <span class="msg-tick" aria-label="Mengirim">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                {:else if msg.is_read}
                  <span class="msg-tick msg-tick--read" aria-label="Dibaca">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                  </span>
                {:else}
                  <span class="msg-tick" aria-label="Terkirim">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
                  </span>
                {/if}
              {/if}
            </div>
          </div>
          {#if reactions.length > 0}
            <div class="reaction-badges {isMine ? 'reaction-badges--mine' : 'reaction-badges--theirs'}">
              {#each reactions as r}
                <span class="reaction-badge">{r.emoji}{#if r.count > 1}<span class="reaction-count">{r.count}</span>{/if}</span>
              {/each}
            </div>
          {/if}

          {#if contextMenuVisible && contextMessage?.id === msg.id}
            <div class="ctx-bubble-menu {isMine ? 'ctx-bubble-menu--mine' : 'ctx-bubble-menu--theirs'} {menuDirection === 'up' ? 'ctx-bubble-menu--up' : 'ctx-bubble-menu--down'}">
              <!-- Emoji reactions bar -->
              <div class="reaction-bar">
                {#each ['❤️','👍','😂','😮','😢','🙏'] as emoji}
                  <button
                    class="reaction-btn {(auth.user?.id && parseReactions(contextMessage.reactions)[auth.user.id] === emoji) ? 'reaction-btn--active' : ''}"
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
              {#if contextMessage.message}
              <button class="context-item" onclick={() => { copyText(contextMessage.message); closeContextMenu(); }}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Salin
              </button>
              {/if}
              <button class="context-item" onclick={() => { openForward(contextMessage); closeContextMenu(); }}>
                <svg class="ctx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
                Teruskan
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
        <button type="button" class="reply-preview__close" onclick={() => replyingTo = null} aria-label="Batalkan balasan">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    {/if}

    {#if pendingFiles.length > 0}
      <div class="pending-strip">
        {#each pendingFiles as item, i (item.previewUrl)}
          <div class="pending-item">
            {#if item.type === 'image'}
              <img src={item.previewUrl} alt="Pratinjau" class="pending-thumb" />
            {:else}
              <div class="pending-doc">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <span class="pending-doc__name">{item.file.name}</span>
              </div>
            {/if}
            <button type="button" class="pending-remove" onclick={() => removePendingFile(i)} aria-label="Hapus lampiran">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        {/each}
        <button type="button" class="pending-add" onclick={() => imageInput.click()} aria-label="Tambah lampiran">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Tambah</span>
        </button>
      </div>
    {/if}

    <form class="input-form" onsubmit={sendMessage}>
      <input type="file" bind:this={imageInput} onchange={handleFileSelect} style="display: none;" accept="image/*" multiple />
      <input type="file" bind:this={docInput} onchange={handleFileSelect} style="display: none;" accept="audio/*,.pdf,.doc,.docx" multiple />
      <input type="file" bind:this={cameraInput} onchange={handleCameraSelect} style="display: none;" accept="image/*" capture="environment" />

      {#if pendingVoiceNote && !isRecording}
        <!-- Pratinjau voice note sebelum dikirim (pola WhatsApp) -->
        <div class="vn-preview">
          <button type="button" class="vn-preview__delete" onclick={cancelPendingVoiceNote} aria-label="Hapus voice note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
          <button type="button" class="vn-preview__play" onclick={toggleVoiceNotePlay} aria-label={voiceNotePlaying ? 'Jeda' : 'Putar'}>
            {#if voiceNotePlaying}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            {:else}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {/if}
          </button>
          <div class="vn-preview__wave">
            {#each pendingVoiceNote.waveform.length ? pendingVoiceNote.waveform : [30, 55, 40, 70, 45, 60] as height}
              <div class="vn-preview__bar" style="height: {Math.max(4, (height / 100) * 20)}px;"></div>
            {/each}
          </div>
          <span class="vn-preview__time">{formatRecordingTime(pendingVoiceNote.duration)}</span>
        </div>
        <button type="submit" class="send-btn send-btn--active" disabled={isUploading} aria-label="Kirim voice note">
          {#if isUploading}
            <span class="send-spinner"></span>
          {:else}
            <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          {/if}
        </button>
      {:else}
        <div class="input-field">
          <button type="button" class="in-field-btn {showEmojiPicker ? 'in-field-btn--active' : ''}" onclick={(e) => { e.stopPropagation(); toggleEmojiPicker(); }} aria-label="Emoji">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>

          {#if isRecording}
            <div class="recording-indicator">
              <span class="rec-dot"></span>
              <span class="rec-time">{formatRecordingTime(recordingSeconds)}</span>
              <div class="rec-wave">
                {#each recordingWaveform as height}
                  <div class="rec-bar" style="height: {Math.max(4, (height / 100) * 20)}px;"></div>
                {/each}
              </div>
            </div>
          {:else}
            <input
              type="text"
              bind:value={newMessage}
              oninput={handleTyping}
              placeholder={pendingFiles.length > 0 ? 'Tambah keterangan...' : 'Ketik pesan...'}
              class="msg-input"
              aria-label="Ketik pesan"
            />
          {/if}

          <button type="button" class="in-field-btn {showAttachMenu ? 'in-field-btn--active' : ''}" onclick={(e) => { e.stopPropagation(); toggleAttachMenu(); }} aria-label="Lampiran">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>
          </button>
          <button type="button" class="in-field-btn" onclick={openCamera} aria-label="Ambil foto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>
          </button>
        </div>

        {#if isRecording}
          <button type="button" class="send-btn send-btn--active" onclick={stopRecording} aria-label="Hentikan rekaman">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          </button>
        {:else if !newMessage.trim() && pendingFiles.length === 0}
          <button type="button" class="send-btn" onclick={startRecording} aria-label="Rekam pesan suara">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>
          </button>
        {:else}
          <button type="submit" disabled={isSending || isUploading} class="send-btn send-btn--active" aria-label="Kirim pesan">
            {#if isSending || isUploading}
              <span class="send-spinner"></span>
            {:else}
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            {/if}
          </button>
        {/if}
      {/if}
    </form>

    <!-- Menu lampiran -->
    {#if showAttachMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="emoji-overlay" onclick={() => showAttachMenu = false}></div>
      <div class="attach-menu">
        <button type="button" class="attach-item" onclick={() => imageInput.click()}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
          Foto
        </button>
        <button type="button" class="attach-item" onclick={() => docInput.click()}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          Dokumen
        </button>
        <button type="button" class="attach-item" onclick={openCamera}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>
          Kamera
        </button>
      </div>
    {/if}

    <!-- Emoji picker berkategori -->
    {#if showEmojiPicker}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="emoji-overlay" onclick={() => showEmojiPicker = false}></div>
      <div class="emoji-picker">
        <div class="emoji-picker__grid">
          {#each emojiGroups[emojiCategory] as emoji}
            <button type="button" class="emoji-item" onclick={() => addEmoji(emoji)}>{emoji}</button>
          {/each}
        </div>
        <div class="emoji-picker__tabs">
          {#each emojiTabs as [category, icon]}
            <button
              type="button"
              class="emoji-tab {emojiCategory === category ? 'emoji-tab--active' : ''}"
              onclick={() => emojiCategory = category}
              aria-label="Kategori {category}"
            >{icon}</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

</div>

<ForwardModal
  bind:open={showForwardModal}
  rooms={forwardRooms}
  source={forwardSource}
  busy={isForwarding}
  onSubmit={submitForward}
/>

<RoomInfoPanel
  bind:open={showRoomInfo}
  title={chatTitle}
  subtitle={chatSubtitle}
  isSaving={!!savingId}
  media={mediaMessages}
  files={fileMessages}
  starred={starredMessages}
  onOpenMedia={openMediaPreview}
  onJump={jumpToMessage}
  onUnstarAll={unstarAll}
  onClearChat={clearChat}
/>

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
    border-radius: 14px;
    background: linear-gradient(150deg, #FFFFFF 0%, #EAF4FE 100%);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1976D2;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.95),
      inset -2px -3px 7px rgba(33, 150, 243, 0.12),
      2px 4px 9px rgba(21, 101, 192, 0.10);
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .back-btn:active {
    transform: translateY(1px);
    box-shadow:
      inset 3px 4px 8px rgba(25, 118, 210, 0.16),
      inset -2px -2px 6px rgba(255, 255, 255, 0.9),
      1px 1px 3px rgba(21, 101, 192, 0.06);
  }
  .header-avatar {
    width: 44px;
    height: 44px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.32),
      4px 6px 13px rgba(21, 101, 192, 0.22);
    color: #fff;
  }
  .header-avatar--chat { background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%); color: #fff; }
  .header-avatar--savings { background: linear-gradient(145deg, #8ED9C6 0%, #4FBFA3 55%, #35A88C 100%); color: #fff; }

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
  .header-status--online { color: #2F9A80; }
  .header-status--offline { color: #94A3B8; }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .header-status--online .status-dot { background: #4FBFA3; box-shadow: 0 0 0 2px rgba(79,191,163,0.2); }
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
  /* Bubble yang sedang dipilih diangkat di atas overlay agar tetap terang */
  .msg-container--selected { z-index: 301; }

  .ctx-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px) saturate(115%);
    -webkit-backdrop-filter: blur(4px) saturate(115%);
    animation: ctx-overlay-in 0.18s ease;
  }
  @keyframes ctx-overlay-in { from { opacity: 0; } to { opacity: 1; } }

  .msg-bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 18px;
    line-height: 1.4;
    animation: fade-in 0.2s ease;
    /* Layout ala WhatsApp: jam menempel di ujung kanan bawah, sebaris dengan
       teks bila muat, dan turun ke baris sendiri (tetap kanan) bila tidak. */
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    column-gap: 8px;
    row-gap: 4px;
  }
  /* Blok non-teks selalu memakai satu baris penuh */
  .msg-bubble > .msg-pinned-badge,
  .msg-bubble > .msg-forwarded,
  .msg-bubble > .msg-reply-bubble,
  .msg-bubble > .msg-image-btn,
  .msg-bubble > .msg-file-card,
  .msg-bubble > .msg-vn { flex: 0 0 100%; min-width: 0; }
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  /* Pesan sendiri: ubin clay biru. Pesan pasangan: clay terang dengan teks
     gelap — konvensi chat yang lazim, sekaligus menjaga fokus warna biru. */
  .msg-bubble--mine {
    background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    color: white;
    border-bottom-right-radius: 8px;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.3),
      5px 8px 18px rgba(21, 101, 192, 0.24);
  }
  .msg-bubble--theirs {
    background: linear-gradient(150deg, #FFFFFF 0%, #EAF4FE 100%);
    color: #1E293B;
    border-bottom-left-radius: 8px;
    box-shadow:
      inset 4px 4px 9px rgba(255, 255, 255, 0.95),
      inset -3px -5px 11px rgba(33, 150, 243, 0.14),
      5px 8px 18px rgba(21, 101, 192, 0.12);
  }

  /* Elemen di dalam bubble pasangan dibuat gelap agar tetap terbaca */
  .msg-bubble--theirs .msg-reply-bubble {
    background: rgba(33, 150, 243, 0.10);
    border-left-color: #2196F3;
  }
  .msg-bubble--theirs .msg-file-card { background: rgba(33, 150, 243, 0.10); }
  .msg-bubble--theirs .msg-file-card:hover { background: rgba(33, 150, 243, 0.18); }
  .msg-bubble--theirs .msg-vn-play,
  .msg-bubble--theirs .msg-vn-open { background: rgba(33, 150, 243, 0.14); color: #1976D2; }
  .msg-bubble--theirs .msg-vn-bar { background: rgba(33, 150, 243, 0.35); }
  .msg-bubble--theirs .msg-vn-bar--played { background: #2196F3; }
  .msg-bubble--theirs .msg-pinned-badge { background: rgba(33, 150, 243, 0.14); color: #1976D2; }

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
    background: rgba(33,150,243,0.9);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(25,118,210,0.3);
    z-index: 5;
  }

  .msg-text { font-size: 14px; font-weight: 600; margin: 0; word-wrap: break-word; overflow-wrap: anywhere; flex: 0 1 auto; min-width: 0; }
  .msg-pinned-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    opacity: 0.75;
    background: rgba(255,255,255,0.2); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10);
    border-radius: 999px;
    padding: 2px 8px;
    margin-bottom: 5px;
    letter-spacing: 0.3px;
  }
  /* Digeser sedikit ke bawah agar duduk di bawah garis teks, seperti WhatsApp */
  .msg-meta { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; margin-left: auto; align-self: flex-end; position: relative; top: 4px; margin-bottom: -2px; }
  /* Meta dibuat jelas lebih kecil dari teks pesan (14px) */
  .msg-time { font-size: 10px; margin: 0; opacity: 0.6; font-weight: 700; letter-spacing: 0.01em; }
  .msg-edited { font-size: 9px; opacity: 0.55; font-style: italic; }
  .msg-star { font-size: 10px; display: inline-flex; }
  .msg-tick { display: inline-flex; align-items: center; color: rgba(255,255,255,0.8); margin-left: 1px; }
  .msg-tick svg { width: 12px; height: 12px; }
  .msg-tick--read { color: #7FD3FF; }

  /* Date divider */
  .date-divider { display: flex; align-items: center; justify-content: center; margin: 12px 0 4px; }
  /* Pil tanggal dibuat cekung dan bertinta biru — sengaja beda dari bubble
     pesan yang putih & timbul, supaya tidak terbaca sebagai pesan. */
  .date-divider__label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #1565C0;
    background: #CFE6FA;
    border-radius: 999px;
    padding: 5px 14px;
    box-shadow:
      inset 3px 3px 6px rgba(21, 101, 192, 0.20),
      inset -2px -2px 5px rgba(255, 255, 255, 0.85);
  }

  /* Reaction badges */
  /* Reaksi menempel di sudut bawah bubble (bukan sebagai kolom terpisah,
     karena .msg-container adalah flex row). */
  .reaction-badges {
    position: absolute;
    bottom: -11px;
    display: flex;
    gap: 3px;
    z-index: 2;
  }
  .reaction-badges--mine { right: 10px; }
  .reaction-badges--theirs { left: 10px; }
  .reaction-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: #fff;
    border: 1.5px solid #E2E8F0;
    border-radius: 999px;
    padding: 1px 6px;
    font-size: 12px;
    line-height: 1.5;
    color: #475569;
    font-weight: 800;
    box-shadow: 0 2px 6px rgba(13,71,161,0.12);
  }
  .reaction-count { font-size: 11px; }
  /* Ruang ekstra agar badge tidak menabrak pesan berikutnya */
  .msg-container--reacted { margin-bottom: 14px; }

  /* Message contents */
  .msg-image { max-width: 100%; border-radius: 10px; margin-bottom: 4px; display: block; }
  .msg-image-btn { display: block; width: 100%; padding: 0; border: none; background: none; cursor: pointer; }
  .msg-deleted { font-style: italic; opacity: 0.8; display: flex; align-items: center; gap: 6px; }

  /* File card */
  .msg-file-card { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.18); border-radius: 10px; padding: 10px 12px; text-decoration: none; color: inherit; transition: background 0.15s; }
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
  .reply-preview__bar { width: 3px; height: 36px; background: #2196F3; border-radius: 3px; flex-shrink: 0; }
  .reply-preview__content { flex: 1; overflow: hidden; }
  .reply-preview__author { font-size: 12px; font-weight: 800; color: #2196F3; display: block; margin-bottom: 2px; }
  .reply-preview__text { margin: 0; font-size: 12px; color: #64748B; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .reply-preview__close { background: none; border: none; cursor: pointer; color: #94A3B8; padding: 4px; display: flex; align-items: center; }

  /* Attachment preview bar */

  /* Recording indicator */
  .recording-indicator { flex: 1; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #EF7C97; padding: 0 8px; }
  .rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #EF7C97; animation: pulse 1s infinite; flex-shrink: 0; }
  .msg-reply-bubble { background: rgba(0,0,0,0.1); border-left: 3px solid rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 4px; font-size: 12px; }

  @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

  /* Context Menu — menempel di bubble (konsep khwarizmi) */
  .ctx-bubble-menu {
    position: absolute;
    z-index: 300;
    background: #FFFFFF;
    border: 1px solid rgba(226,232,240,0.8);
    border-radius: 22px;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
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
  .context-item--danger { color: #EF7C97; }
  .context-item--danger:hover { background: #FDF4F6; }
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
  .edit-modal__input:focus { outline: none; border-color: #2196F3; }
  .edit-modal__actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; }
  .edit-modal__btn { padding: 8px 20px; border-radius: 20px; border: none; font-weight: 700; cursor: pointer; font-size: 14px; }
  .edit-modal__btn--cancel { background: #F1F5F9; color: #64748B; }
  .edit-modal__btn--save { background: linear-gradient(145deg, #2196F3, #1976D2); color: white;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }

  /* Pinned Message */
  .pinned-header { width: 100%; text-align: left; font-family: inherit; border: none; border-top: none; padding: 10px 16px; background: #ffffff; border-bottom: 1px solid rgba(226,232,240,0.8); display: flex; gap: 10px; align-items: center; cursor: pointer; transition: background 0.2s; flex-shrink: 0; z-index: 10; }
  .pinned-header:hover { background: #F8FAFC; }
  .pinned-icon { font-size: 16px; color: #1976D2; display: flex; }
  .pinned-content { flex: 1; overflow: hidden; }
  .pinned-content strong { display: block; font-size: 12px; color: #1976D2; margin-bottom: 2px; }
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
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.13),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95);
  }
  .in-field-btn:hover { background: #fff; color: #2196F3; }
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
    color: #EF7C97;
    font-size: 14px;
    font-weight: 700;
  }
  .msg-input {
    width: 100%;
    border: none;
    border-radius: 24px;
    padding: 11px 96px 11px 46px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #1F2937;
    outline: none;
    background: #E6F2FD;
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.13),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95);
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .msg-input::placeholder { color: #94A3B8; }
  .msg-input:focus {
    
    background: #fff;
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.18),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95),
      0 0 0 3px rgba(33, 150, 243, 0.16);
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
    border-radius: 22px;
    border: 1px solid rgba(226,232,240,0.8);
    background: #FFFFFF;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
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
  .emoji-item:hover { background: rgba(33,150,243,0.12); transform: scale(1.1); }

  .send-btn {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    color: #ffffff;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .send-btn:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow:
      inset 4px 5px 11px rgba(13, 71, 161, 0.4),
      inset -2px -2px 6px rgba(255, 255, 255, 0.3),
      2px 3px 7px rgba(21, 101, 192, 0.16);
  }
  .send-btn--active {
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
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
    background: rgba(255,255,255,0.25); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10);
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
    box-shadow: 0 24px 60px -12px rgba(13,71,161,0.35);
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
    color: #2196F3;
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
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }
  .cam-btn--primary:hover { transform: translateY(1px); box-shadow: 0 2px 0 0 rgba(25,118,210,0.9); }
  .cam-btn--primary:active { transform: translateY(2px); box-shadow: none; }
  .cam-shutter {
    width: 19px;
    height: 19px;
    flex-shrink: 0;
  }

  /* ── Header: indikator mengetik & tombol info ── */
  /* Sama bobotnya dengan tombol kembali: clay ringan, bukan ubin biru pekat */
  .header-action {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(150deg, #FFFFFF 0%, #EAF4FE 100%);
    color: #1976D2;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.95),
      inset -2px -3px 7px rgba(33, 150, 243, 0.12),
      2px 4px 9px rgba(21, 101, 192, 0.10);
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .header-action:active {
    transform: translateY(1px);
    box-shadow:
      inset 3px 4px 8px rgba(25, 118, 210, 0.16),
      inset -2px -2px 6px rgba(255, 255, 255, 0.9),
      1px 1px 3px rgba(21, 101, 192, 0.06);
  }
  .header-status--typing { color: #1976D2; }
  .typing-dots { display: inline-flex; align-items: center; gap: 3px; }
  .typing-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    animation: typing-bounce 1.2s infinite ease-in-out;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-3px); opacity: 1; }
  }

  /* ── Muat pesan lama ── */
  .load-more { display: flex; justify-content: center; padding: 4px 0 10px; }
  .load-more__btn {
    border: 1px solid rgba(226,232,240,0.9);
    background: #fff;
    color: #1976D2;
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 7px 16px;
    border-radius: 999px;
    cursor: pointer;
  }
  .load-more__btn:disabled { opacity: 0.6; cursor: default; }

  /* ── Bubble: diteruskan, file, voice note ── */
  .msg-forwarded {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.65;
    margin-bottom: 5px;
  }
  .msg-file-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .msg-file-size { font-size: 10px; opacity: 0.7; }
  .msg-vn-bar--played { background: #fff; }
  .msg-vn-time { font-size: 10px; font-weight: 800; opacity: 0.85; flex-shrink: 0; }
  .msg-caption { margin-top: 2px; }

  /* ── Strip lampiran tertunda ── */
  .pending-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 0 10px;
  }
  .pending-item { position: relative; flex-shrink: 0; }
  .pending-thumb {
    width: 68px;
    height: 68px;
    border-radius: 14px;
    object-fit: cover;
    border: 1px solid #E2E8F0;
    display: block;
  }
  .pending-doc {
    width: 68px;
    height: 68px;
    border-radius: 14px;
    border: 1px solid #E2E8F0;
    background: #F8FAFC;
    color: #2196F3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px;
  }
  .pending-doc__name {
    font-size: 8px;
    font-weight: 800;
    color: #64748B;
    text-align: center;
    line-height: 1.2;
    max-height: 20px;
    overflow: hidden;
    word-break: break-all;
  }
  .pending-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: #EF7C97;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(239,124,151,0.35);
  }
  .pending-add {
    width: 68px;
    height: 68px;
    flex-shrink: 0;
    border-radius: 14px;
    border: 1px dashed #CBD5E1;
    background: transparent;
    color: #94A3B8;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    font-family: inherit;
  }
  .pending-add span { font-size: 9px; font-weight: 800; }

  /* ── Pratinjau voice note ── */
  .vn-preview {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid rgba(33,150,243,0.25);
    background: rgba(33,150,243,0.08);
  }
  .vn-preview__delete, .vn-preview__play {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .vn-preview__delete { background: transparent; color: #EF7C97; }
  .vn-preview__play { background: #2196F3; color: #fff; }
  .vn-preview__wave { flex: 1; display: flex; align-items: center; gap: 2px; overflow: hidden; height: 22px; }
  .vn-preview__bar { width: 3px; border-radius: 2px; background: rgba(33,150,243,0.55); flex-shrink: 0; }
  .vn-preview__time { font-size: 11px; font-weight: 800; color: #1976D2; flex-shrink: 0; }

  /* ── Indikator rekaman ── */
  .rec-time { font-size: 12px; font-weight: 800; min-width: 34px; }
  .rec-wave { flex: 1; display: flex; align-items: center; gap: 2px; height: 22px; overflow: hidden; }
  .rec-bar { width: 3px; border-radius: 2px; background: rgba(239,124,151,0.55); flex-shrink: 0; }

  /* ── Menu lampiran ── */
  .attach-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 14px;
    z-index: 41;
    width: 190px;
    padding: 6px;
    border-radius: 22px;
    border: 1px solid rgba(226,232,240,0.9);
    background: #FFFFFF;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .attach-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: none;
    background: transparent;
    border-radius: 12px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
    text-align: left;
  }
  .attach-item svg { color: #2196F3; flex-shrink: 0; }
  .attach-item:hover { background: rgba(33,150,243,0.1); }

  /* ── Emoji picker berkategori ── */
  .emoji-picker { max-height: none; overflow: visible; padding-bottom: 6px; }
  .emoji-picker__grid { max-height: 190px; overflow-y: auto; }
  .emoji-picker__tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(226,232,240,0.9);
  }
  .emoji-tab {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: 50%;
    font-size: 17px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .emoji-tab--active { background: rgba(33,150,243,0.16); }

  .in-field-btn--active { background: #fff; color: #2196F3; }

  .send-spinner {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    animation: send-spin 0.7s linear infinite;
  }
  @keyframes send-spin { to { transform: rotate(360deg); } }

  .cam-video--mirror { transform: scaleX(-1); }
</style>

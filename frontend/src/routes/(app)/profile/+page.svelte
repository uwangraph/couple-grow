<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import Icon from '$lib/Icon.svelte';
  import { toast } from '$lib/toast.svelte';

  let showPairingSection = $state(false);
  let inviteCode = $state('');
  let generatedCode = $state<string | null>(null);
  let pairLoading = $state(false);
  let passwordLoading = $state(false);
  let isChangingPassword = $state(false);
  let passwordForm = $state({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  async function generateCode() {
    pairLoading = true;
    try {
      const res = await fetch(`${API_URL}/partner/invite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kode');
      generatedCode = data.code;
      toast.success('Kode undangan berhasil dibuat!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      pairLoading = false;
    }
  }

  async function connectPartner() {
    if (!inviteCode || inviteCode.length !== 6) return;
    pairLoading = true;
    try {
      const res = await fetch(`${API_URL}/partner/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ code: inviteCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan');
      await auth.init();
      toast.success('Pasangan berhasil terhubung!');
      showPairingSection = false;
      inviteCode = '';
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      pairLoading = false;
    }
  }

  let showDisconnectConfirm = $state(false);

  async function disconnectPartner() {
    try {
      const res = await fetch(`${API_URL}/partner/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memutuskan hubungan');
      await auth.init();
      showDisconnectConfirm = false;
      toast.success('Hubungan berhasil diputuskan.');
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  let isEditingProfile = $state(false);
  let avatarInput = $state<HTMLInputElement | null>(null);
  let editForm = $state({
    name: auth.user?.name || '',
    birthday: auth.user?.birthday || '',
    anniversary: auth.user?.anniversary || '',
    bio: auth.user?.bio || '',
    phone: (auth.user as any)?.phone || ''
  });

  async function updateProfile() {
    pairLoading = true;
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error('Gagal update');
      if (auth.user) auth.setUser({ ...auth.user, ...editForm }, auth.partner);
      toast.success('Profil berhasil diperbarui!');
      isEditingProfile = false;
    } catch (e: any) { toast.error(e.message); }
    finally { pairLoading = false; }
  }

  let cropModalVisible = $state(false);
  let cropImg = $state<HTMLImageElement | null>(null);
  let cropScale = $state(1);
  const SCALE_MIN = 0.5;
  const SCALE_MAX = 4;
  let cropOffsetX = $state(0);
  let cropOffsetY = $state(0);
  let cropCanvasEl = $state<HTMLCanvasElement | null>(null);

  // For drag
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetXStart = 0;
  let dragOffsetYStart = 0;

  function drawCropCanvas() {
    const canvas = cropCanvasEl;
    if (!canvas || !cropImg || !cropImg.complete || !cropImg.naturalWidth) return;
    const size = Math.min(canvas.parentElement?.clientWidth ?? 340, 500);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);

    const imgW = cropImg.naturalWidth * cropScale;
    const imgH = cropImg.naturalHeight * cropScale;
    const drawX = size / 2 + cropOffsetX - imgW / 2;
    const drawY = size / 2 + cropOffsetY - imgH / 2;

    // Draw dark bg
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);

    // Draw image
    ctx.drawImage(cropImg, drawX, drawY, imgW, imgH);

    // Draw circular mask (cut out)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw outer dark overlay (ring effect)
    const outerCanvas = document.createElement('canvas');
    outerCanvas.width = size;
    outerCanvas.height = size;
    const octx = outerCanvas.getContext('2d')!;
    octx.fillStyle = 'rgba(0,0,0,0.55)';
    octx.fillRect(0, 0, size, size);
    octx.globalCompositeOperation = 'destination-out';
    octx.beginPath();
    octx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    octx.fill();
    ctx.drawImage(outerCanvas, 0, 0);
  }

  $effect(() => {
    if (cropModalVisible && cropCanvasEl) {
      const drawLoop = () => {
        drawCropCanvas();
      };
      drawLoop();
    }
  });

  $effect(() => {
    // redraw whenever these change
    cropScale; cropOffsetX; cropOffsetY;
    drawCropCanvas();
  });

  function handleAvatarSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      cropImg = new Image();
      cropImg.onload = () => {
        cropScale = 1;
        cropOffsetX = 0;
        cropOffsetY = 0;
        cropModalVisible = true;
        // Draw after next tick when canvas is mounted
        setTimeout(() => drawCropCanvas(), 50);
      };
      cropImg.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function onCropWheel(e: WheelEvent) {
    e.preventDefault();
    cropScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, cropScale - e.deltaY * 0.002));
  }

  function onCropMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffsetXStart = cropOffsetX;
    dragOffsetYStart = cropOffsetY;
  }

  function onCropMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    cropOffsetX = dragOffsetXStart + (e.clientX - dragStartX);
    cropOffsetY = dragOffsetYStart + (e.clientY - dragStartY);
  }

  function onCropMouseUp() { isDragging = false; }

  // Touch support
  let lastTouchDist = 0;
  function onCropTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragOffsetXStart = cropOffsetX;
      dragOffsetYStart = cropOffsetY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastTouchDist = Math.hypot(dx, dy);
    }
  }
  function onCropTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      cropOffsetX = dragOffsetXStart + (e.touches[0].clientX - dragStartX);
      cropOffsetY = dragOffsetYStart + (e.touches[0].clientY - dragStartY);
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      cropScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, cropScale * (dist / lastTouchDist)));
      lastTouchDist = dist;
    }
  }
  function onCropTouchEnd() { isDragging = false; }

  function cropZoomIn() { cropScale = Math.min(SCALE_MAX, cropScale + 0.15); }
  function cropZoomOut() { cropScale = Math.max(SCALE_MIN, cropScale - 0.15); }
  function cropReset() { cropScale = 1; cropOffsetX = 0; cropOffsetY = 0; }

  async function saveCroppedAvatar() {
    if (!cropCanvasEl || !cropImg) return;
    pairLoading = true;
    const size = cropCanvasEl.width;
    // Final render at 400×400
    const output = document.createElement('canvas');
    output.width = 400;
    output.height = 400;
    const ctx = output.getContext('2d')!;
    const imgW = cropImg.naturalWidth * cropScale;
    const imgH = cropImg.naturalHeight * cropScale;
    const drawX = size / 2 + cropOffsetX - imgW / 2;
    const drawY = size / 2 + cropOffsetY - imgH / 2;
    const ratio = 400 / size;
    ctx.drawImage(cropImg, drawX * ratio, drawY * ratio, imgW * ratio, imgH * ratio);

    output.toBlob(async (blob) => {
      if (!blob) { pairLoading = false; return; }
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');
      try {
        const res = await fetch(`${API_URL}/profile/avatar`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${auth.token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error('Gagal upload');
        if (auth.user) auth.setUser({ ...auth.user, avatar: data.avatarUrl }, auth.partner);
        toast.success('Foto profil berhasil diubah!');
        cropModalVisible = false;
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        pairLoading = false;
      }
    }, 'image/jpeg', 0.92);
  }

  async function changePassword() {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Konfirmasi password baru tidak sama');
      return;
    }
    passwordLoading = true;
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti password');
      toast.success(data.message || 'Password berhasil diubah!');
      passwordForm = { current_password: '', new_password: '', confirm_password: '' };
      isChangingPassword = false;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      passwordLoading = false;
    }
  }

  function logout() { auth.logout(); goto('/login'); }

  function getAvatarColor(name: string) {
    const colors = ['#BFDBFE', '#CFE7FC', '#A7F3D0', '#FDE68A', '#FECACA'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  let avatarColor = $derived(getAvatarColor(auth.user?.name || 'U'));
  let initials = $derived((auth.user?.name || 'U').slice(0, 2).toUpperCase());
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css" />
</svelte:head>

<div class="profile-root">
  <input type="file" bind:this={avatarInput} accept="image/*" onchange={handleAvatarSelect} style="display:none" />
  <div class="hero">
    <div class="hero-blob blob-1"></div>
    <div class="hero-blob blob-2"></div>
    <div class="hero-blob blob-3"></div>
    <div class="hero-content">
      <button class="avatar-btn" onclick={() => avatarInput?.click()} aria-label="Ubah foto profil">
        <div class="avatar-ring">
          <div class="avatar-inner" style="background: {avatarColor};">
            {#if auth.user?.avatar}
              <img src={auth.user.avatar} alt={auth.user.name} class="avatar-img" />
            {:else}
              <span class="avatar-initials">{initials}</span>
            {/if}
          </div>
        </div>
        <span class="avatar-edit-badge"><Icon name="edit" size={12} /></span>
      </button>
      <div class="hero-text">
        <h1 class="hero-name">{auth.user?.name || 'Pengguna'}</h1>
        <p class="hero-email">{auth.user?.email || ''}</p>
        {#if auth.partner}
          <div class="partner-chip partner-chip--connected">
            {#if auth.partner.avatar}
              <img src={auth.partner.avatar} alt={auth.partner.name} class="partner-chip-img" />
            {:else}
              <Icon name="couple" size={14} />
            {/if}
            <span>{auth.partner.name}</span>
          </div>
        {:else if auth.user?.partner_id}
          <div class="partner-chip partner-chip--connected">
            <Icon name="couple" size={14} />
            <span>Terhubung dengan pasangan</span>
          </div>
        {:else}
          <div class="partner-chip partner-chip--pending">
            <Icon name="link" size={14} />
            <span>Belum terhubung</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="body">
    <div class="card">
      <div class="card-row">
        <div class="card-icon-wrap">
          <Icon name="couple" size={22} class="card-icon" />
        </div>

        <div class="card-label-group">
          <p class="card-label-title">Hubungkan Pasangan</p>
          <p class="card-label-sub" style="display:flex; align-items:center; gap:4px;">
            {#if auth.user?.partner_id}
              <Icon name="success" size={12} /> Sudah terhubung
            {:else}
              Belum terhubung
            {/if}
          </p>
        </div>
        {#if !auth.user?.partner_id}
          <button
            class="btn btn--primary btn--sm"
            onclick={() => { showPairingSection = !showPairingSection; generatedCode = null; }}
          >
            {showPairingSection ? 'Tutup' : 'Hubungkan'}
          </button>
        {:else}
          <div class="badge-check">✓</div>
        {/if}
      </div>

      {#if showPairingSection && !auth.user?.partner_id}
        <div class="pairing-panel">
          <p class="section-label">Buat Kode Undangan</p>
          {#if generatedCode}
            <div class="code-display">
              <span class="code-text">{generatedCode}</span>
              <p class="code-hint">Berikan kode ini ke pasanganmu</p>
            </div>
          {:else}
            <button class="btn btn--outline btn--block" onclick={generateCode} disabled={pairLoading}>
              {#if !pairLoading}<Icon name="dice" size={18} style="margin-right: 8px;" />{/if}
              {pairLoading ? 'Membuat...' : 'Generate Kode'}
            </button>
          {/if}
          <div class="divider"><span>atau</span></div>
          <p class="section-label">Masukkan Kode Pasangan</p>
          <div class="input-row">
            <input
              type="text"
              bind:value={inviteCode}
              maxlength={6}
              placeholder="000000"
              class="code-input"
              aria-label="Kode undangan pasangan"
            />
            <button
              class="btn btn--success"
              onclick={connectPartner}
              disabled={pairLoading || inviteCode.length !== 6}
            >
              {pairLoading ? '...' : 'Tautkan'}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="card">
      <p class="section-label section-label--card">Akun Anda</p>
      <div class="info-row">
        <span class="info-emoji"><Icon name="profile" size={20} /></span>
        <div>
          <p class="info-key">Nama</p>
          <p class="info-val">{auth.user?.name || '-'}</p>
        </div>
      </div>
      <div class="info-row">
        <span class="info-emoji"><Icon name="email" size={20} /></span>
        <div>
          <p class="info-key">Email</p>
          <p class="info-val">{auth.user?.email || '-'}</p>
        </div>
      </div>

      {#if auth.partner}
        <div class="card-divider"></div>
        <p class="section-label section-label--card">Pasangan</p>
        <div class="info-row">
          <div class="partner-avatar-sm">
            {#if auth.partner.avatar}
              <img src={auth.partner.avatar} alt={auth.partner.name} style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
            {:else}
              <Icon name="couple" size={18} />
            {/if}
          </div>
          <div>
            <p class="info-key">Pasangan Anda</p>
            <p class="info-val info-val--accent">{auth.partner.name}</p>
          </div>
        </div>
        {#if (auth.partner as any).phone}
          <div class="info-row">
            <span class="info-emoji"><Icon name="phone" size={18} /></span>
            <div>
              <p class="info-key">No. Telepon</p>
              <p class="info-val">{(auth.partner as any).phone}</p>
            </div>
          </div>
        {/if}
        {#if (auth.partner as any).birthday}
          <div class="info-row">
            <span class="info-emoji"><Icon name="birthday" size={18} /></span>
            <div>
              <p class="info-key">Tanggal Lahir</p>
              <p class="info-val">{new Date((auth.partner as any).birthday).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        {/if}
        {#if (auth.partner as any).anniversary}
          <div class="info-row">
            <span class="info-emoji"><Icon name="couple" size={18} /></span>
            <div>
              <p class="info-key">Hari Jadian</p>
              <p class="info-val">{new Date((auth.partner as any).anniversary).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        {/if}
        {#if (auth.partner as any).bio}
          <div class="info-row" style="align-items:flex-start;">
            <span class="info-emoji" style="margin-top:2px;"><Icon name="notes" size={18} /></span>
            <div>
              <p class="info-key">Bio</p>
              <p class="info-val">{(auth.partner as any).bio}</p>
            </div>
          </div>
        {/if}
        <button class="btn-disconnect" onclick={() => showDisconnectConfirm = true}>
          <Icon name="link" size={15} />
          Putuskan Hubungan
        </button>
      {/if}
    </div>

    <div class="card">
      <p class="section-label section-label--card">Pengaturan Profil</p>
      {#if isEditingProfile}
        <div class="edit-form">
          <input type="text" bind:value={editForm.name} placeholder="Nama" class="form-input" />
          <input type="tel" bind:value={editForm.phone} placeholder="No. Telepon (opsional)" class="form-input" />
          <textarea bind:value={editForm.bio} placeholder="Bio singkat..." class="form-input form-textarea"></textarea>
          <label class="form-date-label"><Icon name="birthday" size={14} /> Tanggal Lahir</label>
          <input type="date" bind:value={editForm.birthday} class="form-input" />
          <label class="form-date-label"><Icon name="couple" size={14} /> Hari Jadian</label>
          <input type="date" bind:value={editForm.anniversary} class="form-input" />
          <div class="btn-row">
            <button class="btn btn--primary" onclick={updateProfile} disabled={pairLoading}>
              {pairLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button class="btn btn--ghost" onclick={() => isEditingProfile = false}>Batal</button>
          </div>
        </div>
      {:else}
        <button
          class="btn btn--outline btn--block"
          onclick={() => { isEditingProfile = true; editForm = { name: auth.user?.name || '', birthday: auth.user?.birthday || '', anniversary: auth.user?.anniversary || '', bio: auth.user?.bio || '', phone: (auth.user as any)?.phone || '' }; }}
        >
          <Icon name="edit" size={16} style="margin-right: 8px;" /> Edit Info Profil
        </button>
      {/if}
    </div>

    <div class="card">
      <p class="section-label section-label--card">Keamanan Akun</p>
      {#if isChangingPassword}
        <div class="edit-form">
          <input type="password" bind:value={passwordForm.current_password} placeholder="Password saat ini" class="form-input" />
          <input type="password" bind:value={passwordForm.new_password} placeholder="Password baru" class="form-input" />
          <input type="password" bind:value={passwordForm.confirm_password} placeholder="Ulangi password baru" class="form-input" />
          <div class="btn-row">
            <button class="btn btn--primary" onclick={changePassword} disabled={passwordLoading}>
              {passwordLoading ? 'Menyimpan...' : 'Ganti Password'}
            </button>
            <button class="btn btn--ghost" onclick={() => { isChangingPassword = false; passwordForm = { current_password: '', new_password: '', confirm_password: '' }; }}>Batal</button>
          </div>
        </div>
      {:else}
        <button class="btn btn--outline btn--block" onclick={() => { isChangingPassword = true; }}>
          <Icon name="lock" size={16} style="margin-right: 8px;" /> Ganti Password
        </button>
      {/if}
    </div>

    <button class="logout-btn" onclick={logout}>
      <Icon name="logout" size={18} /> Keluar
    </button>

    <div style="height: 32px;"></div>
  </div>
</div>

<!-- Modal Konfirmasi Putuskan Hubungan -->
{#if showDisconnectConfirm}
  <div class="modal-backdrop" role="dialog" aria-modal="true" onclick={(e) => { if (e.target === e.currentTarget) showDisconnectConfirm = false; }}>
    <div class="modal-sheet">
      <div class="modal-handle-bar"></div>
      <div class="disconnect-icon">
        <Icon name="couple" size={28} />
      </div>
      <h3 class="disconnect-title">Putuskan Hubungan?</h3>
      <p class="disconnect-msg">
        Kamu dan <strong>{auth.partner?.name}</strong> tidak akan lagi terhubung di CoupleGrow. Data tabungan dan transaksi bersama tidak akan dihapus.
      </p>
      <div class="disconnect-actions">
        <button class="btn btn--ghost" onclick={() => showDisconnectConfirm = false}>Batal</button>
        <button class="btn btn--danger" onclick={disconnectPartner}>Ya, Putuskan</button>
      </div>
    </div>
  </div>
{/if}

{#if cropModalVisible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="crop-overlay" onclick={() => cropModalVisible = false}></div>
  <div class="crop-modal-card">
    <div class="crop-modal-header">
      <h3 class="crop-modal-title">Atur Foto Profil</h3>
      <button class="crop-close-btn" onclick={() => cropModalVisible = false} aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <!-- Canvas area -->
    <div
      class="crop-canvas-wrap"
      onmousedown={onCropMouseDown}
      onmousemove={onCropMouseMove}
      onmouseup={onCropMouseUp}
      onmouseleave={onCropMouseUp}
      onwheel={onCropWheel}
      ontouchstart={onCropTouchStart}
      ontouchmove={onCropTouchMove}
      ontouchend={onCropTouchEnd}
      role="img"
      aria-label="Atur foto profil"
    >
      <canvas bind:this={cropCanvasEl} class="crop-canvas"></canvas>
      <p class="crop-hint">Geser atau cubit untuk menyesuaikan</p>
    </div>
    <!-- Bottom controls -->
    <div class="crop-controls">
      <button class="crop-ctrl-btn" onclick={cropZoomOut} aria-label="Zoom out" title="Zoom out">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <button class="crop-ctrl-btn crop-ctrl-reset" onclick={cropReset} aria-label="Reset">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>Reset</span>
      </button>
      <button class="crop-ctrl-btn" onclick={cropZoomIn} aria-label="Zoom in" title="Zoom in">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <button class="crop-ctrl-btn crop-ctrl-save" onclick={saveCroppedAvatar} disabled={pairLoading}>
        {#if !pairLoading}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        {/if}
        <span>{pairLoading ? 'Menyimpan...' : 'Gunakan'}</span>
      </button>
    </div>
  </div>
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .profile-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
  }

  .hero {
    background: linear-gradient(160deg, #8FC5F7 0%, #6BAFF2 55%, #9CCCF8 100%);
    padding: 32px 20px 80px;
    position: relative;
    overflow: hidden;
  }

  .hero-blob {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .blob-1 { width: 200px; height: 200px; top: -60px; right: -60px; }
  .blob-2 { width: 120px; height: 120px; bottom: -30px; left: -20px; }
  .blob-3 { width: 60px; height: 60px; top: 40px; left: 40%; background: rgba(255,255,255,0.05); }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .avatar-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
  }
  .avatar-ring {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;
  }
  .avatar-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-initials { font-size: 24px; font-weight: 900; color: white; }
  .avatar-edit-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 22px;
    height: 22px;
    background: white;
    border-radius: 50%;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }

  .hero-text { flex: 1; min-width: 0; }
  .hero-name {
    font-size: 22px;
    font-weight: 900;
    color: white;
    margin: 0 0 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hero-email {
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    margin: 0 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .partner-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 99px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 700;
    color: white;
  }
  .partner-chip--connected { background: rgba(255,255,255,0.22); }
  .partner-chip--pending { background: rgba(255,200,150,0.3); }
  .partner-chip-img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }

  .body {
    padding: 20px 16px;
    margin-top: -24px;
    position: relative;
    z-index: 2;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 16px;
    padding: 12px 16px;
    margin-bottom: 14px;
    font-size: 13px;
    font-weight: 700;
  }
  .toast--success { background: #F0FDF4; border: 1.5px solid #86EFAC; color: #15803D; }
  .toast--error { background: #FFF1F2; border: 1.5px solid #FDA4AF; color: #BE123C; }

  .card {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 24px;
    padding: 18px;
    margin-bottom: 14px;
    box-shadow: 0 4px 20px rgba(59,130,246,0.08);
  }
  .card-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .card-icon-wrap {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: rgba(59,130,246,0.10);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .card-icon { width: 22px; height: 22px; color: #6BAFF2; }
  .card-label-group { flex: 1; min-width: 0; }
  .card-label-title { font-size: 14px; font-weight: 800; color: #1E293B; margin: 0 0 2px; }
  .card-label-sub { font-size: 12px; color: #94A3B8; margin: 0; }
  .badge-check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #DCFCE7;
    color: #15803D;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
  }
  .card-divider { height: 1px; background: #E0E7FF; margin: 14px 0; }

  .pairing-panel {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1.5px dashed #E0E7FF;
  }
  .code-display {
    background: rgba(255, 255, 255, 0.5);
    border: 2px dashed rgba(59,130,246,0.3);
    border-radius: 18px;
    padding: 20px;
    text-align: center;
    margin-bottom: 16px;
  }
  .code-text {
    display: block;
    font-size: 36px;
    font-weight: 900;
    letter-spacing: 0.25em;
    color: #6BAFF2;
    margin-bottom: 6px;
  }
  .code-hint { font-size: 13px; color: #94A3B8; margin: 0; }

  /* Crop Modal */
  .crop-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 200;
  }
  .crop-modal-card {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(92vw, 420px);
    background: white;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(37, 99, 235, 0.15), 0 4px 24px rgba(0,0,0,0.12);
    z-index: 201;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .crop-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 0;
  }
  .crop-modal-title {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: #1E293B;
    font-family: 'Nunito', sans-serif;
  }
  .crop-close-btn {
    background: #F1F5F9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #64748B;
    transition: background 0.15s;
  }
  .crop-close-btn:hover { background: #E2E8F0; }
  .crop-canvas-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: grab;
    user-select: none;
    touch-action: none;
    padding: 16px 16px 8px;
    background: #1E293B;
  }
  .crop-canvas-wrap:active { cursor: grabbing; }
  .crop-canvas {
    border-radius: 50%;
    display: block;
    width: min(70vw, 300px);
    height: min(70vw, 300px);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.15);
  }
  .crop-hint {
    color: rgba(255,255,255,0.4);
    font-size: 12px;
    margin: 10px 0 0;
    font-family: 'Nunito', sans-serif;
  }
  .crop-controls {
    width: 100%;
    padding: 12px 16px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #F8FAFC;
    border-top: 1px solid #E0E7FF;
  }
  .crop-ctrl-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #EFF6FF;
    border: none;
    color: #4F96E5;
    border-radius: 50px;
    padding: 9px 14px;
    font-size: 13px;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .crop-ctrl-btn:hover { background: #DBEAFE; }
  .crop-ctrl-btn:active { transform: scale(0.94); }
  .crop-ctrl-reset {
    background: #F1F5F9;
    color: #64748B;
    font-size: 12px;
  }
  .crop-ctrl-reset:hover { background: #E2E8F0; }
  .crop-ctrl-save {
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
    color: white;
    padding: 9px 20px;
    font-size: 14px;
    flex: 1;
    max-width: 160px;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }
  .crop-ctrl-save:hover { background: linear-gradient(135deg, #9CCCF8, #6BAFF2); }
  .crop-ctrl-save:disabled { opacity: 0.6; cursor: not-allowed; }

  .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0;
    color: #CBD5E1;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #E0E7FF;
  }
  .input-row { display: flex; gap: 10px; }
  .code-input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #E0E7FF;
    border-radius: 14px;
    font-size: 20px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 0.3em;
    color: #1E293B;
    text-transform: uppercase;
    background: #F8FAFC;
    outline: none;
    font-family: 'Nunito', sans-serif;
    transition: border-color 0.2s;
  }
  .code-input:focus { border-color: #6BAFF2; }

  .info-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
  }
  .info-emoji { font-size: 22px; width: 36px; text-align: center; flex-shrink: 0; }
  .info-key { font-size: 11px; color: #94A3B8; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .info-val { font-size: 14px; color: #1E293B; font-weight: 700; margin: 3px 0 0; }
  .info-val--accent { color: #6BAFF2; }
  .partner-avatar-sm {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #E0E7FF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .section-label {
    font-size: 11px;
    font-weight: 800;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 12px;
  }
  .section-label--card { margin-bottom: 10px; }

  .edit-form { display: flex; flex-direction: column; gap: 10px; }
  .form-input {
    padding: 11px 14px;
    border: 2px solid #E0E7FF;
    border-radius: 14px;
    font-size: 14px;
    color: #1E293B;
    font-family: 'Nunito', sans-serif;
    font-weight: 600;
    outline: none;
    transition: border-color 0.2s;
    background: rgba(255, 255, 255, 0.6);
  }
  .form-input:focus { border-color: #6BAFF2; }
  .form-textarea { resize: vertical; min-height: 72px; }
  .form-date-label { font-size: 12px; font-weight: 700; color: #94A3B8; margin: 0; }
  .file-label {
    display: block;
    padding: 14px;
    background: #F0F4FF;
    border: 2px dashed #BFDBFE;
    border-radius: 14px;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #6BAFF2;
    cursor: pointer;
  }
  .btn-row { display: flex; gap: 10px; }

  .btn {
    border: none;
    border-radius: 14px;
    font-family: 'Nunito', sans-serif;
    font-weight: 800;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
    font-size: 13px;
    padding: 10px 18px;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn--primary { background: linear-gradient(135deg, #6BAFF2, #4F96E5); color: white; }
  .btn--success { background: linear-gradient(135deg, #22C55E, #16A34A); color: white; }
  .btn--outline {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.8);
    color: #6BAFF2;
  }
  .btn--ghost { background: rgba(255, 255, 255, 0.4); color: #64748B; }
  .btn--sm { padding: 8px 14px; font-size: 12px; border-radius: 12px; }
  .btn--block { width: 100%; }

  .logout-btn {
    width: 100%;
    padding: 16px;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #F43F5E;
    border: 1px solid rgba(244, 63, 94, 0.3);
    border-radius: 20px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: 'Nunito', sans-serif;
    transition: background 0.2s;
    margin-top: 4px;
    box-shadow: 0 4px 16px rgba(244,63,94,0.05);
  }
  .logout-btn:hover { background: rgba(255, 241, 242, 0.8); }

  /* Tombol putuskan hubungan */
  .btn-disconnect {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 14px;
    padding: 12px 16px;
    background: #FFF1F2;
    border: 1.5px solid #FECDD3;
    border-radius: 14px;
    color: #F43F5E;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    justify-content: center;
    transition: all 0.2s;
  }
  .btn-disconnect:hover { background: #FFE4E6; border-color: #FDA4AF; }
  .btn-disconnect:active { transform: scale(0.98); }

  /* btn--danger */
  .btn--danger {
    background: linear-gradient(135deg, #F43F5E, #E11D48);
    color: white;
    box-shadow: 0 4px 14px rgba(244,63,94,0.3);
  }

  /* Modal backdrop & sheet */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(30,41,59,0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 200;
    animation: fade-in 0.2s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .modal-sheet {
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-radius: 28px 28px 0 0;
    border-top: 1px solid rgba(255,255,255,0.8);
    width: 100%;
    max-width: 540px;
    padding: 20px 24px 48px;
    animation: slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1);
    text-align: center;
  }
  @keyframes slide-up { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .modal-handle-bar {
    width: 44px;
    height: 5px;
    background: #E2E8F0;
    border-radius: 99px;
    margin: 0 auto 24px;
  }

  /* Disconnect modal content */
  .disconnect-icon {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FFF1F2, #FFE4E6);
    color: #F43F5E;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    box-shadow: 0 4px 20px rgba(244,63,94,0.15);
  }

  .disconnect-title {
    font-size: 20px;
    font-weight: 900;
    color: #1E293B;
    margin: 0 0 10px;
  }

  .disconnect-msg {
    font-size: 14px;
    color: #64748B;
    font-weight: 600;
    line-height: 1.6;
    margin: 0 0 28px;
  }
  .disconnect-msg strong { color: #1E293B; font-weight: 900; }

  .disconnect-actions {
    display: flex;
    gap: 12px;
  }
  .disconnect-actions .btn { flex: 1; padding: 14px; font-size: 14px; }
</style>

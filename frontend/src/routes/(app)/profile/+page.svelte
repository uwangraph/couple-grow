<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { ICONS } from '$lib/icons';

  let showPairingSection = $state(false);
  let inviteCode = $state('');
  let generatedCode = $state<string | null>(null);
  let pairErrorMsg = $state('');
  let pairLoading = $state(false);
  let successMsg = $state('');

  async function generateCode() {
    pairErrorMsg = '';
    pairLoading = true;
    try {
      const res = await fetch(`${API_URL}/partner/invite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kode');
      generatedCode = data.code;
    } catch (e: any) {
      pairErrorMsg = e.message;
    } finally {
      pairLoading = false;
    }
  }

  async function connectPartner() {
    if (!inviteCode || inviteCode.length !== 6) return;
    pairErrorMsg = '';
    pairLoading = true;
    try {
      const res = await fetch(`${API_URL}/partner/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ code: inviteCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan');
      if (auth.user) auth.setUser({ ...auth.user, partner_id: 'connected' }, auth.partner);
      successMsg = 'Pasangan berhasil terhubung! 🎉';
      showPairingSection = false;
      inviteCode = '';
    } catch (e: any) {
      pairErrorMsg = e.message;
    } finally {
      pairLoading = false;
    }
  }

  let isEditingProfile = $state(false);
  let isEditingAvatar = $state(false);
  let editForm = $state({
    name: auth.user?.name || '',
    birthday: auth.user?.birthday || '',
    anniversary: auth.user?.anniversary || '',
    bio: auth.user?.bio || ''
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
      successMsg = 'Profil diupdate! 🎉';
      isEditingProfile = false;
      isEditingAvatar = false;
    } catch (e: any) { pairErrorMsg = e.message; }
    finally { pairLoading = false; }
  }

  async function uploadAvatar(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    pairLoading = true;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    try {
      const res = await fetch(`${API_URL}/profile/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Gagal upload');
      if (auth.user) auth.setUser({ ...auth.user, avatar: data.avatarUrl }, auth.partner);
      isEditingAvatar = false;
    } catch (e: any) { pairErrorMsg = e.message; }
    finally { pairLoading = false; }
  }

  function logout() { auth.setToken(''); auth.setUser(null); goto('/login'); }

  function getAvatarColor(name: string) {
    const colors = ['#B8A9F5', '#A8D4B8', '#F5C0B8', '#B8D4F5', '#F5E0A8'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  let avatarColor = $derived(getAvatarColor(auth.user?.name || 'U'));
  let initials = $derived((auth.user?.name || 'U').slice(0, 2).toUpperCase());
</script>

<div class="profile-root">

  <!-- Hero Header -->
  <div class="hero">
    <div class="hero-blob blob-1"></div>
    <div class="hero-blob blob-2"></div>
    <div class="hero-blob blob-3"></div>

    <div class="hero-content">
      <!-- Avatar -->
      <button class="avatar-btn" onclick={() => { isEditingAvatar = true; }}>
        <div class="avatar-ring">
          <div class="avatar-inner" style="background: {avatarColor};">
            {#if auth.user?.avatar}
              <img src={auth.user.avatar} alt={auth.user.name} class="avatar-img" />
            {:else}
              <span class="avatar-initials">{initials}</span>
            {/if}
          </div>
        </div>
        <span class="avatar-edit-badge">✏️</span>
      </button>

      <!-- Name & Email -->
      <div class="hero-text">
        <h1 class="hero-name">{auth.user?.name || 'Pengguna'}</h1>
        <p class="hero-email">{auth.user?.email || ''}</p>

        {#if auth.partner}
          <div class="partner-chip partner-chip--connected">
            {#if auth.partner.avatar}
              <img src={auth.partner.avatar} alt={auth.partner.name} class="partner-chip-img" />
            {:else}
              <span>💑</span>
            {/if}
            <span>{auth.partner.name}</span>
          </div>
        {:else if auth.user?.partner_id}
          <div class="partner-chip partner-chip--connected">
            <span>💑</span>
            <span>Terhubung dengan pasangan</span>
          </div>
        {:else}
          <div class="partner-chip partner-chip--pending">
            <span>🔗</span>
            <span>Belum terhubung</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Success Toast -->
    {#if successMsg}
      <div class="toast toast--success">
        <span>✅</span> {successMsg}
      </div>
    {/if}

    <!-- Error Toast -->
    {#if pairErrorMsg}
      <div class="toast toast--error">
        <span>⚠️</span> {pairErrorMsg}
      </div>
    {/if}

    <!-- Partner Card -->
    <div class="card">
      <div class="card-row">
        <div class="card-icon-wrap card-icon-wrap--purple">
          <img src={ICONS.couple} alt="couple" class="card-icon" />
        </div>
        <div class="card-label-group">
          <p class="card-label-title">Hubungkan Pasangan</p>
          <p class="card-label-sub">{auth.user?.partner_id ? '✅ Sudah terhubung' : 'Belum terhubung'}</p>
        </div>
        {#if !auth.user?.partner_id}
          <button
            class="btn btn--primary btn--sm"
            onclick={() => { showPairingSection = !showPairingSection; generatedCode = null; pairErrorMsg = ''; }}
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
              {pairLoading ? 'Membuat...' : '🎲 Generate Kode'}
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

    <!-- Account Info Card -->
    <div class="card">
      <p class="section-label section-label--card">Akun Anda</p>
      <div class="info-row">
        <span class="info-emoji">👤</span>
        <div>
          <p class="info-key">Nama</p>
          <p class="info-val">{auth.user?.name || '-'}</p>
        </div>
      </div>
      <div class="info-row">
        <span class="info-emoji">📧</span>
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
              💑
            {/if}
          </div>
          <div>
            <p class="info-key">Pasangan Anda</p>
            <p class="info-val info-val--accent">{auth.partner.name}</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Edit Profile Card -->
    <div class="card">
      <p class="section-label section-label--card">Pengaturan Profil</p>

      {#if isEditingAvatar}
        <div class="edit-form">
          <label class="file-label">
            📷 Pilih foto baru
            <input type="file" accept="image/*" onchange={uploadAvatar} style="display:none" />
          </label>
          <button class="btn btn--ghost btn--block" onclick={() => isEditingAvatar = false}>Batal</button>
        </div>
      {:else if isEditingProfile}
        <div class="edit-form">
          <input type="text" bind:value={editForm.name} placeholder="Nama" class="form-input" />
          <textarea bind:value={editForm.bio} placeholder="Bio singkat..." class="form-input form-textarea"></textarea>
          <label class="form-date-label">🎂 Tanggal Lahir</label>
          <input type="date" bind:value={editForm.birthday} class="form-input" />
          <label class="form-date-label">💍 Hari Jadian</label>
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
          onclick={() => { isEditingProfile = true; editForm = { name: auth.user?.name || '', birthday: auth.user?.birthday || '', anniversary: auth.user?.anniversary || '', bio: auth.user?.bio || '' }; }}
        >
          ✏️ Edit Info Profil
        </button>
      {/if}
    </div>

    <!-- Logout -->
    <button class="logout-btn" onclick={logout}>
      <img src={ICONS.logout} alt="logout" style="width:18px;height:18px;" />
      Keluar dari Akun
    </button>

    <div style="height: 32px;"></div>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .profile-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: #F7F5FF;
  }

  /* ── Hero ── */
  .hero {
    background: linear-gradient(145deg, #7B6EF6 0%, #9D8FF5 50%, #B8A9F5 100%);
    padding: 48px 24px 56px;
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

  /* Avatar */
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
    color: rgba(255,255,255,0.7);
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

  /* ── Body ── */
  .body {
    padding: 20px 16px;
    margin-top: -24px;
    position: relative;
    z-index: 2;
  }

  /* Toasts */
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
  .toast--success { background: #f0fdf4; border: 1.5px solid #86efac; color: #15803d; }
  .toast--error { background: #fff5f5; border: 1.5px solid #fca5a5; color: #dc2626; }

  /* Cards */
  .card {
    background: white;
    border-radius: 24px;
    padding: 18px;
    margin-bottom: 14px;
    box-shadow: 0 4px 20px rgba(123,110,246,0.08);
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
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .card-icon-wrap--purple { background: rgba(123,110,246,0.10); }
  .card-icon { width: 22px; height: 22px; }
  .card-label-group { flex: 1; min-width: 0; }
  .card-label-title { font-size: 14px; font-weight: 800; color: #2D2A5E; margin: 0 0 2px; }
  .card-label-sub { font-size: 12px; color: #aab4cc; margin: 0; }
  .badge-check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e8fdf0;
    color: #15803d;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
  }
  .card-divider { height: 1px; background: #F3F1FF; margin: 14px 0; }

  /* Pairing Panel */
  .pairing-panel {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1.5px dashed #EAE6FF;
  }
  .code-display {
    background: #F7F5FF;
    border: 2px dashed #B8A9F5;
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
    color: #7B6EF6;
    margin-bottom: 6px;
  }
  .code-hint { font-size: 11px; color: #aab4cc; margin: 0; }
  .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 16px 0;
    color: #ccc;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #EAE6FF;
  }
  .input-row { display: flex; gap: 10px; }
  .code-input {
    flex: 1;
    padding: 12px 16px;
    border: 2px solid #EAE6FF;
    border-radius: 14px;
    font-size: 20px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 0.3em;
    color: #2D2A5E;
    text-transform: uppercase;
    background: #FAFAFF;
    outline: none;
    font-family: 'Nunito', sans-serif;
    transition: border-color 0.2s;
  }
  .code-input:focus { border-color: #7B6EF6; }

  /* Info rows */
  .info-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
  }
  .info-emoji { font-size: 22px; width: 36px; text-align: center; flex-shrink: 0; }
  .info-key { font-size: 11px; color: #aab4cc; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .info-val { font-size: 14px; color: #2D2A5E; font-weight: 700; margin: 3px 0 0; }
  .info-val--accent { color: #7B6EF6; }
  .partner-avatar-sm {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #EAE6FF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
    overflow: hidden;
  }

  /* Section labels */
  .section-label {
    font-size: 11px;
    font-weight: 800;
    color: #aab4cc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 12px;
  }
  .section-label--card { margin-bottom: 10px; }

  /* Edit form */
  .edit-form { display: flex; flex-direction: column; gap: 10px; }
  .form-input {
    padding: 11px 14px;
    border: 2px solid #EAE6FF;
    border-radius: 14px;
    font-size: 14px;
    color: #2D2A5E;
    font-family: 'Nunito', sans-serif;
    font-weight: 600;
    outline: none;
    transition: border-color 0.2s;
    background: #FAFAFF;
  }
  .form-input:focus { border-color: #7B6EF6; }
  .form-textarea { resize: vertical; min-height: 72px; }
  .form-date-label { font-size: 12px; font-weight: 700; color: #aab4cc; margin: 0; }
  .file-label {
    display: block;
    padding: 14px;
    background: #F7F5FF;
    border: 2px dashed #B8A9F5;
    border-radius: 14px;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #7B6EF6;
    cursor: pointer;
  }
  .btn-row { display: flex; gap: 10px; }

  /* Buttons */
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
  .btn--primary { background: linear-gradient(135deg, #7B6EF6, #9D8FF5); color: white; }
  .btn--success { background: linear-gradient(135deg, #5ba882, #7DC4A4); color: white; }
  .btn--outline {
    background: white;
    border: 2px solid #EAE6FF;
    color: #7B6EF6;
  }
  .btn--ghost { background: #F7F5FF; color: #888; }
  .btn--sm { padding: 8px 14px; font-size: 12px; border-radius: 12px; }
  .btn--block { width: 100%; }

  /* Logout */
  .logout-btn {
    width: 100%;
    padding: 16px;
    background: white;
    color: #e07070;
    border: 2px solid #fde8e8;
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
  }
  .logout-btn:hover { background: #fff5f5; }
</style>
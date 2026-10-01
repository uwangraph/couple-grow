<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { toast } from '$lib/toast.svelte';

  let folders = $state<any[]>([]);
  let selectedFolder = $state<string | null>(null);
  let notes = $state<any[]>([]);
  let loading = $state(true);
  let notesLoading = $state(false);
  let errorMsg = $state('');
  let notesError = $state('');
  let folderSaving = $state(false);
  let notesRequestId = 0;

  let showFolderModal = $state(false);
  let folderName = $state('');

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await fetchFolders();
  });

  async function fetchFolders() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`${API_URL}/folders`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      if (!res.ok) throw new Error('Gagal memuat folder');
      const data = await readApiJson<{ folders?: any[] }>(res);
      folders = data.folders || [];
      if (folders.length > 0 && (!selectedFolder || !folders.some(folder => String(folder.id) === String(selectedFolder)))) {
        selectedFolder = folders[0].id;
        await fetchNotes(selectedFolder!);
      }
    } catch(e) { errorMsg = e instanceof Error ? e.message : 'Folder belum bisa dimuat.'; }
    finally { loading = false; }
  }

  async function fetchNotes(folderId: string) {
    const requestId = ++notesRequestId;
    selectedFolder = folderId;
    notesLoading = true;
    notesError = '';
    try {
      const res = await fetch(`${API_URL}/notes?folder_id=${encodeURIComponent(folderId)}`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      if (!res.ok) throw new Error('Gagal memuat catatan');
      const data = await readApiJson<{ notes?: any[] }>(res);
      if (requestId === notesRequestId) notes = data.notes || [];
    } catch(e) {
      if (requestId === notesRequestId) notesError = e instanceof Error ? e.message : 'Catatan belum bisa dimuat.';
    } finally {
      if (requestId === notesRequestId) { notesLoading = false; loading = false; }
    }
  }

  async function createFolder(e: Event) {
    e.preventDefault();
    if (!folderName.trim() || folderSaving) return;
    folderSaving = true;
    try {
      const res = await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ name: folderName.trim() })
      });
      if (res.status === 401) { auth.logout(); goto('/login'); return; }
      if (!res.ok) throw new Error('Gagal membuat folder');
      const data = await readApiJson<{ id?: string | number }>(res);
      showFolderModal = false;
      folderName = '';
      if (data.id != null) selectedFolder = String(data.id);
      await fetchFolders();
      if (selectedFolder) await fetchNotes(selectedFolder);
      toast.success('Folder berhasil dibuat');
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Folder belum bisa dibuat.'); }
    finally { folderSaving = false; }
  }

  let selectedFolderData = $derived(folders.find(f => String(f.id) === String(selectedFolder)));

  function getNotePreview(note: any): string {
    if (note.content?.startsWith('__SHEET__:')) return 'Spreadsheet bersama';
    if (note.content) return note.content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    try {
      const cl = JSON.parse(note.checklist || '[]');
      if (cl.length > 0) return cl.map((i: any) => (i.is_done ? '✓' : '○') + ' ' + i.text).join('  ').slice(0, 80);
    } catch(e) {}
    return '';
  }

  function getNoteType(note: any): 'text' | 'checklist' | 'spreadsheet' {
    if (note.content?.startsWith('__SHEET__:')) return 'spreadsheet';
    try {
      const cl = JSON.parse(note.checklist || '[]');
      return cl.length > 0 ? 'checklist' : 'text';
    } catch(e) { return 'text'; }
  }
</script>

<div class="notes-root">

  <!-- Header -->
  <div class="header">
    <div class="header-inner">
      <div class="header-row">
        <div>
          <button class="back-btn" onclick={() => goto('/home')} aria-label="Kembali ke Beranda">
            <Icon name="back" size={18} />
            Kembali
          </button>
          <p class="header-sub">Ruang Tulis</p>
          <h1 class="header-title">
            Catatan <Icon name="notes" size={24} />
          </h1>
          <p class="header-description">Ide, cerita, dan rencana kecil kalian tersimpan di sini.</p>
        </div>
        <button type="button" class="new-folder-btn" onclick={() => showFolderModal = true}>
          + Folder
        </button>
      </div>

      <!-- Folder tabs -->
      {#if folders.length > 0}
        <div class="folder-tabs">
          {#each folders as f}
            <button
              class="folder-tab {String(selectedFolder) === String(f.id) ? 'folder-tab--active' : ''}"
              onclick={() => fetchNotes(f.id)}
              aria-pressed={String(selectedFolder) === String(f.id)}
            >
              <Icon name="folder" size={14} />
              {f.name}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    {#if loading}
      <div class="loading-wrap"><div class="spinner"></div></div>

    {:else if errorMsg}
      <div class="empty-state" role="alert">
        <div class="empty-icon"><Icon name="folder" size={36} /></div>
        <p class="empty-title">Catatan belum bisa dimuat</p>
        <p class="empty-sub">{errorMsg}</p>
        <button type="button" class="empty-cta" onclick={fetchFolders}>Coba lagi</button>
      </div>

    {:else if folders.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="folder" size={36} />
        </div>
        <p class="empty-title">Belum ada folder</p>
        <p class="empty-sub">Buat ruang untuk ide, cerita, dan rencana kalian.</p>
        <button class="empty-cta" onclick={() => showFolderModal = true}>+ Buat Folder</button>
      </div>

    {:else}
      <!-- Folder header -->
      {#if selectedFolderData}
        <div class="section-header">
          <div class="section-title-group">
            <div class="section-emoji">
              <Icon name="folder" size={26} />
            </div>
            <div>
              <p class="section-title">{selectedFolderData.name}</p>
              <p class="section-sub">{notesLoading ? 'Memuat catatan...' : `${notes.length} catatan`}</p>
            </div>
          </div>
          {#if selectedFolder}
            <a href="/notes/new?folder_id={selectedFolder}" class="new-note-btn" aria-label="Buat catatan baru">
              + Catatan
            </a>
          {/if}
        </div>
      {/if}

      {#if notesLoading}
        <div class="notes-grid">
          {#each [1,2,3] as _}
            <div class="skeleton-card"></div>
          {/each}
        </div>

      {:else if notesError}
        <div class="empty-notes" role="alert">
          <p class="empty-notes-title">Catatan belum bisa dimuat</p>
          <p class="empty-notes-sub">{notesError}</p>
          {#if selectedFolder}<button type="button" class="empty-cta" onclick={() => fetchNotes(selectedFolder!)}>Coba lagi</button>{/if}
        </div>

      {:else if notes.length === 0}
        <div class="empty-notes">
          <div style="margin-bottom:12px; display: flex; justify-content: center; color: #94A3B8;">
            <Icon name="edit" size={40} />
          </div>
          <p class="empty-notes-title">Folder ini masih kosong</p>
          <p class="empty-notes-sub">Mulai dengan satu ide atau daftar kecil yang ingin kalian kerjakan.</p>
          {#if selectedFolder}
            <a href="/notes/new?folder_id={selectedFolder}" class="empty-cta" aria-label="Buat catatan baru">+ Buat Catatan</a>
          {/if}
        </div>

      {:else}
        <div class="notes-grid">
          {#each notes as note}
            {@const type = getNoteType(note)}
            {@const preview = getNotePreview(note)}
            {@const typeLabel = type === 'checklist' ? 'Checklist' : type === 'spreadsheet' ? 'Spreadsheet' : 'Teks'}
            <a href="/notes/{note.id}" class="note-card" aria-label="Buka catatan {note.title || 'Tanpa Judul'}, format {typeLabel}">
              <div class="note-card-top">
                <span class="note-type-badge {type === 'checklist' ? 'note-type-badge--check' : ''}">
                  <Icon name={type === 'checklist' ? 'check' : type === 'spreadsheet' ? 'wallet' : 'edit'} size={14} />
                  {typeLabel}
                </span>
                <span class="note-date">
                  Diedit {new Date(note.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h3 class="note-title">{note.title || 'Catatan Tanpa Judul'}</h3>
              {#if preview}
                <p class="note-preview">{preview}</p>
              {/if}
            </a>
          {/each}
        </div>
      {/if}
    {/if}

    <div style="height:32px;"></div>
  </div>

  <!-- Modal Buat Folder -->
  {#if showFolderModal}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Buat folder baru" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) showFolderModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showFolderModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="folder" size={24} />
          </div>
          <div>
            <h3 class="modal-title">Buat Folder Baru</h3>
            <p class="modal-subtitle">Tentukan nama folder catatan</p>
          </div>
        </div>

        <form class="modal-form" onsubmit={createFolder}>
          <div class="form-group">
            <label class="form-label" for="folder-name">Nama Folder</label>
            <input
              id="folder-name"
              type="text"
              bind:value={folderName}
              required
              placeholder="Contoh: Resep Masakan"
              class="form-input"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showFolderModal = false} disabled={folderSaving}>Batal</button>
            <button type="submit" class="modal-submit" disabled={folderSaving}>{folderSaving ? 'Membuat...' : 'Buat Folder'}</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .notes-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
  }

  /* Header */
  .header {
    padding: 24px 22px 20px;
    position: relative;
    border-radius:0 0 28px 28px;
    background:linear-gradient(155deg,#1D4ED8,#2563EB 55%,#3B82F6);
    box-shadow:0 12px 26px rgba(37,99,235,.18);
  }
  .header-inner { position: relative; max-width:760px; margin:auto; }
  .header-row { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:18px; }
  .back-btn { display:inline-flex; align-items:center; gap:6px; min-height:44px; border:0; background:transparent; color:#DBEAFE; padding:0 6px 0 0; margin-bottom:12px; font:800 14px 'Nunito',sans-serif; cursor:pointer; }
  .back-btn:hover { color:#fff; }
  .header-sub { font-size:11px; color:#DBEAFE; margin:0 0 6px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; }
  .header-title { display:flex; align-items:center; gap:8px; font-size:29px; font-weight:900; color:#fff; margin:0; letter-spacing:-.03em; }
  .header-description { max-width:300px; margin:8px 0 0; color:#EFF6FF; font-size:14px; line-height:1.45; font-weight:700; }
  .new-folder-btn {
    background:rgba(255,255,255,.18);
    border:1px solid rgba(255,255,255,.35);
    color: #ffffff;
    border-radius: 12px;
    padding: 8px 14px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: filter 0.2s, transform 0.15s;
    box-shadow:0 5px 14px rgba(15,55,140,.13);
  }
  .new-folder-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }

  /* Folder tabs */
  .folder-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 0;
    scrollbar-width: none;
  }
  .folder-tabs::-webkit-scrollbar { display: none; }
  .folder-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 99px;
    border:1px solid rgba(255,255,255,.35);
    background:rgba(255,255,255,.13);
    color:#DBEAFE;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .folder-tab--active { background:#fff; color:#1D4ED8; border-color:#fff; box-shadow:0 5px 12px rgba(15,55,140,.13); }

  /* Body */
  .body { max-width:760px; margin:auto; padding:24px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E2E8F0; border-top-color: #2196F3; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Empty */
  .empty-state { text-align:center; padding:60px 20px; background:rgba(255,255,255,.7); border-radius:22px; }
  .empty-icon { width:72px; height:72px; margin:0 auto 16px; color:#2563EB; display:grid; place-items:center; border-radius:22px; background:#E7F1FF; }
  .empty-title { font-size:17px; font-weight:900; color:#172033; margin:0 0 6px; }
  .empty-sub { font-size:14px; line-height:1.5; color:#64748B; margin:0 0 22px; }
  .empty-cta {
    display: inline-block;
    background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 22px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }

  /* Section header */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .section-title-group { display: flex; align-items: center; gap: 10px; }
  .section-emoji { color: #1976D2; }
  .section-title { font-size: 16px; font-weight: 800; color: #1F2937; margin: 0 0 2px; }
  .section-sub { font-size: 12px; color: #94A3B8; margin: 0; font-weight: 600; }
  .new-note-btn {
    display: inline-block;
    background: #2196F3;
    color: white;
    border-radius: 12px;
    padding: 9px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: transform 0.12s;
    white-space: nowrap;
  }
  .new-note-btn:active { transform: scale(0.96); }

  .notes-grid { display:grid; grid-template-columns:1fr; gap:10px; }
  @media (min-width:600px) { .notes-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }

  .note-card {
    /* Apple-like glass card: translucent white + subtle specular top edge */
    background: #FFFFFF;
    border-radius:20px;
    padding:16px;
    text-decoration: none;
    border: none;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height:116px;
  }
  .note-card:hover { border-color: rgba(33, 150, 243, 0.4); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 10px rgba(31,41,55,0.08); }
  .note-card:active { transform: scale(0.97); }

  .note-card-top { display: flex; align-items: center; justify-content: space-between; }
  .note-type-badge {
    color: #1976D2;
    background: rgba(33, 150, 243, 0.12); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10);
    padding: 5px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .note-type-badge--check { background: rgba(79, 191, 163, 0.12); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10); color: #2F9A80; }
  .note-date { font-size: 10px; color: #94A3B8; font-weight: 600; }
  .note-title { font-size:16px; font-weight:900; color:#172033; margin:0; line-height:1.35; display:-webkit-box; line-clamp:2; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .note-preview { font-size:12px; color:#64748B; margin:0; font-weight:600; line-height:1.5; display:-webkit-box; line-clamp:3; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }

  /* Empty notes */
  .empty-notes { text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 18px; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 1px 2px rgba(31,41,55,0.04); }
  .empty-notes-title { font-size: 15px; font-weight: 700; color: #1F2937; margin: 0 0 6px; }
  .empty-notes-sub { font-size: 13px; color: #94A3B8; margin: 0 0 18px; }

  /* Skeleton */
  .skeleton-card {
    height: 120px;
    border-radius: 18px;
    background: linear-gradient(90deg, #EEF2F7 25%, #E2E8F0 50%, #EEF2F7 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(31, 41, 55, 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: #ffffff;
    border-radius: 24px 24px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 40px;
    animation: slide-up 0.25s ease;
  }
  @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-handle { width: 44px; height: 5px; background: #E2E8F0; border-radius: 99px; margin: 0 auto 20px; }

  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .modal-icon-circle { width: 50px; height: 50px; border-radius: 22px; background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.32),
      4px 6px 13px rgba(21, 101, 192, 0.22);
  }
  .modal-title { font-size: 17px; font-weight: 800; color: #1F2937; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #64748B; margin: 0; font-weight: 600; }

  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px;
    border: none;
    border-radius: 20px;
    font-size: 15px;
    font-weight: 600;
    color: #1F2937;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #E6F2FD;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus {  box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.18),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95),
      0 0 0 3px rgba(33, 150, 243, 0.16); }
  .modal-actions { display: flex; gap: 12px; }
  .modal-cancel { flex: 1; padding: 14px; background: #F1F5F9; color: #64748B; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
  .modal-submit { flex: 2; padding: 14px; background: #2196F3; color: white; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
  .modal-submit:disabled { opacity:.6; cursor:wait; }

  .note-card, .empty-notes, .empty-state { border: 1px solid rgba(255,255,255,.92); box-shadow: 0 8px 20px rgba(30,64,175,.06); border-radius: 16px; }
  .new-note-btn, .empty-cta, .modal-submit { background:#2563EB; box-shadow:0 8px 18px rgba(37,99,235,.2); border-radius:12px; }
  .folder-tab { border-radius: 10px; }
  .form-input { border: 1px solid #E2E8F0; box-shadow: none; background: #F8FAFC; border-radius: 12px; }
  .form-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .notes-root { width:100%; }
  .folder-tab { min-height:38px; font-weight:800; }
  .new-folder-btn { min-height:40px; font-weight:900; }
  .section-header { gap:12px; }
  .section-title-group { min-width:0; }
  .section-title { overflow-wrap:anywhere; font-weight:900; }
  .section-sub { color:#64748b; font-weight:700; }
  .section-emoji { width:42px; height:42px; display:grid; place-items:center; flex:none; border-radius:13px; color:#2563eb; background:#eaf3ff; }
  .new-note-btn { min-height:40px; display:inline-flex; align-items:center; padding-inline:14px; font-weight:900; }
  .note-card { min-width:0; min-height:132px; border-color:#e3edfa; background:rgba(255,255,255,.94); }
  .note-card:hover { border-color:#bfdbfe; transform:translateY(-2px); box-shadow:0 12px 26px rgba(30,64,175,.1); }
  .note-type-badge,.note-type-badge--check { width:32px; height:32px; border-radius:10px; background:#eaf3ff; color:#2563eb; box-shadow:none; }
  .note-type-badge--check { background:#e7f8f3; color:#168f78; }
  .note-date { color:#64748b; font-size:12px; font-weight:800; }
  .note-preview { font-size:14px; }
  .note-title { overflow-wrap:anywhere; }
  .modal { max-height:calc(100dvh - 32px); overflow-y:auto; padding-bottom:max(24px,env(safe-area-inset-bottom)); box-shadow:0 -18px 40px rgba(15,55,140,.14); }
  .modal-icon-circle { border-radius:16px; background:#eaf3ff; color:#2563eb; box-shadow:none; }
  .modal-cancel { color:#475569; font-weight:800; }
  .folder-tab { min-height:44px; }
  .new-folder-btn,.new-note-btn { min-height:44px; }
  .form-label { font-size:12px; color:#526984; font-weight:800; }
  .form-input { min-height:48px; font-size:16px; }
  .note-card { gap:10px; }
  .note-card-top { gap:10px; }
  .note-type-badge,.note-type-badge--check { width:auto; min-height:32px; padding:6px 9px; gap:5px; font-size:12px; font-weight:900; white-space:nowrap; }
  .note-date { text-align:right; line-height:1.35; }
  .empty-notes-title { font-size:17px; font-weight:900; }
  .empty-notes-sub { max-width:290px; margin-inline:auto; color:#526984; font-size:14px; line-height:1.5; }
  .empty-cta { min-height:44px; display:inline-flex; align-items:center; justify-content:center; font-weight:900; }
  .modal-cancel:disabled { opacity:.6; cursor:wait; }
  @media (max-width:380px) {
    .header { padding-inline:18px; }
    .body { padding-inline:14px; }
    .new-folder-btn { padding-inline:10px; }
    .modal { padding-inline:18px; }
  }
</style>

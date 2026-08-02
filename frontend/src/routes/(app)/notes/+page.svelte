<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let folders = $state<any[]>([]);
  let selectedFolder = $state<string | null>(null);
  let notes = $state<any[]>([]);
  let loading = $state(true);
  let notesLoading = $state(false);

  let showFolderModal = $state(false);
  let folderName = $state('');

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await fetchFolders();
  });

  async function fetchFolders() {
    loading = true;
    try {
      const res = await fetch(`${API_URL}/folders`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await res.json();
      folders = data.folders || [];
      if (folders.length > 0 && !selectedFolder) {
        selectedFolder = folders[0].id;
        await fetchNotes(selectedFolder!);
      } else { loading = false; }
    } catch(e) { loading = false; }
  }

  async function fetchNotes(folderId: string) {
    selectedFolder = folderId;
    notesLoading = true;
    try {
      const res = await fetch(`${API_URL}/notes?folder_id=${folderId}`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await res.json();
      notes = data.notes || [];
    } catch(e) {} finally { notesLoading = false; loading = false; }
  }

  async function createFolder(e: Event) {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ name: folderName, emoji: 'folder' })
      });
      showFolderModal = false;
      folderName = '';
      await fetchFolders();
    } catch(e) {}
  }

  let selectedFolderData = $derived(folders.find(f => f.id === selectedFolder));

  function getNotePreview(note: any): string {
    if (note.content) return note.content.slice(0, 80);
    try {
      const cl = JSON.parse(note.checklist || '[]');
      if (cl.length > 0) return cl.map((i: any) => (i.is_done ? '✓' : '○') + ' ' + i.text).join('  ').slice(0, 80);
    } catch(e) {}
    return '';
  }

  function getNoteType(note: any): 'text' | 'checklist' {
    try {
      const cl = JSON.parse(note.checklist || '[]');
      return cl.length > 0 ? 'checklist' : 'text';
    } catch(e) { return 'text'; }
  }
</script>

<div class="notes-root">

  <!-- Header -->
  <div class="header">
    <div class="blob b1"></div>
    <div class="blob b2"></div>
    <div class="header-inner">
      <div class="header-row">
        <div>
          <button class="back-btn" onclick={() => goto('/home')} aria-label="Kembali ke Beranda">
            <Icon name="back" size={18} />
            Kembali
          </button>
          <p class="header-sub">Ruang Tulis</p>
          <h1 class="header-title" style="display: flex; align-items: center; gap: 8px;">
            Catatan <Icon name="notes" size={24} />
          </h1>
        </div>
        <button class="new-folder-btn" onclick={() => showFolderModal = true}>
          + Folder
        </button>
      </div>

      <!-- Folder tabs -->
      {#if folders.length > 0}
        <div class="folder-tabs">
          {#each folders as f}
            <button
              class="folder-tab {selectedFolder === f.id ? 'folder-tab--active' : ''}"
              onclick={() => fetchNotes(f.id)}
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

    {:else if folders.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="folder" size={56} />
        </div>
        <p class="empty-title">Belum ada folder</p>
        <p class="empty-sub">Buat folder pertama untuk mulai menulis</p>
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
              <p class="section-sub">{notes.length} catatan</p>
            </div>
          </div>
          {#if selectedFolder}
            <a href="/notes/new?folder_id={selectedFolder}" class="new-note-btn" role="button" aria-label="Buat catatan baru">
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

      {:else if notes.length === 0}
        <div class="empty-notes">
          <div style="margin-bottom:12px; display: flex; justify-content: center; color: #aab4cc;">
            <Icon name="edit" size={40} />
          </div>
          <p class="empty-notes-title">Folder ini masih kosong</p>
          <p class="empty-notes-sub">Yuk mulai menulis catatan pertama!</p>
          {#if selectedFolder}
            <a href="/notes/new?folder_id={selectedFolder}" class="empty-cta" role="button" aria-label="Buat catatan baru">+ Buat Catatan</a>
          {/if}
        </div>

      {:else}
        <div class="notes-grid">
          {#each notes as note}
            {@const type = getNoteType(note)}
            {@const preview = getNotePreview(note)}
            <a href="/notes/{note.id}" class="note-card">
              <div class="note-card-top">
                <span class="note-type-badge {type === 'checklist' ? 'note-type-badge--check' : ''}">
                  <Icon name={type === 'checklist' ? 'check' : 'edit'} size={14} />
                </span>
                <span class="note-date">
                  {new Date(note.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showFolderModal = false; }}>
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
            <label class="form-label">Nama Folder</label>
            <input
              type="text"
              bind:value={folderName}
              required
              placeholder="Contoh: Resep Masakan"
              class="form-input"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showFolderModal = false}>Batal</button>
            <button type="submit" class="modal-submit">Buat Folder</button>
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
    background: #F5F8FE;
  }

  /* Header */
  .header {
    background: linear-gradient(160deg, #8FC5F7 0%, #6BAFF2 55%, #9CCCF8 100%);
    padding: 32px 20px 20px;
    position: relative;
    overflow: hidden;
  }
  .blob { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.07); }
  .b1 { width: 160px; height: 160px; top: -50px; right: -40px; }
  .b2 { width: 90px; height: 90px; bottom: -20px; left: -20px; }
  .header-inner { position: relative; z-index: 1; }
  .header-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
  .back-btn { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: rgba(255,255,255,0.9); padding: 0; margin-bottom: 10px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
  .back-btn:hover { color: white; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.65); margin: 0 0 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .header-title { font-size: 24px; font-weight: 900; color: white; margin: 0; }
  .new-folder-btn {
    background: rgba(255,255,255,0.2);
    border: 1.5px solid rgba(255,255,255,0.35);
    color: white;
    border-radius: 12px;
    padding: 8px 14px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .new-folder-btn:hover { background: rgba(255,255,255,0.3); }

  /* Folder tabs */
  .folder-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .folder-tabs::-webkit-scrollbar { display: none; }
  .folder-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 99px;
    border: none;
    background: rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.75);
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .folder-tab--active { background: white; color: #6BAFF2; }

  /* Body */
  .body { padding: 18px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E6EFFF; border-top-color: #6BAFF2; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Empty */
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { margin-bottom: 14px; color: #aab4cc; display: flex; justify-content: center; }
  .empty-title { font-size: 16px; font-weight: 900; color: #2D2A5E; margin: 0 0 6px; }
  .empty-sub { font-size: 13px; color: #aab4cc; margin: 0 0 22px; }
  .empty-cta {
    display: inline-block;
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
    color: white;
    border: none;
    border-radius: 16px;
    padding: 13px 24px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 0 6px 20px rgba(107,175,242,0.3);
  }

  /* Section header */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .section-title-group { display: flex; align-items: center; gap: 10px; }
  .section-emoji { color: #6BAFF2; }
  .section-title { font-size: 16px; font-weight: 900; color: #2D2A5E; margin: 0 0 2px; }
  .section-sub { font-size: 12px; color: #aab4cc; margin: 0; font-weight: 700; }
  .new-note-btn {
    display: inline-block;
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
    color: white;
    border-radius: 12px;
    padding: 9px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(123,110,246,0.28);
    transition: transform 0.12s;
    white-space: nowrap;
  }
  .new-note-btn:active { transform: scale(0.96); }

  /* Notes grid — 2 kolom */
  .notes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

  .note-card {
    background: white;
    border-radius: 20px;
    padding: 14px;
    text-decoration: none;
    box-shadow: 0 3px 14px rgba(123,110,246,0.07);
    border: 2px solid transparent;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 110px;
  }
  .note-card:hover { border-color: #8DB2F0; }
  .note-card:active { transform: scale(0.97); }

  .note-card-top { display: flex; align-items: center; justify-content: space-between; }
  .note-type-badge {
    color: #6BAFF2;
    background: #F0F5FF;
    padding: 5px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .note-type-badge--check { background: #F0FDF4; color: #15803d; }
  .note-date { font-size: 10px; color: #aab4cc; font-weight: 700; }
  .note-title { font-size: 13px; font-weight: 900; color: #2D2A5E; margin: 0; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .note-preview { font-size: 11px; color: #aab4cc; margin: 0; font-weight: 600; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

  /* Empty notes */
  .empty-notes { text-align: center; padding: 48px 20px; background: white; border-radius: 24px; box-shadow: 0 3px 14px rgba(123,110,246,0.06); }
  .empty-notes-title { font-size: 15px; font-weight: 900; color: #2D2A5E; margin: 0 0 6px; }
  .empty-notes-sub { font-size: 13px; color: #aab4cc; margin: 0 0 18px; }

  /* Skeleton */
  .skeleton-card {
    height: 120px;
    border-radius: 20px;
    background: linear-gradient(90deg, #f0ecff 25%, #e8e3ff 50%, #f0ecff 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(45,42,94,0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: white;
    border-radius: 28px 28px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 40px;
    animation: slide-up 0.25s ease;
  }
  @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-handle { width: 44px; height: 5px; background: #E0DBFF; border-radius: 99px; margin: 0 auto 20px; }

  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .modal-icon-circle { width: 50px; height: 50px; border-radius: 16px; background: #F0F5FF; display: flex; align-items: center; justify-content: center; color: #6BAFF2; flex-shrink: 0; }
  .modal-title { font-size: 17px; font-weight: 900; color: #2D2A5E; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #aab4cc; margin: 0; font-weight: 700; }

  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 800; color: #aab4cc; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px;
    border: 2px solid #E6EFFF;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    color: #2D2A5E;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #FAFAFF;
    transition: border-color 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #6BAFF2; }
  .modal-actions { display: flex; gap: 12px; }
  .modal-cancel { flex: 1; padding: 14px; background: #F5F8FE; color: #aab4cc; border: none; border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer; }
  .modal-submit { flex: 2; padding: 14px; background: linear-gradient(135deg, #6BAFF2, #4F96E5); color: white; border: none; border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 6px 20px rgba(107,175,242,0.3); }
</style>

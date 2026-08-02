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
          <div style="margin-bottom:12px; display: flex; justify-content: center; color: #94A3B8;">
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
    background: transparent;
  }

  /* Header — clean minimal (subtle Apple-like glass) */
  .header {
    padding: 26px 20px 18px;
    position: relative;
  }
  .header-inner { position: relative; }
  .header-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
  .back-btn { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: #4772E8; padding: 0; margin-bottom: 10px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
  .back-btn:hover { color: #2b5f9e; }
  .header-sub { font-size: 12px; color: #94A3B8; margin: 0 0 3px; font-weight: 600; }
  .header-title { font-size: 26px; font-weight: 800; color: #1F2937; margin: 0; letter-spacing: -0.02em; }
  .new-folder-btn {
    background: #0B9E6B;
    border: 1px solid #0B9E6B;
    color: #ffffff;
    border-radius: 12px;
    padding: 8px 14px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .new-folder-btn:hover { background: #059669; }

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
    border: 1px solid rgba(226, 232, 240, 0.8);
    background: #ffffff;
    color: #64748B;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .folder-tab--active { background: #ffffff; color: #4772E8; border-color: rgba(91, 141, 239, 0.4); box-shadow: 0 1px 3px rgba(91, 141, 239,0.18); }

  /* Body */
  .body { padding: 8px 20px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E2E8F0; border-top-color: #5B8DEF; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Empty */
  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { margin-bottom: 14px; color: #94A3B8; display: flex; justify-content: center; }
  .empty-title { font-size: 16px; font-weight: 800; color: #1F2937; margin: 0 0 6px; }
  .empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 22px; }
  .empty-cta {
    display: inline-block;
    background: #0B9E6B;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 22px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
  }

  /* Section header */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .section-title-group { display: flex; align-items: center; gap: 10px; }
  .section-emoji { color: #4772E8; }
  .section-title { font-size: 16px; font-weight: 800; color: #1F2937; margin: 0 0 2px; }
  .section-sub { font-size: 12px; color: #94A3B8; margin: 0; font-weight: 600; }
  .new-note-btn {
    display: inline-block;
    background: #5B8DEF;
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

  /* Notes grid — 2 kolom */
  .notes-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

  .note-card {
    /* Apple-like glass card: translucent white + subtle specular top edge */
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px) saturate(150%);
    -webkit-backdrop-filter: blur(12px) saturate(150%);
    border-radius: 18px;
    padding: 14px;
    text-decoration: none;
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 1px 3px rgba(31, 41, 55, 0.06);
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 110px;
  }
  .note-card:hover { border-color: rgba(91, 141, 239, 0.4); box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 10px rgba(31,41,55,0.08); }
  .note-card:active { transform: scale(0.97); }

  .note-card-top { display: flex; align-items: center; justify-content: space-between; }
  .note-type-badge {
    color: #4772E8;
    background: rgba(91, 141, 239, 0.12);
    padding: 5px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .note-type-badge--check { background: rgba(16, 185, 129, 0.12); color: #059669; }
  .note-date { font-size: 10px; color: #94A3B8; font-weight: 600; }
  .note-title { font-size: 13px; font-weight: 700; color: #1F2937; margin: 0; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .note-preview { font-size: 11px; color: #64748B; margin: 0; font-weight: 500; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

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
  .modal-icon-circle { width: 50px; height: 50px; border-radius: 16px; background: rgba(91, 141, 239,0.12); display: flex; align-items: center; justify-content: center; color: #4772E8; flex-shrink: 0; }
  .modal-title { font-size: 17px; font-weight: 800; color: #1F2937; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #64748B; margin: 0; font-weight: 600; }

  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    color: #1F2937;
    font-family: 'Nunito', sans-serif;
    outline: none;
    background: #ffffff;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: #5B8DEF; box-shadow: 0 0 0 3px rgba(91, 141, 239, 0.12); }
  .modal-actions { display: flex; gap: 12px; }
  .modal-cancel { flex: 1; padding: 14px; background: #F1F5F9; color: #64748B; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
  .modal-submit { flex: 2; padding: 14px; background: #5B8DEF; color: white; border: none; border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; }
</style>

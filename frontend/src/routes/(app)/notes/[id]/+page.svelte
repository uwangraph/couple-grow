<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import RichEditor from '$lib/RichEditor.svelte';
  import Spreadsheet from '$lib/Spreadsheet.svelte';

  let id = $derived(page.params.id);
  let folderId = $derived(page.url.searchParams.get('folder_id'));

  let title = $state('');
  let content = $state('');
  let checklist = $state<any[]>([]);
  let activeTab = $state<'text' | 'checklist' | 'spreadsheet'>('text');
  let loading = $state(false);
  let saved = $state(false);
  let errorMessage = $state('');
  let spreadsheetData = $state<string[][]>([]);

  onMount(async () => {
    if (!auth.token) return goto('/login');
    if (id !== 'new') await fetchNote();
  });

  async function fetchNote() {
    loading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${API_URL}/notes/${id}`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await readApiJson<{ note?: any; error?: string }>(res);
      if (res.ok && data.note) {
        title = data.note.title || '';
        content = data.note.content || '';
        try { checklist = data.note.checklist ? JSON.parse(data.note.checklist) : []; }
        catch(e) { checklist = []; }
        // Load spreadsheet data from content if tab is spreadsheet
        if (data.note.content?.startsWith('__SHEET__:')) {
          try { spreadsheetData = JSON.parse(data.note.content.replace('__SHEET__:', '')); activeTab = 'spreadsheet'; }
          catch(e) { spreadsheetData = []; }
          content = '';
        } else if (checklist.length > 0) {
          activeTab = 'checklist';
        }
      } else {
        throw new Error(data.error || 'Catatan tidak dapat dimuat. Coba lagi.');
      }
    } catch(e) { errorMessage = e instanceof Error ? e.message : 'Catatan tidak dapat dimuat. Coba lagi.'; }
    finally { loading = false; }
  }

  async function saveNote() {
    if (!title.trim()) {
      errorMessage = 'Isi judul catatan terlebih dahulu.';
      return;
    }
    loading = true;
    errorMessage = '';
    saved = false;
    // Serialize spreadsheet data into content field
    const contentToSave = activeTab === 'spreadsheet'
      ? `__SHEET__:${JSON.stringify(spreadsheetData)}`
      : content;
    const body = {
      folder_id: folderId,
      title,
      content: contentToSave,
      checklist: activeTab === 'checklist' && checklist.length > 0 ? checklist : null
    };
    try {
      const url = id === 'new' ? `${API_URL}/notes` : `${API_URL}/notes/${id}`;
      const method = id === 'new' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify(body)
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan catatan');
      saved = true; setTimeout(() => goto('/notes'), 600);
    } catch(e) { errorMessage = e instanceof Error ? e.message : 'Catatan gagal disimpan. Coba lagi.'; }
    finally { loading = false; }
  }

  async function deleteNote() {
    if (!confirm('Hapus catatan ini?')) return;
    try {
      const res = await fetch(`${API_URL}/notes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${auth.token}` } });
      if (!res.ok) throw new Error('Gagal menghapus catatan');
      goto('/notes');
    } catch(e) { errorMessage = e instanceof Error ? e.message : 'Catatan gagal dihapus. Coba lagi.'; }
  }

  function addCheckItem() { checklist = [...checklist, { text: '', is_done: false }]; }
  function toggleCheckItem(idx: number) { checklist[idx].is_done = !checklist[idx].is_done; checklist = [...checklist]; }

  let doneCount = $derived(checklist.filter(i => i.is_done).length);
  let checklistPct = $derived(checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0);
  let wordCount = $derived(content.trim() ? content.trim().split(/\s+/).length : 0);
</script>

<div class="editor-root">

  <!-- Top Bar -->
  <div class="topbar">
    <button type="button" class="back-btn" aria-label="Kembali ke catatan" onclick={() => goto('/notes')}>
      <Icon name="arrow" size={20} style="transform: rotate(180deg)" />
    </button>

    <span class="topbar-title">{id === 'new' ? 'Catatan baru' : 'Edit catatan'}</span>
    <div class="topbar-actions">
      {#if id !== 'new'}
        <button type="button" class="delete-btn" onclick={deleteNote}>Hapus</button>
      {/if}
      <button type="button" class="save-btn {saved ? 'save-btn--saved' : ''}" onclick={saveNote} disabled={loading}>
        {#if saved}✓ Tersimpan{:else if loading}...{:else}Simpan{/if}
      </button>
    </div>
  </div>

  {#if errorMessage}
    <div class="editor-alert" role="alert">
      <span>{errorMessage}</span>
      {#if id !== 'new' && !title && !content}<button type="button" onclick={fetchNote}>Coba lagi</button>{/if}
    </div>
  {/if}

  <div class="editor-intro">
    <p class="eyebrow">CATATAN KALIAN</p>
    <h1>{id === 'new' ? 'Mulai cerita baru.' : 'Teruskan ceritanya.'}</h1>
    <p>{id === 'new' ? 'Simpan ide dan rencana kalian di satu tempat.' : 'Perbarui ide dan rencana kalian di satu tempat.'}</p>
  </div>

  <!-- Title Area -->
  <div class="title-area">
    <label class="section-kicker" for="note-title">{id === 'new' ? 'CATATAN BARU' : 'EDIT CATATAN'}</label>
    <input
      id="note-title"
      bind:value={title}
      placeholder="Judul catatan..."
      class="title-input"
    />
    <div class="title-meta">
      {#if activeTab === 'text'}
        <span class="meta-pill">{wordCount} kata</span>
      {:else if checklist.length > 0}
        <span class="meta-pill meta-pill--progress">{doneCount}/{checklist.length} selesai</span>
      {/if}
      {#if id !== 'new'}
        <span class="meta-pill">Bisa diedit</span>
      {/if}
    </div>
  </div>

  <!-- Tab Switcher -->
  <div class="tab-bar" aria-label="Format catatan">
    <button
      type="button"
      aria-pressed={activeTab === 'text'}
      class="tab-pill {activeTab === 'text' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'text'}
    >
      <Icon name="edit" size={14} /> Teks
    </button>
    <button
      type="button"
      aria-pressed={activeTab === 'checklist'}
      class="tab-pill {activeTab === 'checklist' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'checklist'}
    >
      <Icon name="check" size={14} /> Checklist
      {#if checklist.length > 0}
        <span class="tab-badge">{doneCount}/{checklist.length}</span>
      {/if}
    </button>
    <button
      type="button"
      aria-pressed={activeTab === 'spreadsheet'}
      class="tab-pill {activeTab === 'spreadsheet' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'spreadsheet'}
    >
      <Icon name="wallet" size={14} /> Spreadsheet
    </button>

    <!-- Checklist progress mini bar -->
    {#if activeTab === 'checklist' && checklist.length > 0}
      <div class="tab-progress">
        <div class="tab-progress-fill" style="width:{checklistPct}%"></div>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="content-area {activeTab === 'spreadsheet' ? 'content-area--sheet' : ''}">
    {#if activeTab === 'text'}
      <RichEditor bind:content placeholder="Tulis sesuatu di sini..." />
    {:else if activeTab === 'spreadsheet'}
      <Spreadsheet bind:data={spreadsheetData} />

    {:else}
      <div class="checklist-wrap">
        <!-- Items -->
        {#each checklist as item, idx}
          <div class="check-item {item.is_done ? 'check-item--done' : ''}">
            <button
              type="button"
              aria-label={`Tandai item ${idx + 1} ${item.is_done ? 'belum selesai' : 'selesai'}`}
              class="check-bubble {item.is_done ? 'check-bubble--done' : ''}"
              onclick={() => toggleCheckItem(idx)}
            >
              {#if item.is_done}
                <Icon name="check" size={12} color="white" strokeWidth={3} />
              {/if}
            </button>
            <input
              bind:value={item.text}
              placeholder="Tulis item..."
              class="check-text {item.is_done ? 'check-text--done' : ''}"
            />
            <button
              type="button"
              aria-label={`Hapus item ${idx + 1}`}
              class="check-delete"
              onclick={() => checklist = checklist.filter((_, i) => i !== idx)}
            >
              <Icon name="empty" size={14} />
            </button>
          </div>
        {/each}

        <!-- Add item -->
        <button type="button" class="add-item-btn" onclick={addCheckItem}>
          <span class="add-item-plus">+</span>
          Tambah Item
        </button>

        <!-- All done state -->
        {#if checklist.length > 0 && doneCount === checklist.length}
          <div class="all-done-banner" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <Icon name="sparkles" size={16} /> Semua item selesai!
          </div>
        {/if}
      </div>
    {/if}
  </div>

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .editor-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: linear-gradient(180deg, #eaf5ff 0%, #f8fbff 260px, #fff 420px);
    display: flex;
    flex-direction: column;
    width:100%;
    max-width:760px;
    margin:0 auto;
  }

  /* Topbar */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(14px + env(safe-area-inset-top)) 18px 10px;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 5;
    background: rgba(240, 248, 255, .9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .back-btn {
    width: 44px;
    height: 44px;
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
  .topbar-actions { display: flex; align-items: center; gap: 8px; }
  .topbar-title { min-width:0; margin-left:10px; margin-right:auto; color:#1e293b; font-size:14px; font-weight:900; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .editor-intro { padding:22px 20px 0; }
  .editor-intro .eyebrow { margin:0 0 5px; color:#2563eb; font-size:11px; font-weight:900; letter-spacing:.13em; }
  .editor-intro h1 { margin:0 0 5px; color:#172033; font-size:clamp(23px,6vw,30px); font-weight:900; line-height:1.18; letter-spacing:-.035em; }
  .editor-intro > p:last-child { margin:0; color:#526984; font-size:14px; font-weight:700; line-height:1.5; }
  .editor-alert {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 22px 0;
    padding: 12px 14px;
    border: 1px solid #fecdd3;
    border-radius: 14px;
    background: #fff1f2;
    color: #9f1239;
    font-size: 13px;
    font-weight: 700;
  }
  .editor-alert button { border: 0; background: transparent; color: #be123c; font: inherit; text-decoration: underline; cursor: pointer; white-space: nowrap; }
  .delete-btn {
    min-height: 44px;
    padding: 8px 14px;
    border-radius: 12px;
    border: none;
    background: rgba(239, 124, 151, 0.08);
    color: #D2566F;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s;
  }
  .delete-btn:hover { background: rgba(239, 124, 151, 0.14); }
  .save-btn {
    min-height: 44px;
    padding: 8px 20px;
    border-radius: 12px;
    border: none;
    background: #2563eb;
    color: white;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.2s;
  }
  .save-btn:disabled { opacity: 0.6; }
  .save-btn--saved { background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }

  /* Title */
  .title-area { margin:24px 18px 0; padding:22px 20px 12px; border:1px solid #e3edfa; border-bottom:0; border-radius:20px 20px 0 0; background:rgba(255,255,255,.9); }
  .section-kicker { display: block; margin-bottom: 8px; color: #526984; font-size: 12px; font-weight: 900; letter-spacing: .1em; }
  .title-input {
    width: 100%;
    border: none;
    outline: none;
    font-family: 'Nunito', sans-serif;
    font-size: clamp(25px, 7vw, 34px);
    font-weight: 800;
    color: #1F2937;
    background: transparent;
    margin-bottom: 12px;
  }
  .title-input::placeholder { color: #8da2bd; }
  .title-input:focus-visible { outline:2px solid #60a5fa; outline-offset:4px; border-radius:6px; }
  .title-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .meta-pill {
    font-size: 12px;
    font-weight: 800;
    color: #1976D2;
    background: rgba(33, 150, 243, 0.1); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10);
    padding: 3px 10px;
    border-radius: 99px;
  }
  .meta-pill--progress { color: #2F9A80; background: rgba(79, 191, 163, 0.1); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10); }

  /* Tab bar */
  .tab-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin:0 18px;
    padding:8px 20px 14px;
    border-left:1px solid #e3edfa;
    border-right:1px solid #e3edfa;
    background:rgba(255,255,255,.9);
    flex-wrap: wrap;
  }
  .tab-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 10px 13px;
    border-radius: 99px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: rgba(255,255,255,.7);
    color: #64748B;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-pill--active { background: #e3f1ff; border-color: #8bc7fa; color: #1565c0; box-shadow: 0 4px 12px rgba(33, 150, 243,0.12); }
  .tab-badge {
    background: rgba(33, 150, 243, 0.12); box-shadow: inset 1px 1px 2px rgba(255,255,255,0.7), 1px 2px 5px rgba(21, 101, 192, 0.10);
    color: #1976D2;
    padding: 1px 7px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 700;
  }
  .tab-progress {
    flex: 1;
    height: 6px;
    background: #E2E8F0;
    border-radius: 99px;
    overflow: hidden;
    min-width: 40px;
  }
  .tab-progress-fill {
    height: 100%;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 60%, #1976D2 100%);
    border-radius: 99px;
    transition: width 0.4s ease; box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.5), inset -1px -2px 4px rgba(13, 71, 161, 0.3); }

  /* Content area */
  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px 32px;
    margin: 0 18px 18px;
    background: rgba(255,255,255,.9);
    border: 1px solid #e3edfa;
    border-top:0;
    border-radius: 0 0 20px 20px;
    box-shadow: 0 10px 30px rgba(38, 91, 145, .07);
  }
  .content-area--sheet { padding: 12px; }

  /* Checklist */
  .checklist-wrap { display: flex; flex-direction: column; gap: 8px; }

  .check-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #f7faff;
    border-radius: 14px;
    border: 1px solid #e7eef6;
    transition: all 0.15s;
  }
  .check-item--done {
    background: rgba(79, 191, 163, 0.06);
    border-color: transparent;
  }
  .check-item:focus-within { border-color: rgba(33, 150, 243, 0.4); }

  .check-bubble {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2.5px solid #94A3B8;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.15s;
  }
  .check-bubble--done { background: #4FBFA3; border-color: #4FBFA3; }

  .check-text {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: 'Nunito', sans-serif;
    min-width:0;
    font-size: 16px;
    font-weight: 600;
    color: #1F2937;
  }
  .check-text::placeholder { color: #8da2bd; }
  .check-text--done { text-decoration: line-through; color: #94A3B8; }

  .check-delete {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .check-delete:hover { background: rgba(239, 124, 151, 0.08); color: #D2566F; }

  .add-item-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 13px 16px;
    border: 1.5px dashed #CBD5E1;
    border-radius: 14px;
    background: transparent;
    color: #2563eb;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .add-item-btn:hover { border-color: #2196F3; color: #1976D2; background: #F8FAFC; }
  .add-item-plus { font-size: 20px; line-height: 1; }

  .all-done-banner {
    text-align: center;
    padding: 14px;
    background: rgba(79, 191, 163, 0.08);
    border: 1px solid rgba(79, 191, 163, 0.3);
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    color: #2F9A80;
    margin-top: 6px;
  }
  @media (max-width:360px) {
    .topbar { padding-inline:14px; }
    .topbar-title { font-size:13px; }
    .title-area { margin-inline:12px; padding-inline:16px; }
    .tab-bar { margin-inline:12px; padding-inline:16px; }
    .content-area { margin-inline:12px; padding-inline:16px; }
    .check-item { gap:8px; padding-inline:10px; }
  }
</style>

<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ICONS } from '$lib/icons';

  let id = $derived(page.params.id);
  let folderId = $derived(page.url.searchParams.get('folder_id'));

  let title = $state('');
  let content = $state('');
  let checklist = $state<any[]>([]);
  let activeTab = $state<'text' | 'checklist'>('text');
  let loading = $state(false);
  let saved = $state(false);

  onMount(async () => {
    if (!auth.token) return goto('/login');
    if (id !== 'new') await fetchNote();
  });

  async function fetchNote() {
    loading = true;
    try {
      const res = await fetch(`${API_URL}/notes/${id}`, { headers: { 'Authorization': `Bearer ${auth.token}` } });
      const data = await res.json();
      if (res.ok && data.note) {
        title = data.note.title || '';
        content = data.note.content || '';
        try { checklist = data.note.checklist ? JSON.parse(data.note.checklist) : []; }
        catch(e) { checklist = []; }
        if (checklist.length > 0) activeTab = 'checklist';
      }
    } catch(e) {} finally { loading = false; }
  }

  async function saveNote() {
    loading = true;
    const body = { folder_id: folderId, title, content, checklist: checklist.length > 0 ? checklist : null };
    try {
      const url = id === 'new' ? `${API_URL}/notes` : `${API_URL}/notes/${id}`;
      const method = id === 'new' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) { saved = true; setTimeout(() => goto('/notes'), 600); }
    } catch(e) {} finally { loading = false; }
  }

  async function deleteNote() {
    if (!confirm('Hapus catatan ini?')) return;
    try {
      await fetch(`${API_URL}/notes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${auth.token}` } });
      goto('/notes');
    } catch(e) {}
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
    <button class="back-btn" onclick={() => goto('/notes')}>
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
      </svg>
    </button>

    <div class="topbar-actions">
      {#if id !== 'new'}
        <button class="delete-btn" onclick={deleteNote}>Hapus</button>
      {/if}
      <button class="save-btn {saved ? 'save-btn--saved' : ''}" onclick={saveNote} disabled={loading}>
        {#if saved}✓ Tersimpan{:else if loading}...{:else}Simpan{/if}
      </button>
    </div>
  </div>

  <!-- Title Area -->
  <div class="title-area">
    <input
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
        <span class="meta-pill">Diedit</span>
      {/if}
    </div>
  </div>

  <!-- Tab Switcher -->
  <div class="tab-bar">
    <button
      class="tab-pill {activeTab === 'text' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'text'}
    >
      ✏️ Teks
    </button>
    <button
      class="tab-pill {activeTab === 'checklist' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'checklist'}
    >
      ✅ Checklist
      {#if checklist.length > 0}
        <span class="tab-badge">{doneCount}/{checklist.length}</span>
      {/if}
    </button>

    <!-- Checklist progress mini bar -->
    {#if activeTab === 'checklist' && checklist.length > 0}
      <div class="tab-progress">
        <div class="tab-progress-fill" style="width:{checklistPct}%"></div>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="content-area">
    {#if activeTab === 'text'}
      <textarea
        bind:value={content}
        placeholder="Tulis sesuatu di sini..."
        class="text-area"
      ></textarea>

    {:else}
      <div class="checklist-wrap">
        <!-- Items -->
        {#each checklist as item, idx}
          <div class="check-item {item.is_done ? 'check-item--done' : ''}">
            <button
              class="check-bubble {item.is_done ? 'check-bubble--done' : ''}"
              onclick={() => toggleCheckItem(idx)}
            >
              {#if item.is_done}
                <svg width="12" height="12" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                </svg>
              {/if}
            </button>
            <input
              bind:value={item.text}
              placeholder="Tulis item..."
              class="check-text {item.is_done ? 'check-text--done' : ''}"
            />
            <button
              class="check-delete"
              onclick={() => checklist = checklist.filter((_, i) => i !== idx)}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        {/each}

        <!-- Add item -->
        <button class="add-item-btn" onclick={addCheckItem}>
          <span class="add-item-plus">+</span>
          Tambah Item
        </button>

        <!-- All done state -->
        {#if checklist.length > 0 && doneCount === checklist.length}
          <div class="all-done-banner">🎉 Semua item selesai!</div>
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
    background: white;
    display: flex;
    flex-direction: column;
  }

  /* Topbar */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1.5px solid #F3F1FF;
    flex-shrink: 0;
  }
  .back-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: #F7F5FF;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7B6EF6;
    cursor: pointer;
    transition: background 0.15s;
  }
  .back-btn:hover { background: #EAE6FF; }
  .topbar-actions { display: flex; align-items: center; gap: 8px; }
  .delete-btn {
    padding: 8px 14px;
    border-radius: 12px;
    border: none;
    background: #FFF5F5;
    color: #E06070;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s;
  }
  .delete-btn:hover { background: #fde8e8; }
  .save-btn {
    padding: 8px 20px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #7B6EF6, #9D8FF5);
    color: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(123,110,246,0.3);
    transition: all 0.2s;
  }
  .save-btn:disabled { opacity: 0.6; }
  .save-btn--saved { background: linear-gradient(135deg, #22c55e, #5ba882); box-shadow: 0 4px 14px rgba(91,168,130,0.3); }

  /* Title */
  .title-area { padding: 20px 22px 10px; }
  .title-input {
    width: 100%;
    border: none;
    outline: none;
    font-family: 'Nunito', sans-serif;
    font-size: 24px;
    font-weight: 900;
    color: #2D2A5E;
    background: transparent;
    margin-bottom: 10px;
  }
  .title-input::placeholder { color: #D8D4F0; }
  .title-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .meta-pill {
    font-size: 11px;
    font-weight: 800;
    color: #B8A9F5;
    background: #F3F1FF;
    padding: 3px 10px;
    border-radius: 99px;
  }
  .meta-pill--progress { color: #5ba882; background: #F0FDF4; }

  /* Tab bar */
  .tab-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 22px 14px;
    flex-wrap: wrap;
  }
  .tab-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border-radius: 99px;
    border: 2px solid #EAE6FF;
    background: #F7F5FF;
    color: #aab4cc;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-pill--active { background: #7B6EF6; border-color: #7B6EF6; color: white; }
  .tab-badge {
    background: rgba(255,255,255,0.25);
    padding: 1px 7px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 900;
  }
  .tab-progress {
    flex: 1;
    height: 6px;
    background: #F3F1FF;
    border-radius: 99px;
    overflow: hidden;
    min-width: 40px;
  }
  .tab-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7B6EF6, #B8A9F5);
    border-radius: 99px;
    transition: width 0.4s ease;
  }

  /* Content area */
  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 0 22px 32px;
  }

  /* Text area */
  .text-area {
    width: 100%;
    min-height: 360px;
    border: none;
    outline: none;
    resize: none;
    font-family: 'Nunito', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #4A4570;
    line-height: 1.8;
    background: transparent;
  }
  .text-area::placeholder { color: #D8D4F0; }

  /* Checklist */
  .checklist-wrap { display: flex; flex-direction: column; gap: 8px; }

  .check-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #F7F5FF;
    border-radius: 16px;
    border: 2px solid transparent;
    transition: all 0.15s;
  }
  .check-item--done {
    background: #F0FDF4;
    border-color: transparent;
  }
  .check-item:focus-within { border-color: #B8A9F5; }

  .check-bubble {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2.5px solid #B8A9F5;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.15s;
  }
  .check-bubble--done { background: #7B6EF6; border-color: #7B6EF6; }

  .check-text {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #2D2A5E;
  }
  .check-text::placeholder { color: #D8D4F0; }
  .check-text--done { text-decoration: line-through; color: #aab4cc; }

  .check-delete {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #D8D4F0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .check-delete:hover { background: #fde8e8; color: #E06070; }

  .add-item-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 13px 16px;
    border: 2px dashed #D8D4F0;
    border-radius: 16px;
    background: transparent;
    color: #B8A9F5;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .add-item-btn:hover { border-color: #7B6EF6; color: #7B6EF6; background: #F7F5FF; }
  .add-item-plus { font-size: 20px; line-height: 1; }

  .all-done-banner {
    text-align: center;
    padding: 14px;
    background: #F0FDF4;
    border: 2px solid #86efac;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 900;
    color: #15803d;
    margin-top: 6px;
  }
</style>
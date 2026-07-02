<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let folderId = $derived(page.url.searchParams.get('folder_id'));
  let id = 'new';

  let title = $state('');
  let content = $state('');
  let checklist = $state<any[]>([]);
  let activeTab = $state<'text' | 'checklist'>('text');
  let loading = $state(false);
  let saved = $state(false);

  onMount(async () => {
    if (!auth.token) return goto('/login');
  });

  async function saveNote() {
    if (!folderId) {
      alert('Folder ID is required');
      return;
    }
    loading = true;
    const body = { folder_id: folderId, title, content, checklist: checklist.length > 0 ? checklist : null };
    try {
      const res = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        saved = true;
        setTimeout(() => goto(`/notes/${data.id}`), 300);
      }
    } catch(e) {} finally { loading = false; }
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
      <Icon name="arrow" size={20} style="transform: rotate(180deg)" />
    </button>

    <div class="topbar-actions">
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
    </div>
  </div>

  <!-- Tab Switcher -->
  <div class="tab-bar">
    <button
      class="tab-pill {activeTab === 'text' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'text'}
    >
      <Icon name="edit" size={14} /> Teks
    </button>
    <button
      class="tab-pill {activeTab === 'checklist' ? 'tab-pill--active' : ''}"
      onclick={() => activeTab = 'checklist'}
    >
      <Icon name="check" size={14} /> Checklist
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
                <Icon name="check" size={12} color="white" strokeWidth={3} />
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
              <Icon name="empty" size={14} />
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
    border-bottom: 1.5px solid #F0F5FF;
    flex-shrink: 0;
  }
  .back-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: #F5F8FE;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F7FE0;
    cursor: pointer;
    transition: background 0.15s;
  }
  .back-btn:hover { background: #E6EFFF; }
  .topbar-actions { display: flex; align-items: center; gap: 8px; }
  .save-btn {
    padding: 8px 20px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #4F7FE0, #6B93E8);
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
    color: #8DB2F0;
    background: #F0F5FF;
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
    border: 2px solid #E6EFFF;
    background: #F5F8FE;
    color: #aab4cc;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-pill--active { background: #4F7FE0; border-color: #4F7FE0; color: white; }
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
    background: #F0F5FF;
    border-radius: 99px;
    overflow: hidden;
    min-width: 40px;
  }
  .tab-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4F7FE0, #8DB2F0);
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
    background: #F5F8FE;
    border-radius: 16px;
    border: 2px solid transparent;
    transition: all 0.15s;
  }
  .check-item--done {
    background: #F0FDF4;
    border-color: transparent;
  }
  .check-item:focus-within { border-color: #8DB2F0; }

  .check-bubble {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2.5px solid #8DB2F0;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.15s;
  }
  .check-bubble--done { background: #4F7FE0; border-color: #4F7FE0; }

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
    color: #8DB2F0;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .add-item-btn:hover { border-color: #4F7FE0; color: #4F7FE0; background: #F5F8FE; }
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

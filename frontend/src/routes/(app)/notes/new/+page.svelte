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
    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
    flex-shrink: 0;
  }
  .back-btn {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: rgba(91, 141, 239, 0.1);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4772E8;
    cursor: pointer;
    transition: background 0.15s;
  }
  .back-btn:hover { background: rgba(91, 141, 239, 0.18); }
  .topbar-actions { display: flex; align-items: center; gap: 8px; }
  .save-btn {
    padding: 8px 20px;
    border-radius: 12px;
    border: none;
    background: #5B8DEF;
    color: white;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .save-btn:disabled { opacity: 0.6; }
  .save-btn--saved { background: #0B9E6B; }

  /* Title */
  .title-area { padding: 20px 22px 10px; }
  .title-input {
    width: 100%;
    border: none;
    outline: none;
    font-family: 'Nunito', sans-serif;
    font-size: 24px;
    font-weight: 800;
    color: #1F2937;
    background: transparent;
    margin-bottom: 10px;
  }
  .title-input::placeholder { color: #CBD5E1; }
  .title-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .meta-pill {
    font-size: 11px;
    font-weight: 600;
    color: #4772E8;
    background: rgba(91, 141, 239, 0.1);
    padding: 3px 10px;
    border-radius: 99px;
  }
  .meta-pill--progress { color: #059669; background: rgba(16, 185, 129, 0.1); }

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
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: #ffffff;
    color: #64748B;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tab-pill--active { background: #ffffff; border-color: rgba(91, 141, 239, 0.4); color: #4772E8; box-shadow: 0 1px 3px rgba(91, 141, 239,0.18); }
  .tab-badge {
    background: rgba(91, 141, 239, 0.12);
    color: #4772E8;
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
    background: linear-gradient(90deg, #10B981, #34D399);
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
    font-weight: 500;
    color: #374151;
    line-height: 1.8;
    background: transparent;
  }
  .text-area::placeholder { color: #CBD5E1; }

  /* Checklist */
  .checklist-wrap { display: flex; flex-direction: column; gap: 8px; }

  .check-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #F8FAFC;
    border-radius: 14px;
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  .check-item--done {
    background: rgba(16, 185, 129, 0.06);
    border-color: transparent;
  }
  .check-item:focus-within { border-color: rgba(91, 141, 239, 0.4); }

  .check-bubble {
    width: 26px;
    height: 26px;
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
  .check-bubble--done { background: #10B981; border-color: #10B981; }

  .check-text {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #1F2937;
  }
  .check-text::placeholder { color: #CBD5E1; }
  .check-text--done { text-decoration: line-through; color: #94A3B8; }

  .check-delete {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #CBD5E1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .check-delete:hover { background: rgba(239, 68, 68, 0.08); color: #DC2626; }

  .add-item-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 13px 16px;
    border: 1.5px dashed #CBD5E1;
    border-radius: 14px;
    background: transparent;
    color: #64748B;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .add-item-btn:hover { border-color: #5B8DEF; color: #4772E8; background: #F8FAFC; }
  .add-item-plus { font-size: 20px; line-height: 1; }

  .all-done-banner {
    text-align: center;
    padding: 14px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 14px;
    font-size: 14px;
    font-weight: 700;
    color: #059669;
    margin-top: 6px;
  }
</style>

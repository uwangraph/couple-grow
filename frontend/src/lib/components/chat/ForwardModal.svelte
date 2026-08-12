<script lang="ts">
  // Teruskan satu pesan ke chat global / chat tabungan lain.
  let {
    open = $bindable(false),
    rooms = [],
    source = null,
    busy = false,
    onSubmit,
  }: {
    open: boolean;
    rooms: { id: number | null; saving_id: string | number | null; name: string }[];
    source: any | null;
    busy?: boolean;
    onSubmit: (targets: any[]) => void;
  } = $props();

  let query = $state('');
  let selected = $state<string[]>([]);

  // Reset pilihan tiap kali modal dibuka untuk pesan baru.
  $effect(() => {
    if (open) {
      query = '';
      selected = [];
    }
  });

  function keyOf(room: any) {
    return String(room.saving_id ?? 'global');
  }

  let filtered = $derived(
    query.trim()
      ? rooms.filter(r => r.name.toLowerCase().includes(query.trim().toLowerCase()))
      : rooms
  );

  function toggle(room: any) {
    const key = keyOf(room);
    selected = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key];
  }

  function submit() {
    const targets = rooms.filter(r => selected.includes(keyOf(r)));
    if (targets.length > 0) onSubmit(targets);
  }

  function previewText(msg: any): string {
    if (!msg) return '';
    if (msg.type === 'image') return '📷 Foto';
    if (msg.type === 'audio') return '🎤 Voice note';
    if (msg.type === 'file') return '📎 Dokumen';
    return msg.message || '';
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fw-overlay" onclick={() => (open = false)}></div>
  <div class="fw-modal" role="dialog" aria-modal="true" aria-label="Teruskan pesan">
    <div class="fw-head">
      <div>
        <p class="fw-label">Teruskan ke</p>
        <p class="fw-preview">{previewText(source)}</p>
      </div>
      <button type="button" class="fw-close" onclick={() => (open = false)} aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <input class="fw-search" bind:value={query} placeholder="Cari chat..." aria-label="Cari chat" />

    <div class="fw-list">
      {#if filtered.length === 0}
        <p class="fw-empty">Tidak ada chat lain untuk tujuan.</p>
      {/if}
      {#each filtered as room (keyOf(room))}
        <button type="button" class="fw-item {selected.includes(keyOf(room)) ? 'fw-item--active' : ''}" onclick={() => toggle(room)}>
          <span class="fw-item__icon">{room.saving_id ? '🎯' : '💬'}</span>
          <span class="fw-item__name">{room.name}</span>
          <span class="fw-check {selected.includes(keyOf(room)) ? 'fw-check--on' : ''}">
            {#if selected.includes(keyOf(room))}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>
            {/if}
          </span>
        </button>
      {/each}
    </div>

    <button type="button" class="fw-submit" disabled={selected.length === 0 || busy} onclick={submit}>
      {busy ? 'Meneruskan...' : `Teruskan${selected.length > 0 ? ` (${selected.length})` : ''}`}
    </button>
  </div>
{/if}

<style>
  .fw-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 1100;
  }
  .fw-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(400px, calc(100vw - 32px));
    background: #fff;
    border-radius: 22px;
    padding: 18px;
    z-index: 1110;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
    font-family: 'Nunito', sans-serif;
  }
  .fw-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .fw-label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94A3B8;
    margin: 0;
  }
  .fw-preview {
    margin: 3px 0 0;
    font-size: 14px;
    font-weight: 800;
    color: #1E293B;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
  }
  .fw-close {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: none;
    background: #F1F5F9;
    color: #64748B;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .fw-search {
    width: 100%;
    border: 1px solid #E2E8F0;
    background: #F8FAFC;
    border-radius: 14px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    color: #1E293B;
    outline: none;
  }
  .fw-search:focus { border-color: #93B4F5; background: #fff; }
  .fw-list {
    margin: 12px 0;
    max-height: 260px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .fw-empty {
    font-size: 13px;
    color: #94A3B8;
    text-align: center;
    padding: 18px 0;
    margin: 0;
  }
  .fw-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid #E2E8F0;
    background: #fff;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .fw-item--active { border-color: #5B8DEF; background: rgba(91, 141, 239, 0.08); }
  .fw-item__icon { font-size: 18px; }
  .fw-item__name {
    flex: 1;
    font-size: 13px;
    font-weight: 800;
    color: #1E293B;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fw-check {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 1.5px solid #CBD5E1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
  }
  .fw-check--on { background: #5B8DEF; border-color: #5B8DEF; }
  .fw-submit {
    width: 100%;
    padding: 12px;
    border-radius: 14px;
    border: none;
    background: #5B8DEF;
    color: #fff;
    font-size: 14px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
  }
  .fw-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

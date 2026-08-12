<script lang="ts">
  // Panel info room: media, dokumen, pesan berbintang, dan aksi room.
  let {
    open = $bindable(false),
    title,
    subtitle,
    isSaving = false,
    media = [],
    files = [],
    starred = [],
    onOpenMedia,
    onJump,
    onUnstarAll,
    onClearChat,
  }: {
    open: boolean;
    title: string;
    subtitle: string;
    isSaving?: boolean;
    media: any[];
    files: any[];
    starred: any[];
    onOpenMedia: (msg: any) => void;
    onJump: (id: number | string) => void;
    onUnstarAll: () => void;
    onClearChat: (includeStarred: boolean) => void;
  } = $props();

  let confirmingClear = $state(false);
  let includeStarred = $state(false);

  $effect(() => {
    if (!open) {
      confirmingClear = false;
      includeStarred = false;
    }
  });

  function preview(msg: any): string {
    if (msg.type === 'image') return '📷 Foto';
    if (msg.type === 'audio') return '🎤 Voice note';
    if (msg.type === 'file') return '📎 Dokumen';
    return msg.message || '';
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ri-overlay" onclick={() => (open = false)}></div>
  <aside class="ri-panel" aria-label="Info chat">
    <div class="ri-head">
      <div class="ri-avatar">{isSaving ? '🎯' : '💬'}</div>
      <div class="ri-head__text">
        <h2 class="ri-title">{title}</h2>
        <p class="ri-subtitle">{subtitle}</p>
      </div>
      <button type="button" class="ri-close" onclick={() => (open = false)} aria-label="Tutup info">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="ri-stats">
      <div class="ri-stat"><strong>{media.length}</strong><span>Foto</span></div>
      <div class="ri-stat"><strong>{files.length}</strong><span>File</span></div>
      <div class="ri-stat"><strong>{starred.length}</strong><span>Berbintang</span></div>
    </div>
    <p class="ri-note">Dihitung dari pesan yang sudah dimuat di layar.</p>

    {#if media.length > 0}
      <section class="ri-section">
        <h3 class="ri-section__title">Media</h3>
        <div class="ri-media-grid">
          {#each media.slice(-12).reverse() as msg (msg.id)}
            <button type="button" class="ri-media" onclick={() => onOpenMedia(msg)} aria-label="Buka media">
              <img src={msg.file_url} alt="Media" />
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if starred.length > 0}
      <section class="ri-section">
        <div class="ri-section__head">
          <h3 class="ri-section__title">Pesan berbintang</h3>
          <button type="button" class="ri-link" onclick={onUnstarAll}>Lepas semua</button>
        </div>
        <div class="ri-list">
          {#each starred.slice(-8).reverse() as msg (msg.id)}
            <button type="button" class="ri-item" onclick={() => onJump(msg.id)}>
              <span class="ri-item__star">⭐</span>
              <span class="ri-item__text">{preview(msg)}</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <section class="ri-section">
      <h3 class="ri-section__title">Aksi</h3>
      {#if !confirmingClear}
        <button type="button" class="ri-danger" onclick={() => (confirmingClear = true)}>Bersihkan chat</button>
      {:else}
        <div class="ri-confirm">
          <p class="ri-confirm__text">Chat hanya dibersihkan untuk kamu. Pasangan tetap punya riwayatnya.</p>
          <label class="ri-checkbox">
            <input type="checkbox" bind:checked={includeStarred} />
            Ikut hapus pesan berbintang
          </label>
          <div class="ri-confirm__actions">
            <button type="button" class="ri-ghost" onclick={() => (confirmingClear = false)}>Batal</button>
            <button type="button" class="ri-danger" onclick={() => onClearChat(includeStarred)}>Bersihkan</button>
          </div>
        </div>
      {/if}
    </section>
  </aside>
{/if}

<style>
  .ri-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 1100;
  }
  .ri-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 88vw);
    background: #fff;
    z-index: 1110;
    padding: 18px;
    overflow-y: auto;
    box-shadow: -16px 0 40px rgba(15, 23, 42, 0.15);
    font-family: 'Nunito', sans-serif;
  }
  .ri-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
  }
  .ri-avatar {
    width: 46px;
    height: 46px;
    border-radius: 15px;
    background: rgba(91, 141, 239, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .ri-head__text { flex: 1; min-width: 0; }
  .ri-title {
    margin: 0;
    font-size: 16px;
    font-weight: 900;
    color: #1E293B;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ri-subtitle { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: #94A3B8; }
  .ri-close {
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
  .ri-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .ri-stat {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
    border-radius: 14px;
    padding: 10px 6px;
    text-align: center;
  }
  .ri-stat strong { display: block; font-size: 17px; font-weight: 900; color: #1E293B; }
  .ri-stat span { font-size: 11px; font-weight: 700; color: #94A3B8; }
  .ri-note { margin: 8px 0 0; font-size: 11px; color: #94A3B8; }
  .ri-section { margin-top: 20px; }
  .ri-section__head { display: flex; align-items: center; justify-content: space-between; }
  .ri-section__title {
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #94A3B8;
  }
  .ri-link {
    border: none;
    background: none;
    color: #4772E8;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    font-family: inherit;
    padding: 0 0 10px;
  }
  .ri-media-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .ri-media {
    aspect-ratio: 1;
    border: none;
    padding: 0;
    border-radius: 12px;
    overflow: hidden;
    background: #F1F5F9;
    cursor: pointer;
  }
  .ri-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ri-list { display: flex; flex-direction: column; gap: 6px; }
  .ri-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 12px;
    border: 1px solid #E2E8F0;
    background: #fff;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .ri-item__star { font-size: 13px; }
  .ri-item__text {
    flex: 1;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ri-danger {
    width: 100%;
    padding: 11px;
    border-radius: 13px;
    border: 1px solid #FECACA;
    background: #FEF2F2;
    color: #DC2626;
    font-size: 13px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
  }
  .ri-ghost {
    width: 100%;
    padding: 11px;
    border-radius: 13px;
    border: 1px solid #E2E8F0;
    background: #fff;
    color: #64748B;
    font-size: 13px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
  }
  .ri-confirm {
    border: 1px solid #E2E8F0;
    border-radius: 15px;
    padding: 12px;
  }
  .ri-confirm__text { margin: 0 0 10px; font-size: 12px; color: #64748B; line-height: 1.5; }
  .ri-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 12px;
    cursor: pointer;
  }
  .ri-confirm__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
</style>

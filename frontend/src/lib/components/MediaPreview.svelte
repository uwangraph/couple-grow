<script lang="ts">
  // MediaPreview — pratinjau media chat (gambar/file/video/audio/dokumen)
  // Disesuaikan dari MediaPreviewModal khwarizmi dengan palette logo CoupleGrow
  import Icon from '$lib/Icon.svelte';

  export type MediaPreviewItem = {
    type: 'image' | 'file' | 'audio'
    url: string
    name?: string
    caption?: string | null
  };

  let { media, onClose }: { media: MediaPreviewItem | null, onClose: () => void } = $props();

  let fileName = $derived(media?.name || 'File');
  let fileSize = $derived('');
  let isImage = $derived(media?.type === 'image' || (media?.type === 'file' && /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(media.url)));
  let isVideo = $derived(media?.type === 'file' && /\.(mp4|webm|ogg|mov|m4v)$/i.test(media.url));
  let isAudio = $derived(media?.type === 'audio' || (media?.type === 'file' && /\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i.test(media.url)));
  let isPdf = $derived(media?.type === 'file' && /\.pdf$/i.test(media.url));
  let isOffice = $derived(media?.type === 'file' && /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(media.url));
  let isPlainText = $derived(media?.type === 'file' && /\.(txt|csv|md|json|xml|js|ts|svelte|html?|css|py|sql|log|yaml|yml|ini)$/i.test(media.url));

  let viewerUrl = $derived.by(() => {
    if (!media) return '';
    if (isOffice) return `https://docs.google.com/viewer?url=${encodeURIComponent(media.url)}&embedded=true`;
    return media.url;
  });

  async function download() {
    if (!media) return;
    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(media.url, '_blank');
    }
  }
</script>

{#if media}
  <div
    class="media-overlay"
    onclick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label="Pratinjau media"
  >
    <div class="media-card" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="media-header">
        <div class="media-header__info">
          <p class="media-header__label">{isImage ? 'Foto' : isAudio ? 'Audio' : 'File'}</p>
          <h2 class="media-header__title">{fileName}</h2>
        </div>
        <button type="button" class="media-close" onclick={onClose} aria-label="Tutup">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Body -->
      <div class="media-body">
        {#if isImage}
          <img src={media.url} alt={fileName} class="media-img" />
        {:else if isVideo}
          <video src={media.url} controls class="media-img" />
        {:else if isAudio}
          <div class="media-audio">
            <div class="media-audio__icon">
              <Icon name="chat" size={30} />
            </div>
            <p class="media-audio__name">{fileName}</p>
            <audio src={media.url} controls class="media-audio__player"></audio>
          </div>
        {:else if isPdf}
          <iframe src={media.url} title={fileName} class="media-iframe"></iframe>
        {:else if isOffice || isPlainText}
          <iframe src={viewerUrl} title={fileName} class="media-iframe"></iframe>
        {:else}
          <div class="media-fallback">
            <div class="media-fallback__icon"><Icon name="notes" size={30} /></div>
            <p class="media-fallback__name">{fileName}</p>
            <p class="media-fallback__hint">Klik Unduh untuk mengambil file ini</p>
          </div>
        {/if}

        {#if media.caption}
          <div class="media-caption">
            <p class="media-caption__label">Keterangan</p>
            <p class="media-caption__text">{media.caption}</p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="media-footer">
        <button type="button" class="media-btn media-btn--ghost" onclick={() => window.open(media.url, '_blank')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Buka
        </button>
        <button type="button" class="media-btn media-btn--primary" onclick={download}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Unduh
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .media-overlay {
    position: fixed;
    inset: 0;
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .media-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 480px;
    max-height: 88vh;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.75);
    background: rgba(255,255,255,0.92);
    box-shadow: 0 20px 50px -12px rgba(13,71,161,0.3);
    overflow: hidden;
  }
  .media-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(226,232,240,0.8);
  }
  .media-header__info { min-width: 0; }
  .media-header__label {
    margin: 0;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .media-header__title {
    margin: 2px 0 0;
    font-size: 16px;
    font-weight: 800;
    color: #1F2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .media-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 12px;
    border: 1px solid rgba(226,232,240,0.9);
    background: #fff;
    color: #64748B;
    box-shadow: 0 2px 0 0 #E2E8F0;
    transition: all .15s ease;
  }
  .media-close:hover { transform: translateY(1px); box-shadow: 0 1px 0 0 #E2E8F0; }
  .media-close:active { transform: translateY(1px); box-shadow: none; }
  .media-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: rgba(248,250,252,0.6);
  }
  .media-img {
    display: block;
    width: 100%;
    max-height: 55vh;
    object-fit: contain;
    border-radius: 12px;
    background: #fff;
    border: 1px solid rgba(226,232,240,0.8);
    box-shadow: 0 8px 24px -8px rgba(13,71,161,0.15);
  }
  .media-iframe {
    width: 100%;
    height: 55vh;
    border-radius: 12px;
    border: 1px solid rgba(226,232,240,0.8);
    background: #fff;
  }
  .media-audio {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 24px;
    border-radius: 12px;
    border: 1px solid rgba(226,232,240,0.8);
    background: #fff;
  }
  .media-audio__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(33,150,243,0.14), rgba(79,195,247,0.14));
    color: #2196F3;
    margin-bottom: 14px;
  }
  .media-audio__name {
    margin: 0 0 14px;
    font-size: 14px;
    font-weight: 800;
    color: #334155;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .media-audio__player { width: 100%; max-width: 320px; }
  .media-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    text-align: center;
    border-radius: 12px;
    border: 1px dashed rgba(148,163,184,0.6);
    background: #fff;
  }
  .media-fallback__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(33,150,243,0.14), rgba(79,195,247,0.14));
    color: #2196F3;
    margin-bottom: 12px;
  }
  .media-fallback__name { margin: 0; font-size: 14px; font-weight: 800; color: #334155; }
  .media-fallback__hint { margin: 4px 0 0; font-size: 11px; font-weight: 700; color: #94A3B8; }
  .media-caption {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(251,191,36,0.4);
    background: rgba(253,230,138,0.2);
  }
  .media-caption__label {
    margin: 0;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #D97706;
  }
  .media-caption__text { margin: 2px 0 0; font-size: 13px; color: #1F2937; }
  .media-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-top: 1px solid rgba(226,232,240,0.8);
    background: rgba(255,255,255,0.9);
  }
  .media-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    transition: all .15s ease;
  }
  .media-btn--ghost {
    flex: 1;
    background: #fff;
    color: #475569;
    border: 1px solid rgba(226,232,240,0.9);
    box-shadow: 0 2px 0 0 #E2E8F0;
  }
  .media-btn--ghost:hover { transform: translateY(1px); box-shadow: 0 1px 0 0 #E2E8F0; }
  .media-btn--ghost:active { transform: translateY(1px); box-shadow: none; }
  .media-btn--primary {
    flex: 1.5;
    color: #fff;
    border: 1px solid rgba(25,118,210,0.9);
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }
  .media-btn--primary:hover { transform: translateY(1px); box-shadow: 0 2px 0 0 rgba(25,118,210,0.9); }
  .media-btn--primary:active { transform: translateY(2px); box-shadow: none; }
</style>

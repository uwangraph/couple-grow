<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import TextAlign from '@tiptap/extension-text-align';
  import TextStyle from '@tiptap/extension-text-style';
  import Color from '@tiptap/extension-color';
  import Underline from '@tiptap/extension-underline';
  import Highlight from '@tiptap/extension-highlight';
  import Table from '@tiptap/extension-table';
  import TableRow from '@tiptap/extension-table-row';
  import TableCell from '@tiptap/extension-table-cell';
  import TableHeader from '@tiptap/extension-table-header';

  let { content = $bindable(''), placeholder = 'Tulis sesuatu di sini...' }: {
    content: string;
    placeholder?: string;
  } = $props();

  let editorEl: HTMLElement;
  let editor: Editor;

  // Track active states reactively
  let activeStates = $state({
    bold: false, italic: false, underline: false, strike: false,
    h1: false, h2: false, h3: false,
    bulletList: false, orderedList: false,
    alignLeft: false, alignCenter: false, alignRight: false,
    highlight: false, inTable: false,
  });

  const TEXT_COLORS = [
    { label: 'Default', value: '' },
    { label: 'Merah', value: '#EF7C97' },
    { label: 'Oranye', value: '#F97316' },
    { label: 'Kuning', value: '#EAB308' },
    { label: 'Hijau', value: '#5CC8AC' },
    { label: 'Biru', value: '#3B82F6' },
    { label: 'Ungu', value: '#A855F7' },
    { label: 'Pink', value: '#EC4899' },
    { label: 'Abu', value: '#64748B' },
  ];

  let showColorPicker = $state(false);
  let showTableMenu = $state(false);
  let tableHoverRow = $state(0);
  let tableHoverCol = $state(0);

  const TABLE_ROWS = 6;
  const TABLE_COLS = 6;

  function insertTable(rows: number, cols: number) {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    showTableMenu = false;
    syncActiveStates();
  }

  function syncActiveStates() {
    if (!editor) return;
    activeStates = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      alignLeft: editor.isActive({ textAlign: 'left' }),
      alignCenter: editor.isActive({ textAlign: 'center' }),
      alignRight: editor.isActive({ textAlign: 'right' }),
      highlight: editor.isActive('highlight'),
      inTable: editor.isActive('table'),
    };
  }

  onMount(() => {
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        TextStyle,
        Color,
        Underline,
        Highlight.configure({ multicolor: false }),
        Table.configure({ resizable: false }),
        TableRow,
        TableCell,
        TableHeader,
      ],
      content: content || '',
      editorProps: {
        attributes: {
          class: 'rich-editor-content',
          'data-placeholder': placeholder,
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        content = html === '<p></p>' ? '' : html;
        syncActiveStates();
      },
      onSelectionUpdate: syncActiveStates,
    });
    syncActiveStates();
  });

  // Sync content from parent → editor (when loading existing note)
  $effect(() => {
    if (editor && content !== undefined) {
      const current = editor.getHTML();
      const normalized = content === '' ? '<p></p>' : content;
      if (current !== content && current !== normalized) {
        editor.commands.setContent(content || '', false);
      }
    }
  });

  onDestroy(() => { editor?.destroy(); });

  function cmd(fn: () => void) {
    fn();
    syncActiveStates();
    editor.view.focus();
  }

  function setColor(color: string) {
    if (!color) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
    }
    showColorPicker = false;
    syncActiveStates();
  }
</script>

<div class="rich-editor-wrap">
  <!-- Toolbar -->
  <div class="toolbar">

    <!-- Undo / Redo -->
    <div class="toolbar-group">
      <button class="tb" onclick={() => cmd(() => editor.chain().focus().undo().run())} title="Undo (Ctrl+Z)" aria-label="Undo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
      </button>
      <button class="tb" onclick={() => cmd(() => editor.chain().focus().redo().run())} title="Redo (Ctrl+Y)" aria-label="Redo">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>
      </button>
    </div>

    <div class="tb-divider"></div>

    <!-- Heading -->
    <div class="toolbar-group">
      <button class="tb {activeStates.h1 ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} title="Judul 1" aria-label="Heading 1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
      </button>
      <button class="tb {activeStates.h2 ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} title="Judul 2" aria-label="Heading 2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
        <sup style="font-size:9px;font-weight:900;line-height:1">2</sup>
      </button>
      <button class="tb {activeStates.h3 ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} title="Judul 3" aria-label="Heading 3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>
        <sup style="font-size:9px;font-weight:900;line-height:1">3</sup>
      </button>
    </div>

    <div class="tb-divider"></div>

    <!-- Format -->
    <div class="toolbar-group">
      <button class="tb {activeStates.bold ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleBold().run())} title="Bold (Ctrl+B)" aria-label="Bold">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h8a4 4 0 0 0 0-8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>
      </button>
      <button class="tb {activeStates.italic ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleItalic().run())} title="Italic (Ctrl+I)" aria-label="Italic">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
      </button>
      <button class="tb {activeStates.underline ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleUnderline().run())} title="Underline (Ctrl+U)" aria-label="Underline">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
      </button>
      <button class="tb {activeStates.strike ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleStrike().run())} title="Strikethrough" aria-label="Strikethrough">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
      </button>
      <button class="tb {activeStates.highlight ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleHighlight().run())} title="Highlight" aria-label="Highlight">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
      </button>
    </div>

    <div class="tb-divider"></div>

    <!-- Lists -->
    <div class="toolbar-group">
      <button class="tb {activeStates.bulletList ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleBulletList().run())} title="Bullet List" aria-label="Bullet list">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
      </button>
      <button class="tb {activeStates.orderedList ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().toggleOrderedList().run())} title="Numbered List" aria-label="Ordered list">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
      </button>
      <button class="tb" onclick={() => cmd(() => editor.chain().focus().toggleBlockquote().run())} title="Quote" aria-label="Blockquote">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
      </button>
      <button class="tb" onclick={() => cmd(() => editor.chain().focus().setHorizontalRule().run())} title="Garis Pemisah" aria-label="Horizontal rule">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
      </button>
    </div>

    <div class="tb-divider"></div>

    <!-- Alignment -->
    <div class="toolbar-group">
      <button class="tb {activeStates.alignLeft ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().setTextAlign('left').run())} title="Rata Kiri" aria-label="Align left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
      </button>
      <button class="tb {activeStates.alignCenter ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().setTextAlign('center').run())} title="Rata Tengah" aria-label="Align center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      </button>
      <button class="tb {activeStates.alignRight ? 'tb--active' : ''}" onclick={() => cmd(() => editor.chain().focus().setTextAlign('right').run())} title="Rata Kanan" aria-label="Align right">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
      </button>
    </div>

    <div class="tb-divider"></div>

    <!-- Color picker -->
    <div class="toolbar-group" style="position:relative;">
      <button class="tb tb-color" onclick={() => showColorPicker = !showColorPicker} title="Warna Teks" aria-label="Text color">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>
      </button>
      {#if showColorPicker}
        <div class="color-picker" role="menu">
          {#each TEXT_COLORS as c}
            <button
              class="color-swatch"
              style="background:{c.value || '#1E293B'};"
              onclick={() => setColor(c.value)}
              title={c.label}
              aria-label={c.label}
            ></button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Clear format -->
    <div class="toolbar-group">
      <button class="tb" onclick={() => cmd(() => editor.chain().focus().clearNodes().unsetAllMarks().run())} title="Hapus Format" aria-label="Clear formatting">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4 8 20"/><line x1="17" y1="11" x2="22" y2="16"/><line x1="22" y1="11" x2="17" y2="16"/></svg>
      </button>
    </div>

    <div class="tb-divider"></div>

    <!-- Table tools -->
    <div class="toolbar-group" style="position:relative;">
      <button
        class="tb {activeStates.inTable ? 'tb--active' : ''}"
        onclick={() => { showTableMenu = !showTableMenu; showColorPicker = false; }}
        title="Tabel"
        aria-label="Table"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
      </button>
      {#if showTableMenu}
        <div class="table-menu" role="menu">
          <p class="table-menu-title">Sisipkan Tabel</p>
          <div class="table-grid-wrap">
            <p class="table-grid-label">{tableHoverRow > 0 ? `${tableHoverRow} × ${tableHoverCol}` : 'Pilih ukuran'}</p>
            <div class="tpicker">
              {#each Array(TABLE_ROWS) as _, r}
                {#each Array(TABLE_COLS) as _, c}
                  <div
                    class="tpicker-cell {r < tableHoverRow && c < tableHoverCol ? 'tpicker-cell--hover' : ''}"
                    onmouseenter={() => { tableHoverRow = r + 1; tableHoverCol = c + 1; }}
                    onmouseleave={() => { tableHoverRow = 0; tableHoverCol = 0; }}
                    onclick={() => insertTable(r + 1, c + 1)}
                    role="button"
                    tabindex="0"
                    aria-label="{r+1} baris {c+1} kolom"
                    onkeydown={(e) => { if (e.key === 'Enter') insertTable(r + 1, c + 1); }}
                  ></div>
                {/each}
              {/each}
            </div>
          </div>
          {#if activeStates.inTable}
            <div class="table-actions">
              <p class="table-menu-title" style="margin-top:10px;">Edit Tabel</p>
              <div class="table-action-grid">
                <button class="table-action-btn" onclick={() => { editor.chain().focus().addColumnBefore().run(); showTableMenu=false; }}>+ Kolom Kiri</button>
                <button class="table-action-btn" onclick={() => { editor.chain().focus().addColumnAfter().run(); showTableMenu=false; }}>+ Kolom Kanan</button>
                <button class="table-action-btn" onclick={() => { editor.chain().focus().addRowBefore().run(); showTableMenu=false; }}>+ Baris Atas</button>
                <button class="table-action-btn" onclick={() => { editor.chain().focus().addRowAfter().run(); showTableMenu=false; }}>+ Baris Bawah</button>
                <button class="table-action-btn" onclick={() => { editor.chain().focus().deleteColumn().run(); showTableMenu=false; }}>- Kolom</button>
                <button class="table-action-btn" onclick={() => { editor.chain().focus().deleteRow().run(); showTableMenu=false; }}>- Baris</button>
                <button class="table-action-btn table-action-btn--merge" onclick={() => { editor.chain().focus().mergeOrSplit().run(); showTableMenu=false; }}>Gabung/Pisah</button>
                <button class="table-action-btn table-action-btn--delete" onclick={() => { editor.chain().focus().deleteTable().run(); showTableMenu=false; }}>Hapus Tabel</button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

  </div>

  <!-- Editor content area -->
  <div class="editor-body" bind:this={editorEl}></div>
</div>

<style>
  .rich-editor-wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
    padding: 8px 10px;
    background: #F8FAFF;
    border: 1.5px solid #E8EFFF;
    border-radius: 16px;
    margin-bottom: 12px;
    row-gap: 4px;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .tb-divider {
    width: 1px;
    height: 20px;
    background: #E0E8FF;
    margin: 0 4px;
    flex-shrink: 0;
  }

  .tb {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #64748B;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
    position: relative;
  }

  .tb:hover {
    background: #E8EFFF;
    color: #4F7FE0;
  }

  .tb:active {
    transform: scale(0.92);
  }

  .tb--active {
    background: #4F7FE0;
    color: white;
  }

  .tb--active:hover {
    background: #3B6ECC;
    color: white;
  }

  .tb-color {
    position: relative;
  }

  /* Color picker */
  .color-picker {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: white;
    border: 1.5px solid #E0E8FF;
    border-radius: 14px;
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(79,127,224,0.15);
    min-width: 150px;
  }

  .color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.1);
    cursor: pointer;
    transition: transform 0.15s;
    padding: 0;
  }

  .color-swatch:first-child {
    background: #1E293B !important;
    border: 2px solid #CBD5E1;
  }

  .color-swatch:hover {
    transform: scale(1.2);
  }

  /* Editor content area */
  .editor-body {
    flex: 1;
    overflow-y: auto;
  }

  /* ProseMirror editor styles (global needed) */
  :global(.rich-editor-content) {
    outline: none;
    min-height: 300px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #4A4570;
    line-height: 1.8;
    padding-bottom: 48px;
  }

  :global(.rich-editor-content p) { margin: 0 0 8px; }
  :global(.rich-editor-content p:empty::before) {
    content: attr(data-placeholder);
    color: #D8D4F0;
    pointer-events: none;
    float: left;
    height: 0;
  }
  :global(.rich-editor-content p:first-child:empty::before) {
    content: attr(data-placeholder);
  }

  :global(.rich-editor-content h1) { font-size: 26px; font-weight: 900; color: #2D2A5E; margin: 16px 0 8px; }
  :global(.rich-editor-content h2) { font-size: 20px; font-weight: 900; color: #2D2A5E; margin: 14px 0 6px; }
  :global(.rich-editor-content h3) { font-size: 17px; font-weight: 900; color: #2D2A5E; margin: 12px 0 5px; }

  :global(.rich-editor-content strong) { font-weight: 900; }
  :global(.rich-editor-content em) { font-style: italic; }
  :global(.rich-editor-content u) { text-decoration: underline; }
  :global(.rich-editor-content s) { text-decoration: line-through; color: #94A3B8; }
  :global(.rich-editor-content mark) { background: #FEF9C3; border-radius: 3px; padding: 0 2px; }

  :global(.rich-editor-content ul) { padding-left: 22px; margin: 8px 0; }
  :global(.rich-editor-content ol) { padding-left: 22px; margin: 8px 0; }
  :global(.rich-editor-content li) { margin: 4px 0; }
  :global(.rich-editor-content ul li::marker) { color: #4F7FE0; }
  :global(.rich-editor-content ol li::marker) { color: #4F7FE0; font-weight: 800; }

  :global(.rich-editor-content blockquote) {
    border-left: 3px solid #8DB2F0;
    padding-left: 14px;
    margin: 10px 0;
    color: #8594A8;
    font-style: italic;
  }

  :global(.rich-editor-content hr) {
    border: none;
    border-top: 2px solid #E0E8FF;
    margin: 14px 0;
  }

  :global(.rich-editor-content .ProseMirror-selectednode) {
    outline: 2px solid #4F7FE0;
    border-radius: 4px;
  }

  /* Table menu */
  .table-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: white;
    border: 1.5px solid #E0E8FF;
    border-radius: 16px;
    padding: 12px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(79,127,224,0.15);
    min-width: 200px;
  }

  .table-menu-title {
    font-size: 10px;
    font-weight: 800;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 8px;
  }

  .table-grid-label {
    font-size: 11px;
    font-weight: 800;
    color: #4F7FE0;
    text-align: center;
    margin: 0 0 6px;
    min-height: 14px;
  }

  .tpicker {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 3px;
  }

  .tpicker-cell {
    width: 22px;
    height: 22px;
    border: 1.5px solid #E0E8FF;
    border-radius: 4px;
    background: #F8FAFF;
    cursor: pointer;
    transition: all 0.1s;
  }

  .tpicker-cell--hover {
    background: #4F7FE0;
    border-color: #4F7FE0;
  }

  .table-action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-top: 4px;
  }

  .table-action-btn {
    padding: 6px 8px;
    border: 1.5px solid #E0E8FF;
    border-radius: 8px;
    background: #F8FAFF;
    color: #4F7FE0;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
  }
  .table-action-btn:hover { background: #EEF4FF; }
  .table-action-btn--merge { background: #FEF9C3; color: #A16207; border-color: #FDE68A; }
  .table-action-btn--delete { background: #FDF4F6; color: #EF7C97; border-color: #FECDD3; }

  /* Global table styles */
  :global(.rich-editor-content table) {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    table-layout: fixed;
    overflow: hidden;
    border-radius: 10px;
    font-size: 13px;
  }

  :global(.rich-editor-content td, .rich-editor-content th) {
    border: 1.5px solid #E0E8FF;
    padding: 8px 10px;
    vertical-align: top;
    min-width: 60px;
    position: relative;
    word-break: break-word;
  }

  :global(.rich-editor-content th) {
    background: #F0F5FF;
    font-weight: 900;
    color: #2D2A5E;
    text-align: left;
  }

  :global(.rich-editor-content td) {
    background: white;
    color: #4A4570;
  }

  :global(.rich-editor-content tr:nth-child(even) td) {
    background: #FAFBFF;
  }

  :global(.rich-editor-content .selectedCell) {
    background: #E8EFFF !important;
  }

  :global(.rich-editor-content .column-resize-handle) {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    background: #4F7FE0;
    pointer-events: none;
    opacity: 0;
  }

  :global(.rich-editor-content table:hover .column-resize-handle) {
    opacity: 0.5;
  }
</style>

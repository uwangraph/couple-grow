<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { HyperFormula } from 'hyperformula';

  // Props
  let { data = $bindable<string[][]>([]) }: { data: string[][] } = $props();

  // Default 20 rows x 8 cols if empty
  const DEFAULT_ROWS = 20;
  const DEFAULT_COLS = 8;

  // Internal grid state (raw input values, may contain formulas)
  let grid = $state<string[][]>([]);
  // HyperFormula's public constructor is protected; infer the type from its
  // factory method instead of InstanceType<typeof HyperFormula>.
  let hf: ReturnType<typeof HyperFormula.buildEmpty>;
  const SHEET = 'Sheet1';

  // Selection
  let selectedRow = $state(-1);
  let selectedCol = $state(-1);
  let editingRow = $state(-1);
  let editingCol = $state(-1);
  let editValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  // Computed display values (formula results)
  let displayGrid = $state<string[][]>([]);

  function colLabel(i: number) {
    let label = '';
    let n = i + 1;
    while (n > 0) {
      label = String.fromCharCode(((n - 1) % 26) + 65) + label;
      n = Math.floor((n - 1) / 26);
    }
    return label;
  }

  function cellAddress(row: number, col: number) {
    return `${colLabel(col)}${row + 1}`;
  }

  function initGrid() {
    // Load from prop or create empty
    const rows = data.length > 0 ? Math.max(data.length, DEFAULT_ROWS) : DEFAULT_ROWS;
    const cols = data.length > 0 ? Math.max(Math.max(...data.map(r => r.length)), DEFAULT_COLS) : DEFAULT_COLS;

    grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? '')
    );
  }

  function initHF() {
    hf = HyperFormula.buildEmpty({
      licenseKey: 'gpl-v3',
      useArrayArithmetic: true,
    });
    hf.addSheet(SHEET);
    rebuildHF();
  }

  function rebuildHF() {
    // Load entire grid into HF
    const sheetData = grid.map(row => row.map(cell => cell === '' ? null : cell));
    hf.setSheetContent(hf.getSheetId(SHEET)!, sheetData);
    recalcDisplay();
  }

  function recalcDisplay() {
    const sheetId = hf.getSheetId(SHEET)!;
    displayGrid = grid.map((row, r) =>
      row.map((_, c) => {
        try {
          const val = hf.getCellValue({ sheet: sheetId, row: r, col: c });
          if (val === null || val === undefined) return '';
          if (val instanceof Error) return '#ERR';
          if (typeof val === 'object' && 'type' in val) return `#${(val as any).type}`;
          return String(val);
        } catch {
          return '';
        }
      })
    );
  }

  function setCell(row: number, col: number, value: string) {
    grid[row][col] = value;
    const sheetId = hf.getSheetId(SHEET)!;
    hf.setCellContents({ sheet: sheetId, row, col }, [[value === '' ? null : value]]);
    recalcDisplay();
    // Sync back to prop
    data = grid.map(r => [...r]);
  }

  function startEdit(row: number, col: number, initialChar?: string) {
    selectedRow = row;
    selectedCol = col;
    editingRow = row;
    editingCol = col;
    // If starting with a character, use that. Otherwise load existing value.
    editValue = initialChar !== undefined ? initialChar : (grid[row][col] ?? '');
    setTimeout(() => {
      if (inputEl) {
        inputEl.focus();
        // Move cursor to end
        const len = inputEl.value.length;
        inputEl.setSelectionRange(len, len);
      }
    }, 0);
  }

  function commitEdit(moveRow = 0, moveCol = 0) {
    const r = editingRow;
    const c = editingCol;
    if (r >= 0 && c >= 0) {
      setCell(r, c, editValue);
    }
    editingRow = -1;
    editingCol = -1;
    editValue = '';
    // Move selection after commit
    if (moveRow !== 0 || moveCol !== 0) {
      selectedRow = Math.max(0, Math.min(grid.length - 1, r + moveRow));
      selectedCol = Math.max(0, Math.min(grid[0].length - 1, c + moveCol));
    }
  }

  function handleInputKeydown(e: KeyboardEvent, row: number, col: number) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit(1, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(0, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      editingRow = -1;
      editingCol = -1;
      editValue = grid[row][col] ?? ''; // restore
    }
    // Arrow keys only navigate if NOT in formula mode
    else if (e.key === 'ArrowUp' && !editValue.startsWith('=')) {
      e.preventDefault();
      commitEdit(-1, 0);
    } else if (e.key === 'ArrowDown' && !editValue.startsWith('=')) {
      e.preventDefault();
      commitEdit(1, 0);
    }
  }

  function handleCellKeydown(e: KeyboardEvent, row: number, col: number) {
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(row, col);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setCell(row, col, '');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedRow = Math.max(0, row - 1); selectedCol = col;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedRow = Math.min(grid.length - 1, row + 1); selectedCol = col;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectedRow = row; selectedCol = Math.max(0, col - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectedRow = row; selectedCol = Math.min(grid[0].length - 1, col + 1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      selectedRow = row;
      selectedCol = e.shiftKey
        ? Math.max(0, col - 1)
        : Math.min(grid[0].length - 1, col + 1);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing with the pressed character — do NOT reset, append as initial
      startEdit(row, col, e.key);
    }
  }

  function addRow() {
    const newRow = Array(grid[0].length).fill('');
    grid = [...grid, newRow];
    rebuildHF();
    data = grid.map(r => [...r]);
  }

  function addCol() {
    grid = grid.map(row => [...row, '']);
    rebuildHF();
    data = grid.map(r => [...r]);
  }

  // Formula bar display
  let formulaBarValue = $derived(
    selectedRow >= 0 && selectedCol >= 0
      ? (editingRow === selectedRow && editingCol === selectedCol
          ? editValue
          : grid[selectedRow]?.[selectedCol] ?? '')
      : ''
  );

  let formulaBarCell = $derived(
    selectedRow >= 0 && selectedCol >= 0
      ? cellAddress(selectedRow, selectedCol)
      : ''
  );

  // Formula autocomplete
  const FORMULA_LIST = [
    'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'MAX', 'MIN', 'IF', 'IFS',
    'AND', 'OR', 'NOT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS',
    'CONCATENATE', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'LEFT', 'RIGHT', 'MID',
    'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'TODAY', 'NOW', 'YEAR', 'MONTH',
    'DAY', 'DATE', 'SUMIF', 'COUNTIF', 'AVERAGEIF', 'IFERROR', 'ISBLANK',
    'PRODUCT', 'SQRT', 'POWER', 'MOD', 'INT', 'CEILING', 'FLOOR'
  ];

  let formulaSuggestions = $derived(() => {
    if (!editValue.startsWith('=')) return [];
    const afterEq = editValue.slice(1);
    const lastToken = afterEq.split(/[\(\),\+\-\*\/\s]/).pop()?.toUpperCase() ?? '';
    if (lastToken.length < 1) return [];
    return FORMULA_LIST.filter(f => f.startsWith(lastToken) && f !== lastToken).slice(0, 5);
  });

  function applySuggestion(suggestion: string) {
    if (!editValue.startsWith('=')) return;
    const lastTokenMatch = editValue.match(/([A-Za-z]+)$/);
    if (lastTokenMatch) {
      editValue = editValue.slice(0, editValue.length - lastTokenMatch[1].length) + suggestion + '(';
    }
    inputEl?.focus();
  }

  // Check if value is formula
  function isFormula(val: string) { return val.startsWith('='); }
  function isError(val: string) { return val.startsWith('#'); }
  function isNumber(val: string) { return !isNaN(Number(val)) && val !== ''; }

  onMount(() => {
    initGrid();
    initHF();
  });

  onDestroy(() => { hf?.destroy(); });
</script>

<div class="sheet-root">

  <!-- Formula bar -->
  <div class="formula-bar">
    <div class="cell-ref">{formulaBarCell || '—'}</div>
    <div class="formula-bar-sep"></div>
    {#if editingRow >= 0}
      <span class="fx">fx</span>
      <span class="formula-preview formula-preview--editing">{editValue}</span>
    {:else}
      <span class="fx">fx</span>
      <span class="formula-preview {isFormula(formulaBarValue) ? 'formula-preview--formula' : ''}">{formulaBarValue || ''}</span>
    {/if}
  </div>

  <!-- Grid -->
  <div class="sheet-scroll">
    <table class="sheet-table" role="grid">
      <!-- Column headers -->
      <thead>
        <tr>
          <th class="row-num-header"></th>
          {#each Array(grid[0]?.length ?? DEFAULT_COLS) as _, c}
            <th class="col-header {selectedCol === c ? 'col-header--active' : ''}">{colLabel(c)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each grid as row, r}
          <tr>
            <!-- Row number -->
            <td class="row-num {selectedRow === r ? 'row-num--active' : ''}">{r + 1}</td>
            {#each row as _, c}
              {@const isSelected = selectedRow === r && selectedCol === c}
              {@const isEditing = editingRow === r && editingCol === c}
              {@const display = displayGrid[r]?.[c] ?? ''}
              {@const raw = grid[r]?.[c] ?? ''}

              <td
                class="cell
                  {isSelected ? 'cell--selected' : ''}
                  {isEditing ? 'cell--editing' : ''}
                  {isFormula(raw) ? 'cell--formula' : ''}
                  {isError(display) ? 'cell--error' : ''}
                  {isNumber(display) && !isFormula(raw) ? 'cell--number' : ''}"
                onclick={() => { selectedRow = r; selectedCol = c; }}
                ondblclick={() => startEdit(r, c)}
                onkeydown={(e) => handleCellKeydown(e, r, c)}
                tabindex="0"
                role="gridcell"
                aria-selected={isSelected}
              >
                {#if isEditing}
                  <div class="cell-edit-wrap">
                    <input
                      bind:this={inputEl}
                      bind:value={editValue}
                      class="cell-input"
                      onblur={() => commitEdit()}
                      onkeydown={(e) => handleInputKeydown(e, r, c)}
                      onclick={(e) => e.stopPropagation()}
                    />
                    {#if formulaSuggestions().length > 0}
                      <div class="autocomplete-pop">
                        {#each formulaSuggestions() as s}
                          <button
                            class="autocomplete-item"
                            onmousedown={(e) => { e.preventDefault(); applySuggestion(s); }}
                          >{s}</button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <span class="cell-display">{display}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Add row/col buttons -->
  <div class="sheet-controls">
    <button class="sheet-ctrl-btn" onclick={addRow}>+ Baris</button>
    <button class="sheet-ctrl-btn" onclick={addCol}>+ Kolom</button>
  </div>

  <!-- Formula hints -->
  <div class="formula-hints">
    <span class="hint-label">Formula:</span>
    {#each ['=SUM(A1:A5)', '=AVERAGE(B1:B5)', '=IF(A1>0,"Ya","Tidak")', '=COUNT(A1:A10)', '=MAX(A1:A5)', '=MIN(A1:A5)'] as hint}
      <button class="hint-chip" onclick={() => {
        if (selectedRow >= 0 && selectedCol >= 0) {
          editValue = hint;
          startEdit(selectedRow, selectedCol);
        }
      }}>{hint}</button>
    {/each}
  </div>

</div>

<style>
  .sheet-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family: 'Nunito', sans-serif;
    background: white;
  }

  /* Formula bar */
  .formula-bar {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 6px 10px;
    background: #F8FAFF;
    border: 1.5px solid #E0E8FF;
    border-radius: 12px;
    margin-bottom: 8px;
    flex-shrink: 0;
    min-height: 36px;
  }

  .cell-ref {
    font-size: 12px;
    font-weight: 900;
    color: #4F7FE0;
    min-width: 36px;
    text-align: center;
  }

  .formula-bar-sep {
    width: 1px;
    height: 18px;
    background: #E0E8FF;
    margin: 0 10px;
    flex-shrink: 0;
  }

  .fx {
    font-size: 12px;
    font-weight: 900;
    color: #5CC8AC;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .formula-preview {
    font-size: 13px;
    font-weight: 600;
    color: #4A4570;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .formula-preview--formula { color: #4F7FE0; font-weight: 800; }
  .formula-preview--editing { color: #1E293B; }

  /* Grid */
  .sheet-scroll {
    flex: 1;
    overflow: auto;
    border: 1.5px solid #E0E8FF;
    border-radius: 12px;
  }

  .sheet-table {
    border-collapse: collapse;
    table-layout: fixed;
    min-width: 100%;
  }

  /* Headers */
  .col-header {
    position: sticky;
    top: 0;
    background: #F0F5FF;
    border: 1px solid #E0E8FF;
    padding: 5px 4px;
    font-size: 11px;
    font-weight: 900;
    color: #64748B;
    text-align: center;
    min-width: 80px;
    width: 80px;
    user-select: none;
    z-index: 2;
  }

  .col-header--active {
    background: #4F7FE0;
    color: white;
  }

  .row-num-header {
    position: sticky;
    top: 0;
    left: 0;
    background: #F0F5FF;
    border: 1px solid #E0E8FF;
    width: 36px;
    min-width: 36px;
    z-index: 3;
  }

  .row-num {
    position: sticky;
    left: 0;
    background: #F8FAFF;
    border: 1px solid #E0E8FF;
    font-size: 10px;
    font-weight: 800;
    color: #94A3B8;
    text-align: center;
    padding: 2px 4px;
    width: 36px;
    min-width: 36px;
    user-select: none;
    z-index: 1;
  }

  .row-num--active {
    background: #EEF4FF;
    color: #4F7FE0;
  }

  /* Cells */
  .cell {
    border: 1px solid #E8EFFF;
    padding: 0;
    height: 28px;
    min-width: 80px;
    width: 80px;
    cursor: cell;
    position: relative;
    outline: none;
    overflow: hidden;
  }

  .cell:focus { z-index: 1; }

  .cell--selected {
    box-shadow: inset 0 0 0 2px #4F7FE0;
    background: #F5F8FE;
    z-index: 1;
  }

  .cell--editing {
    box-shadow: inset 0 0 0 2px #4F7FE0;
    background: white;
    z-index: 2;
  }

  .cell--number .cell-display {
    text-align: right;
    color: #2D2A5E;
  }

  .cell--formula .cell-display {
    color: #4A4570;
  }

  .cell--error .cell-display {
    color: #EF7C97;
    font-weight: 800;
  }

  .cell-display {
    display: block;
    padding: 5px 6px;
    font-size: 12px;
    font-weight: 600;
    color: #4A4570;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    height: 100%;
    line-height: 18px;
  }

  .cell-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    padding: 5px 6px;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #2D2A5E;
    background: white;
    z-index: 3;
    min-width: 200px;
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.13),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95);
  }

  /* Controls */
  .sheet-controls {
    display: flex;
    gap: 8px;
    padding: 8px 0;
    flex-shrink: 0;
  }

  .sheet-ctrl-btn {
    padding: 6px 14px;
    border: 1.5px solid #E0E8FF;
    border-radius: 10px;
    background: #F8FAFF;
    color: #4F7FE0;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sheet-ctrl-btn:hover { background: #EEF4FF; border-color: #4F7FE0; }

  /* Formula hints */
  .formula-hints {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 4px 0 8px;
    flex-shrink: 0;
  }

  .hint-label {
    font-size: 10px;
    font-weight: 800;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .hint-chip {
    font-size: 10px;
    font-weight: 800;
    color: #5CC8AC;
    background: #F0F9F7;
    border: 1px solid #CDEBE2;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    font-family: monospace;
    transition: all 0.15s;
  }

  .hint-chip:hover { background: #E1F4EE; border-color: #86EFAC; }
</style>

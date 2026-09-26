<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL, readApiJson } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/Icon.svelte';
  import { toast } from '$lib/toast.svelte';

  let wishlists = $state<any[]>([]);
  let savings = $state<any[]>([]);
  let loading = $state(true);

  let showModal = $state(false);
  let editingWishlist = $state<any>(null);
  let name = $state('');
  let description = $state('');
  let estimatedPrice = $state('');
  let priority = $state(2); // 1=low, 2=medium, 3=high
  let linkedSavingId = $state('');

  onMount(async () => {
    if (!auth.token) { goto('/login'); return; }
    await Promise.all([fetchWishlists(), fetchSavings()]);
  });

  function handleUnauthorized() {
    auth.logout();
    goto('/login');
  }

  async function fetchWishlists() {
    try {
      const res = await fetch(`${API_URL}/wishlists`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) {
        const data = await readApiJson<{ wishlists?: any[] }>(res);
        wishlists = data.wishlists || [];
      }
    } catch(e) {} finally { loading = false; }
  }

  async function fetchSavings() {
    try {
      const res = await fetch(`${API_URL}/savings`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.ok) {
        const data = await readApiJson<{ savings?: any[] }>(res);
        savings = data.savings || [];
      }
    } catch(e) {}
  }

  function openCreateModal() {
    editingWishlist = null;
    name = '';
    description = '';
    estimatedPrice = '';
    priority = 2;
    linkedSavingId = '';
    showModal = true;
  }

  function openEditModal(wish: any) {
    editingWishlist = wish;
    name = wish.name;
    description = wish.description || '';
    estimatedPrice = wish.estimated_price?.toString() || '';
    priority = wish.priority || 2;
    linkedSavingId = wish.linked_saving_id?.toString() || '';
    showModal = true;
  }

  async function saveWishlist(e: Event) {
    e.preventDefault();
    try {
      if (editingWishlist) {
        const res = await fetch(`${API_URL}/wishlists/${editingWishlist.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
          body: JSON.stringify({
            name,
            description: description || null,
            estimated_price: estimatedPrice ? parseInt(estimatedPrice) : null,
            priority,
            linked_saving_id: linkedSavingId || null
          })
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error('Gagal update wishlist');
      } else {
        const res = await fetch(`${API_URL}/wishlists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
          body: JSON.stringify({
            name,
            description: description || null,
            estimated_price: estimatedPrice ? parseInt(estimatedPrice) : null,
            priority,
            linked_saving_id: linkedSavingId || null
          })
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error('Gagal membuat wishlist');
      }

      showModal = false;
      await fetchWishlists();
      toast.success(editingWishlist ? 'Wishlist berhasil diupdate!' : 'Wishlist berhasil ditambahkan!');
    } catch(e: any) {
      toast.error(e.message || 'Gagal menyimpan wishlist');
    }
  }

  async function toggleComplete(wish: any) {
    try {
      const res = await fetch(`${API_URL}/wishlists/${wish.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ is_completed: !wish.is_completed })
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Gagal update status');
      
      await fetchWishlists();
      toast.success(wish.is_completed ? 'Wishlist dibuka kembali!' : 'Wishlist tercapai!');
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  async function deleteWishlist(id: number) {
    if (!confirm('Hapus wishlist ini?')) return;
    try {
      const res = await fetch(`${API_URL}/wishlists/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) throw new Error('Gagal menghapus wishlist');
      
      await fetchWishlists();
      toast.success('Wishlist berhasil dihapus!');
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  function formatRp(num: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }

  function getPriorityLabel(p: number) {
    if (p === 3) return { label: 'Tinggi', color: '#EF7C97' };
    if (p === 2) return { label: 'Sedang', color: '#F59E0B' };
    return { label: 'Rendah', color: '#64748B' };
  }

  let highPriority = $derived(wishlists.filter(w => !w.is_completed && w.priority === 3));
  let mediumPriority = $derived(wishlists.filter(w => !w.is_completed && w.priority === 2));
  let lowPriority = $derived(wishlists.filter(w => !w.is_completed && w.priority <= 1));
  let completed = $derived(wishlists.filter(w => w.is_completed));
</script>

<div class="wishlist-root">
  
  <!-- Header -->
  <div class="header">
    <div class="header-inner">
        <div class="header-top">
          <div>
            <button class="back-btn" onclick={() => goto('/home')} aria-label="Kembali ke Beranda">
              <Icon name="back" size={18} />
              Kembali
            </button>
            <p class="header-sub">Impian Bersama</p>
            <h1 class="header-title">
              Wishlist <Icon name="sparkles" size={24} />
            </h1>
            <p class="header-description">Simpan impian kecil dan besar untuk diwujudkan bersama.</p>
          </div>
          <button class="create-btn" onclick={openCreateModal}>
            + Tambah
          </button>
        </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    {#if loading}
      <div class="loading-wrap">
        <div class="spinner"></div>
      </div>

    {:else if wishlists.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <Icon name="sparkles" size={38} />
        </div>
        <p class="empty-title">Belum ada wishlist</p>
        <p class="empty-sub">Yuk catat impian yang pengen diwujudkan berdua!</p>
        <button class="empty-cta" onclick={openCreateModal}>+ Tambah Wishlist</button>
      </div>

    {:else}
      
      <!-- High Priority -->
      {#if highPriority.length > 0}
        <div class="priority-section">
          <h2 class="priority-title">
            <span class="priority-badge" style="background:#FDF4F6;color:#EF7C97">Prioritas Tinggi</span>
          </h2>
          <div class="wishlist-grid">
            {#each highPriority as wish}
              <div class="wish-card">
                <div class="wish-header">
                  <button type="button" class="wish-check" onclick={() => toggleComplete(wish)} aria-label="Tandai {wish.name} tercapai">
                    <Icon name={wish.is_completed ? 'check' : 'sparkles'} size={20} />
                  </button>
                  <div class="wish-menu">
                    <button type="button" class="menu-btn" onclick={() => openEditModal(wish)} aria-label="Edit {wish.name}">
                      <Icon name="edit" size={16} />
                    </button>
                    <button type="button" class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)} aria-label="Hapus {wish.name}">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>

                <h3 class="wish-name">{wish.name}</h3>
                {#if wish.description}
                  <p class="wish-desc">{wish.description}</p>
                {/if}
                {#if wish.estimated_price}
                  <p class="wish-price">{formatRp(wish.estimated_price)}</p>
                {/if}
                {#if wish.linked_saving_id}
                  {@const saving = savings.find(s => s.id === wish.linked_saving_id)}
                  {#if saving}
                    <div class="wish-saving">
                      <Icon name="savings" size={14} />
                      <span>Tabungan: {saving.name}</span>
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Medium Priority -->
      {#if mediumPriority.length > 0}
        <div class="priority-section">
          <h2 class="priority-title">
            <span class="priority-badge" style="background:#FEF3C7;color:#F59E0B">Prioritas Sedang</span>
          </h2>
          <div class="wishlist-grid">
            {#each mediumPriority as wish}
              <div class="wish-card">
                <div class="wish-header">
                  <button type="button" class="wish-check" onclick={() => toggleComplete(wish)} aria-label="Tandai {wish.name} tercapai">
                    <Icon name={wish.is_completed ? 'check' : 'sparkles'} size={20} />
                  </button>
                  <div class="wish-menu">
                    <button type="button" class="menu-btn" onclick={() => openEditModal(wish)} aria-label="Edit {wish.name}">
                      <Icon name="edit" size={16} />
                    </button>
                    <button type="button" class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)} aria-label="Hapus {wish.name}">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <h3 class="wish-name">{wish.name}</h3>
                {#if wish.description}
                  <p class="wish-desc">{wish.description}</p>
                {/if}
                {#if wish.estimated_price}
                  <p class="wish-price">{formatRp(wish.estimated_price)}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Low Priority -->
      {#if lowPriority.length > 0}
        <div class="priority-section">
          <h2 class="priority-title">
            <span class="priority-badge" style="background:#F1F5F9;color:#64748B">Prioritas Rendah</span>
          </h2>
          <div class="wishlist-grid">
            {#each lowPriority as wish}
              <div class="wish-card">
                <div class="wish-header">
                  <button type="button" class="wish-check" onclick={() => toggleComplete(wish)} aria-label="Tandai {wish.name} tercapai">
                    <Icon name={wish.is_completed ? 'check' : 'sparkles'} size={20} />
                  </button>
                  <div class="wish-menu">
                    <button type="button" class="menu-btn" onclick={() => openEditModal(wish)} aria-label="Edit {wish.name}">
                      <Icon name="edit" size={16} />
                    </button>
                    <button type="button" class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)} aria-label="Hapus {wish.name}">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <h3 class="wish-name">{wish.name}</h3>
                {#if wish.description}
                  <p class="wish-desc">{wish.description}</p>
                {/if}
                {#if wish.estimated_price}
                  <p class="wish-price">{formatRp(wish.estimated_price)}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Completed -->
      {#if completed.length > 0}
        <div class="priority-section">
          <h2 class="priority-title">
            <span class="priority-badge" style="background:#F0F9F7;color:#5CC8AC">Tercapai</span>
          </h2>
          <div class="wishlist-grid">
            {#each completed as wish}
              <div class="wish-card wish-card--completed">
                <div class="wish-header">
                  <button type="button" class="wish-check wish-check--completed" onclick={() => toggleComplete(wish)} aria-label="Buka kembali {wish.name}">
                    <Icon name="check" size={20} />
                  </button>
                  <div class="wish-menu">
                    <button type="button" class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)} aria-label="Hapus {wish.name}">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
                <h3 class="wish-name">{wish.name}</h3>
                {#if wish.estimated_price}
                  <p class="wish-price">{formatRp(wish.estimated_price)}</p>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

    {/if}

    <div style="height:32px;"></div>
  </div>

  <!-- Modal -->
  {#if showModal}
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label={editingWishlist ? 'Edit wishlist' : 'Tambah wishlist'} tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }} onkeydown={(e) => { if (e.key === 'Escape') showModal = false; }}>
      <div class="modal">
        <div class="modal-handle"></div>
        <div class="modal-icon-header">
          <div class="modal-icon-circle">
            <Icon name="sparkles" size={24} />
          </div>
          <div>
            <h3 class="modal-title">{editingWishlist ? 'Edit Wishlist' : 'Tambah Wishlist'}</h3>
            <p class="modal-subtitle">Impian yang pengen diwujudkan</p>
          </div>
        </div>
        <form class="modal-form" onsubmit={saveWishlist}>
          <div class="form-group">
            <label class="form-label" for="wish-name">Nama Impian</label>
            <input
              id="wish-name"
              type="text"
              bind:value={name}
              required
              placeholder="Contoh: Liburan ke Jepang"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="wish-description">Deskripsi (opsional)</label>
            <textarea
              id="wish-description"
              bind:value={description}
              placeholder="Detail impian..."
              class="form-input form-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="wish-price">Estimasi Harga (Rp, opsional)</label>
            <input
              id="wish-price"
              type="number"
              bind:value={estimatedPrice}
              placeholder="0"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="wish-priority">Prioritas</label>
            <select id="wish-priority" bind:value={priority} class="form-input">
              <option value={3}>Tinggi</option>
              <option value={2}>Sedang</option>
              <option value={1}>Rendah</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="wish-saving">Hubungkan ke Tabungan (opsional)</label>
            <select id="wish-saving" bind:value={linkedSavingId} class="form-input">
              <option value="">Tidak ada</option>
              {#each savings as saving}
                <option value={saving.id}>{saving.name}</option>
              {/each}
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="modal-cancel" onclick={() => showModal = false}>Batal</button>
            <button type="submit" class="modal-submit">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

  .wishlist-root {
    font-family: 'Nunito', sans-serif;
    min-height: 100%;
    background: transparent;
  }

  .header {
    padding: 24px 22px 28px;
    position: relative;
    flex-shrink: 0;
    font-family: 'Nunito', sans-serif;
    background: linear-gradient(155deg, #1D4ED8, #2563EB 55%, #3B82F6);
    border-radius: 0 0 28px 28px;
    box-shadow: 0 12px 26px rgba(37,99,235,.18);
  }
  .header-inner { position: relative; max-width:760px; margin:auto; }
  .header-top { display: flex; align-items: flex-end; justify-content: space-between; gap:12px; }
  .back-btn { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color:#DBEAFE; padding: 0; margin-bottom: 22px; font:700 13px 'Nunito',sans-serif; cursor: pointer; }
  .back-btn:hover { color:#fff; }
  .header-sub { font-size: 10px; color:#BFDBFE; margin: 0 0 6px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; }
  .header-title { display:flex; align-items:center; gap:8px; font-size: 29px; font-weight: 900; color:#fff; margin: 0; letter-spacing:-.03em; }
  .header-description { max-width:255px; margin:8px 0 0; color:#DBEAFE; font-size:12px; line-height:1.4; font-weight:600; }

  .create-btn {
    background:rgba(255,255,255,.18);
    color:#ffffff;
    border:1px solid rgba(255,255,255,.35);
    border-radius: 12px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.15s, filter 0.2s;
    flex-shrink: 0;
    box-shadow:0 5px 14px rgba(15,55,140,.13);
  }
  .create-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
  .create-btn:active { transform: scale(0.96); }

  .body { max-width:760px; margin:auto; padding:24px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E2E8F0; border-top-color: #2196F3; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { text-align:center; padding:64px 20px; background:rgba(255,255,255,.66); border-radius:24px; }
  .empty-icon { width:72px; height:72px; margin:0 auto 16px; color:#2563eb; display:grid; place-items:center; border-radius:22px; background:#e7f1ff; }
  .empty-title { font-size:17px; font-weight:900; color:#172033; margin:0 0 6px; }
  .empty-sub { max-width:240px; font-size:12px; line-height:1.5; color:#64748B; margin:0 auto 22px; }
  .empty-cta {
    background: linear-gradient(145deg, #4FACF4 0%, #2196F3 55%, #1976D2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 13px 24px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s, transform 0.15s;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26);
  }
  .empty-cta:hover { filter: brightness(1.12); transform: translateY(-1px); }

  /* Priority Section */
  .priority-section { margin-bottom:26px; }
  .priority-title { margin: 0 0 12px; }
  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 99px;
    font-size: 13px;
    font-weight: 700;
  }

  /* Wishlist Grid */
  .wishlist-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  @media (min-width: 600px) { .wishlist-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }

  /* Wish Card */
  .wish-card {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 20px;
    padding: 17px;
    box-shadow: 0 8px 22px rgba(30,64,175,.07);
    transition: transform 0.15s;
  }
  .wish-card--completed {
    background: #ffffff;
    border-color: rgba(79, 191, 163, 0.4);
    opacity: 0.75;
  }
  .wish-card:active { transform: scale(0.98); }

  .wish-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .wish-check {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(33, 150, 243, 0.1);
    border:1px solid rgba(37,99,235,.14);
    color: #1976D2;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .wish-check:active { transform: scale(0.85); }
  .wish-check--completed { background: rgba(79,191,163,0.1); color: #2F9A80; }

  .wish-menu { display: flex; gap: 4px; }
  .menu-btn {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%);
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow:
      inset 3px 3px 6px rgba(255, 255, 255, 0.5),
      inset -3px -4px 8px rgba(13, 71, 161, 0.32),
      4px 6px 13px rgba(21, 101, 192, 0.22);
  }
  .menu-btn:hover { background: rgba(33, 150, 243,0.18); }
  .menu-btn--delete { background: linear-gradient(145deg, #F7A9BC 0%, #EF7C97 55%, #E2637F 100%); color: #fff; }
  .menu-btn--delete:hover { background: linear-gradient(145deg, #F7A9BC 0%, #EF7C97 55%, #E2637F 100%); }

  .wish-name {
    font-size: 16px;
    font-weight: 900;
    color: #1F2937;
    margin: 0 0 4px;
    line-height: 1.3;
  }

  .wish-desc {
    font-size: 12px;
    color: #64748B;
    font-weight: 600;
    margin: 0 0 6px;
    line-height: 1.4;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wish-price {
    font-size: 14px;
    font-weight: 900;
    color: #1976D2;
    margin: 0 0 6px;
  }

  .wish-saving {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #1976D2;
    font-weight: 600;
    background: rgba(33, 150, 243,0.1);
    padding: 4px 8px;
    border-radius: 8px;
    margin-top: 6px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(30,41,59,0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: #FFFFFF;
    border-top: 1px solid rgba(255,255,255,0.8);
    border-radius: 28px 28px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 40px;
    max-height: 85vh;
    overflow-y: auto;
    animation: slide-up 0.25s ease;
    box-shadow:
      inset 5px 5px 10px rgba(255, 255, 255, 0.9),
      inset -4px -6px 12px rgba(33, 150, 243, 0.10),
      6px 10px 22px rgba(21, 101, 192, 0.10),
      2px 3px 6px rgba(21, 101, 192, 0.06);
  }
  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .modal-handle { width: 44px; height: 5px; background: #E0E7FF; border-radius: 99px; margin: 0 auto 20px; }
  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .modal-icon-circle {
    width: 50px; height: 50px; border-radius: 16px;
    background: #EFF6FF; color: #2196F3;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .modal-title { font-size: 17px; font-weight: 900; color: #1E293B; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #94A3B8; margin: 0; font-weight: 700; }

  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px; border: none; border-radius: 22px;
    font-size: 15px; font-weight: 700; color: #1E293B; font-family: 'Nunito', sans-serif;
    outline: none; background: #E6F2FD; transition: border-color 0.2s;
    width: 100%; box-sizing: border-box;
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.13),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95);
  }
  .form-input:focus {
    box-shadow:
      inset 4px 4px 8px rgba(25, 118, 210, 0.18),
      inset -3px -3px 7px rgba(255, 255, 255, 0.95),
      0 0 0 3px rgba(33, 150, 243, 0.16);
  }
  .form-textarea { resize: none; min-height: 80px; }
  .modal-actions { display: flex; gap: 12px; padding-top: 4px; }
  .modal-cancel {
    flex: 1; padding: 14px; background: #F0F4FF; color: #94A3B8; border: none;
    border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;
  }
  .modal-submit {
    flex: 2; padding: 14px;
    background: linear-gradient(145deg, #2196F3, #4F96E5);
    color: white; border: none; border-radius: 22px;
    font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 900; cursor: pointer;
    box-shadow:
      inset 3px 3px 7px rgba(255, 255, 255, 0.4),
      inset -3px -5px 10px rgba(13, 71, 161, 0.32),
      5px 9px 18px rgba(21, 101, 192, 0.26); transition: transform 0.12s;
  }
  .modal-submit:active { transform: scale(0.97); }

  .wish-card, .empty-state { border: 1px solid rgba(255,255,255,.92); box-shadow: 0 8px 20px rgba(30,64,175,.06); border-radius: 18px; }
  .empty-cta, .modal-submit { background: #2563EB; box-shadow: 0 8px 18px rgba(37,99,235,.2); border-radius: 12px; }
  .menu-btn { border-radius: 10px; box-shadow: none; }
  .form-input { border: 1px solid #E2E8F0; box-shadow: none; background: #F8FAFC; border-radius: 12px; }
  .form-input:focus { border-color: #60A5FA; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
</style>

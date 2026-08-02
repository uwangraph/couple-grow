<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { API_URL } from '$lib/api';
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
        const data = await res.json();
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
        const data = await res.json();
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
    if (p === 3) return { label: 'Tinggi', color: '#F43F5E' };
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
            <h1 class="header-title" style="display: flex; align-items: center; gap: 8px;">
              Wishlist <Icon name="sparkles" size={24} />
            </h1>
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
          <Icon name="empty" size={56} />
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
            <span class="priority-badge" style="background:#FFF1F2;color:#F43F5E">Prioritas Tinggi</span>
          </h2>
          <div class="wishlist-grid">
            {#each highPriority as wish}
              <div class="wish-card">
                <div class="wish-header">
                  <div class="wish-check" onclick={() => toggleComplete(wish)}>
                    <Icon name={wish.is_completed ? 'check' : 'sparkles'} size={20} />
                  </div>
                  <div class="wish-menu">
                    <button class="menu-btn" onclick={() => openEditModal(wish)}>
                      <Icon name="edit" size={16} />
                    </button>
                    <button class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)}>
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
                  <div class="wish-check" onclick={() => toggleComplete(wish)}>
                    <Icon name={wish.is_completed ? 'check' : 'sparkles'} size={20} />
                  </div>
                  <div class="wish-menu">
                    <button class="menu-btn" onclick={() => openEditModal(wish)}>
                      <Icon name="edit" size={16} />
                    </button>
                    <button class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)}>
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
            <span class="priority-badge" style="background:#F1F5F9;color:#64748B">Someday</span>
          </h2>
          <div class="wishlist-grid">
            {#each lowPriority as wish}
              <div class="wish-card">
                <div class="wish-header">
                  <div class="wish-check" onclick={() => toggleComplete(wish)}>
                    <Icon name={wish.is_completed ? 'check' : 'sparkles'} size={20} />
                  </div>
                  <div class="wish-menu">
                    <button class="menu-btn" onclick={() => openEditModal(wish)}>
                      <Icon name="edit" size={16} />
                    </button>
                    <button class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)}>
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
            <span class="priority-badge" style="background:#F0FDF4;color:#22C55E">Tercapai</span>
          </h2>
          <div class="wishlist-grid">
            {#each completed as wish}
              <div class="wish-card wish-card--completed">
                <div class="wish-header">
                  <div class="wish-check wish-check--completed" onclick={() => toggleComplete(wish)}>
                    <Icon name="check" size={20} />
                  </div>
                  <div class="wish-menu">
                    <button class="menu-btn menu-btn--delete" onclick={() => deleteWishlist(wish.id)}>
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
    <div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showModal = false; }}>
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
            <label class="form-label">Nama Impian</label>
            <input
              type="text"
              bind:value={name}
              required
              placeholder="Contoh: Liburan ke Jepang"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi (opsional)</label>
            <textarea
              bind:value={description}
              placeholder="Detail impian..."
              class="form-input form-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Estimasi Harga (Rp, opsional)</label>
            <input
              type="number"
              bind:value={estimatedPrice}
              placeholder="0"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Prioritas</label>
            <select bind:value={priority} class="form-input">
              <option value={3}>🔥 Tinggi</option>
              <option value={2}>⭐ Sedang</option>
              <option value={1}>💭 Rendah</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Link ke Tabungan (opsional)</label>
            <select bind:value={linkedSavingId} class="form-input">
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
    padding: 26px 18px 18px;
    position: relative;
    flex-shrink: 0;
    font-family: 'Nunito', sans-serif;
  }
  .header-inner { position: relative; }
  .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
  .back-btn { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: #4772E8; padding: 0; margin-bottom: 10px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  .back-btn:hover { color: #2f5bb0; }
  .header-sub { font-size: 12px; color: #94A3B8; margin: 0 0 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .header-title { font-size: 24px; font-weight: 800; color: #1F2937; margin: 0; }

  .create-btn {
    background: #0B9E6B;
    color: #ffffff;
    border: 1px solid #0B9E6B;
    border-radius: 12px;
    padding: 10px 16px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.12s, background 0.2s;
    flex-shrink: 0;
  }
  .create-btn:hover { background: #059669; }
  .create-btn:active { transform: scale(0.96); }

  .body { padding: 18px 16px; }

  .loading-wrap { display: flex; justify-content: center; padding: 60px 0; }
  .spinner { width: 28px; height: 28px; border: 3px solid #E2E8F0; border-top-color: #5B8DEF; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-icon { margin-bottom: 14px; color: #94A3B8; display: flex; justify-content: center; }
  .empty-title { font-size: 16px; font-weight: 700; color: #1F2937; margin: 0 0 6px; }
  .empty-sub { font-size: 13px; color: #94A3B8; margin: 0 0 22px; }
  .empty-cta {
    background: #0B9E6B;
    color: white;
    border: 1px solid #0B9E6B;
    border-radius: 12px;
    padding: 13px 24px;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
  }
  .empty-cta:hover { background: #059669; }

  /* Priority Section */
  .priority-section { margin-bottom: 20px; }
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
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  /* Wish Card */
  .wish-card {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 1px 2px rgba(31,41,55,0.04);
    transition: transform 0.15s;
  }
  .wish-card--completed {
    background: #ffffff;
    border-color: rgba(16, 185, 129, 0.4);
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
    background: rgba(91, 141, 239, 0.1);
    color: #4772E8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .wish-check:active { transform: scale(0.85); }
  .wish-check--completed { background: rgba(16,185,129,0.1); color: #059669; }

  .wish-menu { display: flex; gap: 4px; }
  .menu-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(91, 141, 239,0.08);
    color: #64748B;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .menu-btn:hover { background: rgba(91, 141, 239,0.18); }
  .menu-btn--delete { background: rgba(239,68,68,0.1); color: #DC2626; }
  .menu-btn--delete:hover { background: rgba(239,68,68,0.18); }

  .wish-name {
    font-size: 13px;
    font-weight: 700;
    color: #1F2937;
    margin: 0 0 4px;
    line-height: 1.3;
  }

  .wish-desc {
    font-size: 11px;
    color: #64748B;
    font-weight: 600;
    margin: 0 0 6px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wish-price {
    font-size: 13px;
    font-weight: 700;
    color: #4772E8;
    margin: 0 0 6px;
  }

  .wish-saving {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #4772E8;
    font-weight: 600;
    background: rgba(91, 141, 239,0.1);
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
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255,255,255,0.8);
    border-radius: 28px 28px 0 0;
    width: 100%;
    max-width: 540px;
    padding: 20px 22px 40px;
    max-height: 85vh;
    overflow-y: auto;
    animation: slide-up 0.25s ease;
  }
  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .modal-handle { width: 44px; height: 5px; background: #E0E7FF; border-radius: 99px; margin: 0 auto 20px; }
  .modal-icon-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .modal-icon-circle {
    width: 50px; height: 50px; border-radius: 16px;
    background: #EFF6FF; color: #6BAFF2;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .modal-title { font-size: 17px; font-weight: 900; color: #1E293B; margin: 0 0 3px; }
  .modal-subtitle { font-size: 13px; color: #94A3B8; margin: 0; font-weight: 700; }

  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    padding: 13px 16px; border: 2px solid #E0E7FF; border-radius: 16px;
    font-size: 15px; font-weight: 700; color: #1E293B; font-family: 'Nunito', sans-serif;
    outline: none; background: #F8FAFC; transition: border-color 0.2s;
    width: 100%; box-sizing: border-box;
  }
  .form-input:focus { border-color: #6BAFF2; }
  .form-textarea { resize: none; min-height: 80px; }
  .modal-actions { display: flex; gap: 12px; padding-top: 4px; }
  .modal-cancel {
    flex: 1; padding: 14px; background: #F0F4FF; color: #94A3B8; border: none;
    border-radius: 16px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 800; cursor: pointer;
  }
  .modal-submit {
    flex: 2; padding: 14px;
    background: linear-gradient(135deg, #6BAFF2, #4F96E5);
    color: white; border: none; border-radius: 16px;
    font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 900; cursor: pointer;
    box-shadow: 0 6px 20px rgba(107,175,242,0.3); transition: transform 0.12s;
  }
  .modal-submit:active { transform: scale(0.97); }
</style>

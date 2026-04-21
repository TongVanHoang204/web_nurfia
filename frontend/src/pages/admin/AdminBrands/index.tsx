import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import './AdminBrands.css';

type Brand = {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    products?: number;
  };
};

type BrandFilter = 'all' | 'active' | 'inactive';
type BrandSort = 'manual' | 'name-asc' | 'name-desc' | 'products-desc';

const createEmptyFormState = () => ({
  name: '',
  slug: '',
  sortOrder: 0,
  isActive: true,
});

const toSlug = (value: string) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

export default function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<BrandFilter>('all');
  const [sortBy, setSortBy] = useState<BrandSort>('manual');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<Brand | null>(null);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState(createEmptyFormState);

  const { addToast, openConfirm } = useUIStore();

  const filteredBrands = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const nextBrands = brands.filter((brand) => {
      if (filter === 'active' && !brand.isActive) return false;
      if (filter === 'inactive' && brand.isActive) return false;

      if (!term) return true;
      const haystack = `${brand.name} ${brand.slug}`.toLowerCase();
      return haystack.includes(term);
    });

    const sortedBrands = [...nextBrands];
    if (sortBy === 'manual') {
      sortedBrands.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      return sortedBrands;
    }

    if (sortBy === 'name-asc') {
      sortedBrands.sort((a, b) => a.name.localeCompare(b.name));
      return sortedBrands;
    }

    if (sortBy === 'name-desc') {
      sortedBrands.sort((a, b) => b.name.localeCompare(a.name));
      return sortedBrands;
    }

    sortedBrands.sort((a, b) => (b._count?.products || 0) - (a._count?.products || 0) || a.name.localeCompare(b.name));
    return sortedBrands;
  }, [brands, filter, searchTerm, sortBy]);

  const fetchBrands = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/brands');
      setBrands(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (_err) {
      addToast('Failed to load brands', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const openCreateModal = () => {
    setCurrentBrand(null);
    setFormData(createEmptyFormState());
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (brand: Brand) => {
    setCurrentBrand(brand);
    setFormData({
      name: brand.name,
      slug: brand.slug,
      sortOrder: brand.sortOrder,
      isActive: brand.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentBrand(null);
    setFormError('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const name = String(formData.name || '').trim();
    const slug = toSlug(formData.slug || formData.name);

    if (!name) {
      setFormError('Brand name is required.');
      return;
    }

    if (!slug) {
      setFormError('Brand slug is required.');
      return;
    }

    if (!Number.isInteger(Number(formData.sortOrder)) || Number(formData.sortOrder) < 0) {
      setFormError('Sort order must be a non-negative integer.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const payload = {
      name,
      slug,
      sortOrder: Number(formData.sortOrder),
      isActive: Boolean(formData.isActive),
    };

    try {
      if (currentBrand) {
        await api.put(`/admin/brands/${currentBrand.id}`, payload);
        addToast('Brand updated successfully', 'success');
      } else {
        await api.post('/admin/brands', payload);
        addToast('Brand created successfully', 'success');
      }

      closeModal();
      fetchBrands();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save brand';
      setFormError(String(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (brand: Brand) => {
    try {
      await api.put(`/admin/brands/${brand.id}`, {
        name: brand.name,
        slug: brand.slug,
        sortOrder: brand.sortOrder,
        isActive: !brand.isActive,
      });

      setBrands((prev) => prev.map((item) => (
        item.id === brand.id
          ? { ...item, isActive: !item.isActive }
          : item
      )));
      addToast('Brand status updated', 'success');
    } catch (_err) {
      addToast('Failed to update brand status', 'error');
    }
  };

  const handleDelete = (brand: Brand) => {
    openConfirm({
      title: 'Delete Brand',
      message: `Delete brand "${brand.name}"?`,
      danger: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/brands/${brand.id}`);
          setBrands((prev) => prev.filter((item) => item.id !== brand.id));
          addToast('Brand deleted', 'success');
        } catch (err: any) {
          const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to delete brand';
          addToast(String(message), 'error');
        }
      },
    });
  };

  const activeCount = brands.filter((brand) => brand.isActive).length;
  const inactiveCount = Math.max(0, brands.length - activeCount);
  const totalAssignedProducts = brands.reduce((total, brand) => total + (brand._count?.products || 0), 0);
  const hasFilters = Boolean(searchTerm.trim()) || filter !== 'all' || sortBy !== 'manual';

  const resetFilters = () => {
    setSearchTerm('');
    setFilter('all');
    setSortBy('manual');
  };

  return (
    <div className="brands-admin-page">
      <section className="ap-card brands-hero-card">
        <div className="brands-hero-copy">
          <p className="brands-hero-overline">Catalog Setup</p>
          <h1 className="brands-hero-title">Brands Directory</h1>
          <p className="brands-admin-subtitle">Organize brand labels for storefront filters and product assignments.</p>
        </div>
        <div className="brands-hero-actions">
          <button className="admin-btn admin-btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Add Brand
          </button>
        </div>
      </section>

      <section className="brands-metrics-grid">
        <div className="ap-card brands-metric-card">
          <span className="brands-metric-label">Total Brands</span>
          <strong className="brands-metric-value">{brands.length}</strong>
        </div>
        <div className="ap-card brands-metric-card">
          <span className="brands-metric-label">Active</span>
          <strong className="brands-metric-value">{activeCount}</strong>
        </div>
        <div className="ap-card brands-metric-card">
          <span className="brands-metric-label">Inactive</span>
          <strong className="brands-metric-value">{inactiveCount}</strong>
        </div>
        <div className="ap-card brands-metric-card">
          <span className="brands-metric-label">Assigned Products</span>
          <strong className="brands-metric-value">{totalAssignedProducts}</strong>
        </div>
      </section>

      <section className="ap-card brands-controls-card">
        <div className="brands-controls-row">
          <div className="brands-search-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by brand name or slug"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <select
            title="Brand status filter"
            aria-label="Brand status filter"
            className="brands-filter-select"
            value={filter}
            onChange={(event) => setFilter(event.target.value as BrandFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            title="Brand sort"
            aria-label="Brand sort"
            className="brands-filter-select"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as BrandSort)}
          >
            <option value="manual">Sort: Manual</option>
            <option value="name-asc">Sort: Name A-Z</option>
            <option value="name-desc">Sort: Name Z-A</option>
            <option value="products-desc">Sort: Most Products</option>
          </select>
        </div>

        <div className="brands-controls-summary">
          <span>{filteredBrands.length} result(s)</span>
          {hasFilters && (
            <button type="button" className="admin-btn admin-btn-outline brands-reset-btn" onClick={resetFilters}>
              Reset Filters
            </button>
          )}
        </div>
      </section>

      <div className="ap-card brands-table-card">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : filteredBrands.length === 0 ? (
          <div className="brands-empty-state">No brands matched your search/filter.</div>
        ) : (
          <>
            <div className="brands-desktop-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>BRAND</th>
                    <th>SLUG</th>
                    <th>PRODUCTS</th>
                    <th>SORT</th>
                    <th>STATUS</th>
                    <th className="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBrands.map((brand) => (
                    <tr key={brand.id}>
                      <td>
                        <strong>{brand.name}</strong>
                      </td>
                      <td>
                        <span className="ap-text-muted">{brand.slug}</span>
                      </td>
                      <td>
                        <span className="brands-product-count">{brand._count?.products || 0}</span>
                      </td>
                      <td>{brand.sortOrder}</td>
                      <td>
                        <button
                          type="button"
                          className={`brands-status-chip ${brand.isActive ? 'is-active' : 'is-inactive'}`}
                          onClick={() => handleToggleActive(brand)}
                        >
                          {brand.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="text-right">
                        <div className="ap-btn-group brands-actions">
                          <button className="ap-action-btn" onClick={() => openEditModal(brand)} title="Edit Brand" aria-label="Edit Brand">
                            <Edit2 size={14} />
                          </button>
                          <button className="ap-action-btn ap-action-btn-danger" onClick={() => handleDelete(brand)} title="Delete Brand" aria-label="Delete Brand">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="brands-mobile-list">
              {filteredBrands.map((brand) => (
                <article key={brand.id} className="brands-mobile-item">
                  <div className="brands-mobile-main">
                    <h3>{brand.name}</h3>
                    <p>{brand.slug}</p>
                  </div>

                  <div className="brands-mobile-meta">
                    <span>Products: {brand._count?.products || 0}</span>
                    <span>Sort: {brand.sortOrder}</span>
                  </div>

                  <div className="brands-mobile-footer">
                    <button
                      type="button"
                      className={`brands-status-chip ${brand.isActive ? 'is-active' : 'is-inactive'}`}
                      onClick={() => handleToggleActive(brand)}
                    >
                      {brand.isActive ? 'Active' : 'Inactive'}
                    </button>

                    <div className="ap-btn-group brands-actions">
                      <button className="ap-action-btn" onClick={() => openEditModal(brand)} title="Edit Brand" aria-label="Edit Brand">
                        <Edit2 size={14} />
                      </button>
                      <button className="ap-action-btn ap-action-btn-danger" onClick={() => handleDelete(brand)} title="Delete Brand" aria-label="Delete Brand">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content brands-modal-content">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{currentBrand ? 'Edit Brand' : 'Add Brand'}</h2>
              <button className="admin-modal-close" onClick={closeModal} title="Close" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form className="admin-form" onSubmit={handleSave}>
              {formError && <div className="brands-form-error">{formError}</div>}

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Brand Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name: nextName,
                        slug: currentBrand ? prev.slug : toSlug(nextName),
                      }));
                    }}
                    placeholder="e.g. Calvin Klein"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label>Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(event) => setFormData((prev) => ({ ...prev, slug: toSlug(event.target.value) }))}
                    placeholder="e.g. calvin-klein"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    title="Sort Order"
                    aria-label="Sort Order"
                    value={formData.sortOrder}
                    onChange={(event) => setFormData((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))}
                  />
                </div>
                <div className="admin-form-group brands-active-toggle-wrap">
                  <label className="brands-active-toggle">
                    <input
                      type="checkbox"
                      title="Active"
                      aria-label="Active"
                      checked={formData.isActive}
                      onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={closeModal} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : currentBrand ? 'Save Changes' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy, Edit2, Filter, Plus, Search, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import './AdminCoupons.css';

type Coupon = {
  id: number;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number | string;
  minOrderValue?: number | string | null;
  maxDiscount?: number | string | null;
  usageLimit?: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
};

type CouponStats = {
  totalCoupons: number;
  activeCoupons: number;
  inactiveCoupons: number;
  expiredCoupons: number;
  scheduledCoupons: number;
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SCHEDULED';
type TypeFilter = 'ALL' | 'PERCENTAGE' | 'FIXED_AMOUNT';
type SortOption = 'NEWEST' | 'OLDEST' | 'CODE_ASC' | 'CODE_DESC' | 'VALUE_ASC' | 'VALUE_DESC' | 'USAGE_DESC' | 'ENDING_SOON';

type CouponForm = {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  minOrderValue: string;
  maxDiscount: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const createDefaultForm = (): CouponForm => ({
  code: '',
  type: 'PERCENTAGE',
  value: '',
  minOrderValue: '',
  maxDiscount: '',
  usageLimit: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  isActive: true,
});

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'â€”';
  return `$${Number(value).toFixed(2)}`;
};

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getCouponStatus = (coupon: Coupon) => {
  const now = Date.now();
  const startTime = new Date(coupon.startDate).getTime();
  const endTime = new Date(coupon.endDate).getTime();

  if (!coupon.isActive) return { label: 'Disabled', className: 'is-disabled' };
  if (endTime < now) return { label: 'Expired', className: 'is-expired' };
  if (startTime > now) return { label: 'Scheduled', className: 'is-scheduled' };
  return { label: 'Active', className: 'is-active' };
};

const applyValuePreset = (currentType: CouponForm['type'], value: number) => {
  if (currentType === 'PERCENTAGE') return String(value);
  return String(value * 5);
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats>({
    totalCoupons: 0,
    activeCoupons: 0,
    inactiveCoupons: 0,
    expiredCoupons: 0,
    scheduledCoupons: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const { addToast, openConfirm } = useUIStore();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NEWEST');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState<Coupon | null>(null);

  // Form state
  const [form, setForm] = useState<CouponForm>(createDefaultForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCoupons = (keyword = search) => {
    setIsLoading(true);
    const query = new URLSearchParams({
      sort: sortOption,
      ...(keyword ? { search: keyword } : {}),
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
    });

    api.get(`/admin/coupons?${query.toString()}`)
      .then((response) => {
        setCoupons(response.data.data || []);
        setStats(response.data.stats || {
          totalCoupons: 0,
          activeCoupons: 0,
          inactiveCoupons: 0,
          expiredCoupons: 0,
          scheduledCoupons: 0,
        });
        setSelectedIds([]);
      })
      .catch((error) => {
        console.error(error);
        addToast('Failed to load coupons', 'error');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCoupons(search);
  }, [statusFilter, typeFilter, sortOption]);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchInput.trim();
    setSearch(keyword);
    fetchCoupons(keyword);
  };

  const resetFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setSortOption('NEWEST');
    fetchCoupons('');
  };

  const handleDelete = async (id: number) => {
    openConfirm({
      title: 'Delete Coupon',
      message: 'Are you sure you want to delete this coupon?',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete('/admin/coupons/' + id);
          addToast('Coupon deleted', 'success');
          fetchCoupons();
        } catch { addToast('Failed to delete', 'error'); }
      }
    });
  };

  const updateCouponActive = async (couponId: number, nextActive: boolean) => {
    try {
      await api.put(`/admin/coupons/${couponId}/active`, { isActive: nextActive });
      addToast(`Coupon ${nextActive ? 'activated' : 'deactivated'}`, 'success');
      fetchCoupons();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to update coupon status', 'error');
    }
  };

  const applyBulkActive = async (nextActive: boolean) => {
    if (!selectedIds.length) {
      addToast('Select at least one coupon', 'info');
      return;
    }

    setIsBulkUpdating(true);
    try {
      await api.post('/admin/coupons/bulk-active', { ids: selectedIds, isActive: nextActive });
      addToast(`Selected coupons ${nextActive ? 'activated' : 'deactivated'}`, 'success');
      fetchCoupons();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to update selected coupons', 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const duplicateCoupon = (coupon: Coupon) => {
    setIsEditing(false);
    setCurrentCoupon(null);
    setForm({
      code: `${coupon.code}-COPY`,
      type: coupon.type,
      value: String(coupon.value),
      minOrderValue: coupon.minOrderValue ? String(coupon.minOrderValue) : '',
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : '',
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      isActive: coupon.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const copyCouponCode = async (couponCode: string) => {
    try {
      await navigator.clipboard.writeText(couponCode);
      addToast('Coupon code copied', 'success');
    } catch {
      addToast('Failed to copy coupon code', 'error');
    }
  };

  const toggleSelected = (couponId: number) => {
    setSelectedIds((current) => current.includes(couponId)
      ? current.filter((id) => id !== couponId)
      : [...current, couponId]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = coupons.map((coupon) => coupon.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentCoupon(null);
    setForm(createDefaultForm());
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setIsEditing(true);
    setCurrentCoupon(coupon);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minOrderValue: coupon.minOrderValue ? String(coupon.minOrderValue) : '',
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : '',
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      startDate: new Date(coupon.startDate).toISOString().slice(0, 10),
      endDate: new Date(coupon.endDate).toISOString().slice(0, 10),
      isActive: coupon.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.value) {
      setFormError('Code and value are required'); return;
    }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end <= start) {
      setFormError('End date must be after start date'); return;
    }

    const numValue = Number(form.value);
    if (numValue <= 0) {
      setFormError('Discount value must be greater than 0'); return;
    }

    if (form.type === 'PERCENTAGE' && numValue > 100) {
      setFormError('Percentage discount cannot exceed 100%'); return;
    }
    
    setIsSubmitting(true);
    setFormError('');
    
    const payload = {
      code: form.code.toUpperCase().trim(),
      type: form.type,
      value: Number(form.value),
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      isActive: form.isActive,
    };

    try {
      if (isEditing) {
        if (!currentCoupon) {
          setFormError('Coupon context is missing. Please reopen edit modal.');
          return;
        }
        await api.put('/admin/coupons/' + currentCoupon.id, payload);
        addToast('Coupon updated', 'success');
      } else {
        await api.post('/admin/coupons', payload);
        addToast('Coupon created', 'success');
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeFilterCount = useMemo(() => {
    return [search, statusFilter !== 'ALL', typeFilter !== 'ALL', sortOption !== 'NEWEST'].filter(Boolean).length;
  }, [search, statusFilter, typeFilter, sortOption]);

  const allVisibleSelected = coupons.length > 0 && coupons.every((coupon) => selectedIds.includes(coupon.id));

  return (
    <div className="coupons-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Coupons ({coupons.length})</h1>
          <p className="coupons-admin-subtitle">Manage promotions with smarter filtering, bulk actions, and quick coupon operations.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openAddModal}><Plus size={16} /> Add Coupon</button>
      </div>

      <div className="coupons-stats-grid">
        <article className="coupons-stat-card">
          <span>Total Coupons</span>
          <strong>{stats.totalCoupons}</strong>
        </article>
        <article className="coupons-stat-card">
          <span>Active</span>
          <strong>{stats.activeCoupons}</strong>
        </article>
        <article className="coupons-stat-card">
          <span>Scheduled</span>
          <strong>{stats.scheduledCoupons}</strong>
        </article>
        <article className="coupons-stat-card">
          <span>Expired</span>
          <strong>{stats.expiredCoupons}</strong>
        </article>
        <article className="coupons-stat-card">
          <span>Disabled</span>
          <strong>{stats.inactiveCoupons}</strong>
        </article>
      </div>

      <div className="admin-card coupons-toolbar-card">
        <form className="coupons-toolbar" onSubmit={handleSearch}>
          <div className="coupons-search-wrap">
            <Search size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by coupon code"
            />
          </div>

          <label className="coupons-select-wrap" aria-label="Filter coupon status">
            <Filter size={15} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="EXPIRED">Expired</option>
              <option value="INACTIVE">Disabled</option>
            </select>
          </label>

          <label className="coupons-select-wrap" aria-label="Filter coupon type">
            <Filter size={15} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
              <option value="ALL">All types</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
            </select>
          </label>

          <label className="coupons-select-wrap" aria-label="Sort coupons">
            <Filter size={15} />
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
              <option value="NEWEST">Sort: Newest</option>
              <option value="OLDEST">Sort: Oldest</option>
              <option value="CODE_ASC">Sort: Code A-Z</option>
              <option value="CODE_DESC">Sort: Code Z-A</option>
              <option value="VALUE_ASC">Sort: Value low-high</option>
              <option value="VALUE_DESC">Sort: Value high-low</option>
              <option value="USAGE_DESC">Sort: Most used</option>
              <option value="ENDING_SOON">Sort: Ending soon</option>
            </select>
          </label>

          <button type="submit" className="admin-btn admin-btn-primary">Search</button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={resetFilters}>Reset</button>

          {activeFilterCount > 0 && <span className="coupons-filter-chip">{activeFilterCount} filter(s)</span>}
        </form>
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content coupons-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{isEditing ? 'Edit Coupon' : 'Create Coupon'}</h3>
              <button title="Close" aria-label="Close modal" onClick={() => setIsModalOpen(false)} className="admin-modal-close"><X size={20} /></button>
            </div>

            {formError && (
              <div className="admin-page-error">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="admin-form coupons-modal-form">
              <div className="admin-modal-grid">
                <div className="admin-form-group">
                  <label htmlFor="code">Coupon Code *</label>
                  <input id="code" title="Coupon Code" placeholder="SUMMER20" type="text" value={form.code} onChange={e => setForm((prev) => ({ ...prev, code: e.target.value }))} required />
                </div>
                <label className="coupons-active-toggle" htmlFor="isActive">
                  <input id="isActive" title="Status" type="checkbox" checked={form.isActive} onChange={e => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  <span>Active Coupon</span>
                </label>
              </div>

              <div className="coupons-preset-row">
                <span>Quick value presets</span>
                <div className="coupons-preset-actions">
                  {[10, 15, 20, 30].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="admin-btn admin-btn-outline admin-btn-sm"
                      onClick={() => setForm((prev) => ({ ...prev, value: applyValuePreset(prev.type, preset) }))}
                    >
                      {form.type === 'PERCENTAGE' ? `${preset}%` : `$${preset * 5}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-modal-grid">
                <div className="admin-form-group">
                  <label htmlFor="type">Discount Type *</label>
                  <select id="type" title="Discount Type" value={form.type} onChange={e => setForm((prev) => ({ ...prev, type: e.target.value as CouponForm['type'] }))}>
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label htmlFor="value">Value *</label>
                  <input id="value" title="Value" placeholder="10" type="number" min="0" step="0.01" value={form.value} onChange={e => setForm((prev) => ({ ...prev, value: e.target.value }))} required />
                </div>
              </div>

              <div className="admin-modal-grid">
                <div className="admin-form-group">
                  <label htmlFor="minOrderValue">Min Order Value</label>
                  <input id="minOrderValue" title="Min Order Value" placeholder="Optional" type="number" min="0" step="0.01" value={form.minOrderValue} onChange={e => setForm((prev) => ({ ...prev, minOrderValue: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="maxDiscount">Max Discount</label>
                  <input id="maxDiscount" title="Max Discount" placeholder="Optional" type="number" min="0" step="0.01" value={form.maxDiscount} onChange={e => setForm((prev) => ({ ...prev, maxDiscount: e.target.value }))} />
                </div>
              </div>

              <div className="admin-modal-grid">
                <div className="admin-form-group">
                  <label htmlFor="usageLimit">Usage Limit</label>
                  <input id="usageLimit" title="Usage Limit" placeholder="Optional" type="number" min="1" value={form.usageLimit} onChange={e => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))} />
                </div>
                <div className="admin-form-group" />
              </div>

              <div className="admin-modal-grid">
                <div className="admin-form-group">
                  <label htmlFor="startDate">Start Date *</label>
                  <input id="startDate" title="Start Date" type="date" value={form.startDate} onChange={e => setForm((prev) => ({ ...prev, startDate: e.target.value }))} required />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="endDate">End Date *</label>
                  <input id="endDate" title="End Date" type="date" value={form.endDate} onChange={e => setForm((prev) => ({ ...prev, endDate: e.target.value }))} required />
                </div>
              </div>

              <div className="admin-modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="admin-btn admin-btn-outline">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="admin-btn admin-btn-primary">
                  {isSubmitting ? 'Saving...' : (isEditing ? 'Update Coupon' : 'Create Coupon')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-card coupons-list-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : (
          coupons.length === 0 ? (
            <p className="coupons-empty-state">No coupons found for this filter set.</p>
          ) : (
            <>
              <div className="coupons-sticky-actions">
                <label className="coupons-select-all">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                  <span>Select page ({coupons.length})</span>
                </label>

                <div className="coupons-bulk-actions">
                  <span className="coupons-selected-count">{selectedIds.length} selected</span>
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyBulkActive(true)} disabled={isBulkUpdating || selectedIds.length === 0}>
                    <Check size={13} /> Activate
                  </button>
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyBulkActive(false)} disabled={isBulkUpdating || selectedIds.length === 0}>
                    <X size={13} /> Deactivate
                  </button>
                </div>
              </div>

              <div className="coupons-list">
                {coupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  const usageRatio = coupon.usageLimit && coupon.usageLimit > 0
                    ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)
                    : 0;
                  const isSelected = selectedIds.includes(coupon.id);

                  return (
                    <article key={coupon.id} className={`coupons-row-card ${isSelected ? 'is-selected' : ''}`}>
                      <div className="coupons-row-main">
                        <label className="coupons-item-check">
                          <input type="checkbox" aria-label={`Select coupon ${coupon.code}`} checked={isSelected} onChange={() => toggleSelected(coupon.id)} />
                        </label>

                        <div className="coupons-code-col">
                          <h3>{coupon.code}</h3>
                          <p>{coupon.type === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'} â€¢ {coupon.type === 'PERCENTAGE' ? `${Number(coupon.value)}%` : formatCurrency(coupon.value)}</p>
                        </div>

                        <div className="coupons-conditions-col">
                          <span>Min order: {formatCurrency(coupon.minOrderValue)}</span>
                          <span>Max discount: {formatCurrency(coupon.maxDiscount)}</span>
                        </div>

                        <div className="coupons-usage-col">
                          <span>{coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' uses'}</span>
                          {coupon.usageLimit ? (
                            <meter min={0} max={100} value={usageRatio} className="coupons-usage-meter" aria-label="Coupon usage progress" />
                          ) : (
                            <small>No limit</small>
                          )}
                        </div>

                        <div className="coupons-date-col">
                          <span>{formatDate(coupon.startDate)} - {formatDate(coupon.endDate)}</span>
                          <small>Created {formatDate(coupon.createdAt)}</small>
                        </div>

                        <div className="coupons-status-col">
                          <span className={`coupons-status-pill ${status.className}`}>{status.label}</span>
                        </div>
                      </div>

                      <div className="coupons-row-actions">
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => copyCouponCode(coupon.code)}>
                          <Copy size={13} /> Copy
                        </button>
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => duplicateCoupon(coupon)}>
                          <Plus size={13} /> Duplicate
                        </button>
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEditModal(coupon)}>
                          <Edit2 size={13} /> Edit
                        </button>
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => updateCouponActive(coupon.id, !coupon.isActive)}>
                          {coupon.isActive ? <><X size={13} /> Disable</> : <><Check size={13} /> Enable</>}
                        </button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(coupon.id)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}


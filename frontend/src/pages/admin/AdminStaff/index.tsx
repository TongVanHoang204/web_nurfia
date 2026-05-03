import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Filter, Pencil, Plus, Search, Shield, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import './AdminStaff.css';

const PERMISSION_OPTIONS = [
  'MANAGE_BANNERS',
  'MANAGE_PRODUCTS',
  'MANAGE_INVENTORY',
  'MANAGE_CATEGORIES',
  'MANAGE_ORDERS',
  'MANAGE_CUSTOMERS',
  'MANAGE_REVIEWS',
  'MANAGE_STAFF',
  'VIEW_REPORTS',
  'MANAGE_COUPONS',
  'MANAGE_SHIPPING',
  'MANAGE_CONTACTS',
  'VIEW_ACTIVITY_LOGS',
  'MANAGE_SETTINGS',
  'MANAGE_BLOG'
];

type TeamRole = 'STAFF' | 'MANAGER';

const ROLE_DEFAULT_PERMISSIONS: Record<TeamRole, string[]> = {
  STAFF: ['MANAGE_ORDERS', 'MANAGE_CUSTOMERS', 'MANAGE_CONTACTS', 'MANAGE_REVIEWS'],
  MANAGER: [
    'MANAGE_BANNERS',
    'MANAGE_PRODUCTS',
    'MANAGE_INVENTORY',
    'MANAGE_CATEGORIES',
    'MANAGE_ORDERS',
    'MANAGE_CUSTOMERS',
    'MANAGE_REVIEWS',
    'VIEW_REPORTS',
    'MANAGE_COUPONS',
    'MANAGE_SHIPPING',
    'MANAGE_BLOG',
    'MANAGE_CONTACTS',
    'VIEW_ACTIVITY_LOGS',
  ],
};

const PERMISSION_PRESETS: Record<string, { label: string; permissions: string[] }> = {
  STAFF_DEFAULT: {
    label: 'Staff Default',
    permissions: ROLE_DEFAULT_PERMISSIONS.STAFF,
  },
  MANAGER_DEFAULT: {
    label: 'Manager Default',
    permissions: ROLE_DEFAULT_PERMISSIONS.MANAGER,
  },
  SALES: {
    label: 'Sales Ops',
    permissions: ['MANAGE_ORDERS', 'MANAGE_CUSTOMERS', 'MANAGE_COUPONS', 'MANAGE_SHIPPING'],
  },
  CATALOG: {
    label: 'Catalog Ops',
    permissions: ['MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'MANAGE_CATEGORIES', 'MANAGE_BANNERS', 'MANAGE_BLOG'],
  },
  SUPPORT: {
    label: 'Support',
    permissions: ['MANAGE_CONTACTS', 'MANAGE_REVIEWS', 'VIEW_ACTIVITY_LOGS'],
  },
};

type StaffMember = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StaffStats = {
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  staffCount?: number;
  managerCount?: number;
};

type StaffStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type StaffSortOption = 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'NAME_DESC' | 'UPDATED_DESC';

const formatDate = (value: string) => {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatPermissionLabel = (permission: string) => {
  return permission.replace('MANAGE_', '').replace('VIEW_', '').split('_').join(' ').toLowerCase();
};

const getPageNumbers = (current: number, total: number) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: number[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push(-1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  if (end < total - 1) pages.push(-2);
  pages.push(total);

  return pages;
};

export default function AdminStaff() {
  const [staffs, setStaffs] = useState<StaffMember[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<StaffStats>({ totalStaff: 0, activeStaff: 0, inactiveStaff: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>('ALL');
  const [sortOption, setSortOption] = useState<StaffSortOption>('NEWEST');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'STAFF' as TeamRole,
    permissions: [] as string[],
    isActive: true
  });

  const { addToast } = useUIStore();

  const fetchStaffs = (page = 1, keyword = search) => {
    setIsLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      limit: '20',
      sort: sortOption,
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      ...(keyword ? { search: keyword } : {}),
    });

    api.get(`/admin/staffs?${query.toString()}`)
      .then((response) => {
        const responseData = response.data;
        setStaffs(responseData.data || []);
        setPagination(responseData.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        setStats(responseData.stats || { totalStaff: 0, activeStaff: 0, inactiveStaff: 0 });
        setSelectedIds([]);
      })
      .catch((error) => {
        console.error(error);
        addToast('Failed to load staff list', 'error');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStaffs(1, search);
  }, [statusFilter, sortOption]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchInput.trim();
    setSearch(keyword);
    fetchStaffs(1, keyword);
  };

  const resetFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('ALL');
    setSortOption('NEWEST');
    fetchStaffs(1, '');
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: '',
      role: 'STAFF',
      permissions: ROLE_DEFAULT_PERMISSIONS.STAFF,
      isActive: true,
    });
    setEditingStaff(null);
    setIsModalOpen(false);
  };

  const handleOpenModal = (staff: StaffMember | null = null) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        username: staff.username,
        email: staff.email,
        password: '',
        fullName: staff.fullName,
        role: staff.role === 'MANAGER' ? 'MANAGER' : 'STAFF',
        permissions: (staff.permissions as string[]) || [],
        isActive: staff.isActive
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        const { username, email, ...updateData } = formData;
        await api.put(`/admin/staffs/${editingStaff.id}`, updateData);
        addToast('Staff updated', 'success');
      } else {
        await api.post('/admin/staffs', formData);
        addToast('Staff created', 'success');
      }
      resetForm();
      fetchStaffs(pagination.page);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to save staff', 'error');
    }
  };

  const handleDelete = async (id: number, role: string) => {
    if (role === 'ADMIN') {
       addToast('Cannot delete an ADMIN account', 'error');
       return;
    }
    if (!window.confirm('Delete this staff member?')) return;
    try {
      await api.delete(`/admin/staffs/${id}`);
      addToast('Deleted', 'success');
      fetchStaffs(pagination.page);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Deletion failed', 'error');
    }
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const applyPermissionPreset = (presetKey: string) => {
    const preset = PERMISSION_PRESETS[presetKey];
    if (!preset) return;

    setFormData((prev) => ({
      ...prev,
      permissions: [...preset.permissions],
    }));
  };

  const toggleSelected = (staffId: number) => {
    const target = staffs.find((staff) => staff.id === staffId);
    if (!target || target.role === 'ADMIN') return;

    setSelectedIds((current) => current.includes(staffId)
      ? current.filter((id) => id !== staffId)
      : [...current, staffId]);
  };

  const toggleSelectAllVisible = () => {
    const currentIds = staffs.filter((staff) => staff.role !== 'ADMIN').map((staff) => staff.id);
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) => current.filter((id) => !currentIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...currentIds])));
  };

  const applyBulkStatus = async (nextActive: boolean) => {
    const updatableIds = selectedIds.filter((id) => {
      const target = staffs.find((staff) => staff.id === id);
      return target?.role !== 'ADMIN';
    });

    if (!updatableIds.length) {
      addToast('Select at least one staff account', 'info');
      return;
    }

    setIsBulkUpdating(true);
    try {
      await Promise.all(updatableIds.map((id) => api.put(`/admin/staffs/${id}`, { isActive: nextActive })));
      addToast(`Selected accounts ${nextActive ? 'activated' : 'deactivated'}`, 'success');
      fetchStaffs(pagination.page);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to update selected staff accounts', 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const pageNumbers = useMemo(() => getPageNumbers(pagination.page, pagination.totalPages), [pagination.page, pagination.totalPages]);
  const selectableStaffIds = useMemo(
    () => staffs.filter((staff) => staff.role !== 'ADMIN').map((staff) => staff.id),
    [staffs],
  );
  const allVisibleSelected = selectableStaffIds.length > 0 && selectableStaffIds.every((id) => selectedIds.includes(id));

  return (
    <div className="staff-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Staff Management ({pagination.total})</h1>
          <p className="staff-admin-subtitle">Manage admin team permissions, account status, and security from one place.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={16} /> New Staff
        </button>
      </div>

      <div className="staff-stats-grid">
        <article className="staff-stat-card">
          <span>Total Staff</span>
          <strong>{stats.totalStaff}</strong>
        </article>
        <article className="staff-stat-card">
          <span>Active Accounts</span>
          <strong>{stats.activeStaff}</strong>
        </article>
        <article className="staff-stat-card">
          <span>Inactive Accounts</span>
          <strong>{stats.inactiveStaff}</strong>
        </article>
        <article className="staff-stat-card">
          <span>Selected</span>
          <strong>{selectedIds.length}</strong>
        </article>
      </div>

      <div className="admin-card staff-toolbar-card">
        <form className="staff-toolbar" onSubmit={handleSearch}>
          <div className="staff-search-wrap">
            <Search size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, username, or email"
            />
          </div>

          <label className="staff-select-wrap" aria-label="Filter staff status">
            <Filter size={15} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StaffStatusFilter)}>
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active only</option>
              <option value="INACTIVE">Inactive only</option>
            </select>
          </label>

          <label className="staff-select-wrap" aria-label="Sort staff list">
            <Filter size={15} />
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value as StaffSortOption)}>
              <option value="NEWEST">Sort: Newest</option>
              <option value="OLDEST">Sort: Oldest</option>
              <option value="NAME_ASC">Sort: Name A-Z</option>
              <option value="NAME_DESC">Sort: Name Z-A</option>
              <option value="UPDATED_DESC">Sort: Recently updated</option>
            </select>
          </label>

          <button type="submit" className="admin-btn admin-btn-primary">Search</button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={resetFilters}>Reset</button>
        </form>
      </div>

      <div className="admin-card staff-list-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : staffs.length === 0 ? (
          <p className="staff-empty-state">No staff accounts found for this filter set.</p>
        ) : (
          <>
            <div className="staff-sticky-actions">
              <label className="staff-select-all">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                <span>Select page ({staffs.length})</span>
              </label>

              <div className="staff-bulk-actions">
                <span className="staff-selected-count">{selectedIds.length} selected</span>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyBulkStatus(true)} disabled={isBulkUpdating || selectedIds.length === 0}>
                  <Check size={13} /> Activate
                </button>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyBulkStatus(false)} disabled={isBulkUpdating || selectedIds.length === 0}>
                  <X size={13} /> Deactivate
                </button>
              </div>
            </div>

            <div className="staff-list">
              {staffs.map((staff) => {
                const isSelected = selectedIds.includes(staff.id);
                const isAdminAccount = staff.role === 'ADMIN';
                const visiblePermissions = staff.permissions.slice(0, 4);
                const hiddenPermissionCount = Math.max(0, staff.permissions.length - visiblePermissions.length);

                return (
                  <article key={staff.id} className={`staff-row-card ${isSelected ? 'is-selected' : ''}`}>
                    <div className="staff-row-main">
                      <label className="staff-item-check">
                        <input
                          type="checkbox"
                          aria-label={`Select ${staff.fullName}`}
                          title={isAdminAccount ? 'Admin accounts are read-only in this screen' : undefined}
                          disabled={isAdminAccount}
                          checked={isSelected}
                          onChange={() => toggleSelected(staff.id)}
                        />
                      </label>

                      <div className="staff-identity-col">
                        <h3>{staff.fullName}</h3>
                        <p>{staff.email}</p>
                        <small>@{staff.username}</small>
                      </div>

                      <div className="staff-role-col">
                        <span className="staff-role-pill">{staff.role}</span>
                        <span className={`staff-status-pill ${staff.isActive ? 'is-active' : 'is-inactive'}`}>
                          {staff.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="staff-permissions-col">
                        <div className="staff-permission-chips">
                          {visiblePermissions.map((permission) => (
                            <span key={permission} className="staff-permission-chip">
                              <Shield size={12} /> {formatPermissionLabel(permission)}
                            </span>
                          ))}
                          {hiddenPermissionCount > 0 && <span className="staff-permission-chip is-muted">+{hiddenPermissionCount}</span>}
                        </div>
                      </div>

                      <div className="staff-date-col">
                        <span>Joined {formatDate(staff.createdAt)}</span>
                        <small>Updated {formatDate(staff.updatedAt)}</small>
                      </div>
                    </div>

                    <div className="staff-row-actions">
                      <button
                        className="admin-btn admin-btn-outline admin-btn-sm"
                        onClick={() => handleOpenModal(staff)}
                        disabled={isAdminAccount}
                        title={isAdminAccount ? 'Admin accounts are read-only in this screen' : undefined}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        className="admin-btn admin-btn-outline admin-btn-sm"
                        disabled={isAdminAccount}
                        title={isAdminAccount ? 'Admin accounts are read-only in this screen' : undefined}
                        onClick={() => api.put(`/admin/staffs/${staff.id}`, { isActive: !staff.isActive }).then(() => {
                          addToast(`Account ${!staff.isActive ? 'activated' : 'deactivated'}`, 'success');
                          fetchStaffs(pagination.page);
                        }).catch((error: any) => addToast(error.response?.data?.message || 'Failed to update account status', 'error'))}
                      >
                        {staff.isActive ? <><X size={13} /> Disable</> : <><Check size={13} /> Enable</>}
                      </button>
                      <button
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        onClick={() => handleDelete(staff.id, staff.role)}
                        disabled={isAdminAccount}
                        title={isAdminAccount ? 'Admin accounts cannot be deleted' : undefined}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {pagination.totalPages > 1 && (
          <div className="staff-pagination-wrap">
            <div className="staff-pagination-text">
              Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong>{pagination.total}</strong> staff accounts
            </div>
            <div className="staff-pagination">
              <button className="staff-page-btn staff-page-arrow" onClick={() => fetchStaffs(pagination.page - 1)} disabled={pagination.page === 1}>
                &lsaquo;
              </button>
              {pageNumbers.map((page, index) => page < 0 ? (
                <span key={`ellipsis-${index}`} className="staff-page-ellipsis">...</span>
              ) : (
                <button key={page} className={`staff-page-btn ${page === pagination.page ? 'is-active' : ''}`} onClick={() => fetchStaffs(page)}>
                  {page}
                </button>
              ))}
              <button className="staff-page-btn staff-page-arrow" onClick={() => fetchStaffs(pagination.page + 1)} disabled={pagination.page === pagination.totalPages}>
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content staff-modal-content">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingStaff ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={resetForm} className="admin-modal-close" aria-label="Close" title="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form staff-modal-form">
              <div className="admin-form-group">
                <label htmlFor="staffFullName">Full Name</label>
                <input id="staffFullName" type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              </div>

              <div className="admin-modal-grid">
                <div className="admin-form-group">
                  <label htmlFor="staffUsername">Username</label>
                  <input id="staffUsername" type="text" required disabled={!!editingStaff} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="staffEmail">Email</label>
                  <input id="staffEmail" type="email" required disabled={!!editingStaff} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="staffRole">Role</label>
                <select
                  id="staffRole"
                  value={formData.role}
                  onChange={(event) => {
                    const nextRole = event.target.value as TeamRole;
                    setFormData((prev) => ({
                      ...prev,
                      role: nextRole,
                      permissions: ROLE_DEFAULT_PERMISSIONS[nextRole],
                    }));
                  }}
                >
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label htmlFor="staffPassword">{editingStaff ? 'New Password (optional)' : 'Password'}</label>
                <input id="staffPassword" type="password" required={!editingStaff} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>

              <div className="admin-form-group">
                <label>Permissions Overview</label>
                <div className="staff-permission-presets">
                  {Object.entries(PERMISSION_PRESETS).map(([presetKey, preset]) => (
                    <button key={presetKey} type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyPermissionPreset(presetKey)}>
                      {preset.label}
                    </button>
                  ))}
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setFormData((prev) => ({ ...prev, permissions: [] }))}>
                    Clear
                  </button>
                </div>

                <div className="staff-permission-grid">
                  {PERMISSION_OPTIONS.map(perm => (
                    <label key={perm} htmlFor={`perm-${perm}`} className="staff-permission-option">
                      <input
                        id={`perm-${perm}`}
                        type="checkbox"
                        checked={formData.permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                      />
                      <span>{formatPermissionLabel(perm)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label htmlFor="isActive" className="staff-account-toggle">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                <span>Account Active</span>
              </label>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={resetForm}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary">{editingStaff ? 'Save Changes' : 'Create Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


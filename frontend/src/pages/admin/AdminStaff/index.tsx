import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Crown, Eye, Pencil, Plus, Search, Shield, X } from 'lucide-react';
import api from '../../../api/client';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { useAdminConfirm } from '../../../components/AdminConfirmDialog/AdminConfirmDialog';
import StaffEditor from './StaffEditor';
import StaffActions from './StaffActions';
import { assignableRoles, canManageMember, formatDate, fullAccess, permissionLabel } from './staffModel';
import type { StaffForm, StaffMember } from './staffModel';
import './AdminStaff.css';

type Query = { page: number; search: string; role: string; status: string; sort: string };
const defaultQuery: Query = { page: 1, search: '', role: 'ALL', status: 'ALL', sort: 'NEWEST' };

export default function AdminStaff() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const { confirm, dialog: confirmDialog } = useAdminConfirm();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [query, setQuery] = useState(defaultQuery);
  const [keyword, setKeyword] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState({ totalStaff: 0, activeStaff: 0, inactiveStaff: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [editor, setEditor] = useState<StaffMember | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  useEffect(() => {
    const sequence = ++requestSequence.current;
    let cancelled = false;
    setLoading(true); setLoadError(false);
    const parameters = new URLSearchParams({ page: String(query.page), limit: '20', sort: query.sort,
      ...(query.search ? { search: query.search } : {}), ...(query.role !== 'ALL' ? { role: query.role } : {}),
      ...(query.status !== 'ALL' ? { status: query.status } : {}) });
    api.get(`/admin/staffs?${parameters}`).then(response => {
      if (cancelled || sequence !== requestSequence.current) return;
      const data = response.data;
      const next = data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };
      if (query.page > Math.max(1, next.totalPages)) { setQuery(current => ({ ...current, page: Math.max(1, next.totalPages) })); return; }
      setMembers(data.data || []); setStats(data.stats || { totalStaff: 0, activeStaff: 0, inactiveStaff: 0 });
      setPagination(next); setSelected([]);
    }).catch(() => { if (!cancelled && sequence === requestSequence.current) setLoadError(true); })
      .finally(() => { if (!cancelled && sequence === requestSequence.current) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, refresh]);

  const editableIds = members.filter(member => canManageMember(user, member)).map(member => member.id);
  const allSelected = editableIds.length > 0 && editableIds.every(id => selected.includes(id));
  const reload = () => setRefresh(value => value + 1);
  const save = async (form: StaffForm) => {
    if (editor) {
      const data: Partial<StaffForm> = {};
      if (form.fullName !== editor.fullName) data.fullName = form.fullName;
      if (form.role !== editor.role) data.role = form.role;
      if (JSON.stringify([...form.permissions].sort()) !== JSON.stringify([...editor.permissions].sort())) data.permissions = form.permissions;
      if (form.isActive !== editor.isActive) data.isActive = form.isActive;
      if (form.password) data.password = form.password;
      await api.put(`/admin/staffs/${editor.id}`, data);
    } else await api.post('/admin/staffs', form);
    addToast(editor ? 'Staff updated' : 'Staff created', 'success');
    setEditor(undefined); reload();
  };
  const changeStatus = async (member: StaffMember) => {
    if (!canManageMember(user, member) || busy) return;
    if (member.isActive && !await confirm({ title: `Disable ${member.fullName}?`, message: 'Existing sessions will be revoked. This member can sign in again after you enable their account.', confirmText: 'Disable account', tone: 'danger' })) return;
    setBusy(true);
    try { await api.put(`/admin/staffs/${member.id}`, { isActive: !member.isActive }); addToast(member.isActive ? 'Account disabled' : 'Account enabled', 'success'); reload(); }
    catch { addToast('Unable to update account status', 'error'); }
    finally { setBusy(false); }
  };
  const remove = async (member: StaffMember) => {
    if (!canManageMember(user, member) || busy) return;
    if (!await confirm({ title: `Delete ${member.fullName}?`, message: 'This permanently deletes the account. Disable it instead if you only want to stop access.', confirmText: 'Delete account', tone: 'danger' })) return;
    setBusy(true);
    try { await api.delete(`/admin/staffs/${member.id}`); addToast('Account deleted', 'success'); reload(); }
    catch { addToast('Unable to delete this account', 'error'); }
    finally { setBusy(false); }
  };
  const bulkStatus = async (isActive: boolean) => {
    const ids = selected.filter(id => editableIds.includes(id));
    if (!ids.length || busy) return;
    if (!isActive && !await confirm({ title: `Disable ${ids.length} accounts?`, message: 'These members will be signed out and lose access until their accounts are enabled.', confirmText: 'Disable accounts', tone: 'danger' })) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(ids.map(id => api.put(`/admin/staffs/${id}`, { isActive })));
      const successes = results.filter(result => result.status === 'fulfilled').length;
      const failed = ids.length - successes;
      addToast(failed ? `${successes} updated; ${failed} could not be updated. Please review the list.` : `${successes} accounts ${isActive ? 'enabled' : 'disabled'}.`, failed ? 'error' : 'success');
      reload();
    } finally { setBusy(false); }
  };
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  if (!user) return null;
  return (
    <div className="staff-admin-page">
      <div className="admin-page-header"><div><h1 className="admin-page-title">Staff Management</h1><p className="staff-admin-subtitle">Your team, their responsibilities and access.</p></div>
        {assignableRoles(user).length > 0 && <button className="admin-btn admin-btn-primary" onClick={() => setEditor(null)}><Plus size={16} />New Staff</button>}
      </div>
      <div className="staff-stats-grid">{[{ label: 'Team members', value: stats.totalStaff }, { label: 'Active accounts', value: stats.activeStaff }, { label: 'Disabled accounts', value: stats.inactiveStaff }].map(stat => <article className="staff-stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></article>)}</div>
      <div className="admin-card staff-team-card">
        <form className="staff-toolbar" onSubmit={event => { event.preventDefault(); setQuery({ ...query, page: 1, search: keyword.trim() }); }}>
          <label className="staff-search-wrap"><Search size={17} /><input aria-label="Search team" placeholder="Search name, username or email" value={keyword} onChange={event => setKeyword(event.target.value)} maxLength={120} /></label>
          <select aria-label="Filter role" value={query.role} onChange={e => setQuery({ ...query, page: 1, role: e.target.value })}><option value="ALL">All roles</option><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="STAFF">Staff</option></select>
          <select aria-label="Filter status" value={query.status} onChange={e => setQuery({ ...query, page: 1, status: e.target.value })}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Disabled</option></select>
          <select aria-label="Sort team" value={query.sort} onChange={e => setQuery({ ...query, page: 1, sort: e.target.value })}><option value="NEWEST">Newest first</option><option value="NAME_ASC">Name A–Z</option><option value="UPDATED_DESC">Recently updated</option></select>
          <button className="admin-btn admin-btn-primary" type="submit">Search</button>
          {(query.search || query.role !== 'ALL' || query.status !== 'ALL' || query.sort !== 'NEWEST') && <button type="button" className="staff-reset-button" onClick={() => { setKeyword(''); setQuery(defaultQuery); }}>Reset</button>}
        </form>
        <div className="staff-selection-bar"><label><input type="checkbox" aria-label="Select manageable accounts on this page" disabled={busy || loading || !editableIds.length} checked={allSelected} onChange={() => setSelected(allSelected ? [] : [...editableIds])} /><span>{selected.length ? `${selected.length} selected` : `${pagination.total} team members`}</span></label>
          {selected.length > 0 ? <div><button className="admin-btn admin-btn-outline admin-btn-sm" disabled={busy} onClick={() => void bulkStatus(true)}><Check size={13} />Enable</button><button className="admin-btn admin-btn-outline admin-btn-sm" disabled={busy} onClick={() => void bulkStatus(false)}><X size={13} />Disable</button><button className="staff-reset-button" disabled={busy} onClick={() => setSelected([])}>Clear selection</button></div> : <span className="staff-muted">Select members for bulk actions</span>}
        </div>
        {loadError ? <div className="staff-empty-state" role="alert"><p>Unable to load the team.</p><button className="admin-btn admin-btn-outline" onClick={reload}>Try again</button></div> : loading ? <div className="loading-page" aria-label="Loading team"><div className="spinner" /></div> : !members.length ? <div className="staff-empty-state"><Shield size={28} /><h3>No team members found</h3><p>Try another search or reset your filters.</p><button className="admin-btn admin-btn-outline" onClick={() => { setKeyword(''); setQuery(defaultQuery); }}>Reset filters</button></div> :
          <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th className="staff-checkbox-cell" aria-label="Selection" /><th>Team member</th><th>Role</th><th>Access</th><th>Status</th><th>Joined</th><th className="staff-action-heading">Actions</th></tr></thead><tbody>{members.map(member => {
            const manageable = canManageMember(user, member);
            return <tr key={member.id} className={selected.includes(member.id) ? 'is-selected' : ''}>
              <td className="staff-checkbox-cell"><input type="checkbox" aria-label={`Select ${member.fullName}`} checked={selected.includes(member.id)} disabled={!manageable || busy} onChange={() => toggle(member.id)} /></td>
              <td className="staff-identity-cell"><span className="staff-avatar">{member.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{member.fullName}</strong><span>{member.email}</span><small>@{member.username}{member.id === user.id ? ' · You' : ''}</small></div></td>
              <td data-label="Role"><span className={`staff-role-pill staff-role-${member.role.toLowerCase()}`}>{member.role === 'OWNER' && <Crown size={13} />}{member.role}</span></td>
              <td data-label="Access"><button className="staff-access-button" onClick={() => setEditor(member)} title={fullAccess(member.role) ? 'All admin modules' : member.permissions.map(permissionLabel).join(', ')}>{fullAccess(member.role) ? 'Full access' : `${member.permissions.length} modules`}<span>{fullAccess(member.role) ? member.role === 'OWNER' ? 'Store ownership' : 'Administration' : member.permissions.slice(0, 2).map(permissionLabel).join(', ') || 'Dashboard only'}</span></button></td>
              <td data-label="Status"><span className={`staff-status-pill ${member.isActive ? 'is-active' : 'is-inactive'}`}><i />{member.isActive ? 'Active' : 'Disabled'}</span></td>
              <td data-label="Joined" className="staff-date-cell">{formatDate(member.createdAt)}</td>
              <td className="staff-row-actions"><button className="staff-icon-button" aria-label={`${manageable ? 'Edit' : 'View'} ${member.fullName}`} title={manageable ? 'Edit account' : 'View account'} disabled={busy} onClick={() => setEditor(member)}>{manageable ? <Pencil size={16} /> : <Eye size={16} />}</button>
                {manageable && <StaffActions name={member.fullName} active={member.isActive} disabled={busy} onStatus={() => void changeStatus(member)} onDelete={() => void remove(member)} />}
              </td>
            </tr>;
          })}</tbody></table></div>}
        {!loading && !loadError && pagination.total > 0 && <div className="staff-pagination-wrap"><span>Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span><div><button className="staff-icon-button" aria-label="Previous page" disabled={query.page === 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}><ChevronLeft size={17} /></button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span><button className="staff-icon-button" aria-label="Next page" disabled={query.page >= pagination.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}><ChevronRight size={17} /></button></div></div>}
      </div>
      {editor !== undefined && <StaffEditor key={editor?.id || 'new'} member={editor} actor={user} editable={editor ? canManageMember(user, editor) : assignableRoles(user).length > 0} onSave={save} onClose={() => setEditor(undefined)} confirmDiscard={() => confirm({ title: 'Discard unsaved changes?', message: 'Your changes have not been saved.', confirmText: 'Discard changes', tone: 'danger' })} />}
      {confirmDialog}
    </div>
  );
}

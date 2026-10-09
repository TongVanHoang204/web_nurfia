import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check, Clock, Shield, X } from 'lucide-react';
import api from '../../../api/client';
import { assignableRoles, canAssignPermission, formatDate, fullAccess, PERMISSIONS, permissionLabel, PRESETS, ROLE_DEFAULTS } from './staffModel';
import type { StaffForm, StaffHistory, StaffMember, TeamRole, TeamUser } from './staffModel';

type Props = {
  member: StaffMember | null; actor: TeamUser; editable: boolean;
  onSave: (form: StaffForm) => Promise<void>; onClose: () => void;
  confirmDiscard: () => Promise<boolean>;
};
const historyLabels: Record<string, string> = { fullName: 'Name', role: 'Role', permissions: 'Permissions', isActive: 'Status', username: 'Username', email: 'Email' };
const historyValue = (key: string, value: unknown) => key === 'isActive' ? value ? 'Active' : 'Disabled'
  : Array.isArray(value) ? value.map(item => permissionLabel(String(item))).join(', ') || 'No permissions' : String(value ?? '—');

export default function StaffEditor({ member, actor, editable, onSave, onClose, confirmDiscard }: Props) {
  const initial: StaffForm = member ? {
    username: member.username, email: member.email, fullName: member.fullName, password: '',
    role: member.role === 'OWNER' ? 'ADMIN' : member.role as TeamRole, permissions: [...member.permissions], isActive: member.isActive,
  } : { username: '', email: '', fullName: '', password: '', role: 'STAFF',
    permissions: ROLE_DEFAULTS.STAFF.filter(p => canAssignPermission(actor, p)), isActive: true };
  const [form, setForm] = useState<StaffForm>(initial);
  const original = useRef(JSON.stringify(initial));
  const [tab, setTab] = useState('Information');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<StaffHistory[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [retry, setRetry] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(form) !== original.current;
  const roles = assignableRoles(actor);
  const permitted = PERMISSIONS.filter(p => canAssignPermission(actor, p.value));
  const tabs = member ? ['Information', 'Permissions', 'History'] : ['Information', 'Permissions'];
  const close = async () => {
    if (saving || confirming) return;
    if (dirty) {
      setConfirming(true);
      const discard = await confirmDiscard();
      setConfirming(false);
      if (!discard) return;
    }
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  useEffect(() => {
    if (confirming) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); void closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') || [])
        .filter(element => !element.closest('[hidden]'));
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [confirming]);
  useEffect(() => {
    if (tab !== 'History' || !member) return;
    let cancelled = false;
    setHistory(null); setHistoryError('');
    api.get(`/admin/staffs/${member.id}/history`).then(response => {
      if (!cancelled) setHistory(response.data.data || []);
    }).catch(() => { if (!cancelled) setHistoryError('Unable to load account history.'); });
    return () => { cancelled = true; };
  }, [member, tab, retry]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !editable) return;
    setSaving(true); setError('');
    try { await onSave(form); }
    catch (cause: unknown) {
      const responseError = cause as { response?: { data?: { message?: string } } };
      setError(responseError.response?.data?.message || 'Unable to save changes. Please try again.');
    } finally { setSaving(false); }
  };
  const selected = fullAccess(form.role) ? PERMISSIONS.map(p => p.value) : form.permissions;
  return (
    <div className="staff-drawer-overlay" onClick={event => { if (event.target === event.currentTarget) void close(); }}>
      <div ref={panel} className="staff-drawer" role="dialog" aria-modal="true" aria-labelledby="staff-editor-title">
        <header className="staff-drawer-header">
          <div><span className="staff-eyebrow">TEAM ACCESS</span><h2 id="staff-editor-title">{member ? editable ? 'Edit Staff' : 'Account Details' : 'Add Staff'}</h2><p>{member ? `${member.fullName} · @${member.username}` : 'Create an account and choose its access.'}</p></div>
          <button type="button" className="staff-icon-button" aria-label="Close staff panel" disabled={saving} onClick={() => void close()}><X size={20} /></button>
        </header>
        {!editable && <p className="staff-readonly-notice"><Shield size={16} />{member?.role === 'OWNER' ? 'Owner account is protected.' : 'This account is read-only for your role.'}</p>}
        <div className="staff-editor-tabs" role="tablist" aria-label="Staff details">
          {tabs.map(item => <button type="button" role="tab" key={item} id={`staff-tab-${item}`} aria-controls={`staff-panel-${item}`} aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <form className="staff-editor-form" onSubmit={submit} onInvalid={() => setTab('Information')}>
          <div className="staff-drawer-body">
            {error && <p className="staff-error" role="alert">{error}</p>}
            <section role="tabpanel" id="staff-panel-Information" aria-labelledby="staff-tab-Information" hidden={tab !== 'Information'}>
              <fieldset disabled={!editable || saving}>
                <div className="admin-form-group"><label htmlFor="staffFullName">Full Name</label><input id="staffFullName" required maxLength={100} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} autoComplete="name" /></div>
                <div className="staff-field-grid">
                  <div className="admin-form-group"><label htmlFor="staffUsername">Username</label><input id="staffUsername" required maxLength={50} disabled={Boolean(member)} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoComplete="off" /></div>
                  <div className="admin-form-group"><label htmlFor="staffEmail">Email</label><input id="staffEmail" type="email" required maxLength={255} disabled={Boolean(member)} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="off" /></div>
                </div>
                <div className="admin-form-group"><label htmlFor="staffRole">Role</label>{member?.role === 'OWNER' ? <input id="staffRole" value="OWNER" readOnly /> : <select id="staffRole" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as TeamRole })}>
                  {Array.from(new Set([...roles, form.role])).map(role => <option key={role} value={role} disabled={!roles.includes(role)}>{role}</option>)}
                </select>}<small>Only Owner can grant or manage Admin access.</small></div>
                {editable && <div className="admin-form-group"><label htmlFor="staffPassword">{member ? 'New Password (optional)' : 'Password'}</label><input id="staffPassword" type="password" required={!member} minLength={6} maxLength={128} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /><small>{member ? 'Changing a password signs this member out of existing sessions.' : 'Share the initial password securely with this member.'}</small></div>}
                <label className="staff-account-toggle"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /><span>Account active</span></label>
              </fieldset>
              {member && <div className="staff-created-note"><Clock size={14} />Joined {formatDate(member.createdAt)} · Updated {formatDate(member.updatedAt)}</div>}
            </section>
            <section role="tabpanel" id="staff-panel-Permissions" aria-labelledby="staff-tab-Permissions" hidden={tab !== 'Permissions'}>
              <div className="staff-access-summary"><Shield size={20} /><div><strong>{fullAccess(form.role) ? 'Full administrative access' : `${selected.length} modules enabled`}</strong><p>{fullAccess(form.role) ? 'This role can access every admin module.' : 'Choose the areas this member needs for their work.'}</p></div></div>
              {!fullAccess(form.role) && <>
                {editable && <div className="staff-presets">{PRESETS.map(preset => <button key={preset.label} type="button" title={preset.description} disabled={saving || !preset.permissions.some(p => canAssignPermission(actor, p))} onClick={() => setForm({ ...form, permissions: preset.permissions.filter(p => canAssignPermission(actor, p)) })}>{preset.label}</button>)}<button type="button" disabled={saving} onClick={() => setForm({ ...form, permissions: ROLE_DEFAULTS[form.role].filter(p => canAssignPermission(actor, p)) })}>Role default</button><button type="button" disabled={saving} onClick={() => setForm({ ...form, permissions: [] })}>Clear</button></div>}
                {!fullAccess(actor.role) && <p className="staff-muted">You can grant only permissions assigned to your own account ({permitted.length} available).</p>}
                <div className="staff-permission-groups">{Array.from(new Set(PERMISSIONS.map(p => p.group))).map(group => <section key={group}><h3>{group}</h3>{PERMISSIONS.filter(p => p.group === group).map(permission => <label key={permission.value} className="staff-permission-option"><input type="checkbox" checked={form.permissions.includes(permission.value)} disabled={!editable || saving || (!canAssignPermission(actor, permission.value) && !form.permissions.includes(permission.value))} onChange={() => setForm({ ...form, permissions: form.permissions.includes(permission.value) ? form.permissions.filter(p => p !== permission.value) : [...form.permissions, permission.value] })} /><span><strong>{permission.label}</strong><small>{permission.description}</small></span></label>)}</section>)}</div>
              </>}
              <div className="staff-access-preview"><h3>Visible admin modules</h3><div>{selected.length ? selected.map(permission => <span key={permission}><Check size={12} />{permissionLabel(permission)}</span>) : <p className="staff-muted">No business modules selected. This member can still open the admin dashboard and notifications.</p>}</div></div>
            </section>
            {member && <section role="tabpanel" id="staff-panel-History" aria-labelledby="staff-tab-History" hidden={tab !== 'History'}>
              <p className="staff-muted">Recent account changes and the person who made them.</p>
              {historyError ? <div className="staff-error" role="alert">{historyError}<button type="button" onClick={() => setRetry(retry + 1)}>Retry</button></div> : history === null ? <p>Loading history…</p> : !history.length ? <p className="staff-empty-state">No account changes recorded yet.</p> : <div className="staff-history">{history.map(log => <article key={log.id}><div className="staff-history-heading"><strong>{log.action === 'CREATE' ? 'Account created' : log.action === 'ROLLBACK' ? 'Changes restored' : 'Account updated'}</strong><time>{formatDate(log.createdAt)}</time></div><p>By {log.user?.fullName || log.user?.username || 'Administrator'}</p>{Object.entries(log.details.current || {}).filter(([key, value]) => historyLabels[key] && JSON.stringify(value) !== JSON.stringify(log.details.previous?.[key])).map(([key, value]) => <div className="staff-history-change" key={key}><span>{historyLabels[key]}</span><p>{historyValue(key, log.details.previous?.[key])}<ArrowRight size={12} />{historyValue(key, value)}</p></div>)}{log.details.passwordChanged && <span className="staff-password-changed">Password changed</span>}</article>)}</div>}
            </section>}
          </div>
          <footer className="staff-drawer-footer"><span className="staff-muted">{dirty ? 'Unsaved changes' : editable ? 'Changes apply after saving.' : 'Read-only account'}</span><div><button type="button" className="admin-btn admin-btn-outline" disabled={saving} onClick={() => void close()}>{editable ? 'Cancel' : 'Close'}</button>{editable && <button className="admin-btn admin-btn-primary" type="submit" disabled={saving || Boolean(member && !dirty)}>{saving ? 'Saving…' : member ? 'Save Changes' : 'Create Staff'}</button>}</div></footer>
        </form>
      </div>
    </div>
  );
}

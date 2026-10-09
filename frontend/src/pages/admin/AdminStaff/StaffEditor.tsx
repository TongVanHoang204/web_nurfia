import Select from '../../../components/Select/Select';
import { translateUi } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Check, Clock, Shield, X } from 'lucide-react';
import api from '../../../api/client';
import '../../../styles/teamRoles.css';
import { assignableRoles, canAssignPermission, formatDate, fullAccess, PERMISSIONS, permissionLabel, PRESETS, ROLE_DEFAULTS } from './staffModel';
import type { StaffForm, StaffHistory, StaffMember, TeamRole, TeamUser } from './staffModel';

type Props = {
  member: StaffMember | null; actor: TeamUser; editable: boolean;
  onSave: (form: StaffForm) => Promise<void>; onClose: () => void;
  confirmDiscard: () => Promise<boolean>;
};
const historyLabels: Record<string, string> = { fullName: 'Name', role: 'Role', permissions: 'Permissions', isActive: 'Status', username: 'Username', email: 'Email' };
const historyValue = (key: string, value: unknown) => key === 'isActive' ? translateUi(value ? 'Active' : 'Disabled')
  : key === 'role' ? translateUi(String(value || ''))
  : Array.isArray(value) ? value.map(item => permissionLabel(String(item))).join(', ') || 'No permissions' : String(value ?? '—');

export default function StaffEditor({ member, actor, editable, onSave, onClose, confirmDiscard }: Props) {
  useTranslation();
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
        .filter(element => !element.closest('[hidden]') && element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true');
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
  const selected = fullAccess(member?.role || form.role) ? PERMISSIONS.map(p => p.value) : form.permissions;
  return (
    <div className="staff-drawer-overlay" onClick={event => { if (event.target === event.currentTarget) void close(); }}>
      <div ref={panel} className="staff-drawer" role="dialog" aria-modal="true" aria-labelledby="staff-editor-title">
        <header className="staff-drawer-header">
          <div><span className="staff-eyebrow">{translateUi("TEAM ACCESS")}</span> <span className={`team-role-badge team-role-${(member?.role === 'OWNER' ? 'OWNER' : form.role).toLowerCase()}`}>{member?.role === 'OWNER' ? translateUi("OWNER") : form.role}</span><h2 id="staff-editor-title">{member ? editable ? translateUi("Edit Staff") : translateUi("Account Details") : translateUi("Add Staff")}</h2><p>{member ? `${member.fullName} · @${member.username}` : translateUi("Create an account and choose its access.")}</p></div>
          <button type="button" className="staff-icon-button" aria-label={translateUi("Close staff panel")} disabled={saving} onClick={() => void close()}><X size={20} /></button>
        </header>
        {!editable && <p className="staff-readonly-notice"><Shield size={16} />{member?.role === 'OWNER' ? translateUi("Owner account is protected.") : translateUi("This account is read-only for your role.")}</p>}
        <div className="staff-editor-tabs" role="tablist" aria-label={translateUi("Staff details")}>
          {tabs.map(item => <button type="button" role="tab" key={item} id={`staff-tab-${item}`} aria-controls={`staff-panel-${item}`} aria-selected={tab === item} onClick={() => setTab(item)}>{translateUi(item)}</button>)}
        </div>
        <form className="staff-editor-form" onSubmit={submit} onInvalid={() => setTab('Information')}>
          <div className="staff-drawer-body">
            {error && <p className="staff-error" role="alert">{error}</p>}
            <section role="tabpanel" id="staff-panel-Information" aria-labelledby="staff-tab-Information" hidden={tab !== 'Information'}>
              <fieldset disabled={!editable || saving}>
                <div className="admin-form-group"><label htmlFor="staffFullName">{translateUi("Full Name")}</label><input id="staffFullName" required maxLength={100} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} autoComplete="name" /></div>
                <div className="staff-field-grid">
                  <div className="admin-form-group"><label htmlFor="staffUsername">{translateUi("Username")}</label><input id="staffUsername" required maxLength={50} disabled={Boolean(member)} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} autoComplete="off" /></div>
                  <div className="admin-form-group"><label htmlFor="staffEmail">{translateUi("Email")}</label><input id="staffEmail" type="email" required maxLength={255} disabled={Boolean(member)} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="off" /></div>
                </div>
                <div className="admin-form-group"><label htmlFor="staffRole">{translateUi("Role")}</label>{member?.role === 'OWNER' ? <input id="staffRole" value="OWNER" readOnly /> : <Select id="staffRole" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as TeamRole })}>
                  {Array.from(new Set([...roles, form.role])).map(role => <option key={role} value={role} disabled={!roles.includes(role)}>{translateUi(role)}</option>)}
                </Select>}<small>{translateUi("Only Owner can grant or manage Admin access.")}</small></div>
                {editable && <div className="admin-form-group"><label htmlFor="staffPassword">{member ? translateUi("New Password (optional)") : translateUi("Password")}</label><input id="staffPassword" type="password" required={!member} minLength={6} maxLength={128} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /><small>{member ? translateUi("Changing a password signs this member out of existing sessions.") : translateUi("Share the initial password securely with this member.")}</small></div>}
                <label className="staff-account-toggle"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /><span>{translateUi("Account active")}</span></label>
              </fieldset>
              {member && <div className="staff-created-note"><Clock size={14} />{translateUi("Joined")} {formatDate(member.createdAt)} {translateUi("· Updated")} {formatDate(member.updatedAt)}</div>}
            </section>
            <section role="tabpanel" id="staff-panel-Permissions" aria-labelledby="staff-tab-Permissions" hidden={tab !== 'Permissions'}>
              <div className="staff-access-summary"><Shield size={20} /><div><strong>{fullAccess(member?.role || form.role) ? translateUi("Full administrative access") : translateUi("{{value1}} modules enabled", { value1: selected.length })}</strong><p>{fullAccess(member?.role || form.role) ? translateUi("Owner can access every admin module.") : form.role === 'ADMIN' ? translateUi("Owner can enable or remove each module for this Admin.") : translateUi("Choose the areas this member needs for their work.")}</p></div></div>
              {!fullAccess(member?.role || form.role) && <>
                {editable && <div className="staff-presets">{PRESETS.map(preset => <button key={preset.label} type="button" title={translateUi(preset.description)} disabled={saving || !preset.permissions.some(p => canAssignPermission(actor, p))} onClick={() => setForm({ ...form, permissions: preset.permissions.filter(p => canAssignPermission(actor, p)) })}>{translateUi(preset.label)}</button>)}<button type="button" disabled={saving} onClick={() => setForm({ ...form, permissions: ROLE_DEFAULTS[form.role].filter(p => canAssignPermission(actor, p)) })}>{translateUi("Role default")}</button><button type="button" disabled={saving} onClick={() => setForm({ ...form, permissions: [] })}>{translateUi("Clear")}</button></div>}
                {!fullAccess(actor.role) && <p className="staff-muted">{translateUi("You can grant only permissions assigned to your own account (")}{permitted.length} {translateUi("available).")}</p>}
                <div className="staff-permission-groups">{Array.from(new Set(PERMISSIONS.map(p => p.group))).map(group => <section key={group}><h3>{translateUi(group)}</h3>{PERMISSIONS.filter(p => p.group === group).map(permission => <label key={permission.value} className="staff-permission-option"><input type="checkbox" checked={form.permissions.includes(permission.value)} disabled={!editable || saving || (!canAssignPermission(actor, permission.value) && !form.permissions.includes(permission.value))} onChange={() => setForm({ ...form, permissions: form.permissions.includes(permission.value) ? form.permissions.filter(p => p !== permission.value) : [...form.permissions, permission.value] })} /><span><strong>{translateUi(permission.label)}</strong><small>{translateUi(permission.description)}</small></span></label>)}</section>)}</div>
              </>}
              <div className="staff-access-preview"><h3>{translateUi("Visible admin modules")}</h3><div>{selected.length ? selected.map(permission => <span key={permission}><Check size={12} />{permissionLabel(permission)}</span>) : <p className="staff-muted">{translateUi("No business modules selected. This member can still open the admin dashboard and notifications.")}</p>}</div></div>
            </section>
            {member && <section role="tabpanel" id="staff-panel-History" aria-labelledby="staff-tab-History" hidden={tab !== 'History'}>
              <p className="staff-muted">{translateUi("Recent account changes and the person who made them.")}</p>
              {historyError ? <div className="staff-error" role="alert">{historyError}<button type="button" onClick={() => setRetry(retry + 1)}>{translateUi("Retry")}</button></div> : history === null ? <p>{translateUi("Loading history…")}</p> : !history.length ? <p className="staff-empty-state">{translateUi("No account changes recorded yet.")}</p> : <div className="staff-history">{history.map(log => <article key={log.id}><div className="staff-history-heading"><strong>{log.action === 'CREATE' ? translateUi("Account created") : log.action === 'ROLLBACK' ? translateUi("Changes restored") : translateUi("Account updated")}</strong><time>{formatDate(log.createdAt)}</time></div><p>{translateUi("By")} {log.user?.fullName || log.user?.username || translateUi("Administrator")}</p>{Object.entries(log.details.current || {}).filter(([key, value]) => historyLabels[key] && JSON.stringify(value) !== JSON.stringify(log.details.previous?.[key])).map(([key, value]) => <div className="staff-history-change" key={key}><span>{translateUi(historyLabels[key])}</span><p>{historyValue(key, log.details.previous?.[key])}<ArrowRight size={12} />{historyValue(key, value)}</p></div>)}{log.details.passwordChanged && <span className="staff-password-changed">{translateUi("Password changed")}</span>}</article>)}</div>}
            </section>}
          </div>
          <footer className="staff-drawer-footer"><span className="staff-muted">{dirty ? translateUi("Unsaved changes") : editable ? translateUi("Changes apply after saving.") : translateUi("Read-only account")}</span><div><button type="button" className="admin-btn admin-btn-outline" disabled={saving} onClick={() => void close()}>{editable ? translateUi("Cancel") : translateUi("Close")}</button>{editable && <button className="admin-btn admin-btn-primary" type="submit" disabled={saving || Boolean(member && !dirty)}>{saving ? translateUi("Saving…") : member ? translateUi("Save Changes") : translateUi("Create Staff")}</button>}</div></footer>
        </form>
      </div>
    </div>
  );
}

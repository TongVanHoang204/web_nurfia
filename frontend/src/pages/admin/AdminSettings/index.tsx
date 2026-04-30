import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Palette, RefreshCw, Save, Search, Share2, Upload, Wallet } from 'lucide-react';
import './AdminSettings.css';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl, useSiteSettings } from '../../../contexts/SiteSettingsContext';

const SETTING_KEYS = [
  'siteName', 'tagline', 'siteTitle', 'siteDescription', 'currency', 'logoUrl', 'logoLightUrl', 'faviconUrl',
  'bankName', 'accountNumber', 'accountOwner', 'qrCodeUrl', 'email', 'phone', 'address', 'facebook', 'instagram', 'twitter',
] as const;

type SettingKey = typeof SETTING_KEYS[number];
type SettingsState = Record<SettingKey, string>;
type UploadTarget = Extract<SettingKey, 'logoUrl' | 'logoLightUrl' | 'faviconUrl' | 'qrCodeUrl'>;

const FIELD_META: Record<SettingKey, { label: string; type: string; placeholder?: string; helper?: string; uploadTarget?: UploadTarget; preview?: string; rows?: number }> = {
  siteName: { label: 'Brand Name', type: 'text', placeholder: 'Nurfia' },
  tagline: { label: 'Tagline', type: 'text' },
  siteTitle: { label: 'Browser Title', type: 'text' },
  siteDescription: { label: 'SEO Description', type: 'textarea', rows: 3 },
  currency: { label: 'Currency', type: 'text' },
  logoUrl: { label: 'Dark Logo', type: 'text', uploadTarget: 'logoUrl', preview: 'logo' },
  logoLightUrl: { label: 'Light Logo', type: 'text', uploadTarget: 'logoLightUrl', preview: 'logo-dark' },
  faviconUrl: { label: 'Favicon', type: 'text', uploadTarget: 'faviconUrl', preview: 'icon' },
  bankName: { label: 'Bank', type: 'text' },
  accountNumber: { label: 'Account #', type: 'text' },
  accountOwner: { label: 'Account Name', type: 'text' },
  qrCodeUrl: { label: 'Payment QR', type: 'text', uploadTarget: 'qrCodeUrl', preview: 'qr' },
  email: { label: 'Support Email', type: 'email' },
  phone: { label: 'Phone', type: 'text' },
  address: { label: 'Store Address', type: 'text' },
  facebook: { label: 'Facebook', type: 'url' },
  instagram: { label: 'Instagram', type: 'url' },
  twitter: { label: 'Twitter/X', type: 'url' },
};

const GROUPS = [
  { id: 'branding', title: 'Branding', description: 'Logos and SEO data', icon: Palette, keys: ['siteName', 'tagline', 'siteTitle', 'siteDescription', 'logoUrl', 'logoLightUrl', 'faviconUrl'] as SettingKey[] },
  { id: 'commerce', title: 'Payments', description: 'Banking and currency', icon: Wallet, keys: ['currency', 'bankName', 'accountNumber', 'accountOwner', 'qrCodeUrl'] as SettingKey[] },
  { id: 'contact', title: 'Contact', description: 'Support and location', icon: Globe, keys: ['email', 'phone', 'address'] as SettingKey[] },
  { id: 'social', title: 'Social', description: 'Connect your channels', icon: Share2, keys: ['facebook', 'instagram', 'twitter'] as SettingKey[] },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsState>({} as SettingsState);
  const [initialSettings, setInitialSettings] = useState<SettingsState>({} as SettingsState);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const { addToast } = useUIStore();
  const { refreshSettings } = useSiteSettings();

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      const s = data.data || {};
      const state = SETTING_KEYS.reduce((acc, k) => { acc[k] = s[k] || ''; return acc; }, {} as SettingsState);
      setSettings(state);
      setInitialSettings(state);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  const changedKeys = SETTING_KEYS.filter(k => settings[k] !== initialSettings[k]);

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const payload = changedKeys.reduce((acc, k) => { acc[k] = settings[k]; return acc; }, {} as any);
      await api.put('/settings', payload);
      setInitialSettings({...settings});
      await refreshSettings();
      addToast('Settings updated', 'success');
    } catch { addToast('Failed to save', 'error'); }
    finally { setSavingAll(false); }
  };

  const handleUpload = async (target: UploadTarget, file: File | null) => {
    if (!file) return;
    setUploadingTarget(target);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSettings(prev => ({...prev, [target]: data.data.url}));
      addToast('Uploaded', 'success');
    } catch {
      addToast('Failed to upload image', 'error');
    } finally {
      setUploadingTarget(null);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="admin-settings-page">
      <header className="admin-settings-header">
        <div>
          <h1>Settings</h1>
          <p>Global store configuration and branding assets.</p>
        </div>
        <div className="settings-toolbar-actions">
           <button className="btn btn-outline" onClick={() => setSettings(initialSettings)} disabled={changedKeys.length === 0}><RefreshCw size={14} style={{ marginRight: 8 }} /> Reset</button>
           <button className="btn btn-primary" onClick={handleSaveAll} disabled={changedKeys.length === 0 || savingAll}><Save size={14} style={{ marginRight: 8 }} /> {savingAll ? 'Saving...' : 'Save All'}</button>
        </div>
      </header>

      <div className="settings-overview-grid">
        <div className="settings-overview-card"><span>Managed Sections</span><strong>{GROUPS.length}</strong></div>
        <div className="settings-overview-card"><span>Total Settings</span><strong>{SETTING_KEYS.length}</strong></div>
        <div className="settings-overview-card"><span>Unsaved Changes</span><strong>{changedKeys.length}</strong></div>
        <div className="settings-overview-card"><span>Live Status</span><strong>Online</strong></div>
      </div>

      <div className="settings-toolbar">
         <div className="settings-search-wrap">
            <Search size={18} />
            <input type="text" placeholder="Search setting names or values..." value={search} onChange={e => setSearch(e.target.value)} />
         </div>
      </div>

      <div className="settings-groups-grid">
        {GROUPS.map(group => (
          <section key={group.id} className="settings-group-card">
            <header className="settings-group-header">
              <div className="settings-group-title-wrap">
                <div className="settings-group-icon"><group.icon size={20} /></div>
                <div><h3>{group.title}</h3><p>{group.description}</p></div>
              </div>
            </header>
            
            <div className="settings-form-grid">
              {group.keys.filter(k => k.toLowerCase().includes(search.toLowerCase()) || FIELD_META[k].label.toLowerCase().includes(search.toLowerCase())).map(k => {
                const meta = FIELD_META[k];
                const isDirty = settings[k] !== initialSettings[k];
                return (
                  <div key={k} className={`settings-field ${isDirty ? 'is-dirty' : ''}`}>
                    <label>{meta.label}</label>
                    {meta.type === 'textarea' ? (
                      <textarea value={settings[k]} rows={meta.rows || 3} onChange={e => setSettings({...settings, [k]: e.target.value})} />
                    ) : (
                      <input type={meta.type} value={settings[k]} onChange={e => setSettings({...settings, [k]: e.target.value})} />
                    )}
                    
                    <div className="settings-field-actions">
                      {meta.uploadTarget && (
                        <label className="btn btn-outline btn-sm">
                          <Upload size={12} style={{ marginRight: 6 }} /> {uploadingTarget === k ? '...' : 'Upload'}
                          <input type="file" hidden onChange={e => handleUpload(meta.uploadTarget!, e.target.files?.[0] || null)} />
                        </label>
                      )}
                      {settings[k] && <button className="btn btn-outline btn-sm" onClick={() => window.open(resolveSiteAssetUrl(settings[k]), '_blank')}><ExternalLink size={12} /></button>}
                    </div>

                    {meta.preview && settings[k] && (
                       <div className={`settings-preview settings-preview-${meta.preview}`}>
                          <img 
                            src={resolveSiteAssetUrl(settings[k])} 
                            alt={meta.label} 
                            onError={(e: any) => {
                              e.target.style.display = 'none';
                              const p = e.target.parentElement;
                              if (p && !p.querySelector('.preview-error')) {
                                const err = document.createElement('span');
                                err.className = 'preview-error';
                                err.innerText = 'Load failed';
                                p.appendChild(err);
                              }
                            }}
                          />
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {changedKeys.length > 0 && (
        <div className="settings-unsaved-bar">
          <span>You have {changedKeys.length} unsaved changes.</span>
          <div style={{ display: 'flex', gap: 12 }}>
             <button className="btn btn-outline" style={{ color: '#fff', borderColor: '#444' }} onClick={() => setSettings(initialSettings)}>Discard</button>
             <button className="btn btn-primary" onClick={handleSaveAll} disabled={savingAll}>Save Now</button>
          </div>
        </div>
      )}
    </div>
  );
}

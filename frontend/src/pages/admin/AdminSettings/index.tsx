import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, ExternalLink, Globe, Palette, RefreshCw, Save, Search, Share2, Upload, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './AdminSettings.css';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl, useSiteSettings } from '../../../contexts/SiteSettingsContext';

const SETTING_KEYS = [
  'siteName',
  'tagline',
  'siteTitle',
  'siteDescription',
  'currency',
  'logoUrl',
  'logoLightUrl',
  'faviconUrl',
  'bankName',
  'accountNumber',
  'accountOwner',
  'qrCodeUrl',
  'email',
  'phone',
  'address',
  'facebook',
  'instagram',
  'twitter',
] as const;

type SettingKey = typeof SETTING_KEYS[number];
type SettingsState = Record<SettingKey, string>;
type UploadTarget = Extract<SettingKey, 'logoUrl' | 'logoLightUrl' | 'faviconUrl' | 'qrCodeUrl'>;
type FieldType = 'text' | 'email' | 'url' | 'textarea';

type FieldMeta = {
  label: string;
  placeholder?: string;
  helper?: string;
  type: FieldType;
  rows?: number;
  uploadTarget?: UploadTarget;
  preview?: 'logo' | 'logo-dark' | 'icon' | 'qr';
};

type SettingGroup = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  keys: SettingKey[];
};

const DEFAULT_SETTINGS: SettingsState = {
  siteName: 'Nurfia',
  tagline: 'Premium Fashion for Women & Men',
  siteTitle: 'Nurfia - Fashion eCommerce',
  siteDescription: 'Nurfia - Premium Fashion eCommerce. Discover the latest trends in women\'s and men\'s clothing, accessories, and more.',
  currency: 'USD',
  logoUrl: '',
  logoLightUrl: '',
  faviconUrl: '',
  bankName: '',
  accountNumber: '',
  accountOwner: '',
  qrCodeUrl: '',
  email: '',
  phone: '',
  address: '',
  facebook: '',
  instagram: '',
  twitter: '',
};

const FIELD_META: Record<SettingKey, FieldMeta> = {
  siteName: { label: 'Brand Name', type: 'text', placeholder: 'Nurfia' },
  tagline: { label: 'Tagline', type: 'text', placeholder: 'Premium Fashion for Women & Men' },
  siteTitle: { label: 'Site Title', type: 'text', placeholder: 'Shown in browser tab and search preview' },
  siteDescription: { label: 'Site Description', type: 'textarea', rows: 4, placeholder: 'Homepage meta description and brand summary' },
  currency: { label: 'Currency', type: 'text', placeholder: 'USD' },
  logoUrl: {
    label: 'Main Logo URL',
    type: 'url',
    placeholder: 'https://example.com/logo-dark.png',
    helper: 'Primary brand logo used on light backgrounds.',
    uploadTarget: 'logoUrl',
    preview: 'logo',
  },
  logoLightUrl: {
    label: 'Light Logo URL',
    type: 'url',
    placeholder: 'https://example.com/logo-light.png',
    helper: 'Used on dark or transparent headers.',
    uploadTarget: 'logoLightUrl',
    preview: 'logo-dark',
  },
  faviconUrl: {
    label: 'Favicon URL',
    type: 'url',
    placeholder: 'https://example.com/favicon.svg',
    helper: 'Browser tab icon.',
    uploadTarget: 'faviconUrl',
    preview: 'icon',
  },
  bankName: { label: 'Bank Name', type: 'text', placeholder: 'Vietcombank' },
  accountNumber: { label: 'Account Number', type: 'text', placeholder: '1234567890' },
  accountOwner: { label: 'Account Owner', type: 'text', placeholder: 'NURFIA FASHION CO., LTD' },
  qrCodeUrl: {
    label: 'QR Code URL',
    type: 'url',
    placeholder: 'https://example.com/bank-qr.jpg',
    helper: 'Shown on checkout for bank transfer.',
    uploadTarget: 'qrCodeUrl',
    preview: 'qr',
  },
  email: { label: 'Support Email', type: 'email', placeholder: 'contact@nurfia.com' },
  phone: { label: 'Support Phone', type: 'text', placeholder: '+1 234 567 890' },
  address: { label: 'Business Address', type: 'text', placeholder: '123 Fashion Avenue, New York' },
  facebook: { label: 'Facebook URL', type: 'url', placeholder: 'https://facebook.com/nurfia' },
  instagram: { label: 'Instagram URL', type: 'url', placeholder: 'https://instagram.com/nurfia' },
  twitter: { label: 'Twitter/X URL', type: 'url', placeholder: 'https://x.com/nurfia' },
};

const GROUPS: SettingGroup[] = [
  {
    id: 'branding',
    title: 'Branding & SEO',
    description: 'Store identity, metadata, and visual assets.',
    icon: Palette,
    keys: ['siteName', 'tagline', 'siteTitle', 'siteDescription', 'logoUrl', 'logoLightUrl', 'faviconUrl'],
  },
  {
    id: 'commerce',
    title: 'Commerce & Payments',
    description: 'Checkout and transfer information for customers.',
    icon: Wallet,
    keys: ['currency', 'bankName', 'accountNumber', 'accountOwner', 'qrCodeUrl'],
  },
  {
    id: 'contact',
    title: 'Contact Information',
    description: 'Public support channels and location details.',
    icon: Globe,
    keys: ['email', 'phone', 'address'],
  },
  {
    id: 'social',
    title: 'Social Channels',
    description: 'Links used in footer and marketing placements.',
    icon: Share2,
    keys: ['facebook', 'instagram', 'twitter'],
  },
];

const buildSettingsState = (source?: Record<string, unknown>): SettingsState => {
  return SETTING_KEYS.reduce((acc, key) => {
    const value = source?.[key];
    acc[key] = typeof value === 'string' ? value : DEFAULT_SETTINGS[key];
    return acc;
  }, { ...DEFAULT_SETTINGS } as SettingsState);
};

const downloadJsonFile = (fileName: string, payload: unknown) => {
  const content = JSON.stringify(payload, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsState>({ ...DEFAULT_SETTINGS });
  const [initialSettings, setInitialSettings] = useState<SettingsState>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const { addToast, openConfirm } = useUIStore();
  const { refreshSettings } = useSiteSettings();

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const hasUnsaved = SETTING_KEYS.some((key) => settings[key] !== initialSettings[key]);
    if (!hasUnsaved) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [settings, initialSettings]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      const nextSettings = buildSettingsState(data.data || {});
      setSettings(nextSettings);
      setInitialSettings(nextSettings);
    } catch {
      addToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const changedKeys = useMemo(() => {
    return SETTING_KEYS.filter((key) => settings[key] !== initialSettings[key]);
  }, [settings, initialSettings]);

  const changedSections = useMemo(() => {
    return GROUPS.filter((group) => group.keys.some((key) => changedKeys.includes(key))).length;
  }, [changedKeys]);

  const filledCount = useMemo(() => {
    return SETTING_KEYS.filter((key) => Boolean(settings[key].trim())).length;
  }, [settings]);

  const visibleGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return GROUPS.map((group) => ({ ...group, visibleKeys: group.keys }));
    }

    return GROUPS
      .map((group) => {
        const visibleKeys = group.keys.filter((key) => {
          const meta = FIELD_META[key];
          return key.toLowerCase().includes(keyword)
            || meta.label.toLowerCase().includes(keyword)
            || String(settings[key] || '').toLowerCase().includes(keyword);
        });

        return { ...group, visibleKeys };
      })
      .filter((group) => group.visibleKeys.length > 0);
  }, [search, settings]);

  const setFieldValue = (key: SettingKey, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleChange = (key: SettingKey) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFieldValue(key, event.target.value);
  };

  const handleSaveKeys = async (keys: SettingKey[], successLabel: string) => {
    const payload = keys.reduce((acc, key) => {
      if (settings[key] !== initialSettings[key]) {
        acc[key] = settings[key];
      }
      return acc;
    }, {} as Record<string, string>);

    if (Object.keys(payload).length === 0) {
      addToast('No changes to save for this section', 'info');
      return;
    }

    try {
      await api.put('/settings', payload);
      setInitialSettings((prev) => ({ ...prev, ...payload }));
      await refreshSettings();
      addToast(successLabel, 'success');
    } catch (error: any) {
      addToast(error.response?.data?.message || error.response?.data?.error || 'Failed to save settings', 'error');
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    await handleSaveKeys([...SETTING_KEYS], 'All settings saved successfully');
    setSavingAll(false);
  };

  const handleSaveGroup = async (groupId: string, keys: SettingKey[]) => {
    setSavingGroupId(groupId);
    await handleSaveKeys(keys, 'Section saved successfully');
    setSavingGroupId(null);
  };

  const handleDiscardAllChanges = () => {
    if (changedKeys.length === 0) {
      addToast('No pending changes to discard', 'info');
      return;
    }

    openConfirm({
      title: 'Discard Unsaved Changes?',
      message: 'This will revert all unsaved edits on this page.',
      confirmText: 'Discard All',
      cancelText: 'Keep Editing',
      danger: true,
      onConfirm: () => {
        setSettings(initialSettings);
        addToast('Unsaved changes discarded', 'success');
      },
    });
  };

  const handleResetSection = (group: SettingGroup) => {
    setSettings((prev) => {
      const next = { ...prev };
      group.keys.forEach((key) => {
        next[key] = initialSettings[key];
      });
      return next;
    });
  };

  const handleExportSettings = () => {
    const payload = SETTING_KEYS.reduce((acc, key) => {
      acc[key] = settings[key];
      return acc;
    }, {} as SettingsState);

    downloadJsonFile('nurfia-settings.json', payload);
    addToast('Settings exported as JSON', 'success');
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        addToast('Invalid settings JSON format', 'error');
        return;
      }

      let changed = 0;
      setSettings((prev) => {
        const next = { ...prev };
        SETTING_KEYS.forEach((key) => {
          const incoming = parsed[key];
          if (typeof incoming === 'string' && next[key] !== incoming) {
            next[key] = incoming;
            changed += 1;
          }
        });
        return next;
      });

      if (changed === 0) {
        addToast('No supported setting values found to import', 'info');
      } else {
        addToast(`Imported ${changed} setting value(s). Save to publish changes.`, 'success');
      }
    } catch {
      addToast('Unable to read settings JSON file', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const getPreviewUrl = (key: SettingKey) => {
    const value = settings[key];
    if (!value) return '';
    return resolveSiteAssetUrl(value);
  };

  const handleUploadAsset = async (target: UploadTarget, file?: File | null) => {
    if (!file) return;

    setUploadingTarget(target);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFieldValue(target, data.data.url);
      addToast('Asset uploaded. Save changes to publish it.', 'success');
    } catch (error: any) {
      addToast(error.response?.data?.error || 'Failed to upload asset', 'error');
    } finally {
      setUploadingTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-card settings-loading-card">
        <div className="loading-page"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="settings-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="settings-header-subtitle">Configure branding, payment info, and customer-facing channels from one control panel.</p>
        </div>
        <button className="admin-btn admin-btn-outline" type="button" onClick={() => window.open('/', '_blank', 'noopener,noreferrer')}>
          <Globe size={14} /> Preview Storefront
        </button>
      </div>

      <div className="settings-overview-grid">
        <article className="settings-overview-card">
          <span>Total Fields</span>
          <strong>{SETTING_KEYS.length}</strong>
        </article>
        <article className="settings-overview-card">
          <span>Filled Values</span>
          <strong>{filledCount}</strong>
        </article>
        <article className="settings-overview-card">
          <span>Unsaved Fields</span>
          <strong>{changedKeys.length}</strong>
        </article>
        <article className="settings-overview-card">
          <span>Edited Sections</span>
          <strong>{changedSections}</strong>
        </article>
      </div>

      <div className="admin-card settings-toolbar-card">
        <div className="settings-toolbar">
          <div className="settings-search-wrap">
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search setting by key, label, or value"
            />
          </div>

          <div className="settings-toolbar-actions">
            <button type="button" className="admin-btn admin-btn-outline" onClick={handleImportClick}>
              <Upload size={14} /> Import JSON
            </button>
            <button type="button" className="admin-btn admin-btn-outline" onClick={handleExportSettings}>
              <Download size={14} /> Export JSON
            </button>
            <button type="button" className="admin-btn admin-btn-outline" onClick={handleDiscardAllChanges}>
              <RefreshCw size={14} /> Discard
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleSaveAll} disabled={savingAll || changedKeys.length === 0}>
              <Save size={14} /> {savingAll ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleImportFile}
        />
      </div>

      {changedKeys.length > 0 && (
        <div className="settings-unsaved-bar">
          <span>{changedKeys.length} unsaved setting value(s)</span>
          <div className="settings-unsaved-bar-actions">
            <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleDiscardAllChanges}>Discard</button>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleSaveAll} disabled={savingAll}>
              {savingAll ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      )}

      <div className="settings-groups-grid">
        {visibleGroups.map((group) => {
          const Icon = group.icon;
          const groupDirtyCount = group.keys.filter((key) => settings[key] !== initialSettings[key]).length;

          return (
            <section key={group.id} className="admin-card settings-group-card">
              <header className="settings-group-header">
                <div className="settings-group-title-wrap">
                  <div className="settings-group-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                </div>
                <span className="settings-group-count">{groupDirtyCount} changed</span>
              </header>

              <div className="settings-form-grid">
                {group.visibleKeys.map((key) => {
                  const meta = FIELD_META[key];
                  const isDirty = settings[key] !== initialSettings[key];
                  const previewUrl = meta.preview ? getPreviewUrl(key) : '';
                  const openUrl = settings[key] ? (meta.preview ? previewUrl : settings[key]) : '';

                  return (
                    <div key={key} className={`settings-field ${isDirty ? 'is-dirty' : ''}`}>
                      <label htmlFor={`setting-${key}`}>{meta.label}</label>

                      {meta.type === 'textarea' ? (
                        <textarea
                          id={`setting-${key}`}
                          value={settings[key]}
                          rows={meta.rows || 4}
                          placeholder={meta.placeholder}
                          onChange={handleChange(key)}
                        />
                      ) : (
                        <input
                          id={`setting-${key}`}
                          type={meta.type}
                          value={settings[key]}
                          placeholder={meta.placeholder}
                          onChange={handleChange(key)}
                        />
                      )}

                      {meta.helper && <small className="settings-field-helper">{meta.helper}</small>}

                      <div className="settings-field-actions">
                        {meta.uploadTarget && (
                          <label className="admin-btn admin-btn-outline admin-btn-sm settings-upload-inline-btn">
                            <Upload size={13} /> {uploadingTarget === meta.uploadTarget ? 'Uploading...' : 'Upload'}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(event) => handleUploadAsset(meta.uploadTarget!, event.target.files?.[0])}
                            />
                          </label>
                        )}

                        {openUrl && (
                          <a href={openUrl} target="_blank" rel="noreferrer" className="admin-btn admin-btn-outline admin-btn-sm settings-open-link-btn">
                            <ExternalLink size={13} /> Open
                          </a>
                        )}
                      </div>

                      {previewUrl && (
                        <div className={`settings-preview settings-preview-${meta.preview}`}>
                          <img src={previewUrl} alt={`${meta.label} preview`} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <footer className="settings-group-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => handleResetSection(group)}
                  disabled={groupDirtyCount === 0}
                >
                  Reset Section
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => handleSaveGroup(group.id, group.keys)}
                  disabled={groupDirtyCount === 0 || savingGroupId === group.id}
                >
                  {savingGroupId === group.id ? 'Saving...' : 'Save Section'}
                </button>
              </footer>
            </section>
          );
        })}

        {visibleGroups.length === 0 && (
          <div className="admin-card settings-empty-state">
            No settings matched your search. Try another keyword.
          </div>
        )}
      </div>
    </div>
  );
}

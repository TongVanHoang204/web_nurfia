import { translateUi } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Bell, Edit2, Megaphone, Plus, Trash2, Upload, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import AdminAiGeneratorButton from '../../../components/AdminAiGeneratorButton/AdminAiGeneratorButton';
import './AdminPopups.css';

interface HomePopup {
  id: number;
  popupType?: 'OFFER' | 'NOTICE';
  title: string;
  subtitle: string | null;
  message: string | null;
  imageUrl: string | null;
  offerCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  displayDelayMs: number;
  showOnceSession: boolean;
  isActive: boolean;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
}

const emptyForm = {
  popupType: 'OFFER' as 'OFFER' | 'NOTICE',
  title: '',
  subtitle: 'Limited Offer',
  message: '',
  imageUrl: '',
  offerCode: '',
  buttonText: 'Shop now',
  linkUrl: '/category/all',
  displayDelayMs: 900,
  showOnceSession: true,
  isActive: true,
  sortOrder: 0,
  startAt: '',
  endAt: '',
};

const toLocalInputValue = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const normalizeAssetInput = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  return trimmed;
};

export default function AdminPopups() {
  useTranslation();
  const [popups, setPopups] = useState<HomePopup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<HomePopup | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { addToast, openConfirm } = useUIStore();

  const fetchPopups = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/admin/popups');
      setPopups(Array.isArray(data.data) ? data.data : []);
    } catch {
      addToast('Failed to load popups', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPopups();
  }, []);

  const openAddModal = () => {
    setEditingPopup(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (popup: HomePopup) => {
    setEditingPopup(popup);
    setFormData({
      title: popup.title,
      popupType: popup.popupType === 'NOTICE' ? 'NOTICE' : 'OFFER',
      subtitle: popup.subtitle || '',
      message: popup.message || '',
      imageUrl: popup.imageUrl || '',
      offerCode: popup.offerCode || '',
      buttonText: popup.buttonText || '',
      linkUrl: popup.linkUrl || '',
      displayDelayMs: popup.displayDelayMs || 900,
      showOnceSession: popup.showOnceSession,
      isActive: popup.isActive,
      sortOrder: popup.sortOrder || 0,
      startAt: toLocalInputValue(popup.startAt),
      endAt: toLocalInputValue(popup.endAt),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fd = new FormData();
    fd.append('image', file);

    try {
      const { data } = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData((prev) => ({ ...prev, imageUrl: data.data.url }));
      addToast('Image uploaded', 'success');
    } catch {
      addToast('Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      imageUrl: normalizeAssetInput(formData.imageUrl),
      startAt: formData.startAt ? new Date(formData.startAt).toISOString() : null,
      endAt: formData.endAt ? new Date(formData.endAt).toISOString() : null,
    };

    try {
      if (editingPopup) {
        await api.put(`/admin/popups/${editingPopup.id}`, payload);
        addToast('Popup updated', 'success');
      } else {
        await api.post('/admin/popups', payload);
        addToast('Popup created', 'success');
      }
      closeModal();
      fetchPopups();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to save popup', 'error');
    }
  };

  const handleDelete = (id: number) => {
    openConfirm({
      title: 'Delete Popup',
      message: 'Delete this homepage popup?',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/popups/${id}`);
          addToast('Popup deleted', 'success');
          fetchPopups();
        } catch {
          addToast('Failed to delete popup', 'error');
        }
      },
    });
  };

  const popupAiContext = {
    popupType: formData.popupType,
    title: formData.title,
    subtitle: formData.subtitle,
    currentMessage: formData.message,
    offerCode: formData.offerCode,
    buttonText: formData.buttonText,
    linkUrl: formData.linkUrl,
  };

  return (
    <div className="admin-popups-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{translateUi("Homepage Popups")}</h1>
        </div>
        <button onClick={openAddModal} className="admin-btn admin-btn-primary">
          <Plus size={16} />{translateUi("Add Popup")}</button>
      </div>

      {isLoading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : popups.length === 0 ? (
        <div className="admin-popups-empty">{translateUi("No popups found. Create one to show it on the homepage.")}</div>
      ) : (
        <div className="admin-popups-grid">
          {popups.map((popup) => (
            <article key={popup.id} className="admin-popup-card">
              <div className="admin-popup-preview">
                {popup.imageUrl ? (
                  <img src={resolveSiteAssetUrl(popup.imageUrl)} alt={popup.title} />
                ) : (
                  <div className="admin-popup-no-image">{translateUi("Text only")}</div>
                )}
                <span className={`admin-popup-status ${popup.isActive ? 'is-active' : 'is-inactive'}`}>
                  {popup.isActive ? translateUi("Active") : translateUi("Inactive")}
                </span>
              </div>
              <div className="admin-popup-card-body">
                <span className="admin-popup-kicker">
                  {popup.popupType === 'NOTICE' ? translateUi("Notification") : translateUi("Offer")}{popup.subtitle ? ` / ${popup.subtitle}` : ''}
                </span>
                <h3>{popup.title}</h3>
                {popup.message && <p>{popup.message}</p>}
                <div className="admin-popup-meta">
                  {popup.offerCode && <span>{translateUi("Code:")} {popup.offerCode}</span>}
                  <span>{translateUi("Delay:")} {popup.displayDelayMs}{translateUi("ms")}</span>
                  <span>{translateUi("Order:")} {popup.sortOrder}</span>
                </div>
                <div className="admin-popup-card-footer">
                  <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEditModal(popup)}>
                    <Edit2 size={13} />{translateUi("Edit")}</button>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(popup.id)}>
                    <Trash2 size={13} />{translateUi("Delete")}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content admin-popups-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{editingPopup ? translateUi("Edit Popup") : translateUi("Add Popup")}</h3>
              <button type="button" onClick={closeModal} className="admin-modal-close" aria-label={translateUi("Close")}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-group">
                <label>{translateUi("Popup Type")}</label>
                <div className="admin-popup-type-toggle">
                  <button
                    type="button"
                    className={formData.popupType === 'OFFER' ? 'is-active' : ''}
                    onClick={() => setFormData({ ...formData, popupType: 'OFFER', subtitle: formData.subtitle || 'Limited Offer' })}
                  >
                    <Megaphone size={16} />{translateUi("Offer")}</button>
                  <button
                    type="button"
                    className={formData.popupType === 'NOTICE' ? 'is-active' : ''}
                    onClick={() => setFormData({ ...formData, popupType: 'NOTICE', subtitle: formData.subtitle || 'Announcement', offerCode: '' })}
                  >
                    <Bell size={16} />{translateUi("Notification")}</button>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="popup-title">{translateUi("Title *")}</label>
                  <input id="popup-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="popup-subtitle">{translateUi("Subtitle")}</label>
                  <input id="popup-subtitle" value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="admin-ai-field-header">
                  <label htmlFor="popup-message">{translateUi("Message")}</label>
                  <AdminAiGeneratorButton
                    target="POPUP_MESSAGE"
                    context={popupAiContext}
                    onGenerated={(text) => setFormData({ ...formData, message: text })}
                    disabled={!formData.title.trim()}
                  />
                </div>
                <textarea id="popup-message" rows={4} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
              </div>

              <div className="admin-form-group">
                <label htmlFor="popup-image-url">{translateUi("Image URL")}</label>
                <div className="admin-popups-upload-row">
                  <input id="popup-image-url" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="/uploads/example.jpg" />
                  <label className={`admin-btn admin-btn-outline admin-popups-upload-button${isUploading ? ' is-uploading' : ''}`} htmlFor="popup-image-file">
                    <Upload size={14} /> {isUploading ? translateUi("Uploading...") : translateUi("Upload")}
                    <input id="popup-image-file" type="file" accept="image/*" onChange={handleFileUpload} hidden disabled={isUploading} />
                  </label>
                </div>
                {formData.imageUrl && (
                  <div className="admin-popups-preview-frame">
                    <img
                      src={resolveSiteAssetUrl(formData.imageUrl)}
                      alt={translateUi("Popup preview")}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="admin-form-row">
                {formData.popupType === 'OFFER' && (
                  <div className="admin-form-group">
                    <label htmlFor="popup-code">{translateUi("Offer Code")}</label>
                    <input id="popup-code" value={formData.offerCode} onChange={(e) => setFormData({ ...formData, offerCode: e.target.value })} />
                  </div>
                )}
                <div className="admin-form-group">
                  <label htmlFor="popup-button">{translateUi("Button Text")}</label>
                  <input id="popup-button" value={formData.buttonText} onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })} />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="popup-link">{translateUi("Link URL")}</label>
                  <input id="popup-link" value={formData.linkUrl} onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })} placeholder="/category/all" />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="popup-delay">{translateUi("Delay (ms)")}</label>
                  <input id="popup-delay" type="number" min="0" max="60000" value={formData.displayDelayMs} onChange={(e) => setFormData({ ...formData, displayDelayMs: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="popup-start">{translateUi("Start Time")}</label>
                  <input id="popup-start" type="datetime-local" value={formData.startAt} onChange={(e) => setFormData({ ...formData, startAt: e.target.value })} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="popup-end">{translateUi("End Time")}</label>
                  <input id="popup-end" type="datetime-local" value={formData.endAt} onChange={(e) => setFormData({ ...formData, endAt: e.target.value })} />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="popup-order">{translateUi("Sort Order")}</label>
                  <input id="popup-order" type="number" min="0" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) || 0 })} />
                </div>
                <div className="admin-popups-switches">
                  <label>
                    <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />{translateUi("Active")}</label>
                  <label>
                    <input type="checkbox" checked={formData.showOnceSession} onChange={(e) => setFormData({ ...formData, showOnceSession: e.target.checked })} />{translateUi("Show once per session")}</label>
                </div>
              </div>

              <div className="admin-modal-actions">
                <button type="button" onClick={closeModal} className="admin-btn admin-btn-outline">{translateUi("Cancel")}</button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  {editingPopup ? translateUi("Update Popup") : translateUi("Save Popup")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

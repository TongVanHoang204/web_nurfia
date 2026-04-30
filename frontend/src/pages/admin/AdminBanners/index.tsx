import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, MapPin, ArrowUpDown } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import { getImageUrl } from '../../../utils/url';
import './AdminBanners.css';

const normalizeAssetInput = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;

  return trimmed;
};

export default function AdminBanners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast, openConfirm } = useUIStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    videoUrl: '',
    linkUrl: '',
    buttonText: '',
    position: 'homepage',
    sortOrder: 0,
    isActive: true,
  });

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/admin/banners');
      setBanners(data.data);
    } catch {
      addToast('Failed to load banners', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleDelete = async (id: number) => {
    openConfirm({
      title: 'Delete Banner',
      message: 'Delete this banner?',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete('/admin/banners/' + id);
          addToast('Banner deleted', 'success');
          fetchBanners();
        } catch {
          addToast('Failed to delete banner', 'error');
        }
      }
    });
  };

  const openAddModal = () => {
    setEditingBanner(null);
    setFormData({ title: '', subtitle: '', imageUrl: '', videoUrl: '', linkUrl: '', buttonText: '', position: 'homepage', sortOrder: 0, isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (banner: any) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      imageUrl: banner.imageUrl,
      videoUrl: banner.videoUrl || '',
      linkUrl: banner.linkUrl || '',
      buttonText: banner.buttonText || '',
      position: banner.position || 'homepage',
      sortOrder: banner.sortOrder || 0,
      isActive: banner.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'videoUrl' = 'imageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData({ ...formData, [field]: res.data.data.url });
      addToast(`${field === 'imageUrl' ? 'Image' : 'Video'} uploaded successfully`, 'success');
    } catch (_err) {
      addToast(`Failed to upload ${field === 'imageUrl' ? 'image' : 'video'}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      imageUrl: normalizeAssetInput(formData.imageUrl),
      videoUrl: normalizeAssetInput(formData.videoUrl || ''),
    };

    try {
      if (editingBanner) {
        await api.put(`/admin/banners/${editingBanner.id}`, payload);
        addToast('Banner updated successfully', 'success');
      } else {
        await api.post('/admin/banners', payload);
        addToast('Banner created successfully', 'success');
      }
      closeModal();
      fetchBanners();
    } catch (_err: any) {
      addToast(_err.response?.data?.message || 'Failed to save banner', 'error');
    }
  };

  return (
    <div className="admin-banners-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Manage Banners</h1>
          <p className="admin-banners-subtitle">Create and manage hero banners, promotional slides, and featured visuals across the storefront.</p>
        </div>
        <button onClick={openAddModal} className="admin-btn admin-btn-primary">
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {isLoading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : banners.length === 0 ? (
        <div className="admin-banners-empty">No banners found. Start by adding one.</div>
      ) : (
        <div className="admin-banners-grid">
          {banners.map((banner) => (
            <article key={banner.id} className="admin-banner-card">
              <div className="admin-banner-card-image">
                {banner.imageUrl ? (
                  <img src={resolveSiteAssetUrl(banner.imageUrl) || banner.imageUrl} alt={banner.title} />
                ) : (
                  <div className="admin-banner-no-image">No image</div>
                )}
                <span className={`admin-banner-status-badge ${banner.isActive ? 'is-active' : 'is-inactive'}`}>
                  {banner.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="admin-banner-card-body">
                <h3 className="admin-banner-card-title">{banner.title}</h3>
                {banner.subtitle && <p className="admin-banner-card-subtitle">{banner.subtitle}</p>}

                <div className="admin-banner-card-meta">
                  <span><MapPin size={12} /> {banner.position}</span>
                  <span><ArrowUpDown size={12} /> Order: {banner.sortOrder}</span>
                  {banner.buttonText && <span>CTA: {banner.buttonText}</span>}
                </div>

                <div className="admin-banner-card-footer">
                  <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEditModal(banner)} title="Edit Banner">
                    <Edit2 size={13} /> Edit
                  </button>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(banner.id)} title="Delete Banner">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: 640 }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{editingBanner ? 'Edit Banner' : 'Add New Banner'}</h3>
              <button type="button" onClick={closeModal} className="admin-modal-close" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-group">
                <label htmlFor="banner-title">Title *</label>
                <input
                  id="banner-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter banner title"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="banner-subtitle">Subtitle</label>
                <input
                  id="banner-subtitle"
                  type="text"
                  value={formData.subtitle || ''}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Enter banner subtitle"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="banner-image-url">Image URL *</label>
                <div className="admin-banners-upload-row">
                  <input
                    id="banner-image-url"
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="/uploads/banners/example.jpg"
                    required
                    className="admin-banners-upload-input"
                  />
                  <label className={`admin-btn admin-btn-outline admin-banners-upload-button${isUploading ? ' is-uploading' : ''}`} htmlFor="banner-image-file">
                    {isUploading ? 'Uploading...' : 'Choose File'}
                    <input
                      id="banner-image-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'imageUrl')}
                      className="admin-banners-hidden-input"
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {formData.imageUrl && (
                  <img
                    src={getImageUrl(formData.imageUrl)}
                    alt="Preview"
                    className="admin-banners-preview-image"
                    onError={(e: any) => e.target.style.display = 'none'}
                  />
                )}
              </div>
              <div className="admin-form-group">
                <label htmlFor="banner-video-url">Video URL</label>
                <div className="admin-banners-upload-row">
                  <input
                    id="banner-video-url"
                    type="text"
                    value={formData.videoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="/uploads/banners/example.mp4"
                    className="admin-banners-upload-input"
                  />
                  <label className={`admin-btn admin-btn-outline admin-banners-upload-button${isUploading ? ' is-uploading' : ''}`} htmlFor="banner-video-file">
                    {isUploading ? 'Uploading...' : 'Choose Video'}
                    <input
                      id="banner-video-file"
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileUpload(e, 'videoUrl')}
                      className="admin-banners-hidden-input"
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="banner-link-url">Link URL</label>
                  <input
                    id="banner-link-url"
                    type="text"
                    value={formData.linkUrl || ''}
                    onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="banner-sort-order">Sort Order</label>
                  <input
                    id="banner-sort-order"
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="banner-button-text">Button Text</label>
                  <input
                    id="banner-button-text"
                    type="text"
                    value={formData.buttonText || ''}
                    onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                    placeholder="Shop Now"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="banner-position">Position *</label>
                  <input
                    id="banner-position"
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="homepage"
                    required
                  />
                </div>
              </div>
              <label className="admin-banners-checkbox-group" htmlFor="isActive">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span>Active</span>
              </label>

              <div className="admin-modal-actions">
                <button type="button" onClick={closeModal} className="admin-btn admin-btn-outline">Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  {editingBanner ? 'Update Banner' : 'Save Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

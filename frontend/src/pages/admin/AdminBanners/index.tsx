import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import { getImageUrl } from '../../../utils/url';
import './AdminBanners.css';

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
    try {
      if (editingBanner) {
        await api.put(`/admin/banners/${editingBanner.id}`, formData);
        addToast('Banner updated successfully', 'success');
      } else {
        await api.post('/admin/banners', formData);
        addToast('Banner created successfully', 'success');
      }
      closeModal();
      fetchBanners();
    } catch (_err: any) {
      addToast(_err.response?.data?.message || 'Failed to save banner', 'error');
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Manage Banners</h1>
        <button onClick={openAddModal} className="admin-btn admin-btn-primary">
          <Plus size={16} /> Add Banner
        </button>
      </div>
      
      <div className="admin-table-container">
        {isLoading ? (
          <div className="admin-loading">Loading banners...</div>
        ) : (
          <div className="admin-banners-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Position</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => (
                  <tr key={banner.id}>
                    <td>
                      <div className="admin-td-image">
                        <img src={resolveSiteAssetUrl(banner.imageUrl) || banner.imageUrl} alt={banner.title} className="admin-banners-table-image" />
                      </div>
                    </td>
                    <td className="font-medium">{banner.title}</td>
                    <td><span className="admin-badge">{banner.position}</span></td>
                    <td>{banner.sortOrder}</td>
                    <td>
                      <span className={"admin-badge " + (banner.isActive ? 'admin-badge-success' : 'admin-badge-error')}>
                        {banner.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="admin-banners-actions">
                        <button
                          className="admin-action-btn admin-btn-edit"
                          onClick={() => openEditModal(banner)}
                          title="Edit Banner"
                          aria-label="Edit Banner"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="admin-action-btn admin-btn-delete"
                          onClick={() => handleDelete(banner.id)}
                          title="Delete Banner"
                          aria-label="Delete Banner"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-gray-500">
                      No banners found. Start by adding one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3>{editingBanner ? 'Edit Banner' : 'Add New Banner'}</h3>
              <button type="button" onClick={closeModal} className="admin-btn-icon" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-group">
                <label htmlFor="banner-title">Title <span className="text-red-500">*</span></label>
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
                <label htmlFor="banner-image-url">Image URL <span className="text-red-500">*</span></label>
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
                    className="admin-modal-image-preview admin-banners-preview-image"
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
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="banner-position">Position <span className="text-red-500">*</span></label>
                  <input
                    id="banner-position"
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="homepage"
                    required
                  />
                </div>
                <div className="admin-form-group admin-banners-checkbox-group">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <label htmlFor="isActive">Is Active</label>
                </div>
              </div>
              
              <div className="admin-modal-actions">
                <button type="button" onClick={closeModal} className="admin-btn admin-btn-secondary">
                  Cancel
                </button>
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

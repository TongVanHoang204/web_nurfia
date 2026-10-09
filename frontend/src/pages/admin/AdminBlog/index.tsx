import { translateUi, getLocale } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import WordEditor from '../../../components/WordEditor/WordEditor';
import AdminAiGeneratorButton from '../../../components/AdminAiGeneratorButton/AdminAiGeneratorButton';
import { useAdminConfirm } from '../../../components/AdminConfirmDialog/AdminConfirmDialog';
import { getImageUrl } from '../../../utils/url';
import './AdminBlog.css';

const getRichTextPlainValue = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeAssetInput = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  return trimmed;
};

export default function AdminBlog() {
  useTranslation();
  const [posts, setPosts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useUIStore();
  const { confirm, dialog: confirmDialog } = useAdminConfirm();

  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', content: '', image: '', author: '', category: '', isPublished: true
  });

  const fetchPosts = (page = 1) => {
    setIsLoading(true);
    api.get(`/admin/blog?page=${page}&limit=20`)
      .then(res => {
        setPosts(res.data.data);
        setPagination(res.data.pagination);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchPosts(); }, []);

  const openModal = (post?: any) => {
    if (post) {
      setEditingPost(post);
      setForm({
        title: post.title, slug: post.slug, excerpt: post.excerpt || '', content: post.content || '',
        image: post.image || '', author: post.author || '', category: post.category || '', isPublished: post.isPublished
      });
    } else {
      setEditingPost(null);
      setForm({ title: '', slug: '', excerpt: '', content: '', image: '', author: 'Admin', category: 'News', isPublished: true });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPost(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(prev => ({ ...prev, image: res.data.data.url }));
      addToast('Image uploaded successfully', 'success');
    } catch (_err) {
      addToast('Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.slug.trim() || !getRichTextPlainValue(form.content)) {
      addToast('Title, Slug, and Content are required and cannot be empty', 'error');
      return;
    }

    const payload = {
      ...form,
      image: normalizeAssetInput(form.image),
    };

    try {
      if (editingPost) {
        await api.put(`/admin/blog/${editingPost.id}`, payload);
        addToast('Blog post updated successfully', 'success');
      } else {
        await api.post('/admin/blog', payload);
        addToast('Blog post created successfully', 'success');
      }
      closeModal();
      fetchPosts(pagination.page);
    } catch (err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to save blog post', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const shouldDelete = await confirm({
      title: 'Delete blog post',
      message: 'This post will be permanently removed and cannot be recovered.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;

    try {
      await api.delete(`/admin/blog/${id}`);
      addToast('Blog post deleted', 'success');
      fetchPosts(pagination.page);
    } catch (err) {
      addToast('Failed to delete post', 'error');
    }
  };

  const blogAiContext = {
    title: form.title,
    slug: form.slug,
    category: form.category,
    author: form.author,
    excerpt: form.excerpt,
    content: form.content,
  };

  return (
    <div className="admin-blog-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{translateUi("Blog Posts")}</h1>
          <p className="admin-blog-subtitle">{translateUi("Create, edit, and manage your blog articles and content.")}</p>
        </div>
        <button className="admin-btn admin-btn-primary admin-blog-add-btn" onClick={() => openModal()}><Plus size={16} className="admin-blog-add-icon" /> {translateUi("Add New Post")}</button>
      </div>

      <div className="admin-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : posts.length === 0 ? (
          <div className="admin-blog-empty">{translateUi("No blog posts found.")}</div>
        ) : (
          <div className="admin-blog-table-wrap">
            <table className="admin-table admin-blog-table">
              <thead>
                <tr>
                  <th className="admin-blog-th-image">{translateUi("Image")}</th>
                  <th className="admin-blog-th-title">{translateUi("Title & Slug")}</th>
                  <th className="admin-blog-th-category">{translateUi("Category")}</th>
                  <th className="admin-blog-th-status">{translateUi("Status")}</th>
                  <th className="admin-blog-th-date">{translateUi("Published Date")}</th>
                  <th className="text-right admin-blog-th-actions">{translateUi("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id}>
                    <td className="admin-blog-image-cell">
                      {post.image ? <img src={getImageUrl(post.image)} alt={translateUi("Blog thumbnail")} className="admin-blog-img" /> : <div className="admin-blog-img-placeholder" />}
                    </td>
                    <td className="admin-blog-title-cell">
                      <div className="admin-blog-title">{post.title}</div>
                      <div className="admin-blog-slug">/{post.slug}</div>
                    </td>
                    <td>
                      <span className="admin-blog-category">{post.category || translateUi("Uncategorized")}</span>
                    </td>
                    <td>
                      <span className={`admin-blog-status-badge ${post.isPublished ? 'is-published' : 'is-draft'}`}>
                        {post.isPublished ? translateUi("Published") : translateUi("Draft")}
                      </span>
                    </td>
                    <td className="admin-blog-date">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(getLocale()) : translateUi("Not scheduled")}</td>
                    <td className="text-right">
                      <div className="admin-table-actions admin-blog-actions">
                        <button className="admin-action-btn" title={translateUi("Edit")} aria-label={translateUi("Edit")} onClick={() => openModal(post)}><Edit size={16} /></button>
                        <button className="admin-action-btn text-danger" title={translateUi("Delete")} aria-label={translateUi("Delete")} onClick={() => handleDelete(post.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content admin-blog-modal-large">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingPost ? translateUi("Edit Post") : translateUi("Add New Post")}</h2>
              <button type="button" className="admin-modal-close" title={translateUi("Close")} onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="title">{translateUi("Title")}</label>
                  <input id="title" title={translateUi("Title")} type="text" placeholder={translateUi("Enter post title")} value={form.title} onChange={e => setForm({...form, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')})} required />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="slug">{translateUi("Slug")}</label>
                  <input id="slug" title={translateUi("Slug")} type="text" placeholder="enter-post-slug" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="category">{translateUi("Category")}</label>
                  <input id="category" title={translateUi("Category")} type="text" placeholder={translateUi("News")} value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="author">{translateUi("Author")}</label>
                  <input id="author" title={translateUi("Author")} type="text" placeholder={translateUi("Admin")} value={form.author} onChange={e => setForm({...form, author: e.target.value})} />
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="image">{translateUi("Image URL")}</label>
                <div className="admin-blog-upload-row">
                  <input id="image" title={translateUi("Image URL")} type="text" placeholder="https://example.com/image.jpg" value={form.image} onChange={e => setForm({...form, image: e.target.value})} className="admin-blog-upload-input" />
                  <label className={`admin-btn admin-btn-outline admin-blog-upload-btn${isUploading ? ' is-uploading' : ''}`}>
                    {isUploading ? translateUi("Uploading...") : translateUi("Choose File")}
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="admin-blog-hidden-input" disabled={isUploading} />
                  </label>
                </div>
                {form.image && (
                  <div className="admin-blog-preview-container">
                    <img
                      src={getImageUrl(form.image)}
                      alt={translateUi("Preview")}
                      className="admin-blog-preview-image"
                    />
                    <button
                      type="button"
                      className="admin-blog-preview-remove"
                      title={translateUi("Remove image")}
                      onClick={() => setForm(prev => ({ ...prev, image: '' }))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-form-group">
                <div className="admin-ai-field-header">
                  <label htmlFor="excerpt">{translateUi("Excerpt")}</label>
                  <AdminAiGeneratorButton
                    target="BLOG_EXCERPT"
                    context={blogAiContext}
                    onGenerated={(text) => setForm((prev) => ({ ...prev, excerpt: text }))}
                    disabled={!form.title.trim()}
                  />
                </div>
                <WordEditor
                  id="excerpt"
                  ariaLabel="Excerpt"
                  value={form.excerpt}
                  onChange={(value) => setForm((prev) => ({ ...prev, excerpt: value }))}
                  placeholder={translateUi("Short description...")}
                  size="sm"
                />
              </div>

              <div className="admin-form-group">
                <div className="admin-ai-field-header">
                  <label htmlFor="content">{translateUi("Content")}</label>
                  <AdminAiGeneratorButton
                    target="BLOG_CONTENT"
                    context={blogAiContext}
                    onGenerated={(text) => setForm((prev) => ({ ...prev, content: text }))}
                    disabled={!form.title.trim()}
                    showPrompt
                    promptPlaceholder="Topic angle, outline, tone..."
                  />
                </div>
                <WordEditor
                  id="content"
                  ariaLabel="Content"
                  value={form.content}
                  onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                  placeholder={translateUi("Main blog content...")}
                  size="lg"
                />
              </div>

              <div className="admin-form-row admin-blog-publish-row">
                <label className="admin-blog-publish-label">
                  <input type="checkbox" id="isPublished" title={translateUi("Publish Post")} checked={form.isPublished} onChange={e => setForm({...form, isPublished: e.target.checked})} className="admin-blog-publish-checkbox" />
                  <span>{translateUi("Publish Post")}</span>
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={closeModal}>{translateUi("Cancel")}</button>
                <button type="submit" className="admin-btn admin-btn-primary">{editingPost ? translateUi("Update Post") : translateUi("Save Post")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

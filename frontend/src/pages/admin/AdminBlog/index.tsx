import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import WordEditor from '../../../components/WordEditor/WordEditor';
import './AdminBlog.css';

const getRichTextPlainValue = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export default function AdminBlog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useUIStore();

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
      setForm({ ...form, image: res.data.data.url });
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

    try {
      if (editingPost) {
        await api.put(`/admin/blog/${editingPost.id}`, form);
        addToast('Blog post updated successfully', 'success');
      } else {
        await api.post('/admin/blog', form);
        addToast('Blog post created successfully', 'success');
      }
      closeModal();
      fetchPosts(pagination.page);
    } catch (err: any) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to save blog post', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await api.delete(`/admin/blog/${id}`);
        addToast('Blog post deleted', 'success');
        fetchPosts(pagination.page);
      } catch (err) {
        addToast('Failed to delete post', 'error');
      }
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Blog Posts</h1>
        <button className="btn btn-primary admin-blog-add-btn" onClick={() => openModal()}><Plus size={16} className="admin-blog-add-icon" /> Add New Post</button>
      </div>

      <div className="admin-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : posts.length === 0 ? (
          <div className="admin-blog-empty">No blog posts found.</div>
        ) : (
          <div className="admin-blog-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="admin-blog-th-image">Image</th>
                  <th>Title & Slug</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Published Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id}>
                    <td>
                      {post.image ? <img src={post.image.startsWith('http') ? post.image : `http://localhost:4000${post.image}`} alt="Blog thumbnail" className="admin-blog-img" /> : <div className="admin-blog-img-placeholder" />}
                    </td>
                    <td>
                      <div className="admin-blog-title">{post.title}</div>
                      <div className="admin-blog-slug">/{post.slug}</div>
                    </td>
                    <td>{post.category || 'â€”'}</td>
                    <td>
                      {post.isPublished ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                    </td>
                    <td>{new Date(post.publishedAt).toLocaleDateString()}</td>
                    <td className="text-right">
                      <div className="admin-table-actions admin-blog-actions">
                        <button className="admin-action-btn" title="Edit" aria-label="Edit" onClick={() => openModal(post)}><Edit size={16} /></button>
                        <button className="admin-action-btn text-danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(post.id)}><Trash2 size={16} /></button>
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
              <h2 className="admin-modal-title">{editingPost ? 'Edit Post' : 'Add New Post'}</h2>
              <button className="admin-modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="title">Title</label>
                  <input id="title" title="Title" type="text" placeholder="Enter post title" value={form.title} onChange={e => setForm({...form, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')})} required />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="slug">Slug</label>
                  <input id="slug" title="Slug" type="text" placeholder="enter-post-slug" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required />
                </div>
              </div>
              
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="category">Category</label>
                  <input id="category" title="Category" type="text" placeholder="News" value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="author">Author</label>
                  <input id="author" title="Author" type="text" placeholder="Admin" value={form.author} onChange={e => setForm({...form, author: e.target.value})} />
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="image">Image URL</label>
                <div className="admin-blog-upload-row">
                  <input id="image" title="Image URL" type="text" placeholder="https://example.com/image.jpg" value={form.image} onChange={e => setForm({...form, image: e.target.value})} className="admin-blog-upload-input" />
                  <label className={`admin-btn admin-btn-outline admin-blog-upload-btn${isUploading ? ' is-uploading' : ''}`}>
                    {isUploading ? 'Uploading...' : 'Choose File'}
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="admin-blog-hidden-input" disabled={isUploading} />
                  </label>
                </div>
                {form.image && <img src={form.image.startsWith('http') ? form.image : `http://localhost:4000${form.image}`} alt="Preview" className="admin-modal-image-preview admin-blog-preview-image" onError={(e: any) => e.target.style.display = 'none'} />}
              </div>

              <div className="admin-form-group">
                <label htmlFor="excerpt">Excerpt</label>
                <WordEditor
                  id="excerpt"
                  ariaLabel="Excerpt"
                  value={form.excerpt}
                  onChange={(value) => setForm((prev) => ({ ...prev, excerpt: value }))}
                  placeholder="Short description..."
                  size="sm"
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="content">Content</label>
                <WordEditor
                  id="content"
                  ariaLabel="Content"
                  value={form.content}
                  onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                  placeholder="Main blog content..."
                  size="lg"
                />
              </div>

              <div className="admin-form-row admin-blog-publish-row">
                <label className="admin-blog-publish-label">
                  <input type="checkbox" id="isPublished" title="Publish Post" checked={form.isPublished} onChange={e => setForm({...form, isPublished: e.target.checked})} className="admin-blog-publish-checkbox" />
                  <span>Publish Post</span>
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary">{editingPost ? 'Update Post' : 'Save Post'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


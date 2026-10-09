import Select from '../../../components/Select/Select';
import { translateUi } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import WordEditor from '../../../components/WordEditor/WordEditor';
import './AdminCategories.css';

type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: number | null;
  image?: string | null;
  sortOrder: number;
  isActive: boolean;
  parent?: { name: string } | null;
  _count?: {
    products?: number;
    children?: number;
  };
};

type CategoryFilter = 'all' | 'root' | 'child' | 'active' | 'inactive' | 'has-children';

const createEmptyFormState = () => ({
  name: '',
  description: '',
  parentId: '' as number | '',
  image: '',
  sortOrder: 0,
  isActive: true,
});

export default function AdminCategories() {
  useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast, openConfirm } = useUIStore();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);

  // Listing state
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Form state
  const [formData, setFormData] = useState(createEmptyFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [hidePreview, setHidePreview] = useState(false);

  const categoriesById = useMemo(() => {
    const map = new Map<number, Category>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);

  const childMap = useMemo(() => {
    const map = new Map<number | null, Category[]>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(category);
    }

    for (const entry of map.values()) {
      entry.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
    }

    return map;
  }, [categories]);

  const rootCategories = useMemo(() => {
    const roots = childMap.get(null) || [];
    const orphans = categories.filter((category) => {
      if (category.parentId === null || category.parentId === undefined) return false;
      return !categoriesById.has(category.parentId);
    });

    return [...roots, ...orphans.filter((item) => !roots.some((root) => root.id === item.id))];
  }, [childMap, categories, categoriesById]);

  const parentCount = useMemo(() => categories.filter((category) => category.parentId == null).length, [categories]);
  const childCount = categories.length - parentCount;

  const getCategoryPathLabel = (category: Category) => {
    const names: string[] = [category.name];
    let cursorId = category.parentId;

    while (cursorId) {
      const parent = categoriesById.get(cursorId);
      if (!parent) break;
      names.unshift(parent.name);
      cursorId = parent.parentId ?? null;
    }

    return names.join(' / ');
  };

  const collectDescendantIds = (categoryId: number) => {
    const descendants = new Set<number>();
    const stack = [...(childMap.get(categoryId) || [])];

    while (stack.length) {
      const node = stack.pop();
      if (!node || descendants.has(node.id)) continue;
      descendants.add(node.id);
      const children = childMap.get(node.id) || [];
      stack.push(...children);
    }

    return descendants;
  };

  const blockedParentIds = useMemo(() => {
    if (!currentCategory) return new Set<number>();
    const descendants = collectDescendantIds(currentCategory.id);
    descendants.add(currentCategory.id);
    return descendants;
  }, [currentCategory, childMap]);

  const parentOptions = useMemo(() => {
    const options: Array<{ id: number; label: string }> = [];

    const walk = (nodes: Category[], depth: number) => {
      for (const category of nodes) {
        const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
        options.push({ id: category.id, label: `${prefix}${category.name}` });
        const children = childMap.get(category.id) || [];
        if (children.length) walk(children, depth + 1);
      }
    };

    walk(rootCategories, 0);
    return options;
  }, [rootCategories, childMap]);

  const visibleIds = useMemo(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    const ids = new Set<number>();

    const matchesFilter = (category: Category) => {
      switch (filter) {
        case 'root':
          return category.parentId == null;
        case 'child':
          return category.parentId != null;
        case 'active':
          return category.isActive;
        case 'inactive':
          return !category.isActive;
        case 'has-children':
          return Number(category._count?.children || 0) > 0;
        default:
          return true;
      }
    };

    const matchesSearch = (category: Category) => {
      if (!trimmed) return true;
      const haystack = [
        category.name,
        category.slug,
        category.description || '',
        getCategoryPathLabel(category),
      ].join(' ').toLowerCase();

      return haystack.includes(trimmed);
    };

    const includeAncestors = (category: Category) => {
      let cursorId = category.parentId;
      while (cursorId) {
        ids.add(cursorId);
        const parent = categoriesById.get(cursorId);
        cursorId = parent?.parentId ?? null;
      }
    };

    for (const category of categories) {
      if (matchesFilter(category) && matchesSearch(category)) {
        ids.add(category.id);
        includeAncestors(category);
      }
    }

    if (!searchTerm.trim() && filter === 'all') {
      categories.forEach((category) => ids.add(category.id));
    }

    return ids;
  }, [categories, categoriesById, filter, searchTerm]);

  const fetchCategories = () => {
    setIsLoading(true);
    api.get('/admin/categories')
      .then((r) => setCategories(r.data.data || []))
      .catch((err) => {
        console.error(err);
        addToast('Failed to load categories', 'error');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.size === 0) {
        categories.forEach((category) => {
          if (Number(category._count?.children || 0) > 0) {
            next.add(category.id);
          }
        });
      }
      return next;
    });
  }, [categories]);

  const resetFormState = () => {
    setFormData(createEmptyFormState());
    setIsEditing(false);
    setCurrentCategory(null);
    setFormError('');
    setHidePreview(false);
  };

  const handleDelete = async (id: number) => {
    openConfirm({
      title: 'Delete Category',
      message: 'Delete this category? Categories with children or linked products cannot be removed.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/categories/${id}`);
          addToast('Category deleted successfully', 'success');
          fetchCategories();
        } catch (err: any) {
          addToast(err.response?.data?.message || 'Failed to delete category', 'error');
        }
      }
    });
  };

  const handleToggleActive = async (category: Category) => {
    try {
      await api.put(`/admin/categories/${category.id}`, { isActive: !category.isActive });
      addToast(`Category ${category.isActive ? 'deactivated' : 'activated'} successfully`, 'success');
      fetchCategories();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update category status', 'error');
    }
  };

  const openAddModal = () => {
    resetFormState();
    setIsModalOpen(true);
  };

  const openAddChildModal = (parent: Category) => {
    resetFormState();
    setFormData((prev) => ({ ...prev, parentId: parent.id }));
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setIsEditing(true);
    setCurrentCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      image: category.image || '',
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
    });
    setFormError('');
    setHidePreview(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetFormState();
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(categories.filter((category) => Number(category._count?.children || 0) > 0).map((category) => category.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const toggleExpand = (categoryId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
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
      setFormData((prev) => ({ ...prev, image: res.data.data.url || '' }));
      setHidePreview(false);
      addToast('Image uploaded successfully', 'success');
    } catch (_err) {
      addToast('Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required');
      return;
    }

    if (isEditing && currentCategory && Number(formData.parentId) === currentCategory.id) {
      setFormError('A category cannot be its own parent');
      return;
    }

    if (isEditing && currentCategory && formData.parentId !== '' && blockedParentIds.has(Number(formData.parentId))) {
      setFormError('Cannot assign a descendant category as parent');
      return;
    }

    if (formData.sortOrder < 0 || isNaN(Number(formData.sortOrder))) {
      setFormError('Sort order must be a valid non-negative number');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const payload = {
      name: formData.name,
      description: formData.description,
      parentId: formData.parentId === '' ? null : Number(formData.parentId),
      image: formData.image,
      sortOrder: Number(formData.sortOrder),
      isActive: formData.isActive,
    };

    try {
      if (isEditing && currentCategory) {
        await api.put(`/admin/categories/${currentCategory.id}`, payload);
      } else {
        await api.post('/admin/categories', payload);
      }
      closeModal();
      fetchCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategoryNode = (category: Category, depth: number): React.ReactNode => {
    if (!visibleIds.has(category.id)) return null;

    const children = (childMap.get(category.id) || []).filter((child) => visibleIds.has(child.id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(category.id);
    const parentPath = getCategoryPathLabel(category).replace(`${category.name}`, '').replace(/\/$/, '').trim();
    const imageUrl = category.image ? resolveSiteAssetUrl(category.image) : '';

    return (
      <div key={category.id} className="category-tree-node">
        <div className="category-tree-row">
          <div className="category-tree-main">
            <div className="category-tree-indent" aria-hidden="true">
              {Array.from({ length: depth }).map((_, idx) => (
                <span key={`${category.id}-indent-${idx}`} className="category-tree-indent-dot" />
              ))}
            </div>

            <button
              type="button"
              className={`category-expand-btn ${hasChildren ? '' : 'is-hidden'}`}
              onClick={() => hasChildren && toggleExpand(category.id)}
              aria-label={isExpanded ? translateUi("Collapse category") : translateUi("Expand category")}
              title={isExpanded ? translateUi("Collapse category") : translateUi("Expand category")}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            <div className="category-tree-thumb-wrap">
              {imageUrl ? (
                <img src={imageUrl} alt={category.name} className="category-tree-thumb" />
              ) : (
                <span className="category-tree-thumb-fallback">{category.name.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="category-tree-info">
              <div className="category-tree-title-wrap">
                <strong className="category-tree-title">{category.name}</strong>
                <span className={`status-badge ${category.isActive ? 'status-delivered' : 'status-cancelled'}`}>
                  {category.isActive ? translateUi("Active") : translateUi("Inactive")}
                </span>
                {depth === 0 ? <span className="category-type-pill">{translateUi("Root")}</span> : <span className="category-type-pill category-type-pill-child">{translateUi("Child")}</span>}
              </div>
              <p className="category-tree-meta">
                <span>{translateUi("Slug:")} {category.slug}</span>
                <span>{translateUi("Products:")} {category._count?.products || 0}</span>
                <span>{translateUi("Children:")} {category._count?.children || 0}</span>
                <span>{translateUi("Sort:")} {category.sortOrder}</span>
              </p>
              {depth > 0 && parentPath ? <p className="category-tree-parent-path">{translateUi("Path:")} {getCategoryPathLabel(category)}</p> : null}
            </div>
          </div>

          <div className="category-tree-actions">
            <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openAddChildModal(category)}>
              <Plus size={12} />{translateUi("Child")}</button>
            <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEditModal(category)} aria-label={translateUi("Edit Category")} title={translateUi("Edit Category")}>
              <Edit2 size={12} />
            </button>
            <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => handleToggleActive(category)}>
              {category.isActive ? translateUi("Disable") : translateUi("Enable")}
            </button>
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(category.id)} aria-label={translateUi("Delete Category")} title={translateUi("Delete Category")}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div className="category-tree-children">
            {children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="category-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{translateUi("Categories")}</h1>
          <p className="category-admin-subtitle">{translateUi("Manage parent-child category structure and status in one place.")}</p>
        </div>
        <div className="category-admin-header-actions">
          <div className="category-admin-stats">
            <span>{translateUi("Total:")} {categories.length}</span>
            <span>{translateUi("Root:")} {parentCount}</span>
            <span>{translateUi("Child:")} {childCount}</span>
          </div>
          <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
            <Plus size={16} />{translateUi("Add Category")}</button>
        </div>
      </div>

      <div className="admin-card category-toolbar-card">
        <div className="category-toolbar-left">
          <div className="category-search-wrap">
            <Search size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={translateUi("Search by name, slug, or path")}
              title={translateUi("Search categories")}
            />
          </div>

          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as CategoryFilter)}
            title={translateUi("Filter categories")}
            className="category-filter-select"
          >
            <option value="all">{translateUi("All categories")}</option>
            <option value="root">{translateUi("Root only")}</option>
            <option value="child">{translateUi("Children only")}</option>
            <option value="active">{translateUi("Active only")}</option>
            <option value="inactive">{translateUi("Inactive only")}</option>
            <option value="has-children">{translateUi("Has children")}</option>
          </Select>
        </div>

        <div className="category-toolbar-right">
          <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleExpandAll}>{translateUi("Expand all")}</button>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleCollapseAll}>{translateUi("Collapse all")}</button>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={fetchCategories}>{translateUi("Refresh")}</button>
        </div>
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content category-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{isEditing ? translateUi("Edit Category") : translateUi("Add Category")}</h3>
              <button aria-label={translateUi("Close")} title={translateUi("Close modal")} type="button" onClick={closeModal} className="admin-modal-close">
                <X size={20} />
              </button>
            </div>

            {formError && <div className="admin-page-error category-form-error">{formError}</div>}

            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-form-row category-form-row-tight">
                <div className="admin-form-group">
                  <label htmlFor="categoryName">{translateUi("Name *")}</label>
                  <input
                    id="categoryName"
                    title={translateUi("Category Name")}
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={translateUi("e.g. T-Shirts")}
                    required
                  />
                </div>

                <div className="admin-form-group category-status-group">
                  <label htmlFor="categoryStatus">{translateUi("Status")}</label>
                  <label className="category-status-toggle" htmlFor="categoryStatus">
                    <input
                      id="categoryStatus"
                      title={translateUi("Category Status")}
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <span>{formData.isActive ? translateUi("Active") : translateUi("Inactive")}</span>
                  </label>
                </div>
              </div>

              <div className="admin-form-row category-form-row-tight">
                <div className="admin-form-group">
                  <label htmlFor="parentId">{translateUi("Parent Category")}</label>
                  <Select
                    id="parentId"
                    title={translateUi("Parent Category")}
                    value={formData.parentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, parentId: e.target.value === '' ? '' : Number(e.target.value) }))}
                  >
                    <option value="">{translateUi("None (Top Level)")}</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id} disabled={blockedParentIds.has(option.id)}>
                        {translateUi(option.label)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="sortOrder">{translateUi("Sort Order")}</label>
                  <input
                    id="sortOrder"
                    title={translateUi("Sort Order")}
                    type="number"
                    min="0"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="description">{translateUi("Description")}</label>
                <WordEditor
                  id="description"
                  ariaLabel="Category Description"
                  value={formData.description}
                  onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                  placeholder={translateUi("Optional description")}
                  size="sm"
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="imageUrl">{translateUi("Image URL")}</label>
                <div className="category-image-input-row">
                  <input
                    id="imageUrl"
                    title={translateUi("Image URL")}
                    type="text"
                    value={formData.image}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, image: e.target.value }));
                      setHidePreview(false);
                    }}
                    placeholder="https://example.com/image.jpg"
                  />

                  <label className={`admin-btn admin-btn-outline category-upload-btn ${isUploading ? 'is-uploading' : ''}`}>
                    {isUploading ? translateUi("Uploading...") : translateUi("Choose File")}
                    <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                  </label>
                </div>

                {formData.image && !hidePreview ? (
                  <div className="category-image-preview-wrap">
                    <img
                      src={resolveSiteAssetUrl(formData.image)}
                      alt={translateUi("Category preview")}
                      className="category-image-preview"
                      onError={() => setHidePreview(true)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="admin-modal-actions">
                <button type="button" onClick={closeModal} className="admin-btn admin-btn-secondary" disabled={isSubmitting}>{translateUi("Cancel")}</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? translateUi("Saving...") : (isEditing ? translateUi("Update Category") : translateUi("Create Category"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-card category-tree-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : (
          <>
            {categories.length === 0 ? (
              <p className="category-empty-state">{translateUi("No categories found. Create one to get started.")}</p>
            ) : rootCategories.filter((root) => visibleIds.has(root.id)).length === 0 ? (
              <p className="category-empty-state">{translateUi("No categories match your current search/filter.")}</p>
            ) : (
              <div className="category-tree-list">
                {rootCategories
                  .filter((root) => visibleIds.has(root.id))
                  .map((root) => renderCategoryNode(root, 0))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


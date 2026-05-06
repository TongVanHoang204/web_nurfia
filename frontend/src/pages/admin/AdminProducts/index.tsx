import { useState, useEffect, useMemo, Fragment } from 'react';
import { Plus, Edit2, Trash2, X, Search, Zap, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import WordEditor from '../../../components/WordEditor/WordEditor';
import { getImageUrl } from '../../../utils/url';
import './AdminProducts.css';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useUIStore();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [sortFilter] = useState('Newest');
  
  const filteredProducts = products.filter(p => {
    if (statusFilter !== 'All') {
      if (statusFilter === 'Active' && !p.isActive) return false;
      if (statusFilter === 'Inactive' && p.isActive) return false;
    }

    if (brandFilter !== 'All') {
      if (brandFilter === 'Unassigned') {
        if (p.brandId || p.brand?.id) return false;
      } else if (String(p.brand?.slug || '') !== brandFilter) {
        return false;
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!p.name.toLowerCase().includes(term) && !p.sku.toLowerCase().includes(term)) return false;
    }
    return true;
  }).sort((a: any, b: any) => {
    if (sortFilter === 'PriceLow') return Number(a.price) - Number(b.price);
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return addToast('Please select at least one product to delete', 'error');
    if (!confirm(`Delete ${selectedIds.length} selected products?`)) return;
    
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/admin/products/${id}`)));
      addToast('Selected products deleted successfully', 'success');
      setSelectedIds([]);
      fetchProducts(pagination.page);
    } catch {
      addToast('Failed to delete selected products', 'error');
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);


  const [formData, setFormData] = useState({
    name: '', sku: '', shortDescription: '', description: '',
    price: '', salePrice: '', stock: '0', categoryId: '', brandId: '',
    isFeatured: false, isActive: true, images: [] as string[], variants: [] as any[], autoGenerateVariantSku: true
  });

  const [isVariantsExpanded, setIsVariantsExpanded] = useState(true);

  const hasVariantStocks = Array.isArray(formData.variants) && formData.variants.length > 0;
  const totalStockFromVariants = hasVariantStocks
    ? formData.variants.reduce((sum: number, variant: any) => {
      const variantStock = Number(variant?.stock);
      return sum + (Number.isInteger(variantStock) && variantStock > 0 ? variantStock : 0);
    }, 0)
    : 0;

  const fetchProducts = (page = 1) => {
    setIsLoading(true);
    api.get(`/admin/products?page=${page}&limit=15`)
      .then(r => { setProducts(r.data.data); setPagination(r.data.pagination); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  const fetchCategories = () => {
    api.get('/admin/categories?limit=100').then(r => setCategories(r.data.data)).catch(console.error);
  };

  const fetchBrands = () => {
    api.get('/admin/brands').then(r => setBrands(r.data.data || [])).catch(console.error);
  };

  const fetchAttributes = () => {
    api.get('/admin/attributes').then(r => setAttributes(r.data.data)).catch(console.error);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); fetchBrands(); fetchAttributes(); }, []);

  const hierarchicalCategories = useMemo(() => {
    const roots = categories.filter(c => !c.parentId);
    const result: any[] = [];
    
    const traverse = (parentId: number, level: number) => {
      const children = categories.filter(c => c.parentId === parentId);
      children.forEach(child => {
        result.push({
          ...child,
          displayName: `${"\u00A0".repeat(level * 4)}\u2014 ${child.name}`
        });
        traverse(child.id, level + 1);
      });
    };

    roots.forEach(root => {
      result.push({ ...root, displayName: root.name });
      traverse(root.id, 1);
    });

    return result.length > 0 ? result : categories;
  }, [categories]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', sku: '', shortDescription: '', description: '', price: '', salePrice: '', stock: '0', categoryId: '', brandId: '', isFeatured: false, isActive: true, images: [] as string[], variants: [] as any[], autoGenerateVariantSku: true });

    setIsModalOpen(true);
  };

  const openEditModal = async (p: any) => {
    setEditingProduct(p);
    setIsModalOpen(true);


    try {
      const res = await api.get(`/admin/products/${p.id}`);
      const fullProduct = res.data.data;

      const colorAttr = attributes.find((attribute: any) => {
        const name = normalizeAttributeLabel(attribute?.name);
        const slug = normalizeAttributeLabel(attribute?.slug);
        return slug === 'color' || name === 'color' || name.includes('mau');
      });

      const sizeAttr = attributes.find((attribute: any) => {
        const name = normalizeAttributeLabel(attribute?.name);
        const slug = normalizeAttributeLabel(attribute?.slug);
        return slug === 'size' || name === 'size' || name.includes('kich');
      });

      const loadedVariants = fullProduct.variants ? fullProduct.variants.map((v: any) => {
        const formAttrs: (number | '')[] = ['', ''];
        if (v.attributes) {
          v.attributes.forEach((va: any) => {
            const valId = va.attributeValueId;
            const includedName = normalizeAttributeLabel(va.attributeValue?.attribute?.name);
            const includedSlug = normalizeAttributeLabel(va.attributeValue?.attribute?.slug);

            if (includedSlug === 'color' || includedName === 'color' || includedName.includes('mau')) {
              formAttrs[0] = valId;
            } else if (includedSlug === 'size' || includedName === 'size' || includedName.includes('kich')) {
              formAttrs[1] = valId;
            } else {
              if (colorAttr?.values.some((val: any) => val.id === valId || val.id === Number(valId))) formAttrs[0] = Number(valId);
              if (sizeAttr?.values.some((val: any) => val.id === valId || val.id === Number(valId))) formAttrs[1] = Number(valId);
            }
          });
        }
        return {
          id: v.id, sku: v.sku, price: v.price || '', salePrice: v.salePrice || '', stock: v.stock || 0,
          attributes: formAttrs
        };
      }) : [];

      setFormData({
        name: fullProduct.name, sku: fullProduct.sku,
        shortDescription: fullProduct.shortDescription || '',
        description: fullProduct.description || '',
        price: fullProduct.price, salePrice: fullProduct.salePrice || '',
        stock: fullProduct.stock, categoryId: fullProduct.categoryId || '',
        brandId: fullProduct.brandId || '',
        isFeatured: fullProduct.isFeatured, isActive: fullProduct.isActive,
        images: fullProduct.images ? fullProduct.images.map((i: any) => i.url) : [] as string[],
        variants: loadedVariants,
        autoGenerateVariantSku: false,
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to load product details';
      addToast(String(message), 'error');
      setIsModalOpen(false);
    } finally {

    }
  };

  const closeModal = () => setIsModalOpen(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append('image', files[i]);
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.data.url) uploadedUrls.push(res.data.data.url);
      }
      setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
      addToast('Images uploaded successfully', 'success');
    } catch {
      addToast('Failed to upload images', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setFormData(prev => ({ ...prev, images: prev.images.filter(img => img !== url) }));
  };



  const normalizeAttributeLabel = (v: any) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const normalizeAttributeId = (v: any) => { const p = Number(v); return Number.isInteger(p) && p > 0 ? p : null; };

  const resolveVariantAxes = () => {
    const colorAttribute = attributes.find(a => {
      const name = normalizeAttributeLabel(a?.name);
      const slug = normalizeAttributeLabel(a?.slug);
      return slug === 'color' || name === 'color' || name.includes('mau');
    });
    const sizeAttribute = attributes.find(a => {
      const name = normalizeAttributeLabel(a?.name);
      const slug = normalizeAttributeLabel(a?.slug);
      return slug === 'size' || name === 'size' || name.includes('kich');
    });
    return {
      colorAttr: colorAttribute || null,
      sizeAttr: sizeAttribute || null,
      colorValues: Array.isArray(colorAttribute?.values) ? colorAttribute.values : [],
      sizeValues: Array.isArray(sizeAttribute?.values) ? sizeAttribute.values : [],
    };
  };

  const { colorAttr, sizeAttr, colorValues: variantColorValues, sizeValues: variantSizeValues } = resolveVariantAxes();

  // Build set of currently existing variant combos (colorId-sizeId)
  const existingVariantKeys = useMemo(() => {
    const keys = new Set<string>();
    (formData.variants || []).forEach((v: any) => {
      const c = normalizeAttributeId(v?.attributes?.[0]);
      const s = normalizeAttributeId(v?.attributes?.[1]);
      if (c && s) keys.add(`${c}-${s}`);
    });
    return keys;
  }, [formData.variants]);

  // Find duplicate SKUs within variants
  const duplicateSkuIndices = useMemo(() => {
    const indices = new Set<number>();
    const seen = new Map<string, number>();
    (formData.variants || []).forEach((v: any, idx: number) => {
      const sku = String(v.sku || '').trim();
      if (!sku) return;
      const lower = sku.toLowerCase();
      if (seen.has(lower)) {
        indices.add(seen.get(lower)!);
        indices.add(idx);
      } else {
        seen.set(lower, idx);
      }
    });
    return indices;
  }, [formData.variants]);

  const duplicateSkuCount = duplicateSkuIndices.size > 0 ? duplicateSkuIndices.size : 0;
  const toggleVariantCombo = (colorId: number, sizeId: number, colorName: string, sizeName: string) => {
    const key = `${colorId}-${sizeId}`;
    const exists = existingVariantKeys.has(key);
    if (exists) {
      setFormData(prev => ({
        ...prev,
        variants: prev.variants.filter((v: any) => {
          const c = normalizeAttributeId(v?.attributes?.[0]);
          const s = normalizeAttributeId(v?.attributes?.[1]);
          return !(c === colorId && s === sizeId);
        }),
      }));
    } else {
      const autoSku = formData.autoGenerateVariantSku && formData.sku
        ? generateVariantSku(formData.sku, colorName, sizeName)
        : '';
      setFormData(prev => ({
        ...prev,
        variants: [...prev.variants, { sku: autoSku, stock: 0, price: '', salePrice: '', attributes: [colorId, sizeId] }],
      }));
    }
  };

  // Generate SKU suffix from color+size abbreviations
  const abbreviate = (name: string): string => {
    if (!name) return '';
    const parts = name.trim().split(/[\s/-]+/);
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return parts.map(p => p.charAt(0).toUpperCase()).join('').substring(0, 4);
  };

  const generateVariantSku = (baseSku: string, colorName: string, sizeName: string) => {
    const colorCode = abbreviate(colorName);
    const sizeCode = abbreviate(sizeName);
    const suffixes = [colorCode, sizeCode].filter(Boolean);
    return suffixes.length > 0 ? `${baseSku}-${suffixes.join('-')}` : baseSku;
  };

  // Map common color names to hex values for the color swatch
  const colorNameToHex: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ef4444', blue: '#3b82f6',
    green: '#22c55e', yellow: '#eab308', purple: '#a855f7', pink: '#ec4899',
    orange: '#f97316', brown: '#92400e', gray: '#6b7280', grey: '#6b7280',
    silver: '#c0c0c0', gold: '#d4a017', navy: '#1e3a5f', beige: '#f5f5dc',
    cream: '#fffdd0', khaki: '#c3b091', coral: '#ff7f50', teal: '#0d9488',
    cyan: '#06b6d4', indigo: '#6366f1', violet: '#8b5cf6', maroon: '#800000',
    tan: '#d2b48c', ivory: '#fffff0', mint: '#98fb98', lavender: '#e6e6fa',
  };

  const getColorHex = (name: string): string => {
    // First check if the color attribute value has a colorHex from API
    if (colorAttr?.values) {
      const match = colorAttr.values.find((av: any) => {
        const avName = String(av.value || '').toLowerCase().trim();
        const inputName = String(name || '').toLowerCase().trim();
        return avName === inputName && av.colorHex;
      });
      if (match?.colorHex) return match.colorHex;
    }
    // Fallback: map common color names
    const lower = name?.toLowerCase().trim() || '';
    return colorNameToHex[lower] || '#cccccc';
  };

  // Regenerate all variant SKUs from matrix labels
  const regenerateAllSkus = () => {
    if (!formData.sku) return;
    const colorMap = new Map<number, string>();
    variantColorValues.forEach((cv: any) => {
      const id = normalizeAttributeId(cv?.id);
      if (id) colorMap.set(id, cv.value || String(cv.id));
    });
    const sizeMap = new Map<number, string>();
    variantSizeValues.forEach((sv: any) => {
      const id = normalizeAttributeId(sv?.id);
      if (id) sizeMap.set(id, sv.value || String(sv.id));
    });
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v: any) => ({
        ...v,
        sku: generateVariantSku(prev.sku, (colorMap.get(normalizeAttributeId(v?.attributes?.[0]) as number) || ''), (sizeMap.get(normalizeAttributeId(v?.attributes?.[1]) as number) || '')),
      })),
    }));
  };

  const buildVariantsWithMissingColorSize = (sourceVariants: any[], autoGenerateSku: boolean) => {
    const { colorValues, sizeValues } = resolveVariantAxes();
    const existingKeys = new Set<string>();
    const normalizedVariants = sourceVariants.map(v => {
      const colorId = normalizeAttributeId(v?.attributes?.[0]);
      const sizeId = normalizeAttributeId(v?.attributes?.[1]);
      if (colorId && sizeId) existingKeys.add(`${colorId}-${sizeId}`);
      return { ...v, sku: autoGenerateSku ? '' : String(v?.sku || '').trim(), stock: Number(v?.stock) || 0, price: v?.price ?? '', salePrice: v?.salePrice ?? '', attributes: [colorId || '', sizeId || ''] };
    });

    if (!colorValues.length || !sizeValues.length) return { variants: normalizedVariants, addedCount: 0, canGenerate: false };

    const missingVariants: any[] = [];
    for (const cv of colorValues) {
      const colorId = normalizeAttributeId(cv?.id);
      if (!colorId) continue;
      for (const sv of sizeValues) {
        const sizeId = normalizeAttributeId(sv?.id);
        if (!sizeId) continue;
        const key = `${colorId}-${sizeId}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        missingVariants.push({ sku: '', stock: 0, price: '', salePrice: '', attributes: [colorId, sizeId] });
      }
    }
    return { variants: [...normalizedVariants, ...missingVariants], addedCount: missingVariants.length, canGenerate: true };
  };





  const addVariant = () => {
    setFormData({ ...formData, variants: [...formData.variants, { sku: formData.autoGenerateVariantSku ? '' : `${formData.sku ? formData.sku + '-' : ''}V${formData.variants.length + 1}`, stock: 0, price: '', salePrice: '', attributes: [] }] });
  };

  const removeVariant = (i: number) => {
    const newVariants = [...formData.variants];
    newVariants.splice(i, 1);
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariant = (i: number, f: string, val: any) => {
    const newVariants = [...formData.variants];
    newVariants[i][f] = val;
    setFormData({ ...formData, variants: newVariants });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const saveFormData = formData.autoGenerateVariantSku ? { ...formData, variants: buildVariantsWithMissingColorSize(formData.variants, true).variants } : formData;
    
    try {
      const payload: any = { ...saveFormData, price: Number(saveFormData.price), stock: hasVariantStocks ? totalStockFromVariants : Number(saveFormData.stock) };
      if (saveFormData.salePrice) payload.salePrice = Number(saveFormData.salePrice);
      if (saveFormData.categoryId) payload.categoryId = Number(saveFormData.categoryId);
      payload.brandId = saveFormData.brandId ? Number(saveFormData.brandId) : null;
      if (saveFormData.images?.length) payload.images = saveFormData.images.map((url: string) => ({ url, alt: saveFormData.name }));
      
      if (payload.variants?.length) {
        payload.variants = payload.variants.map((v: any) => ({
          ...v,
          price: Number(v.price) || payload.price,
          salePrice: Number(v.salePrice) || null,
          stock: Number(v.stock),
          attributes: v.attributes.map((id: any) => Number(id)).filter((id: any) => id > 0)
        }));
      }

      if (editingProduct) await api.put(`/admin/products/${editingProduct.id}`, payload);
      else await api.post('/admin/products', payload);
      
      addToast('Saved successfully', 'success');
      closeModal();
      fetchProducts(pagination.page);
    } catch (err: any) {
      addToast('Failed to save', 'error');
    }
  };

  const handleQuickBrandChange = async (p: any, next: string) => {
    try {
      const brandId = next ? Number(next) : null;
      await api.put(`/admin/products/${p.id}`, { brandId });
      fetchProducts(pagination.page);
      addToast('Brand updated', 'success');
    } catch { addToast('Update failed', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      addToast('Deleted', 'success');
      fetchProducts(pagination.page);
    } catch { addToast('Delete failed', 'error'); }
  };

  return (
    <div className="admin-products-page">
      <header className="admin-products-header">
        <div>
          <h1 className="admin-page-title">Product Catalog</h1>
          <p className="admin-order-badge-stat"><span>Inventory Status:</span> <strong>{pagination.total} Items Listed</strong></p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAddModal}><Plus size={16} className="mr-2" /> Add New Product</button>
      </header>

      <div className="ap-toolbar">
        <div className="ap-search-box">
          <Search size={18} className="ap-search-icon" />
          <input type="text" placeholder="Search by name or SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        
        <div className="ap-toolbar-actions">
          {selectedIds.length > 0 && (
            <button className="btn btn-error btn-sm" onClick={handleBulkDelete}>Delete Selected ({selectedIds.length})</button>
          )}
          <div className="ap-filter-group">
            <span className="ap-filter-label">Status</span>
            <select className="ap-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} title="Filter by Status">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="ap-filter-group">
            <span className="ap-filter-label">Brand</span>
            <select className="ap-filter-select" value={brandFilter} onChange={e => setBrandFilter(e.target.value)} title="Filter by Brand">
              <option value="All">All Brands</option>
              {brands.map((b: any) => <option key={b.id} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="ap-table-wrap">
        <table className="ap-table">
          <thead>
            <tr>
              <th className="w-10"><input type="checkbox" title="Select all products" checked={selectedIds.length > 0 && selectedIds.length === filteredProducts.length} onChange={e => setSelectedIds(e.target.checked ? filteredProducts.map(p => p.id) : [])} /></th>
              <th>Product Information</th>
              <th>SKU</th>
              <th>Quick Brand</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center"><div className="spinner" /></td></tr> : filteredProducts.map(p => (
              <tr key={p.id}>
                <td><input type="checkbox" title={`Select ${p.name}`} checked={selectedIds.includes(p.id)} onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, p.id] : selectedIds.filter(id => id !== p.id))} /></td>
                <td>
                  <div className="ap-product-cell">
                    <div className="ap-product-img-box">
                      <img src={getImageUrl(p.images?.[0]?.url || '')} alt="" className="ap-product-img" />
                    </div>
                    <div className="ap-product-info">
                      <strong className="ap-product-name">{p.name}</strong>
                      <span className="ap-product-category">{p.category?.name || 'General'}</span>
                    </div>
                  </div>
                </td>
                <td className="ap-text-muted">{p.sku}</td>
                <td>
                  <select className="ap-filter-select min-w-[120px]" title="Quick Select Brand" value={p.brandId || ''} onChange={e => handleQuickBrandChange(p, e.target.value)}>
                    <option value="">Unassigned</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td><strong className="ap-price-bold">${Number(p.salePrice || p.price).toFixed(0)}</strong></td>
                <td><span className={`ap-badge ${p.stock < 10 ? 'ap-badge-inactive' : 'ap-badge-active'}`}>{p.stock} Units</span></td>
                <td><span className={`ap-badge ${p.isActive ? 'ap-badge-active' : 'ap-badge-inactive'}`}>{p.isActive ? 'Live' : 'Hidden'}</span></td>
                <td className="text-right">
                  <div className="ap-btn-group">
                    <button type="button" className="ap-action-btn" title="Edit Product" aria-label="Edit Product" onClick={() => openEditModal(p)}><Edit2 size={14} /></button>
                    <button type="button" className="ap-action-btn ap-action-btn-danger" title="Delete Product" aria-label="Delete Product" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ap-footer">
        <span className="ap-footer-text">Showing <strong>{filteredProducts.length}</strong> of <strong>{pagination.total}</strong> products</span>
        <div className="ap-pagination">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`ap-page-btn ${p === pagination.page ? 'ap-page-active' : ''}`} onClick={() => fetchProducts(p)}>{p}</button>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content max-w-[900px]">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingProduct ? 'Update Product' : 'Create New Product'}</h2>
              <button type="button" className="admin-modal-close" title="Close Modal" aria-label="Close Modal" onClick={closeModal}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="product-title">Title</label>
                  <input id="product-title" type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} title="Product Title" />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="product-sku">SKU</label>
                  <input id="product-sku" type="text" required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} title="Product SKU" />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="product-base-price">Base Price</label>
                  <input id="product-base-price" type="number" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} title="Base Price" />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="product-sale-price">Sale Price</label>
                  <input id="product-sale-price" type="number" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} title="Sale Price" />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="product-category">Category</label>
                  <select id="product-category" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} title="Product Category">
                    <option value="">Select Category</option>
                    {hierarchicalCategories.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label htmlFor="product-brand">Brand</label>
                  <select id="product-brand" value={formData.brandId} onChange={e => setFormData({...formData, brandId: e.target.value})} title="Product Brand">
                    <option value="">Unassigned</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="product-short-desc">Short Description</label>
                <textarea id="product-short-desc" rows={3} value={formData.shortDescription} onChange={e => setFormData({...formData, shortDescription: e.target.value})} placeholder="Brief summary of the product..." title="Short Description" />
              </div>

              <div className="admin-form-group">
                <label>Full Description</label>
                <WordEditor value={formData.description} onChange={v => setFormData({...formData, description: v})} />
              </div>

              <div className="admin-form-group">
                <label>Product Images</label>
                <div className="ap-image-grid">
                  {formData.images.map((url, idx) => (
                    <div key={idx} className="ap-image-item">
                      <img src={getImageUrl(url)} alt="" />
                      <button type="button" className="ap-image-remove" title="Remove Image" aria-label="Remove Image" onClick={() => removeImage(url)}><X size={12} /></button>
                    </div>
                  ))}
                  <label className="ap-image-upload" title="Upload Image">
                    {isUploading ? <div className="spinner" /> : <Upload size={24} />}
                    <input type="file" title="Upload Image Input" multiple accept="image/*" hidden onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="ap-variant-toggle">
                <div className="ap-variant-toggle-header">
                  <div className="ap-variant-toggle-title"
                    onClick={() => setIsVariantsExpanded(!isVariantsExpanded)}
                  >
                    <h3>Variants & Inventory</h3>
                    {isVariantsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                  <div className="ap-variant-toggle-actions">
                    <label className="ap-variant-auto-label">
                      <input type="checkbox" checked={formData.autoGenerateVariantSku} onChange={e => setFormData({...formData, autoGenerateVariantSku: e.target.checked})} />
                      Auto SKU
                    </label>
                    {variantColorValues.length > 0 && variantSizeValues.length > 0 && (
                      <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" title="Generate All Formats" aria-label="Generate All Variants" onClick={() => {
                        const result = buildVariantsWithMissingColorSize(formData.variants, formData.autoGenerateVariantSku);
                        setFormData({...formData, variants: result.variants});
                        if (result.addedCount > 0) addToast(`Generated ${result.addedCount} missing variant(s)`, 'success');
                        else addToast('All color×size combinations already exist', 'info');
                      }}>
                        <Zap size={13} /> Generate All
                      </button>
                    )}
                  </div>
                </div>
                {isVariantsExpanded && variantColorValues.length > 0 && variantSizeValues.length > 0 && (
                  <div className="ap-variant-matrix">
                    <div className="ap-matrix-header">
                      <div className="ap-matrix-title">
                        <h4>{colorAttr?.name || 'Color'} <span className="ap-matrix-times">×</span> {sizeAttr?.name || 'Size'}</h4>
                        <span className="ap-matrix-count">{existingVariantKeys.size} / {variantColorValues.length * variantSizeValues.length} selected</span>
                      </div>
                      <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={regenerateAllSkus} title="Regenerate SKUs from matrix labels">
                        <Zap size={13} /> Regenerate SKUs
                      </button>
                    </div>
                    <div className="ap-matrix-grid" style={{ gridTemplateColumns: `140px repeat(${variantSizeValues.length}, 1fr)` }}>
                      {/* Corner cell */}
                      <div className="ap-matrix-corner">{colorAttr?.name || 'Color'} ↓ / {sizeAttr?.name || 'Size'} →</div>
                      {/* Size column headers */}
                      {variantSizeValues.map((sv: any) => (
                        <div key={sv.id} className="ap-matrix-col-header">{sv.value}</div>
                      ))}
                      {/* Color rows */}
                      {variantColorValues.map((cv: any) => {
                        const colorId = normalizeAttributeId(cv?.id);
                        return (
                          <Fragment key={cv.id}>
                            <div className="ap-matrix-row-header">
                              <span className="ap-color-swatch" style={{ backgroundColor: getColorHex(cv.value) }}></span>
                              {cv.value}
                            </div>
                            {variantSizeValues.map((sv: any) => {
                              const sizeId = normalizeAttributeId(sv?.id);
                              const key = colorId && sizeId ? `${colorId}-${sizeId}` : '';
                              const isChecked = key ? existingVariantKeys.has(key) : false;
                              return (
                                <div
                                  key={`${cv.id}-${sv.id}`}
                                  className={`ap-matrix-cell ${isChecked ? 'checked' : ''}`}
                                  onClick={() => { if (colorId && sizeId) toggleVariantCombo(colorId, sizeId, cv.value, sv.value); }}
                                  title={`${cv.value} - ${sv.value}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    aria-label={`${cv.value} - ${sv.value}`}
                                  />
                                  {isChecked && <span className="ap-matrix-cell-label">{sv.value}</span>}
                                </div>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isVariantsExpanded && (
                  <div className="ap-variant-list">
                    {duplicateSkuCount > 0 && (
                      <div className="ap-variant-warning">
                        ⚠️ {duplicateSkuCount} duplicate SKU(s) detected. Each variant must have a unique SKU.
                      </div>
                    )}
                    {formData.variants.map((v, idx) => {
                      const isSkuDuplicate = duplicateSkuIndices.has(idx);
                      return (
                    <div key={idx} className="ap-variant-row">
                      <div className="admin-form-group">
                        <label htmlFor={`v-sku-${idx}`}>SKU</label>
                        <input
                          id={`v-sku-${idx}`}
                          type="text"
                          value={v.sku}
                          onChange={e => updateVariant(idx, 'sku', e.target.value)}
                          disabled={formData.autoGenerateVariantSku}
                          title="Variant SKU"
                          className={isSkuDuplicate ? 'ap-input-error' : ''}
                        />
                      </div>
                      <div className="admin-form-group"><label htmlFor={`v-stock-${idx}`}>Stock</label><input id={`v-stock-${idx}`} type="number" value={v.stock} onChange={e => updateVariant(idx, 'stock', e.target.value)} title="Variant Stock" /></div>
                      <div className="admin-form-group"><label htmlFor={`v-price-${idx}`}>Price</label><input id={`v-price-${idx}`} type="number" value={v.price} onChange={e => updateVariant(idx, 'price', e.target.value)} placeholder="Default" title="Variant Price" /></div>
                      <div className="admin-form-group"><label htmlFor={`v-sale-${idx}`}>Sale</label><input id={`v-sale-${idx}`} type="number" value={v.salePrice} onChange={e => updateVariant(idx, 'salePrice', e.target.value)} placeholder="None" title="Variant Sale Price" /></div>
                      <button type="button" className="ap-action-btn ap-action-btn-danger" title="Remove Variant" aria-label="Remove Variant" onClick={() => removeVariant(idx)}><Trash2 size={16} /></button>
                    </div>
                    );
                    })}
                    <button type="button" className="ap-add-variant-btn" onClick={addVariant}><Plus size={14} /> Add Variant</button>
                </div>
                )}
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingProduct ? 'Update Product' : 'Create Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

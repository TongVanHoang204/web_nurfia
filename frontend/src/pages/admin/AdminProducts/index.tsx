import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, Eye, ChevronDown } from 'lucide-react';
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
  const { addToast } = useUIStore();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [sortFilter, setSortFilter] = useState('Newest');
  
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
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isVariantsExpanded, setIsVariantsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    name: '', sku: '', shortDescription: '', description: '',
    price: '', salePrice: '', stock: '0', categoryId: '', brandId: '',
    isFeatured: false, isActive: true, images: [] as string[], variants: [] as any[], autoGenerateVariantSku: true
  });

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

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', sku: '', shortDescription: '', description: '', price: '', salePrice: '', stock: '0', categoryId: '', brandId: '', isFeatured: false, isActive: true, images: [] as string[], variants: [] as any[], autoGenerateVariantSku: true });
    setIsVariantsExpanded(false);
    setIsModalOpen(true);
  };

  const openEditModal = async (p: any) => {
    setEditingProduct(p);
    setIsModalOpen(true);
    setIsVariantsExpanded(false);
    setIsLoadingProduct(true);

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
      setIsLoadingProduct(false);
    }
  };


  const closeModal = () => setIsModalOpen(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const newImages = [...formData.images];
    let successCount = 0;
    let failedCount = 0;
    
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        try {
          const res = await api.post('/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (res?.data?.data?.url) {
            newImages.push(res.data.data.url);
            successCount += 1;
          } else {
            failedCount += 1;
          }
        } catch (err: any) {
          failedCount += 1;
          const uploadError = err?.response?.data?.error || err?.response?.data?.message || 'Upload failed';
          addToast(`Failed to upload ${file.name}: ${uploadError}`, 'error');
        }
      }

      setFormData((prev) => ({ ...prev, images: newImages }));

      if (successCount > 0 && failedCount === 0) {
        addToast(`Uploaded ${successCount} image(s) successfully`, 'success');
      } else if (successCount > 0 && failedCount > 0) {
        addToast(`Uploaded ${successCount} image(s), ${failedCount} failed`, 'success');
      } else {
        addToast('Image upload failed. No image was uploaded.', 'error');
      }
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setFormData({
      ...formData,
      images: formData.images.filter((_, index) => index !== indexToRemove)
    });
  };

  const normalizeAttributeLabel = (value: unknown) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const normalizeAttributeId = (value: unknown) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const resolveVariantAxes = () => {
    const colorAttribute = attributes.find((attribute: any) => {
      const name = normalizeAttributeLabel(attribute?.name);
      const slug = normalizeAttributeLabel(attribute?.slug);
      return slug === 'color' || name === 'color' || name.includes('mau');
    });

    const sizeAttribute = attributes.find((attribute: any) => {
      const name = normalizeAttributeLabel(attribute?.name);
      const slug = normalizeAttributeLabel(attribute?.slug);
      return slug === 'size' || name === 'size' || name.includes('kich');
    });

    return {
      colorValues: Array.isArray(colorAttribute?.values) ? colorAttribute.values : [],
      sizeValues: Array.isArray(sizeAttribute?.values) ? sizeAttribute.values : [],
    };
  };

  const buildVariantsWithMissingColorSize = (sourceVariants: any[], autoGenerateSku: boolean) => {
    const { colorValues, sizeValues } = resolveVariantAxes();
    const existingKeys = new Set<string>();

    const normalizedVariants = sourceVariants.map((variant: any) => {
      const colorId = normalizeAttributeId(variant?.attributes?.[0]);
      const sizeId = normalizeAttributeId(variant?.attributes?.[1]);

      if (colorId && sizeId) {
        existingKeys.add(`${colorId}-${sizeId}`);
      }

      return {
        ...variant,
        sku: autoGenerateSku ? '' : String(variant?.sku || '').trim(),
        stock: Number(variant?.stock) || 0,
        price: variant?.price ?? '',
        salePrice: variant?.salePrice ?? '',
        attributes: [colorId || '', sizeId || ''],
      };
    });

    if (!colorValues.length || !sizeValues.length) {
      return {
        variants: normalizedVariants,
        addedCount: 0,
        canGenerate: false,
      };
    }

    const missingVariants: any[] = [];

    for (const colorValue of colorValues) {
      const colorId = normalizeAttributeId(colorValue?.id);
      if (!colorId) continue;

      for (const sizeValue of sizeValues) {
        const sizeId = normalizeAttributeId(sizeValue?.id);
        if (!sizeId) continue;

        const key = `${colorId}-${sizeId}`;
        if (existingKeys.has(key)) continue;

        existingKeys.add(key);
        missingVariants.push({
          sku: '',
          stock: 0,
          price: '',
          salePrice: '',
          attributes: [colorId, sizeId],
        });
      }
    }

    return {
      variants: [...normalizedVariants, ...missingVariants],
      addedCount: missingVariants.length,
      canGenerate: true,
    };
  };

  const generateMissingVariantsFromDatabase = () => {
    const generated = buildVariantsWithMissingColorSize(formData.variants, formData.autoGenerateVariantSku);

    setIsVariantsExpanded(true);
    setFormData({
      ...formData,
      variants: generated.variants,
    });

    if (!generated.canGenerate) {
      addToast('Color/Size attributes were not found from database.', 'error');
      return;
    }

    if (generated.addedCount > 0) {
      addToast(`Generated ${generated.addedCount} missing color-size variants from database.`, 'success');
      return;
    }

    addToast('All color-size combinations already exist, keeping current variants.', 'success');
  };

  const handleAutoGenerateVariantSkuChange = (enabled: boolean) => {
    if (!enabled) {
      const manualVariants = formData.variants.map((variant: any, index: number) => ({
        ...variant,
        sku: String(variant?.sku || '').trim() || `${formData.sku ? `${formData.sku}-` : ''}V${index + 1}`,
      }));

      setFormData({
        ...formData,
        autoGenerateVariantSku: false,
        variants: manualVariants,
      });
      return;
    }

    const generated = buildVariantsWithMissingColorSize(formData.variants, true);

    setFormData({
      ...formData,
      autoGenerateVariantSku: true,
      variants: generated.variants,
    });

    if (!generated.canGenerate) {
      addToast('Auto mode enabled. Color/Size values from database are not available yet.', 'error');
      return;
    }

    if (generated.addedCount > 0) {
      addToast(`Auto mode enabled. Added ${generated.addedCount} missing color-size variants from database.`, 'success');
    }
  };

  const addVariant = () => {
    setIsVariantsExpanded(true);
    setFormData({
      ...formData,
      variants: [...formData.variants, {
        sku: formData.autoGenerateVariantSku ? '' : `${formData.sku ? formData.sku + '-' : ''}V${formData.variants.length + 1}`,
        stock: 0,
        price: '',
        salePrice: '',
        attributes: []
      }]
    });
  };

  const removeVariant = (index: number) => {
    const newVariants = [...formData.variants];
    newVariants.splice(index, 1);
    setFormData({ ...formData, variants: newVariants });
  };

  const updateVariant = (index: number, field: string, val: any) => {
    const newVariants = [...formData.variants];
    newVariants[index][field] = val;
    setFormData({ ...formData, variants: newVariants });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUploading) {
      return addToast('Please wait for image upload to finish before saving.', 'error');
    }

    const saveFormData = formData.autoGenerateVariantSku
      ? {
        ...formData,
        variants: buildVariantsWithMissingColorSize(formData.variants, true).variants,
      }
      : formData;

    if (Number(formData.price) < 0) {
      return addToast('Price cannot be negative', 'error');
    }
    if (formData.salePrice && Number(formData.salePrice) >= Number(formData.price)) {
      return addToast('Sale price must be clearly less than regular price', 'error');
    }
    if (!saveFormData.autoGenerateVariantSku) {
      const missingVariantSku = saveFormData.variants.some((variant: any) => !String(variant.sku || '').trim());
      if (missingVariantSku) {
        return addToast('Variant SKU is required when auto-generate is disabled', 'error');
      }
    }

    const hasVariantsInPayload = Array.isArray(saveFormData.variants) && saveFormData.variants.length > 0;
    if (hasVariantsInPayload) {
      const invalidVariantIndex = saveFormData.variants.findIndex((variant: any) => {
        const variantStock = Number(variant?.stock);
        return !Number.isInteger(variantStock) || variantStock < 0;
      });

      if (invalidVariantIndex >= 0) {
        return addToast(`Variant #${invalidVariantIndex + 1} stock must be a non-negative integer`, 'error');
      }
    }

    const totalStockFromSkuPayload = hasVariantsInPayload
      ? saveFormData.variants.reduce((sum: number, variant: any) => {
        const variantStock = Number(variant?.stock);
        return sum + variantStock;
      }, 0)
      : Number(saveFormData.stock || 0);

    if (!Number.isInteger(totalStockFromSkuPayload) || totalStockFromSkuPayload < 0) {
      return addToast('Stock quantity must be a non-negative integer', 'error');
    }

    try {
      const payload: any = { ...saveFormData, price: Number(saveFormData.price), stock: totalStockFromSkuPayload };
      if (saveFormData.salePrice) payload.salePrice = Number(saveFormData.salePrice);
      if (saveFormData.categoryId) payload.categoryId = Number(saveFormData.categoryId);
      payload.brandId = saveFormData.brandId ? Number(saveFormData.brandId) : null;
      if (saveFormData.images && saveFormData.images.length > 0) {
        payload.images = saveFormData.images.map((url: string) => ({ url, alt: saveFormData.name }));
      }
      
      if (payload.variants && payload.variants.length > 0) {
        const productPrice = Number(saveFormData.price);
        payload.variants = payload.variants.map((v: any) => {
          const variantPriceRaw = Number(v.price);
          const normalizedVariantPrice = Number.isFinite(variantPriceRaw) && variantPriceRaw > 0
            ? variantPriceRaw
            : productPrice;

          const variantSalePriceRaw = v.salePrice === null || v.salePrice === undefined || v.salePrice === ''
            ? null
            : Number(v.salePrice);

          // Legacy data can contain invalid sale prices (>= price). Normalize to null to avoid update failures.
          const normalizedVariantSalePrice = (
            variantSalePriceRaw !== null
            && Number.isFinite(variantSalePriceRaw)
            && variantSalePriceRaw > 0
            && variantSalePriceRaw < normalizedVariantPrice
          )
            ? variantSalePriceRaw
            : null;

          return {
            ...v,
            sku: String(v.sku || '').trim(),
            price: normalizedVariantPrice,
            salePrice: normalizedVariantSalePrice,
            stock: Number(v.stock),
            attributes: (Array.isArray(v.attributes) ? v.attributes : [])
              .map((attrId: any) => Number(attrId))
              .filter((attrId: number) => Number.isInteger(attrId) && attrId > 0)
          };
        });
      }

      if (editingProduct) {
        await api.put(`/admin/products/${editingProduct.id}`, payload);
        addToast('Product updated successfully', 'success');
      } else {
        await api.post('/admin/products', payload);
        addToast('Product created successfully', 'success');
      }
      closeModal();
      fetchProducts(pagination.page);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Failed to save product';
      addToast(String(message), 'error');
    }
  };

  const handleQuickBrandChange = async (product: any, nextBrandValue: string) => {
    try {
      const brandId = nextBrandValue ? Number(nextBrandValue) : null;
      await api.put(`/admin/products/${product.id}`, { brandId });

      setProducts((prev) => prev.map((item: any) => {
        if (item.id !== product.id) return item;
        const selectedBrand = brands.find((brand: any) => brand.id === brandId) || null;
        return {
          ...item,
          brandId,
          brand: selectedBrand ? { id: selectedBrand.id, name: selectedBrand.name, slug: selectedBrand.slug } : null,
        };
      }));

      addToast('Brand updated successfully', 'success');
    } catch (_err) {
      addToast('Failed to update brand', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      addToast('Product deleted successfully', 'success');
      fetchProducts(pagination.page);
    } catch (_err) {
      addToast('Failed to delete product', 'error');
    }
  };

  const { colorValues: variantColorValues, sizeValues: variantSizeValues } = resolveVariantAxes();

  return (
    <div className="admin-products-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Products ({pagination.total})</h1>
        <button className="admin-btn admin-btn-primary" onClick={openAddModal}><Plus size={16} /> Add Product</button>
      </div>

      <div className="ap-card">
        {/* Toolbar */}
        <div className="ap-toolbar">
          <div className="ap-search-box">
            <Search size={18} className="ap-search-icon" />
            <input type="text" placeholder="Search products by name, SKU..." className="ap-search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="ap-toolbar-actions">
            {selectedIds.length > 0 && (
              <button className="admin-btn admin-btn-danger ap-bulk-delete-btn" onClick={handleBulkDelete}>Delete Selected ({selectedIds.length})</button>
            )}
            <div className="ap-filter-group">
              <span className="ap-filter-label">Status:</span>
              <select className="ap-filter-select" title="Status" aria-label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="ap-filter-group">
              <span className="ap-filter-label">Brand:</span>
              <select className="ap-filter-select" title="Brand" aria-label="Brand" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Unassigned">Unassigned</option>
                {brands.map((brand: any) => (
                  <option key={brand.id} value={brand.slug}>{brand.name}</option>
                ))}
              </select>
            </div>
            <div className="ap-filter-group">
              <span className="ap-filter-label">Sort by:</span>
              <select className="ap-filter-select ap-sort" title="Sort by" aria-label="Sort by" value={sortFilter} onChange={e => setSortFilter(e.target.value)}>
                <option value="Newest">Newest</option>
                <option value="PriceLow">Price: Low to High</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th className="ap-th-check"><input type="checkbox" className="ap-checkbox" title="Select all products" aria-label="Select all products" checked={selectedIds.length > 0 && selectedIds.length === filteredProducts.length} onChange={(e) => { if (e.target.checked) { setSelectedIds(filteredProducts.map((p: any) => p.id)); } else { setSelectedIds([]); } }} /></th>
                  <th>PRODUCT</th>
                  <th>SKU</th>
                  <th>BRAND</th>
                  <th>PRICE</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th className="ap-th-actions text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p: any) => (
                  <tr key={p.id}>
                  <td className="ap-td-check"><input type="checkbox" className="ap-checkbox" title="Select product" aria-label="Select product" checked={selectedIds.includes(p.id)} onChange={(e) => { if (e.target.checked) setSelectedIds([...selectedIds, p.id]); else setSelectedIds(selectedIds.filter(id => id !== p.id)); }} /></td>
                  <td>
                    <div className="ap-product-cell">
                      <div className="ap-product-img-box">
                        {p.images?.[0] ? <img src={getImageUrl(p.images[0].url)} alt="" className="ap-product-img" onError={e => (e.target as HTMLImageElement).style.display='none'} /> : <div className="ap-product-placeholder"></div>}
                      </div>
                      <div className="ap-product-info">
                        <strong className="ap-product-name">{p.name}</strong>
                        <div className="ap-product-category">{p.category?.name || 'Uncategorized'}</div>
                        {p.variants && p.variants.length > 0 && (
                          <div className="ap-product-meta">
                            {(() => {
                              const colorValues = new Set<string>();
                              const sizeValues = new Set<string>();

                              p.variants.forEach((variant: any) => {
                                (variant.attributes || []).forEach((attribute: any) => {
                                  const name = normalizeAttributeLabel(attribute?.attributeValue?.attribute?.name);
                                  const slug = normalizeAttributeLabel(attribute?.attributeValue?.attribute?.slug);
                                  const value = String(attribute?.attributeValue?.value || '').trim();
                                  if (!value) return;

                                  if (slug === 'color' || name === 'color' || name.includes('mau')) {
                                    colorValues.add(value);
                                  }

                                  if (slug === 'size' || name === 'size' || name.includes('kich')) {
                                    sizeValues.add(value);
                                  }
                                });
                              });

                              const colors = Array.from(colorValues);
                              const sizes = Array.from(sizeValues);

                              return (
                                <>
                                  {colors.length > 0 && <span><strong>Colors:</strong> {colors.join(', ')}</span>}
                                  {sizes.length > 0 && <span><strong>Sizes:</strong> {sizes.join(', ')}</span>}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><span className="ap-text-muted">{p.sku}</span></td>
                  <td>
                    <select
                      title="Quick Edit Brand"
                      aria-label="Quick Edit Brand"
                      className="ap-brand-inline-select"
                      value={p.brandId || ''}
                      onChange={(e) => handleQuickBrandChange(p, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {brands.map((brand: any) => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="ap-price-bold">
                      ${Number(p.salePrice || p.price).toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span className={`ap-stock ${p.stock < 1 ? 'ap-stock-out' : 'ap-stock-in'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td>
                    <span className={`ap-badge ${p.isActive ? 'ap-badge-active' : 'ap-badge-inactive'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="ap-btn-group">
                      <button className="ap-action-btn" onClick={() => window.open(`/product/${p.slug || p.id}`)} title="View detail"><Eye size={14} /></button>
                      <button className="ap-action-btn" onClick={() => openEditModal(p)} title="Edit"><Edit2 size={14} /></button>
                      <button className="ap-action-btn ap-action-btn-danger" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ap-footer">
          <div className="ap-footer-text">
            Showing <strong>{(pagination.page - 1) * 15 + 1}</strong> to <strong>{Math.min(pagination.page * 15, pagination.total)}</strong> of <strong>{pagination.total}</strong> results
          </div>
          {pagination.totalPages > 1 && (
            <div className="ap-pagination">
              <button disabled={pagination.page <= 1} className="ap-page-btn ap-page-arrow" onClick={() => fetchProducts(pagination.page - 1)}>&lsaquo;</button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`ap-page-btn ${p === pagination.page ? 'ap-page-active' : ''}`} onClick={() => fetchProducts(p)}>{p}</button>
              ))}
              <button disabled={pagination.page >= pagination.totalPages} className="ap-page-btn ap-page-arrow" onClick={() => fetchProducts(pagination.page + 1)}>&rsaquo;</button>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={closeModal} className="admin-modal-close" aria-label="Close" title="Close"><X size={20} /></button>
            </div>
            
            {isLoadingProduct ? (
              <div className="ap-modal-loading">
                <div className="spinner" />
                <span>Loading product data...</span>
              </div>
            ) : (
            <form onSubmit={handleSave} className="admin-form">
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Product Name *</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Classic T-Shirt" />
                </div>
                <div className="admin-form-group">
                  <label>SKU *</label>
                  <input type="text" required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="e.g. TSHIRT-001" />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Regular Price *</label>
                  <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" />
                </div>
                <div className="admin-form-group">
                  <label>Sale Price</label>
                  <input type="number" step="0.01" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} placeholder="0.00" />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>{hasVariantStocks ? 'Stock Quantity (Auto from SKU)' : 'Stock Quantity'}</label>
                  <input
                    title="Base Stock"
                    aria-label="Base Stock"
                    type="number"
                    min="0"
                    step="1"
                    value={hasVariantStocks ? String(totalStockFromVariants) : formData.stock}
                    onChange={e => setFormData({...formData, stock: e.target.value})}
                    placeholder="0"
                    required={!hasVariantStocks}
                    disabled={hasVariantStocks}
                  />
                  {hasVariantStocks && <small className="ap-text-muted">Total stock is calculated from all SKU variant stocks below.</small>}
                </div>
                <div className="admin-form-group">
                  <label>Category</label>
                  <select title="Category" aria-label="Category" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                    <option value="">-- Select Category --</option>
                    {(() => {
                      const parents = categories.filter((c: any) => !c.parentId);
                      const children = categories.filter((c: any) => c.parentId);
                      const processed = new Set();
                      const result: any[] = [];

                      parents.forEach((p: any) => {
                        result.push(
                          <option key={`cat-${p.id}`} value={p.id} style={{ fontWeight: 'bold' }}>
                            {p.name}
                          </option>
                        );
                        processed.add(p.id);
                        
                        children.filter((c: any) => c.parentId === p.id).forEach((c: any) => {
                          result.push(
                            <option key={`cat-${c.id}`} value={c.id}>
                              {'\u00A0\u00A0\u00A0\u2014 '}{c.name}
                            </option>
                          );
                          processed.add(c.id);
                        });
                      });

                      categories.forEach((c: any) => {
                        if (!processed.has(c.id)) {
                          result.push(
                            <option key={`cat-${c.id}`} value={c.id}>
                              {c.name}
                            </option>
                          );
                        }
                      });

                      return result;
                    })()}
                  </select>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Brand</label>
                  <select title="Brand" aria-label="Brand" value={formData.brandId} onChange={e => setFormData({...formData, brandId: e.target.value})}>
                    <option value="">-- Unassigned --</option>
                    {brands.map((brand: any) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                </div>
                <div className="admin-form-group"></div>
              </div>

              <div className="admin-form-group">
                <div className="ap-variant-dropdown">
                  <button
                    type="button"
                    className="ap-variant-toggle"
                    onClick={() => setIsVariantsExpanded((prev) => !prev)}
                    title={isVariantsExpanded ? 'Collapse Product Variants' : 'Expand Product Variants'}
                  >
                    <span className="ap-variant-toggle-title">Product Variants</span>
                    <span className="ap-variant-toggle-count">{formData.variants.length} variant(s)</span>
                    <ChevronDown size={16} className={`ap-variant-toggle-icon ${isVariantsExpanded ? 'ap-variant-toggle-icon-open' : ''}`} />
                  </button>

                  {isVariantsExpanded && (
                    <div className="ap-variant-dropdown-content">
                      <div className="ap-variant-header">
                        <label className="ap-variant-title">Product Variants</label>
                        <div className="ap-variant-header-actions">
                          <label className="ap-variant-auto-label">
                            <input
                              type="checkbox"
                              checked={formData.autoGenerateVariantSku}
                              onChange={e => handleAutoGenerateVariantSkuChange(e.target.checked)}
                              title="Auto-generate variant SKU"
                              aria-label="Auto-generate variant SKU"
                            />
                            Auto-generate variant SKU
                          </label>
                          {formData.autoGenerateVariantSku && (
                            <button
                              type="button"
                              onClick={generateMissingVariantsFromDatabase}
                              className="ap-variant-btn ap-variant-btn-generate"
                            >
                              <Plus size={14} /> Generate Missing
                            </button>
                          )}
                          <button type="button" onClick={addVariant} className="ap-variant-btn ap-variant-btn-add">
                            <Plus size={14} /> Add Variant
                          </button>
                        </div>
                      </div>
                      {formData.autoGenerateVariantSku && (
                        <div className="ap-variant-helper">
                          Variant SKU is auto-generated. Existing color-size pairs are kept, missing pairs are generated from database values.
                        </div>
                      )}

                      {formData.variants && formData.variants.length > 0 ? (
                        <div className="ap-variant-list">
                          {formData.variants.map((v: any, idx: number) => (
                            <div key={idx} className={`ap-variant-row ${idx < formData.variants.length - 1 ? 'ap-variant-row-bordered' : ''}`}>
                              <div className="ap-variant-col ap-variant-col-sku">
                                <label className="ap-variant-field-label">Variant SKU {formData.autoGenerateVariantSku ? '(Auto)' : '*'}</label>
                                <input
                                  title="Variant SKU"
                                  aria-label="Variant SKU"
                                  type="text"
                                  required={!formData.autoGenerateVariantSku}
                                  disabled={formData.autoGenerateVariantSku}
                                  value={v.sku}
                                  onChange={e => updateVariant(idx, 'sku', e.target.value)}
                                  placeholder={formData.autoGenerateVariantSku ? 'Auto-generated when saving' : 'SKU'}
                                  className={`ap-variant-input ${formData.autoGenerateVariantSku ? 'ap-variant-input-disabled' : ''}`}
                                />
                              </div>
                              <div className="ap-variant-col ap-variant-col-stock">
                                <label className="ap-variant-field-label">Stock *</label>
                                <input
                                  title="Variant Stock"
                                  aria-label="Variant Stock"
                                  type="number"
                                  required
                                  min="0"
                                  value={v.stock}
                                  onChange={e => updateVariant(idx, 'stock', e.target.value)}
                                  placeholder="0"
                                  className="ap-variant-input"
                                />
                              </div>
                              <div className="ap-variant-col ap-variant-col-price">
                                <label className="ap-variant-field-label">Price</label>
                                <input
                                  title="Variant Price"
                                  aria-label="Variant Price"
                                  type="number"
                                  step="0.01"
                                  value={v.price}
                                  onChange={e => updateVariant(idx, 'price', e.target.value)}
                                  placeholder="Auto"
                                  className="ap-variant-input"
                                />
                              </div>
                              <div className="ap-variant-col ap-variant-col-attrs">
                                <label className="ap-variant-field-label">Color / Size</label>
                                <div className="ap-variant-attrs">
                                  <select
                                    title="Color"
                                    aria-label="Color"
                                    value={v.attributes[0] || ''}
                                    onChange={e => { const newAttrs = [...v.attributes]; newAttrs[0] = Number(e.target.value); updateVariant(idx, 'attributes', newAttrs); }}
                                    className="ap-variant-select"
                                  >
                                    <option value="">- Color -</option>
                                    {variantColorValues.map((val: any) => <option key={val.id} value={val.id}>{val.value}</option>)}
                                  </select>
                                  <select
                                    title="Size"
                                    aria-label="Size"
                                    value={v.attributes[1] || ''}
                                    onChange={e => { const newAttrs = [...v.attributes]; newAttrs[1] = Number(e.target.value); updateVariant(idx, 'attributes', newAttrs); }}
                                    className="ap-variant-select"
                                  >
                                    <option value="">- Size -</option>
                                    {variantSizeValues.map((val: any) => <option key={val.id} value={val.id}>{val.value}</option>)}
                                  </select>
                                </div>
                              </div>
                              <button type="button" onClick={() => removeVariant(idx)} className="ap-variant-remove-btn" title="Remove Variant">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ap-variant-empty">No variants yet. Click "Add Variant" to create one.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-form-group">
                <label>Product Images</label>
                <div className="ap-image-upload-wrapper">
                  <label className={`admin-btn admin-btn-outline ap-image-upload-label ${isUploading ? 'ap-uploading' : ''}`}>
                    {isUploading ? 'Uploading...' : 'Choose Files'}
                    <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="ap-d-none" disabled={isUploading} title="Choose file" aria-label="Choose file" />
                  </label>
                </div>
                {formData.images.length > 0 && (
                  <div className="ap-image-preview-list">
                    {formData.images.map((url: string, index: number) => (
                      <div key={index} className="ap-image-preview-item">
                        <img src={getImageUrl(url)} alt="Preview" className="admin-modal-image-preview ap-image-preview ap-image-preview-thumb" onError={(e: any) => e.target.style.display = 'none'} />
                        <button type="button" onClick={() => removeImage(index)} className="ap-image-remove-btn">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-form-group">
                <label>Short Description</label>
                <WordEditor
                  id="product-short-description"
                  ariaLabel="Short Description"
                  value={formData.shortDescription}
                  onChange={(value) => setFormData((prev) => ({ ...prev, shortDescription: value }))}
                  placeholder="Brief excerpt..."
                  size="sm"
                />
              </div>
              
              <div className="admin-form-group">
                <label>Full Description</label>
                <WordEditor
                  id="product-full-description"
                  ariaLabel="Full Description"
                  value={formData.description}
                  onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                  placeholder="Detailed product description. Safe HTML will be sanitized on save."
                  size="lg"
                />
              </div>

              <div className="admin-form-row ap-mt-10">
                <label className="ap-checkbox-label">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="ap-w-auto" title="Active" aria-label="Active" />
                  <span>Active (Visible)</span>
                </label>
                <label className="ap-checkbox-label">
                  <input type="checkbox" checked={formData.isFeatured} onChange={e => setFormData({...formData, isFeatured: e.target.checked})} className="ap-w-auto" title="Featured" aria-label="Featured" />
                  <span>Featured Product</span>
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isUploading}>{isUploading ? 'Uploading Images...' : (editingProduct ? 'Save Changes' : 'Create Product')}</button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




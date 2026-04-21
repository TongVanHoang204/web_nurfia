import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import '../AdminBrands/AdminBrands.css';

type AttributeValue = {
  id: number;
  attributeId: number;
  value: string;
  colorHex: string | null;
  sortOrder: number;
  _count?: { variantAttributes: number };
};

type Attribute = {
  id: number;
  name: string;
  slug: string;
  values: AttributeValue[];
  _count?: { values: number };
};

const EMPTY_ATTR_FORM = { name: '', slug: '' };
const EMPTY_VAL_FORM  = { value: '', colorHex: '', sortOrder: 0 };

const toSlug = (v: string) =>
  String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export default function AdminAttributes() {
  const { addToast, openConfirm } = useUIStore();

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Expanded rows to show values
  const [expandedAttrIds, setExpandedAttrIds] = useState<Set<number>>(new Set());

  // Attribute modal
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<Attribute | null>(null);
  const [attrForm, setAttrForm] = useState(EMPTY_ATTR_FORM);
  const [attrFormError, setAttrFormError] = useState('');
  const [attrSubmitting, setAttrSubmitting] = useState(false);

  // Value modal
  const [valModalOpen, setValModalOpen] = useState(false);
  const [parentAttr, setParentAttr] = useState<Attribute | null>(null);
  const [editingVal, setEditingVal] = useState<AttributeValue | null>(null);
  const [valForm, setValForm] = useState(EMPTY_VAL_FORM);
  const [valFormError, setValFormError] = useState('');
  const [valSubmitting, setValSubmitting] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const fetchAttributes = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/attributes');
      const data: Attribute[] = Array.isArray(res.data?.data) ? res.data.data : [];
      setAttributes(data);
    } catch {
      addToast('Failed to load attributes', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAttributes(); }, []);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredAttributes = useMemo(() => {
    return [...attributes].sort((a, b) => a.name.localeCompare(b.name));
  }, [attributes]);

  // ── Toggle Expand ─────────────────────────────────────────────────────────
  const toggleExpand = (attrId: number) => {
    setExpandedAttrIds(prev => {
      const next = new Set(prev);
      if (next.has(attrId)) next.delete(attrId);
      else next.add(attrId);
      return next;
    });
  };

  // ── Attribute CRUD ────────────────────────────────────────────────────────
  const openCreateAttr = () => {
    setEditingAttr(null);
    setAttrForm(EMPTY_ATTR_FORM);
    setAttrFormError('');
    setAttrModalOpen(true);
  };

  const openEditAttr = (attr: Attribute) => {
    setEditingAttr(attr);
    setAttrForm({ name: attr.name, slug: attr.slug });
    setAttrFormError('');
    setAttrModalOpen(true);
  };

  const handleSaveAttr = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = attrForm.name.trim();
    const slug = toSlug(attrForm.slug || name);
    if (!name) { setAttrFormError('Attribute name is required.'); return; }
    if (!slug) { setAttrFormError('Could not generate a valid slug.'); return; }

    setAttrSubmitting(true);
    setAttrFormError('');
    try {
      if (editingAttr) {
        await api.put(`/admin/attributes/${editingAttr.id}`, { name, slug });
        addToast('Attribute updated', 'success');
      } else {
        await api.post('/admin/attributes', { name, slug });
        addToast('Attribute created', 'success');
      }
      setAttrModalOpen(false);
      await fetchAttributes();
    } catch (err: any) {
      setAttrFormError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to save.');
    } finally {
      setAttrSubmitting(false);
    }
  };

  const handleDeleteAttr = (attr: Attribute) => {
    const usedCount = attr.values.reduce((sum, v) => sum + (v._count?.variantAttributes ?? 0), 0);
    openConfirm({
      title: 'Delete Attribute',
      message: usedCount > 0
        ? `"${attr.name}" has values used by ${usedCount} variant(s). You must remove those assignments first.`
        : `Delete attribute "${attr.name}" and all its ${attr.values.length} value(s)?`,
      danger: true,
      confirmText: usedCount > 0 ? 'Understood' : 'Delete',
      onConfirm: usedCount > 0 ? () => {} : async () => {
        try {
          await api.delete(`/admin/attributes/${attr.id}`);
          addToast('Attribute deleted', 'success');
          await fetchAttributes();
        } catch (err: any) {
          addToast(err?.response?.data?.message || err?.response?.data?.error || 'Failed to delete.', 'error');
        }
      },
    });
  };

  // ── Value CRUD ────────────────────────────────────────────────────────────
  const openCreateVal = (attr: Attribute) => {
    setParentAttr(attr);
    setEditingVal(null);
    setValForm({ value: '', colorHex: '', sortOrder: attr.values.length });
    setValFormError('');
    setValModalOpen(true);
  };

  const openEditVal = (val: AttributeValue, attr: Attribute) => {
    setParentAttr(attr);
    setEditingVal(val);
    setValForm({ value: val.value, colorHex: val.colorHex ?? '', sortOrder: val.sortOrder });
    setValFormError('');
    setValModalOpen(true);
  };

  const handleSaveVal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentAttr) return;

    const value = valForm.value.trim();
    const colorHex = valForm.colorHex.trim() || null;
    const sortOrder = Number(valForm.sortOrder);

    if (!value) { setValFormError('Value label is required.'); return; }
    if (colorHex && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
      setValFormError('Color hex must be a valid 6-digit hex (e.g. #FF0000).'); return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setValFormError('Sort order must be a non-negative integer.'); return;
    }

    setValSubmitting(true);
    setValFormError('');
    try {
      if (editingVal) {
        await api.put(`/admin/attribute-values/${editingVal.id}`, { value, colorHex, sortOrder });
        addToast('Value updated', 'success');
      } else {
        await api.post('/admin/attribute-values', { attributeId: parentAttr.id, value, colorHex, sortOrder });
        addToast('Value added', 'success');
        setExpandedAttrIds(prev => new Set(prev).add(parentAttr.id)); // Auto expand on add
      }
      setValModalOpen(false);
      await fetchAttributes();
    } catch (err: any) {
      setValFormError(err?.response?.data?.message || err?.response?.data?.error || 'Failed to save.');
    } finally {
      setValSubmitting(false);
    }
  };

  const handleDeleteVal = (val: AttributeValue) => {
    const inUse = (val._count?.variantAttributes ?? 0) > 0;
    openConfirm({
      title: 'Delete Value',
      message: inUse
        ? `"${val.value}" is used by ${val._count!.variantAttributes} variant(s). Remove those assignments first.`
        : `Delete value "${val.value}"?`,
      danger: true,
      confirmText: inUse ? 'Understood' : 'Delete',
      onConfirm: inUse ? () => {} : async () => {
        try {
          await api.delete(`/admin/attribute-values/${val.id}`);
          addToast('Value deleted', 'success');
          await fetchAttributes();
        } catch (err: any) {
          addToast(err?.response?.data?.message || err?.response?.data?.error || 'Failed to delete.', 'error');
        }
      },
    });
  };

  const totalValues = attributes.reduce((s, a) => s + (a.values?.length ?? 0), 0);

  return (
    <div className="admin-page-container">
      {/* Hero Section */}
      <section className="ap-card brands-hero-card">
        <div className="brands-hero-copy">
          <p className="brands-hero-overline">Catalog Setup</p>
          <h1 className="brands-hero-title">Product Attributes</h1>
          <p className="brands-admin-subtitle">Manage global product attributes and values (e.g., Size, Color).</p>
        </div>
        <div className="brands-hero-actions">
          <button className="admin-btn admin-btn-primary" onClick={openCreateAttr}>
            <Plus size={16} /> Add Attribute
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="brands-metrics-grid">
        <div className="ap-card brands-metric-card">
          <span className="brands-metric-label">Total Attributes</span>
          <strong className="brands-metric-value">{attributes.length}</strong>
        </div>
        <div className="ap-card brands-metric-card">
          <span className="brands-metric-label">Total Values</span>
          <strong className="brands-metric-value">{totalValues}</strong>
        </div>
      </section>

      {/* Table */}
      <div className="ap-card brands-table-card">
        {isLoading ? (
           <div className="loading-page"><div className="spinner" /></div>
        ) : filteredAttributes.length === 0 ? (
           <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No attributes have been created yet.</div>
        ) : (
          <div className="ap-table-wrap">
            <table className="ap-table">
              <thead>
                <tr>
                  <th className="ap-th-check"></th>
                  <th>ATTRIBUTE</th>
                  <th>SLUG</th>
                  <th>VALUES</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttributes.map(attr => {
                  const isExpanded = expandedAttrIds.has(attr.id);
                  return (
                    <React.Fragment key={attr.id}>
                      <tr style={{ background: isExpanded ? '#f8fafc' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            type="button" 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}
                            onClick={() => toggleExpand(attr.id)}
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </td>
                        <td>
                          <strong>{attr.name}</strong>
                        </td>
                        <td>
                          <span className="ap-text-muted">{attr.slug}</span>
                        </td>
                        <td>
                           <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                             {attr.values?.slice(0, 5).map(val => (
                               <span key={val.id} style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: '#e5e7eb', color: '#374151', 
                                  padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 
                               }}>
                                 {val.colorHex && (
                                   <span style={{ width: 10, height: 10, borderRadius: '50%', background: val.colorHex, border: '1px solid rgba(0,0,0,0.1)' }} />
                                 )}
                                 {val.value}
                               </span>
                             ))}
                             {attr.values && attr.values.length > 5 && (
                               <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                                 +{attr.values.length - 5} more
                               </span>
                             )}
                             {(!attr.values || attr.values.length === 0) && (
                               <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>No values yet</span>
                             )}
                           </div>
                        </td>
                        <td className="text-right">
                          <div className="ap-btn-group brands-actions">
                            <button className="ap-action-btn" title="Add Value" onClick={() => openCreateVal(attr)}>
                              <Plus size={14} />
                            </button>
                            <button className="ap-action-btn" title="Edit Attribute" onClick={() => openEditAttr(attr)}>
                              <Edit2 size={14} />
                            </button>
                            <button className="ap-action-btn ap-action-btn-danger" title="Delete Attribute" onClick={() => handleDeleteAttr(attr)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 24px 24px 64px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                             <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                 <h4 style={{ fontSize: 13, fontWeight: 600, color: '#475569', margin: 0 }}>Configure Terms for "{attr.name}"</h4>
                                 <button className="admin-btn admin-btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openCreateVal(attr)}>
                                    <Plus size={12} style={{ marginRight: 4 }}/> Add Term
                                 </button>
                               </div>
                               
                               {attr.values && attr.values.length > 0 ? (
                                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9', color: '#64748b' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }}>TERM</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>COLOR HEX</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>ORDER</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>IN USE</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, borderTopRightRadius: 4, borderBottomRightRadius: 4 }}>ACTIONS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {attr.values.map(val => (
                                        <tr key={val.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              {val.colorHex && <span style={{ width: 14, height: 14, background: val.colorHex, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)' }} />}
                                              <strong>{val.value}</strong>
                                            </div>
                                          </td>
                                          <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{val.colorHex || '—'}</td>
                                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{val.sortOrder}</td>
                                          <td style={{ padding: '8px 12px' }}>
                                            {(val._count?.variantAttributes ?? 0) > 0 ? (
                                              <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                                {val._count!.variantAttributes} variant(s)
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: 11, color: '#94a3b8' }}>unused</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                            <div className="ap-btn-group" style={{ display: 'inline-flex' }}>
                                              <button type="button" className="ap-action-btn" title="Edit" onClick={() => openEditVal(val, attr)}><Edit2 size={13} /></button>
                                              <button type="button" className="ap-action-btn ap-action-btn-danger" title="Delete" onClick={() => handleDeleteVal(val)}><Trash2 size={13} /></button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                               ) : (
                                 <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 6 }}>
                                   No terms have been added yet.
                                 </div>
                               )}
                             </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Attribute Modal ──────────────────────────────────────────────── */}
      {attrModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setAttrModalOpen(false)}>
          <div className="admin-modal-content" style={{ maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingAttr ? 'Edit Attribute' : 'Add Attribute'}</h2>
              <button className="admin-modal-close" onClick={() => setAttrModalOpen(false)} title="Close" aria-label="Close"><X size={18} /></button>
            </div>
            <form className="admin-form" onSubmit={handleSaveAttr}>
              {attrFormError && <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>{attrFormError}</div>}
              <div className="admin-form-group">
                <label>Attribute Name *</label>
                <input
                  type="text"
                  value={attrForm.name}
                  onChange={e => {
                    const n = e.target.value;
                    setAttrForm(prev => ({ ...prev, name: n, slug: editingAttr ? prev.slug : toSlug(n) }));
                  }}
                  placeholder="e.g. Color, Size, Material"
                  required
                  autoFocus
                />
              </div>
              <div className="admin-form-group">
                <label>Slug *</label>
                <input type="text" value={attrForm.slug} onChange={e => setAttrForm(prev => ({ ...prev, slug: toSlug(e.target.value) }))} placeholder="e.g. color" required />
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={() => setAttrModalOpen(false)} disabled={attrSubmitting}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={attrSubmitting}>{attrSubmitting ? 'Saving...' : editingAttr ? 'Save Changes' : 'Create Attribute'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Value Modal ──────────────────────────────────────────────────── */}
      {valModalOpen && parentAttr && (
        <div className="admin-modal-overlay" onClick={() => setValModalOpen(false)}>
          <div className="admin-modal-content" style={{ maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingVal ? 'Edit Term' : 'Add Term'} — <span style={{ color: '#6b7280', fontWeight: 400 }}>{parentAttr.name}</span>
              </h2>
              <button className="admin-modal-close" onClick={() => setValModalOpen(false)} title="Close" aria-label="Close"><X size={18} /></button>
            </div>
            <form className="admin-form" onSubmit={handleSaveVal}>
              {valFormError && <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>{valFormError}</div>}
              
              <div className="admin-form-group">
                <label>Value Term *</label>
                <input type="text" value={valForm.value} onChange={e => setValForm(prev => ({ ...prev, value: e.target.value }))} placeholder="e.g. Red, XL, Cotton" required autoFocus />
              </div>

              <div className="admin-form-group">
                <label>Color Hex <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="text" value={valForm.colorHex} onChange={e => setValForm(prev => ({ ...prev, colorHex: e.target.value }))} placeholder="#000000" style={{ flex: 1 }} maxLength={7} />
                  <input type="color" value={valForm.colorHex || '#000000'} onChange={e => setValForm(prev => ({ ...prev, colorHex: e.target.value }))} style={{ width: 40, height: 36, padding: 2, cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: 4 }} />
                </div>
              </div>

              <div className="admin-form-group">
                <label>Sort Order</label>
                <input type="number" min="0" value={valForm.sortOrder} onChange={e => setValForm(prev => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))} />
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={() => setValModalOpen(false)} disabled={valSubmitting}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={valSubmitting}>{valSubmitting ? 'Saving...' : editingVal ? 'Save Changes' : 'Add Term'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

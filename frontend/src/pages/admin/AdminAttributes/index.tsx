import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X, ChevronDown, ChevronUp, Sliders, Hash } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import './AdminAttributes.css';

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
    <div className="admin-attributes-page">
      <header className="admin-attributes-header">
        <div>
          <h1>Product Attributes</h1>
          <p>Global catalog properties like Size, Color, and Materials.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateAttr}>
          <Plus size={16} style={{ marginRight: 8 }} /> Create Attribute
        </button>
      </header>

      <div className="admin-attributes-stats">
        <div className="admin-attr-stat-card">
          <span>Registered Types</span>
          <strong>{attributes.length}</strong>
        </div>
        <div className="admin-attr-stat-card">
          <span>Configured Terms</span>
          <strong>{totalValues}</strong>
        </div>
      </div>

      <div className="admin-attributes-content">
        {isLoading ? (
           <div className="loading-page"><div className="spinner" /></div>
        ) : filteredAttributes.length === 0 ? (
           <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
             <Sliders size={48} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.5 }} />
             <p>No attributes found in the catalog.</p>
           </div>
        ) : (
          <table className="admin-attr-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}></th>
                <th>Attribute Name</th>
                <th>Slug ID</th>
                <th>Sample Values</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttributes.map(attr => {
                const isExpanded = expandedAttrIds.has(attr.id);
                return (
                  <React.Fragment key={attr.id}>
                    <tr className={`admin-attr-row ${isExpanded ? 'is-expanded' : ''}`}>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="admin-attr-expand-btn"
                          onClick={() => toggleExpand(attr.id)}
                          title={isExpanded ? "Collapse" : "Expand Terms"}
                        >
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </td>
                      <td>
                        <span className="admin-attr-name">{attr.name}</span>
                      </td>
                      <td>
                        <code className="admin-attr-slug">{attr.slug}</code>
                      </td>
                      <td>
                        <div className="admin-attr-values-preview">
                          {attr.values?.slice(0, 4).map(val => (
                            <span key={val.id} className="admin-attr-value-pill">
                              {val.colorHex && <div className="admin-attr-color-dot" style={{ background: val.colorHex }} />}
                              {val.value}
                            </span>
                          ))}
                          {attr.values && attr.values.length > 4 && (
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              +{attr.values.length - 4} MORE
                            </span>
                          )}
                          {(!attr.values || attr.values.length === 0) && (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 12, fontStyle: 'italic' }}>None defined</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 12 }}>
                          <button className="admin-attr-expand-btn" title="Add Term" onClick={() => openCreateVal(attr)}>
                            <Plus size={18} />
                          </button>
                          <button className="admin-attr-expand-btn" title="Edit" onClick={() => openEditAttr(attr)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="admin-attr-expand-btn" title="Delete" onClick={() => handleDeleteAttr(attr)} style={{ color: 'var(--color-error)' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="admin-attr-expanded-pane">
                           <div className="admin-attr-terms-card">
                             <div className="admin-attr-terms-header">
                               <h4>Configure "{attr.name}" Terms</h4>
                               <button className="btn btn-outline btn-sm" onClick={() => openCreateVal(attr)}>
                                  <Plus size={14} style={{ marginRight: 6 }}/> Add New Term
                               </button>
                             </div>
                             
                             {attr.values && attr.values.length > 0 ? (
                                <table className="admin-terms-table">
                                  <thead>
                                    <tr>
                                      <th>Term Label</th>
                                      <th>Hex Code</th>
                                      <th>Sort</th>
                                      <th>Status</th>
                                      <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {attr.values.map(val => (
                                      <tr key={val.id}>
                                        <td>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {val.colorHex && <div className="admin-attr-color-dot" style={{ width: 14, height: 14, background: val.colorHex }} />}
                                            <span className="admin-term-label">{val.value}</span>
                                          </div>
                                        </td>
                                        <td><span className="admin-term-hex">{val.colorHex || '—'}</span></td>
                                        <td>{val.sortOrder}</td>
                                        <td>
                                          {(val._count?.variantAttributes ?? 0) > 0 ? (
                                            <span className="admin-term-inuse">
                                              Used in {val._count!.variantAttributes} products
                                            </span>
                                          ) : (
                                            <span className="admin-term-unused">Unused</span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                          <div style={{ display: 'inline-flex', gap: 12 }}>
                                            <button className="admin-attr-expand-btn" onClick={() => openEditVal(val, attr)}><Edit2 size={14} /></button>
                                            <button className="admin-attr-expand-btn" onClick={() => handleDeleteVal(val)} style={{ color: 'var(--color-error)' }}><Trash2 size={14} /></button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                             ) : (
                               <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)' }}>
                                 No terms available for this attribute.
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
        )}
      </div>

      {/* ── Attribute Modal ──────────────────────────────────────────────── */}
      {attrModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setAttrModalOpen(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingAttr ? 'Edit Attribute' : 'Create Attribute'}</h2>
              <button type="button" className="admin-modal-close" onClick={() => setAttrModalOpen(false)}><X size={20} /></button>
            </div>
            <form className="admin-form" onSubmit={handleSaveAttr}>
              <div className="admin-modal-body">
                {attrFormError && <div className="admin-form-error">{attrFormError}</div>}
                <div className="admin-form-row">
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={attrForm.name}
                    onChange={e => {
                      const n = e.target.value;
                      setAttrForm(prev => ({ ...prev, name: n, slug: editingAttr ? prev.slug : toSlug(n) }));
                    }}
                    placeholder="e.g. Fabric Material"
                    required
                    autoFocus
                  />
                </div>
                <div className="admin-form-row">
                  <label>Technical Slug</label>
                  <input type="text" value={attrForm.slug} onChange={e => setAttrForm(prev => ({ ...prev, slug: toSlug(e.target.value) }))} placeholder="e.g. fabric-material" required />
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setAttrModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={attrSubmitting}>
                  {attrSubmitting ? 'Saving...' : editingAttr ? 'Save Changes' : 'Create Attribute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Value Modal ──────────────────────────────────────────────────── */}
      {valModalOpen && parentAttr && (
        <div className="admin-modal-overlay" onClick={() => setValModalOpen(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 className="admin-modal-title">{editingVal ? 'Edit Term' : 'Add Term'}</h2>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Attribute: {parentAttr.name}</span>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setValModalOpen(false)}><X size={20} /></button>
            </div>
            <form className="admin-form" onSubmit={handleSaveVal}>
              <div className="admin-modal-body">
                {valFormError && <div className="admin-form-error">{valFormError}</div>}
                
                <div className="admin-form-row">
                  <label>Term Label</label>
                  <input type="text" value={valForm.value} onChange={e => setValForm(prev => ({ ...prev, value: e.target.value }))} placeholder="e.g. Silk, XL, #000000" required autoFocus />
                </div>

                <div className="admin-form-row">
                  <label>Visual Color (Hex)</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Hash size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                      <input 
                        type="text" 
                        value={valForm.colorHex?.replace('#', '')} 
                        onChange={e => setValForm(prev => ({ ...prev, colorHex: '#' + e.target.value.replace('#', '') }))} 
                        placeholder="FFFFFF" 
                        style={{ paddingLeft: 32 }}
                        maxLength={7} 
                      />
                    </div>
                    <input 
                      type="color" 
                      value={valForm.colorHex || '#ffffff'} 
                      onChange={e => setValForm(prev => ({ ...prev, colorHex: e.target.value }))} 
                      style={{ width: 50, height: 46, padding: 4, cursor: 'pointer', border: '1px solid var(--color-border)', background: '#fff' }} 
                    />
                  </div>
                </div>

                <div className="admin-form-row">
                  <label>Display Priority (Sort Order)</label>
                  <input type="number" min="0" value={valForm.sortOrder} onChange={e => setValForm(prev => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setValModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={valSubmitting}>
                  {valSubmitting ? 'Saving...' : editingVal ? 'Save Changes' : 'Add Term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

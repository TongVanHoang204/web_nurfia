import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import './AdminShipping.css';

type ShippingZoneForm = {
  zoneName: string;
  cost: string;
  freeShipMinOrder: string;
};

type ShippingZone = {
  id?: number;
  zoneName: string;
  cost: number | string;
  freeShipMinOrder: number | string | null;
};

type ShippingMethod = {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  zones?: ShippingZone[];
};

const createEmptyZone = (): ShippingZoneForm => ({
  zoneName: '',
  cost: '',
  freeShipMinOrder: '',
});

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '$0.00';
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
};

export default function AdminShipping() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const { addToast, openConfirm } = useUIStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    zones: [createEmptyZone()],
  });

  const fetchMethods = () => {
    setIsLoading(true);
    api.get('/admin/shipping')
      .then(r => setMethods(r.data.data || []))
      .catch((err) => {
        console.error(err);
        addToast('Failed to load shipping methods', 'error');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const resetForm = () => {
    setEditingMethod(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
      zones: [createEmptyZone()],
    });
    setFormError('');
    setIsModalOpen(false);
  };

  const openAddModal = () => {
    setEditingMethod(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
      zones: [createEmptyZone()],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (method: ShippingMethod) => {
    setEditingMethod(method);
    setFormData({
      name: method.name || '',
      description: method.description || '',
      isActive: method.isActive ?? true,
      zones: method.zones?.length
        ? method.zones.map((zone) => ({
            zoneName: zone.zoneName || '',
            cost: zone.cost?.toString() || '',
            freeShipMinOrder: zone.freeShipMinOrder?.toString() || '',
          }))
        : [createEmptyZone()],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const updateZone = (index: number, key: keyof ShippingZoneForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      zones: prev.zones.map((zone, zoneIndex) => (
        zoneIndex === index ? { ...zone, [key]: value } : zone
      )),
    }));
  };

  const addZone = () => {
    setFormData(prev => ({ ...prev, zones: [...prev.zones, createEmptyZone()] }));
  };

  const removeZone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      zones: prev.zones.length === 1
        ? [createEmptyZone()]
        : prev.zones.filter((_, zoneIndex) => zoneIndex !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormError('Shipping method name is required');
      return;
    }

    const zones = formData.zones
      .filter(zone => zone.zoneName.trim() || zone.cost || zone.freeShipMinOrder)
      .map(zone => ({
        zoneName: zone.zoneName.trim(),
        cost: zone.cost === '' ? NaN : Number(zone.cost),
        freeShipMinOrder: zone.freeShipMinOrder === '' ? null : Number(zone.freeShipMinOrder),
      }));

    if (zones.length === 0) {
      setFormError('At least one shipping zone is required');
      return;
    }

    const invalidZone = zones.find(zone => (
      !zone.zoneName ||
      !Number.isFinite(zone.cost) ||
      zone.cost < 0 ||
      (zone.freeShipMinOrder !== null && (!Number.isFinite(zone.freeShipMinOrder) || zone.freeShipMinOrder < 0))
    ));

    if (invalidZone) {
      setFormError('Each shipping zone must have a name and non-negative cost values');
      return;
    }

    const duplicateZone = new Set<string>();
    for (const zone of zones) {
      const key = zone.zoneName.toLowerCase();
      if (duplicateZone.has(key)) {
        setFormError('Shipping zone names must be unique within a method');
        return;
      }
      duplicateZone.add(key);
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        isActive: formData.isActive,
        zones,
      };

      if (editingMethod) {
        await api.put(`/admin/shipping/${editingMethod.id}`, payload);
        addToast('Shipping method updated', 'success');
      } else {
        await api.post('/admin/shipping', payload);
        addToast('Shipping method created', 'success');
      }

      resetForm();
      fetchMethods();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save shipping method');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    openConfirm({
      title: 'Delete Shipping Method',
      message: 'This will remove the method and all of its shipping zones.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/shipping/${id}`);
          addToast('Shipping method deleted', 'success');
          fetchMethods();
        } catch (err: any) {
          addToast(err.response?.data?.message || 'Failed to delete shipping method', 'error');
        }
      }
    });
  };

  const totalZones = methods.reduce((sum, method) => sum + (method.zones?.length || 0), 0);
  const activeMethods = methods.filter((method) => method.isActive).length;

  return (
    <div className="shipping-admin-page">
      <div className="admin-page-header shipping-admin-header">
        <div>
          <h1 className="admin-page-title">Shipping Methods</h1>
          <p className="shipping-admin-subtitle">Manage shipping options and zone pricing in one place.</p>
        </div>

        <div className="shipping-header-actions">
          <div className="shipping-quick-stats">
            <div className="shipping-stat-pill">
              <strong>{methods.length}</strong>
              <span>Methods</span>
            </div>
            <div className="shipping-stat-pill">
              <strong>{activeMethods}</strong>
              <span>Active</span>
            </div>
            <div className="shipping-stat-pill">
              <strong>{totalZones}</strong>
              <span>Zones</span>
            </div>
          </div>

          <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Method
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content shipping-modal-content">
            <div className="admin-modal-header">
              <h3>{editingMethod ? 'Edit Shipping Method' : 'Create Shipping Method'}</h3>
              <button aria-label="Close" title="Close modal" onClick={resetForm} className="admin-btn-icon">
                <X size={20} />
              </button>
            </div>

            {formError && <div className="admin-page-error">{formError}</div>}

            <form onSubmit={handleSubmit} className="admin-form">
              <div className="shipping-form-grid">
                <div className="admin-form-group shipping-form-group-tight">
                  <label htmlFor="shippingName">Name</label>
                  <input id="shippingName" title="Shipping Method Name" type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} required />
                </div>

                <div className="shipping-status-toggle-wrap">
                  <label htmlFor="shippingActive" className="shipping-status-toggle">
                    <input id="shippingActive" title="Shipping Method Status" type="checkbox" checked={formData.isActive} onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))} />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div className="admin-form-group shipping-form-group-tight">
                <label htmlFor="shippingDescription">Description</label>
                <textarea id="shippingDescription" title="Shipping Method Description" rows={2} value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <div className="admin-form-group shipping-zone-block">
                <div className="shipping-zone-toolbar">
                  <label>Shipping Zones</label>
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={addZone}>
                    <Plus size={14} /> Add Zone
                  </button>
                </div>

                <div className="shipping-zone-list">
                  {formData.zones.map((zone, index) => (
                    <div key={`${zone.zoneName}-${index}`} className="shipping-zone-row">
                      <div className="admin-form-group shipping-zone-input shipping-zone-name-input">
                        {index === 0 && <label htmlFor={`zone-name-${index}`}>Zone</label>}
                        <input
                          id={`zone-name-${index}`}
                          title={`Zone Name ${index + 1}`}
                          type="text"
                          value={zone.zoneName}
                          onChange={e => updateZone(index, 'zoneName', e.target.value)}
                          placeholder="Zone Name"
                        />
                      </div>

                      <div className="admin-form-group shipping-zone-input">
                        {index === 0 && <label htmlFor={`zone-cost-${index}`}>Cost</label>}
                        <input
                          id={`zone-cost-${index}`}
                          title={`Zone Cost ${index + 1}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={zone.cost}
                          onChange={e => updateZone(index, 'cost', e.target.value)}
                          placeholder="Cost"
                        />
                      </div>

                      <div className="admin-form-group shipping-zone-input">
                        {index === 0 && <label htmlFor={`zone-free-${index}`}>Free Min</label>}
                        <input
                          id={`zone-free-${index}`}
                          title={`Zone Free Shipping Threshold ${index + 1}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={zone.freeShipMinOrder}
                          onChange={e => updateZone(index, 'freeShipMinOrder', e.target.value)}
                          placeholder="Threshold"
                        />
                      </div>

                      <button type="button" className="admin-btn admin-btn-danger shipping-zone-remove-btn" onClick={() => removeZone(index)} title="Remove Zone">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-modal-actions shipping-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={resetForm} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingMethod ? 'Update Method' : 'Create Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-card shipping-list-wrap">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : methods.length === 0 ? (
          <p className="no-shipping-methods">No shipping methods configured</p>
        ) : (
          <div className="shipping-method-grid">
            {methods.map((method) => (
              <div key={method.id} className="shipping-method-card">
                <div className="shipping-method-header">
                  <div>
                    <h3 className="shipping-method-title">{method.name}</h3>
                    <p className="shipping-method-desc">{method.description || 'No description'}</p>
                  </div>

                  <div className="shipping-method-actions">
                    <span className={`status-badge ${method.isActive ? 'status-delivered' : 'status-cancelled'}`}>
                      {method.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <button className="admin-btn admin-btn-outline admin-btn-sm shipping-action-btn" onClick={() => openEditModal(method)} aria-label="Edit Shipping Method" title="Edit Shipping Method">
                      <Edit2 size={13} />
                    </button>

                    <button className="admin-btn admin-btn-danger admin-btn-sm shipping-action-btn" onClick={() => handleDelete(method.id)} aria-label="Delete Shipping Method" title="Delete Shipping Method">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {method.zones?.length ? (
                  <div className="shipping-zone-summary-wrap">
                    <div className="shipping-zone-summary-head">
                      <span>Zone</span>
                      <span>Cost</span>
                      <span>Free Shipping</span>
                    </div>

                    {method.zones.map((zone) => (
                      <div key={`${method.id}-${zone.id || zone.zoneName}`} className="shipping-zone-summary-row">
                        <span>{zone.zoneName}</span>
                        <span>{formatCurrency(zone.cost)}</span>
                        <span>{zone.freeShipMinOrder ? `From ${formatCurrency(zone.freeShipMinOrder)}` : 'Not configured'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="shipping-zone-empty">No shipping zones configured for this method.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


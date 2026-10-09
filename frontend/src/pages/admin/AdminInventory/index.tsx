import Select from '../../../components/Select/Select';
import { translateUi } from '../../../i18n';
import { useTranslation } from 'react-i18next';
﻿import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Check,
  Download,
  Layers,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import './AdminInventory.css';
import { useSearchParams } from 'react-router-dom';

type InventoryTab = 'STOCK' | 'LOGS';
type InventoryType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
type StockStatusFilter = 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK';
type LogPreset = 'ALL' | 'TODAY' | '7D' | '30D';

type PaginationState = {
  page: number;
  total: number;
  totalPages: number;
  limit?: number;
};

type StockVariant = {
  id: number;
  sku?: string;
  stock: number;
  attributes?: Array<{
    attributeValue?: {
      value?: string;
      colorHex?: string;
      attribute?: {
        name?: string;
        slug?: string;
      };
    };
  }>;
};

type StockProduct = {
  id: number;
  name: string;
  sku?: string;
  stock: number;
  images?: Array<{ url: string }>;
  variants?: StockVariant[];
};

type InventoryLog = {
  id: number;
  createdAt: string;
  type: InventoryType;
  quantity: number;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  note?: string | null;
  product?: { name?: string; sku?: string };
  variant?: { sku?: string };
  user?: { fullName?: string };
};

type StockStats = {
  totalProducts: number;
  totalUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  lowThreshold: number;
};

type LogStats = {
  total: number;
  inCount: number;
  outCount: number;
  adjustmentCount: number;
  returnCount: number;
};

type EditingRow = {
  key: string;
  productId: number;
  variantId?: number;
  initial: number;
  value: string;
};

type InventoryForm = {
  productId: string;
  variantId: string;
  type: InventoryType;
  change: number;
  note: string;
};

const DEFAULT_PAGINATION: PaginationState = { page: 1, total: 0, totalPages: 0, limit: 20 };

const DEFAULT_STOCK_STATS: StockStats = {
  totalProducts: 0,
  totalUnits: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  lowThreshold: 10,
};

const DEFAULT_LOG_STATS: LogStats = {
  total: 0,
  inCount: 0,
  outCount: 0,
  adjustmentCount: 0,
  returnCount: 0,
};

const createDefaultForm = (): InventoryForm => ({
  productId: '',
  variantId: '',
  type: 'IN',
  change: 1,
  note: '',
});

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDateInput = (value: Date) => {
  return value.toISOString().slice(0, 10);
};

const buildVariantLabel = (variant: StockVariant) => {
  const parts = (variant.attributes || [])
    .map((attr) => attr.attributeValue?.value || '')
    .filter(Boolean);

  if (parts.length > 0) return parts.join(' / ');
  if (variant.sku) return `Variant ${variant.sku}`;
  return 'Default Variant';
};

const getVariantColorMeta = (variant: StockVariant) => {
  const directColor = (variant.attributes || []).find((item) => item.attributeValue?.colorHex);

  if (directColor?.attributeValue) {
    const label = String(directColor.attributeValue.value || directColor.attributeValue.colorHex || 'Unknown Color').trim();
    const hex = String(directColor.attributeValue.colorHex || '').trim();
    const key = label.toLowerCase();
    return { label, hex, key };
  }

  const namedColor = (variant.attributes || []).find((item) => {
    const name = String(item.attributeValue?.attribute?.name || '').toLowerCase();
    const slug = String(item.attributeValue?.attribute?.slug || '').toLowerCase();
    return slug === 'color' || name === 'color' || name.includes('mau');
  });

  if (namedColor?.attributeValue?.value) {
    const label = String(namedColor.attributeValue.value).trim();
    return { label, hex: '', key: label.toLowerCase() };
  }

  return { label: '', hex: '', key: '' };
};

const getStockStatus = (stock: number, lowThreshold: number) => {
  if (stock <= 0) return { label: 'Out', className: 'out' };
  if (stock <= lowThreshold) return { label: 'Low', className: 'low' };
  return { label: 'Healthy', className: 'healthy' };
};

const stockMatchesStatus = (stocks: number[], status: StockStatusFilter, lowThreshold: number) => {
  if (status === 'ALL') return true;
  if (status === 'LOW_STOCK') return stocks.some((value) => value > 0 && value <= lowThreshold);
  if (status === 'OUT_OF_STOCK') return stocks.some((value) => value <= 0);
  return stocks.some((value) => value > lowThreshold);
};

const getLogTypeMeta = (type: InventoryType) => {
  if (type === 'IN') return { icon: <ArrowUpRight size={14} />, className: 'is-in' };
  if (type === 'OUT') return { icon: <ArrowDownRight size={14} />, className: 'is-out' };
  if (type === 'RETURN') return { icon: <RefreshCw size={14} />, className: 'is-return' };
  return { icon: <SlidersHorizontal size={14} />, className: 'is-adjustment' };
};

const downloadCsv = (fileName: string, headers: string[], rows: string[][]) => {
  const safe = (value: string) => {
    return `"${value.replaceAll('"', '""')}"`;
  };

  const csv = [headers.map(safe).join(','), ...rows.map((row) => row.map((cell) => safe(cell)).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function AdminInventory() {
  useTranslation();
  const [searchParams] = useSearchParams();
  const notificationSku = searchParams.get('sku') || '';
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<InventoryTab>('STOCK');

  const [stockSearchInput, setStockSearchInput] = useState('');
  useEffect(() => {
    if (!notificationSku) return;
    setStockSearchInput(notificationSku);
    setStockStatus('ALL'); setStockSkuFilter('ALL'); setActiveTab('STOCK');
  }, [notificationSku]);
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>('ALL');
  const [stockSkuFilter, setStockSkuFilter] = useState('ALL');
  const [lowThreshold, setLowThreshold] = useState(10);

  const [stocks, setStocks] = useState<StockProduct[]>([]);
  const [stockStats, setStockStats] = useState<StockStats>(DEFAULT_STOCK_STATS);
  const [stockPagination, setStockPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [isStockLoading, setIsStockLoading] = useState(true);

  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [logStats, setLogStats] = useState<LogStats>(DEFAULT_LOG_STATS);
  const [logPagination, setLogPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [isLogLoading, setIsLogLoading] = useState(true);

  const [logSearchInput, setLogSearchInput] = useState('');
  const [logType, setLogType] = useState<'ALL' | InventoryType>('ALL');
  const [logPreset, setLogPreset] = useState<LogPreset>('ALL');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');

  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<InventoryForm>(createDefaultForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectableProducts, setSelectableProducts] = useState<StockProduct[]>([]);
  const [expandedProductGroups, setExpandedProductGroups] = useState<Record<string, boolean>>({});

  const resolvedStockStats = useMemo(() => {
    const hasApiStats =
      stockStats.totalProducts > 0
      || stockStats.totalUnits > 0
      || stockStats.lowStockProducts > 0
      || stockStats.outOfStockProducts > 0;

    if (hasApiStats || stocks.length === 0) {
      return stockStats;
    }

    const skuStocks = stocks.flatMap((item) => {
      if (item.variants && item.variants.length > 0) {
        return item.variants.map((variant) => Number(variant.stock) || 0);
      }
      return [Number(item.stock) || 0];
    });

    return {
      totalProducts: stockPagination.total || stocks.length,
      totalUnits: stocks.reduce((sum, item) => sum + (item.stock || 0), 0),
      lowStockProducts: skuStocks.filter((value) => value > 0 && value <= lowThreshold).length,
      outOfStockProducts: skuStocks.filter((value) => value <= 0).length,
      lowThreshold,
    };
  }, [stockStats, stocks, stockPagination.total, lowThreshold]);

  const availableSkuOptions = useMemo(() => {
    const skus = new Set<string>();

    stocks.forEach((product) => {
      const sku = String(product.sku || '').trim();
      if (sku) skus.add(sku);
    });

    return Array.from(skus).sort((left, right) => left.localeCompare(right));
  }, [stocks]);

  const displayedStocks = useMemo(() => {
    return stocks
      .map((product) => {
        const focusSku = stockSearchInput === notificationSku ? notificationSku : '';
        if (focusSku && product.sku !== focusSku && !product.variants?.some(variant => variant.sku === focusSku)) return null;
        if (stockSkuFilter !== 'ALL' && product.sku !== stockSkuFilter) {
          return null;
        }

        const variants = product.variants || [];
        const hasVariants = variants.length > 0;

        if (!hasVariants) {
          const sourceStocks = [Number(product.stock) || 0];
          if (!stockMatchesStatus(sourceStocks, stockStatus, lowThreshold)) return null;
          return {
            ...product,
            variants: [],
          };
        }

        const sourceVariants = focusSku && product.sku !== focusSku ? variants.filter(variant => variant.sku === focusSku) : variants;
        const visibleVariants = stockStatus === 'ALL'
          ? sourceVariants
          : sourceVariants.filter((variant) => stockMatchesStatus([Number(variant.stock) || 0], stockStatus, lowThreshold));

        if (visibleVariants.length === 0) return null;

        return {
          ...product,
          variants: visibleVariants,
        };
      })
      .filter(Boolean) as StockProduct[];
  }, [stocks, stockStatus, stockSkuFilter, lowThreshold, notificationSku, stockSearchInput]);

  useEffect(() => {
    setExpandedProductGroups((previous) => {
      const next: Record<string, boolean> = {};

      displayedStocks.forEach((product) => {
        const key = String(product.id);

        if (Object.prototype.hasOwnProperty.call(previous, key)) {
          next[key] = previous[key];
          return;
        }

        next[key] = Boolean(notificationSku) || stockSkuFilter !== 'ALL';
      });

      const previousKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);

      if (previousKeys.length !== nextKeys.length) {
        return next;
      }

      for (const key of nextKeys) {
        if (next[key] !== previous[key]) {
          return next;
        }
      }

      return previous;
    });
  }, [displayedStocks, stockSkuFilter, notificationSku]);

  const productsWithVariants = useMemo(() => {
    return displayedStocks.filter((product) => (product.variants || []).length > 0);
  }, [displayedStocks]);

  const allProductGroupsExpanded = useMemo(() => {
    if (productsWithVariants.length === 0) return false;
    return productsWithVariants.every((product) => expandedProductGroups[String(product.id)]);
  }, [productsWithVariants, expandedProductGroups]);

  const toggleProductGroup = (productId: number) => {
    const key = String(productId);
    setExpandedProductGroups((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const toggleAllProductGroups = () => {
    const nextValue = !allProductGroupsExpanded;

    setExpandedProductGroups((previous) => {
      const next = { ...previous };
      productsWithVariants.forEach((product) => {
        next[String(product.id)] = nextValue;
      });
      return next;
    });
  };

  const selectedProduct = useMemo(() => {
    if (!formData.productId) return null;
    return selectableProducts.find((item) => item.id === Number(formData.productId)) || null;
  }, [formData.productId, selectableProducts]);

  const selectedProductHasVariants = useMemo(() => {
    return Boolean(selectedProduct && (selectedProduct.variants || []).length > 0);
  }, [selectedProduct]);

  const selectedVariant = useMemo(() => {
    if (!selectedProduct || !formData.variantId) return null;
    return (selectedProduct.variants || []).find((item) => item.id === Number(formData.variantId)) || null;
  }, [selectedProduct, formData.variantId]);

  const currentStock = selectedVariant
    ? selectedVariant.stock
    : selectedProductHasVariants
      ? 0
      : selectedProduct?.stock || 0;

  const projectedStock = useMemo(() => {
    const value = Number(formData.change) || 0;
    if (formData.type === 'ADJUSTMENT') return value;
    if (formData.type === 'OUT') return currentStock - value;
    return currentStock + value;
  }, [formData.change, formData.type, currentStock]);

  const fetchStocks = async (page = 1, overrides?: Partial<{ search: string; status: StockStatusFilter; lowThreshold: number }>) => {
    const querySearch = overrides?.search ?? stockSearchInput.trim();
    const queryStatus = overrides?.status ?? stockStatus;
    const queryThreshold = overrides?.lowThreshold ?? lowThreshold;

    setIsStockLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
        search: querySearch,
        status: queryStatus,
        lowThreshold: String(queryThreshold),
      });

      const { data } = await api.get(`/admin/inventory/stock?${query.toString()}`);
      const nextStocks: StockProduct[] = data.data || [];
      setStocks(nextStocks);
      setStockPagination(data.pagination || DEFAULT_PAGINATION);

      if (data.stats) {
        setStockStats(data.stats);
      } else {
        const skuStocks = nextStocks.flatMap((item) => {
          if (item.variants && item.variants.length > 0) {
            return item.variants.map((variant) => Number(variant.stock) || 0);
          }
          return [Number(item.stock) || 0];
        });

        setStockStats({
          totalProducts: data.pagination?.total || nextStocks.length,
          totalUnits: nextStocks.reduce((sum, item) => sum + (item.stock || 0), 0),
          lowStockProducts: skuStocks.filter((value) => value > 0 && value <= queryThreshold).length,
          outOfStockProducts: skuStocks.filter((value) => value <= 0).length,
          lowThreshold: queryThreshold,
        });
      }
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to load stock list', 'error');
    } finally {
      setIsStockLoading(false);
    }
  };

  const fetchLogs = async (page = 1, overrides?: Partial<{ search: string; type: 'ALL' | InventoryType; startDate: string; endDate: string }>) => {
    const querySearch = overrides?.search ?? logSearchInput.trim();
    const queryType = overrides?.type ?? logType;
    const queryStart = overrides?.startDate ?? logStartDate;
    const queryEnd = overrides?.endDate ?? logEndDate;

    setIsLogLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
        search: querySearch,
        type: queryType,
      });

      if (queryStart) query.set('startDate', queryStart);
      if (queryEnd) query.set('endDate', queryEnd);

      const { data } = await api.get(`/admin/inventory?${query.toString()}`);
      setLogs(data.data || []);
      setLogPagination(data.pagination || DEFAULT_PAGINATION);
      setLogStats(data.stats || DEFAULT_LOG_STATS);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to load inventory history', 'error');
    } finally {
      setIsLogLoading(false);
    }
  };

  const fetchSelectableProducts = async () => {
    try {
      const pageSize = 100;
      const buildQuery = (page: number) => new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        status: 'ALL',
        lowThreshold: '10',
      });

      const firstResponse = await api.get(`/admin/inventory/stock?${buildQuery(1).toString()}`);
      const firstPageData = firstResponse.data?.data || [];
      const totalPages = Math.max(1, Number(firstResponse.data?.pagination?.totalPages) || 1);

      if (totalPages === 1) {
        setSelectableProducts(firstPageData);
        return;
      }

      const remainingResponses = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => {
          const page = index + 2;
          return api.get(`/admin/inventory/stock?${buildQuery(page).toString()}`);
        })
      );

      setSelectableProducts([
        ...firstPageData,
        ...remainingResponses.flatMap((response) => response.data?.data || []),
      ]);
    } catch {
      setSelectableProducts([]);
    }
  };

  useEffect(() => {
    fetchSelectableProducts();
  }, []);

  useEffect(() => {
    if (activeTab !== 'STOCK') return;

    const timer = window.setTimeout(() => {
      fetchStocks(1, {
        search: stockSearchInput.trim(),
        status: stockStatus,
        lowThreshold,
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activeTab, stockSearchInput, stockStatus, lowThreshold]);

  useEffect(() => {
    if (activeTab !== 'LOGS') return;

    const timer = window.setTimeout(() => {
      fetchLogs(1, {
        search: logSearchInput.trim(),
        type: logType,
        startDate: logStartDate,
        endDate: logEndDate,
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activeTab, logSearchInput, logType, logStartDate, logEndDate]);

  const applyLogPreset = (preset: LogPreset) => {
    setLogPreset(preset);

    if (preset === 'ALL') {
      setLogStartDate('');
      setLogEndDate('');
      return;
    }

    const now = new Date();
    const end = toDateInput(now);
    const startDate = new Date(now);

    if (preset === 'TODAY') {
      const today = toDateInput(startDate);
      setLogStartDate(today);
      setLogEndDate(today);
      return;
    }

    if (preset === '7D') {
      startDate.setDate(startDate.getDate() - 6);
    } else {
      startDate.setDate(startDate.getDate() - 29);
    }

    const start = toDateInput(startDate);
    setLogStartDate(start);
    setLogEndDate(end);
  };

  const handleManualDateChange = (start: string, end: string) => {
    setLogPreset('ALL');
    setLogStartDate(start);
    setLogEndDate(end);
  };

  const handleInlineSave = async () => {
    if (!editingRow) return;

    const current = Number.parseInt(editingRow.value, 10);
    if (!Number.isInteger(current) || current < 0) {
      addToast('Stock must be a non-negative integer', 'error');
      return;
    }

    if (current === editingRow.initial) {
      setEditingRow(null);
      return;
    }

    const payload: Record<string, unknown> = {
      productId: editingRow.productId,
      type: current > editingRow.initial ? 'IN' : 'OUT',
      change: Math.abs(current - editingRow.initial),
      note: 'Quick inline stock update',
    };

    if (editingRow.variantId) payload.variantId = editingRow.variantId;

    try {
      await api.post('/admin/inventory/update', payload);
      addToast('Stock updated successfully', 'success');
      setEditingRow(null);
      fetchStocks(stockPagination.page);
      fetchSelectableProducts();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to update stock', 'error');
    }
  };

  const handleInlineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleInlineSave();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingRow(null);
    }
  };

  const handleCreateTransaction = async (event: FormEvent) => {
    event.preventDefault();

    if (!formData.productId) {
      addToast('Please select a product', 'error');
      return;
    }

    if (selectedProductHasVariants && !formData.variantId) {
      addToast('This product is managed by variants. Please choose a SKU variant.', 'error');
      return;
    }

    const quantity = Number(formData.change);
    if (!Number.isFinite(quantity) || quantity < 0) {
      addToast('Quantity must be a non-negative number', 'error');
      return;
    }

    if (formData.type !== 'ADJUSTMENT' && quantity <= 0) {
      addToast('Quantity must be greater than 0', 'error');
      return;
    }

    if (projectedStock < 0) {
      addToast('Projected stock cannot be negative', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        productId: Number(formData.productId),
        type: formData.type,
        change: quantity,
        note: formData.note,
      };

      if (formData.variantId) payload.variantId = Number(formData.variantId);

      await api.post('/admin/inventory/update', payload);

      addToast('Inventory updated successfully', 'success');
      setIsModalOpen(false);
      setFormData(createDefaultForm());
      fetchStocks(stockPagination.page);
      fetchLogs(1);
      fetchSelectableProducts();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Failed to update inventory', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      addToast('No log records to export', 'info');
      return;
    }

    const rows = logs.map((log) => {
      const delta = typeof log.previousQuantity === 'number' && typeof log.newQuantity === 'number'
        ? log.newQuantity - log.previousQuantity
        : log.type === 'OUT'
          ? -log.quantity
          : log.quantity;

      return [
        formatDateTime(log.createdAt),
        log.product?.name || '-',
        log.variant?.sku || log.product?.sku || '-',
        log.type,
        String(delta),
        String(log.newQuantity ?? '-'),
        log.note || '-',
        log.user?.fullName || '-',
      ];
    });

    downloadCsv(
      `inventory-logs-${toDateInput(new Date())}.csv`,
      ['Date', 'Product', 'SKU', 'Action', 'Change', 'Stock After', 'Note', 'Updated By'],
      rows,
    );
    addToast('Logs exported successfully', 'success');
  };

  const stockRows = useMemo(() => {
    const rows: React.ReactNode[] = [];

    displayedStocks.forEach((product) => {
      const visibleVariants = product.variants || [];
      const hasVariants = visibleVariants.length > 0;
      const isExpanded = Boolean(expandedProductGroups[String(product.id)]);
      const productStatus = getStockStatus(product.stock || 0, lowThreshold);
      const productRowKey = `product-${product.id}`;

      rows.push(
        <tr key={productRowKey} className={`ai-stock-product-row${product.sku === notificationSku ? ' notification-target-row' : ''}`}>
          <td>
            <div className="ai-product-cell">
              {hasVariants ? (
                <button
                  type="button"
                  className="ai-row-toggle"
                  onClick={() => toggleProductGroup(product.id)}
                  aria-label={translateUi("Toggle variants for {{value1}}", { value1: product.name })}
                >
                  <ChevronRight size={14} className={`ai-row-toggle-caret ${isExpanded ? 'expanded' : ''}`} />
                </button>
              ) : (
                <span className="ai-row-toggle-spacer" />
              )}

              {product.images?.[0]?.url ? (
                <img src={resolveSiteAssetUrl(product.images[0].url) || product.images[0].url} alt={product.name} className="ai-product-thumb" width={38} height={38} />
              ) : (
                <div className="ai-product-thumb ai-product-thumb-placeholder" />
              )}
              <div>
                <strong>{product.name}</strong>
                <small>
                  {hasVariants
                    ? translateUi("{{value1}} SKU variants", { value1: visibleVariants.length })
                    : translateUi("Single SKU product")}
                </small>
              </div>
            </div>
          </td>
          <td>{product.sku || '-'}</td>
          <td>
            <div className="ai-stock-cell">
              <span className={`ai-stock-value ${productStatus.className}`}>{product.stock}</span>
              {hasVariants && <small>{translateUi("Total of variant SKUs")}</small>}
            </div>
          </td>
          <td>
            <span className={`ai-status-pill ${productStatus.className}`}>{translateUi(productStatus.label)}</span>
          </td>
          <td>
            {hasVariants ? (
              <button
                type="button"
                className="admin-btn admin-btn-outline admin-btn-sm"
                onClick={() => toggleProductGroup(product.id)}
              >
                {isExpanded ? translateUi("Hide Variants") : translateUi("Show Variants ({{value1}})", { value1: visibleVariants.length })}
              </button>
            ) : editingRow?.key === productRowKey ? (
              <div className="ai-inline-edit">
                <input
                  type="number"
                  min="0"
                  title={translateUi("Edit stock quantity")}
                  aria-label={translateUi("Edit stock quantity")}
                  value={editingRow.value}
                  onChange={(event) => setEditingRow({ ...editingRow, value: event.target.value })}
                  onKeyDown={handleInlineKeyDown}
                />
                <button type="button" className="ai-icon-btn success" onClick={handleInlineSave} title={translateUi("Save")}>
                  <Check size={15} />
                </button>
                <button type="button" className="ai-icon-btn danger" onClick={() => setEditingRow(null)} title={translateUi("Cancel")}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn-outline admin-btn-sm"
                onClick={() =>
                  setEditingRow({
                    key: productRowKey,
                    productId: product.id,
                    initial: product.stock,
                    value: String(product.stock),
                  })
                }
              >{translateUi("Quick Edit")}</button>
            )}
          </td>
        </tr>,
      );

      if (!hasVariants || !isExpanded) {
        return;
      }

      visibleVariants.forEach((variant) => {
        const variantStatus = getStockStatus(variant.stock || 0, lowThreshold);
        const rowKey = `product-${product.id}-variant-${variant.id}`;
        const colorMeta = getVariantColorMeta(variant);

        rows.push(
          <tr key={rowKey} className={`ai-stock-variant-row${variant.sku === notificationSku ? ' notification-target-row' : ''}`}>
            <td>
              <div className="ai-variant-cell">
                <span className="ai-variant-dot" />
                <span>{buildVariantLabel(variant)}</span>
                {colorMeta.hex && (
                  <svg width="14" height="14" viewBox="0 0 14 14" className="ai-color-dot" aria-hidden="true" focusable="false">
                    <circle cx="7" cy="7" r="6" fill={colorMeta.hex} stroke="#cbd5e1" />
                  </svg>
                )}
                {colorMeta.label && <span className="ai-color-chip-text">{translateUi(colorMeta.label)}</span>}
              </div>
            </td>
            <td>{variant.sku || product.sku || '-'}</td>
            <td>
              <span className={`ai-stock-value ${variantStatus.className}`}>{variant.stock}</span>
            </td>
            <td>
              <span className={`ai-status-pill ${variantStatus.className}`}>{translateUi(variantStatus.label)}</span>
            </td>
            <td>
              {editingRow?.key === rowKey ? (
                <div className="ai-inline-edit">
                  <input
                    type="number"
                    min="0"
                    title={translateUi("Edit variant stock quantity")}
                    aria-label={translateUi("Edit variant stock quantity")}
                    value={editingRow.value}
                    onChange={(event) => setEditingRow({ ...editingRow, value: event.target.value })}
                    onKeyDown={handleInlineKeyDown}
                  />
                  <button type="button" className="ai-icon-btn success" onClick={handleInlineSave} title={translateUi("Save")}>
                    <Check size={15} />
                  </button>
                  <button type="button" className="ai-icon-btn danger" onClick={() => setEditingRow(null)} title={translateUi("Cancel")}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  onClick={() =>
                    setEditingRow({
                      key: rowKey,
                      productId: product.id,
                      variantId: variant.id,
                      initial: variant.stock,
                      value: String(variant.stock),
                    })
                  }
                >{translateUi("Quick Edit")}</button>
              )}
            </td>
          </tr>,
        );
      });
    });

    if (rows.length === 0) {
      rows.push(
        <tr key="empty">
          <td colSpan={5}>
            <div className="ai-empty-state">
              <Layers size={42} />
              <h3>{translateUi("No stock records found")}</h3>
              <p>{translateUi("Try changing your search, stock filters, or SKU dropdown.")}</p>
            </div>
          </td>
        </tr>,
      );
    }

    return rows;
  }, [displayedStocks, expandedProductGroups, lowThreshold, editingRow]);

  return (
    <div className="ai-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{translateUi("Inventory Control Center")}</h1>
          <p className="ai-subtitle">{translateUi("Track live stock levels, process adjustments quickly, and audit every inventory movement.")}</p>

          <div className="ai-tab-switcher">
            <button
              className={`admin-btn ${activeTab === 'STOCK' ? 'admin-btn-primary' : 'admin-btn-outline'}`}
              onClick={() => setActiveTab('STOCK')}
            >{translateUi("Current Stock")}</button>
            <button
              className={`admin-btn ${activeTab === 'LOGS' ? 'admin-btn-primary' : 'admin-btn-outline'}`}
              onClick={() => setActiveTab('LOGS')}
            >{translateUi("Inventory History")}</button>
          </div>
        </div>

        <button className="admin-btn admin-btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />{translateUi("Update Inventory")}</button>
      </div>

      {activeTab === 'STOCK' ? (
        <>
          <div className="ai-stats-grid">
            <article className="ai-stat-card admin-card">
              <span>{translateUi("Products in Scope")}</span>
              <strong>{resolvedStockStats.totalProducts}</strong>
            </article>
            <article className="ai-stat-card admin-card">
              <span>{translateUi("Total Units")}</span>
              <strong>{resolvedStockStats.totalUnits}</strong>
            </article>
            <article className="ai-stat-card warning admin-card">
              <span>{translateUi("Low Stock (<=")} {resolvedStockStats.lowThreshold})</span>
              <strong>{resolvedStockStats.lowStockProducts}</strong>
            </article>
            <article className="ai-stat-card danger admin-card">
              <span>{translateUi("Out Of Stock")}</span>
              <strong>{resolvedStockStats.outOfStockProducts}</strong>
            </article>
          </div>

          <div className="admin-card ai-toolbar-card">
            <div className="ai-toolbar">
              <div className="ai-search-wrap">
                <Search size={15} />
                <input
                  value={stockSearchInput}
                  onChange={(event) => setStockSearchInput(event.target.value)}
                  placeholder={translateUi("Search by product name or SKU")}
                />
              </div>

              <Select
                title={translateUi("Filter stock status")}
                aria-label={translateUi("Filter stock status")}
                value={stockStatus}
                onChange={(event) => setStockStatus(event.target.value as StockStatusFilter)}
              >
                <option value="ALL">{translateUi("All Status")}</option>
                <option value="LOW_STOCK">{translateUi("Low Stock")}</option>
                <option value="OUT_OF_STOCK">{translateUi("Out Of Stock")}</option>
                <option value="IN_STOCK">{translateUi("Healthy Stock")}</option>
              </Select>

              <Select
                title={translateUi("Filter by product SKU")}
                aria-label={translateUi("Filter by product SKU")}
                value={stockSkuFilter}
                onChange={(event) => setStockSkuFilter(event.target.value)}
              >
                <option value="ALL">{translateUi("All Product SKU")}</option>
                {availableSkuOptions.map((sku) => (
                  <option key={sku} value={sku}>{sku}</option>
                ))}
              </Select>

              <label className="ai-threshold-input">{translateUi("Low Threshold")}<input
                  type="number"
                  min="1"
                  max="9999"
                  value={lowThreshold}
                  onChange={(event) => setLowThreshold(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>

              <button type="button" className="admin-btn admin-btn-outline" onClick={() => fetchStocks(stockPagination.page)}>
                <RefreshCw size={14} />{translateUi("Refresh")}</button>

              <button type="button" className="admin-btn admin-btn-outline" onClick={toggleAllProductGroups}>
                <Layers size={14} /> {allProductGroupsExpanded ? translateUi("Collapse Products") : translateUi("Expand Products")}
              </button>
            </div>
          </div>

          <div className="admin-card ai-table-card">
            {isStockLoading ? (
              <div className="loading-page"><div className="spinner" /></div>
            ) : (
              <>
                <div className="ai-table-wrap">
                  <table className="ai-table admin-table">
                    <thead>
                      <tr>
                        <th>{translateUi("Product / Variant")}</th>
                        <th>{translateUi("SKU")}</th>
                        <th>{translateUi("Stock")}</th>
                        <th>{translateUi("Status")}</th>
                        <th>{translateUi("Action")}</th>
                      </tr>
                    </thead>
                    <tbody>{stockRows}</tbody>
                  </table>
                </div>

                {stockPagination.totalPages > 1 && (
                  <div className="ai-pagination-wrap">
                    <p>{translateUi("Showing")}<strong>{(stockPagination.page - 1) * 20 + 1}</strong> {translateUi("to")}{' '}
                      <strong>{Math.min(stockPagination.page * 20, stockPagination.total)}</strong> {translateUi("of")}{' '}
                      <strong>{stockPagination.total}</strong>
                    </p>
                    <div className="ai-pagination-buttons">
                      <button
                        className="ai-page-btn"
                        disabled={stockPagination.page <= 1}
                        onClick={() => fetchStocks(stockPagination.page - 1)}
                      >{translateUi("Prev")}</button>
                      <span>{stockPagination.page} / {stockPagination.totalPages}</span>
                      <button
                        className="ai-page-btn"
                        disabled={stockPagination.page >= stockPagination.totalPages}
                        onClick={() => fetchStocks(stockPagination.page + 1)}
                      >{translateUi("Next")}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="ai-stats-grid">
            <article className="ai-stat-card admin-card">
              <span>{translateUi("Total Logs")}</span>
              <strong>{logStats.total}</strong>
            </article>
            <article className="ai-stat-card success admin-card">
              <span>{translateUi("IN / RETURN")}</span>
              <strong>{logStats.inCount + logStats.returnCount}</strong>
            </article>
            <article className="ai-stat-card warning admin-card">
              <span>{translateUi("OUT")}</span>
              <strong>{logStats.outCount}</strong>
            </article>
            <article className="ai-stat-card neutral admin-card">
              <span>{translateUi("ADJUSTMENT")}</span>
              <strong>{logStats.adjustmentCount}</strong>
            </article>
          </div>

          <div className="admin-card ai-toolbar-card">
            <div className="ai-toolbar ai-toolbar-logs">
              <div className="ai-search-wrap">
                <Search size={15} />
                <input
                  value={logSearchInput}
                  onChange={(event) => setLogSearchInput(event.target.value)}
                  placeholder={translateUi("Search by product, SKU, note, or staff")}
                />
              </div>

              <Select
                title={translateUi("Filter log action type")}
                aria-label={translateUi("Filter log action type")}
                value={logType}
                onChange={(event) => setLogType(event.target.value as 'ALL' | InventoryType)}
              >
                <option value="ALL">{translateUi("All Actions")}</option>
                <option value="IN">{translateUi("IN")}</option>
                <option value="OUT">{translateUi("OUT")}</option>
                <option value="RETURN">{translateUi("RETURN")}</option>
                <option value="ADJUSTMENT">{translateUi("ADJUSTMENT")}</option>
              </Select>

              <input
                type="date"
                value={logStartDate}
                onChange={(event) => handleManualDateChange(event.target.value, logEndDate)}
                title={translateUi("Start date")}
              />
              <input
                type="date"
                value={logEndDate}
                onChange={(event) => handleManualDateChange(logStartDate, event.target.value)}
                title={translateUi("End date")}
              />

              <button type="button" className="admin-btn admin-btn-outline" onClick={handleExportLogs}>
                <Download size={14} />{translateUi("Export CSV")}</button>
            </div>

            <div className="ai-presets">
              {(['TODAY', '7D', '30D', 'ALL'] as LogPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`ai-preset-btn ${logPreset === preset ? 'active' : ''}`}
                  onClick={() => applyLogPreset(preset)}
                >
                  {preset === 'TODAY' ? translateUi("Today") : preset === '7D' ? translateUi("7 days") : preset === '30D' ? translateUi("30 days") : translateUi("All time")}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-card ai-table-card">
            {isLogLoading ? (
              <div className="loading-page"><div className="spinner" /></div>
            ) : logs.length === 0 ? (
              <div className="ai-empty-state">
                <PackageOpen size={42} />
                <h3>{translateUi("No inventory logs found")}</h3>
                <p>{translateUi("Try adjusting your filters or create a stock update.")}</p>
              </div>
            ) : (
              <>
                <div className="ai-table-wrap">
                  <table className="ai-table admin-table">
                    <thead>
                      <tr>
                        <th>{translateUi("Date")}</th>
                        <th>{translateUi("Product")}</th>
                        <th>{translateUi("Action")}</th>
                        <th>{translateUi("Change")}</th>
                        <th>{translateUi("Stock After")}</th>
                        <th>{translateUi("Note")}</th>
                        <th>{translateUi("Updated By")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const meta = getLogTypeMeta(log.type);
                        const changeValue = typeof log.previousQuantity === 'number' && typeof log.newQuantity === 'number'
                          ? log.newQuantity - log.previousQuantity
                          : log.type === 'OUT'
                            ? -log.quantity
                            : log.quantity;

                        return (
                          <tr key={log.id}>
                            <td>{formatDateTime(log.createdAt)}</td>
                            <td>
                              <div className="ai-log-product">
                                <strong>{log.product?.name || '-'}</strong>
                                <small>{translateUi("SKU:")} {log.variant?.sku || log.product?.sku || '-'}</small>
                              </div>
                            </td>
                            <td>
                              <span className={`ai-log-type ${meta.className}`}>
                                {meta.icon} {log.type}
                              </span>
                            </td>
                            <td className={changeValue >= 0 ? 'ai-positive' : 'ai-negative'}>
                              {changeValue >= 0 ? '+' : ''}{changeValue}
                            </td>
                            <td>{log.newQuantity ?? '-'}</td>
                            <td>{log.note || '-'}</td>
                            <td>{log.user?.fullName || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {logPagination.totalPages > 1 && (
                  <div className="ai-pagination-wrap">
                    <p>{translateUi("Showing")}<strong>{(logPagination.page - 1) * 20 + 1}</strong> {translateUi("to")}{' '}
                      <strong>{Math.min(logPagination.page * 20, logPagination.total)}</strong> {translateUi("of")}{' '}
                      <strong>{logPagination.total}</strong>
                    </p>
                    <div className="ai-pagination-buttons">
                      <button
                        className="ai-page-btn"
                        disabled={logPagination.page <= 1}
                        onClick={() => fetchLogs(logPagination.page - 1)}
                      >{translateUi("Prev")}</button>
                      <span>{logPagination.page} / {logPagination.totalPages}</span>
                      <button
                        className="ai-page-btn"
                        disabled={logPagination.page >= logPagination.totalPages}
                        onClick={() => fetchLogs(logPagination.page + 1)}
                      >{translateUi("Next")}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content ai-modal-content">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{translateUi("Update Inventory")}</h2>
              <button className="admin-modal-close" aria-label={translateUi("Close")} title={translateUi("Close")} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form className="admin-form" onSubmit={handleCreateTransaction}>
              <div className="admin-form-group">
                <label htmlFor="inv-product">{translateUi("Product")}</label>
                <Select
                  id="inv-product"
                  value={formData.productId}
                  onChange={(event) => setFormData((prev) => ({ ...prev, productId: event.target.value, variantId: '' }))}
                  required
                >
                  <option value="">{translateUi("-- Select Product --")}</option>
                  {selectableProducts.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} {translateUi("(Stock:")} {item.stock})</option>
                  ))}
                </Select>
              </div>

              {selectedProduct && (selectedProduct.variants || []).length > 0 && (
                <div className="admin-form-group">
                  <label htmlFor="inv-variant">{translateUi("Variant (Required)")}</label>
                  <Select
                    id="inv-variant"
                    value={formData.variantId}
                    onChange={(event) => setFormData((prev) => ({ ...prev, variantId: event.target.value }))}
                    required={selectedProductHasVariants}
                  >
                    <option value="">{translateUi("-- Select Variant SKU --")}</option>
                    {(selectedProduct.variants || []).map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {buildVariantLabel(variant)} {translateUi("(Stock:")} {variant.stock})
                      </option>
                    ))}
                  </Select>
                  <small className="ai-form-helper">{translateUi("Product stock is aggregated from variants, so updates must target a specific SKU.")}</small>
                </div>
              )}

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="inv-type">{translateUi("Action")}</label>
                  <Select
                    id="inv-type"
                    value={formData.type}
                    onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value as InventoryType }))}
                  >
                    <option value="IN">{translateUi("IN (Restock)")}</option>
                    <option value="OUT">{translateUi("OUT (Damaged/Loss)")}</option>
                    <option value="RETURN">{translateUi("RETURN (Customer Return)")}</option>
                    <option value="ADJUSTMENT">{translateUi("ADJUSTMENT (Set Exact Stock)")}</option>
                  </Select>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="inv-change">{formData.type === 'ADJUSTMENT' ? translateUi("New Total") : translateUi("Quantity")}</label>
                  <input
                    id="inv-change"
                    type="number"
                    min="0"
                    value={formData.change}
                    onChange={(event) => setFormData((prev) => ({ ...prev, change: Number(event.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="ai-quick-actions">
                {(formData.type === 'ADJUSTMENT' ? [0, 5, 10, 50] : [1, 5, 10, 20]).map((step) => (
                  <button
                    key={step}
                    type="button"
                    className="admin-btn admin-btn-outline admin-btn-sm"
                    onClick={() => setFormData((prev) => ({ ...prev, change: step }))}
                  >
                    {formData.type === 'ADJUSTMENT' ? translateUi("Set {{value1}}", { value1: step }) : `+${step}`}
                  </button>
                ))}
              </div>

              <div className="ai-stock-preview">
                <span>{translateUi("Current:")} <strong>{selectedProductHasVariants && !selectedVariant ? '-' : currentStock}</strong></span>
                <span>{translateUi("After Update:")}{' '}
                  <strong className={projectedStock < 0 ? 'ai-negative' : 'ai-positive'}>
                    {selectedProductHasVariants && !selectedVariant ? '-' : projectedStock}
                  </strong>
                </span>
              </div>

              <div className="admin-form-group">
                <label htmlFor="inv-note">{translateUi("Note")}</label>
                <textarea
                  id="inv-note"
                  rows={3}
                  placeholder={translateUi("Why this adjustment was made")}
                  value={formData.note}
                  onChange={(event) => setFormData((prev) => ({ ...prev, note: event.target.value }))}
                />
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={() => setIsModalOpen(false)}>{translateUi("Cancel")}</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isSubmitting || projectedStock < 0}>
                  {isSubmitting ? translateUi("Saving...") : translateUi("Save Inventory")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

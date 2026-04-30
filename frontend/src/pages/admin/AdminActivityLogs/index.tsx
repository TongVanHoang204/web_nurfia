import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import api from '../../../api/client';
import { Activity, CalendarDays, Download, Eye, Filter, ListRestart, RefreshCw, RotateCcw, Search, Users, X } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useAuthStore } from '../../../stores/authStore';
import './AdminActivityLogs.css';

type ActivityUser = {
  id: number;
  fullName: string;
  email: string;
};

type ActivityLog = {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: unknown;
  ipAddress?: string | null;
  createdAt: string;
  user?: ActivityUser | null;
};

type ActivityStats = {
  totalLogs: number;
  todayLogs: number;
  uniqueUsers: number;
  filteredLogs: number;
};

type ActivityPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ActivityFilterOptions = {
  actions: string[];
  entityTypes: string[];
};

type ActivityResponse = {
  data?: ActivityLog[];
  stats?: Partial<ActivityStats>;
  filters?: ActivityFilterOptions;
  pagination?: Partial<ActivityPagination>;
};

type SortOption = 'NEWEST' | 'OLDEST';
type DatePreset = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM';

type DetailEntry = {
  label: string;
  value: string;
};

type DetailSection = {
  title: 'Before' | 'After' | 'Metadata' | 'Details';
  entries: DetailEntry[];
};

type ComparisonRow = {
  label: string;
  beforeValue: string;
  afterValue: string;
  changed: boolean;
};

const DEFAULT_PAGE_SIZE = 20;

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDateRangeFromPreset = (preset: DatePreset): { startDate: string; endDate: string } => {
  const today = new Date();
  const todayValue = toDateInputValue(today);

  if (preset === 'TODAY') {
    return { startDate: todayValue, endDate: todayValue };
  }

  if (preset === 'LAST_7_DAYS') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { startDate: toDateInputValue(start), endDate: todayValue };
  }

  if (preset === 'LAST_30_DAYS') {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { startDate: toDateInputValue(start), endDate: todayValue };
  }

  if (preset === 'THIS_MONTH') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: toDateInputValue(start), endDate: todayValue };
  }

  return { startDate: '', endDate: '' };
};

const getDatePresetLabel = (preset: DatePreset) => {
  if (preset === 'TODAY') return 'Today';
  if (preset === 'LAST_7_DAYS') return '7 days';
  if (preset === 'LAST_30_DAYS') return '30 days';
  if (preset === 'THIS_MONTH') return 'This month';
  if (preset === 'CUSTOM') return 'Custom';
  return 'All time';
};

const isSameCalendarDay = (dateValue: string, comparedAt = new Date()) => {
  const date = new Date(dateValue);
  return date.getFullYear() === comparedAt.getFullYear()
    && date.getMonth() === comparedAt.getMonth()
    && date.getDate() === comparedAt.getDate();
};

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const humanizeToken = (value: string) => {
  return String(value || '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getActionBadgeClass = (action: string) => {
  const normalized = String(action || '').toUpperCase();
  if (normalized === 'CREATE') return 'action-create';
  if (normalized === 'UPDATE') return 'action-update';
  if (normalized === 'DELETE') return 'action-delete';
  if (normalized === 'LOGIN' || normalized === 'LOGOUT') return 'action-auth';
  return 'action-default';
};

const getEntityLabel = (entityType: string, entityId?: number | null) => {
  const name = humanizeToken(entityType);
  return entityId ? `${name} #${entityId}` : name;
};

const toReadableValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (value instanceof Date) return formatDateTime(value.toISOString());
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) return formatDateTime(trimmed);
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    if (!value.length) return '-';
    return value.map((item) => toReadableValue(item)).join(', ');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const normalizeDetailLabel = (path: string) => {
  return path
    .split('.')
    .map((part) => humanizeToken(part.replace(/\[(\d+)\]/g, ' $1')))
    .join(' > ');
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const BEFORE_KEY_PATTERN = /^(before|old|previous|prev|from)(_|[A-Z]|$)|^(old_value|old_values|previous_value|previous_values|before_state|before_data)$/i;
const AFTER_KEY_PATTERN = /^(after|new|current|to)(_|[A-Z]|$)|^(new_value|new_values|updated_value|updated_values|after_state|after_data)$/i;
const META_KEY_PATTERN = /^(meta|metadata|reason|source|context|note|notes|changed_by|changed_fields|fields_changed|trigger|message)$/i;

const buildDetailEntries = (details: unknown, prefix = ''): DetailEntry[] => {
  if (details === null || details === undefined) return [];

  if (typeof details === 'string') {
    return [{ label: prefix || 'Details', value: details }];
  }

  if (typeof details !== 'object') {
    return [{ label: prefix || 'Details', value: toReadableValue(details) }];
  }

  if (Array.isArray(details)) {
    if (!details.length) return [];

    const hasNestedObject = details.some((item) => item && typeof item === 'object');
    if (!hasNestedObject) {
      return [{ label: prefix || 'Items', value: toReadableValue(details) }];
    }

    return details.flatMap((item, index) => buildDetailEntries(item, `${prefix}[${index + 1}]`));
  }

  const objectEntries = Object.entries(details as Record<string, unknown>);
  if (!objectEntries.length) return [];

  return objectEntries.flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return buildDetailEntries(value, path);
    }

    return [{ label: normalizeDetailLabel(path), value: toReadableValue(value) }];
  });
};

const objectToDetailEntries = (record: Record<string, unknown>) => {
  return Object.entries(record).flatMap(([key, value]) => buildDetailEntries(value, key));
};

const buildDetailSections = (details: unknown): DetailSection[] => {
  if (!isPlainObject(details)) {
    const entries = buildDetailEntries(details);
    return entries.length ? [{ title: 'Details', entries }] : [];
  }

  const source = details as Record<string, unknown>;
  let beforeCandidate: unknown;
  let afterCandidate: unknown;
  const metadataBucket: Record<string, unknown> = {};
  const remainingBucket: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, value]) => {
    const normalizedKey = key.trim();

    if (BEFORE_KEY_PATTERN.test(normalizedKey)) {
      beforeCandidate = value;
      return;
    }

    if (AFTER_KEY_PATTERN.test(normalizedKey)) {
      afterCandidate = value;
      return;
    }

    if (normalizedKey.toLowerCase() === 'changes' && isPlainObject(value)) {
      Object.entries(value).forEach(([changeKey, changeValue]) => {
        if (BEFORE_KEY_PATTERN.test(changeKey)) {
          beforeCandidate = changeValue;
          return;
        }

        if (AFTER_KEY_PATTERN.test(changeKey)) {
          afterCandidate = changeValue;
          return;
        }

        if (META_KEY_PATTERN.test(changeKey)) {
          metadataBucket[changeKey] = changeValue;
          return;
        }

        remainingBucket[`changes.${changeKey}`] = changeValue;
      });
      return;
    }

    if (META_KEY_PATTERN.test(normalizedKey)) {
      metadataBucket[normalizedKey] = value;
      return;
    }

    remainingBucket[normalizedKey] = value;
  });

  const hasDiffStructure = beforeCandidate !== undefined || afterCandidate !== undefined;
  if (!hasDiffStructure) {
    const entries = buildDetailEntries(details);
    return entries.length ? [{ title: 'Details', entries }] : [];
  }

  const sections: DetailSection[] = [];
  const beforeEntries = buildDetailEntries(beforeCandidate);
  const afterEntries = buildDetailEntries(afterCandidate);
  const metadataEntries = [
    ...objectToDetailEntries(metadataBucket),
    ...objectToDetailEntries(remainingBucket),
  ];

  if (beforeEntries.length) sections.push({ title: 'Before', entries: beforeEntries });
  if (afterEntries.length) sections.push({ title: 'After', entries: afterEntries });
  if (metadataEntries.length) sections.push({ title: 'Metadata', entries: metadataEntries });

  if (!sections.length) {
    const entries = buildDetailEntries(details);
    return entries.length ? [{ title: 'Details', entries }] : [];
  }

  return sections;
};

const serializeDetailSections = (sections: DetailSection[]) => {
  return sections
    .map((section) => {
      const rows = section.entries.map((entry) => `${entry.label}: ${entry.value}`).join('\n');
      return `${section.title}:\n${rows}`;
    })
    .join('\n\n')
    .trim();
};

const getSection = (sections: DetailSection[], title: DetailSection['title']) => {
  return sections.find((section) => section.title === title);
};

const buildComparisonRows = (sections: DetailSection[]): ComparisonRow[] => {
  const beforeEntries = getSection(sections, 'Before')?.entries || [];
  const afterEntries = getSection(sections, 'After')?.entries || [];
  if (!beforeEntries.length || !afterEntries.length) return [];

  const beforeMap = new Map(beforeEntries.map((entry) => [entry.label, entry.value]));
  const afterMap = new Map(afterEntries.map((entry) => [entry.label, entry.value]));
  const allLabels = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]));

  return allLabels
    .map((label) => {
      const beforeValue = beforeMap.get(label) || '-';
      const afterValue = afterMap.get(label) || '-';
      return {
        label,
        beforeValue,
        afterValue,
        changed: beforeValue !== afterValue,
      };
    })
    .sort((a, b) => Number(b.changed) - Number(a.changed));
};

const canRollbackFromSections = (log: ActivityLog, sections: DetailSection[]) => {
  if (String(log.action || '').toUpperCase() !== 'UPDATE') return false;
  if (!log.entityId) return false;
  return Boolean(getSection(sections, 'Before')?.entries.length);
};

const getDetailsText = (details: unknown) => {
  if (details === null || details === undefined) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
};

const getDetailsPreview = (details: unknown) => {
  const sections = buildDetailSections(details);
  if (!sections.length) return 'No extra details';

  const previewLines = sections.flatMap((section) => {
    return section.entries.map((entry) => {
      if (section.title === 'Details') return `${entry.label}: ${entry.value}`;
      return `${section.title} - ${entry.label}: ${entry.value}`;
    });
  });

  return previewLines.slice(0, 2).join(' â€¢ ');
};

const escapeCsv = (value: unknown) => {
  const normalized = String(value ?? '');
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
};

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    totalLogs: 0,
    todayLogs: 0,
    uniqueUsers: 0,
    filteredLogs: 0,
  });
  const [filterOptions, setFilterOptions] = useState<ActivityFilterOptions>({ actions: [], entityTypes: [] });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<ActivityPagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NEWEST');

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [rollbackingLogId, setRollbackingLogId] = useState<number | null>(null);

  const { addToast, openConfirm } = useUIStore();
  const { user } = useAuthStore();
  const canManageRollback = user?.role === 'ADMIN'
    || (user?.role === 'MANAGER' || user?.role === 'STAFF')
    && Array.isArray(user?.permissions)
    && user.permissions.includes('MANAGE_SETTINGS');

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setIsRefreshing(true);

    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortOption,
        ...(search ? { search } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(entityFilter ? { entityType: entityFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      const { data } = await api.get(`/admin/activities?${query.toString()}`);
      const payload = (data || {}) as ActivityResponse;
      const responseLogs = Array.isArray(payload.data) ? payload.data : [];
      const fallbackPagination: ActivityPagination = {
        page,
        limit,
        total: responseLogs.length,
        totalPages: 1,
      };
      const responsePagination: ActivityPagination = {
        page: Number(payload.pagination?.page || fallbackPagination.page),
        limit: Number(payload.pagination?.limit || fallbackPagination.limit),
        total: Number(payload.pagination?.total || fallbackPagination.total),
        totalPages: Number(payload.pagination?.totalPages || fallbackPagination.totalPages),
      };

      setLogs(responseLogs);
      setPagination(responsePagination);

      const statsPayload = payload.stats || {};
      const fallbackStats: ActivityStats = {
        totalLogs: responsePagination.total > 0 ? responsePagination.total : responseLogs.length,
        todayLogs: responseLogs.filter((log) => isSameCalendarDay(log.createdAt)).length,
        uniqueUsers: new Set(responseLogs.map((log) => log.userId).filter(Boolean)).size,
        filteredLogs: responsePagination.total,
      };

      const candidateStats: ActivityStats = {
        totalLogs: Number(statsPayload.totalLogs ?? fallbackStats.totalLogs),
        todayLogs: Number(statsPayload.todayLogs ?? fallbackStats.todayLogs),
        uniqueUsers: Number(statsPayload.uniqueUsers ?? fallbackStats.uniqueUsers),
        filteredLogs: Number(statsPayload.filteredLogs ?? fallbackStats.filteredLogs),
      };

      const statsLooksStale =
        responseLogs.length > 0
        && candidateStats.totalLogs === 0
        && candidateStats.filteredLogs === 0;

      setStats(statsLooksStale ? fallbackStats : candidateStats);
      setFilterOptions(payload.filters || { actions: [], entityTypes: [] });
    } catch (error) {
      console.error('Failed to fetch activity logs', error);
      addToast('Failed to load activity logs', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [actionFilter, addToast, endDate, entityFilter, limit, page, search, sortOption, startDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = window.setInterval(() => {
      fetchLogs(true);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchLogs]);

  const pageNumbers = useMemo(() => {
    const totalPages = pagination.totalPages;
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const numbers: number[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) numbers.push(-1);
    for (let current = start; current <= end; current += 1) {
      numbers.push(current);
    }
    if (end < totalPages - 1) numbers.push(-2);
    numbers.push(totalPages);

    return numbers;
  }, [page, pagination.totalPages]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchInput.trim();

    if (keyword === search && page === 1) {
      fetchLogs();
      return;
    }

    setPage(1);
    setSearch(keyword);
  };

  const resetFilters = () => {
    const alreadyDefault = !search && !searchInput && !actionFilter && !entityFilter && !startDate && !endDate && datePreset === 'ALL' && sortOption === 'NEWEST' && limit === DEFAULT_PAGE_SIZE;

    setSearch('');
    setSearchInput('');
    setActionFilter('');
    setEntityFilter('');
    setStartDate('');
    setEndDate('');
    setDatePreset('ALL');
    setSortOption('NEWEST');
    setLimit(DEFAULT_PAGE_SIZE);
    setPage(1);

    if (alreadyDefault) fetchLogs();
  };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const nextRange = buildDateRangeFromPreset(preset);
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
    setPage(1);
  };

  const detailSectionsByLog = useMemo(() => {
    const map: Record<number, DetailSection[]> = {};
    logs.forEach((log) => {
      map[log.id] = buildDetailSections(log.details);
    });
    return map;
  }, [logs]);

  const activePresetLabel = useMemo(() => getDatePresetLabel(datePreset), [datePreset]);

  const hasAnyActivityData = stats.totalLogs > 0 || pagination.total > 0 || logs.length > 0;

  const copyLogDetails = async (log: ActivityLog) => {
    const detailSections = detailSectionsByLog[log.id] || [];
    const content = detailSections.length
      ? serializeDetailSections(detailSections)
      : getDetailsText(log.details);

    if (!content) {
      addToast('This log has no details to copy', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      addToast('Log details copied', 'success');
    } catch {
      addToast('Unable to copy details', 'error');
    }
  };

  const handleRollback = (log: ActivityLog) => {
    if (!canManageRollback) {
      addToast('You do not have permission to rollback activity logs', 'error');
      return;
    }

    const detailSections = detailSectionsByLog[log.id] || [];
    if (!canRollbackFromSections(log, detailSections)) {
      addToast('Rollback is not available for this log', 'info');
      return;
    }

    openConfirm({
      title: 'Rollback This Change?',
      message: `Restore ${getEntityLabel(log.entityType, log.entityId)} to previous values captured in this log?`,
      confirmText: 'Rollback',
      cancelText: 'Cancel',
      danger: true,
      onConfirm: async () => {
        setRollbackingLogId(log.id);
        try {
          await api.post(`/admin/activities/${log.id}/rollback`);
          addToast('Rollback completed successfully', 'success');
          setSelectedLog(null);
          fetchLogs(true);
        } catch (error: any) {
          const statusCode = Number(error?.response?.status || 0);
          const backendMessage = error?.response?.data?.error || error?.response?.data?.message;

          if (backendMessage) {
            addToast(backendMessage, 'error');
          } else if (statusCode === 404) {
            addToast('Rollback endpoint or activity log was not found. Please restart backend and try again.', 'error');
          } else if (statusCode === 401 || statusCode === 403) {
            addToast('Your session is not authorized for rollback. Please log in again.', 'error');
          } else {
            addToast('Rollback failed', 'error');
          }
        } finally {
          setRollbackingLogId(null);
        }
      },
    });
  };

  const exportCurrentPageCsv = () => {
    if (!logs.length) {
      addToast('No logs to export', 'info');
      return;
    }

    const header = ['Time', 'User Name', 'User Email', 'Action', 'Entity', 'IP Address', 'Details'];
    const rows = logs.map((log) => [
      formatDateTime(log.createdAt),
      log.user?.fullName || 'System',
      log.user?.email || '-',
      log.action,
      getEntityLabel(log.entityType, log.entityId),
      log.ipAddress || '-',
      serializeDetailSections(detailSectionsByLog[log.id] || []) || getDetailsText(log.details),
    ]);

    const csvContent = [header, ...rows]
      .map((columns) => columns.map((column) => escapeCsv(column)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `activity-logs-page-${page}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = useMemo(() => {
    return [search, actionFilter, entityFilter, startDate, endDate, datePreset !== 'ALL', sortOption !== 'NEWEST', limit !== DEFAULT_PAGE_SIZE]
      .filter(Boolean)
      .length;
  }, [actionFilter, datePreset, endDate, entityFilter, limit, search, sortOption, startDate]);

  return (
    <div className="activity-logs-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title activity-logs-title">
            <Activity size={24} className="activity-logs-title-icon" />
            Activity Logs
          </h1>
          <p className="activity-logs-subtitle">Track admin actions, audit sensitive operations, and inspect full event details in one place.</p>
        </div>

        <div className="activity-logs-header-actions">
          <button type="button" className={`admin-btn admin-btn-outline ${autoRefresh ? 'is-active' : ''}`} onClick={() => setAutoRefresh((current) => !current)}>
            <RefreshCw size={14} className={isRefreshing ? 'is-spinning' : ''} />
            Auto-refresh {autoRefresh ? 'On' : 'Off'}
          </button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={() => fetchLogs(true)}>
            <ListRestart size={14} /> Refresh
          </button>
          <button type="button" className="admin-btn admin-btn-primary" onClick={exportCurrentPageCsv}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="activity-logs-stats-grid">
        <article className="activity-logs-stat-card">
          <span>Total Logs</span>
          <strong>{stats.totalLogs}</strong>
        </article>
        <article className="activity-logs-stat-card">
          <span>Today</span>
          <strong>{stats.todayLogs}</strong>
        </article>
        <article className="activity-logs-stat-card">
          <span>Unique Users</span>
          <strong>{stats.uniqueUsers}</strong>
        </article>
        <article className="activity-logs-stat-card">
          <span>Matched Result</span>
          <strong>{stats.filteredLogs}</strong>
        </article>
      </div>

      {!hasAnyActivityData && (
        <div className="activity-logs-no-data-note">
          No activity logs found in the system yet. Try updating data in modules like Products, Orders, or Coupons, then come back to view analytics.
        </div>
      )}

      <div className="admin-card activity-logs-filter-card">
        <form className="activity-logs-filter-grid" onSubmit={handleSearch}>
          <div className="activity-logs-input-wrap is-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search action, entity, IP, user name or email"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <label className="activity-logs-input-wrap" aria-label="Filter by action">
            <Filter size={15} />
            <select
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map((action) => (
                <option key={action} value={action}>{humanizeToken(action)}</option>
              ))}
            </select>
          </label>

          <label className="activity-logs-input-wrap" aria-label="Filter by entity">
            <Filter size={15} />
            <select
              value={entityFilter}
              onChange={(event) => {
                setEntityFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Entities</option>
              {filterOptions.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>{humanizeToken(entityType)}</option>
              ))}
            </select>
          </label>

          <label className="activity-logs-input-wrap" aria-label="Start date">
            <CalendarDays size={15} />
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setDatePreset('CUSTOM');
                setStartDate(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <label className="activity-logs-input-wrap" aria-label="End date">
            <CalendarDays size={15} />
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setDatePreset('CUSTOM');
                setEndDate(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <span className="activity-logs-active-preset-badge">Preset: {activePresetLabel}</span>

          <div className="activity-logs-preset-inline">
            <button type="button" className={`admin-btn admin-btn-sm ${datePreset === 'TODAY' ? 'admin-btn-primary' : 'admin-btn-outline'}`} onClick={() => applyDatePreset('TODAY')}>Today</button>
            <button type="button" className={`admin-btn admin-btn-sm ${datePreset === 'LAST_7_DAYS' ? 'admin-btn-primary' : 'admin-btn-outline'}`} onClick={() => applyDatePreset('LAST_7_DAYS')}>7 days</button>
            <button type="button" className={`admin-btn admin-btn-sm ${datePreset === 'LAST_30_DAYS' ? 'admin-btn-primary' : 'admin-btn-outline'}`} onClick={() => applyDatePreset('LAST_30_DAYS')}>30 days</button>
            <button type="button" className={`admin-btn admin-btn-sm ${datePreset === 'THIS_MONTH' ? 'admin-btn-primary' : 'admin-btn-outline'}`} onClick={() => applyDatePreset('THIS_MONTH')}>This month</button>
            <button type="button" className={`admin-btn admin-btn-sm ${datePreset === 'ALL' ? 'admin-btn-primary' : 'admin-btn-outline'}`} onClick={() => applyDatePreset('ALL')}>All time</button>
          </div>

          <label className="activity-logs-input-wrap" aria-label="Sort logs">
            <Filter size={15} />
            <select value={sortOption} onChange={(event) => { setSortOption(event.target.value as SortOption); setPage(1); }}>
              <option value="NEWEST">Sort: Newest first</option>
              <option value="OLDEST">Sort: Oldest first</option>
            </select>
          </label>

          <label className="activity-logs-input-wrap" aria-label="Page size">
            <Users size={15} />
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </label>

          <button type="submit" className="admin-btn admin-btn-primary">Search</button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={resetFilters}>Reset</button>

          {activeFilterCount > 0 && <span className="activity-logs-filter-chip">{activeFilterCount} active filter(s)</span>}
        </form>
      </div>

      <div className="admin-card activity-logs-list-card">
        {loading ? <div className="loading-page"><div className="spinner" /></div> : (
          <>
            {logs.length === 0 ? (
              <div className="activity-logs-empty-state">No logs found for the current filters.</div>
            ) : (
              <div className="activity-logs-list">
                {logs.map((log) => (
                  <article key={log.id} className="activity-log-item">
                    <div className="activity-log-main">
                      <div className="activity-log-top-row">
                        <span className={`activity-log-action-badge ${getActionBadgeClass(log.action)}`}>{humanizeToken(log.action)}</span>
                        <span className="activity-log-entity-chip">{getEntityLabel(log.entityType, log.entityId)}</span>
                      </div>

                      <h3 className="activity-log-user-name">{log.user?.fullName || 'System Event'}</h3>
                      <p className="activity-log-user-email">{log.user?.email || 'No user email'}</p>

                      <p className="activity-log-details-preview">{getDetailsPreview(log.details)}</p>

                      <div className="activity-log-meta-row">
                        <span>{formatDateTime(log.createdAt)}</span>
                        <span>IP: {log.ipAddress || '-'}</span>
                      </div>
                    </div>

                    <div className="activity-log-actions">
                      <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setSelectedLog(log)}>
                        <Eye size={14} /> View Details
                      </button>
                      <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => copyLogDetails(log)}>
                        <Download size={14} /> Copy Details
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="activity-logs-pagination">
                <button
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>

                {pageNumbers.map((pageNumber) => (
                  pageNumber < 0 ? (
                    <span key={pageNumber} className="activity-logs-pagination-ellipsis">...</span>
                  ) : (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`admin-btn admin-btn-sm ${pageNumber === page ? 'admin-btn-primary' : 'admin-btn-outline'}`}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  )
                ))}

                <button
                  className="admin-btn admin-btn-outline admin-btn-sm"
                  disabled={page === pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>

                <span className="activity-logs-pagination-text">{pagination.total} records</span>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLog && (
        <div className="admin-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="admin-modal-content activity-log-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Activity Detail</h3>
              <button type="button" className="admin-modal-close" aria-label="Close activity detail modal" title="Close" onClick={() => setSelectedLog(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body activity-log-modal-layout">
              <div className="activity-log-modal-grid">
                <div><span>Time</span><strong>{formatDateTime(selectedLog.createdAt)}</strong></div>
                <div><span>User</span><strong>{selectedLog.user?.fullName || 'System Event'}</strong></div>
                <div><span>Action</span><strong>{humanizeToken(selectedLog.action)}</strong></div>
                <div><span>Entity</span><strong>{getEntityLabel(selectedLog.entityType, selectedLog.entityId)}</strong></div>
                <div><span>Email</span><strong>{selectedLog.user?.email || '-'}</strong></div>
                <div><span>IP Address</span><strong>{selectedLog.ipAddress || '-'}</strong></div>
              </div>

              <div className="activity-log-modal-json-wrap">
                <div className="activity-log-modal-json-title">Payload Details</div>

                {(detailSectionsByLog[selectedLog.id] || []).length === 0 ? (
                  <div className="activity-log-empty-payload">No detailed payload for this activity.</div>
                ) : (
                  <div className="activity-log-detail-sections">
                    {buildComparisonRows(detailSectionsByLog[selectedLog.id] || []).length > 0 && (
                      <section className="activity-log-detail-section">
                        <div className="activity-log-detail-section-title">Before vs After</div>
                        <div className="activity-log-diff-table-wrap">
                          <table className="activity-log-diff-table">
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Before</th>
                                <th>After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buildComparisonRows(detailSectionsByLog[selectedLog.id] || []).map((row) => (
                                <tr key={row.label} className={row.changed ? 'is-changed' : ''}>
                                  <td>{row.label}</td>
                                  <td>{row.beforeValue}</td>
                                  <td>{row.afterValue}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {(detailSectionsByLog[selectedLog.id] || [])
                      .filter((section) => section.title !== 'Before' && section.title !== 'After')
                      .map((section) => (
                      <section key={section.title} className="activity-log-detail-section">
                        <div className="activity-log-detail-section-title">{section.title}</div>
                        <div className="activity-log-detail-list">
                          {section.entries.map((entry, index) => (
                            <div key={`${section.title}-${entry.label}-${index}`} className="activity-log-detail-row">
                              <span>{entry.label}</span>
                              <strong>{entry.value}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-actions">
              {canManageRollback && canRollbackFromSections(selectedLog, detailSectionsByLog[selectedLog.id] || []) && (
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => handleRollback(selectedLog)}
                  disabled={rollbackingLogId === selectedLog.id}
                >
                  <RotateCcw size={14} /> {rollbackingLogId === selectedLog.id ? 'Rolling Back...' : 'Rollback'}
                </button>
              )}
              <button type="button" className="admin-btn admin-btn-outline" onClick={() => copyLogDetails(selectedLog)}>Copy Details</button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


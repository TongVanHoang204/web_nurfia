import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  Calendar,
  Download,
  FileText,
  MoreVertical,
  Settings,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import './AdminReports.css';

const COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b', '#6366f1'];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  SHIPPING: 'Shipping',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  unknown: 'Unknown',
};

type ReportMetric = {
  value: number;
  trend: number;
};

type ReportRange = {
  mode?: 'preset' | 'custom';
  days: number;
  startDate: string;
  endDate: string;
};

type ReportFilters = {
  mode: 'preset' | 'custom';
  days: number;
  startDate: string;
  endDate: string;
};

type ReportPoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  signups: number;
};

type CategoryPoint = {
  name: string;
  units: number;
  revenue: number;
};

type StatusPoint = {
  status: string;
  label: string;
  value: number;
  color: string;
};

type FeaturedCustomer = {
  id: number;
  fullName: string;
  email: string;
  initials: string;
  status: string;
  totalSpent: number;
  orders: number;
  lastOrderAt: string;
};

type TopProduct = {
  id: number;
  name: string;
  units: number;
  revenue: number;
};

type ReportsData = {
  range: ReportRange;
  kpis: {
    newSignups: ReportMetric;
    activeCustomers: ReportMetric;
    netRevenue: ReportMetric;
  };
  overview: {
    orders: number;
    avgOrderValue: number;
    topProducts: number;
  };
  traffic: {
    revenuePerDay: number;
    ordersPerDay: number;
    visitors: number;
  };
  trafficSeries: ReportPoint[];
  salesByCategory: CategoryPoint[];
  statusDistribution: StatusPoint[];
  incomeComparison: ReportPoint[];
  topProducts: TopProduct[];
  featuredCustomers: FeaturedCustomer[];
  goals: {
    revenue: {
      current: number;
      target: number;
    };
    orders: {
      current: number;
      target: number;
    };
    conversionRate: number;
  };
};

type TooltipPayloadItem = {
  value?: number;
  name?: string;
};

type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  formatter?: (value: number | undefined, name: string | undefined) => [string | number, string];
  labelFormatter?: (label: string) => string;
};

const DEFAULT_REPORT_DATA: ReportsData = {
  range: {
    days: 30,
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
  },
  kpis: {
    newSignups: { value: 0, trend: 0 },
    activeCustomers: { value: 0, trend: 0 },
    netRevenue: { value: 0, trend: 0 },
  },
  overview: {
    orders: 0,
    avgOrderValue: 0,
    topProducts: 0,
  },
  traffic: {
    revenuePerDay: 0,
    ordersPerDay: 0,
    visitors: 0,
  },
  trafficSeries: [],
  salesByCategory: [],
  statusDistribution: [],
  incomeComparison: [],
  topProducts: [],
  featuredCustomers: [],
  goals: {
    revenue: { current: 0, target: 1 },
    orders: { current: 0, target: 1 },
    conversionRate: 0,
  },
};

const RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const MAX_CUSTOM_RANGE_DAYS = 366;

const toInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createPresetRange = (days: number) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (days - 1));

  return {
    startDate: toInputDate(startDate),
    endDate: toInputDate(endDate),
  };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(value || 0);

const formatNumber = (value: number | undefined) => new Intl.NumberFormat('en-US').format(Number(value || 0));

const normalizeSparklineSeries = <T extends Record<string, unknown>>(series: T[], key: keyof T) => {
  if (!series.length) return [];
  const values = series.map((item) => Number(item[key] || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return series.map((item) => ({
    ...item,
    sparkValue: range === 0 ? 52 : 18 + ((Number(item[key] || 0) - min) / range) * 64,
  }));
};

const toChartDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
  });
};

const toChartDateFull = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const translateStatus = (status: string) => STATUS_LABELS[status] || status;

const translateCustomerActivity = (status: string) => {
  if (status === 'Dang hoat dong') return 'Active';
  if (status === 'Khong hoat dong') return 'Inactive';
  return status;
};

const escapeCsvValue = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function CustomTooltip({ active, payload, label, formatter, labelFormatter }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="reports-analytics-tooltip">
      <p className="reports-analytics-tooltip-title">
        {labelFormatter ? labelFormatter(label || '') : label}
      </p>
      <div className="reports-analytics-tooltip-list">
        {payload.map((item, index) => {
          const formatted = formatter ? formatter(item.value, item.name) : [item.value || 0, item.name || 'Value'];
          return (
            <div key={`${item.name || 'metric'}-${index}`} className="reports-analytics-tooltip-item">
              <span className="reports-analytics-tooltip-dot" />
              <span className="reports-analytics-tooltip-name">{formatted[1]}:</span>
              <span className="reports-analytics-tooltip-value">{formatted[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  iconClass,
  gradient,
  gradientId,
  sparklineData,
}: {
  title: string;
  value: string;
  icon: typeof Activity;
  trend?: number | null;
  iconClass: string;
  gradient: [string, string];
  gradientId: string;
  sparklineData: Array<Record<string, unknown>>;
}) {
  return (
    <article className="reports-analytics-metric-card">
      <div className="reports-analytics-metric-top">
        <div className="reports-analytics-metric-heading">
          <div className={`reports-analytics-metric-icon ${iconClass}`}>
            <Icon size={16} />
          </div>
          <span>{title}</span>
        </div>
        {typeof trend === 'number' && (
          <span className={`reports-analytics-trend-badge ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="reports-analytics-metric-value-wrap">
        <h3>{value}</h3>
        <p>in this selected period</p>
      </div>

      <div className="reports-analytics-spark-wrap">
        <div className="reports-analytics-spark-head">
          <span>Trend</span>
          <span>Recent</span>
        </div>
        <div className="reports-analytics-spark-chart">
          {sparklineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradient[0]} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={gradient[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 100]} />
                <Area
                  type="monotone"
                  dataKey="sparkValue"
                  stroke={gradient[0]}
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  fillOpacity={1}
                  dot={false}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="reports-analytics-spark-empty" />
          )}
        </div>
      </div>
    </article>
  );
}

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsData>(DEFAULT_REPORT_DATA);
  const [filters, setFilters] = useState<ReportFilters>({
    mode: 'preset',
    days: 30,
    startDate: '',
    endDate: '',
  });
  const [customRange, setCustomRange] = useState(() => createPresetRange(30));
  const [activeTab, setActiveTab] = useState<'Income' | 'Orders'>('Income');
  const { addToast } = useUIStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.mode === 'custom') {
          params.set('startDate', filters.startDate);
          params.set('endDate', filters.endDate);
        } else {
          params.set('days', String(filters.days));
        }

        const res = await api.get(`/admin/reports?${params.toString()}`);

        if (res.data?.success && res.data?.data) {
          setData(res.data.data as ReportsData);
        }
      } catch (error: any) {
        console.error('Failed to fetch analytics:', error);
        setData(DEFAULT_REPORT_DATA);
        addToast(error.response?.data?.error || 'Failed to load report data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, addToast]);

  const handlePresetChange = (days: number) => {
    setFilters({
      mode: 'preset',
      days,
      startDate: '',
      endDate: '',
    });
  };

  const handleApplyCustomRange = () => {
    if (!customRange.startDate || !customRange.endDate) {
      addToast('Please select both start and end dates', 'error');
      return;
    }

    const start = new Date(`${customRange.startDate}T00:00:00`);
    const end = new Date(`${customRange.endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      addToast('Invalid custom date range', 'error');
      return;
    }

    if (start.getTime() > end.getTime()) {
      addToast('Start date cannot be later than end date', 'error');
      return;
    }

    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > MAX_CUSTOM_RANGE_DAYS) {
      addToast(`Custom range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`, 'error');
      return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (end.getTime() > today.getTime()) {
      addToast('Custom range cannot include future dates', 'error');
      return;
    }

    setFilters({
      mode: 'custom',
      days: diffDays,
      startDate: customRange.startDate,
      endDate: customRange.endDate,
    });
  };

  const handleResetFilters = () => {
    const defaultRange = createPresetRange(30);
    setCustomRange(defaultRange);
    setFilters({
      mode: 'preset',
      days: 30,
      startDate: '',
      endDate: '',
    });
  };

  const handleExportCsv = () => {
    const csvSections = [
      ['Summary'],
      ['Metric', 'Value'],
      ['Range start', toChartDateFull(data.range.startDate)],
      ['Range end', toChartDateFull(data.range.endDate)],
      ['New signups', String(data.kpis.newSignups.value)],
      ['Active customers', String(data.kpis.activeCustomers.value)],
      ['Net revenue', String(data.kpis.netRevenue.value)],
      ['Orders', String(data.overview.orders)],
      ['Average order value', String(data.overview.avgOrderValue)],
      [''],
      ['Traffic series'],
      ['Date', 'Revenue', 'Orders', 'Signups'],
      ...data.trafficSeries.map((item) => [item.date, String(item.revenue), String(item.orders), String(item.signups)]),
      [''],
      ['Top products'],
      ['Product', 'Units', 'Revenue'],
      ...data.topProducts.map((item) => [item.name, String(item.units), String(item.revenue)]),
      [''],
      ['Sales by category'],
      ['Category', 'Units', 'Revenue'],
      ...data.salesByCategory.map((item) => [item.name, String(item.units), String(item.revenue)]),
      [''],
      ['Status distribution'],
      ['Status', 'Count'],
      ...data.statusDistribution.map((item) => [item.label, String(item.value)]),
    ];

    const csvContent = csvSections
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${data.range.startDate.slice(0, 10)}-${data.range.endDate.slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    addToast('Report exported successfully', 'success');
  };

  const summary = {
    newCustomers: data.kpis.newSignups.value,
    totalCustomers: data.kpis.activeCustomers.value,
    totalRevenue: data.kpis.netRevenue.value,
    totalOrders: data.overview.orders,
    aov: data.overview.avgOrderValue,
    trends: {
      newCustomers: data.kpis.newSignups.trend,
      activeCustomers: data.kpis.activeCustomers.trend,
      revenue: data.kpis.netRevenue.trend,
    },
  };

  const charts = {
    revenue: data.trafficSeries,
    customerRegistrations: data.trafficSeries.map((item) => ({
      date: item.date,
      customers: item.signups,
    })),
    categories: data.salesByCategory.map((item) => ({
      name: item.name,
      revenue: item.revenue,
      units: item.units,
    })),
    status: data.statusDistribution.map((item) => ({
      status: item.status,
      label: item.label,
      count: item.value,
      color: item.color,
    })),
  };

  const topProducts = data.topProducts;
  const recentCustomers = data.featuredCustomers;
  const revenueDataList = charts.revenue || [];
  const registrationsDataList = charts.customerRegistrations || [];
  const activeCustomersBase = Math.max((summary.totalCustomers || 0) - (summary.newCustomers || 0), 0);

  const activeCustomersDataList = registrationsDataList.reduce<Array<{ date: string; customers: number }>>(
    (acc, item, index) => {
      const previous = index === 0 ? activeCustomersBase : acc[index - 1].customers;
      acc.push({
        date: item.date,
        customers: previous + Number(item.customers || 0),
      });
      return acc;
    },
    [],
  );

  const sparklineSeries = useMemo(
    () => ({
      subscriptions: normalizeSparklineSeries(registrationsDataList, 'customers'),
      activeCustomers: normalizeSparklineSeries(activeCustomersDataList, 'customers'),
      revenue: normalizeSparklineSeries(revenueDataList, 'revenue'),
    }),
    [registrationsDataList, activeCustomersDataList, revenueDataList],
  );

  const averageRevenuePerDay = Math.round(data.traffic.revenuePerDay || 0);
  const averageOrdersPerDay = Math.round(data.traffic.ordersPerDay || 0);
  const estimatedVisitors = Math.round(data.traffic.visitors || 0);
  const revenueTarget = Math.max(data.goals.revenue.target || 0, 1);
  const ordersTarget = Math.max(data.goals.orders.target || 0, 1);
  const revenueProgress = Math.min(100, Math.round(((data.goals.revenue.current || 0) / revenueTarget) * 100));
  const ordersProgress = Math.min(100, Math.round(((data.goals.orders.current || 0) / ordersTarget) * 100));
  const conversionRate = Math.min(100, Math.max(0, Number(data.goals.conversionRate || 0)));
  const isCustomRangeActive = filters.mode === 'custom';
  const todayInput = toInputDate(new Date());

  if (loading) {
    return (
      <div className="reports-analytics-loading">
        <Activity className="reports-analytics-loading-icon" />
      </div>
    );
  }

  return (
    <div className="reports-analytics-page">
      <div className="reports-analytics-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p>Business performance overview ({toChartDateFull(data.range.startDate)} - {toChartDateFull(data.range.endDate)})</p>
        </div>

        <div className="reports-analytics-toolbar">
          <div className="reports-analytics-period-wrap">
            <select
              title="Select report period"
              value={isCustomRangeActive ? 'custom' : String(filters.days)}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'custom') {
                  handleApplyCustomRange();
                  return;
                }
                handlePresetChange(Number(value));
              }}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              <option value="custom">Custom range</option>
            </select>
            <Calendar size={15} className="reports-analytics-period-icon" />
          </div>

          <div className="reports-analytics-custom-range">
            <label>
              <span>From</span>
              <input
                type="date"
                value={customRange.startDate}
                max={customRange.endDate || todayInput}
                onChange={(event) => setCustomRange((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={customRange.endDate}
                min={customRange.startDate || undefined}
                max={todayInput}
                onChange={(event) => setCustomRange((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
            <button type="button" className="reports-analytics-toolbar-btn" onClick={handleApplyCustomRange}>
              Apply
            </button>
            <button type="button" className="reports-analytics-toolbar-btn is-secondary" onClick={handleResetFilters}>
              Reset
            </button>
            <button type="button" className="reports-analytics-toolbar-btn is-secondary" onClick={handleExportCsv}>
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="reports-analytics-kpi-grid">
        <div className="reports-analytics-kpi-main">
          <MetricCard
            title="New Signups"
            value={formatNumber(summary.newCustomers)}
            icon={FileText}
            trend={summary.trends.newCustomers}
            iconClass="blue"
            gradient={['#3b82f6', '#93c5fd']}
            sparklineData={sparklineSeries.subscriptions}
            gradientId="analytics-gradient-subscriptions"
          />
          <MetricCard
            title="Active Customers"
            value={formatNumber(summary.totalCustomers)}
            icon={Users}
            trend={summary.trends.activeCustomers}
            iconClass="violet"
            gradient={['#8b5cf6', '#c4b5fd']}
            sparklineData={sparklineSeries.activeCustomers}
            gradientId="analytics-gradient-active-customers"
          />
          <MetricCard
            title="Net Revenue"
            value={formatCurrency(summary.totalRevenue)}
            icon={TrendingUp}
            trend={summary.trends.revenue}
            iconClass="emerald"
            gradient={['#10b981', '#6ee7b7']}
            sparklineData={sparklineSeries.revenue}
            gradientId="analytics-gradient-revenue"
          />
        </div>

        <div className="reports-analytics-overview-card">
          <h3>Data Overview</h3>
          <p>Core distribution snapshot</p>

          <div className="reports-analytics-overview-list">
            <div className="reports-analytics-overview-row">
              <div>
                <span className="reports-analytics-overview-icon purple"><ShoppingBag size={14} /></span>
                <span>Orders</span>
              </div>
              <strong>{formatNumber(summary.totalOrders)}</strong>
            </div>

            <div className="reports-analytics-overview-row">
              <div>
                <span className="reports-analytics-overview-icon blue"><Activity size={14} /></span>
                <span>Avg order value</span>
              </div>
              <strong>{formatCurrency(summary.aov)}</strong>
            </div>

            <div className="reports-analytics-overview-row">
              <div>
                <span className="reports-analytics-overview-icon emerald"><Settings size={14} /></span>
                <span>Top products</span>
              </div>
              <strong>{formatNumber(topProducts.length)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="reports-analytics-grid reports-analytics-grid-top">
        <section className="reports-analytics-card span-5">
          <div className="reports-analytics-card-head">
            <div>
              <h3>Traffic Overview</h3>
            </div>
          </div>

          <div className="reports-analytics-traffic-metrics">
            <div>
              <p>Revenue / day</p>
              <h4>{formatCurrency(averageRevenuePerDay)}</h4>
            </div>
            <div>
              <p>Orders / day</p>
              <h4>{formatNumber(averageOrdersPerDay)}</h4>
            </div>
            <div>
              <p>Visitors</p>
              <h4>{formatNumber(estimatedVisitors)}</h4>
            </div>
          </div>

          <div className="reports-analytics-chart chart-lg">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueDataList} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="analytics-revenue-main-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(str) => toChartDate(String(str))}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(val) => `${Number(val) >= 1000000 ? `${(Number(val) / 1000000).toFixed(0)}M` : val}`}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  content={<CustomTooltip />}
                  labelFormatter={(label) => toChartDateFull(String(label || ''))}
                  formatter={(value, name) => [
                    formatCurrency(Number(value || 0)),
                    name === 'revenue' ? 'Revenue' : String(name || 'Value'),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="revenue"
                  stroke="#6366f1"
                  fill="url(#analytics-revenue-main-gradient)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: '#6366f1' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="reports-analytics-card span-4">
          <div className="reports-analytics-card-head">
            <h3>Sales Performance</h3>
          </div>

          <div className="reports-analytics-sales-overview">
            <h2>{formatCurrency(summary.totalRevenue)}</h2>
            <p>
              <TrendingUp size={12} />
              Overall revenue
            </p>
          </div>

          <div className="reports-analytics-chart chart-lg">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.categories} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  formatter={(value) => [formatCurrency(Number(value || 0)), 'Revenue']}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]}>
                  {charts.categories.map((_, index) => (
                    <Cell key={`category-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="reports-analytics-card span-3 reports-analytics-customer-card">
          <div className="reports-analytics-card-head">
            <div>
              <h3>Featured Customers</h3>
              <p>Recent purchase activity</p>
            </div>
          </div>

          <div className="reports-analytics-customer-list">
            {recentCustomers.length > 0 ? (
              recentCustomers.map((user) => (
                <div key={user.id} className="reports-analytics-customer-item">
                  <div className="reports-analytics-customer-main">
                    <span className="reports-analytics-customer-avatar">{user.initials || 'CU'}</span>
                    <div>
                      <h4>{user.fullName || 'Anonymous customer'}</h4>
                      <p>{translateCustomerActivity(user.status)}</p>
                    </div>
                  </div>
                  <button title="Customer menu" className="reports-analytics-customer-menu-btn">
                    <MoreVertical size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="reports-analytics-empty">No data available</div>
            )}
          </div>
        </section>
      </div>

      <div className="reports-analytics-grid reports-analytics-grid-bottom">
        <section className="reports-analytics-card span-3">
          <div className="reports-analytics-card-head">
            <h3>Status Distribution</h3>
          </div>

          <div className="reports-analytics-chart chart-md">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.status}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="status"
                >
                  {charts.status.map((_, index) => (
                    <Cell key={`status-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={<CustomTooltip />}
                  formatter={(value, name) => [Number(value || 0), translateStatus(String(name || 'unknown'))]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="reports-analytics-status-list">
            {charts.status.map((item, index) => (
              <div key={`${item.status}-${index}`} className="reports-analytics-status-row">
                <div>
                  <span className={`reports-analytics-status-dot color-${index % COLORS.length}`} />
                  <span>{translateStatus(item.status)}</span>
                </div>
                <strong>{formatNumber(item.count)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="reports-analytics-card span-6">
          <div className="reports-analytics-income-head">
            <div>
              <h3>Income Overview</h3>
              <p>Comparison by time period</p>
            </div>
            <div className="reports-analytics-tab-wrap">
              {(['Income', 'Orders'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'active' : ''}
                >
                  {tab === 'Income' ? 'Revenue' : 'Orders'}
                </button>
              ))}
            </div>
          </div>

          <div className="reports-analytics-chart chart-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueDataList} margin={{ top: 20, right: 0, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(str) => toChartDate(String(str))}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(val) =>
                    activeTab === 'Income'
                      ? `${Number(val) >= 1000000 ? `${(Number(val) / 1000000).toFixed(0)}M` : val}`
                      : `${val}`
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  formatter={(value) => [
                    activeTab === 'Income' ? formatCurrency(Number(value || 0)) : Number(value || 0),
                    activeTab === 'Income' ? 'Revenue' : 'Orders',
                  ]}
                  content={<CustomTooltip />}
                />
                <Bar
                  dataKey={activeTab === 'Income' ? 'revenue' : 'orders'}
                  fill={activeTab === 'Income' ? '#8b5cf6' : '#0ea5e9'}
                  radius={[8, 8, 8, 8]}
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="reports-analytics-card span-3">
          <div className="reports-analytics-card-head">
            <h3>Additional Insights</h3>
          </div>

          <div className="reports-analytics-goals">
            <div className="reports-analytics-goal-item">
              <div>
                <span>Revenue target</span>
                <strong>{revenueProgress}%</strong>
              </div>
              <p>{formatCurrency(data.goals.revenue.current)} / {formatCurrency(revenueTarget)}</p>
              <meter min={0} max={100} value={revenueProgress} />
            </div>

            <div className="reports-analytics-goal-item">
              <div>
                <span>Order target</span>
                <strong>{ordersProgress}%</strong>
              </div>
              <p>{formatNumber(data.goals.orders.current)} / {formatNumber(ordersTarget)}</p>
              <meter min={0} max={100} value={ordersProgress} />
            </div>

            <div className="reports-analytics-goal-item">
              <div>
                <span>Conversion rate</span>
                <strong>{conversionRate.toFixed(2)}%</strong>
              </div>
              <p>Based on active customer behavior</p>
              <meter min={0} max={100} value={conversionRate} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

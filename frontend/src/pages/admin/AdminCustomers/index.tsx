import { translateUi, getLocale } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, Download, Eye, Filter, Mail, Package, Phone, Search, UserRound, Users, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { useAuthStore } from '../../../stores/authStore';
import { connectSocket } from '../../../services/socket';
import './AdminCustomers.css';

type Customer = {
  id: number;
  email: string;
  fullName: string;
  username: string;
  phone?: string | null;
  createdAt: string;
  isActive: boolean;
  _count?: {
    orders?: number;
  };
};

type Pagination = {
  page: number;
  total: number;
  totalPages: number;
};

type EngagementFilter = 'ALL' | 'NEW' | 'NO_ORDERS' | 'RETURNING' | 'HAS_PHONE';
type SortOption = 'NEWEST' | 'OLDEST' | 'ORDERS_DESC' | 'NAME_ASC';
type ModalTab = 'PROFILE' | 'ORDERS';

type RecentOrderItem = {
  id: number;
  productName: string;
  quantity: number;
  price: number | string;
};

type RecentOrder = {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number | string;
  createdAt: string;
  _count?: {
    items?: number;
  };
  items: RecentOrderItem[];
};

const PAGE_LIMIT = 20;

const joinedInLastDays = (dateValue: string, days: number) => {
  const joinedAt = new Date(dateValue).getTime();
  const now = Date.now();
  return now - joinedAt <= days * 24 * 60 * 60 * 1000;
};

const formatJoinedDate = (value: string) => {
  return new Date(value).toLocaleDateString(getLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString(getLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value: number | string | null | undefined) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
};

const getStatusBadgeClass = (status: string) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return 'is-pending';
  if (normalized === 'CONFIRMED') return 'is-confirmed';
  if (normalized === 'SHIPPING') return 'is-shipping';
  if (normalized === 'DELIVERED') return 'is-delivered';
  if (normalized === 'CANCELLED') return 'is-cancelled';
  return 'is-neutral';
};

const getPaymentBadgeClass = (status: string) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') return 'is-paid';
  if (normalized === 'REFUNDED') return 'is-refunded';
  if (normalized === 'UNPAID') return 'is-unpaid';
  return 'is-neutral';
};

const getInitials = (customer: Customer) => {
  const source = customer.fullName?.trim() || customer.username || customer.email;
  if (!source) return 'CU';

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

const normalizeCustomer = (customer: Partial<Customer> & Record<string, unknown>): Customer => {
  return {
    id: Number(customer.id || 0),
    email: String(customer.email || ''),
    fullName: String(customer.fullName || ''),
    username: String(customer.username || ''),
    phone: (customer.phone as string | null | undefined) || null,
    createdAt: String(customer.createdAt || new Date().toISOString()),
    isActive: customer.isActive !== false,
    _count: {
      orders: Number((customer._count as { orders?: number } | undefined)?.orders || 0),
    },
  };
};

const isCustomerActive = (customer: Pick<Customer, 'isActive'>) => customer.isActive !== false;

export default function AdminCustomers() {
  useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NEWEST');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>('PROFILE');
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isRecentOrdersLoading, setIsRecentOrdersLoading] = useState(false);
  const [statusUpdatingCustomerId, setStatusUpdatingCustomerId] = useState<number | null>(null);
  const { addToast } = useUIStore();
  const { isAuthenticated, isHydrating } = useAuthStore();

  const fetchCustomers = (page = 1, keyword = search, segment = engagementFilter, sort = sortOption) => {
    setIsLoading(true);
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_LIMIT),
      segment,
      sort,
      ...(keyword ? { search: keyword } : {}),
    });

    api.get(`/admin/customers?${query.toString()}`)
      .then((r) => {
        setCustomers((r.data.data || []).map((item: Partial<Customer> & Record<string, unknown>) => normalizeCustomer(item)));
        setPagination(r.data.pagination);
      })
      .catch((error) => {
        console.error(error);
        addToast('Failed to load customers', 'error');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCustomers(1, search);
  }, [engagementFilter, sortOption]);

  useEffect(() => {
    if (!selectedCustomer) {
      setRecentOrders([]);
      return;
    }

    setIsRecentOrdersLoading(true);
    api.get(`/admin/customers/${selectedCustomer.id}/recent-orders`, { params: { limit: 6 } })
      .then((response) => {
        setRecentOrders(response.data?.data?.orders || []);
        const customerFromApi = response.data?.data?.customer;
        if (customerFromApi) {
          setSelectedCustomer(normalizeCustomer(customerFromApi));
        }
      })
      .catch((error) => {
        console.error(error);
        setRecentOrders([]);
        addToast('Failed to load recent orders for this customer', 'error');
      })
      .finally(() => {
        setIsRecentOrdersLoading(false);
      });
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (isHydrating || !isAuthenticated) return;

    const socket = connectSocket();
    if (!socket) return;

    const handleStatusChanged = (payload: { customerId?: number; isActive?: boolean }) => {
      if (!payload.customerId || typeof payload.isActive !== 'boolean') return;
      const nextIsActive = payload.isActive;

      setCustomers((prev) => prev.map((item) => (
        item.id === payload.customerId ? { ...item, isActive: nextIsActive } : item
      )));

      setSelectedCustomer((prev) => {
        if (!prev || prev.id !== payload.customerId) return prev;
        return { ...prev, isActive: nextIsActive };
      });
    };

    socket.on('customer-status-changed', handleStatusChanged);

    return () => {
      socket.off('customer-status-changed', handleStatusChanged);
    };
  }, [isAuthenticated, isHydrating]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const keyword = searchInput.trim();
    setSearch(keyword);
    fetchCustomers(1, keyword);
  };

  const stats = useMemo(() => {
    const totalOnPage = customers.length;
    const withPhone = customers.filter((customer) => Boolean(customer.phone)).length;
    const noOrders = customers.filter((customer) => (customer._count?.orders || 0) === 0).length;
    const newIn30Days = customers.filter((customer) => joinedInLastDays(customer.createdAt, 30)).length;

    return {
      totalOnPage,
      withPhone,
      noOrders,
      newIn30Days,
    };
  }, [customers]);

  const pageNumbers = useMemo(() => {
    const totalPages = pagination.totalPages;
    const current = pagination.page;
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const pages: number[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);

    if (start > 2) pages.push(-1);
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    if (end < totalPages - 1) pages.push(-2);

    pages.push(totalPages);
    return pages;
  }, [pagination.page, pagination.totalPages]);

  const clearSearch = () => {
    setSearch('');
    setSearchInput('');
    fetchCustomers(1, '');
  };

  const resetAll = () => {
    setEngagementFilter('ALL');
    setSortOption('NEWEST');
    clearSearch();
  };

  const copyField = async (value: string | null | undefined, label: string) => {
    if (!value) {
      addToast(`No ${label.toLowerCase()} to copy`, 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} copied`, 'success');
    } catch {
      addToast(`Failed to copy ${label.toLowerCase()}`, 'error');
    }
  };

  const exportCsv = () => {
    if (!customers.length) {
      addToast('No customers to export', 'info');
      return;
    }

    const escapeCsvCell = (value: string | number) => {
      const raw = String(value ?? '');
      if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const csvLines = [
      ['ID', 'Username', 'Full Name', 'Email', 'Phone', 'Orders', 'Joined'],
      ...customers.map((customer) => [
        customer.id,
        customer.username || '-',
        customer.fullName || '-',
        customer.email || '-',
        customer.phone || '-',
        customer._count?.orders || 0,
        formatJoinedDate(customer.createdAt),
      ]),
    ].map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-page-${pagination.page}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast('Customer list exported', 'success');
  };

  const closeCustomerModal = () => {
    setSelectedCustomer(null);
    setModalTab('PROFILE');
    setRecentOrders([]);
  };

  const handleToggleCustomerActive = async (customer: Customer) => {
    const nextIsActive = !isCustomerActive(customer);
    const actionLabel = nextIsActive ? 'unbanned' : 'banned';

    try {
      setStatusUpdatingCustomerId(customer.id);
      const response = await api.put(`/admin/customers/${customer.id}/active`, { isActive: nextIsActive });
      const updatedCustomer = response.data?.data as Customer | undefined;

      setCustomers((prev) => prev.map((item) => {
        if (item.id !== customer.id) return item;
        if (!updatedCustomer) return { ...item, isActive: nextIsActive };
        return { ...item, ...updatedCustomer };
      }));

      setSelectedCustomer((prev) => {
        if (!prev || prev.id !== customer.id) return prev;
        if (!updatedCustomer) return { ...prev, isActive: nextIsActive };
        return { ...prev, ...updatedCustomer };
      });

      addToast(`Customer ${actionLabel} successfully`, 'success');
    } catch (error) {
      console.error(error);
      addToast(`Failed to ${nextIsActive ? 'unban' : 'ban'} customer`, 'error');
    } finally {
      setStatusUpdatingCustomerId(null);
    }
  };

  const selectedCustomerOrderCount = selectedCustomer?._count?.orders || 0;
  const selectedCustomerSegment = selectedCustomerOrderCount === 0
    ? 'No orders yet'
    : selectedCustomerOrderCount >= 2
      ? 'Returning customer'
      : 'First-time buyer';

  return (
    <div className="customers-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{translateUi("Customers (")}{pagination.total})</h1>
          <p className="customers-admin-subtitle">{translateUi("Track customer growth, profile quality, and engagement at a glance.")}</p>
        </div>
        <div className="customers-admin-stats">
          <span><Users size={14} /> {translateUi("This page:")} {stats.totalOnPage}</span>
          <span><Phone size={14} /> {translateUi("With phone:")} {stats.withPhone}</span>
          <span><CalendarDays size={14} /> {translateUi("New 30d:")} {stats.newIn30Days}</span>
          <span><Filter size={14} /> {translateUi("No orders:")} {stats.noOrders}</span>
        </div>
      </div>

      <div className="admin-card customers-toolbar-card">
        <form onSubmit={handleSearch} className="customers-toolbar-row">
          <div className="customers-search-box">
            <Search size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={translateUi("Search by name, username, email, or phone")}
            />
          </div>

          <label className="customers-select-wrap" aria-label={translateUi("Filter engagement")}>
            <Filter size={15} />
            <select value={engagementFilter} onChange={(e) => setEngagementFilter(e.target.value as EngagementFilter)}>
              <option value="ALL">{translateUi("All segments")}</option>
              <option value="NEW">{translateUi("New in 30 days")}</option>
              <option value="NO_ORDERS">{translateUi("No orders")}</option>
              <option value="RETURNING">{translateUi("Returning (2+ orders)")}</option>
              <option value="HAS_PHONE">{translateUi("Has phone number")}</option>
            </select>
          </label>

          <label className="customers-select-wrap" aria-label={translateUi("Sort customers")}>
            <Users size={15} />
            <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)}>
              <option value="NEWEST">{translateUi("Sort: Newest")}</option>
              <option value="OLDEST">{translateUi("Sort: Oldest")}</option>
              <option value="ORDERS_DESC">{translateUi("Sort: Most orders")}</option>
              <option value="NAME_ASC">{translateUi("Sort: Name A-Z")}</option>
            </select>
          </label>

          <button className="admin-btn admin-btn-primary" type="submit">{translateUi("Search")}</button>
          <button className="admin-btn admin-btn-outline" type="button" onClick={exportCsv}>
            <Download size={14} />{translateUi("Export CSV")}</button>
          <button className="admin-btn admin-btn-outline" type="button" onClick={resetAll}>{translateUi("Reset")}</button>
          {search && <button className="admin-btn admin-btn-outline" type="button" onClick={clearSearch}>{translateUi("Clear search")}</button>}
        </form>
      </div>

      <div className="admin-card customers-list-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : customers.length === 0 ? (
          <p className="customers-empty-state">
            {search ? translateUi("No customers match this search.") : translateUi("No customers match current filters.")}
          </p>
        ) : (
          <>
            <div className="customers-list">
              {customers.map((customer) => {
                const orderCount = customer._count?.orders || 0;
                const isNew = joinedInLastDays(customer.createdAt, 30);

                return (
                  <article key={customer.id} className="customers-row-card">
                    <div className="customers-row-main">
                      <div className="customers-avatar">{getInitials(customer)}</div>

                      <div className="customers-identity">
                        <h3>{customer.fullName || customer.username}</h3>
                        <p>@{customer.username}</p>
                        <div className="customers-tags">
                          {isNew && <span className="customers-tag is-new">{translateUi("New")}</span>}
                          <span className="customers-tag">{orderCount} {translateUi("order")}{orderCount === 1 ? '' : translateUi("s")}</span>
                            <span className={`customers-tag ${isCustomerActive(customer) ? 'is-active' : 'is-banned'}`}>
                              {isCustomerActive(customer) ? translateUi("Active") : translateUi("Banned")}
                          </span>
                          {!customer.phone && <span className="customers-tag is-muted">{translateUi("No phone")}</span>}
                        </div>
                      </div>

                      <div className="customers-contact-col">
                        <p><Mail size={13} /> {customer.email}</p>
                        <p><Phone size={13} /> {customer.phone || translateUi("Not provided")}</p>
                      </div>

                      <div className="customers-joined-col">
                        <span><CalendarDays size={13} /> {translateUi("Joined")}</span>
                        <strong>{formatJoinedDate(customer.createdAt)}</strong>
                      </div>
                    </div>

                    <div className="customers-row-actions">
                      <button
                        className={`admin-btn admin-btn-sm ${isCustomerActive(customer) ? 'admin-btn-danger' : 'admin-btn-primary'}`}
                        type="button"
                        disabled={statusUpdatingCustomerId === customer.id}
                        onClick={() => handleToggleCustomerActive(customer)}
                      >
                        {statusUpdatingCustomerId === customer.id
                          ? (isCustomerActive(customer) ? translateUi("Banning...") : translateUi("Unbanning..."))
                          : (isCustomerActive(customer) ? translateUi("Ban") : translateUi("Unban"))}
                      </button>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" type="button" onClick={() => copyField(customer.email, 'Email')}>
                        <Mail size={13} />{translateUi("Copy email")}</button>
                      <button className="admin-btn admin-btn-outline admin-btn-sm" type="button" onClick={() => {
                        setModalTab('PROFILE');
                        setSelectedCustomer(customer);
                      }}>
                        <Eye size={13} />{translateUi("View profile")}</button>
                    </div>
                  </article>
                );
              })}
            </div>

            {pagination.totalPages > 1 && (
              <div className="customers-footer">
                <div className="customers-footer-text">{translateUi("Showing")}<strong>{(pagination.page - 1) * PAGE_LIMIT + 1}</strong> {translateUi("to")} <strong>{Math.min(pagination.page * PAGE_LIMIT, pagination.total)}</strong> {translateUi("of")} <strong>{pagination.total}</strong>{translateUi("customers")}</div>
                <div className="customers-pagination">
                  <button
                    disabled={pagination.page <= 1}
                    className="customers-page-btn customers-page-arrow"
                    onClick={() => fetchCustomers(pagination.page - 1)}
                  >
                    &lsaquo;
                  </button>
                  {pageNumbers.map((page, index) => page < 0 ? (
                    <span key={`ellipsis-${index}`} className="customers-page-ellipsis">...</span>
                  ) : (
                    <button
                      key={page}
                      className={`customers-page-btn ${page === pagination.page ? 'is-active' : ''}`}
                      onClick={() => fetchCustomers(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    className="customers-page-btn customers-page-arrow"
                    onClick={() => fetchCustomers(pagination.page + 1)}
                  >
                    &rsaquo;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedCustomer && (
        <div className="admin-modal-overlay" onClick={closeCustomerModal}>
          <div className="admin-modal-content customers-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{translateUi("Customer profile")}</h3>
              <button className="admin-modal-close" onClick={closeCustomerModal} aria-label={translateUi("Close")} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body customers-detail-content">
              <div className="customers-detail-tabs">
                <button
                  type="button"
                  className={`customers-tab-btn ${modalTab === 'PROFILE' ? 'is-active' : ''}`}
                  onClick={() => setModalTab('PROFILE')}
                >{translateUi("Profile")}</button>
                <button
                  type="button"
                  className={`customers-tab-btn ${modalTab === 'ORDERS' ? 'is-active' : ''}`}
                  onClick={() => setModalTab('ORDERS')}
                >{translateUi("Recent Orders (")}{selectedCustomerOrderCount})
                </button>
              </div>

              <div className="customers-detail-top">
                <div className="customers-avatar is-large">{getInitials(selectedCustomer)}</div>
                <div>
                  <h4>{selectedCustomer.fullName || selectedCustomer.username}</h4>
                  <p>@{selectedCustomer.username}</p>
                </div>
                <span className="customers-segment-pill">{selectedCustomerSegment}</span>
              </div>

              {modalTab === 'PROFILE' ? (
                <>
                  <div className="customers-detail-grid">
                    <div className="customers-detail-item">
                      <span><UserRound size={14} /> {translateUi("Customer ID")}</span>
                      <strong>#{selectedCustomer.id}</strong>
                    </div>
                    <div className="customers-detail-item">
                      <span><CalendarDays size={14} /> {translateUi("Joined")}</span>
                      <strong>{formatJoinedDate(selectedCustomer.createdAt)}</strong>
                    </div>
                    <div className="customers-detail-item">
                      <span><Mail size={14} /> {translateUi("Email")}</span>
                      <strong>{selectedCustomer.email}</strong>
                    </div>
                    <div className="customers-detail-item">
                      <span><Phone size={14} /> {translateUi("Phone")}</span>
                      <strong>{selectedCustomer.phone || translateUi("Not provided")}</strong>
                    </div>
                    <div className="customers-detail-item">
                      <span><Filter size={14} /> {translateUi("Segment")}</span>
                      <strong>{selectedCustomerSegment}</strong>
                    </div>
                    <div className="customers-detail-item">
                      <span><Filter size={14} /> {translateUi("Account status")}</span>
                      <strong>{isCustomerActive(selectedCustomer) ? translateUi("Active") : translateUi("Banned")}</strong>
                    </div>
                    <div className="customers-detail-item">
                      <span><Users size={14} /> {translateUi("Orders")}</span>
                      <strong>{selectedCustomerOrderCount}</strong>
                    </div>
                  </div>

                  <div className="customers-detail-actions">
                    <button
                      className={`admin-btn ${isCustomerActive(selectedCustomer) ? 'admin-btn-danger' : 'admin-btn-primary'}`}
                      type="button"
                      disabled={statusUpdatingCustomerId === selectedCustomer.id}
                      onClick={() => handleToggleCustomerActive(selectedCustomer)}
                    >
                      {statusUpdatingCustomerId === selectedCustomer.id
                        ? (isCustomerActive(selectedCustomer) ? translateUi("Banning...") : translateUi("Unbanning..."))
                        : (isCustomerActive(selectedCustomer) ? translateUi("Ban customer") : translateUi("Unban customer"))}
                    </button>
                    <button className="admin-btn admin-btn-outline" type="button" onClick={() => copyField(selectedCustomer.email, 'Email')}>
                      <Mail size={14} />{translateUi("Copy email")}</button>
                    <button className="admin-btn admin-btn-outline" type="button" onClick={() => copyField(selectedCustomer.phone, 'Phone')}>
                      <Phone size={14} />{translateUi("Copy phone")}</button>
                    <button className="admin-btn admin-btn-primary" type="button" onClick={() => {
                      setSearchInput(selectedCustomer.email);
                      setSearch(selectedCustomer.email);
                      closeCustomerModal();
                      fetchCustomers(1, selectedCustomer.email);
                    }}>
                      <Search size={14} />{translateUi("Focus this customer")}</button>
                  </div>
                </>
              ) : (
                <div className="customers-order-history-wrap">
                  {isRecentOrdersLoading ? (
                    <div className="loading-page"><div className="spinner" /></div>
                  ) : recentOrders.length === 0 ? (
                    <p className="customers-empty-state customers-modal-empty">{translateUi("This customer has no recent orders.")}</p>
                  ) : (
                    <div className="customers-order-history-list">
                      {recentOrders.map((order) => (
                        <article key={order.id} className="customers-order-history-card">
                          <div className="customers-order-history-head">
                            <div>
                              <h5>{order.orderNumber}</h5>
                              <p>{formatDateTime(order.createdAt)}</p>
                            </div>
                            <div className="customers-order-history-badges">
                              <span className={`customers-badge ${getStatusBadgeClass(order.status)}`}>{translateUi(order.status)}</span>
                              <span className={`customers-badge ${getPaymentBadgeClass(order.paymentStatus)}`}>{translateUi(order.paymentStatus)}</span>
                            </div>
                          </div>

                          <div className="customers-order-history-meta">
                            <span><Package size={13} /> {order._count?.items || order.items.length} {translateUi("item(s)")}</span>
                            <span className="customers-order-total">{formatCurrency(order.totalAmount)}</span>
                          </div>

                          <div className="customers-order-items-preview">
                            {order.items.map((item) => (
                              <div key={item.id} className="customers-order-item-row">
                                <span className="customers-order-item-name">{item.productName}</span>
                                <span className="customers-order-item-qty">{translateUi("x")}{item.quantity}</span>
                                <span className="customers-order-item-price">{formatCurrency(item.price)}</span>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

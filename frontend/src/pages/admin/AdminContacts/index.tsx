import Select from '../../../components/Select/Select';
import { translateUi, getLocale } from '../../../i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle, Eye, Mail, MailOpen, Reply, Search, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import WordEditor from '../../../components/WordEditor/WordEditor';
import { useAdminConfirm } from '../../../components/AdminConfirmDialog/AdminConfirmDialog';
import { sanitizeRichHtml } from '../../../utils/sanitizeHtml';
import './AdminContacts.css';
import { useSearchParams } from 'react-router-dom';

type ContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  replySubject?: string | null;
  replyMessage?: string | null;
  replyDelivered?: boolean | null;
  repliedAt?: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Stats = {
  totalUnread: number;
  totalRead: number;
  filteredTotal: number;
};

type StatusFilter = 'ALL' | 'READ' | 'UNREAD';

const PAGE_LIMIT = 12;
const LONG_MESSAGE_LENGTH = 140;

const getPageNumbers = (current: number, total: number) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages: number[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push(-1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  if (end < total - 1) pages.push(-2);
  pages.push(total);

  return pages;
};

const formatDate = (value: string) => new Date(value).toLocaleString(getLocale(), {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const getRichTextPlainValue = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isLongMessage = (value: string) => {
  const normalized = String(value || '').trim();
  if (normalized.length > LONG_MESSAGE_LENGTH) return true;
  return normalized.split(/\r?\n/).length > 2;
};

export default function AdminContacts() {
  useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const contactId = searchParams.get('contactId');
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
  const [stats, setStats] = useState<Stats>({ totalUnread: 0, totalRead: 0, filteredTotal: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [detailMessage, setDetailMessage] = useState<ContactMessage | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyForm, setReplyForm] = useState({ subject: '', message: '' });
  const { addToast } = useUIStore();
  const { confirm, dialog: confirmDialog } = useAdminConfirm();
  useEffect(() => {
    if (!contactId) return;
    if (!/^[1-9]\d*$/.test(contactId)) { addToast(translateUi('Invalid contact ID'), 'error'); return; }
    const controller = new AbortController();
    api.get(`/admin/contacts/${contactId}`, { signal: controller.signal })
      .then(response => setDetailMessage(response.data.data))
      .catch(() => { if (!controller.signal.aborted) addToast(translateUi('Message unavailable or access denied'), 'error'); });
    return () => controller.abort();
  }, [contactId, addToast]);
  const closeNotificationDetail = () => {
    setDetailMessage(null);
    if (contactId) setSearchParams(current => { const next = new URLSearchParams(current); next.delete('contactId'); return next; }, { replace: true });
  };

  const fetchMessages = async (page = 1, keyword = search, status = statusFilter) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
        status,
        ...(keyword ? { search: keyword } : {}),
      });
      const { data } = await api.get(`/admin/contacts?${params.toString()}`);
      setMessages(data.data || []);
      setPagination(data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
      setStats(data.stats || { totalUnread: 0, totalRead: 0, filteredTotal: 0 });
      setSelectedIds([]);
    } catch {
      addToast('Failed to load messages', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(1, search, statusFilter);
  }, [statusFilter]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchInput.trim();
    setSearch(keyword);
    fetchMessages(1, keyword, statusFilter);
  };

  const resetFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('ALL');
    fetchMessages(1, '', 'ALL');
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.put(`/admin/contacts/${id}/read`);
      addToast('Marked as read', 'success');
      fetchMessages(pagination.page);
    } catch {
      addToast('Failed to mark message as read', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const shouldDelete = await confirm({
      title: 'Delete message',
      message: 'This message will be permanently removed and cannot be recovered.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;

    try {
      await api.delete(`/admin/contacts/${id}`);
      addToast('Message deleted', 'success');
      const targetPage = pagination.page > 1 && messages.length === 1 ? pagination.page - 1 : pagination.page;
      fetchMessages(targetPage);
      setSelectedIds((current) => current.filter((messageId) => messageId !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
      if (detailMessage?.id === id) {
        setDetailMessage(null);
      }
    } catch {
      addToast('Failed to delete message', 'error');
    }
  };

  const toggleSelected = (messageId: number) => {
    setSelectedIds((current) => current.includes(messageId)
      ? current.filter((id) => id !== messageId)
      : [...current, messageId]);
  };

  const toggleSelectAllVisible = () => {
    const currentPageIds = messages.map((message) => message.id);
    const allSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) => current.filter((id) => !currentPageIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...currentPageIds])));
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) {
      addToast('Please select at least one message', 'info');
      return;
    }

    const shouldDelete = await confirm({
      title: 'Delete selected messages',
      message: `${selectedIds.length} selected message(s) will be permanently removed and cannot be recovered.`,
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!shouldDelete) return;

    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/admin/contacts/${id}`)));
      addToast('Selected messages deleted', 'success');
      setSelectedMessage((current) => (current && selectedIds.includes(current.id) ? null : current));
      setDetailMessage((current) => (current && selectedIds.includes(current.id) ? null : current));
      const remainingOnPage = messages.filter((message) => !selectedIds.includes(message.id)).length;
      const targetPage = pagination.page > 1 && remainingOnPage === 0 ? pagination.page - 1 : pagination.page;
      setSelectedIds([]);
      fetchMessages(targetPage);
    } catch {
      addToast('Failed to delete selected messages', 'error');
    }
  };

  const openReplyModal = (message: ContactMessage) => {
    setSelectedMessage(message);
    setReplyForm({
      subject: `Re: ${message.subject}`,
      message: `<p>Hello ${message.name},</p><p><br></p>`,
    });
  };

  const closeReplyModal = () => {
    setSelectedMessage(null);
    setReplyForm({ subject: '', message: '' });
  };

  const handleReplySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMessage) return;

    if (!replyForm.subject.trim() || !getRichTextPlainValue(replyForm.message)) {
      addToast('Subject and reply message are required and cannot be empty', 'error');
      return;
    }

    setIsReplying(true);
    try {
      const { data } = await api.post(`/admin/contacts/${selectedMessage.id}/reply`, replyForm);
      addToast(data.message || 'Reply sent successfully', data.data?.delivered ? 'success' : 'info');
      setMessages((current) => current.map((message) => (
        message.id === selectedMessage.id
          ? {
            ...message,
            isRead: true,
            replySubject: data.data?.replySubject || replyForm.subject,
            replyMessage: data.data?.replyMessage || replyForm.message,
            replyDelivered: Boolean(data.data?.delivered),
            repliedAt: data.data?.repliedAt || new Date().toISOString(),
          }
          : message
      )));
      closeReplyModal();
      fetchMessages(pagination.page);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to send reply', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, pagination.totalPages || 1), [pagination.totalPages]);
  const pageNumbers = useMemo(() => getPageNumbers(pagination.page, totalPages), [pagination.page, totalPages]);
  const allVisibleSelected = messages.length > 0 && messages.every((message) => selectedIds.includes(message.id));

  return (
    <div className="contacts-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{translateUi("Contact Messages")}</h1>
          <p className="contacts-admin-subtitle">{translateUi("Review inbox traffic, reply to customer requests, and keep message handling organized.")}</p>
        </div>
      </div>

      <div className="contacts-stats-grid">
        <article className="contacts-stat-card">
          <span>{translateUi("Unread")}</span>
          <strong>{stats.totalUnread}</strong>
        </article>
        <article className="contacts-stat-card">
          <span>{translateUi("Read")}</span>
          <strong>{stats.totalRead}</strong>
        </article>
        <article className="contacts-stat-card">
          <span>{translateUi("Matched Results")}</span>
          <strong>{stats.filteredTotal}</strong>
        </article>
      </div>

      <div className="admin-card contacts-toolbar-card">
        <form className="contacts-toolbar" onSubmit={handleSearch}>
          <div className="contacts-search-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder={translateUi("Search sender, email, subject, or message")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="contacts-select-wrap">
            <Mail size={16} />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} title={translateUi("Filter contact status")}>
              <option value="ALL">{translateUi("All Messages")}</option>
              <option value="UNREAD">{translateUi("Unread")}</option>
              <option value="READ">{translateUi("Read")}</option>
            </Select>
          </div>

          <button type="submit" className="admin-btn admin-btn-primary">{translateUi("Search")}</button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={resetFilters}>{translateUi("Reset")}</button>
        </form>
      </div>

      <div className="admin-card contacts-list-card">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <p className="contacts-empty-state">{translateUi("No contact messages found for this filter set.")}</p>
        ) : (
          <>
            <div className="contacts-bulk-bar">
              <label className="contacts-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  aria-label={translateUi("Select all visible messages")}
                />
                <span>{selectedIds.length > 0 ? translateUi("{{value1}} selected", { value1: selectedIds.length }) : translateUi("Select all")}</span>
              </label>

              <button
                type="button"
                className="admin-btn admin-btn-danger admin-btn-sm"
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
              >
                <Trash2 size={13} />{translateUi("Delete Selected")}</button>
            </div>

            <div className="contacts-list">
              {messages.map((message) => (
                <article key={message.id} className={`contacts-row-card ${message.isRead ? '' : 'is-unread'} ${selectedIds.includes(message.id) ? 'is-selected' : ''}`}>
                  <label className="contacts-row-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(message.id)}
                      onChange={() => toggleSelected(message.id)}
                      aria-label={translateUi("Select message from {{value1}}", { value1: message.name })}
                    />
                  </label>

                  <div className="contacts-row-content">
                    <div className="contacts-row-main">
                      <div className="contacts-sender">
                        <strong>{message.name}</strong>
                        <span>{message.email}</span>
                      </div>

                      <div className="contacts-message">
                        <strong>{message.subject}</strong>
                        <p>{message.message || translateUi("No message body provided.")}</p>
                      </div>

                      <div className="contacts-meta">
                        <span className={`contacts-status-pill ${message.isRead ? '' : 'is-unread'}`}>
                          {message.isRead ? <MailOpen size={14} /> : <Mail size={14} />}
                          {message.isRead ? translateUi("Read") : translateUi("Unread")}
                        </span>
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                    </div>

                    {message.repliedAt && message.replyMessage && (
                      <div className="contacts-reply-history">
                        <div className="contacts-reply-history-head">
                          <span>{translateUi("Staff reply")}</span>
                          <strong className={message.replyDelivered ? 'is-delivered' : 'is-failed'}>
                            {message.replyDelivered ? translateUi("Delivered") : translateUi("Not delivered")}
                          </strong>
                          <time>{formatDate(message.repliedAt)}</time>
                        </div>
                        <h4>{message.replySubject || translateUi("Re: {{value1}}", { value1: message.subject })}</h4>
                        <div
                          className="contacts-reply-history-body"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(message.replyMessage) }}
                        />
                      </div>
                    )}

                    <div className="contacts-row-actions">
                      {isLongMessage(message.message) && (
                        <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => setDetailMessage(message)}>
                          <Eye size={14} />{translateUi("View Detail")}</button>
                      )}
                      {!message.isRead && (
                        <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => handleMarkRead(message.id)}>
                          <CheckCircle size={14} />{translateUi("Mark Read")}</button>
                      )}
                      <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openReplyModal(message)}>
                        <Reply size={14} />{translateUi("Reply")}</button>
                      <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(message.id)}>
                        <Trash2 size={14} />{translateUi("Delete")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {pagination.total > 0 && (
          <div className="contacts-pagination">
            <div className="contacts-pagination-text">{translateUi("Showing")}<strong>{(pagination.page - 1) * pagination.limit + 1}</strong> {translateUi("to")} <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> {translateUi("of")} <strong>{pagination.total}</strong>{translateUi("messages")}</div>
            <div className="contacts-pagination-actions">
              <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" disabled={pagination.page <= 1} onClick={() => fetchMessages(pagination.page - 1)}>{translateUi("Previous")}</button>
              {pageNumbers.map((page, index) => page < 0 ? (
                <span key={`ellipsis-${index}`} className="contacts-page-ellipsis">...</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  className={`contacts-page-btn ${page === pagination.page ? 'is-active' : ''}`}
                  onClick={() => fetchMessages(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" disabled={pagination.page >= totalPages} onClick={() => fetchMessages(pagination.page + 1)}>{translateUi("Next")}</button>
            </div>
          </div>
        )}
      </div>

      {selectedMessage && (
        <div className="admin-modal-overlay" onClick={closeReplyModal}>
          <div className="admin-modal-content contacts-reply-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{translateUi("Reply to")} {selectedMessage.name}</h2>
              <button onClick={closeReplyModal} className="admin-modal-close" aria-label={translateUi("Close")} title={translateUi("Close")}><X size={20} /></button>
            </div>

            <form className="contacts-reply-form" onSubmit={handleReplySubmit}>
              <div className="contacts-reply-context">
                <strong>{selectedMessage.subject}</strong>
                <p>{selectedMessage.message || translateUi("No message body provided.")}</p>
              </div>

              <div className="contacts-reply-grid">
                <label htmlFor="reply-subject">{translateUi("Subject")}<input
                    id="reply-subject"
                    value={replyForm.subject}
                    onChange={(event) => setReplyForm((current) => ({ ...current, subject: event.target.value }))}
                    required
                  />
                </label>

                <label htmlFor="reply-message">{translateUi("Reply")}<WordEditor
                    id="reply-message"
                    ariaLabel="Reply Message"
                    value={replyForm.message}
                    onChange={(value) => setReplyForm((current) => ({ ...current, message: value }))}
                    size="md"
                  />
                </label>
              </div>

              <p className="contacts-reply-note">{translateUi("If SMTP is not configured, the system will not deliver the email and will tell you directly.")}</p>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={closeReplyModal} disabled={isReplying}>{translateUi("Cancel")}</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isReplying}>
                  {isReplying ? translateUi("Sending...") : translateUi("Send Reply")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailMessage && (
        <div className="admin-modal-overlay" onClick={closeNotificationDetail}>
          <div className="admin-modal-content contacts-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">{translateUi("Message Detail")}</h2>
                <p className="admin-modal-subtitle">{detailMessage.email}</p>
              </div>
              <button onClick={closeNotificationDetail} className="admin-modal-close" aria-label={translateUi("Close")} title={translateUi("Close")}><X size={20} /></button>
            </div>

            <div className="contacts-detail-body">
              <div className="contacts-detail-meta-grid">
                <div>
                  <span>{translateUi("Sender")}</span>
                  <strong>{detailMessage.name}</strong>
                </div>
                <div>
                  <span>{translateUi("Status")}</span>
                  <strong>{detailMessage.isRead ? translateUi("Read") : translateUi("Unread")}</strong>
                </div>
                <div>
                  <span>{translateUi("Received")}</span>
                  <strong>{formatDate(detailMessage.createdAt)}</strong>
                </div>
              </div>

              <section className="contacts-detail-section">
                <span>{translateUi("Subject")}</span>
                <h3>{detailMessage.subject}</h3>
              </section>

              <section className="contacts-detail-section">
                <span>{translateUi("Message")}</span>
                <p className="contacts-detail-message">{detailMessage.message || translateUi("No message body provided.")}</p>
              </section>

              {detailMessage.repliedAt && detailMessage.replyMessage && (
                <section className="contacts-detail-section">
                  <span>{translateUi("Staff reply")}</span>
                  <div className="contacts-reply-history is-detail">
                    <div className="contacts-reply-history-head">
                      <strong className={detailMessage.replyDelivered ? 'is-delivered' : 'is-failed'}>
                        {detailMessage.replyDelivered ? translateUi("Delivered") : translateUi("Not delivered")}
                      </strong>
                      <time>{formatDate(detailMessage.repliedAt)}</time>
                    </div>
                    <h4>{detailMessage.replySubject || translateUi("Re: {{value1}}", { value1: detailMessage.subject })}</h4>
                    <div
                      className="contacts-reply-history-body"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(detailMessage.replyMessage) }}
                    />
                  </div>
                </section>
              )}
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="admin-btn admin-btn-outline" onClick={closeNotificationDetail}>{translateUi("Close")}</button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => {
                  const message = detailMessage;
                  setDetailMessage(null);
                  openReplyModal(message);
                }}
              >
                <Reply size={14} />{translateUi("Reply")}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}

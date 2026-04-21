import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle, Mail, MailOpen, Reply, Search, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import WordEditor from '../../../components/WordEditor/WordEditor';
import './AdminContacts.css';

type ContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
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

const formatDate = (value: string) => new Date(value).toLocaleString('en-US', {
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

export default function AdminContacts() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
  const [stats, setStats] = useState<Stats>({ totalUnread: 0, totalRead: 0, filteredTotal: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyForm, setReplyForm] = useState({ subject: '', message: '' });
  const { addToast } = useUIStore();

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
    if (!window.confirm('Delete this message? It cannot be recovered.')) return;

    try {
      await api.delete(`/admin/contacts/${id}`);
      addToast('Message deleted', 'success');
      const targetPage = pagination.page > 1 && messages.length === 1 ? pagination.page - 1 : pagination.page;
      fetchMessages(targetPage);
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
    } catch {
      addToast('Failed to delete message', 'error');
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
      closeReplyModal();
      fetchMessages(pagination.page);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to send reply', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, pagination.totalPages || 1), [pagination.totalPages]);

  return (
    <div className="contacts-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Contact Messages</h1>
          <p className="contacts-admin-subtitle">Review inbox traffic, reply to customer requests, and keep message handling organized.</p>
        </div>
      </div>

      <div className="contacts-stats-grid">
        <article className="contacts-stat-card">
          <span>Unread</span>
          <strong>{stats.totalUnread}</strong>
        </article>
        <article className="contacts-stat-card">
          <span>Read</span>
          <strong>{stats.totalRead}</strong>
        </article>
        <article className="contacts-stat-card">
          <span>Matched Results</span>
          <strong>{stats.filteredTotal}</strong>
        </article>
      </div>

      <div className="admin-card contacts-toolbar-card">
        <form className="contacts-toolbar" onSubmit={handleSearch}>
          <div className="contacts-search-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search sender, email, subject, or message"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="contacts-select-wrap">
            <Mail size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} title="Filter contact status">
              <option value="ALL">All Messages</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </select>
          </div>

          <button type="submit" className="admin-btn admin-btn-primary">Search</button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={resetFilters}>Reset</button>
        </form>
      </div>

      <div className="admin-card contacts-list-card">
        {isLoading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <p className="contacts-empty-state">No contact messages found for this filter set.</p>
        ) : (
          <div className="contacts-list">
            {messages.map((message) => (
              <article key={message.id} className={`contacts-row-card ${message.isRead ? '' : 'is-unread'}`}>
                <div className="contacts-row-main">
                  <div className="contacts-sender">
                    <strong>{message.name}</strong>
                    <span>{message.email}</span>
                  </div>

                  <div className="contacts-message">
                    <strong>{message.subject}</strong>
                    <p>{message.message || 'No message body provided.'}</p>
                  </div>

                  <div className="contacts-meta">
                    <span className={`contacts-status-pill ${message.isRead ? '' : 'is-unread'}`}>
                      {message.isRead ? <MailOpen size={14} /> : <Mail size={14} />}
                      {message.isRead ? 'Read' : 'Unread'}
                    </span>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                </div>

                <div className="contacts-row-actions">
                  {!message.isRead && (
                    <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => handleMarkRead(message.id)}>
                      <CheckCircle size={14} /> Mark Read
                    </button>
                  )}
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openReplyModal(message)}>
                    <Reply size={14} /> Reply
                  </button>
                  <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(message.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {pagination.total > 0 && (
          <div className="contacts-pagination">
            <div className="contacts-pagination-text">
              Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong>{pagination.total}</strong> messages
            </div>
            <div className="contacts-pagination-actions">
              <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" disabled={pagination.page <= 1} onClick={() => fetchMessages(pagination.page - 1)}>
                Previous
              </button>
              <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" disabled={pagination.page >= totalPages} onClick={() => fetchMessages(pagination.page + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedMessage && (
        <div className="admin-modal-overlay" onClick={closeReplyModal}>
          <div className="admin-modal-content contacts-reply-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Reply to {selectedMessage.name}</h2>
              <button onClick={closeReplyModal} className="admin-modal-close" aria-label="Close" title="Close"><X size={20} /></button>
            </div>

            <form className="contacts-reply-form" onSubmit={handleReplySubmit}>
              <div className="contacts-reply-context">
                <strong>{selectedMessage.subject}</strong>
                <p>{selectedMessage.message || 'No message body provided.'}</p>
              </div>

              <div className="contacts-reply-grid">
                <label htmlFor="reply-subject">
                  Subject
                  <input
                    id="reply-subject"
                    value={replyForm.subject}
                    onChange={(event) => setReplyForm((current) => ({ ...current, subject: event.target.value }))}
                    required
                  />
                </label>

                <label htmlFor="reply-message">
                  Reply
                  <WordEditor
                    id="reply-message"
                    ariaLabel="Reply Message"
                    value={replyForm.message}
                    onChange={(value) => setReplyForm((current) => ({ ...current, message: value }))}
                    size="md"
                  />
                </label>
              </div>

              <p className="contacts-reply-note">
                If SMTP is not configured, the system will not deliver the email and will tell you directly.
              </p>

              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-outline" onClick={closeReplyModal} disabled={isReplying}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={isReplying}>
                  {isReplying ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Eye, Filter, Search, Star, Trash2, X } from 'lucide-react';
import api from '../../../api/client';
import { useUIStore } from '../../../stores/uiStore';
import { resolveSiteAssetUrl } from '../../../contexts/SiteSettingsContext';
import './AdminReviews.css';

type ReviewUser = {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
};

type ReviewProduct = {
  id: number;
  name: string;
  slug: string;
  images?: Array<{ url: string; alt?: string | null }>;
};

type AdminReview = {
  id: number;
  title?: string | null;
  comment?: string | null;
  rating: number;
  isApproved: boolean;
  createdAt: string;
  user?: ReviewUser | null;
  product?: ReviewProduct | null;
};

type Pagination = {
  page: number;
  total: number;
  totalPages: number;
};

type ReviewStats = {
  totalReviews: number;
  approvedReviews: number;
  hiddenReviews: number;
  averageRating: number;
};

type ReviewStatusFilter = 'ALL' | 'APPROVED' | 'HIDDEN';
type RatingFilter = 'ALL' | '5' | '4' | '3' | '2' | '1';
type SortOption = 'NEWEST' | 'OLDEST' | 'RATING_DESC' | 'RATING_ASC';

const PAGE_LIMIT = 15;

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReviewPreview = (review: AdminReview) => {
  const title = review.title?.trim();
  const comment = review.comment?.trim() || '';
  const preview = comment.length > 150 ? `${comment.slice(0, 150)}...` : comment;

  if (title) {
    return `${title} ${preview}`.trim();
  }
  return preview || 'No review comment';
};

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

export default function AdminReviews() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<ReviewStats>({ totalReviews: 0, approvedReviews: 0, hiddenReviews: 0, averageRating: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('ALL');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('NEWEST');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const { addToast } = useUIStore();

  const fetchReviews = async (page = 1, keyword = search) => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_LIMIT,
        sort: sortOption,
      };

      if (keyword) params.search = keyword;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (ratingFilter !== 'ALL') params.rating = ratingFilter;

      const { data } = await api.get('/admin/reviews', { params });
      const responseReviews: AdminReview[] = data.data || [];
      const responsePagination: Pagination = data.pagination || { page: 1, total: 0, totalPages: 0 };

      const fallbackApproved = responseReviews.filter((review) => review.isApproved).length;
      const fallbackHidden = responseReviews.length - fallbackApproved;
      const fallbackAverage = responseReviews.length
        ? responseReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / responseReviews.length
        : 0;

      const responseStats = data.stats;
      const resolvedStats: ReviewStats = responseStats
        ? {
          totalReviews: Number(responseStats.totalReviews ?? responsePagination.total ?? 0),
          approvedReviews: Number(responseStats.approvedReviews ?? fallbackApproved),
          hiddenReviews: Number(responseStats.hiddenReviews ?? fallbackHidden),
          averageRating: Number(responseStats.averageRating ?? fallbackAverage),
        }
        : {
          totalReviews: Number(responsePagination.total ?? responseReviews.length ?? 0),
          approvedReviews: fallbackApproved,
          hiddenReviews: fallbackHidden,
          averageRating: fallbackAverage,
        };

      setReviews(responseReviews);
      setPagination(responsePagination);
      setStats(resolvedStats);
      setSelectedIds([]);
    } catch (_error) {
      addToast('Failed to load reviews', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(1, search);
  }, [statusFilter, ratingFilter, sortOption]);

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const keyword = searchInput.trim();
    setSearch(keyword);
    fetchReviews(1, keyword);
  };

  const resetFilters = () => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('ALL');
    setRatingFilter('ALL');
    setSortOption('NEWEST');
    fetchReviews(1, '');
  };

  const handleApprove = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/admin/reviews/${id}/approve`, { isApproved: !currentStatus });
      addToast(`Review ${!currentStatus ? 'approved' : 'hidden'} successfully`, 'success');
      fetchReviews(pagination.page);
    } catch (_error) {
      addToast('Failed to update review status', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await api.delete(`/admin/reviews/${id}`);
      addToast('Review deleted successfully', 'success');
      setSelectedReview((current) => (current?.id === id ? null : current));
      fetchReviews(pagination.page);
    } catch (_error) {
      addToast('Failed to delete review', 'error');
    }
  };

  const toggleSelected = (reviewId: number) => {
    setSelectedIds((current) => current.includes(reviewId)
      ? current.filter((id) => id !== reviewId)
      : [...current, reviewId]);
  };

  const toggleSelectAllVisible = () => {
    const currentPageIds = reviews.map((review) => review.id);
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) => current.filter((id) => !currentPageIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...currentPageIds])));
  };

  const applyBulkApprove = async (isApproved: boolean) => {
    if (!selectedIds.length) {
      addToast('Please select at least one review', 'info');
      return;
    }

    setIsBulkLoading(true);
    try {
      await api.post('/admin/reviews/bulk-approve', { ids: selectedIds, isApproved });
      addToast(`Selected reviews ${isApproved ? 'approved' : 'hidden'} successfully`, 'success');
      fetchReviews(pagination.page);
    } catch (_error) {
      addToast('Failed to update selected reviews', 'error');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const applyBulkDelete = async () => {
    if (!selectedIds.length) {
      addToast('Please select at least one review', 'info');
      return;
    }

    if (!confirm(`Delete ${selectedIds.length} selected review(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkLoading(true);
    try {
      await api.post('/admin/reviews/bulk-delete', { ids: selectedIds });
      addToast('Selected reviews deleted successfully', 'success');
      setSelectedReview((current) => (current && selectedIds.includes(current.id) ? null : current));
      fetchReviews(pagination.page);
    } catch (_error) {
      addToast('Failed to delete selected reviews', 'error');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const pageNumbers = useMemo(() => getPageNumbers(pagination.page, pagination.totalPages), [pagination.page, pagination.totalPages]);
  const averageRatingText = stats.averageRating > 0 ? stats.averageRating.toFixed(2) : '0.00';
  const allVisibleSelected = reviews.length > 0 && reviews.every((review) => selectedIds.includes(review.id));

  return (
    <div className="reviews-admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Reviews ({pagination.total})</h1>
          <p className="reviews-admin-subtitle">Moderate customer feedback quickly with smarter filters and bulk actions.</p>
        </div>
      </div>

      <div className="reviews-stats-grid">
        <article className="reviews-stat-card">
          <span>Total Reviews</span>
          <strong>{stats.totalReviews}</strong>
        </article>
        <article className="reviews-stat-card">
          <span>Approved</span>
          <strong>{stats.approvedReviews}</strong>
        </article>
        <article className="reviews-stat-card">
          <span>Hidden</span>
          <strong>{stats.hiddenReviews}</strong>
        </article>
        <article className="reviews-stat-card">
          <span>Average Rating</span>
          <strong>{averageRatingText} / 5</strong>
        </article>
      </div>

      <div className="admin-card reviews-toolbar-card">
        <form className="reviews-toolbar" onSubmit={handleSearch}>
          <div className="reviews-search-wrap">
            <Search size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by product, customer, email, title or comment"
            />
          </div>

          <label className="reviews-select-wrap" aria-label="Filter review status">
            <Filter size={15} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReviewStatusFilter)}>
              <option value="ALL">All status</option>
              <option value="APPROVED">Approved</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </label>

          <label className="reviews-select-wrap" aria-label="Filter by rating">
            <Star size={15} />
            <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value as RatingFilter)}>
              <option value="ALL">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>

          <label className="reviews-select-wrap" aria-label="Sort reviews">
            <Filter size={15} />
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
              <option value="NEWEST">Sort: Newest</option>
              <option value="OLDEST">Sort: Oldest</option>
              <option value="RATING_DESC">Sort: Rating high to low</option>
              <option value="RATING_ASC">Sort: Rating low to high</option>
            </select>
          </label>

          <button type="submit" className="admin-btn admin-btn-primary">Search</button>
          <button type="button" className="admin-btn admin-btn-outline" onClick={resetFilters}>Reset</button>
        </form>
      </div>

      <div className="admin-card reviews-list-card">
        {isLoading ? <div className="loading-page"><div className="spinner" /></div> : reviews.length === 0 ? (
          <p className="reviews-empty-state">No reviews found for this filter set.</p>
        ) : (
          <>
            <div className="reviews-sticky-actions">
              <label className="reviews-select-all">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                <span>Select page ({reviews.length})</span>
              </label>

              <div className="reviews-bulk-actions">
                <span className="reviews-selected-count">{selectedIds.length} selected</span>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyBulkApprove(true)} disabled={isBulkLoading || selectedIds.length === 0}>
                  <Check size={13} /> Approve
                </button>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => applyBulkApprove(false)} disabled={isBulkLoading || selectedIds.length === 0}>
                  <X size={13} /> Hide
                </button>
                <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={applyBulkDelete} disabled={isBulkLoading || selectedIds.length === 0}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>

            <div className="reviews-list">
              {reviews.map((review) => {
                const customerName = review.user?.fullName || review.user?.username || 'Guest';
                const productName = review.product?.name || 'Unknown product';
                const productImage = resolveSiteAssetUrl(review.product?.images?.[0]?.url || '');
                const isSelected = selectedIds.includes(review.id);

                return (
                  <article key={review.id} className={`reviews-row-card ${isSelected ? 'is-selected' : ''}`}>
                    <div className="reviews-row-main">
                      <label className="reviews-item-check">
                        <input
                          type="checkbox"
                          aria-label={`Select review ${review.id}`}
                          checked={isSelected}
                          onChange={() => toggleSelected(review.id)}
                        />
                      </label>

                      <div className="reviews-product-col">
                        <div className="reviews-product-cell">
                          {productImage ? (
                            <img src={productImage} alt={review.product?.images?.[0]?.alt || productName} />
                          ) : (
                            <div className="reviews-product-placeholder" />
                          )}
                          <div>
                            <p>{productName}</p>
                            <small>By {customerName}</small>
                          </div>
                        </div>
                      </div>

                      <div className="reviews-rating-col">
                        <div className="reviews-stars" aria-label={`${review.rating} star rating`}>
                          {[...Array(5)].map((_, index) => (
                            <Star key={index} size={14} className={index < review.rating ? 'is-active' : ''} />
                          ))}
                        </div>
                        <span>{review.rating.toFixed(1)}</span>
                      </div>

                      <div className="reviews-comment-col">
                        {review.title && <strong>{review.title}</strong>}
                        <p>{getReviewPreview(review)}</p>
                      </div>

                      <div className="reviews-meta-col">
                        <span className={`reviews-status-pill ${review.isApproved ? 'is-approved' : 'is-hidden'}`}>
                          {review.isApproved ? 'Approved' : 'Hidden'}
                        </span>
                        <small>{formatDateTime(review.createdAt)}</small>
                      </div>
                    </div>

                    <div className="reviews-row-actions">
                      <button
                        className={`admin-btn admin-btn-sm ${review.isApproved ? 'admin-btn-outline' : 'admin-btn-primary'}`}
                        onClick={() => handleApprove(review.id, review.isApproved)}
                        aria-label={review.isApproved ? 'Hide Review' : 'Approve Review'}
                        title={review.isApproved ? 'Hide Review' : 'Approve Review'}
                      >
                        {review.isApproved ? <X size={12} /> : <Check size={12} />}
                      </button>
                      <button
                        className="admin-btn admin-btn-outline admin-btn-sm"
                        onClick={() => setSelectedReview(review)}
                        aria-label="View details"
                        title="View details"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        onClick={() => handleDelete(review.id)}
                        aria-label="Delete Review"
                        title="Delete Review"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {pagination.totalPages > 1 && (
          <div className="reviews-pagination-wrap">
            <div className="reviews-pagination-text">
              Showing <strong>{(pagination.page - 1) * PAGE_LIMIT + 1}</strong> to <strong>{Math.min(pagination.page * PAGE_LIMIT, pagination.total)}</strong> of <strong>{pagination.total}</strong> reviews
            </div>
            <div className="reviews-pagination">
              <button
                disabled={pagination.page <= 1}
                className="reviews-page-btn reviews-page-arrow"
                onClick={() => fetchReviews(pagination.page - 1)}
              >
                &lsaquo;
              </button>
              {pageNumbers.map((page, index) => page < 0 ? (
                <span key={`ellipsis-${index}`} className="reviews-page-ellipsis">...</span>
              ) : (
                <button
                  key={page}
                  className={`reviews-page-btn ${page === pagination.page ? 'is-active' : ''}`}
                  onClick={() => fetchReviews(page)}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={pagination.page >= pagination.totalPages}
                className="reviews-page-btn reviews-page-arrow"
                onClick={() => fetchReviews(pagination.page + 1)}
              >
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedReview && (
        <div className="admin-modal-overlay" onClick={() => setSelectedReview(null)}>
          <div className="admin-modal-content reviews-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Review Details</h3>
              <button className="admin-modal-close" type="button" onClick={() => setSelectedReview(null)} aria-label="Close details">
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body reviews-detail-content">
              <div className="reviews-detail-head">
                <div className="reviews-detail-product">
                  {resolveSiteAssetUrl(selectedReview.product?.images?.[0]?.url || '') ? (
                    <img
                      src={resolveSiteAssetUrl(selectedReview.product?.images?.[0]?.url || '')}
                      alt={selectedReview.product?.images?.[0]?.alt || selectedReview.product?.name || 'Product'}
                    />
                  ) : (
                    <div className="reviews-product-placeholder" />
                  )}
                  <h4>{selectedReview.product?.name || 'Unknown product'}</h4>
                </div>
                <span className={`reviews-status-pill ${selectedReview.isApproved ? 'is-approved' : 'is-hidden'}`}>
                  {selectedReview.isApproved ? 'Approved' : 'Hidden'}
                </span>
              </div>

              <div className="reviews-detail-grid">
                <div className="reviews-detail-item">
                  <span>Customer</span>
                  <strong>{selectedReview.user?.fullName || selectedReview.user?.username || 'Guest'}</strong>
                </div>
                <div className="reviews-detail-item">
                  <span>Email</span>
                  <strong>{selectedReview.user?.email || 'N/A'}</strong>
                </div>
                <div className="reviews-detail-item">
                  <span>Rating</span>
                  <strong>{selectedReview.rating}/5</strong>
                </div>
                <div className="reviews-detail-item">
                  <span>Created at</span>
                  <strong>{formatDateTime(selectedReview.createdAt)}</strong>
                </div>
              </div>

              <div className="reviews-detail-comment">
                {selectedReview.title && <h5>{selectedReview.title}</h5>}
                <p>{selectedReview.comment?.trim() || 'No comment provided.'}</p>
              </div>

              <div className="reviews-detail-actions">
                <button
                  type="button"
                  className={`admin-btn ${selectedReview.isApproved ? 'admin-btn-outline' : 'admin-btn-primary'}`}
                  onClick={async () => {
                    await handleApprove(selectedReview.id, selectedReview.isApproved);
                    setSelectedReview((current) => current ? { ...current, isApproved: !current.isApproved } : current);
                  }}
                >
                  {selectedReview.isApproved ? <><X size={14} /> Hide review</> : <><Check size={14} /> Approve review</>}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => handleDelete(selectedReview.id)}
                >
                  <Trash2 size={14} /> Delete review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

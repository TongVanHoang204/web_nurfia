import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api/client';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';
import { sanitizeRichHtml } from '../../utils/sanitizeHtml';
import './BlogPage.css';

export default function BlogPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Fallback for empty state or if API fails
  const mockPosts = [
    {
      id: 1, slug: 'talking-sustainable-fashion', title: 'Talking Sustainable Fashion with an Eco-Friendly Influencer',
      excerpt: 'Integer mattis ultricies augue, ac bibendum arcu viverra vel. Etiam eu facilisis velit. Mauris auctor efficitur turpis feugiat laoreet. Nam ac posuere eros. Sed blandit et ipsum a porttitor. Curabitur sagittis ligula in ullamcorper vehicula. Sed consequat ipsum vitae ante ultricies tincidunt. Nulla egestas nisi non elementum semper. Aenean molestie mi purus, at commodo massa',
      image: 'https://klbtheme.com/nurfia/wp-content/uploads/2021/07/blog-14.jpg',
      category: 'Automotive Tips', publishedAt: '2025-07-09T00:00:00.000Z'
    },
    {
      id: 2, slug: 'how-to-remove-oil-stains', title: 'How to easily remove oil stains from clothes',
      excerpt: 'Donec varius, erat eu malesuada tristique, sem ligula aliquet neque, nec aliquet magna ipsum et ex. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Fusce ac felis vel eros viverra eleifend id quis ligula. Vivamus ac dolor sit amet enim mattis vulputate suscipit in mauris.',
      image: 'https://klbtheme.com/nurfia/wp-content/uploads/2021/07/blog-13.jpg',
      category: 'Car Engines', publishedAt: '2025-07-09T00:00:00.000Z'
    }
  ];

  const fetchPosts = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/blog?page=${page}&limit=5`);
      setPosts(res.data.data.length ? res.data.data : mockPosts);
      setPagination(res.data.pagination);
    } catch (error) {
      setPosts(mockPosts);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(1);
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="blog-page-container">
      <div className="blog-layout">
        
        {/* Main Content Area: List of Blogs */}
        <div className="blog-main">
          {isLoading ? (
            <div className="loading-page"><div className="spinner" /></div>
          ) : (
            <>
              {posts.map(post => (
                <article key={post.id} className="blog-post-card">
                  {resolveSiteAssetUrl(post.image || '') ? (
                    <div className="blog-post-image">
                      <Link to={`/blog/${post.slug}`}>
                        <img src={resolveSiteAssetUrl(post.image || '') || ''} alt={post.title} />
                      </Link>
                    </div>
                  ) : (
                     <div className="blog-post-image mock-gray-bg" />
                  )}
                  
                  <h2 className="blog-post-title">
                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  
                  <div className="blog-post-excerpt">
                    <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(post.excerpt || '') }} />
                  </div>
                  
                  <Link to={`/blog/${post.slug}`} className="blog-btn-readmore">
                    READ MORE
                  </Link>
                  
                  <div className="blog-post-meta">
                    <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    <span className="meta-separator">|</span>
                    <span>{post.category || 'General'}</span>
                    <span className="meta-separator">|</span>
                    <span>Klbtheme, Themeforest</span>
                  </div>
                </article>
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="blog-pagination">
                  {pagination.page > 1 && (
                     <button aria-label="Previous Page" title="Previous Page" className="blog-page-btn" onClick={() => fetchPosts(pagination.page - 1)}><ChevronLeft size={16} /></button>
                  )}
                  
                  {Array.from({ length: pagination.totalPages }).map((_, i) => (
                    <button 
                      key={i+1} 
                      className={`blog-page-btn ${pagination.page === i + 1 ? 'active' : ''}`}
                      onClick={() => fetchPosts(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}

                  {pagination.page < pagination.totalPages && (
                     <button aria-label="Next Page" title="Next Page" className="blog-page-btn" onClick={() => fetchPosts(pagination.page + 1)}><ChevronRight size={16} /></button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Area */}
        <aside className="blog-sidebar">
          
          <div className="sidebar-widget">
            <h3 className="widget-title">Post Widget</h3>
            <div className="recent-posts-list">
              {posts.slice(0, 3).map(post => (
                <div className="recent-post-item" key={`recent-${post.id}`}>
                  <div className="recent-post-thumb">
                    <img src={resolveSiteAssetUrl(post.image || '') || 'https://via.placeholder.com/60'} alt={post.title} />
                  </div>
                  <div className="recent-post-info">
                    <h4><Link to={`/blog/${post.slug}`}>{post.title}</Link></h4>
                    <span className="recent-post-date">
                      {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-widget">
            <h3 className="widget-title">Social Widget</h3>
            <div className="social-widget-list">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-btn btn-facebook">
                <span className="social-icon">f</span>
                <span className="social-name">FACEBOOK</span>
                <span className="social-action">FOLLOW</span>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-btn btn-x">
                <span className="social-icon">X</span>
                <span className="social-name">Twitter</span>
                <span className="social-action">FOLLOW</span>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-btn btn-instagram">
                <span className="social-icon">In</span>
                <span className="social-name">INSTAGRAM</span>
                <span className="social-action">FOLLOW</span>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="social-btn btn-youtube">
                <span className="social-icon">Yt</span>
                <span className="social-name">YOUTUBE</span>
                <span className="social-action">FOLLOW</span>
              </a>
            </div>
          </div>

        </aside>

      </div>
    </div>
  );
}

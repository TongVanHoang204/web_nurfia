import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import '../BlogPage/BlogPage.css';
import './BlogDetailPage.css';
import { sanitizeRichHtml } from '../../utils/sanitizeHtml';
import { resolveSiteAssetUrl } from '../../contexts/SiteSettingsContext';

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  category?: string | null;
  author?: string | null;
  publishedAt?: string;
};

const fallbackPost: BlogPost = {
  id: 0,
  slug: 'talking-sustainable-fashion',
  title: 'Talking Sustainable Fashion with an Eco-Friendly Influencer',
  excerpt: 'A closer look at material choices, wardrobe longevity, and how to build a smarter daily style routine.',
  content: `
    <p>Sustainable fashion is not only about fabrics. It starts with buying fewer pieces, choosing better construction, and understanding how garments fit into a long-term wardrobe.</p>
    <p>For modern shoppers, the best approach is practical: invest in staples that can be styled across seasons, repair pieces that still have value, and treat impulse purchases as the exception rather than the habit.</p>
    <p>When brands communicate product details clearly, customers can make better decisions. That is where thoughtful merchandising, transparent composition details, and honest care instructions matter.</p>
  `,
  image: 'https://klbtheme.com/nurfia/wp-content/uploads/2021/07/blog-14.jpg',
  category: 'Style Journal',
  author: 'Nurfia Editorial',
  publishedAt: '2026-04-01T00:00:00.000Z',
};

export default function BlogDetailPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [postRes, recentRes] = await Promise.all([
          api.get(`/blog/${slug}`),
          api.get('/blog?limit=3'),
        ]);

        setPost(postRes.data.data);
        setRecentPosts((recentRes.data.data || []).filter((item: BlogPost) => item.slug !== slug).slice(0, 3));
      } catch (err) {
        if (slug === fallbackPost.slug) {
          setPost(fallbackPost);
          setRecentPosts([]);
        } else {
          setError('Blog post not found.');
        }
      } finally {
        setIsLoading(false);
        window.scrollTo(0, 0);
      }
    };

    if (slug) {
      fetchData();
    }
  }, [slug]);

  if (isLoading) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  if (error || !post) {
    return (
      <div className="blog-page-container">
        <div className="blog-detail-empty">
          <h1>Post unavailable</h1>
          <p>{error || 'This blog post does not exist.'}</p>
          <Link to="/blog" className="blog-btn-readmore">Back to Blog</Link>
        </div>
      </div>
    );
  }

  const hasHtmlContent = /<\/?[a-z][\s\S]*>/i.test(post.content || '');
  const sanitizedExcerpt = sanitizeRichHtml(post.excerpt || '');
  const sanitizedContent = sanitizeRichHtml(post.content || '');
  const heroImageUrl = resolveSiteAssetUrl(post.image || '') || post.image || '';

  return (
    <div className="blog-page-container">
      <div className="blog-layout">
        <article className="blog-main blog-detail-main">
          <Link to="/blog" className="blog-detail-back-link">Back to Articles</Link>

          {heroImageUrl && (
            <div className="blog-post-image blog-detail-hero">
              <img src={heroImageUrl} alt={post.title} />
            </div>
          )}

          <div className="blog-detail-meta-top">
            <span>{post.category || 'General'}</span>
            <span className="meta-separator">|</span>
            <span>{post.author || 'Nurfia Editorial'}</span>
            <span className="meta-separator">|</span>
            <span>{new Date(post.publishedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>

          <h1 className="blog-detail-title">{post.title}</h1>

          {post.excerpt && <div className="blog-detail-excerpt" dangerouslySetInnerHTML={{ __html: sanitizedExcerpt }} />}

          <div className="blog-detail-content">
            {hasHtmlContent ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
            ) : (
              (post.content || '').split('\n').filter(Boolean).map((paragraph, index) => (
                <p key={`${post.id}-${index}`}>{paragraph}</p>
              ))
            )}
          </div>
        </article>

        <aside className="blog-sidebar">
          <div className="sidebar-widget">
            <h3 className="widget-title">Recent Posts</h3>
            <div className="recent-posts-list">
              {(recentPosts.length ? recentPosts : [fallbackPost]).map((item) => (
                <div className="recent-post-item" key={`detail-${item.id}-${item.slug}`}>
                  <div className="recent-post-thumb">
                    <img src={resolveSiteAssetUrl(item.image || '') || item.image || fallbackPost.image || ''} alt={item.title} />
                  </div>
                  <div className="recent-post-info">
                    <h4><Link to={`/blog/${item.slug}`}>{item.title}</Link></h4>
                    <span className="recent-post-date">
                      {new Date(item.publishedAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-widget">
            <h3 className="widget-title">Continue Reading</h3>
            <p className="blog-detail-side-copy">
              Explore new arrivals, seasonal styling ideas, and practical care guides curated for the Nurfia storefront.
            </p>
            <Link to="/shop" className="blog-btn-readmore">Shop New In</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

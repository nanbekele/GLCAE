import { useState, useEffect } from 'react';
import { Calendar, User, Tag, ArrowRight, Search, Filter, ImageOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface NewsPost {
  id: string;
  title: string;
  content: string;
  slug: string;
  tags: string[] | null;
  published_at: string;
  author_id: string;
  locale: string;
  cover_image_url: string | null;
  summary: string | null;
  category: string | null;
  coverImageUrl?: string | null;
}

const FEATURED_PREVIEW_LIMIT = 220;
const GRID_PREVIEW_LIMIT = 160;

const getMediaKind = (value: string | null | undefined): 'image' | 'video' | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:')) {
    if (trimmed.startsWith('data:video/')) return 'video';
    if (trimmed.startsWith('data:image/')) return 'image';
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/)) return 'video';
  if (lower.match(/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/)) return 'image';
  return null;
};

const News = () => {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<NewsPost[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  const allTags = ['company', 'projects', 'awards', 'technology', 'sustainability', 'partnerships'];

  useEffect(() => {
    fetchNews();
  }, []);

  useEffect(() => {
    filterPosts();
  }, [posts, searchTerm, selectedTag]);

  const resolveCoverImageUrl = (path: string | null | undefined) => {
    const raw = typeof path === 'string' ? path.trim() : '';
    if (!raw) return null;
    if (raw.includes('://')) return raw;

    let objectPath = raw.replace(/^\/+/, '');
    if (objectPath.startsWith('news-media/')) {
      objectPath = objectPath.slice('news-media/'.length);
    }
    if (objectPath.startsWith('public/news-media/')) {
      objectPath = objectPath.slice('public/news-media/'.length);
    }

    const { data } = supabase.storage.from('news-media').getPublicUrl(objectPath);
    return data?.publicUrl ?? null;
  };

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) throw error;
      const postsWithImages = (data || []).map((post) => ({
        ...post,
        coverImageUrl: resolveCoverImageUrl(post.cover_image_url),
      }));
      setPosts(postsWithImages);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeTags = (tags: NewsPost['tags'] | string | null | undefined) => {
    if (!tags) return [] as string[];
    if (Array.isArray(tags)) {
      return tags.map(tag => tag.toLowerCase());
    }
    if (typeof tags === 'string') {
      return tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
    }
    return [] as string[];
  };

  const filterPosts = () => {
    let filtered = posts;

    if (selectedTag !== 'all') {
      const selected = selectedTag.toLowerCase();
      filtered = filtered.filter(post => {
        const tagList = normalizeTags(post.tags);
        const tagMatch = tagList.includes(selected);
        const categoryMatch = typeof post.category === 'string' && post.category.toLowerCase() === selected;
        return tagMatch || categoryMatch;
      });
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.content.toLowerCase().includes(query) ||
        (post.summary?.toLowerCase().includes(query) ?? false)
      );
    }

    setFilteredPosts(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const getPrimaryContent = (post: NewsPost) => {
    const summary = post.summary?.trim() ?? '';
    if (summary.length > 0) return summary;
    return post.content ?? '';
  };

  const isExpanded = (postId: string) => expandedPosts[postId] === true;

  const getPreviewContent = (post: NewsPost, limit: number) => {
    const text = getPrimaryContent(post);
    if (isExpanded(post.id)) {
      return text;
    }
    if (text.length <= limit) {
      return text;
    }
    return text.slice(0, limit) + '...';
  };

  const shouldShowToggle = (post: NewsPost, limit: number) => {
    const text = getPrimaryContent(post);
    return text.length > limit;
  };

  const togglePostExpansion = (postId: string) => {
    setExpandedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const displayPosts = filteredPosts;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-accent py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6 animate-fade-in">
              Latest <span className="text-accent">News</span>
            </h1>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Stay updated with the latest developments, achievements, and innovations from GCAE
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-8 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="bg-card rounded-2xl p-6 shadow-card">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search news articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-muted-foreground" />
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {allTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {displayPosts.length} article{displayPosts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </section>

      {/* News Articles */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading news articles...</p>
            </div>
          ) : displayPosts.length > 0 ? (
            <div className="space-y-8">
              {/* Featured Article */}
              {displayPosts[0] && (
                <Card className="group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 overflow-hidden animate-fade-in">
                  <div className="md:flex">
                    <div className="md:w-1/3">
                      {displayPosts[0].coverImageUrl ? (
                        getMediaKind(displayPosts[0].coverImageUrl) === 'video' ? (
                          <video
                            src={displayPosts[0].coverImageUrl}
                            controls
                            className="h-40 md:h-56 w-full object-cover bg-black"
                          />
                        ) : (
                          <img
                            src={displayPosts[0].coverImageUrl}
                            alt={displayPosts[0].title}
                            className="h-40 md:h-56 w-full object-cover"
                            loading="lazy"
                          />
                        )
                      ) : (
                        <div className="h-40 md:h-56 bg-gradient-to-br from-primary to-accent flex flex-col items-center justify-center text-primary-foreground/80">
                          <ImageOff className="w-10 h-10 mb-2" />
                          <span>No image available</span>
                        </div>
                      )}
                    </div>
                    <div className="md:w-2/3 p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary">Featured</Badge>
                        {displayPosts[0].tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="capitalize">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <h2 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors mb-3">
                        {displayPosts[0].title}
                      </h2>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {getPreviewContent(displayPosts[0], FEATURED_PREVIEW_LIMIT)}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar size={16} className="text-primary" />
                            {formatDate(displayPosts[0].published_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User size={16} className="text-primary" />
                            GCAE Team
                          </div>
                        </div>
                        {shouldShowToggle(displayPosts[0], FEATURED_PREVIEW_LIMIT) && (
                          <Button
                            variant="outline"
                            onClick={() => togglePostExpansion(displayPosts[0].id)}
                            className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                          >
                            {isExpanded(displayPosts[0].id) ? (
                              'Show Less'
                            ) : (
                              <span className="flex items-center">
                                Read More <ArrowRight size={16} className="ml-1" />
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Other Articles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayPosts.slice(1).map((post, index) => (
                  <Card
                    key={post.id}
                    className="group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 animate-fade-in"
                    style={{ animationDelay: `${(index + 1) * 0.1}s` }}
                  >
                    {post.coverImageUrl ? (
                      getMediaKind(post.coverImageUrl) === 'video' ? (
                        <video
                          src={post.coverImageUrl}
                          controls
                          className="h-32 w-full object-cover bg-black"
                        />
                      ) : (
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="h-32 w-full object-cover"
                          loading="lazy"
                        />
                      )
                    ) : (
                      <div className="h-32 w-full bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <ImageOff className="w-8 h-8 mb-2" />
                        <span className="text-xs">No image available</span>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {post.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="capitalize text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-muted-foreground leading-relaxed mb-4">
                        {getPreviewContent(post, GRID_PREVIEW_LIMIT)}
                      </CardDescription>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar size={14} className="text-primary" />
                          {formatDate(post.published_at)}
                        </div>
                        {shouldShowToggle(post, GRID_PREVIEW_LIMIT) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePostExpansion(post.id)}
                            className="text-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            {isExpanded(post.id) ? 'Show Less' : 'Read More'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Tag size={64} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Articles Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedTag !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'No news articles available at the moment'
                }
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-primary-foreground mb-6">
              Stay Updated
            </h2>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              Subscribe to our newsletter to receive the latest news, project updates, and industry insights directly in your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
              <Input
                placeholder="Enter your email address"
                className="bg-primary-foreground text-foreground"
                id="newsletter-email"
              />
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8"
                onClick={async () => {
                  const emailInput = document.getElementById('newsletter-email') as HTMLInputElement;
                  const email = emailInput?.value;
                  
                  if (email && email.includes('@')) {
                    try {
                      const { error } = await supabase
                        .from('newsletter_subscriptions')
                        .insert([{ email }]);
                      
                      if (error) {
                        console.error('Error subscribing:', error);
                        alert('Error subscribing. Please try again.');
                      } else {
                        alert('Successfully subscribed to our newsletter!');
                        emailInput.value = '';
                      }
                    } catch (error) {
                      console.error('Error:', error);
                      alert('Error subscribing. Please try again.');
                    }
                  } else {
                    alert('Please enter a valid email address');
                  }
                }}
              >
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default News;

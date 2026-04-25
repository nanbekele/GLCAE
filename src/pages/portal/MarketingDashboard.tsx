import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { callFunction } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  PenTool,
  Camera,
  Share2,
  FileImage,
  Users,
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Image as ImageIcon,
  RefreshCcw,
  Home
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

type NewsCategory = {
  value: string;
  label: string;
};

// Fallback categories (must match server-side NEWS_CATEGORIES)
const STATIC_NEWS_CATEGORIES: NewsCategory[] = [
  { value: 'company', label: 'Company' },
  { value: 'projects', label: 'Projects' },
  { value: 'awards', label: 'Awards' },
  { value: 'technology', label: 'Technology' },
  { value: 'sustainability', label: 'Sustainability' },
  { value: 'partnerships', label: 'Partnerships' },
];

type MarketingPost = {
  id: string;
  title: string;
  content: string;
  slug: string;
  status: 'draft' | 'published';
  category: string | null;
  categoryLabel: string | null;
  summary: string | null;
  coverImageUrl: string | null;
  coverImagePath: string | null;
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MarketingProject = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  featured: boolean;
  mediaType: 'image' | 'video';
  mediaUrl: string | null;
  createdAt: string;
};

interface DashboardResponse {
  posts: MarketingPost[];
  newsletterActiveCount: number;
  stats: {
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    contactMessages: number;
    contactMessagesByStatus: Record<string, number>;
  };
  categories: NewsCategory[];
  projects: MarketingProject[];
}

interface PostFormState {
  title: string;
  content: string;
  slug: string;
  category: string;
  summary: string;
  coverImageDataUrl: string | null;
}

interface EditPostState extends PostFormState {
  id: string;
  currentCoverUrl: string | null;
  removeCoverImage: boolean;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
];

const fileToDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const getMediaKind = (value: string | null | undefined): 'image' | 'video' | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:')) {
    if (trimmed.startsWith('data:video/')) return 'video';
    if (trimmed.startsWith('data:image/')) return 'image';
    return null;
  }

  try {
    const url = new URL(trimmed);
    const path = url.pathname.toLowerCase();
    if (path.match(/\.(mp4|webm|ogg|mov|m4v)$/)) return 'video';
    if (path.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/)) return 'image';
    return null;
  } catch {
    const lower = trimmed.toLowerCase();
    if (lower.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/)) return 'video';
    if (lower.match(/\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/)) return 'image';
    return null;
  }
 };

const formatDate = (value: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch (_) {
    return value;
  }
};

const MarketingDashboard = () => {
  const { profile, token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [posts, setPosts] = useState<MarketingPost[]>([]);
  const [newsletterActiveCount, setNewsletterActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    contactMessages: 0,
    contactMessagesByStatus: {} as Record<string, number>,
  });
  const [projects, setProjects] = useState<MarketingProject[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>(STATIC_NEWS_CATEGORIES);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [updatingPost, setUpdatingPost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [newPostCoverPreview, setNewPostCoverPreview] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<PostFormState>({
    title: '',
    content: '',
    slug: '',
    category: '',
    summary: '',
    coverImageDataUrl: null,
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPost, setEditPost] = useState<EditPostState | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postPendingDelete, setPostPendingDelete] = useState<MarketingPost | null>(null);

  const newsBucketBaseUrl = useMemo(() => {
    if (!SUPABASE_URL) return null;
    const trimmed = SUPABASE_URL.replace(/\/$/, '');
    return `${trimmed}/storage/v1/object/public/news-media`;
  }, []);

  const normalizePostMedia = useCallback((post: MarketingPost): MarketingPost => {
    let resolvedCoverUrl = post.coverImageUrl && post.coverImageUrl.trim() ? post.coverImageUrl : null;

    if (!resolvedCoverUrl) {
      const rawPath = post.coverImagePath ?? null;
      if (rawPath) {
        if (rawPath.includes('://')) {
          resolvedCoverUrl = rawPath;
        } else if (newsBucketBaseUrl) {
          const withoutBucket = rawPath.replace(/^\/+/, '').replace(/^news-media\//, '');
          if (withoutBucket) {
            resolvedCoverUrl = `${newsBucketBaseUrl}/${withoutBucket}`;
          }
        }
      }
    }

    return {
      ...post,
      coverImageUrl: resolvedCoverUrl,
    };
  }, [newsBucketBaseUrl]);

  const applyPostTransforms = useCallback((incoming: MarketingPost[] = []) => incoming.map(normalizePostMedia), [normalizePostMedia]);

  const publishedPosts = posts.filter((post) => post.status === 'published');
  const draftPosts = posts.filter((post) => post.status === 'draft');
  const recentPosts = posts.slice(0, 5);
  const messageStatusEntries = Object.entries(stats.contactMessagesByStatus || {});

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        // 1) Core dashboard (may not include posts in current server build)
        const dashboard = await callFunction<Partial<DashboardResponse>>('marketing-manage', { action: 'get-dashboard' }, { token });

        // 2) Explicitly fetch posts & categories
        const postsResp = await callFunction<{ posts: MarketingPost[]; categories: NewsCategory[] }>(
          'marketing-manage',
          { action: 'list-posts' },
          { token },
        );

        const resolvedPosts = applyPostTransforms(postsResp.posts || []);
        setPosts(resolvedPosts);

        // Stats from posts
        const totalPosts = resolvedPosts.length;
        const publishedPosts = resolvedPosts.filter((p) => p.status === 'published').length;
        const draftPosts = resolvedPosts.filter((p) => p.status === 'draft').length;

        setNewsletterActiveCount(dashboard.newsletterActiveCount ?? 0);
        setStats((prev) => ({
          ...prev,
          ...(dashboard.stats ?? {}),
          totalPosts,
          publishedPosts,
          draftPosts,
        }));
        setCategories(
          postsResp.categories && postsResp.categories.length > 0
            ? postsResp.categories
            : (dashboard.categories && dashboard.categories.length > 0 ? dashboard.categories : STATIC_NEWS_CATEGORIES),
        );
        setProjects(dashboard.projects || []);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load marketing data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token, toast, applyPostTransforms]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section === 'news') {
      setShowCreatePost(true);
    }
  }, [location.search]);

  const refreshDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const dashboard = await callFunction<Partial<DashboardResponse>>('marketing-manage', { action: 'get-dashboard' }, { token });
      const postsResp = await callFunction<{ posts: MarketingPost[]; categories: NewsCategory[] }>(
        'marketing-manage',
        { action: 'list-posts' },
        { token },
      );

      const resolvedPosts = applyPostTransforms(postsResp.posts || []);
      setPosts(resolvedPosts);

      const totalPosts = resolvedPosts.length;
      const publishedPosts = resolvedPosts.filter((p) => p.status === 'published').length;
      const draftPosts = resolvedPosts.filter((p) => p.status === 'draft').length;
      // Removed obsolete setNewsletterSubscribers call (no state defined).
      // Use newsletterActiveCount from dashboard instead, already handled elsewhere.
      setStats((prev) => ({
        ...prev,
        ...(dashboard.stats ?? {}),
        totalPosts,
        publishedPosts,
        draftPosts,
      }));
      setCategories(
        postsResp.categories && postsResp.categories.length > 0
          ? postsResp.categories
          : (dashboard.categories && dashboard.categories.length > 0 ? dashboard.categories : STATIC_NEWS_CATEGORIES),
      );
      setProjects(dashboard.projects || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh marketing data',
        variant: 'destructive',
      });
    }
  }, [token, toast, applyPostTransforms]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const statusMatches = statusFilter === 'all' || post.status === statusFilter;
      const categoryMatches = categoryFilter === 'all' || post.category === categoryFilter;
      return statusMatches && categoryMatches;
    });
  }, [posts, statusFilter, categoryFilter]);

  const handleNewPostCoverUpload = async (file: File | null) => {
    if (!file) {
      setNewPost((prev) => ({ ...prev, coverImageDataUrl: null }));
      setNewPostCoverPreview(null);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setNewPost((prev) => ({ ...prev, coverImageDataUrl: dataUrl }));
      setNewPostCoverPreview(dataUrl);
    } catch (error: any) {
      toast({
        title: 'Media error',
        description: error.message || 'Failed to read media file',
        variant: 'destructive',
      });
    }
  };

  const handleCreatePost = async () => {
    if (!token || !profile) {
      toast({
        title: 'Error',
        description: 'Missing authentication context',
        variant: 'destructive',
      });
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({
        title: 'Missing information',
        description: 'Provide a title and content before creating a post.',
        variant: 'destructive',
      });
      return;
    }

    if (!newPost.category) {
      toast({
        title: 'Select category',
        description: 'Choose a category for the post.',
        variant: 'destructive',
      });
      return;
    }

    const slug = newPost.slug.trim() || newPost.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    setSubmittingPost(true);
    try {
      await callFunction('marketing-manage', {
        action: 'create-post',
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        slug,
        category: newPost.category,
        summary: newPost.summary.trim() || null,
        coverImageDataUrl: newPost.coverImageDataUrl,
      }, { token });

      toast({
        title: 'Success',
        description: 'Draft created successfully. Publish it to show on the public News page.',
      });

      setNewPost({
        title: '',
        content: '',
        slug: '',
        category: '',
        summary: '',
        coverImageDataUrl: null,
      });
      setNewPostCoverPreview(null);
      setShowCreatePost(false);
      await refreshDashboard();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create post.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingPost(false);
    }
  };

  const handlePublish = async (postId: string) => {
    if (!token) {
      toast({
        title: 'Error',
        description: 'Missing authentication context',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await callFunction<{ newsletter?: { sent: boolean; recipients: number; mode?: string; reason?: string } }>('marketing-manage', {
        action: 'publish-post',
        postId,
      }, { token });

      const newsletter = response.newsletter as any;
      let description = 'Post published successfully';
      if (newsletter) {
        const recipients = typeof newsletter.recipients === 'number' ? newsletter.recipients : 0;
        if (newsletter.sent) {
          description += ` and newsletter sent to ${recipients} subscriber${recipients === 1 ? '' : 's'}`;
        } else {
          const code = newsletter.mode || newsletter.reason || 'no-subscribers';
          const friendly: Record<string, string> = {
            'dry-run': 'email service not configured in local dev',
            'no-subscribers': 'no active subscribers',
            'network_unreachable': 'email service not reachable',
            'email_service_error': 'email service error',
          };
          const note = friendly[String(code)] ?? 'not sent';
          description += `. Newsletter ${note}`;
        }
      }

      toast({
        title: 'Success',
        description,
      });

      refreshDashboard();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to publish post",
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (post: MarketingPost) => {
    const normalized = normalizePostMedia(post);
    setEditPost({
      id: normalized.id,
      title: normalized.title,
      content: normalized.content,
      slug: normalized.slug,
      category: normalized.category ?? '',
      summary: normalized.summary ?? '',
      coverImageDataUrl: null,
      currentCoverUrl: normalized.coverImageUrl,
      removeCoverImage: false,
    });
    setEditDialogOpen(true);
  };

  const handleEditCoverChange = async (file: File | null) => {
    if (!editPost) return;
    if (!file) {
      setEditPost((prev) => prev ? { ...prev, coverImageDataUrl: null } : prev);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setEditPost((prev) => prev ? ({ ...prev, coverImageDataUrl: dataUrl, removeCoverImage: false }) : prev);
    } catch (error: any) {
      toast({
        title: 'Media error',
        description: error.message || 'Failed to read media file',
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePost = async () => {
    if (!token || !editPost) return;

    if (!editPost.title.trim() || !editPost.content.trim()) {
      toast({
        title: 'Missing information',
        description: 'Provide a title and content when updating a post.',
        variant: 'destructive',
      });
      return;
    }

    if (!editPost.category) {
      toast({
        title: 'Select category',
        description: 'Choose a category before saving.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingPost(true);
    try {
      await callFunction('marketing-manage', {
        action: 'update-post',
        postId: editPost.id,
        title: editPost.title.trim(),
        content: editPost.content.trim(),
        slug: editPost.slug.trim(),
        category: editPost.category,
        summary: editPost.summary.trim(),
        coverImageDataUrl: editPost.coverImageDataUrl ?? undefined,
        removeCoverImage: editPost.removeCoverImage,
      }, { token });

      toast({
        title: 'Post updated',
        description: 'Changes saved successfully.',
      });

      setEditDialogOpen(false);
      setEditPost(null);
      await refreshDashboard();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update post.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPost(false);
    }
  };

  const confirmDeletePost = (post: MarketingPost) => {
    setPostPendingDelete(post);
    setDeleteDialogOpen(true);
  };

  const handleDeletePost = async () => {
    if (!token || !postPendingDelete) return;
    setDeletingPost(true);
    try {
      await callFunction('marketing-manage', {
        action: 'delete-post',
        postId: postPendingDelete.id,
      }, { token });

      toast({
        title: 'Post deleted',
        description: `${postPendingDelete.title} removed successfully.`,
      });

      setPostPendingDelete(null);
      setDeleteDialogOpen(false);
      await refreshDashboard();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete post.',
        variant: 'destructive',
      });
    } finally {
      setDeletingPost(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const contentActions = [
    {
      title: 'News Management',
      description: 'Create and publish news articles',
      icon: PenTool,
      action: () => navigate('/portal/marketing?section=news'),
      buttonLabel: 'Manage'
    },
    {
      title: 'Project Portfolio',
      description: 'Manage project showcases and gallery',
      icon: Camera,
      action: () => navigate('/portal/marketing/projects'),
      buttonLabel: 'Manage'
    },
    {
      title: 'Social Media',
      description: 'Manage social media content and posts',
      icon: Share2,
      action: () => navigate('/portal/marketing/social-media'),
      buttonLabel: 'Manage'
    },
    {
      title: 'Media Library',
      description: 'Organize photos and marketing materials',
      icon: FileImage,
      action: () => navigate('/portal/marketing/gallery'),
      buttonLabel: 'Manage'
    },
    {
      title: 'Contact Messages',
      description: 'Check and respond to customer inquiries',
      icon: Users,
      action: () => navigate('/portal/marketing/messages'),
      buttonLabel: 'Check Messages'
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Marketing & Communications Dashboard</h1>
              <p className="opacity-90">Welcome back, {profile?.full_name}. Manage content and communications for GUBALAFTO.</p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total News Posts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published Posts</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.publishedPosts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Posts</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draftPosts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Marketing Reach</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Active subscribers</p>
                <div className="text-2xl font-bold">{newsletterActiveCount}</div>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Open contact messages</p>
                <div className="text-xl font-semibold">{stats.contactMessages}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Post Section */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>News Management</CardTitle>
                <Button onClick={() => setShowCreatePost(!showCreatePost)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              </div>
            </CardHeader>
            {showCreatePost && (
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="Enter post title"
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={newPost.slug}
                    onChange={(e) => setNewPost({ ...newPost, slug: e.target.value })}
                    placeholder="Auto-generated from title"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    placeholder="Enter post content"
                    rows={6}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newPost.category}
                    onValueChange={(value) => setNewPost({ ...newPost, category: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverImage">Cover Image</Label>
                  <div className="flex flex-col md:flex-row gap-4 md:items-center">
                    <Input
                      id="coverImage"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(event) => handleNewPostCoverUpload(event.target.files?.[0] ?? null)}
                    />
                    {newPostCoverPreview && (
                      <div className="flex items-center gap-3">
                        {getMediaKind(newPostCoverPreview) === 'video' ? (
                          <video
                            src={newPostCoverPreview}
                            controls
                            className="h-16 w-28 rounded bg-black border"
                          />
                        ) : (
                          <img
                            src={newPostCoverPreview}
                            alt="Cover preview"
                            className="h-16 w-16 object-cover rounded"
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleNewPostCoverUpload(null)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload featured media (optional). Images (JPG/PNG) or video files supported.
                  </p>
                </div>

                <Button onClick={handleCreatePost} disabled={submittingPost}>
                  {submittingPost ? 'Saving...' : 'Create Draft'}
                </Button>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Posts List */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle>News Posts</CardTitle>
                <div className="flex flex-wrap gap-3 items-center">
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status filter" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Category filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredPosts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No posts match the selected filters.</p>
                )}

                {filteredPosts.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="py-3 pr-4 font-medium">Cover</th>
                          <th className="py-3 pr-4 font-medium">Title</th>
                          <th className="py-3 pr-4 font-medium">Category</th>
                          <th className="py-3 pr-4 font-medium">Status</th>
                          <th className="py-3 pr-4 font-medium">Created</th>
                          <th className="py-3 pr-4 font-medium">Updated</th>
                          <th className="py-3 pr-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPosts.map((post) => (
                          <tr key={post.id} className="border-b last:border-0">
                            <td className="py-3 pr-4">
                              {post.coverImageUrl ? (
                                getMediaKind(post.coverImageUrl) === 'video' ? (
                                  <video
                                    src={post.coverImageUrl}
                                    className="h-12 w-20 rounded-md border bg-black"
                                    muted
                                  />
                                ) : (
                                  <img
                                    src={post.coverImageUrl}
                                    alt={`${post.title} cover`}
                                    className="h-12 w-12 object-cover rounded-md border"
                                  />
                                )
                              ) : (
                                <div className="h-12 w-12 border rounded-md flex items-center justify-center text-muted-foreground">
                                  <ImageIcon className="h-5 w-5" />
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground line-clamp-1">{post.title}</div>
                              {post.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{post.summary}</p>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              {post.category ? (
                                <div className="flex items-center gap-1">
                                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{post.categoryLabel ?? post.category}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                                {post.status === 'published' ? 'Published' : 'Draft'}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4">{formatDate(post.createdAt)}</td>
                            <td className="py-3 pr-4">{formatDate(post.updatedAt)}</td>
                            <td className="py-3 pr-0">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(post)}>
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                {post.status === 'draft' && (
                                  <Button variant="secondary" size="sm" onClick={() => handlePublish(post.id)}>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Publish
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => confirmDeletePost(post)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Management Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {contentActions.map((action, index) => (
            <Card key={index} className="shadow-card border-card-border hover:shadow-elevated transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <action.icon size={20} className="text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {action.description}
                </CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={action.action}
                >
                  {action.buttonLabel}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PenTool size={20} />
                <span>Content Snapshot</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No posts created yet.</p>
                ) : (
                  recentPosts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{post.title}</p>
                        <p className="text-xs text-muted-foreground">{post.status}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp size={20} />
                <span>Contact Message Overview</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {messageStatusEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contact messages yet.</p>
                ) : (
                  messageStatusEntries.map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <p className="text-sm font-medium text-foreground capitalize">{status}</p>
                      <span className="text-sm text-muted-foreground">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setEditPost(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit News Post</DialogTitle>
              <DialogDescription>Update the article content, category, and featured media.</DialogDescription>
            </DialogHeader>

            {editPost && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      value={editPost.title}
                      onChange={(event) => setEditPost({ ...editPost, title: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-slug">Slug</Label>
                    <Input
                      id="edit-slug"
                      value={editPost.slug}
                      onChange={(event) => setEditPost({ ...editPost, slug: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select
                      value={editPost.category || 'placeholder'}
                      onValueChange={(value) =>
                        setEditPost({ ...editPost, category: value === 'placeholder' ? '' : value })
                      }
                    >
                      <SelectTrigger id="edit-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placeholder" disabled>
                          Select category
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-summary">Summary</Label>
                    <Input
                      id="edit-summary"
                      value={editPost.summary}
                      onChange={(event) => setEditPost({ ...editPost, summary: event.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea
                    id="edit-content"
                    rows={6}
                    value={editPost.content}
                    onChange={(event) => setEditPost({ ...editPost, content: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <Input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(event) => handleEditCoverChange(event.target.files?.[0] ?? null)}
                    />
                    <div className="flex items-center gap-3">
                      {editPost.coverImageDataUrl || editPost.currentCoverUrl ? (
                        getMediaKind(editPost.coverImageDataUrl || editPost.currentCoverUrl) === 'video' ? (
                          <video
                            src={editPost.coverImageDataUrl || editPost.currentCoverUrl || ''}
                            controls
                            className="h-16 w-28 rounded border bg-black"
                          />
                        ) : (
                          <img
                            src={editPost.coverImageDataUrl || editPost.currentCoverUrl || ''}
                            alt="Cover preview"
                            className="h-16 w-16 rounded object-cover border"
                          />
                        )
                      ) : (
                        <div className="h-16 w-16 border rounded flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      {(editPost.coverImageDataUrl || editPost.currentCoverUrl) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditPost({
                              ...editPost,
                              coverImageDataUrl: null,
                              currentCoverUrl: null,
                              removeCoverImage: true,
                            })
                          }
                        >
                          Remove image
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditDialogOpen(false);
                      setEditPost(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdatePost} disabled={updatingPost}>
                    {updatingPost ? 'Saving…' : 'Save changes'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setPostPendingDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete news post</AlertDialogTitle>
              <AlertDialogDescription>
                {postPendingDelete
                  ? `This will permanently remove "${postPendingDelete.title}". This action cannot be undone.`
                  : 'This will permanently remove the selected post.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingPost}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeletePost}
                disabled={deletingPost}
              >
                {deletingPost ? 'Deleting…' : 'Delete post'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default MarketingDashboard;
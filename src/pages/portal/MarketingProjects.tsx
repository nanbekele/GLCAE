import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { callFunction } from '@/lib/api';

type MediaType = 'image' | 'video';

interface PortfolioProject {
  id: string;
  title: string;
  summary: string;
  status: 'planning' | 'in_progress' | 'completed';
  featured: boolean;
  mediaType: MediaType;
  mediaUrl: string | null;
}

const STATUS_LABELS: Record<PortfolioProject['status'], string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_OPTIONS: PortfolioProject['status'][] = ['planning', 'in_progress', 'completed'];

interface ProjectFormState {
  title: string;
  summary: string;
  status: PortfolioProject['status'];
  featured: boolean;
  mediaType: MediaType;
  videoUrl: string;
  videoSource: 'url' | 'file';
}

interface EditProjectState {
  id: string;
  title: string;
  summary: string;
  status: PortfolioProject['status'];
  featured: boolean;
  mediaType: MediaType;
  existingMediaUrl: string | null;
  newImageDataUrl: string | null;
  videoUrl: string;
  removeMedia: boolean;
}

const fileToDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const MarketingProjects = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);

  const initialForm = useMemo<ProjectFormState>(() => ({
    title: '',
    summary: '',
    status: 'planning',
    featured: false,
    mediaType: 'image',
    videoUrl: '',
    videoSource: 'url',
  }), []);

  const [form, setForm] = useState<ProjectFormState>(initialForm);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<EditProjectState | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchProjects = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await callFunction<{ projects: any[] }>('marketing-manage', {
        action: 'list-projects',
      }, { token });

      const mapped: PortfolioProject[] = (response.projects ?? []).map((project) => {
        const projectStatus = (project.status as PortfolioProject['status']) ?? 'planning';
        const projectMediaType = (project.mediaType ?? project.media_type ?? 'image') as MediaType;

        return {
          id: project.id,
          title: project.title,
          summary: project.summary ?? project.description ?? '',
          status: STATUS_OPTIONS.includes(projectStatus) ? projectStatus : 'planning',
          featured: Boolean(project.featured),
          mediaType: projectMediaType === 'video' ? 'video' : 'image',
          mediaUrl: project.mediaUrl ?? project.media_url ?? null,
        };
      });

      setProjects(mapped);
    } catch (error: any) {
      toast({
        title: 'Error loading projects',
        description: error.message || 'Failed to load project portfolio.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const resetForm = () => {
    setForm(initialForm);
    setImagePreview(null);
    setImageDataUrl(null);
    setVideoPreview(null);
    setVideoDataUrl(null);
  };

  const handleImageChange = async (file: File | null) => {
    if (!file) {
      setImagePreview(null);
      setImageDataUrl(null);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setImagePreview(dataUrl);
      setImageDataUrl(dataUrl);
    } catch (error: any) {
      toast({
        title: 'Image error',
        description: error.message || 'Failed to read project image.',
        variant: 'destructive',
      });
    }
  };

  const handleVideoChange = async (file: File | null) => {
    if (!file) {
      setVideoPreview(null);
      setVideoDataUrl(null);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setVideoPreview(dataUrl);
      setVideoDataUrl(dataUrl);
    } catch (error: any) {
      toast({
        title: 'Video error',
        description: error.message || 'Failed to read project video.',
        variant: 'destructive',
      });
    }
  };

  const addProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide a project title and summary before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (!token) {
      toast({
        title: 'Authentication required',
        description: 'Sign in to manage marketing projects.',
        variant: 'destructive',
      });
      return;
    }

    if (form.mediaType === 'image') {
      if (!imageDataUrl) {
        toast({
          title: 'Image required',
          description: 'Provide a showcase image for the project.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (form.videoSource === 'file') {
        if (!videoDataUrl) {
          toast({
            title: 'Video required',
            description: 'Upload a video file for the project.',
            variant: 'destructive',
          });
          return;
        }
      } else {
        if (!form.videoUrl.trim()) {
          toast({
            title: 'Video URL required',
            description: 'Provide a video URL for the project.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const response = await callFunction<{ project: any }>('marketing-manage', {
        action: 'create-project',
        title: form.title.trim(),
        summary: form.summary.trim(),
        status: form.status,
        mediaType: form.mediaType,
        mediaDataUrl: form.mediaType === 'image'
          ? imageDataUrl
          : form.videoSource === 'file'
            ? videoDataUrl
            : undefined,
        mediaUrl: form.mediaType === 'video' && form.videoSource === 'url' ? form.videoUrl.trim() : undefined,
        featured: form.featured,
      }, { token });

      const created = response.project;
      if (created) {
        const mapped: PortfolioProject = {
          id: created.id,
          title: created.title,
          summary: created.summary ?? created.description ?? '',
          status: created.status ?? 'planning',
          featured: Boolean(created.featured),
          mediaType: created.mediaType ?? created.media_type ?? 'image',
          mediaUrl: created.mediaUrl ?? created.media_url ?? null,
        };
        setProjects(prev => [mapped, ...prev]);
        toast({
          title: 'Project added',
          description: `${mapped.title} saved to the marketing portfolio.`,
        });
        resetForm();
      }
    } catch (error: any) {
      toast({
        title: 'Failed to add project',
        description: error.message || 'Unable to save project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeatured = async (id: string) => {
    if (!token) return;

    const project = projects.find(item => item.id === id);
    if (!project) return;

    setProcessingId(id);
    try {
      const response = await callFunction<{ project: any }>('marketing-manage', {
        action: 'update-project',
        projectId: id,
        featured: !project.featured,
      }, { token });

      const updated = response.project;
      if (updated) {
        setProjects(prev => prev.map(item => item.id === id ? {
          ...item,
          featured: Boolean(updated.featured),
        } : item));
      }
    } catch (error: any) {
      toast({
        title: 'Failed to update project',
        description: error.message || 'Unable to update featured state.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const updateStatus = async (id: string, status: PortfolioProject['status']) => {
    if (!token) return;

    setProcessingId(id);
    try {
      const response = await callFunction<{ project: any }>('marketing-manage', {
        action: 'update-project',
        projectId: id,
        status,
      }, { token });

      const updated = response.project;
      if (updated) {
        setProjects(prev => prev.map(item => item.id === id ? {
          ...item,
          status: updated.status ?? status,
        } : item));
      }
    } catch (error: any) {
      toast({
        title: 'Failed to update status',
        description: error.message || 'Unable to change project status.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const removeProject = async (id: string) => {
    if (!token) return;

    setProcessingId(id);
    try {
      await callFunction('marketing-manage', {
        action: 'delete-project',
        projectId: id,
      }, { token });

      setProjects(prev => prev.filter(project => project.id !== id));
      toast({
        title: 'Project removed',
        description: 'The project has been removed from the portfolio list.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to remove project',
        description: error.message || 'Unable to delete project.',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Project Portfolio</h1>
          <p className="text-muted-foreground max-w-2xl">
            Organise case studies and featured projects showcased on the public site. Use this
            workspace to draft descriptions before publishing to the website team.
          </p>
        </div>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Add Portfolio Item</CardTitle>
            <CardDescription>Capture the key facts that marketing will highlight.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addProject}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    placeholder="eg. Addis Innovation Hub"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Delivery Stage</Label>
                  <select
                    id="status"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PortfolioProject['status'] }))}
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="mediaType">Media Type</Label>
                <select
                  id="mediaType"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.mediaType}
                  onChange={(event) => {
                    const nextType = (event.target.value as MediaType) === 'video' ? 'video' : 'image';
                    setForm((prev) => ({ ...prev, mediaType: nextType }));
                    setImagePreview(null);
                    setImageDataUrl(null);
                    setVideoPreview(null);
                    setVideoDataUrl(null);
                  }}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>

              <div>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  placeholder="Brief overview, key statistics or differentiators"
                  rows={4}
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  required
                />
              </div>

              {form.mediaType === 'image' ? (
                <div>
                  <Label htmlFor="media">Showcase Image</Label>
                  <Input
                    id="media"
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                    required
                  />
                  {imagePreview && (
                    <div className="mt-3">
                      <img src={imagePreview} alt="Preview" className="h-32 w-32 object-cover rounded-md border" />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="videoSource">Video Source</Label>
                      <select
                        id="videoSource"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.videoSource}
                        onChange={(event) => {
                          const next = (event.target.value === 'file' ? 'file' : 'url') as ProjectFormState['videoSource'];
                          setForm((prev) => ({ ...prev, videoSource: next }));
                          setVideoPreview(null);
                          setVideoDataUrl(null);
                        }}
                      >
                        <option value="url">Paste link</option>
                        <option value="file">Upload file</option>
                      </select>
                    </div>

                    {form.videoSource === 'url' ? (
                      <div>
                        <Label htmlFor="videoUrl">Video URL</Label>
                        <Input
                          id="videoUrl"
                          placeholder="https://..."
                          value={form.videoUrl}
                          onChange={(event) => setForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="videoFile">Video File</Label>
                        <Input
                          id="videoFile"
                          type="file"
                          accept="video/*"
                          onChange={(event) => handleVideoChange(event.target.files?.[0] ?? null)}
                          required
                        />
                        {videoPreview && (
                          <div className="mt-3">
                            <video src={videoPreview} controls className="h-32 w-56 rounded-md border bg-black" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="featured"
                  checked={form.featured}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, featured: checked }))}
                />
                <Label htmlFor="featured">Mark as featured project</Label>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save to Portfolio'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Portfolio Library</CardTitle>
            <CardDescription>Preview the stories available for the public site and proposals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading && (
                <p className="text-muted-foreground text-sm">Loading projects…</p>
              )}
              {!loading && projects.length === 0 && (
                <p className="text-muted-foreground text-sm">No projects captured yet. Add a project to begin building the portfolio.</p>
              )}
              {projects.map((project) => (
                <div key={project.id} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{project.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{STATUS_LABELS[project.status]}</Badge>
                        {project.featured && (
                          <Badge className="bg-amber-500/20 text-amber-700">Featured</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={project.status}
                        onChange={(event) => updateStatus(project.id, event.target.value as PortfolioProject['status'])}
                        disabled={processingId === project.id}
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option} value={option}>{STATUS_LABELS[option]}</option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFeatured(project.id)}
                        disabled={processingId === project.id}
                      >
                        {project.featured ? 'Unfeature' : 'Feature'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeProject(project.id)}
                        disabled={processingId === project.id}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  {project.mediaUrl && project.mediaType !== 'video' && (
                    <img src={project.mediaUrl} alt={project.title} className="h-40 w-full object-cover rounded-md border" />
                  )}
                  {project.mediaUrl && project.mediaType === 'video' && (
                    <video src={project.mediaUrl} controls className="h-40 w-full rounded-md border bg-black" />
                  )}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.summary}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingProjects;

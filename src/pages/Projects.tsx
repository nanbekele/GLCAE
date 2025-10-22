import { useEffect, useMemo, useState } from 'react';
import { Filter, MapPin, Calendar, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type ProjectStatus = 'planning' | 'in_progress' | 'completed';

interface Project {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  status: ProjectStatus;
  featured: boolean;
  mediaType: 'image' | 'video';
  mediaUrl: string | null;
  createdAt: string | null;
}

const Projects = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [loading, setLoading] = useState(false);

  const STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: 'Planning',
    in_progress: 'In Progress',
    completed: 'Completed',
  };

  const STATUS_BADGES: Record<ProjectStatus, string> = {
    planning: 'bg-info text-info-foreground',
    in_progress: 'bg-warning text-warning-foreground',
    completed: 'bg-success text-success-foreground',
  };

  const resolveMediaUrl = (mediaType: string | null, mediaUrl: string | null): string | null => {
    if (!mediaUrl) return null;
    if (mediaUrl.includes('://')) return mediaUrl;
    if (mediaType !== 'image') return mediaUrl;

    const { data } = supabase.storage.from('project-media').getPublicUrl(mediaUrl);
    return data?.publicUrl ?? null;
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id,title,summary,description,status,media_type,media_url,featured,created_at,visibility')
          .eq('visibility', 'public')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: Project[] = (data ?? []).map((project) => {
          const status = (project.status as ProjectStatus) ?? 'planning';
          return {
            id: project.id,
            title: project.title,
            summary: project.summary ?? null,
            description: project.description ?? null,
            status: ['planning', 'in_progress', 'completed'].includes(status) ? status : 'planning',
            featured: Boolean(project.featured),
            mediaType: project.media_type === 'video' ? 'video' : 'image',
            mediaUrl: resolveMediaUrl(project.media_type, project.media_url),
            createdAt: project.created_at,
          };
        });

        setProjects(mapped);
      } catch (error: any) {
        toast({
          title: 'Error loading projects',
          description: error.message || 'Failed to load portfolio projects.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [toast]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects;
    return projects.filter((project) => project.status === statusFilter);
  }, [projects, statusFilter]);

  const formatDate = (value: string | null) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });
    } catch (error) {
      return null;
    }
  };

  const handleConsultancyClick = () => {
    if (!profile?.id) {
      toast({
        title: 'Create account and log in',
        description: 'Please create an account and log in first to request consultancy.',
      });
      return;
    }
    if ((profile.role ?? '').toLowerCase() !== 'client') {
      toast({
        title: 'Clients only',
        description: 'Consultancy requests are available only for clients.',
        variant: 'destructive',
      });
      return;
    }
    navigate('/portal/client/consultancy');
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary/90 to-accent py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6 animate-fade-in">
              Our <span className="text-accent">Projects</span>
            </h1>
            <p className="text-xl text-primary-foreground/90 max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Showcasing excellence in engineering and architectural solutions across Ethiopia and East Africa
            </p>
          </div>
        </div>
      </section>

      <section className="py-8 bg-secondary">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-muted-foreground" />
              <span className="font-medium text-foreground">Filter by Delivery Status:</span>
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {loading && (
            <p className="text-center text-muted-foreground py-12">Loading project portfolio…</p>
          )}

          {!loading && filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <Filter size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Projects Found</h3>
              <p className="text-muted-foreground">There are no projects that match the selected status at the moment.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project, index) => (
              <Card 
                key={project.id}
                className="group hover:shadow-corporate transition-all duration-300 border-card-border hover:border-primary/20 overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="relative overflow-hidden">
                  {project.mediaType === 'video' && project.mediaUrl ? (
                    <div className="w-full h-48 bg-black flex items-center justify-center text-primary-foreground text-sm">
                      Video preview unavailable
                    </div>
                  ) : project.mediaUrl ? (
                    <img 
                      src={project.mediaUrl}
                      alt={project.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      Image coming soon
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className={STATUS_BADGES[project.status]}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                  {project.featured && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-amber-500/80 text-black">Featured</Badge>
                    </div>
                  )}
                </div>
                
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {project.title}
                  </CardTitle>
                  {project.summary && (
                    <CardDescription className="text-muted-foreground leading-relaxed line-clamp-3">
                      {project.summary}
                    </CardDescription>
                  )}
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3 mb-4 text-sm text-muted-foreground">
                    {project.description && (
                      <p className="leading-relaxed line-clamp-4">{project.description}</p>
                    )}
                    {formatDate(project.createdAt) && (
                      <div className="flex items-center">
                        <Calendar size={16} className="mr-2 text-primary" />
                        Updated {formatDate(project.createdAt)}
                      </div>
                    )}
                    <div className="flex items-center">
                      <MapPin size={16} className="mr-2 text-primary" />
                      GCAE Portfolio
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    onClick={() => window.location.href = '/contact'}
                  >
                    Get in Touch
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <Star size={48} className="mx-auto text-accent mb-6" />
            <h2 className="text-4xl font-bold text-primary-foreground mb-6">
              Ready to Start Your Next Project?
            </h2>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              Join our portfolio of successful projects. Our expert team is ready to deliver 
              exceptional results for your next engineering or architectural challenge.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary" 
                className="px-8 py-4"
                onClick={handleConsultancyClick}
              >
                Get Free Consultation
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary"
                onClick={() => window.location.href = '/contact'}
              >
                Request Quote
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Projects;
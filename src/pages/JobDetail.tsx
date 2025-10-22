import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, Users, ArrowLeft } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  department_id?: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  responsibilities: string;
  salary_range?: string;
  posted_at: string;
  closes_at?: string;
  status?: string;
}

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!jobId) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();
        if (error) throw error;
        setJob(data as Job);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load job');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [jobId]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleApply = () => {
    if (!job) return;
    if (!profile?.id) {
      toast({ title: 'Login required', description: 'you must be login to apply', variant: 'destructive' });
      return;
    }
    navigate(`/careers/apply/${job.id}`);
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/careers')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Careers
          </Button>
          {job?.status ? (
            <Badge variant={job.status === 'active' ? 'default' : 'outline'} className="uppercase">
              {job.status === 'active' ? 'Open' : 'Closed'}
            </Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading job…</div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        ) : !job ? (
          <div className="text-center py-16 text-muted-foreground">Job not found.</div>
        ) : (
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="text-2xl">{job.title}</CardTitle>
              <CardDescription>
                <div className="flex flex-wrap gap-4 text-sm mt-2">
                  <span className="inline-flex items-center gap-1"><MapPin size={16} className="text-primary" /> {job.location}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={16} className="text-primary" /> {job.type}</span>
                  {job.salary_range ? (
                    <span className="inline-flex items-center gap-1"><Users size={16} className="text-primary" /> {job.salary_range}</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Posted: {formatDate(job.posted_at)} {job.closes_at ? `· Closes: ${formatDate(job.closes_at)}` : ''}
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">Responsibilities</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.responsibilities}</p>
              </section>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleApply} disabled={job.status !== 'active'}>
                  Apply Now
                </Button>
                <Button variant="outline" onClick={() => navigate('/careers')}>
                  Back to Careers
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default JobDetail;

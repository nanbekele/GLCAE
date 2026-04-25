import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Briefcase, Paperclip, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  location: string;
  type: string;
  salary_range: string;
  department_id: string;
}

const JobApplication = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    coverLetter: '',
    cvFile: null as File | null
  });

  useEffect(() => {
    if (!profile) return;

    setFormData((prev) => {
      const next = { ...prev };

      if (!next.name && profile.full_name) next.name = profile.full_name;
      if (!next.email && profile.email) next.email = profile.email;
      if (!next.phone && profile.phone) next.phone = profile.phone;

      return next;
    });
  }, [profile]);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    if (!jobId) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error) {
      console.error('Error fetching job:', error);
      toast({
        title: "Job Not Found",
        description: "The job posting you're looking for could not be found.",
        variant: "destructive",
      });
      navigate('/careers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !formData.name || !formData.email) return;

    setSubmitting(true);
    try {
      let uploadedCvUrl: string | null = null;

      if (formData.cvFile) {
        const fileExt = formData.cvFile.name.split('.').pop();
        const fileName = `${job.id}/${crypto.randomUUID()}.${fileExt || 'pdf'}`;
        const { error: uploadError } = await supabase.storage
          .from('job-applications')
          .upload(fileName, formData.cvFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('job-applications')
          .getPublicUrl(fileName);
        uploadedCvUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from('applications')
        .insert({
          job_id: job.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          cover_letter: formData.coverLetter,
          cv_url: uploadedCvUrl,
          status: 'applied'
        });

      if (error) throw error;

      toast({
        title: "Application Submitted",
        description: "Your job application has been submitted successfully. We'll contact you soon!",
      });

      navigate('/careers');
    } catch (error: any) {
      const message = String(error?.message ?? "");
      const isDuplicate = message.includes("duplicate_application_per_job") || message.toLowerCase().includes("duplicate");
      toast({
        title: "Submission Error",
        description: isDuplicate
          ? "You have already applied for this job. You can only apply once per job."
          : error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Job Not Found</h1>
          <p className="text-muted-foreground">The job posting you're looking for could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Job Info Header */}
        <Card className="mb-8 shadow-corporate border-card-border">
          <CardHeader>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                <Briefcase size={24} className="text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl text-foreground">{job.title}</CardTitle>
                <CardDescription className="text-lg">{job.location} • {job.type}</CardDescription>
              </div>
            </div>
            {job.salary_range && (
              <p className="text-lg font-semibold text-primary">{job.salary_range}</p>
            )}
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Job Details */}
          <div className="space-y-6">
            <Card className="shadow-corporate border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText size={20} />
                  <span>Job Description</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Overview</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Responsibilities</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.responsibilities}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Requirements</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Application Form */}
          <div>
            <Card className="shadow-corporate border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload size={20} />
                  <span>Apply for this Position</span>
                </CardTitle>
                <CardDescription>
                  Fill out the form below to submit your application
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="coverLetter">Cover Letter</Label>
                    <Textarea
                      id="coverLetter"
                      placeholder="Tell us why you're interested in this position and what makes you a great fit..."
                      value={formData.coverLetter}
                      onChange={(e) => setFormData(prev => ({ ...prev, coverLetter: e.target.value }))}
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cv">Resume / CV</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="cv"
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.odt"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setFormData((prev) => ({ ...prev, cvFile: file }));
                        }}
                      />
                      {formData.cvFile ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setFormData(prev => ({ ...prev, cvFile: null }))}
                          title="Remove selected file"
                        >
                          <Trash2 size={16} />
                        </Button>
                      ) : null}
                    </div>
                    {formData.cvFile ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip size={12} />
                        {formData.cvFile.name}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        PDF or Word documents up to 5&nbsp;MB are preferred.
                      </p>
                    )}
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <strong>Note:</strong> Your application will be reviewed by our HR team. 
                      We'll contact you within 5-7 business days if your profile matches our requirements.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary hover:opacity-90"
                    disabled={submitting || !formData.name || !formData.email}
                  >
                    {submitting ? 'Submitting Application...' : 'Submit Application'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobApplication;
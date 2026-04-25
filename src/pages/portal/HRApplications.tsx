import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Mail, Phone, Download, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Application {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cv_url?: string;
  cover_letter?: string;
  notes?: string[] | null;
  status: string;
  created_at: string;
  job_id: string;
  job?: {
    title: string;
  } | null;
}

const HRApplications = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    if (!selectedApp) {
      setNotes('');
      return;
    }

    const existingNote = Array.isArray(selectedApp.notes) ? selectedApp.notes[0] ?? '' : '';
    setNotes(existingNote);
  }, [selectedApp]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*, job:jobs!applications_job_id_fkey(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (appId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', appId);

      if (error) throw error;

      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status } : app
      ));

      toast({
        title: "Status Updated",
        description: `Application status changed to ${status}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteApplication = async (app: Application) => {
    const confirmed = window.confirm(`Delete application from ${app.name}? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', app.id);

      if (error) throw error;

      setApplications((prev) => prev.filter((existing) => existing.id !== app.id));
      setSelectedApp((prev) => (prev?.id === app.id ? null : prev));

      toast({
        title: 'Application deleted',
        description: `${app.name}'s application has been removed.`,
      });
    } catch (error: any) {
      console.error('Error deleting application:', error);
      toast({
        title: 'Failed to delete application',
        description: error.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'bg-blue-500';
      case 'reviewing': return 'bg-yellow-500';
      case 'interview': return 'bg-purple-500';
      case 'offer': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Job Applications</h1>
            <p className="text-muted-foreground">
              Review and manage job applications
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Applications List */}
          <div className="lg:col-span-2">
            <Card className="shadow-corporate border-card-border">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText size={20} />
                  <span>Applications ({applications.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No applications found</p>
                    </div>
                  ) : (
                    applications.map((app) => (
                      <div
                        key={app.id}
                        className={`p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedApp?.id === app.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => setSelectedApp(app)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={`${getStatusColor(app.status)} text-white border-0`}>
                              {app.status}
                            </Badge>
                            <h4 className="font-semibold text-foreground">{app.name}</h4>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {app.job?.title ? (
                          <p className="text-sm font-medium text-foreground mb-1">{app.job.title}</p>
                        ) : null}
                        <p className="text-sm text-muted-foreground mb-2">{app.email}</p>
                        {selectedApp?.id === app.id && Array.isArray(app.notes) && app.notes[0] ? (
                          <p className="text-sm text-destructive mb-2 break-words">
                            Note: {app.notes[0]}
                          </p>
                        ) : null}
                        {app.phone && (
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Phone size={14} className="mr-1" />
                            {app.phone}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Application Details */}
          <div>
            {selectedApp ? (
              <Card className="shadow-corporate border-card-border">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Eye size={20} />
                    <span>Application Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedApp.job?.title ? (
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Job</h4>
                      <p className="text-foreground">{selectedApp.job.title}</p>
                    </div>
                  ) : null}
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Applicant</h4>
                    <p className="text-foreground">{selectedApp.name}</p>
                    <p className="text-muted-foreground text-sm flex items-center mt-1">
                      <Mail size={14} className="mr-1" />
                      {selectedApp.email}
                    </p>
                    {selectedApp.phone && (
                      <p className="text-muted-foreground text-sm flex items-center mt-1">
                        <Phone size={14} className="mr-1" />
                        {selectedApp.phone}
                      </p>
                    )}
                  </div>

                  {selectedApp.cover_letter && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Cover Letter</h4>
                      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {selectedApp.cover_letter}
                      </p>
                    </div>
                  )}

                  {selectedApp.cv_url && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Resume/CV</h4>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <a
                          href={selectedApp.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center"
                        >
                          <Download size={16} className="mr-2" />
                          Download CV
                        </a>
                      </Button>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Status</h4>
                    <Select
                      value={selectedApp.status}
                      onValueChange={(value) => updateApplicationStatus(selectedApp.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="offer">Offer</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about this application..."
                      rows={4}
                    />
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      disabled={!selectedApp || savingNotes}
                      onClick={async () => {
                        if (!selectedApp) return;
                        setSavingNotes(true);
                        try {
                          const payload = notes.trim() ? { notes: [notes.trim()] } : { notes: null };
                          const { error } = await supabase
                            .from('applications')
                            .update(payload)
                            .eq('id', selectedApp.id);

                          if (error) throw error;

                          setApplications((prev) =>
                            prev.map((app) =>
                              app.id === selectedApp.id ? { ...app, ...payload } : app
                            )
                          );
                          setSelectedApp((prev) => (prev ? { ...prev, ...payload } : prev));
                          toast({
                            title: 'Notes saved',
                            description: 'Application notes updated successfully.',
                          });
                        } catch (error: any) {
                          console.error('Error saving notes:', error);
                          toast({
                            title: 'Failed to save notes',
                            description: error.message ?? 'Please try again.',
                            variant: 'destructive',
                          });
                        } finally {
                          setSavingNotes(false);
                        }
                      }}
                    >
                      {savingNotes ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => selectedApp && deleteApplication(selectedApp)}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete Application'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-corporate border-card-border">
                <CardContent className="py-8 text-center">
                  <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select an application to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRApplications;

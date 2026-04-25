import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { callFunction } from '@/lib/api';

interface Department {
  id: string;
  name: string;
}

interface PostJobDialogProps {
  onJobCreated?: () => void;
}

interface PostJobFormProps {
  enabled: boolean;
  onJobCreated?: () => void;
  onClose?: () => void;
}

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

export const PostJobDialog = ({ onJobCreated }: PostJobDialogProps) => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start" variant="outline" disabled={!profile || (profile.role !== 'hr_staff' && profile.role !== 'super_admin')}>
          <Briefcase size={16} className="mr-2" />
          Post New Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Post a New Job</DialogTitle>
          <DialogDescription>
            Provide the job details below. Published roles will appear on the Careers page.
          </DialogDescription>
        </DialogHeader>
        <PostJobForm
          enabled={open}
          onJobCreated={onJobCreated}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export const PostJobForm = ({ enabled, onJobCreated, onClose }: PostJobFormProps) => {
  const { toast } = useToast();
  const { profile, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fetchingDepartments, setFetchingDepartments] = useState(false);

  const [form, setForm] = useState({
    title: '',
    departmentId: '',
    location: '',
    type: 'Full-time',
    salaryRange: '',
    closesAt: '',
    description: '',
    requirements: '',
    responsibilities: '',
  });

  const canManageJobs = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'hr_staff' || profile.role === 'super_admin';
  }, [profile]);

  useEffect(() => {
    if (!enabled || departments.length > 0 || fetchingDepartments) {
      return;
    }

    const fetchDepartments = async () => {
      setFetchingDepartments(true);
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error('[PostJobDialog] Failed to load departments', error);
        toast({
          title: 'Failed to load departments',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setDepartments(data ?? []);
      }
      setFetchingDepartments(false);
    };

    fetchDepartments();
  }, [enabled, departments.length, fetchingDepartments, toast]);

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageJobs) {
      toast({
        title: 'Permission denied',
        description: 'You do not have access to create job postings.',
        variant: 'destructive',
      });
      return;
    }

    const trimmedTitle = form.title.trim();
    const trimmedLocation = form.location.trim();
    const trimmedDescription = form.description.trim();
    const trimmedRequirements = form.requirements.trim();
    const trimmedResponsibilities = form.responsibilities.trim();

    if (!trimmedTitle || !trimmedLocation || !trimmedDescription || !trimmedRequirements || !trimmedResponsibilities) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (!token) {
        throw new Error('Missing auth token. Please sign in again.');
      }

      const response = await callFunction<{
        success?: boolean;
        error?: string;
      }>('marketing-manage', {
        action: 'hr-create-job',
        title: trimmedTitle,
        departmentId: form.departmentId || null,
        location: trimmedLocation,
        type: form.type,
        salaryRange: form.salaryRange.trim() || null,
        closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
        description: trimmedDescription,
        requirements: trimmedRequirements,
        responsibilities: trimmedResponsibilities,
        status: 'active',
      }, {
        token,
        useAnonAuth: false,
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to create job');
      }

      toast({
        title: 'Job posted',
        description: 'The job vacancy has been published successfully.',
      });

      setForm({
        title: '',
        departmentId: '',
        location: '',
        type: 'Full-time',
        salaryRange: '',
        closesAt: '',
        description: '',
        requirements: '',
        responsibilities: '',
      });

      onClose?.();
      onJobCreated?.();
    } catch (error: any) {
      console.error('[PostJobDialog] Failed to post job', error);
      toast({
        title: 'Failed to post job',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job-title">Job Title *</Label>
              <Input
                id="job-title"
                placeholder="Senior Architect"
                value={form.title}
                onChange={handleChange('title')}
                required
              />
            </div>
            <div>
              <Label htmlFor="job-department">Department</Label>
              <Select
                value={form.departmentId || 'none'}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, departmentId: value === 'none' ? '' : value }))
                }
                disabled={fetchingDepartments}
              >
                <SelectTrigger id="job-department">
                  <SelectValue placeholder={fetchingDepartments ? 'Loading...' : 'Select a department'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General / Company-wide</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job-location">Location *</Label>
              <Input
                id="job-location"
                placeholder="Addis Ababa, Ethiopia"
                value={form.location}
                onChange={handleChange('location')}
                required
              />
            </div>
            <div>
              <Label htmlFor="job-type">Employment Type *</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="job-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((jobType) => (
                    <SelectItem key={jobType} value={jobType}>
                      {jobType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job-salary">Salary Range</Label>
              <Input
                id="job-salary"
                placeholder="e.g. 20,000 - 30,000 ETB/month"
                value={form.salaryRange}
                onChange={handleChange('salaryRange')}
              />
            </div>
            <div>
              <Label htmlFor="job-closes-at">Application Deadline</Label>
              <Input
                id="job-closes-at"
                type="date"
                value={form.closesAt}
                onChange={handleChange('closesAt')}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="job-description">Role Overview *</Label>
            <Textarea
              id="job-description"
              placeholder="Provide an overview of the role, responsibilities, and expectations..."
              value={form.description}
              onChange={handleChange('description')}
              rows={5}
              required
            />
          </div>

          <div>
            <Label htmlFor="job-requirements">Key Requirements *</Label>
            <Textarea
              id="job-requirements"
              placeholder="List the core qualifications, skills, and experience required..."
              value={form.requirements}
              onChange={handleChange('requirements')}
              rows={5}
              required
            />
          </div>

          <div>
            <Label htmlFor="job-responsibilities">Responsibilities *</Label>
            <Textarea
              id="job-responsibilities"
              placeholder="Outline the day-to-day responsibilities and scope of the role..."
              value={form.responsibilities}
              onChange={handleChange('responsibilities')}
              rows={5}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canManageJobs}>
              {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {loading ? 'Publishing...' : 'Publish Job'}
            </Button>
          </div>
        </form>
  );
};

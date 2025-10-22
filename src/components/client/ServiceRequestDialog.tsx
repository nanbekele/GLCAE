import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { uploadServiceRequestAttachments, createClientServiceRequest } from '@/lib/portalRequests';

export const ServiceRequestDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const priority = '#';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const { toast } = useToast();
  const { profile, token } = useAuth();

  const serviceTypes = [
    'Architectural Design',
    'Civil Engineering',
    'Mechanical Engineering',
    'Electrical Engineering',
    'ICT Solutions',
    'Material Testing',
    'Project Consultation',
    'Technical Support',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to submit a service request",
      });
      return;
    }

    if (!serviceType || !title.trim() || !description.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    setLoading(true);

    let attachmentsMetadata: Awaited<ReturnType<typeof uploadServiceRequestAttachments>> = [];

    if (attachment) {
      try {
        attachmentsMetadata = await uploadServiceRequestAttachments([attachment]);
      } catch (error: any) {
        console.error('Error preparing attachment:', error);
        toast({
          variant: "destructive",
          title: "Attachment processing failed",
          description: error?.message || "Unable to read the selected file. Please try again.",
        });
        setLoading(false);
        return;
      }
    }

    try {
      await createClientServiceRequest({
        clientId: profile.id,
        title: title.trim(),
        description: description.trim(),
        serviceType,
        priority,
        attachments: attachmentsMetadata,
        token,
      });

      toast({
        title: "Request Submitted",
        description: "Your service request has been submitted. We'll review it and get back to you shortly.",
      });

      setServiceType('');
      setTitle('');
      setDescription('');
      setAttachment(null);
      setOpen(false);
    } catch (error: any) {
      console.error('Error submitting service request:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit request. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          New Service Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>New Service Request</DialogTitle>
          <DialogDescription>
            Submit a request for our engineering and consultancy services
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="service-type">Service Type *</Label>
            <Select value={serviceType} onValueChange={setServiceType} required>
              <SelectTrigger id="service-type">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Priority</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              HR will assign priority after review. Submissions default to <span className="font-medium">#</span>.
            </p>
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of your request"
              required
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide detailed information about your service requirements..."
              required
              rows={6}
              maxLength={2000}
            />
          </div>

          <div>
            <Label htmlFor="attachment">Attachment (optional)</Label>
            <Input
              id="attachment"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setAttachment(file);
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">Upload supporting documents for your request.</p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { callFunction } from '@/lib/api';

interface FeedbackDialogProps {
  projectId?: string;
}

export const FeedbackDialog = ({ projectId }: FeedbackDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  const { profile, token } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to submit feedback",
      });
      return;
    }

    if (!subject.trim() || !message.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    setLoading(true);

    try {
      await callFunction('marketing-manage', {
        action: 'client-submit-feedback',
        projectId: projectId || null,
        subject: subject.trim(),
        message: message.trim(),
        rating: rating || null,
        clientId: profile.id,
      }, token ? { token } : undefined);

      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback. We'll review it shortly.",
      });

      setSubject('');
      setMessage('');
      setRating(0);
      setOpen(false);
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit feedback. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Submit Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Share your thoughts and help us improve our services
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="rating">Rating (Optional)</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`h-8 w-8 rounded-full border transition-colors ${star <= rating ? 'bg-warning/20 border-warning text-warning' : 'border-border text-muted-foreground'}`}
                >
                  {star}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your feedback"
              required
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please share your detailed feedback..."
              required
              rows={5}
              maxLength={2000}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

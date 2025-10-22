import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { callFunction } from '@/lib/api';
import { ExternalLink } from 'lucide-react';

interface Campaign {
  id: string;
  platform: 'facebook' | 'linkedin' | 'telegram' | 'twitter';
  title: string;
  copy: string;
  imageUrl: string | null;
  scheduledAt: string | null;
  approved: boolean;
  createdAt: string;
}

type CampaignFormState = {
  platform: Campaign['platform'];
  title: string;
  copy: string;
  imageUrl: string;
  scheduledDate: string;
  approved: boolean;
};

type RawCampaign = Campaign & {
  created_at?: string | null;
  scheduled_at?: string | null;
  image_url?: string | null;
};

const platformLabels: Record<Campaign['platform'], string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
  twitter: 'Twitter',
};

const socialPlatforms = [
  {
    platform: 'facebook' as Campaign['platform'],
    name: 'Facebook Business Suite',
    description: 'Manage community updates, ads, and Messenger inbox from a unified dashboard.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Facebook_Logo_2023.png',
    authUrl: 'https://www.facebook.com/login/',
  },
  {
    platform: 'linkedin' as Campaign['platform'],
    name: 'LinkedIn Campaign Manager',
    description: 'Target industry partners and share thought leadership with professional audiences.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png',
    authUrl: 'https://www.linkedin.com/login',
  },
  {
    platform: 'twitter' as Campaign['platform'],
    name: 'X (Twitter) Ads Manager',
    description: 'Coordinate short-form announcements and monitor engagement in real time.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/5/53/X_logo_2023.svg',
    authUrl: 'https://twitter.com/i/flow/login',
  },
  {
    platform: 'telegram' as Campaign['platform'],
    name: 'Telegram Channels',
    description: 'Broadcast engineering updates and alerts to internal stakeholders instantly.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',
    authUrl: 'https://web.telegram.org/k/',
  },
  {
    platform: 'tiktok' as Campaign['platform'],
    name: 'TikTok Business Center',
    description: 'Share behind-the-scenes build videos and reach emerging audiences.',
    image: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
    authUrl: 'https://www.tiktok.com/login',
  },
] as const;

const MarketingSocialMedia = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const initialForm: CampaignFormState = useMemo(() => ({
    platform: 'facebook',
    title: '',
    copy: '',
    imageUrl: '',
    scheduledDate: '',
    approved: false,
  }), []);

  const [form, setForm] = useState<CampaignFormState>(initialForm);

  const [activePlatform, setActivePlatform] = useState<Campaign['platform']>('facebook');

  const loadCampaigns = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await callFunction<{ campaigns: RawCampaign[] }>('marketing-manage', {
        action: 'list-campaigns',
      }, { token });

      const sorted = [...(response.campaigns ?? [])].sort((a, b) => {
        const bCreated = new Date(b.createdAt ?? b.created_at ?? '').getTime();
        const aCreated = new Date(a.createdAt ?? a.created_at ?? '').getTime();
        return bCreated - aCreated;
      });

      const normalized = sorted.map((campaign): Campaign => ({
        id: campaign.id,
        platform: campaign.platform,
        title: campaign.title,
        copy: campaign.copy,
        imageUrl: campaign.imageUrl ?? campaign.image_url ?? null,
        scheduledAt: campaign.scheduledAt ?? campaign.scheduled_at ?? null,
        approved: Boolean(campaign.approved),
        createdAt: campaign.createdAt ?? campaign.created_at ?? new Date().toISOString(),
      }));

      setCampaigns(normalized);
    } catch (error: any) {
      toast({
        title: 'Error loading campaigns',
        description: error.message || 'Failed to load social posts.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [token]);

  const resetForm = () => {
    setForm(initialForm);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.copy.trim()) {
      toast({
        title: 'Missing content',
        description: 'Please provide a headline and copy before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (!token) {
      toast({ title: 'Not authenticated', description: 'Sign in to create campaigns.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const payload = {
      action: 'create-campaign',
      platform: form.platform,
      title: form.title.trim(),
      copy: form.copy.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      scheduledAt: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : undefined,
      approved: form.approved,
    };

    callFunction<{ campaign: Campaign }>('marketing-manage', payload, { token })
      .then((response) => {
        if (!response?.campaign) {
          throw new Error('No campaign returned');
        }

        const campaign: Campaign = {
          id: response.campaign.id,
          platform: response.campaign.platform,
          title: response.campaign.title,
          copy: response.campaign.copy,
          imageUrl: response.campaign.imageUrl ?? null,
          scheduledAt: response.campaign.scheduledAt ?? null,
          approved: Boolean(response.campaign.approved),
          createdAt: response.campaign.createdAt ?? new Date().toISOString(),
        };

        setCampaigns((prev) => [campaign, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        toast({ title: 'Campaign draft created', description: `${campaign.title} saved for ${platformLabels[campaign.platform]}.` });
        setActivePlatform(campaign.platform);
        resetForm();
      })
      .catch((error: any) => {
        toast({
          title: 'Failed to create campaign',
          description: error.message || 'Unable to save draft. Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const toggleApproval = (id: string) => {
    if (!token) return;

    const campaign = campaigns.find((item) => item.id === id);
    if (!campaign) return;

    const nextApproved = !campaign.approved;
    setProcessingId(id);

    callFunction<{ campaign: Campaign }>('marketing-manage', {
      action: 'update-campaign',
      campaignId: id,
      approved: nextApproved,
    }, { token })
      .then((response) => {
        if (!response?.campaign) return;
        setCampaigns((prev) => prev.map((item) => (item.id === id ? {
          ...item,
          approved: Boolean(response.campaign.approved),
        } : item)));
      })
      .catch((error: any) => {
        toast({
          title: 'Failed to update approval',
          description: error.message || 'Unable to toggle approval. Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setProcessingId(null);
      });
  };

  const removeDraft = (id: string) => {
    if (!token) return;

    setProcessingId(id);
    callFunction('marketing-manage', {
      action: 'delete-campaign',
      campaignId: id,
    }, { token })
      .then(() => {
        setCampaigns((prev) => prev.filter((campaign) => campaign.id !== id));
        toast({ title: 'Draft deleted', description: 'The draft has been removed from the queue.' });
      })
      .catch((error: any) => {
        toast({
          title: 'Failed to delete draft',
          description: error.message || 'Unable to remove draft. Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setProcessingId(null);
      });
  };

  const campaignsByActivePlatform = campaigns.filter((campaign) => campaign.platform === activePlatform);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Social Media Planner</h1>
          <p className="text-muted-foreground max-w-2xl">
            Draft campaign copy, coordinate creative assets, and track approvals before hand-off to the
            social scheduling calendar.
          </p>
        </div>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Platform Access & Guidelines</CardTitle>
            <CardDescription>Quick links to official social channels and account guidance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {socialPlatforms.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.authUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                >
                  <div className="h-full border border-border rounded-lg overflow-hidden transition-all duration-200 group-hover:shadow-lg group-hover:border-primary/40">
                    <div className="relative bg-muted/40 flex items-center justify-center h-40">
                      <img
                        src={platform.image}
                        alt={platform.name}
                        className="max-h-24 object-contain"
                      />
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{platform.name}</h3>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">{platformLabels[platform.platform] ?? platform.platform}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {platform.description}
                      </p>
                      <p className="text-xs text-primary font-medium">Click to open authentication portal</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Create Social Post</CardTitle>
            <CardDescription>Standardise messaging across platforms from a single view.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <select
                    id="platform"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.platform}
                    onChange={(event) => setForm(prev => ({ ...prev, platform: event.target.value as Campaign['platform'] }))}
                  >
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="telegram">Telegram</option>
                    <option value="twitter">Twitter / X</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="scheduledDate">Schedule</Label>
                  <Input
                    id="scheduledDate"
                    type="datetime-local"
                    value={form.scheduledDate}
                    onChange={(event) => setForm(prev => ({ ...prev, scheduledDate: event.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="title">Headline</Label>
                <Input
                  id="title"
                  placeholder="eg. Celebrating new contract award"
                  value={form.title}
                  onChange={(event) => setForm(prev => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="copy">Post Copy</Label>
                <Textarea
                  id="copy"
                  rows={5}
                  placeholder="Share project highlights, CTA, hashtags, etc."
                  value={form.copy}
                  onChange={(event) => setForm(prev => ({ ...prev, copy: event.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="imageUrl">Image URL (optional)</Label>
                <Input
                  id="imageUrl"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(event) => setForm(prev => ({ ...prev, imageUrl: event.target.value }))}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="approved"
                  checked={form.approved}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, approved: checked }))}
                />
                <Label htmlFor="approved">Approved for scheduling</Label>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Draft'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-corporate border-card-border">
          <CardHeader>
            <CardTitle>Campaign Queue</CardTitle>
            <CardDescription>Filter drafts by platform to prepare copy hand-offs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activePlatform} onValueChange={(value) => setActivePlatform(value as Campaign['platform'])}>
              <TabsList className="grid grid-cols-4 gap-2">
                {Object.entries(platformLabels).map(([platform, label]) => (
                  <TabsTrigger key={platform} value={platform} className="text-sm">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(platformLabels).map(([platform]) => (
                <TabsContent key={platform} value={platform} className="mt-4 space-y-4">
                  {loading && platform === activePlatform && campaignsByActivePlatform.length === 0 && (
                    <p className="text-sm text-muted-foreground">Loading campaign queue...</p>
                  )}
                  {!loading && campaignsByActivePlatform.length === 0 && platform === activePlatform && (
                    <p className="text-sm text-muted-foreground">No drafts yet. Create one above.</p>
                  )}
                  {campaigns
                    .filter(campaign => campaign.platform === platform)
                    .map(campaign => (
                      <div key={campaign.id} className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-foreground">{campaign.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {campaign.scheduledAt ? (
                                <span>Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}</span>
                              ) : (
                                <span>Send time TBD</span>
                              )}
                              <Badge variant={campaign.approved ? 'default' : 'secondary'}>
                                {campaign.approved ? 'Approved' : 'Draft'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleApproval(campaign.id)}
                              disabled={processingId === campaign.id}
                            >
                              {campaign.approved ? 'Mark Draft' : 'Approve'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeDraft(campaign.id)}
                              disabled={processingId === campaign.id}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.copy}</p>
                        {campaign.imageUrl && (
                          <p className="text-xs text-muted-foreground">Asset: {campaign.imageUrl}</p>
                        )}
                      </div>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingSocialMedia;

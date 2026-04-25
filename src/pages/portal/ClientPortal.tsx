import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, MessageSquare, ClipboardList, Home, TrendingUp, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PortalRequestManager, type SentRequest } from '@/components/portal/PortalRequestManager';
import { createClientServiceRequest, uploadServiceRequestAttachments, fetchConsultancyRequestsForClient, type ConsultancyRequestRow, fetchInterviewSchedulesForClient, type InterviewScheduleLog } from '@/lib/portalRequests';

interface ClientMessage {
  id: string;
  name: string | null;
  email: string;
  subject: string | null;
  message: string;
  created_at: string;
  status: string;
}

interface ServiceRequest {
  id: string;
  title: string;
  service_type: string;
  status: string;
  priority: string;
  created_at: string;
}

// Feedback removed per request

const ClientPortal = () => {
  const { profile, token } = useAuth();
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  // Feedback removed
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageForm, setMessageForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: '',
    body: '',
  });

  const [consultancyRequests, setConsultancyRequests] = useState<ConsultancyRequestRow[]>([]);
  const [interviewSchedules, setInterviewSchedules] = useState<InterviewScheduleLog[]>([]);

  useEffect(() => {
    if (profile?.id) {
      fetchClientData();
    }
  }, [profile?.id]);

  // Live updates for client messages
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`contact-messages-client-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_messages', filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as any;
          const mapped: ClientMessage = {
            id: row.id,
            name: row.name ?? null,
            email: row.email,
            subject: row.subject,
            message: row.message,
            created_at: row.created_at,
            status: row.status,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Live updates for consultancy schedules (client view)
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`consultancy-client-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consultancyrequest', filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as any;
          setConsultancyRequests((prev) => {
            const idx = prev.findIndex((r) => r.id === row.id);
            const updated: ConsultancyRequestRow = {
              ...(prev[idx] ?? {} as any),
              ...row,
            };
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = updated;
              return next;
            }
            return [updated, ...prev].slice(0, 5);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consultancyrequest', filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as any as ConsultancyRequestRow;
          setConsultancyRequests((prev) => [row, ...prev].slice(0, 5));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchClientData = async () => {
    if (!profile?.id) return;

    try {
      const [messagesRes, requestsRes] = await Promise.all([
        supabase
          .from('contact_messages')
          .select('*')
          .eq('client_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('service_requests')
          .select('*')
          .eq('client_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      // Consultancy (separate call)
      try {
        const cons = await fetchConsultancyRequestsForClient(profile.id, 5, token);
        setConsultancyRequests(cons);
      } catch {}
      // Interview schedules (by applicant email) — prefer Edge Function via token
      try {
        const iv = await fetchInterviewSchedulesForClient(profile.email ?? '', 10, token);
        setInterviewSchedules(iv);
      } catch {}

      if (messagesRes.data) {
        const mapped = (messagesRes.data as any[]).map((row: any) => ({
          id: row.id,
          name: row.name ?? null,
          email: row.email,
          subject: row.subject,
          message: row.message,
          created_at: row.created_at,
          status: row.status,
        } as ClientMessage));
        setMessages(mapped);
      }
      if (requestsRes.data) setServiceRequests(requestsRes.data);
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { 
      title: 'Messages', 
      value: messages.length.toString(), 
      icon: MessageCircle, 
      color: 'text-primary' 
    },
    { 
      title: 'Service Requests', 
      value: serviceRequests.length.toString(), 
      icon: ClipboardList, 
      color: 'text-success' 
    },
    { 
      title: 'Active Requests', 
      value: serviceRequests.filter(r => r.status !== 'completed').length.toString(), 
      icon: TrendingUp, 
      color: 'text-warning' 
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
      case 'pending':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'in_progress':
      case 'processing':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'completed':
      case 'resolved':
        return 'bg-success/10 text-success border-success/20';
      case 'cancelled':
      case 'rejected':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPriorityColor = (priority: string) => {
    const normalized = priority.toLowerCase();
    switch (normalized) {
      case "#":
      case "needs review":
        return "bg-muted text-muted-foreground border-border";
      case 'low':
        return 'bg-muted text-muted-foreground border-border';
      case 'medium':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'high':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handlePortalRequestSubmit = async (request: SentRequest) => {
    if (!profile?.id) {
      toast({
        title: 'Not signed in',
        description: 'Please sign in to submit a service request.',
        variant: 'destructive',
      });
      throw new Error('Not authenticated');
    }

    const attachmentsMetadata = request.originalFiles && request.originalFiles.length > 0
      ? await uploadServiceRequestAttachments(request.originalFiles)
      : [];

    const created = await createClientServiceRequest({
      clientId: profile.id,
      title: request.title,
      description: request.details,
      serviceType: 'HR',
      attachments: attachmentsMetadata,
      token,
    });

    const mapped: ServiceRequest = {
      id: created.id,
      title: created.title,
      service_type: created.service_type,
      status: created.status,
      priority: created.priority ?? '#',
      created_at: created.created_at,
    };

    setServiceRequests((previous) => [mapped, ...previous].slice(0, 5));
    void fetchClientData();
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id) return;

    if (!messageForm.body.trim()) {
      toast({
        title: 'Message required',
        description: 'Please provide a message before sending.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const fullName = `${messageForm.firstName} ${messageForm.lastName}`.trim() || profile.full_name;
      const email = messageForm.email.trim() || profile.email;
      const { data, error } = await supabase
        .from('contact_messages')
        .insert({
          name: fullName,
          email,
          phone: messageForm.phone.trim() || profile.phone || null,
          subject: messageForm.subject.trim() || null,
          message: messageForm.body.trim(),
          status: 'new',
          client_id: profile.id,
        })
        .select('*')
        .single();

      if (error) throw error;

      setMessages((prev) => [{
        id: data.id,
        name: (data as any).name ?? null,
        email: (data as any).email,
        subject: data.subject,
        message: data.message,
        created_at: data.created_at,
        status: data.status,
      }, ...prev]);

      toast({
        title: 'Message sent',
        description: 'Your message has been delivered to the marketing team.',
      });

      setMessageForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        subject: '',
        body: '',
      });
    } catch (error: any) {
      console.error('Error sending client message:', error);
      toast({
        title: 'Failed to send message',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
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
        {/* Header with Back Button */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              My Portal
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name}. Track your projects and manage your activities.
            </p>
          </div>
          <Link to="/">
            <Button variant="outline">
              <Home size={16} className="mr-2" />
              Back to Homepage
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-card border-card-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon size={24} className="text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-card border-card-border flex flex-col">
            <CardHeader>
              <CardTitle>Request Service</CardTitle>
              <CardDescription>Submit a new service request</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <Button className="w-full mt-auto" asChild>
                <Link to="/portal/client/service-requests">New Service Request</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border flex flex-col">
            <CardHeader>
              <CardTitle>Request Consultancy</CardTitle>
              <CardDescription>Ask for consultancy from a department</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <Button className="w-full mt-auto" asChild>
                <Link to="/portal/client/consultancy">Open Consultancy Form</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border flex flex-col">
            <CardHeader>
              <CardTitle>Interview Schedules</CardTitle>
              <CardDescription>Your upcoming interview appointments</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="mb-3 text-sm text-muted-foreground">
                {interviewSchedules.length > 0 ? `${interviewSchedules.length} scheduled` : 'No interviews scheduled yet.'}
              </div>
              <Button className="w-full mt-auto" asChild>
                <Link to="/portal/client/interviews">Open Interview Schedules</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border flex flex-col">
            <CardHeader>
              <CardTitle>Consultancy Schedules</CardTitle>
              <CardDescription>Your scheduled consultancy sessions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="mb-3 text-sm text-muted-foreground">
                {consultancyRequests.filter(c => !!c.schedule_at).length > 0
                  ? `${consultancyRequests.filter(c => !!c.schedule_at).length} scheduled`
                  : 'No consultancy scheduled yet.'}
              </div>
              <Button className="w-full mt-auto" asChild>
                <Link to="/portal/client/consultancy-schedules">Open Consultancy Schedules</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border flex flex-col">
            <CardHeader>
              <CardTitle>Done Task</CardTitle>
              <CardDescription>Reports shared to you by HR</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <Button className="w-full mt-auto" asChild>
                <Link to="/portal/client/done-tasks">Open Done Task</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Service Requests and Consultancy placed above Send a Message */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList size={20} />
                <span>Service Requests</span>
              </CardTitle>
              <CardDescription>Send new service tickets to HR and track recent submissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PortalRequestManager
                trigger={
                  <Button variant="outline" className="w-full justify-center">
                    <Inbox size={16} className="mr-2" />
                    Create service request
                  </Button>
                }
                actorLabel="Client"
                actorDepartment="Client"
                departments={['HR']}
                enableReceived={false}
                initialSent={[]}
                sendToDepartment="HR"
                allowShareSelection={false}
                onSendRequest={handlePortalRequestSubmit}
              />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Recent requests</h3>
                {serviceRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No service requests</p>
                ) : (
                  serviceRequests.slice(0, 2).map((request) => (
                    <div key={request.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-foreground">{request.title}</h4>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(request.status)}`}>
                          {request.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{request.service_type}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consultancy Requests (info) */}
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList size={20} />
                <span>Consultancy Requests</span>
              </CardTitle>
              <CardDescription>Your consultancy requests and schedules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Recent consultancy</h3>
                {consultancyRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No consultancy requests</p>
                ) : (
                  consultancyRequests.slice(0, 2).map((c) => (
                    <div key={c.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-foreground">{c.title}</h4>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(c.status)}`}>
                          {c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.department}</span>
                        <span>{c.schedule_at ? `Scheduled: ${new Date(c.schedule_at).toLocaleString()}` : 'Not scheduled yet'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Send a Message */}
        <Card className="shadow-card border-card-border">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle size={20} />
                <span>Send a Message</span>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMessageForm((prev) => !prev)}
              >
                {showMessageForm ? 'Hide form' : 'Show form'}
              </Button>
            </div>
            <CardDescription>Reach the GCAE marketing team for updates or inquiries.</CardDescription>
          </CardHeader>
          <CardContent>
            {showMessageForm ? (
              <form onSubmit={handleSendMessage} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter your first name"
                      value={messageForm.firstName}
                      onChange={(event) => setMessageForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter your last name"
                      value={messageForm.lastName}
                      onChange={(event) => setMessageForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={profile?.email ?? 'Enter your email address'}
                    value={messageForm.email}
                    onChange={(event) => setMessageForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder={profile?.phone ?? 'Enter your phone number'}
                    value={messageForm.phone}
                    onChange={(event) => setMessageForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="What is this regarding?"
                    value={messageForm.subject}
                    onChange={(event) => setMessageForm((prev) => ({ ...prev, subject: event.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="messageBody">Message *</Label>
                  <Textarea
                    id="messageBody"
                    rows={6}
                    placeholder="Tell us about your project or inquiry..."
                    value={messageForm.body}
                    onChange={(event) => setMessageForm((prev) => ({ ...prev, body: event.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-auto" size="lg" disabled={sending}>
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            ) : (
              <Button type="button" variant="outline" onClick={() => setShowMessageForm(true)}>
                Show form
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientPortal;
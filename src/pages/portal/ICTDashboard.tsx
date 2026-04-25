import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Cpu,
  Network,
  Shield,
  Database,
  Monitor,
  AlertCircle,
  FileText,
  Users,
  BarChart3,
  Settings,
  ClipboardCheck,
  Home,
} from 'lucide-react';
import type { ServiceRequestAttachment } from '@/lib/portalRequests';
import { fetchConsultancyRequestsByDepartment, fetchServiceRequestsByServiceType, fetchDepartmentHeadId } from '@/lib/portalRequests';
import { supabase } from '@/integrations/supabase/client';

const ICTDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  type SharedRequest = {
    id: string;
    title: string | null;
    description: string | null;
    priority: string;
    serviceType: string | null;
    attachments: ServiceRequestAttachment[];
    createdAt: string | null;
  };

  type LocationState = {
    sharedRequestId?: string;
    sharedRequestTitle?: string | null;
    sharedRequestDescription?: string | null;
    sharedRequestPriority?: string;
    sharedRequestServiceType?: string | null;
    sharedRequestAttachments?: ServiceRequestAttachment[] | null;
    sharedRequestCreatedAt?: string | null;
  } | null;

  const [sharedRequest, setSharedRequest] = useState<SharedRequest | null>(null);

  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.sharedRequestId) {
      setSharedRequest({
        id: state.sharedRequestId,
        title: state.sharedRequestTitle ?? null,
        description: state.sharedRequestDescription ?? null,
        priority: state.sharedRequestPriority ?? '#',
        serviceType: state.sharedRequestServiceType ?? null,
        attachments: Array.isArray(state.sharedRequestAttachments) ? state.sharedRequestAttachments : [],
        createdAt: state.sharedRequestCreatedAt ?? null,
      });
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleQuickAction = (title: string) => {
    if (title === 'Service Tickets') {
      navigate('/portal/ict/service-tickets', {
        state: sharedRequest
          ? {
              sharedRequestId: sharedRequest.id,
              sharedRequestTitle: sharedRequest.title,
              sharedRequestDescription: sharedRequest.description,
              sharedRequestPriority: sharedRequest.priority,
              sharedRequestServiceType: sharedRequest.serviceType,
              sharedRequestAttachments: sharedRequest.attachments,
              sharedRequestCreatedAt: sharedRequest.createdAt,
            }
          : undefined,
      });
      return;
    }
  };

  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState({
    consultancyRequested: 0,
    submittedTasks: 0,
    inProgressTickets: 0,
    activeTickets: 0,
  });

  const stats = [
    { title: 'Consultancy Requested', value: String(statsData.consultancyRequested), icon: Settings, color: 'text-primary' },
    { title: 'Submitted Tasks', value: String(statsData.submittedTasks), icon: ClipboardCheck, color: 'text-success' },
    { title: 'In Progress Tickets', value: String(statsData.inProgressTickets), icon: Network, color: 'text-accent' },
    { title: 'Tasks', value: String(statsData.activeTickets), icon: Monitor, color: 'text-accent' },
  ];

  const quickActions = [
    { title: 'ICT Project Management', description: 'Manage network installations, software development, and IT consulting', icon: Cpu },
    { title: 'Network Infrastructure', description: 'Design and implement network solutions and data centers', icon: Network },
    { title: 'System Integration', description: 'Integrate various ICT systems and platforms', icon: Database },
    { title: 'Security Management', description: 'Monitor cybersecurity compliance and data protection', icon: Shield },
    { title: 'Service Tickets', description: 'Track and resolve internal and client service requests', icon: Monitor },
    { title: 'Performance Reports', description: 'Generate ICT performance and security reports', icon: BarChart3 },
  ];
  const infoActions = quickActions.filter((a) => a.title !== 'Service Tickets');

  const [ictProjects, setIctProjects] = useState<Array<{ name: string; type: string; status: string; progress: number }>>([]);

  const [ticketsPreview, setTicketsPreview] = useState<Array<{
    id: string;
    title: string | null;
    client: string | null;
    priority: string | null;
    status: string | null;
  }>>([]);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase().replace(/\s+/g, '_');
    switch (s) {
      case 'resolved': return 'text-success';
      case 'in_progress': return 'text-primary';
      case 'scheduled': return 'text-accent';
      case 'pending': return 'text-muted-foreground';
      case 'completed': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-accent';
      case 'low': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        // Consultancy requested = consultancy requests (excluding cancelled)
        const { count: consultancyCount } = await supabase
          .from('consultancyrequest')
          .select('id', { count: 'exact', head: true })
          .eq('department', 'ICT')
          .neq('status', 'cancelled');

        // Tickets counts
        const { count: inProgress } = await supabase
          .from('service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('service_type', 'ICT')
          .eq('status', 'in_progress');

        const { count: openTickets } = await supabase
          .from('service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('service_type', 'ICT')
          .not('title', 'ilike', 'Report:%')
          .not('status', 'in', '(completed,resolved,verified)');

        const { count: openConsultancy } = await supabase
          .from('consultancyrequest')
          .select('id', { count: 'exact', head: true })
          .eq('department', 'ICT')
          .not('status', 'in', '(completed,cancelled)');

        const activeTickets = (openTickets ?? 0) + (openConsultancy ?? 0);

        // Submitted tasks = service_requests assigned to ICT head with title like 'Report:%'
        let submittedTasks = 0;
        try {
          const headId = await fetchDepartmentHeadId('ICT');
          if (headId) {
            const { count } = await supabase
              .from('service_requests')
              .select('id', { count: 'exact', head: true })
              .eq('assigned_to', headId)
              .eq('service_type', 'ICT')
              .ilike('title', 'Report:%');
            submittedTasks = count ?? 0;
          }
        } catch {}

        setStatsData({
          consultancyRequested: consultancyCount ?? 0,
          submittedTasks,
          inProgressTickets: inProgress ?? 0,
          activeTickets,
        });
      } finally {
        setStatsLoading(false);
      }
    };

    const loadProjects = async () => {
      try {
        const rows = await fetchConsultancyRequestsByDepartment('ICT', 2);
        const mapProgress = (status: string) => {
          const s = (status ?? '').toLowerCase();
          if (s === 'completed') return 100;
          if (s === 'scheduled') return 60;
          if (s === 'pending') return 25;
          return 0;
        };
        setIctProjects(rows.map(r => ({
          name: r.title,
          type: 'Consultancy',
          status: r.status,
          progress: mapProgress(r.status),
        })));
      } catch (e) {
        // keep empty on error
      }
    };

    const loadTickets = async () => {
      try {
        const items = await fetchServiceRequestsByServiceType('ICT', 10);
        const previewItems = (items ?? [])
          .filter((i) => (i.status ?? '').toLowerCase() === 'in_progress')
          .slice(0, 2);
        const clientIds = Array.from(new Set(previewItems.map(i => i.client_id).filter(Boolean))) as string[];
        let clientMap = new Map<string, string>();
        if (clientIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', clientIds);
          (data ?? []).forEach((p: any) => clientMap.set(p.id, p.full_name));
        }
        setTicketsPreview(previewItems.map(i => ({
          id: i.id,
          title: i.title ?? null,
          client: clientMap.get(i.client_id as string) ?? null,
          priority: i.priority ?? null,
          status: i.status ?? null,
        })));
      } catch (e) {
        setTicketsPreview([]);
      }
    };

    void loadStats();
    void loadProjects();
    void loadTickets();
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 p-6 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Information & Communication Technology</h1>
              <p className="opacity-90">
                Welcome back, {profile?.full_name}. Manage ICT services, network infrastructure, and digital solutions.
              </p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
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

        {/* Our Responsibility */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-success">Our Responsibility</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {infoActions.map((action, index) => {
            const idx = index % 3;
            const borderHover = idx === 0 ? 'hover:border-primary/50' : idx === 1 ? 'hover:border-accent/50' : 'hover:border-success/50';
            const iconColor = idx === 0 ? 'text-primary' : idx === 1 ? 'text-accent' : 'text-success';
            const iconBg = idx === 0 ? 'bg-primary/10' : idx === 1 ? 'bg-accent/10' : 'bg-success/10';
            const barFrom = idx === 0 ? 'from-primary/60' : idx === 1 ? 'from-accent/60' : 'from-success/60';
            const barTo = idx === 0 ? 'to-accent/60' : idx === 1 ? 'to-success/60' : 'to-primary/60';
            return (
              <Card key={index} className={`shadow-card border-card-border ${borderHover} hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 group`}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} ${iconColor} group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-colors`}>
                      <action.icon size={20} />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                  <div className={`mt-3 h-1 w-24 rounded-full bg-gradient-to-r ${barFrom} ${barTo}`}></div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-2">
                    {action.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actionable cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor size={20} />
                <span>Service Tickets</span>
              </CardTitle>
              <CardDescription>Track and resolve internal and client service requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="default"
                size="sm"
                className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 transition-colors"
                onClick={() => handleQuickAction('Service Tickets')}
              >
                Access
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardCheck size={20} />
                <span>Check Submitted Tasks</span>
              </CardTitle>
              <CardDescription>Review reports prepared by employees, verify and forward to HR.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate('/portal/head/reports')}
              >
                Open
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor size={20} />
                <span>Consultancy Requests</span>
              </CardTitle>
              <CardDescription>Review client consultancy requests and schedule sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate('/portal/consultancy/ict')}
              >
                Open
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ICT Projects & Service Tickets */}
      </div>
    </div>
  );
};

export default ICTDashboard;
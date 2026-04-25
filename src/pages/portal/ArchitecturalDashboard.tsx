import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  FileText, 
  Users, 
  Calendar, 
  CheckCircle,
  AlertCircle,
  Upload,
  MessageSquare,
  BarChart3,
  Settings,
  ClipboardCheck,
  Home
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchDepartmentHeadId } from '@/lib/portalRequests';

const ArchitecturalDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

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
    { title: 'In Progress Tickets', value: String(statsData.inProgressTickets), icon: FileText, color: 'text-accent' },
    { title: 'Tasks', value: String(statsData.activeTickets), icon: AlertCircle, color: 'text-accent' },
  ];

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const dept = 'Architectural & Civil';
        // Consultancy requested for department
        const { count: consultancyCount } = await supabase
          .from('consultancyrequest')
          .select('id', { count: 'exact', head: true })
          .eq('department', dept)
          .neq('status', 'cancelled');

        // Tickets
        const { count: inProgress } = await supabase
          .from('service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('service_type', dept)
          .eq('status', 'in_progress');

        const { count: openTickets } = await supabase
          .from('service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('service_type', dept)
          .not('title', 'ilike', 'Report:%')
          .not('status', 'in', '(completed,resolved,verified)');

        const { count: openConsultancy } = await supabase
          .from('consultancyrequest')
          .select('id', { count: 'exact', head: true })
          .eq('department', dept)
          .not('status', 'in', '(completed,cancelled)');

        const activeTickets = (openTickets ?? 0) + (openConsultancy ?? 0);

        // Submitted tasks (reports) assigned to department head
        let submittedTasks = 0;
        try {
          const headId = await fetchDepartmentHeadId(dept);
          if (headId) {
            const { count } = await supabase
              .from('service_requests')
              .select('id', { count: 'exact', head: true })
              .eq('assigned_to', headId)
              .eq('service_type', dept)
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

    void loadStats();
  }, []);

  const quickActions = [
    { title: 'Project Management', description: 'Manage design projects, milestones, and deadlines', icon: Building2 },
    { title: 'CAD File Management', description: 'Upload and organize CAD drawings, blueprints, and 3D models', icon: Upload },
    { title: 'Client Inquiries', description: 'Handle design inquiries and revision requests', icon: MessageSquare },
    { title: 'Collaboration Hub', description: 'Coordinate with MEP and ICT departments', icon: Users },
    { title: 'Project Reports', description: 'Generate reports for management and clients', icon: BarChart3 },
    { title: 'BIM Management', description: 'Manage Building Information Modeling files', icon: FileText },
    { title: 'Service Tickets', description: 'Track and resolve internal and client service requests', icon: FileText },
  ];

  const infoActions = quickActions.filter((a) => a.title !== 'Service Tickets');
  const handleNavigateServiceTickets = () => {
    navigate('/portal/architectural/service-tickets');
  };

  const [currentProjects, setCurrentProjects] = useState<
    { name: string; phase: string; progress: number; deadline: string | null }[]
  >([]);
  const [recentActivities, setRecentActivities] = useState<
    { activity: string; time: string; type: string }[]
  >([]);

  useEffect(() => {
    const loadProjectsAndActivities = async () => {
      try {
        // Find Architectural & Civil department id
        const { data: dept, error: deptErr } = await supabase
          .from('departments')
          .select('id, slug')
          .eq('slug', 'architectural-civil')
          .maybeSingle();
        if (deptErr) throw deptErr;

        // Load latest projects for the department
        let projectsQuery = supabase
          .from('projects')
          .select('id, title, status, start_date, end_date, updated_at')
          .order('updated_at', { ascending: false })
          .limit(2);
        if (dept?.id) {
          projectsQuery = projectsQuery.eq('department_id', dept.id);
        }
        const { data: projects, error: projErr } = await projectsQuery;
        if (projErr) throw projErr;

        const now = new Date();
        const mappedProjects = (projects ?? []).map((p: any) => {
          let progress = 0;
          if (p.start_date && p.end_date) {
            const start = new Date(p.start_date);
            const end = new Date(p.end_date);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
              const ratio = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
              progress = Math.max(0, Math.min(1, ratio)) * 100;
            }
          } else if (typeof p.status === 'string' && p.status.toLowerCase() === 'completed') {
            progress = 100;
          }
          return {
            name: p.title as string,
            phase: (p.status as string) ?? '—',
            progress: Math.round(progress),
            deadline: p.end_date ? format(new Date(p.end_date), 'yyyy-MM-dd') : null,
          };
        });
        setCurrentProjects(mappedProjects);

        // Load recent activities from service requests related to this department
        const activitiesQuery = (supabase as any)
          .from('service_requests')
          .select('id, title, status, created_at')
          .eq('service_type', 'Architectural & Civil')
          .order('created_at', { ascending: false })
          .limit(6);
        const { data: activities2, error: actErr2 } = await activitiesQuery;
        if (actErr2) throw actErr2;

        const mappedActivities = (activities2 ?? []).map((a: any) => ({
          activity: a.title as string,
          time: formatDistanceToNow(new Date(a.created_at), { addSuffix: true }),
          type: (a.status as string) ?? 'update',
        }));
        setRecentActivities(mappedActivities);
      } catch (_) {
        // keep defaults on error
      }
    };
    void loadProjectsAndActivities();
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Architectural & Civil Engineering Dashboard</h1>
              <p className="opacity-90">Welcome back, {profile?.full_name}. Manage architectural design projects and civil engineering solutions.</p>
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

        {/* Actionable cards: 2 per row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ClipboardCheck size={20} />
              <span>Service Tickets</span>
            </CardTitle>
            <CardDescription>Track and resolve internal and client service requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="default" size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-colors" onClick={handleNavigateServiceTickets}>
              Access
            </Button>
          </CardContent>
        </Card>

        {/* Check Submitted Tasks for Heads */}
        <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ClipboardCheck size={20} />
              <span>Check Submitted Tasks</span>
            </CardTitle>
            <CardDescription>Review employee task reports, verify and forward to HR.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-auto" onClick={() => navigate('/portal/head/reports')}>
              Open
            </Button>
          </CardContent>
        </Card>

        {/* Consultancy Requests (actionable) */}
        <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings size={20} />
              <span>Consultancy Requests</span>
            </CardTitle>
            <CardDescription>Review client consultancy requests and schedule sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-auto" onClick={() => navigate('/portal/consultancy/architectural')}>
              Open
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default ArchitecturalDashboard;
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TestTube, 
  FileCheck, 
  Calendar, 
  Award, 
  AlertTriangle,
  BarChart3,
  FileText,
  Users,
  Settings,
  ClipboardCheck,
  Home
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchDepartmentHeadId } from '@/lib/portalRequests';

const MaterialTestingDashboard = () => {
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
    { title: 'In Progress Tickets', value: String(statsData.inProgressTickets), icon: BarChart3, color: 'text-accent' },
    { title: 'Tasks', value: String(statsData.activeTickets), icon: AlertTriangle, color: 'text-accent' },
  ];

  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        const dept = 'Material Testing';
        // Consultancy requested (excluding cancelled)
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
    { title: 'Test Request Management', description: 'Register and track material test requests from departments and clients', icon: TestTube },
    { title: 'Laboratory Testing', description: 'Record and manage concrete, steel, soil, and aggregate test results', icon: FileCheck },
    { title: 'Quality Certificates', description: 'Generate automated test certificates and compliance reports', icon: Award },
    { title: 'Equipment Management', description: 'Maintain equipment calibration and inspection logs', icon: Settings },
    { title: 'Inspection Scheduling', description: 'Manage site and laboratory inspection schedules', icon: Calendar },
    { title: 'Client Reports', description: 'Provide secure access to test reports via client portal', icon: FileText },
  ];

  const handleNavigateServiceTickets = () => {
    navigate('/portal/material-testing/service-tickets');
  };
  const [testRequests, setTestRequests] = useState<Array<{ id: string; title: string; status: string; priority: string }>>([]);

  useEffect(() => {
    const loadTestRequests = async () => {
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, title, status, priority, created_at')
        .eq('service_type', 'Material Testing')
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(2);
      if (!error) {
        setTestRequests((data ?? []).map((r: any) => ({
          id: r.id,
          title: r.title ?? 'Untitled request',
          status: r.status ?? 'pending',
          priority: r.priority ?? 'low',
        })));
      }
    };
    void loadTestRequests();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-success';
      case 'in_progress': return 'text-info';
      case 'approved': return 'text-accent';
      case 'reviewing': return 'text-warning';
      case 'pending': return 'text-muted-foreground';
      case 'rejected': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Material Testing & Inspection</h1>
              <p className="opacity-90">
                Welcome back, {profile?.full_name}. Manage material testing, quality assurance, and compliance certification.
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
          {quickActions.map((action, index) => {
            const idx = index % 3;
            const borderHover = idx === 0 ? "hover:border-primary/50" : idx === 1 ? "hover:border-accent/50" : "hover:border-success/50";
            const iconColor = idx === 0 ? "text-primary" : idx === 1 ? "text-accent" : "text-success";
            const iconBg = idx === 0 ? "bg-primary/10" : idx === 1 ? "bg-accent/10" : "bg-success/10";
            const barFrom = idx === 0 ? "from-primary/60" : idx === 1 ? "from-accent/60" : "from-success/60";
            const barTo = idx === 0 ? "to-accent/60" : idx === 1 ? "to-success/60" : "to-primary/60";
            return (
              <Card
                key={index}
                className={`shadow-card border-card-border ${borderHover} hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 group`}
              >
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} ${iconColor} group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-colors`}>
                      <action.icon size={20} />
                    </div>
                    <CardTitle className="text-lg text-foreground group-hover:text-foreground">{action.title}</CardTitle>
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
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-colors"
              onClick={() => navigate('/portal/consultancy/material-testing')}
            >
              Open
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
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-colors"
              onClick={() => navigate('/portal/head/reports')}
            >
              Open
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default MaterialTestingDashboard;
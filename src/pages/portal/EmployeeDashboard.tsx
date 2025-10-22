import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, 
  FolderOpen, 
  Calendar, 
  MessageSquare, 
  FileText,
  Clock,
  User,
  Bell,
  Loader2,
  Home
} from 'lucide-react';
import type { ServiceRequestRow, ConsultancyRequestRow, InterviewScheduleLog } from '@/lib/portalRequests';
import { fetchServiceRequestsAssignedTo, fetchConsultancyRequestsForEmployee, fetchInterviewSchedulesForEmployee } from '@/lib/portalRequests';

const EmployeeDashboard = () => {
  const { profile, token } = useAuth();
  const navigate = useNavigate();

  const [myRequests, setMyRequests] = useState<ServiceRequestRow[]>([]);
  const [myConsultancy, setMyConsultancy] = useState<ConsultancyRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [interviews, setInterviews] = useState<InterviewScheduleLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadAssigned = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Assigned service requests
      const data = await fetchServiceRequestsAssignedTo(profile.id, 50);
      setMyRequests(data);
      // Consultancy sessions assigned to this employee
      const cons = await fetchConsultancyRequestsForEmployee(profile.id, 50, token);
      setMyConsultancy(cons);
      // Interview schedules where this employee is the interviewer (by email) — prefer Edge Function via token
      if (profile.email) {
        const ints = await fetchInterviewSchedulesForEmployee(profile.email, 50, token);
        setInterviews(ints);
      } else {
        setInterviews([]);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load your tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const stats = useMemo(() => {
    const openTickets = myRequests.filter(r => !['completed','resolved','verified'].includes((r.status ?? '').toLowerCase())).length;
    const scheduledSoon = myConsultancy.filter(c => !!c.schedule_at).length + interviews.length;
    return [
      { title: 'My Tasks', value: String(myRequests.length), icon: CheckSquare, color: 'text-primary' },
      { title: 'Consultancy Sessions', value: String(myConsultancy.length), icon: Calendar, color: 'text-success' },
      { title: 'Interviews', value: String(interviews.length), icon: Calendar, color: 'text-accent' },
      { title: 'Open Tickets', value: String(openTickets), icon: FileText, color: 'text-accent' },
      { title: 'Scheduled Items', value: String(scheduledSoon), icon: Clock, color: 'text-warning' },
    ];
  }, [myRequests.length, myConsultancy.length, interviews.length]);

  const isToday = (iso: string | null | undefined) => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const todaysItems = useMemo(() => {
    const fromConsultancy = myConsultancy
      .filter(c => isToday(c.schedule_at))
      .map(c => ({
        id: c.id,
        title: c.title,
        kind: 'Consultancy' as const,
        when: c.schedule_at!,
        badgeA: c.department,
        badgeB: c.status,
      }));
    const fromInterviews = interviews
      .filter(iv => isToday(iv.scheduled_for))
      .map(iv => ({
        id: iv.id,
        title: `${iv.position} • ${iv.applicant_name}`,
        kind: 'Interview' as const,
        when: iv.scheduled_for,
        badgeA: 'Interview',
        badgeB: iv.location,
      }));
    const fromTasks = myRequests
      .filter(r => isToday(r.created_at))
      .map(r => ({
        id: r.id,
        title: r.title,
        kind: 'Task' as const,
        when: r.created_at,
        badgeA: r.service_type,
        badgeB: r.priority ?? '#',
      }));
    return [...fromConsultancy, ...fromInterviews, ...fromTasks]
      .sort((a, b) => +new Date(b.when) - +new Date(a.when))
      .slice(0, 6);
  }, [myConsultancy, myRequests, interviews]);

  const recentNotifications = useMemo(() => {
    const cons = myConsultancy.map(c => ({
      id: c.id,
      message: `Consultancy scheduled: ${c.title}`,
      type: 'Consultancy',
      time: c.schedule_at ?? c.updated_at,
    }));
    const ints = interviews.map(iv => ({
      id: iv.id,
      message: `Interview scheduled: ${iv.position} with ${iv.applicant_name}`,
      type: 'Interview',
      time: iv.scheduled_for,
    }));
    const tasks = myRequests.map(r => ({
      id: r.id,
      message: `Task assigned: ${r.title}`,
      type: 'Task',
      time: r.created_at,
    }));
    return [...cons, ...ints, ...tasks]
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .slice(0, 8);
  }, [myConsultancy, myRequests, interviews]);

  const quickActions = [
    { title: 'My Tasks', description: 'View and update assigned tasks', icon: CheckSquare },
    { title: 'Prepare Report', description: 'Submit a task report to your department head', icon: FolderOpen },
    { title: 'Schedule', description: 'View meetings, deadlines and assigned tickets timeline', icon: Calendar },
  ];

  const handleOpen = (title: string) => {
    switch (title) {
      case 'My Tasks':
        navigate('/portal/employee/tasks');
        break;
      case 'Schedule':
        navigate('/portal/employee/schedule');
        break;
      case 'Prepare Report':
        navigate('/portal/employee/prepare-report');
        break;
      default:
        navigate('/portal/employee/tasks');
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Employee Dashboard</h1>
              <p className="opacity-90">Welcome back, {profile?.full_name}. Here's your work overview.</p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {quickActions.map((action, index) => (
            <Card key={index} className="shadow-card border-card-border hover:shadow-elevated transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <action.icon size={20} className="text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {action.description}
                </CardDescription>
                {action.title === 'My Tasks' && (
                  <div className="mb-4 space-y-2">
                    {error ? (
                      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>
                    ) : null}
                    {loading ? (
                      <div className="flex items-center text-muted-foreground text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading…</div>
                    ) : myRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tasks yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {myRequests.slice(0, 3).map((req) => (
                          <div key={req.id} className="p-2 border border-border rounded-md">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-medium text-foreground line-clamp-1">{req.title}</h4>
                                <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                              </div>
                              <div className="flex gap-1">
                                <Badge variant="outline" className="uppercase">{req.service_type}</Badge>
                                <Badge variant="secondary">{req.priority ?? '#'}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpen(action.title)}>
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
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


        {/* Today's Tasks and Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckSquare size={20} />
                <span>Today's Tasks</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center text-muted-foreground text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading…</div>
                ) : todaysItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing scheduled or assigned today.</p>
                ) : (
                  todaysItems.map((it) => (
                    <div key={it.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-foreground">{it.title}</h4>
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{it.kind}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="uppercase">{it.badgeA}</span>
                        <span>{formatDistanceToNow(new Date(it.when), { addSuffix: true })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell size={20} />
                <span>Recent Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center text-muted-foreground text-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading…</div>
                ) : recentNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                  recentNotifications.map((n) => (
                    <div key={n.id} className="flex items-start space-x-3 py-2 border-b border-border last:border-0">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{n.message}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">{n.type}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.time), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
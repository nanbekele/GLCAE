import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  Thermometer,
  Zap,
  Droplets,
  Shield,
  AlertTriangle,
  FileText,
  Users,
  BarChart3,
  Settings,
  Power,
  Lightbulb,
  Activity,
  ClipboardCheck,
  Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchDepartmentHeadId } from "@/lib/portalRequests";

type QuickAction = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type ProjectStatus = {
  name: string;
  system: string;
  status: string;
  progress: number;
};

type AlertItem = {
  system: string;
  issue: string;
  priority: string;
  time: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "MEP Design Projects",
    description: "Manage mechanical, electrical, and plumbing design projects",
    icon: Wrench,
  },
  {
    title: "HVAC Solutions",
    description: "Design and manage heating, ventilation, and air conditioning systems",
    icon: Thermometer,
  },
  {
    title: "Power System Design",
    description: "Design electrical power distribution and transmission systems",
    icon: Power,
  },
  {
    title: "Process Control",
    description: "Develop automated control and monitoring systems",
    icon: Activity,
  },
  {
    title: "Safety & Compliance",
    description: "Plan fire protection and electrical safety programs",
    icon: Shield,
  },
  {
    title: "Technical Documentation",
    description: "Generate technical drawings, reports, and specifications",
    icon: FileText,
  },
  {
    title: "Service Tickets",
    description: "Track and resolve internal and client service requests",
    icon: Settings,
  },
];

type TeamRow = { label: string; count: number };

// Dynamic stats populated from Supabase
const useMechanicalStats = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    consultancyRequested: 0,
    submittedTasks: 0,
    inProgressTickets: 0,
    activeTickets: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dept = "Mechanical";
        const { count: consultancyCount } = await supabase
          .from("consultancyrequest")
          .select("id", { count: "exact", head: true })
          .eq("department", dept)
          .neq("status", "cancelled");

        const { count: inProgress } = await supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("service_type", dept)
          .eq("status", "in_progress");

        const { count: openTickets } = await supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("service_type", dept)
          .not("title", "ilike", "Report:%")
          .not("status", "in", "(completed,resolved,verified)");

        const { count: openConsultancy } = await supabase
          .from("consultancyrequest")
          .select("id", { count: "exact", head: true })
          .eq("department", dept)
          .not("status", "in", "(completed,cancelled)");

        const activeTickets = (openTickets ?? 0) + (openConsultancy ?? 0);

        let submittedTasks = 0;
        try {
          const headId = await fetchDepartmentHeadId(dept);
          if (headId) {
            const { count } = await supabase
              .from("service_requests")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", headId)
              .eq("service_type", dept)
              .ilike("title", "Report:%");
            submittedTasks = count ?? 0;
          }
        } catch {}

        setData({
          consultancyRequested: consultancyCount ?? 0,
          submittedTasks,
          inProgressTickets: inProgress ?? 0,
          activeTickets,
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return { loading, data };
};

// Dynamic sections
const useMechanicalData = () => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectStatus[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [capacityMetrics, setCapacityMetrics] = useState<
    { label: string; value: string; description: string }[]
  >([]);
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Resolve department IDs
        const { data: depts } = await supabase
          .from("departments")
          .select("id, slug, name")
          .in("slug", ["mechanical", "electrical"]);

        const mech = depts?.find((d: any) => d.slug === "mechanical");
        const elec = depts?.find((d: any) => d.slug === "electrical");
        const deptIds = [mech?.id, elec?.id].filter(Boolean);

        // Projects: latest across Mechanical/Electrical
        let pQuery = supabase
          .from("projects")
          .select("id, title, status, start_date, end_date, department_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(6);
        if (deptIds.length > 0) pQuery = pQuery.in("department_id", deptIds as string[]);
        const { data: pRows } = await pQuery;

        const now = new Date();
        const projMapped = (pRows ?? []).map((p: any) => {
          let progress = 0;
          if (p.start_date && p.end_date) {
            const s = new Date(p.start_date);
            const e = new Date(p.end_date);
            if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e > s) {
              const ratio = (now.getTime() - s.getTime()) / (e.getTime() - s.getTime());
              progress = Math.max(0, Math.min(1, ratio)) * 100;
            }
          } else if (typeof p.status === "string" && p.status.toLowerCase() === "completed") {
            progress = 100;
          }
          const system = p.department_id === mech?.id ? "Mechanical" : p.department_id === elec?.id ? "Electrical" : "MEP";
          return {
            name: p.title as string,
            system,
            status: (p.status as string) ?? "—",
            progress: Math.round(progress),
          } as ProjectStatus;
        });
        setProjects(projMapped);

        // Alerts: high/urgent recent service requests for Mechanical/Electrical
        const { data: aRows } = await supabase
          .from("service_requests")
          .select("id, title, priority, created_at, service_type")
          .in("service_type", ["Mechanical", "Electrical"])
          .in("priority", ["high", "urgent"]) // match policy values
          .order("created_at", { ascending: false })
          .limit(6);

        const alertsMapped: AlertItem[] = (aRows ?? []).map((row: any) => ({
          system: row.service_type ?? "System",
          issue: row.title ?? "",
          priority: String(row.priority ?? "medium").replace(/\b\w/g, (m: string) => m.toUpperCase()),
          time: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
        }));
        setAlerts(alertsMapped);

        // Capacity metrics: aggregates across service_requests
        const [totalOpenRes, inProgRes, highPrioRes, completed30Res] = await Promise.all([
          supabase
            .from("service_requests")
            .select("id", { count: "exact", head: true })
            .in("service_type", ["Mechanical", "Electrical"]) 
            .in("status", ["pending", "reviewing", "approved", "in_progress"]),
          supabase
            .from("service_requests")
            .select("id", { count: "exact", head: true })
            .in("service_type", ["Mechanical", "Electrical"]) 
            .eq("status", "in_progress"),
          supabase
            .from("service_requests")
            .select("id", { count: "exact", head: true })
            .in("service_type", ["Mechanical", "Electrical"]) 
            .in("priority", ["high", "urgent"]) 
            .in("status", ["pending", "reviewing", "approved", "in_progress"]),
          supabase
            .from("service_requests")
            .select("id", { count: "exact", head: true })
            .in("service_type", ["Mechanical", "Electrical"]) 
            .eq("status", "completed"),
        ]);

        setCapacityMetrics([
          { label: "Open Tickets", value: String(totalOpenRes.count ?? 0), description: "Pending, reviewing, approved, or in progress" },
          { label: "In Progress", value: String(inProgRes.count ?? 0), description: "Active work items" },
          { label: "High Priority", value: String(highPrioRes.count ?? 0), description: "High/urgent open items" },
          { label: "Completed", value: String(completed30Res.count ?? 0), description: "Completed requests (total)" },
        ]);

        // Team overview counts
        const [mechCountRes, elecCountRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "employee").ilike("department", "Mechanical%"),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "employee").ilike("department", "Electrical%"),
        ]);

        const rows: TeamRow[] = [];
        rows.push({ label: "Mechanical Team", count: mechCountRes.count ?? 0 });
        rows.push({ label: "Electrical Team", count: elecCountRes.count ?? 0 });
        setTeamRows(rows.filter((r) => (r.count ?? 0) >= 0));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return { loading, projects, alerts, capacityMetrics, teamRows };
};

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case "high":
      return "text-destructive";
    case "medium":
      return "text-accent";
    case "low":
      return "text-success";
    default:
      return "text-muted-foreground";
  }
};

const ElectroMechanicalDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const infoActions = useMemo(() => QUICK_ACTIONS.filter((a) => a.title !== "Service Tickets"), []);
  const { data: statsData } = useMechanicalStats();
  const { projects, alerts, capacityMetrics } = useMechanicalData();
  const stats = [
    { title: "Consultancy Requested", value: String(statsData.consultancyRequested), icon: Settings, color: "text-primary" },
    { title: "Submitted Tasks", value: String(statsData.submittedTasks), icon: ClipboardCheck, color: "text-success" },
    { title: "In Progress Tickets", value: String(statsData.inProgressTickets), icon: Activity, color: "text-accent" },
    { title: "Tasks", value: String(statsData.activeTickets), icon: AlertTriangle, color: "text-accent" },
  ];

  return (
    <div className="min-h-screen bg-muted/30 p-6 animate-fade-in">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold">Electro-Mechanical Engineering</h1>
              <p className="opacity-90">
                Welcome back, {profile?.full_name}. Manage integrated mechanical and electrical operations from a unified workspace.
              </p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="border-card-border shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary ${stat.color}`}>
                    <stat.icon size={24} className="text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-success">Our Responsibility</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {infoActions.map((action, index) => {
              const idx = index % 3;
              const borderHover = idx === 0 ? "hover:border-primary/50" : idx === 1 ? "hover:border-accent/50" : "hover:border-success/50";
              const iconColor = idx === 0 ? "text-primary" : idx === 1 ? "text-accent" : "text-success";
              const iconBg = idx === 0 ? "bg-primary/10" : idx === 1 ? "bg-accent/10" : "bg-success/10";
              const barFrom = idx === 0 ? "from-primary/60" : idx === 1 ? "from-accent/60" : "from-success/60";
              const barTo = idx === 0 ? "to-accent/60" : idx === 1 ? "to-success/60" : "to-primary/60";
              return (
                <Card key={action.title} className={`h-full border-card-border shadow-card ${borderHover} hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 group`}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg ${iconBg} ${iconColor} p-2`}> 
                        <action.icon size={18} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{action.title}</CardTitle>
                        <CardDescription>{action.description}</CardDescription>
                      </div>
                    </div>
                    <div className={`h-1 w-24 rounded-full bg-gradient-to-r ${barFrom} ${barTo}`}></div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* Actionable cards: 2 per row */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings size={20} />
                  <span>Service Tickets</span>
                </CardTitle>
                <CardDescription>Track and resolve internal and client service requests.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-colors"
                  onClick={() => navigate("/portal/mechanical/service-tickets")}
                >
                  Access
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                  onClick={() => navigate("/portal/head/reports")}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
            <Card className="shadow-card border-card-border hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                  onClick={() => navigate("/portal/consultancy/mechanical")}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {capacityMetrics.length > 0 ? (
          <Card className="border-card-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 size={20} />
                Capacity Metrics
              </CardTitle>
              <CardDescription>Energy and mechanical utilization indicators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {capacityMetrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{metric.label}</h3>
                      <p className="text-xs text-muted-foreground">{metric.description}</p>
                    </div>
                    <span className="text-sm font-medium text-primary">{metric.value}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          ) : null}

          
        </div>
      </div>
    </div>
  );
};

export default ElectroMechanicalDashboard;
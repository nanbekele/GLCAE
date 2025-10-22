import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { FileText, UserPlus, Calendar, ClipboardList, RefreshCw } from "lucide-react";

type SectionKey = "users" | "projects" | "posts" | "messages" | "jobs" | "applications";

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  { key: "users", title: "Users / Staff", description: "Registered staff accounts and roles" },
  { key: "projects", title: "Projects", description: "Marketing projects with media" },
  { key: "posts", title: "News Posts", description: "All news posts with status and category" },
  { key: "messages", title: "Contact Messages", description: "Customer inquiries received" },
  { key: "jobs", title: "Job Postings", description: "Current job postings and status" },
  { key: "applications", title: "Applications", description: "Job applications and status" },
];

const AdminAnalytics: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SectionKey[]>(["users", "projects", "posts"]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState({
    jobCount: 0,
    applicationsToday: 0,
    interviewsScheduled: 0,
    offersPending: 0,
  });

  const fetchStats = async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const response = await callFunction<{
        jobCount: number;
        applicationsToday: number;
        interviewsScheduled: number;
        offersPending: number;
      }>("marketing-manage", { action: "get-dashboard" }, { token });
      if (response) {
        setStats({
          jobCount: response.jobCount ?? 0,
          applicationsToday: response.applicationsToday ?? 0,
          interviewsScheduled: response.interviewsScheduled ?? 0,
          offersPending: response.offersPending ?? 0,
        });
      }
    } catch (error: any) {
      toast({ title: "Failed to load metrics", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, [token]);

  const statCards = useMemo(
    () => [
      { title: "Open Positions", value: stats.jobCount, icon: FileText },
      { title: "Applications Today", value: stats.applicationsToday, icon: UserPlus },
      { title: "Interviews Scheduled", value: stats.interviewsScheduled, icon: Calendar },
      { title: "Offers Pending", value: stats.offersPending, icon: ClipboardList },
    ],
    [stats]
  );

  const toggle = (key: SectionKey) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const selectAll = () => setSelected(SECTIONS.map((s) => s.key));
  const clearAll = () => setSelected([]);

  const generateReport = async () => {
    if (!token) return;
    if (selected.length === 0) {
      toast({ title: "Select data", description: "Choose at least one dataset to include." });
      return;
    }

    // Confirm before generating
    const selectedTitles = SECTIONS.filter((s) => selected.includes(s.key))
      .map((s) => s.title)
      .join(", ");
    const confirmed = window.confirm(
      `Are you sure you want to generate a report for the selected list?\n\n${selectedTitles}`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      // Build fetches based on selection
      const tasks: PromiseLike<any>[] = [];

      const wants = (k: SectionKey) => selected.includes(k);

      if (wants("users")) {
        tasks.push(
          callFunction<{ staff?: any[] }>("marketing-manage", { action: "hr-list-staff" }, { token })
        );
      } else tasks.push(Promise.resolve(null));

      if (wants("projects")) {
        tasks.push(
          callFunction<{ projects?: any[] }>("marketing-manage", { action: "list-projects" }, { token })
        );
      } else tasks.push(Promise.resolve(null));

      if (wants("posts")) {
        tasks.push(
          callFunction<{ posts?: any[] }>("marketing-manage", { action: "list-posts" }, { token })
        );
      } else tasks.push(Promise.resolve(null));

      if (wants("messages")) {
        tasks.push(
          callFunction<{ messages?: any[] }>("marketing-manage", { action: "list-messages" }, { token })
        );
      } else tasks.push(Promise.resolve(null));

      if (wants("jobs")) {
        tasks.push(
          callFunction<{ success?: boolean; jobs?: any[] }>("marketing-manage", { action: "hr-list-jobs" }, { token })
        );
      } else tasks.push(Promise.resolve(null));

      if (wants("applications")) {
        tasks.push(
          supabase
            .from("applications")
            .select(
              // Join jobs to get the job title; applications has no 'position' column
              "id,name,email,status,created_at, job:jobs!applications_job_id_fkey(title)"
            )
        );
      } else tasks.push(Promise.resolve(null));

      const [staffRes, projectsRes, postsRes, messagesRes, jobsRes, appsRes] = await Promise.all(tasks);

      // CSV builder
      const rows: string[][] = [];
      const pushBlank = () => rows.push([""]);
      const escape = (v: string) => (v ?? "").toString().replace(/"/g, '""');

      const addSection = (title: string, header: string[], data: (string | number | null | undefined)[][]) => {
        rows.push([title]);
        rows.push(header);
        if (!data || data.length === 0) {
          rows.push(["No records", ...Array(Math.max(0, header.length - 1)).fill("")]);
        } else {
          data.forEach((r) => rows.push(r.map((x) => `"${escape(String(x ?? ""))}"`)));
        }
        pushBlank();
      };

      if (wants("users")) {
        const staff = (staffRes?.staff ?? []) as any[];
        addSection(
          "Users / Staff",
          ["Name", "Email", "Role", "Department", "Activated"],
          staff.map((m) => [m.full_name, m.email, m.role, m.department, m.is_activated ? "Yes" : "No"])
        );
      }

      if (wants("projects")) {
        const projects = (projectsRes?.projects ?? []) as any[];
        addSection(
          "Projects",
          ["Title", "Type", "Status", "Slug", "Created"],
          projects.map((p) => [p.title, p.mediaType ?? p.type ?? "", p.status ?? "", p.slug ?? "", p.createdAt ?? ""])
        );
      }

      if (wants("posts")) {
        const posts = (postsRes?.posts ?? []) as any[];
        addSection(
          "News Posts",
          ["Title", "Status", "Category", "Slug", "Created"],
          posts.map((p) => [p.title, p.status, p.categoryLabel ?? p.category ?? "", p.slug, p.createdAt ?? p.created_at ?? ""])
        );
      }

      if (wants("messages")) {
        const messages = (messagesRes?.messages ?? []) as any[];
        addSection(
          "Contact Messages",
          ["From", "Email", "Subject", "Status", "Created"],
          messages.map((m) => [m.name, m.email, m.subject, m.status ?? "", m.created_at ?? ""])
        );
      }

      if (wants("jobs")) {
        const jobs = (jobsRes?.jobs ?? []) as any[];
        addSection(
          "Job Postings",
          ["Title", "Status", "Posted At"],
          jobs.map((j) => [j.title, j.status, j.posted_at ?? ""])
        );
      }

      if (wants("applications")) {
        if (appsRes?.error) throw appsRes.error;
        const apps = (appsRes?.data ?? []) as any[];
        addSection(
          "Applications",
          ["Name", "Email", "Position", "Status", "Applied At"],
          apps.map((a) => [a.name, a.email, a.job?.title ?? "", a.status, a.created_at])
        );
      }

      // Download CSV (multi-section)
      const csv = rows.map((r) => (r.some((c) => c.startsWith('"')) ? r.join(",") : r.map((c) => `"${escape(c)}"`).join(","))).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", `admin-report-${Date.now()}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Report generated", description: "Your CSV report has been downloaded." });
    } catch (error: any) {
      toast({ title: "Failed to generate report", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analytics & Reports</h1>
            <p className="text-muted-foreground">Professional overview and exportable datasets for administrative reporting.</p>
          </div>
          <Button variant="outline" onClick={() => void fetchStats()} disabled={statsLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> {statsLoading ? "Refreshing..." : "Refresh Metrics"}
          </Button>
        </div>

        {/* KPI Header Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s, idx) => (
            <Card key={idx} className="border-card-border shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{s.title}</p>
                    <p className="text-2xl font-bold text-foreground">{statsLoading ? "…" : s.value}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary">
                    <s.icon size={24} className="text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle>Datasets</CardTitle>
            <CardDescription>Choose one or more datasets to include in the Report.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {SECTIONS.map((s) => (
                <label key={s.key} className="flex items-start gap-3">
                  <Checkbox checked={selected.includes(s.key)} onCheckedChange={() => toggle(s.key)} />
                  <div>
                    <div className="font-medium text-foreground">{s.title}</div>
                    <div className="text-sm text-muted-foreground">{s.description}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={selectAll}>Select All</Button>
              <Button type="button" variant="outline" onClick={clearAll}>Clear</Button>
              <Button type="button" onClick={() => void generateReport()} disabled={loading || selected.length === 0}>
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;

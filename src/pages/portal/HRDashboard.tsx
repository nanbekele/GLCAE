import { useState, useEffect, useCallback, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  Calendar,
  TrendingUp,
  UserPlus,
  ClipboardList,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  MoreVertical,
  Inbox,
  MessageCircle,
  Briefcase,
  Share2,
  Home,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceRequestRow, ServiceRequestAttachment } from "@/lib/portalRequests";
import { createClientServiceRequest } from "@/lib/portalRequests";
 
import { AdminHRMessageCenter } from "@/components/portal/AdminHRMessageCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JobSummary {
  id: string;
  title: string;
  status: string;
}

interface RecentApplication {
  name: string;
  position: string;
  status: string;
  date: string;
  appliedAt: string;
}

interface InterviewSchedule {
  time: string;
  candidate: string;
  position: string;
  interviewer: string;
  scheduledFor: string;
}

type StaffProfile = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: string | null;
  is_active: boolean | null;
};

interface StaffMember {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  role: string | null;
  employment_date: string | null;
  is_activated: boolean;
  created_at: string | null;
  updated_at: string | null;
  profile: StaffProfile | null;
}

const applicationStatusBadgeClass = (status: string) => {
  const normalized = status?.toLowerCase().trim();
  switch (normalized) {
    case "new":
    case "submitted":
      return "bg-blue-100 text-blue-800";
    case "reviewing":
    case "in_review":
      return "bg-yellow-100 text-yellow-800";
    case "interview":
    case "interviewing":
      return "bg-purple-100 text-purple-800";
    case "offered":
    case "offer":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-foreground";
  }
};
const HRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, token } = useAuth();
  const { toast } = useToast();

  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobForm, setJobForm] = useState<{
    id: string | null;
    title: string;
    status: string;
  }>({ id: null, title: "", status: "active" });
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [interviewsToday, setInterviewsToday] = useState<InterviewSchedule[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    jobCount: 0,
    applicationsToday: 0,
    interviewsScheduled: 0,
    usersCount: 0,
  });
  const [usersByRole, setUsersByRole] = useState<Record<string, number>>({});
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [showAdminHrMessages, setShowAdminHrMessages] = useState(true);

  // Verified task reports forwarded from department heads
  const [forwardingClientId, setForwardingClientId] = useState<string | null>(null);

  // Helpers for downloading attachments (mirrors ICTServiceTickets)
  const DEFAULT_SERVICE_REQUEST_BUCKET = "service-request-files";
  const inferStorageLocationFromPath = (value?: string | null) => {
    if (!value) return null;
    const sanitized = value.replace(/^\/+/, "");
    if (!sanitized) return null;
    const segments = sanitized.split("/");
    const [first, ...rest] = segments;
    if (!first) return null;
    if (first === DEFAULT_SERVICE_REQUEST_BUCKET) {
      return { bucket: first, objectPath: rest.join("/") } as { bucket: string; objectPath: string };
    }
    if (first === "service-requests") {
      return { bucket: DEFAULT_SERVICE_REQUEST_BUCKET, objectPath: sanitized } as { bucket: string; objectPath: string };
    }
    if (rest.length === 0) return null;
    return { bucket: first, objectPath: rest.join("/") } as { bucket: string; objectPath: string };
  };

  const handleSendToClient = async (req: ServiceRequestRow) => {
    if (!req?.client_id) {
      toast({ title: "Missing client", description: "This report has no client to send to.", variant: "destructive" });
      return;
    }
    setForwardingClientId(req.id);
    try {
      // Prepare attachment copies from either attachment_urls or attachments
      const normalized = normalizeVerifiedAttachments(req);
      const prepared: ServiceRequestAttachment[] = (normalized ?? []).map((a) => ({
        name: a.name,
        url: a.url,
        type: null,
        size: null,
        path: null,
        content: null,
      }));

      // Create a new client-visible copy without altering the original
      await createClientServiceRequest({
        clientId: req.client_id,
        title: req.title || "Report",
        description: req.description || "Forwarded report from HR",
        serviceType: "Client Delivery",
        attachments: prepared,
        token,
      });

      toast({ title: "Sent to client", description: "A copy of the report was forwarded to the original client." });
    } catch (error: any) {
      toast({ title: "Forward failed", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setForwardingClientId(null);
    }
  };

  const parseSupabasePublicUrl = (rawUrl: string) => {
    try {
      const base = new URL(rawUrl, (import.meta as any).env?.VITE_SUPABASE_URL || window.location.origin);
      const segments = base.pathname.split("/").filter(Boolean);
      const objectIndex = segments.findIndex((segment) => segment === "object");
      if (objectIndex === -1) return null;
      const bucket = segments[objectIndex + 2];
      const remainder = segments.slice(objectIndex + 3).join("/");
      if (!bucket || !remainder) return null;
      return { bucket, objectPath: remainder } as { bucket: string; objectPath: string };
    } catch {
      return null;
    }
  };

  const deriveNameFromUrl = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "file";
      return decodeURIComponent(last);
    } catch {
      const parts = String(url).split("/");
      return decodeURIComponent(parts[parts.length - 1] || "file");
    }
  };

  const normalizeVerifiedAttachments = (rowOrValue: any): { name: string; url: string }[] => {
    const pick = (val: any): { name: string; url: string }[] => {
      if (!val && val !== "") return [];
      if (typeof val === "string") {
        const url = val.trim();
        if (!url) return [];
        return [{ name: deriveNameFromUrl(url), url }];
      }
      if (Array.isArray(val)) {
        if (val.every((x) => typeof x === "string")) {
          return (val as string[]).filter(Boolean).map((url) => ({ name: deriveNameFromUrl(url), url }));
        }
        return (val as any[])
          .map((a) => ({ name: a?.name ?? (a?.url ? deriveNameFromUrl(a.url) : "file"), url: a?.url ?? "" }))
          .filter((x) => !!x.url);
      }
      return [];
    };
    if (Array.isArray(rowOrValue) || typeof rowOrValue === "string") return pick(rowOrValue);
    const src = (rowOrValue?.attachment_urls ?? null) || (rowOrValue?.attachments ?? null);
    return pick(src);
  };

  const downloadAttachment = async (attachment: ServiceRequestAttachment, identifier: string) => {
    if (typeof window === "undefined") return;

    const filename = attachment.name ?? (attachment.url ? deriveNameFromUrl(attachment.url) : "service-request-attachment");

    const saveBlob = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const signedFetchToBlob = async (bucket: string, objectPath: string) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60, { download: filename });
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Unable to generate download link");
      const resp = await fetch(data.signedUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      saveBlob(blob);
    };

    try {
      if (attachment.content?.startsWith("data:")) {
        const res = await fetch(attachment.content);
        const blob = await res.blob();
        saveBlob(blob);
        return;
      }

      const pathParts = inferStorageLocationFromPath(attachment.path);
      if (pathParts) {
        try {
          await signedFetchToBlob(pathParts.bucket, pathParts.objectPath);
        } catch (_err) {
          const { data, error } = await supabase.storage
            .from(pathParts.bucket)
            .download(pathParts.objectPath);
          if (error || !data) throw new Error(error?.message ?? "Unable to download file from storage");
          saveBlob(data);
        }
        return;
      }

      if (attachment.url) {
        const publicParts = parseSupabasePublicUrl(attachment.url);
        if (publicParts) {
          try {
            await signedFetchToBlob(publicParts.bucket, publicParts.objectPath);
          } catch (_err) {
            const { data, error } = await supabase.storage
              .from(publicParts.bucket)
              .download(publicParts.objectPath);
            if (error || !data) throw new Error(error?.message ?? "Unable to download file from storage");
            saveBlob(data);
          }
          return;
        }

        // Non-supabase URL fallback
        const resp = await fetch(attachment.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        saveBlob(blob);
        return;
      }

      throw new Error("Attachment does not include downloadable content.");
    } catch (error: any) {
      toast({ title: "Download failed", description: error?.message ?? "Please try again later.", variant: "destructive" });
    }
  };

  const staffRoles = useMemo(
    () => [
      { value: "super_admin", label: "Super Admin" },
      { value: "hr_staff", label: "HR Staff" },
      { value: "architectural_civil_head", label: "Architectural & Civil Head" },
      { value: "mechanical_head", label: "Mechanical Head" },
      { value: "ict_head", label: "ICT Head" },
      { value: "material_testing_head", label: "Material Testing Head" },
      { value: "marketing_communications", label: "Marketing Communications" },
      { value: "employee", label: "Employee" },
    ],
    [],
  );
  const roleLabel = useCallback((role: string) => {
    const found = staffRoles.find((r) => r.value === role);
    return found ? found.label : role;
  }, [staffRoles]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "Interview":
        return "text-accent bg-accent/10 border-accent/20";
      case "Review":
        return "text-primary bg-primary/10 border-primary/20";
      case "Offer":
        return "text-success bg-success/10 border-success/20";
      default:
        return "text-muted-foreground bg-muted border-border";
    }
  }, []);

  const handleManagePortalRequests = useCallback(() => {
    navigate("/portal/hr/portal-requests");
  }, [navigate]);

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      if (!token) {
        throw new Error("Missing HR authentication token. Please sign in again.");
      }

      const response = await callFunction<{ success?: boolean; jobs?: JobSummary[]; error?: string }>(
        "marketing-manage",
        {
          action: "hr-list-jobs",
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      if (!response?.success) {
        throw new Error(response?.error ?? "Failed to load jobs");
      }

      setJobs(response.jobs ?? []);
    } catch (error: any) {
      console.error("[HRDashboard] Failed to fetch jobs", error);
      toast({
        title: "Failed to load jobs",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  }, [toast, token]);

  const handleSaveJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jobForm.id) {
      toast({
        title: "No job selected",
        description: "Choose a job to edit first.",
        variant: "destructive",
      });
      return;
    }

    const trimmedTitle = jobForm.title.trim();
    if (!trimmedTitle) {
      toast({
        title: "Missing title",
        description: "Job title cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "No session",
        description: "Please sign in again to manage jobs.",
        variant: "destructive",
      });
      return;
    }

    setJobSubmitting(true);
    try {
      const response = await callFunction<{ success?: boolean; job?: JobSummary; error?: string }>(
        "marketing-manage",
        {
          action: "hr-update-job",
          jobId: jobForm.id,
          title: trimmedTitle,
          status: jobForm.status,
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      if (!response?.success) {
        throw new Error(response?.error ?? "Failed to save job changes");
      }

      await fetchJobs();

      toast({
        title: "Job updated",
        description: "Job details saved successfully.",
      });

      setJobForm({ id: null, title: "", status: "active" });
    } catch (error: any) {
      console.error("[HRDashboard] Failed to update job", error);
      toast({
        title: "Failed to save job",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setJobSubmitting(false);
    }
  };

  const handleDeleteJob = async (job: JobSummary) => {
    if (!job?.id) return;

    const confirmed = window.confirm(`Delete the job "${job.title}"? This action cannot be undone.`);
    if (!confirmed) return;

    if (!token) {
      toast({
        title: "No session",
        description: "Please sign in again to manage jobs.",
        variant: "destructive",
      });
      return;
    }

    setJobSubmitting(true);
    try {
      const response = await callFunction<{ success?: boolean; error?: string }>(
        "marketing-manage",
        {
          action: "hr-delete-job",
          jobId: job.id,
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      if (!response?.success) {
        throw new Error(response?.error ?? "Failed to delete job");
      }

      await fetchJobs();

      if (jobForm.id === job.id) {
        setJobForm({ id: null, title: "", status: "active" });
      }

      toast({
        title: "Job deleted",
        description: "The job posting has been removed.",
      });
    } catch (error: any) {
      console.error("[HRDashboard] Failed to delete job", error);
      toast({
        title: "Failed to delete job",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setJobSubmitting(false);
    }
  };

  const hrStats = useMemo(
    () => [
      {
        title: "Open Positions",
        value: dashboardLoading ? "…" : (dashboardStats.jobCount ?? 0).toString(),
        icon: FileText,
      },
      {
        title: "Applications Today",
        value: dashboardLoading ? "…" : (dashboardStats.applicationsToday ?? 0).toString(),
        icon: UserPlus,
      },
      {
        title: "Interviews Scheduled",
        value: dashboardLoading ? "…" : (dashboardStats.interviewsScheduled ?? 0).toString(),
        icon: Calendar,
      },
      {
        title: "Number of Users",
        value: dashboardLoading ? "…" : (dashboardStats.usersCount ?? 0).toString(),
        icon: Users,
      },
    ],
    [jobs, loadingJobs, dashboardStats, dashboardLoading],
  );

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;

    setDashboardLoading(true);
    try {
      const response = await callFunction<{
        jobCount: number;
        applicationsToday: number;
        interviewsScheduled: number;
        usersCount: number;
        usersByRole?: Record<string, number>;
        recentApplications: {
          id: string;
          name: string;
          position: string;
          status: string;
          created_at: string;
          next_interview: string | null;
        }[];
        todaysInterviews: {
          id: string;
          applicant: string;
          position: string;
          scheduled_for: string;
          interviewer: string;
        }[];
      }>(
        "marketing-manage",
        { action: "get-dashboard" },
        {
          token,
          useAnonAuth: false,
        },
      );

      if (response) {
        setDashboardStats({
          jobCount: response.jobCount ?? 0,
          applicationsToday: response.applicationsToday ?? 0,
          interviewsScheduled: response.interviewsScheduled ?? 0,
          usersCount: response.usersCount ?? 0,
        });
        setUsersByRole(response.usersByRole ?? {});

        setRecentApplications(
          (response.recentApplications ?? []).map((application) => ({
            name: application.name,
            position: application.position,
            status: application.status,
            date: formatDistanceToNow(new Date(application.created_at), { addSuffix: true }),
            appliedAt: application.created_at,
          })),
        );

        setInterviewsToday(
          (response.todaysInterviews ?? []).map((interview) => ({
            time: format(new Date(interview.scheduled_for), "p"),
            candidate: interview.applicant,
            position: interview.position,
            interviewer: interview.interviewer,
            scheduledFor: interview.scheduled_for,
          })),
        );
      }
    } catch (error: any) {
      console.error("[HRDashboard] Failed to fetch dashboard data", error);
      toast({
        title: "Failed to load dashboard",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setDashboardLoading(false);
    }
  }, [token, toast, callFunction]);

  useEffect(() => {
    void fetchJobs();
    void fetchDashboardData();
  }, [fetchJobs, fetchDashboardData]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">HR Dashboard</h1>
              <p className="opacity-90">Welcome back, {profile?.full_name}. Manage HR operations and communications.</p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {hrStats.map((stat, index) => (
            <Card key={index} className="border-card-border shadow-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary">
                    <stat.icon size={24} className="text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* User statistics */}
        <div className="mb-8">
          <Card className="border-card-border shadow-card">
            <CardHeader>
              <CardTitle>User statistics</CardTitle>
              <CardDescription>Number of users per role</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(usersByRole).length === 0 ? (
                <p className="text-sm text-muted-foreground">No user stats available.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(usersByRole).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm text-muted-foreground">{roleLabel(role)}</span>
                      <span className="text-lg font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-card-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ClipboardList size={20} />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/post-job")}
              >
                <Briefcase size={16} className="mr-2" />
                Post New Job
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/job-posts")}
              >
                <ClipboardList size={16} className="mr-2" />
                Manage Job Posts
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/applications")}
              >
                <Users size={16} className="mr-2" />
                Review Applications
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/schedule-interview")}
              >
                <Calendar size={16} className="mr-2" />
                Schedule Interview
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/user-management")}
              >
                <ShieldCheck size={16} className="mr-2" />
                User Management
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/generate-report")}
              >
                <FileText size={16} className="mr-2" />
                Generate HR Report
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleManagePortalRequests}
              >
                <Inbox size={16} className="mr-2" />
                Manage Portal Requests
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/support-chat")}
              >
                <MessageCircle size={16} className="mr-2" />
                Support Chat
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => navigate("/portal/hr/verified-tasks")}
              >
                <ClipboardList size={16} className="mr-2" />
                Verified Tasks
              </Button>
            </CardContent>
          </Card>

          <Card className="border-card-border shadow-card lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Admin ↔ HR Messages</CardTitle>
                <CardDescription>Collaborate with the HR team in real time.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdminHrMessages((prev) => !prev)}
              >
                {showAdminHrMessages ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Show
                  </>
                )}
              </Button>
            </CardHeader>
            {showAdminHrMessages ? (
              <CardContent>
                <AdminHRMessageCenter token={token ?? null} actorRole="hr" className="h-full" embedded />
              </CardContent>
            ) : null}
          </Card>

          <Card className="border-card-border shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserPlus size={20} />
                <span>Recent Applications</span>
              </CardTitle>
              <CardDescription>Latest job applications and their current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentApplications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent applications found.</p>
                ) : (
                  recentApplications.map((application, index) => (
                    <div key={index} className="rounded-lg border border-border/60 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-base font-semibold text-foreground">{application.name}</h4>
                          <p className="text-sm text-muted-foreground">{application.position}</p>
                        </div>
                        <Badge className={cn("capitalize", applicationStatusBadgeClass(application.status))}>
                          {application.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                        <span>Applied {application.date}</span>
                        {application.appliedAt ? (
                          <span className="text-xs md:text-sm">
                            Submitted on {format(new Date(application.appliedAt), "PPPp")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>Today's Interview Schedule</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {interviewsToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interviews scheduled for today.</p>
              ) : (
                interviewsToday.map((interview, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-secondary/20 bg-secondary/10 p-3"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                        <Calendar size={20} className="text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{interview.candidate}</h4>
                        <p className="text-sm text-muted-foreground">{interview.position}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{interview.time}</p>
                      <p className="text-xs text-muted-foreground">with {interview.interviewer}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRDashboard;
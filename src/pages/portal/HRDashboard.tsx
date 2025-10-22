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
  Pencil,
  Trash2,
  ShieldCheck,
  MoreVertical,
  Inbox,
  Share2,
  Home,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceRequestRow, ServiceRequestAttachment } from "@/lib/portalRequests";
import { createClientServiceRequest } from "@/lib/portalRequests";
import { PostJobDialog } from "@/components/hr/PostJobDialog";
import { AdminHRMessageCenter } from "@/components/portal/AdminHRMessageCenter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JobSummary {
  id: string;
  title: string;
  status: string;
}

type ReportSectionKey = "summary" | "applications" | "interviews" | "jobs" | "staff";

const REPORT_SECTIONS: { key: ReportSectionKey; title: string; description: string }[] = [
  {
    key: "summary",
    title: "Executive Summary",
    description: "High-level overview of active jobs, applications, interviews, and offers.",
  },
  {
    key: "applications",
    title: "Recent Applications Report",
    description: "Latest candidate submissions with status and submission time.",
  },
  {
    key: "interviews",
    title: "Interview Schedule Report",
    description: "Confirmed interviews scheduled for today with interviewer details.",
  },
  {
    key: "jobs",
    title: "Job Postings Report",
    description: "Current job listings and their publication status.",
  },
  {
    key: "staff",
    title: "Staff Members Report",
    description: "Registered staff accounts with roles, departments, and activation status.",
  },
];

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

interface StaffFormState {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  isActivated: boolean;
  isActive: boolean;
}

const getEmptyStaffForm = (): StaffFormState => ({
  fullName: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  role: "",
  isActivated: true,
  isActive: true,
});

const emptyToNull = (value: string) => (value.trim().length === 0 ? null : value.trim());

const staffStatusBadge = (member: StaffMember) => {
  const badgeClass = member.is_activated ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
  const label = member.is_activated ? "Activated" : "Pending";
  const profileStatus = member.profile?.is_active === false ? "Inactive" : null;

  return (
    <div className="flex flex-col gap-1">
      <Badge className={badgeClass}>{label}</Badge>
      {profileStatus ? <Badge variant="outline">{profileStatus}</Badge> : null}
    </div>
  );
};

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
  const [jobManagerOpen, setJobManagerOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantContacts, setApplicantContacts] = useState<{ email: string; name: string }[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    applicantName: "",
    applicantEmail: "",
    position: "",
    interviewer: "",
    interviewerEmail: "",
    location: "",
    scheduledFor: "",
    notes: "",
  });
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormState>(getEmptyStaffForm());
  const [staffRoleFilter, setStaffRoleFilter] = useState<string | null>(null);

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
  const [selectedReportSections, setSelectedReportSections] = useState<ReportSectionKey[]>(
    () => REPORT_SECTIONS.map((section) => section.key),
  );

  // Verified task reports forwarded from department heads
  const [verifiedReports, setVerifiedReports] = useState<ServiceRequestRow[]>([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false);
  const [verifiedError, setVerifiedError] = useState<string | null>(null);
  const [showVerified, setShowVerified] = useState(false);
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

  const departmentOptions = useMemo(
    () => [
      "Material Testing",
      "Architectural & Civil",
      "ICT",
      "Electro-Mechanical",
    ],
    [],
  );

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

  const fetchApplicantContacts = useCallback(async () => {
    setLoadingApplicants(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("email, name")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const unique = new Map<string, { email: string; name: string }>();
      (data ?? []).forEach((row) => {
        const email = row?.email;
        if (!email) return;

        if (!unique.has(email)) {
          unique.set(email, { email, name: row?.name ?? email });
        }
      });

      setApplicantContacts(Array.from(unique.values()));
    } catch (error: any) {
      console.error("[HRDashboard] Failed to fetch applicant contacts", error);
      toast({
        title: "Failed to load applicants",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingApplicants(false);
    }
  }, [toast]);

  const fetchStaff = useCallback(
    async (showToast = false, role?: string | null) => {
      if (!token) {
        if (showToast) {
          toast({
            title: "No session",
            description: "Please sign in again to manage staff.",
            variant: "destructive",
          });
        }
        return;
      }

      setStaffLoading(true);
      try {
        const response = await callFunction<{ staff?: StaffMember[] }>(
          "marketing-manage",
          {
            action: "hr-list-staff",
            role: role ?? staffRoleFilter ?? undefined,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        setStaff(response?.staff ?? []);
        if (showToast) {
          toast({
            title: "Staff refreshed",
            description: "Latest staff records loaded.",
          });
        }
      } catch (error: any) {
        console.error("[HRDashboard] Failed to fetch staff", error);
        toast({
          title: "Failed to load staff",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setStaffLoading(false);
      }
    },
    [toast, token, staffRoleFilter],
  );

  const handleStaffInputChange = (key: keyof StaffFormState, value: string | boolean) => {
    setStaffForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetStaffForm = () => {
    setActiveStaffId(null);
    setStaffForm(getEmptyStaffForm());
  };

  const handleEditStaff = (member: StaffMember) => {
    setActiveStaffId(member.id);
    setStaffForm({
      fullName: member.full_name ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      department: member.department ?? "",
      position: member.position ?? "",
      role: member.role ?? "",
      isActivated: Boolean(member.is_activated),
      isActive: Boolean(member.profile?.is_active ?? true),
    });
    if (!userManagementOpen) {
      setUserManagementOpen(true);
    }
  };

  const handleDeleteStaff = async (member: StaffMember) => {
    if (!token) {
      toast({
        title: "No session",
        description: "Please sign in again to manage staff.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.full_name ?? member.email}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setStaffSubmitting(true);
    try {
      await callFunction(
        "marketing-manage",
        {
          action: "hr-delete-staff",
          staffId: member.id,
          userId: member.user_id,
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      setStaff((prev) => prev.filter((row) => row.id !== member.id));
      toast({
        title: "Staff removed",
        description: `${member.full_name ?? member.email} deleted successfully.`,
      });

      if (activeStaffId === member.id) {
        handleResetStaffForm();
      }
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message ?? "Unable to remove staff member.",
        variant: "destructive",
      });
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleSubmitStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      toast({
        title: "No session",
        description: "Please sign in again to manage staff.",
        variant: "destructive",
      });
      return;
    }

    if (!staffForm.fullName || !staffForm.email || !staffForm.role) {
      toast({
        title: "Missing fields",
        description: "Full name, email, and role are required.",
        variant: "destructive",
      });
      return;
    }

    setStaffSubmitting(true);

    try {
      if (activeStaffId) {
        const target = staff.find((row) => row.id === activeStaffId);
        await callFunction(
          "marketing-manage",
          {
            action: "hr-update-staff",
            staffId: activeStaffId,
            userId: target?.user_id,
            fullName: staffForm.fullName,
            email: staffForm.email,
            phone: emptyToNull(staffForm.phone),
            department: emptyToNull(staffForm.department),
            position: emptyToNull(staffForm.position),
            role: staffForm.role,
            isActivated: staffForm.isActivated,
            isActive: staffForm.isActive,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        setStaff((prev) =>
          prev.map((row) =>
            row.id === activeStaffId
              ? {
                  ...row,
                  full_name: staffForm.fullName,
                  email: staffForm.email,
                  phone: emptyToNull(staffForm.phone),
                  department: emptyToNull(staffForm.department),
                  position: emptyToNull(staffForm.position),
                  role: staffForm.role,
                  is_activated: staffForm.isActivated,
                  profile: row.profile
                    ? { ...row.profile, is_active: staffForm.isActive }
                    : row.profile,
                }
              : row,
          ),
        );

        toast({
          title: "Staff updated",
          description: `${staffForm.fullName} updated successfully.`,
        });
      } else {
        const response = await callFunction<{ profile?: StaffProfile; password?: string }>(
          "marketing-manage",
          {
            action: "hr-create-staff",
            fullName: staffForm.fullName,
            email: staffForm.email,
            phone: emptyToNull(staffForm.phone),
            role: staffForm.role,
            department: emptyToNull(staffForm.department),
            position: emptyToNull(staffForm.position),
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        await fetchStaff();

        toast({
          title: "Staff registered",
          description:
            response?.password
              ? `${staffForm.fullName} registered. Default password: ${response.password}`
              : `${staffForm.fullName} registered. Password set to firstName@123.`,
        });
      }

      handleResetStaffForm();
    } catch (error: any) {
      toast({
        title: activeStaffId ? "Update failed" : "Registration failed",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleScheduleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !scheduleForm.applicantName ||
      !scheduleForm.applicantEmail ||
      !scheduleForm.position ||
      !scheduleForm.scheduledFor ||
      !scheduleForm.interviewer ||
      !scheduleForm.location ||
      !scheduleForm.interviewerEmail
    ) {
      toast({
        title: "Missing information",
        description: "Please complete all interview details.",
        variant: "destructive",
      });
      return;
    }

    setScheduleSubmitting(true);

    try {
      const scheduledDate = new Date(scheduleForm.scheduledFor);
      if (Number.isNaN(scheduledDate.getTime())) {
        throw new Error("Invalid interview date and time.");
      }

      if (!token) {
        throw new Error("Missing HR authentication token. Please sign in again.");
      }

      const response = await callFunction<{ success?: boolean; error?: string }>(
        "marketing-manage",
        {
          action: "hr-send-interview-schedule",
          applicantName: scheduleForm.applicantName,
          applicantEmail: scheduleForm.applicantEmail,
          position: scheduleForm.position,
          interviewer: scheduleForm.interviewer,
          interviewerEmail: scheduleForm.interviewerEmail,
          location: scheduleForm.location,
          scheduledFor: scheduledDate.toISOString(),
          notes: scheduleForm.notes,
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      if (response?.success === false) {
        throw new Error(response.error || "Failed to send interview email.");
      }

      // Also persist schedule to applicant dashboard logs
      try {
        await supabase.from("interview_schedule_logs").insert({
          applicant_name: scheduleForm.applicantName,
          applicant_email: (scheduleForm.applicantEmail || "").trim().toLowerCase(),
          interviewer: scheduleForm.interviewer,
          interviewer_email: (scheduleForm.interviewerEmail || "").trim().toLowerCase(),
          position: scheduleForm.position,
          scheduled_for: scheduledDate.toISOString(),
          location: scheduleForm.location,
          notes: scheduleForm.notes?.trim() || null,
          organized_by: profile?.email ?? profile?.full_name ?? null,
        });
      } catch (logErr) {
        console.warn("[HRDashboard] Failed to log interview to applicant dashboard", logErr);
      }

      setRecentApplications((prev) => [
        {
          name: scheduleForm.applicantName,
          position: scheduleForm.position,
          status: "Interview Scheduled",
          date: `${scheduledDate.toLocaleString()} · ${scheduleForm.location}`,
          appliedAt: scheduledDate.toISOString(),
        },
        ...prev,
      ]);

      toast({
        title: "Interview scheduled",
        description: `${scheduleForm.applicantName} has been scheduled with ${scheduleForm.interviewer}. Invitations sent.`,
      });

      setScheduleOpen(false);
      setScheduleForm({
        applicantName: "",
        applicantEmail: "",
        position: "",
        interviewer: "",
        interviewerEmail: "",
        location: "",
        scheduledFor: "",
        notes: "",
      });
    } catch (error: any) {
      toast({
        title: "Failed to schedule interview",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const toggleReportSection = (key: ReportSectionKey) => {
    setSelectedReportSections((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key],
    );
  };

  const generateReportCsv = async (sections: ReportSectionKey[]) => {
    setReportGenerating(true);
    try {
      if (!token) {
        throw new Error("Missing HR authentication token. Please sign in again.");
      }

      const [dashboardResponse, staffResponse, jobsResult] = await Promise.all([
        callFunction<{
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
        ),
        callFunction<{ staff?: StaffMember[] }>(
          "marketing-manage",
          { action: "hr-list-staff" },
          {
            token,
            useAnonAuth: false,
          },
        ),
        supabase
          .from("jobs")
          .select("id, title, status, posted_at")
          .order("posted_at", { ascending: false })
          .limit(100),
      ]);

      if (jobsResult.error) {
        throw jobsResult.error;
      }

      const now = new Date();

      const reportDashboard = dashboardResponse ?? {
        jobCount: 0,
        applicationsToday: 0,
        interviewsScheduled: 0,
        usersCount: 0,
        recentApplications: [],
        todaysInterviews: [],
      };

      const reportStaff = staffResponse?.staff ?? [];
      const reportJobs = (jobsResult.data ?? []).map((job) => ({
        id: job.id,
        title: job.title ?? "",
        status: job.status ?? "",
      }));

      const mappedApplications: RecentApplication[] = (reportDashboard.recentApplications ?? []).map(
        (application) => ({
          name: application.name,
          position: application.position,
          status: application.status,
          date: formatDistanceToNow(new Date(application.created_at), { addSuffix: true }),
          appliedAt: application.created_at,
        }),
      );

      const mappedInterviews: InterviewSchedule[] = (reportDashboard.todaysInterviews ?? []).map(
        (interview) => ({
          time: format(new Date(interview.scheduled_for), "p"),
          candidate: interview.applicant,
          position: interview.position,
          interviewer: interview.interviewer,
          scheduledFor: interview.scheduled_for,
        }),
      );

      setDashboardStats({
        jobCount: reportDashboard.jobCount ?? 0,
        applicationsToday: reportDashboard.applicationsToday ?? 0,
        interviewsScheduled: reportDashboard.interviewsScheduled ?? 0,
        usersCount: reportDashboard.usersCount ?? 0,
      });
      setRecentApplications(mappedApplications);
      setInterviewsToday(mappedInterviews);
      setJobs(reportJobs);
      setStaff(reportStaff);

      const escape = (value: string) => value.replace(/"/g, '""');
      const pushBlank = (rows: string[][]) => rows.push([""]);
      const rows: string[][] = [];

      rows.push(["HR Dashboard Report"]);
      rows.push(["Generated At", format(now, "yyyy-MM-dd HH:mm")]);
      rows.push(["Generated By", profile?.full_name ?? profile?.email ?? "Unknown"]);
      pushBlank(rows);

      const activeSections = REPORT_SECTIONS.map((section) => section.key).filter((key) =>
        sections.includes(key),
      );

      activeSections.forEach((sectionKey, index) => {
        switch (sectionKey) {
          case "summary": {
            rows.push(["Summary Metrics"]);
            rows.push(["Active Job Postings", (reportDashboard.jobCount ?? 0).toString()]);
            rows.push(["Applications Today", (reportDashboard.applicationsToday ?? 0).toString()]);
            rows.push([
              "Interviews Scheduled Today",
              (reportDashboard.interviewsScheduled ?? 0).toString(),
            ]);
            rows.push(["Number of Users", (reportDashboard.usersCount ?? 0).toString()]);
            break;
          }
          case "applications": {
            rows.push(["Recent Applications"]);
            rows.push(["Candidate", "Position", "Status", "Applied At", "Relative Time"]);
            if (mappedApplications.length === 0) {
              rows.push(["No recent applications", "", "", "", ""]);
            } else {
              mappedApplications.forEach((application) => {
                rows.push([
                  application.name,
                  application.position,
                  application.status,
                  format(new Date(application.appliedAt), "yyyy-MM-dd HH:mm"),
                  application.date,
                ]);
              });
            }
            break;
          }
          case "interviews": {
            rows.push(["Today's Interview Schedule"]);
            rows.push(["Time", "Candidate", "Position", "Interviewer", "Scheduled At"]);
            if (mappedInterviews.length === 0) {
              rows.push(["No interviews scheduled", "", "", "", ""]);
            } else {
              mappedInterviews.forEach((interview) => {
                rows.push([
                  interview.time,
                  interview.candidate,
                  interview.position,
                  interview.interviewer,
                  format(new Date(interview.scheduledFor), "yyyy-MM-dd HH:mm"),
                ]);
              });
            }
            break;
          }
          case "jobs": {
            rows.push(["Job Postings"]);
            rows.push(["Title", "Status"]);
            if (reportJobs.length === 0) {
              rows.push(["No job postings found", ""]);
            } else {
              reportJobs.forEach((job) => {
                rows.push([job.title, job.status]);
              });
            }
            break;
          }
          case "staff": {
            rows.push(["Registered Staff Members"]);
            rows.push(["Name", "Email", "Role", "Department", "Status"]);
            if (reportStaff.length === 0) {
              rows.push(["No staff records found", "", "", "", ""]);
            } else {
              reportStaff.forEach((member) => {
                rows.push([
                  member.full_name ?? "",
                  member.email ?? "",
                  member.role ?? "",
                  member.department ?? "",
                  member.is_activated ? "Activated" : "Pending",
                ]);
              });
            }
            break;
          }
          default:
            break;
        }

        if (index < activeSections.length - 1) {
          pushBlank(rows);
        }
      });

      const csvContent = rows
        .map((row) => row.map((value) => `"${escape(value)}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `hr-dashboard-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report generated",
        description: "Your HR dashboard report has been downloaded.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate report",
        description: error?.message ?? "An unexpected error occurred while generating the report.",
        variant: "destructive",
      });
    } finally {
      setReportGenerating(false);
    }
  };

  const handleConfirmReportGeneration = async () => {
    if (selectedReportSections.length === 0) {
      toast({
        title: "Select at least one section",
        description: "Please choose one or more report categories before generating the report.",
        variant: "destructive",
      });
      return;
    }

    const titles = REPORT_SECTIONS.filter((s) => selectedReportSections.includes(s.key)).map((s) => s.title).join(", ");
    const confirmed = window.confirm(
      `Are you sure you want to generate the HR report for the selected sections?\n\n${titles}`,
    );
    if (!confirmed) return;

    setReportDialogOpen(false);
    await generateReportCsv([...selectedReportSections]);
  };

  const handleOpenReportDialog = () => {
    setReportDialogOpen(true);
  };

  const handleCancelReportGeneration = () => {
    setReportDialogOpen(false);
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

  const loadVerifiedReports = useCallback(async () => {
      setVerifiedLoading(true);
      setVerifiedError(null);
      try {
        const { data, error } = await supabase
          .from("service_requests")
          .select("*")
          .eq("service_type", "HR Coordination")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        setVerifiedReports((data ?? []) as unknown as ServiceRequestRow[]);
      } catch (e: any) {
      setVerifiedError(e?.message ?? "Failed to load verified tasks.");
    } finally {
      setVerifiedLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    void fetchApplicantContacts();
    void fetchDashboardData();
  }, [fetchJobs, fetchApplicantContacts, fetchDashboardData]);

  // Lazy-load verified tasks when the section is opened
  useEffect(() => {
    if (showVerified && verifiedReports.length === 0 && !verifiedLoading) {
      void loadVerifiedReports();
    }
  }, [showVerified, verifiedReports.length, verifiedLoading, loadVerifiedReports]);

  useEffect(() => {
    if (scheduleOpen) {
      void fetchApplicantContacts();
    }
  }, [scheduleOpen, fetchApplicantContacts]);

  useEffect(() => {
    if (userManagementOpen && staff.length === 0 && !staffLoading) {
      void fetchStaff();
    }
  }, [userManagementOpen, staff.length, staffLoading, fetchStaff]);

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

        {/* Verified Tasks Toggle */}
        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => setShowVerified((v) => !v)}>
            {showVerified ? "Hide Verified Tasks" : "Show Verified Tasks"}
          </Button>
        </div>

        {showVerified ? (
          <div className="mb-8">
            <Card className="border-card-border shadow-card">
              <CardHeader className="flex items-center justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <ClipboardList size={20} />
                    <span>Verified Tasks</span>
                  </CardTitle>
                  <CardDescription>Reports verified by department heads and forwarded to HR.</CardDescription>
                </div>
                <Button variant="secondary" onClick={() => void loadVerifiedReports()} className="bg-white/20 hover:bg-white/30">
                  {verifiedLoading ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Refreshing…</span>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {verifiedError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-4">{verifiedError}</div>
                ) : null}
                {verifiedLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading verified tasks…
                  </div>
                ) : verifiedReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No verified tasks yet.</p>
                ) : (
                  <div className="space-y-3">
                    {verifiedReports.map((req) => {
                      const attachments = normalizeVerifiedAttachments(req as any);
                      return (
                        <div key={req.id} className="p-3 border border-border rounded-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-medium text-foreground">{req.title}</h4>
                              <p className="text-xs text-muted-foreground">Verified · {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                            </div>
                            <Badge variant="outline" className="uppercase">{req.service_type ?? 'HR Coordination'}</Badge>
                          </div>
                          {req.description ? (
                            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{req.description}</p>
                          ) : null}
                          {attachments.length > 0 ? (
                            <div className="mt-3">
                              <h5 className="text-xs font-semibold text-foreground">Attachments</h5>
                              <ul className="mt-1 space-y-1 text-sm">
                                {attachments.map((a, idx) => {
                                  const id = a.url ?? `${req.id}-att-${idx}`;
                                  return (
                                    <li key={id}>
                                      <Button variant="link" className="h-auto p-0" onClick={() => void downloadAttachment({ name: a.name, url: a.url } as any, id)}>
                                        {a.name ? `Download ${a.name}` : 'Download file'}
                                      </Button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                          <div className="mt-3 flex justify-end">
                            <Button size="sm" onClick={() => void handleSendToClient(req)} disabled={forwardingClientId === req.id}>
                              {forwardingClientId === req.id ? (
                                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending…</span>
                              ) : (
                                "Send to Client"
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

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
              <PostJobDialog onJobCreated={fetchJobs} />
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                  setJobManagerOpen(true);
                  void fetchJobs();
                }}
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
              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full justify-start" variant="outline">
                    <Calendar size={16} className="mr-2" />
                    Schedule Interview
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Schedule Interview</DialogTitle>
                    <DialogDescription>
                      Record interview details to keep the team aligned.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleScheduleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="applicantName">Applicant</Label>
                        <Select
                          value={scheduleForm.applicantEmail || undefined}
                          onValueChange={(value) => {
                            const contact = applicantContacts.find((item) => item.email === value);
                            setScheduleForm((prev) => ({
                              ...prev,
                              applicantEmail: value,
                              applicantName: contact?.name ?? prev.applicantName,
                            }));
                          }}
                        >
                          <SelectTrigger id="applicantName">
                            <SelectValue
                              placeholder={
                                loadingApplicants ? "Loading applicants..." : "Select applicant"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {applicantContacts.length === 0 ? (
                              <SelectItem value="__no_applicants__" disabled>
                                {loadingApplicants ? "Loading..." : "No applicants found"}
                              </SelectItem>
                            ) : (
                              applicantContacts.map((contact) => (
                                <SelectItem key={contact.email} value={contact.email}>
                                  {contact.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="position">Position</Label>
                        <Input
                          id="position"
                          value={scheduleForm.position}
                          onChange={(event) =>
                            setScheduleForm((prev) => ({ ...prev, position: event.target.value }))
                          }
                          placeholder="Role"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="applicantEmail">Applicant Email</Label>
                      <Input
                        id="applicantEmail"
                        value={scheduleForm.applicantEmail}
                        placeholder="Select an applicant to auto-fill"
                        readOnly
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="interviewer">Interviewer</Label>
                        <Input
                          id="interviewer"
                          value={scheduleForm.interviewer}
                          onChange={(event) =>
                            setScheduleForm((prev) => ({ ...prev, interviewer: event.target.value }))
                          }
                          placeholder="Interviewer name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="interviewerEmail">Interviewer Email</Label>
                        <Input
                          id="interviewerEmail"
                          type="email"
                          value={scheduleForm.interviewerEmail}
                          onChange={(event) =>
                            setScheduleForm((prev) => ({ ...prev, interviewerEmail: event.target.value }))
                          }
                          placeholder="interviewer@example.com"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="scheduledFor">Date &amp; Time</Label>
                        <Input
                          id="scheduledFor"
                          type="datetime-local"
                          value={scheduleForm.scheduledFor}
                          onChange={(event) =>
                            setScheduleForm((prev) => ({ ...prev, scheduledFor: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={scheduleForm.location}
                          onChange={(event) =>
                            setScheduleForm((prev) => ({ ...prev, location: event.target.value }))
                          }
                          placeholder="Interview location"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        value={scheduleForm.notes}
                        onChange={(event) =>
                          setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                        placeholder="Interview notes or reminders"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={scheduleSubmitting}>
                        {scheduleSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Scheduling...
                          </>
                        ) : (
                          "Save Interview"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog
                open={userManagementOpen}
                onOpenChange={(open) => {
                  setUserManagementOpen(open);
                  if (open) {
                    void fetchStaff(false, staffRoleFilter);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="w-full justify-start" variant="outline">
                    <ShieldCheck size={16} className="mr-2" />
                    User Management
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-20xl w-[100vw] lg:w-[95vw]">
                  <DialogHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <DialogTitle className="flex items-center gap-2">
                          <ShieldCheck size={20} />
                          <span>Manage Staff Accounts</span>
                        </DialogTitle>
                        <DialogDescription>
                          Register new staff members or update existing accounts. Passwords are generated automatically and emailed to the user.
                        </DialogDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="staffRoleFilter" className="text-sm font-medium">
                          Filter by role
                        </Label>
                        <Select
                          value={staffRoleFilter ?? "all"}
                          onValueChange={(value) => {
                            const nextValue = value === "all" ? null : value;
                            setStaffRoleFilter(nextValue);
                            void fetchStaff(true, nextValue);
                          }}
                        >
                          <SelectTrigger id="staffRoleFilter" className="w-48">
                            <SelectValue placeholder="All roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All roles</SelectItem>
                            {staffRoles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-2">
                    <section className="rounded-lg border bg-muted/50 p-4">
                      <h3 className="mb-4 text-lg font-semibold">
                        {activeStaffId ? "Update Staff Member" : "Register Staff Member"}
                      </h3>
                      <form onSubmit={handleSubmitStaff} className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="staffFullName">Full Name</Label>
                          <Input
                            id="staffFullName"
                            value={staffForm.fullName}
                            onChange={(event) => handleStaffInputChange("fullName", event.target.value)}
                            placeholder="Jane Doe"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="staffEmail">Email</Label>
                          <Input
                            id="staffEmail"
                            type="email"
                            value={staffForm.email}
                            onChange={(event) => handleStaffInputChange("email", event.target.value)}
                            placeholder="jane.doe@example.com"
                            required
                            disabled={Boolean(activeStaffId)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="staffRole">Role</Label>
                          <Select
                            value={staffForm.role || undefined}
                            onValueChange={(value) => handleStaffInputChange("role", value)}
                          >
                            <SelectTrigger id="staffRole">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {staffRoles.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="staffPhone">Phone</Label>
                          <Input
                            id="staffPhone"
                            value={staffForm.phone}
                            onChange={(event) => handleStaffInputChange("phone", event.target.value)}
                            placeholder="+251-900-000000"
                          />
                        </div>
                        <div>
                          <Label htmlFor="staffDepartment">Department</Label>
                          <Select
                            value={staffForm.department || undefined}
                            onValueChange={(value) =>
                              handleStaffInputChange("department", value === "__none" ? "" : value)
                            }
                          >
                            <SelectTrigger id="staffDepartment">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">No department</SelectItem>
                              {departmentOptions.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="staffPosition">Position</Label>
                          <Input
                            id="staffPosition"
                            value={staffForm.position}
                            onChange={(event) => handleStaffInputChange("position", event.target.value)}
                            placeholder="e.g. HR Manager"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="staffActivated" className="flex items-center gap-2 text-sm">
                            <input
                              id="staffActivated"
                              type="checkbox"
                              checked={staffForm.isActivated}
                              onChange={(event) => handleStaffInputChange("isActivated", event.target.checked)}
                              className="h-4 w-4"
                              disabled={!activeStaffId}
                            />
                            Activated
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="staffActive" className="flex items-center gap-2 text-sm">
                            <input
                              id="staffActive"
                              type="checkbox"
                              checked={staffForm.isActive}
                              onChange={(event) => handleStaffInputChange("isActive", event.target.checked)}
                              className="h-4 w-4"
                              disabled={!activeStaffId}
                            />
                            Active profile
                          </Label>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2">
                          {activeStaffId && (
                            <Button type="button" variant="outline" onClick={handleResetStaffForm}>
                              Cancel Edit
                            </Button>
                          )}
                          <Button type="submit" disabled={staffSubmitting}>
                            {staffSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {activeStaffId ? "Saving changes..." : "Registering..."}
                              </>
                            ) : activeStaffId ? (
                              "Save Changes"
                            ) : (
                              "Register Staff"
                            )}
                          </Button>
                        </div>
                      </form>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Registered Staff</h3>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => fetchStaff(true, staffRoleFilter)}
                          disabled={staffLoading}
                        >
                          {staffLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Refresh
                        </Button>
                      </div>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staff.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                  {staffLoading ? "Loading staff..." : "No staff members yet."}
                                </TableCell>
                              </TableRow>
                            ) : (
                              staff.map((member) => (
                                <TableRow
                                  key={member.id}
                                  className={cn(activeStaffId === member.id && "bg-muted/50")}
                                >
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{member.full_name ?? member.email}</span>
                                      {member.position && (
                                        <span className="text-xs text-muted-foreground">{member.position}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>{member.role}</TableCell>
                                  <TableCell>{member.department ?? "—"}</TableCell>
                                  <TableCell>{staffStatusBadge(member)}</TableCell>
                                  <TableCell>{member.email}</TableCell>
                                  <TableCell className="space-x-2 text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditStaff(member)}
                                      disabled={staffSubmitting}
                                    >
                                      <Pencil size={16} />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteStaff(member)}
                                      disabled={staffSubmitting}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Passwords are automatically generated and sent via email when a new staff member is registered.
                      </p>
                    </section>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={handleOpenReportDialog}
                  >
                    <FileText size={16} className="mr-2" />
                    Generate HR Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Select Report Sections</DialogTitle>
                    <DialogDescription>
                      Choose the categories to include. You can generate a comprehensive report or focus on
                      specific areas.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {REPORT_SECTIONS.map((section) => (
                      <label
                        key={section.key}
                        className="flex cursor-pointer items-start space-x-3 rounded-lg border border-border/60 p-3 hover:border-primary"
                      >
                        <input
                          type="checkbox"
                          checked={selectedReportSections.includes(section.key)}
                          onChange={() => toggleReportSection(section.key)}
                          className="mt-1 h-4 w-4"
                        />
                        <div>
                          <p className="font-medium text-foreground">{section.title}</p>
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancelReportGeneration} disabled={reportGenerating}>
                      Cancel
                    </Button>
                    <Button onClick={handleConfirmReportGeneration} disabled={reportGenerating}>
                      {reportGenerating ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleManagePortalRequests}
              >
                <Inbox size={16} className="mr-2" />
                Manage Portal Requests
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <AdminHRMessageCenter token={token ?? null} actorRole="hr" className="h-full" />
          </div>

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

        <Dialog
          open={jobManagerOpen}
          onOpenChange={(open) => {
            setJobManagerOpen(open);
            if (open) {
              void fetchJobs();
            } else {
              setJobForm({ id: null, title: "", status: "active" });
            }
          }}
        >
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Manage Job Postings</DialogTitle>
              <DialogDescription>
                Edit titles or statuses, or delete job postings that are no longer needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {loadingJobs ? "Refreshing job list…" : `${jobs.length} jobs loaded.`}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => fetchJobs()} disabled={loadingJobs}>
                  {loadingJobs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          {loadingJobs ? "Loading…" : "No job postings yet."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((job) => (
                        <TableRow key={job.id} className={cn(jobForm.id === job.id && "bg-muted/50")}>
                          <TableCell>{job.title}</TableCell>
                          <TableCell className="capitalize">{job.status}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setJobForm({ id: job.id, title: job.title, status: job.status })}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteJob(job)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {jobForm.id ? (
                <form onSubmit={(event) => handleSaveJob(event)} className="space-y-4 rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Edit Job</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setJobForm({ id: null, title: "", status: "active" })}
                    >
                      Cancel Edit
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="job-manager-title">Title</Label>
                      <Input
                        id="job-manager-title"
                        value={jobForm.title}
                        onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-manager-status">Status</Label>
                      <Select
                        value={jobForm.status}
                        onValueChange={(value) => setJobForm((prev) => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger id="job-manager-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={jobSubmitting}>
                      {jobSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

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
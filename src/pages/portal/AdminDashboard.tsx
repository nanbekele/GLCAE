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
  UserPlus,
  ClipboardList,
  Loader2,
  Pencil,
  Trash2,
  ShieldCheck,
  MoreVertical,
  Mail,
  Image,
  Briefcase,
  TrendingUp,
  Shield,
  Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostJobDialog } from "@/components/hr/PostJobDialog";
import { AdminHRMessageCenter } from "@/components/portal/AdminHRMessageCenter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface AdminPortalAction {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
  roles?: string[];
  disabled?: boolean;
}

const PORTAL_ACCESS_ACTIONS: AdminPortalAction[] = [
  {
    title: "User Management",
    description: "Manage user roles and permissions",
    icon: Users,
    link: "/portal/admin/users",
    roles: ["super_admin"],
  },
  {
    title: "Contact Messages",
    description: "View customer inquiries",
    icon: Mail,
    link: "/portal/marketing/messages",
    roles: ["super_admin", "marketing_communications"],
  },
  {
    title: "Job Applications",
    description: "Review job applications",
    icon: Briefcase,
    link: "/portal/hr/applications",
    roles: ["super_admin", "hr_staff"],
  },
  {
    title: "Gallery Management",
    description: "Manage project gallery",
    icon: Image,
    link: "/portal/marketing/gallery",
    roles: ["super_admin", "marketing_communications"],
  },
  {
    title: "Analytics & Reports",
    description: "View system analytics and reports",
    icon: TrendingUp,
    link: "/portal/admin/analytics",
    roles: ["super_admin"],
  },
];

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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile, token, loading: authLoading, hasRole, getDashboardRoute } = useAuth();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobManagerOpen, setJobManagerOpen] = useState(false);
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [jobForm, setJobForm] = useState<{
    id: string | null;
    title: string;
    status: string;
  }>({ id: null, title: "", status: "active" });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
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

  const departmentOptions = useMemo(
    () => [
      "Material Testing",
      "Architectural & Civil",
      "ICT",
      "Electro-Mechanical",
    ],
    [],
  );

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

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      if (!token) {
        throw new Error("Missing admin authentication token. Please sign in again.");
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
      console.error("[AdminDashboard] Failed to fetch jobs", error);
      toast({
        title: "Failed to load jobs",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  }, [toast, token]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile) {
      navigate("/auth/login", { replace: true });
      return;
    }

    if (!hasRole("super_admin")) {
      navigate(getDashboardRoute(), { replace: true });
    }
  }, [authLoading, profile, hasRole, getDashboardRoute, navigate]);

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
      console.error("[AdminDashboard] Failed to update job", error);
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
      console.error("[AdminDashboard] Failed to delete job", error);
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
      console.error("[AdminDashboard] Failed to fetch applicant contacts", error);
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
        console.error("[AdminDashboard] Failed to fetch staff", error);
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
              ? `${staffForm.fullName} registered. Temporary password emailed (${response.password}).`
              : `${staffForm.fullName} registered and notified by email.`,
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
        throw new Error("Missing admin authentication token. Please sign in again.");
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
      console.error("[AdminDashboard] Failed to fetch dashboard data", error);
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
    if (!token || !hasRole("super_admin")) {
      return;
    }

    void fetchJobs();
    void fetchApplicantContacts();
    void fetchDashboardData();
  }, [token, hasRole, fetchJobs, fetchApplicantContacts, fetchDashboardData]);

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

  const adminStats = useMemo(
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

  const availablePortalActions = useMemo(
    () =>
      PORTAL_ACCESS_ACTIONS.filter((action) =>
        action.roles ? hasRole(action.roles) : true,
      ),
    [hasRole],
  );

  const handlePortalActionClick = useCallback(
    (action: AdminPortalAction) => {
      if (action.disabled) return;

      if (action.link === "/portal/admin/users") {
        setUserManagementOpen(true);
        void fetchStaff(false);
        return;
      }

      navigate(action.link);
    },
    [fetchStaff, navigate],
  );

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasRole("super_admin")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold">Admin Dashboard</h1>
              <p className="opacity-90">Welcome back, {profile?.full_name}. Manage administrative operations and oversight.</p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {adminStats.map((stat, index) => (
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

        {availablePortalActions.length > 0 ? (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">Portal Access</h2>
              <p className="text-sm text-muted-foreground">
                Switch between portal areas according to your permissions.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availablePortalActions.map((action) => (
                <Card
                  key={action.link}
                  className="border-card-border shadow-card transition-shadow hover:shadow-elevated"
                >
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <action.icon size={20} className="text-secondary-foreground" />
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">{action.description}</CardDescription>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={action.disabled}
                      onClick={() => handlePortalActionClick(action)}
                    >
                      {action.disabled ? "Coming Soon" : "Open Portal"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

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
                            placeholder="e.g. Admin Manager"
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
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <AdminHRMessageCenter token={token ?? null} actorRole="admin" canReset className="h-full" />
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

export default AdminDashboard;
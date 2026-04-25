import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";

import { callFunction } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchInterviewSchedulesForHr,
  type InterviewScheduleLog,
} from "@/lib/portalRequests";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { Calendar, ChevronLeft, Loader2 } from "lucide-react";

const emptyScheduleForm = {
  applicationId: "",
  applicantName: "",
  applicantEmail: "",
  position: "",
  interviewer: "",
  interviewerEmail: "",
  location: "",
  scheduledFor: "",
  notes: "",
};

type ApplicantOption = {
  id: string;
  email: string;
  name: string;
  jobId: string;
  jobTitle: string;
};

type JobOption = {
  id: string;
  title: string;
};

type InterviewerOption = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
};

type ScheduleFormState = typeof emptyScheduleForm;

const HRScheduleInterview = () => {
  const navigate = useNavigate();
  const { profile, token } = useAuth();
  const { toast } = useToast();

  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(emptyScheduleForm);
  const [sendApplicantEmail, setSendApplicantEmail] = useState(true);
  const [sendInterviewerEmail, setSendInterviewerEmail] = useState(true);

  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [applicantContacts, setApplicantContacts] = useState<ApplicantOption[]>([]);

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const [loadingInterviewers, setLoadingInterviewers] = useState(false);
  const [interviewerOptions, setInterviewerOptions] = useState<InterviewerOption[]>([]);

  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedules, setSchedules] = useState<InterviewScheduleLog[]>([]);

  const scheduleStatusOptions = useMemo(
    () => [
      { value: "waiting", label: "Waiting" },
      { value: "confirmed", label: "Confirmed" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
    [],
  );

  const formatScheduleStatus = (value?: string | null) => {
    const normalized = (value ?? "waiting").toString().trim().toLowerCase();
    return scheduleStatusOptions.find((opt) => opt.value === normalized)?.label ?? "Waiting";
  };

  const scheduleStatusBadgeVariant = (value?: string | null) => {
    const normalized = (value ?? "waiting").toString().trim().toLowerCase();
    if (normalized === "completed") return "default";
    if (normalized === "confirmed") return "secondary";
    if (normalized === "cancelled") return "destructive";
    return "outline";
  };

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title")
        .eq("status", "active")
        .order("posted_at", { ascending: false });

      if (error) throw error;
      setJobOptions((data ?? []) as JobOption[]);
    } catch (error: any) {
      console.error("[HRScheduleInterview] Failed to fetch jobs", error);
      toast({
        title: "Failed to load jobs",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingJobs(false);
    }
  }, [toast]);

  const fetchApplicantContacts = useCallback(async () => {
    setLoadingApplicants(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("id, email, name, job_id, job:jobs!applications_job_id_fkey(title)")
        .eq("status", "interview")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row?.name ?? row.email,
        jobId: row.job_id,
        jobTitle: row?.job?.title ?? "",
      }));

      setApplicantContacts(mapped as ApplicantOption[]);
    } catch (error: any) {
      console.error("[HRScheduleInterview] Failed to fetch applicant contacts", error);
      toast({
        title: "Failed to load applicants",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingApplicants(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchJobs();
    void fetchApplicantContacts();
  }, [fetchApplicantContacts, fetchJobs]);

  const filteredApplicantContacts = useMemo(() => {
    if (!selectedJobId) return [];
    return applicantContacts.filter((row) => row.jobId === selectedJobId);
  }, [applicantContacts, selectedJobId]);

  const fetchInterviewers = useCallback(async () => {
    setLoadingInterviewers(true);
    try {
      if (!token) {
        throw new Error("Missing HR authentication token. Please sign in again.");
      }

      const response = await callFunction<{ staff?: any[]; success?: boolean; error?: string }>(
        "marketing-manage",
        {
          action: "hr-list-staff",
          role: "employee",
        },
        {
          token,
          useAnonAuth: false,
        },
      );

      const normalized: InterviewerOption[] = (response?.staff ?? [])
        .map((row) => ({
          id: String(row?.id ?? row?.user_id ?? row?.email ?? Math.random()),
          fullName: String(row?.full_name ?? row?.profile?.full_name ?? "").trim(),
          email: String(row?.email ?? row?.profile?.email ?? "").trim(),
          department: row?.department ?? row?.profile?.department ?? null,
        }))
        .filter((row) => Boolean(row.email));

      setInterviewerOptions(normalized);
    } catch (error: any) {
      console.error("[HRScheduleInterview] Failed to fetch interviewers", error);
      toast({
        title: "Failed to load interviewers",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingInterviewers(false);
    }
  }, [toast, token]);

  useEffect(() => {
    void fetchInterviewers();
  }, [fetchInterviewers]);

  const loadSchedules = useCallback(async () => {
    if (!token) return;
    setSchedulesLoading(true);
    try {
      const data = await fetchInterviewSchedulesForHr(50, token);
      setSchedules(data);
    } catch (error: any) {
      console.error("[HRScheduleInterview] Failed to load interview schedules", error);
      toast({
        title: "Failed to load schedules",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSchedulesLoading(false);
    }
  }, [toast, token]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const handleScheduleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (
        !selectedJobId ||
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
            jobId: selectedJobId,
            applicantName: scheduleForm.applicantName,
            applicantEmail: scheduleForm.applicantEmail,
            position: scheduleForm.position,
            interviewer: scheduleForm.interviewer,
            interviewerEmail: scheduleForm.interviewerEmail,
            location: scheduleForm.location,
            scheduledFor: scheduledDate.toISOString(),
            notes: scheduleForm.notes,
            sendApplicantEmail,
            sendInterviewerEmail,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        if (response?.success === false) {
          throw new Error(response.error || "Failed to send interview email.");
        }

        toast({
          title: "Interview scheduled",
          description: `${scheduleForm.applicantName} has been scheduled with ${scheduleForm.interviewer}. Invitations sent.`,
        });

        setScheduleForm(emptyScheduleForm);
        setSendApplicantEmail(true);
        setSendInterviewerEmail(true);
        void loadSchedules();
        navigate("/portal/hr");
      } catch (error: any) {
        const message = String(error?.message ?? "");
        const isDuplicateSchedule = message.includes("duplicate_interview_schedule_per_job");
        toast({
          title: "Failed to schedule interview",
          description: isDuplicateSchedule
            ? "This applicant has already been scheduled for an interview for this job."
            : error?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setScheduleSubmitting(false);
      }
    },
    [navigate, scheduleForm, selectedJobId, sendApplicantEmail, sendInterviewerEmail, toast, token],
  );

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/portal/hr">HR Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <span>Schedule Interview</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Schedule Interview</h1>
            <p className="text-muted-foreground">Record interview details and send invitations to the applicant.</p>
          </div>

          <Button asChild variant="outline">
            <Link to="/portal/hr">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Interview Details
            </CardTitle>
            <CardDescription>Fill out all required information before saving the interview schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="job">Job</Label>
                  <Select
                    value={selectedJobId || undefined}
                    onValueChange={(value) => {
                      setSelectedJobId(value);
                      setScheduleForm((prev) => ({
                        ...prev,
                        applicationId: "",
                        applicantName: "",
                        applicantEmail: "",
                        position: jobOptions.find((j) => j.id === value)?.title ?? prev.position,
                      }));
                    }}
                  >
                    <SelectTrigger id="job">
                      <SelectValue placeholder={loadingJobs ? "Loading jobs..." : "Select job"} />
                    </SelectTrigger>
                    <SelectContent>
                      {jobOptions.length === 0 ? (
                        <SelectItem value="__no_jobs__" disabled>
                          {loadingJobs ? "Loading..." : "No jobs found"}
                        </SelectItem>
                      ) : (
                        jobOptions.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="applicantName">Applicant</Label>
                  <Select
                    value={scheduleForm.applicationId || undefined}
                    onValueChange={(value) => {
                      const contact = filteredApplicantContacts.find((item) => item.id === value);
                      setScheduleForm((prev) => ({
                        ...prev,
                        applicationId: value,
                        applicantEmail: contact?.email ?? prev.applicantEmail,
                        applicantName: contact?.name ?? prev.applicantName,
                        position: contact?.jobTitle ?? prev.position,
                      }));
                    }}
                    disabled={!selectedJobId}
                  >
                    <SelectTrigger id="applicantName">
                      <SelectValue
                        placeholder={
                          !selectedJobId
                            ? "Select job first"
                            : loadingApplicants
                              ? "Loading applicants..."
                              : "Select applicant"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredApplicantContacts.length === 0 ? (
                        <SelectItem value="__no_applicants__" disabled>
                          {!selectedJobId ? "Select job first" : loadingApplicants ? "Loading..." : "No applicants found"}
                        </SelectItem>
                      ) : (
                        filteredApplicantContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
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
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, position: event.target.value }))}
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
                  <Label htmlFor="interviewerEmail">Interviewer Email</Label>
                  <Select
                    value={scheduleForm.interviewerEmail || undefined}
                    onValueChange={(value) => {
                      const selected = interviewerOptions.find((item) => item.email === value);
                      setScheduleForm((prev) => ({
                        ...prev,
                        interviewerEmail: value,
                        interviewer: selected?.fullName || prev.interviewer,
                      }));
                    }}
                  >
                    <SelectTrigger id="interviewerEmail">
                      <SelectValue
                        placeholder={loadingInterviewers ? "Loading interviewers..." : "Select interviewer"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {interviewerOptions.length === 0 ? (
                        <SelectItem value="__no_interviewers__" disabled>
                          {loadingInterviewers ? "Loading..." : "No interviewers found"}
                        </SelectItem>
                      ) : (
                        interviewerOptions.map((interviewer) => (
                          <SelectItem key={interviewer.id} value={interviewer.email}>
                            {interviewer.email}
                            {interviewer.department ? ` · ${interviewer.department}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="interviewer">Interviewer</Label>
                  <Input
                    id="interviewer"
                    value={scheduleForm.interviewer}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, interviewer: event.target.value }))}
                    placeholder="Interviewer name"
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
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, scheduledFor: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={scheduleForm.location}
                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, location: event.target.value }))}
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
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Interview notes or reminders"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Email applicant</div>
                    <div className="text-xs text-muted-foreground">Send the invitation to the applicant’s email address.</div>
                  </div>
                  <Switch checked={sendApplicantEmail} onCheckedChange={setSendApplicantEmail} />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Email interviewer</div>
                    <div className="text-xs text-muted-foreground">Send the invitation to the interviewer’s email address.</div>
                  </div>
                  <Switch checked={sendInterviewerEmail} onCheckedChange={setSendInterviewerEmail} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/portal/hr")}
                  disabled={scheduleSubmitting}
                >
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
          </CardContent>
        </Card>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle>Interview Schedule Status</CardTitle>
            <CardDescription>
              Track interviews and update the status when an employee confirms or completes the interview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulesLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        Loading schedules...
                      </TableCell>
                    </TableRow>
                  ) : schedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No interview schedules found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    schedules.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.applicant_name}</TableCell>
                        <TableCell>{row.position}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="text-sm">{row.interviewer}</div>
                            <div className="text-xs text-muted-foreground">{row.interviewer_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(row.scheduled_for), "PPPp")}</TableCell>
                        <TableCell>
                          <Badge variant={scheduleStatusBadgeVariant(row.status)}>
                            {formatScheduleStatus(row.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRScheduleInterview;

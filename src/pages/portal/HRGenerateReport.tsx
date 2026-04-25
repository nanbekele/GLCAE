import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { callFunction } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Download, ChevronLeft, FileText, RefreshCw } from "lucide-react";

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

type ReportJobsRow = { id: string; title: string; status: string };

type ReportPayload = {
  generatedAt: Date;
  generatedBy: string;
  sections: ReportSectionKey[];
  dashboard: {
    jobCount: number;
    applicationsToday: number;
    interviewsScheduled: number;
    usersCount: number;
  };
  applications: RecentApplication[];
  interviews: InterviewSchedule[];
  jobs: ReportJobsRow[];
  staff: StaffMember[];
};

const HRGenerateReport = () => {
  const navigate = useNavigate();
  const { profile, token } = useAuth();
  const { toast } = useToast();

  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportPayload | null>(null);
  const [selectedReportSections, setSelectedReportSections] = useState<ReportSectionKey[]>(() =>
    REPORT_SECTIONS.map((section) => section.key),
  );

  const toggleReportSection = (key: ReportSectionKey) => {
    setSelectedReportSections((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key],
    );
  };

  const canGenerate = useMemo(() => selectedReportSections.length > 0 && !reportGenerating, [reportGenerating, selectedReportSections.length]);

  const fetchReportData = async (sections: ReportSectionKey[]) => {
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
      supabase.from("jobs").select("id, title, status, posted_at").order("posted_at", { ascending: false }).limit(100),
    ]);

    if (jobsResult.error) {
      throw jobsResult.error;
    }

    const now = new Date();
    const generatedBy = profile?.full_name ?? profile?.email ?? "Unknown";

    const reportDashboard = dashboardResponse ?? {
      jobCount: 0,
      applicationsToday: 0,
      interviewsScheduled: 0,
      usersCount: 0,
      recentApplications: [],
      todaysInterviews: [],
    };

    const applications: RecentApplication[] = (reportDashboard.recentApplications ?? []).map((application) => ({
      name: application.name,
      position: application.position,
      status: application.status,
      date: formatDistanceToNow(new Date(application.created_at), { addSuffix: true }),
      appliedAt: application.created_at,
    }));

    const interviews: InterviewSchedule[] = (reportDashboard.todaysInterviews ?? []).map((interview) => ({
      time: format(new Date(interview.scheduled_for), "p"),
      candidate: interview.applicant,
      position: interview.position,
      interviewer: interview.interviewer,
      scheduledFor: interview.scheduled_for,
    }));

    const jobs: ReportJobsRow[] = (jobsResult.data ?? []).map((job) => ({
      id: job.id,
      title: job.title ?? "",
      status: job.status ?? "",
    }));

    const staff = staffResponse?.staff ?? [];

    return {
      generatedAt: now,
      generatedBy,
      sections,
      dashboard: {
        jobCount: reportDashboard.jobCount ?? 0,
        applicationsToday: reportDashboard.applicationsToday ?? 0,
        interviewsScheduled: reportDashboard.interviewsScheduled ?? 0,
        usersCount: reportDashboard.usersCount ?? 0,
      },
      applications,
      interviews,
      jobs,
      staff,
    } satisfies ReportPayload;
  };

  const downloadReportCsv = (data: ReportPayload) => {
    const escape = (value: string) => value.replace(/"/g, '""');
    const pushBlank = (rows: string[][]) => rows.push([""]);
    const rows: string[][] = [];

    rows.push(["HR Dashboard Report"]);
    rows.push(["Generated At", format(data.generatedAt, "yyyy-MM-dd HH:mm")]);
    rows.push(["Generated By", data.generatedBy]);
    pushBlank(rows);

    const activeSections = REPORT_SECTIONS.map((section) => section.key).filter((key) => data.sections.includes(key));

    activeSections.forEach((sectionKey, index) => {
      switch (sectionKey) {
        case "summary": {
          rows.push(["Summary Metrics"]);
          rows.push(["Active Job Postings", data.dashboard.jobCount.toString()]);
          rows.push(["Applications Today", data.dashboard.applicationsToday.toString()]);
          rows.push(["Interviews Scheduled Today", data.dashboard.interviewsScheduled.toString()]);
          rows.push(["Number of Users", data.dashboard.usersCount.toString()]);
          break;
        }
        case "applications": {
          rows.push(["Recent Applications"]);
          rows.push(["Candidate", "Position", "Status", "Applied At", "Relative Time"]);
          if (data.applications.length === 0) {
            rows.push(["No recent applications", "", "", "", ""]);
          } else {
            data.applications.forEach((application) => {
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
          if (data.interviews.length === 0) {
            rows.push(["No interviews scheduled", "", "", "", ""]);
          } else {
            data.interviews.forEach((interview) => {
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
          if (data.jobs.length === 0) {
            rows.push(["No job postings found", ""]);
          } else {
            data.jobs.forEach((job) => {
              rows.push([job.title, job.status]);
            });
          }
          break;
        }
        case "staff": {
          rows.push(["Registered Staff Members"]);
          rows.push(["Name", "Email", "Role", "Department", "Status"]);
          if (data.staff.length === 0) {
            rows.push(["No staff records found", "", "", "", ""]);
          } else {
            data.staff.forEach((member) => {
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

    const csvContent = rows.map((row) => row.map((value) => `"${escape(value)}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `hr-dashboard-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (selectedReportSections.length === 0) {
      toast({
        title: "Select at least one section",
        description: "Please choose one or more report categories before generating the report.",
        variant: "destructive",
      });
      return;
    }

    const titles = REPORT_SECTIONS.filter((s) => selectedReportSections.includes(s.key))
      .map((s) => s.title)
      .join(", ");

    const confirmed = window.confirm(
      `Are you sure you want to generate the HR report for the selected sections?\n\n${titles}`,
    );
    if (!confirmed) return;

    setReportGenerating(true);
    try {
      const data = await fetchReportData([...selectedReportSections]);
      setReportData(data);
      downloadReportCsv(data);
      toast({
        title: "Report generated",
        description: "Preview is ready and the CSV has been downloaded.",
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
                    <span>Generate HR Report</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Generate HR Report</h1>
            <p className="text-muted-foreground">Select the report sections to include and download a CSV file.</p>
          </div>

          <Button asChild variant="outline">
            <Link to="/portal/hr">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="border-card-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Select Report Sections
              </CardTitle>
              <CardDescription>
                Choose one or more categories. You can generate a comprehensive report or focus on specific areas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
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
                      disabled={reportGenerating}
                    />
                    <div>
                      <p className="font-medium text-foreground">{section.title}</p>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/portal/hr")}
                  disabled={reportGenerating}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleGenerate} disabled={!canGenerate}>
                  {reportGenerating ? "Generating..." : "Generate"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border shadow-card">
            <CardHeader>
              <CardTitle>Report Preview</CardTitle>
              <CardDescription>
                {reportData
                  ? `Generated ${format(reportData.generatedAt, "PPPp")} by ${reportData.generatedBy}`
                  : "Generate a report to see a preview here before downloading again."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!reportData ? (
                <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border bg-muted/20 p-6 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-foreground">No report generated yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Select sections and click Generate.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {reportData.sections.map((key) => {
                        const label = REPORT_SECTIONS.find((s) => s.key === key)?.title ?? key;
                        return (
                          <Badge key={key} variant="secondary">
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          setReportGenerating(true);
                          try {
                            const data = await fetchReportData([...selectedReportSections]);
                            setReportData(data);
                            toast({ title: "Preview refreshed", description: "The report preview is up to date." });
                          } catch (error: any) {
                            toast({
                              title: "Failed to refresh preview",
                              description: error?.message ?? "Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setReportGenerating(false);
                          }
                        }}
                        disabled={reportGenerating}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                      <Button type="button" onClick={() => downloadReportCsv(reportData)} disabled={reportGenerating}>
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">Open Positions</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{reportData.dashboard.jobCount}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">Applications Today</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{reportData.dashboard.applicationsToday}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">Interviews Scheduled</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{reportData.dashboard.interviewsScheduled}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-sm text-muted-foreground">Users</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">{reportData.dashboard.usersCount}</p>
                    </div>
                  </div>

                  <Tabs defaultValue={reportData.sections[0] ?? "summary"}>
                    <TabsList className="w-full justify-start">
                      {reportData.sections.map((sectionKey) => (
                        <TabsTrigger key={sectionKey} value={sectionKey}>
                          {REPORT_SECTIONS.find((s) => s.key === sectionKey)?.title ?? sectionKey}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {reportData.sections.includes("summary") ? (
                      <TabsContent value="summary">
                        <div className="rounded-xl border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Metric</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Active Job Postings</TableCell>
                                <TableCell className="text-right">{reportData.dashboard.jobCount}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Applications Today</TableCell>
                                <TableCell className="text-right">{reportData.dashboard.applicationsToday}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Interviews Scheduled Today</TableCell>
                                <TableCell className="text-right">{reportData.dashboard.interviewsScheduled}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Number of Users</TableCell>
                                <TableCell className="text-right">{reportData.dashboard.usersCount}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    ) : null}

                    {reportData.sections.includes("applications") ? (
                      <TabsContent value="applications">
                        <div className="rounded-xl border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Candidate</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Submitted</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reportData.applications.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                    No recent applications.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                reportData.applications.slice(0, 10).map((row, idx) => (
                                  <TableRow key={`${row.appliedAt}-${idx}`}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell>{row.position}</TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="capitalize">
                                        {row.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{format(new Date(row.appliedAt), "PPPp")}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        {reportData.applications.length > 10 ? (
                          <p className="mt-2 text-xs text-muted-foreground">Showing 10 of {reportData.applications.length} applications.</p>
                        ) : null}
                      </TabsContent>
                    ) : null}

                    {reportData.sections.includes("interviews") ? (
                      <TabsContent value="interviews">
                        <div className="rounded-xl border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Candidate</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Interviewer</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reportData.interviews.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                    No interviews scheduled.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                reportData.interviews.map((row, idx) => (
                                  <TableRow key={`${row.scheduledFor}-${idx}`}>
                                    <TableCell className="font-medium">{row.time}</TableCell>
                                    <TableCell>{row.candidate}</TableCell>
                                    <TableCell>{row.position}</TableCell>
                                    <TableCell>{row.interviewer}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    ) : null}

                    {reportData.sections.includes("jobs") ? (
                      <TabsContent value="jobs">
                        <div className="rounded-xl border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reportData.jobs.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                                    No job postings found.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                reportData.jobs.slice(0, 10).map((row) => (
                                  <TableRow key={row.id}>
                                    <TableCell className="font-medium">{row.title}</TableCell>
                                    <TableCell className="capitalize">{row.status}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        {reportData.jobs.length > 10 ? (
                          <p className="mt-2 text-xs text-muted-foreground">Showing 10 of {reportData.jobs.length} job postings.</p>
                        ) : null}
                      </TabsContent>
                    ) : null}

                    {reportData.sections.includes("staff") ? (
                      <TabsContent value="staff">
                        <div className="rounded-xl border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reportData.staff.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                    No staff members found.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                reportData.staff.slice(0, 10).map((row) => (
                                  <TableRow key={row.id}>
                                    <TableCell className="font-medium">{row.full_name ?? row.email ?? "—"}</TableCell>
                                    <TableCell>{row.email ?? "—"}</TableCell>
                                    <TableCell className="capitalize">{row.role ?? "—"}</TableCell>
                                    <TableCell>{row.department ?? "—"}</TableCell>
                                    <TableCell>
                                      <Badge variant={row.is_activated ? "default" : "secondary"}>
                                        {row.is_activated ? "Activated" : "Pending"}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        {reportData.staff.length > 10 ? (
                          <p className="mt-2 text-xs text-muted-foreground">Showing 10 of {reportData.staff.length} staff members.</p>
                        ) : null}
                      </TabsContent>
                    ) : null}
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HRGenerateReport;

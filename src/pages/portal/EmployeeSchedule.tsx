import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import type { ConsultancyRequestRow, InterviewScheduleLog } from "@/lib/portalRequests";
import { fetchConsultancyRequestsForEmployee, fetchInterviewSchedulesForEmployee, updateConsultancyRequestStatus, updateInterviewScheduleStatus } from "@/lib/portalRequests";

const EmployeeSchedule = () => {
  const { profile, token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [consultancy, setConsultancy] = useState<ConsultancyRequestRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewScheduleLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingConsultancyId, setUpdatingConsultancyId] = useState<string | null>(null);
  const [updatingInterviewId, setUpdatingInterviewId] = useState<string | null>(null);

  const [openSection, setOpenSection] = useState<"consultancy" | "interviews" | null>(null);

  const handleUpdateConsultancyStatus = async (
    req: ConsultancyRequestRow,
    status: ConsultancyRequestRow["status"],
  ) => {
    setUpdatingConsultancyId(req.id);
    try {
      const updated = await updateConsultancyRequestStatus(req.id, status, token);
      setConsultancy((prev) => prev.map((c) => (c.id === req.id ? { ...c, status: updated.status } : c)));
      toast({ title: "Schedule status updated" });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUpdatingConsultancyId(null);
    }
  };

  const handleUpdateInterviewStatus = async (iv: InterviewScheduleLog, status: string) => {
    setUpdatingInterviewId(iv.id);
    try {
      const updated = await updateInterviewScheduleStatus(iv.id, status, token);
      setInterviews((prev) => prev.map((x) => (x.id === iv.id ? { ...x, status: updated.status } : x)));
      toast({ title: "Interview status updated" });
    } catch (err: any) {
      toast({ title: "Failed to update interview status", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUpdatingInterviewId(null);
    }
  };

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const cons = await fetchConsultancyRequestsForEmployee(profile.id, 200, token);
      setConsultancy(cons);
      // Interview schedules for this interviewer (by email) — prefer Edge Function via token
      const ints = await fetchInterviewSchedulesForEmployee(profile.email ?? "", 200, token);
      setInterviews(ints);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.id]);

  const consultancySorted = useMemo(() => {
    return [...consultancy].sort(
      (a, b) => +(new Date(b.schedule_at ?? b.created_at)) - +(new Date(a.schedule_at ?? a.created_at)),
    );
  }, [consultancy]);

  const interviewsSorted = useMemo(() => {
    return [...interviews].sort(
      (a, b) => +(new Date(b.scheduled_for)) - +(new Date(a.scheduled_for)),
    );
  }, [interviews]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
            <p className="text-muted-foreground">Your consultancy sessions and interview schedules.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/portal/employee")}>
              <ArrowLeft className="h-4 w-4 mr-2"/> Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/>Refreshing</span> : "Refresh"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-6">{error}</div>
        ) : null}

        {/* Consultancy Schedule */}
        <div className="space-y-6">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4"/>
                    <span>Consultancy Schedule</span>
                  </CardTitle>
                  <CardDescription>Consultancy sessions assigned to you</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{consultancy.length}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenSection((prev) => prev === "consultancy" ? null : "consultancy")}
                  >
                    {openSection === "consultancy" ? "Close" : "Open"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {openSection === "consultancy" ? (
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
                ) : consultancySorted.length === 0 ? (
                  <CardDescription>No consultancy sessions.</CardDescription>
                ) : (
                  <div className="space-y-2">
                    {consultancySorted.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{c.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.schedule_at ? `Scheduled: ${format(new Date(c.schedule_at), 'EEE, MMM d, yyyy p')}` : 'Not scheduled yet'}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="uppercase">{c.department}</Badge>
                            <Badge variant="secondary">{c.status}</Badge>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-1 max-w-xs">
                          <Label>Status</Label>
                          <Select
                            value={(c.status ?? "pending").toLowerCase()}
                            onValueChange={(v) => void handleUpdateConsultancyStatus(c, v as ConsultancyRequestRow["status"])}
                            disabled={updatingConsultancyId === c.id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {c.description ? <p className="mt-2 text-sm text-muted-foreground">{c.description}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            ) : null}
          </Card>

        {/* Interview Schedule */}
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4"/>
                    <span>Interview Schedule</span>
                  </CardTitle>
                  <CardDescription>Interviews where you are the interviewer</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{interviews.length}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenSection((prev) => prev === "interviews" ? null : "interviews")}
                  >
                    {openSection === "interviews" ? "Close" : "Open"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {openSection === "interviews" ? (
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
                ) : interviewsSorted.length === 0 ? (
                  <CardDescription>No interviews scheduled.</CardDescription>
                ) : (
                  <div className="space-y-2">
                    {interviewsSorted.map((iv) => (
                      <div key={iv.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">{iv.position}</div>
                            <div className="text-xs text-muted-foreground">
                              Candidate: {iv.applicant_name} ({iv.applicant_email})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              When: {format(new Date(iv.scheduled_for), 'EEE, MMM d, yyyy p')} · {iv.location}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline">Interview</Badge>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-1 max-w-xs">
                          <Label>Status</Label>
                          <Select
                            value={(iv.status ?? "waiting").toLowerCase()}
                            onValueChange={(v) => void handleUpdateInterviewStatus(iv, v)}
                            disabled={updatingInterviewId === iv.id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="waiting">Waiting</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {iv.notes ? <p className="mt-2 text-sm text-muted-foreground">{iv.notes}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSchedule;

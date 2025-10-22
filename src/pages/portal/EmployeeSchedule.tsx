import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import type { ServiceRequestRow, ConsultancyRequestRow, InterviewScheduleLog } from "@/lib/portalRequests";
import { fetchServiceRequestsAssignedTo, fetchConsultancyRequestsForEmployee, fetchInterviewSchedulesForEmployee } from "@/lib/portalRequests";

const EmployeeSchedule = () => {
  const { profile, token } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<ServiceRequestRow[]>([]);
  const [consultancy, setConsultancy] = useState<ConsultancyRequestRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewScheduleLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceRequestsAssignedTo(profile.id, 200);
      setItems(data);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const matchesQ = !q || `${i.title} ${i.description}`.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || (i.status ?? '').toLowerCase() === statusFilter;
      const matchesService = serviceFilter === "all" || (i.service_type ?? '').toLowerCase() === serviceFilter;
      return matchesQ && matchesStatus && matchesService;
    }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [items, search, statusFilter, serviceFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, ServiceRequestRow[]>();
    for (const it of filtered) {
      const key = format(new Date(it.created_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a > b ? -1 : 1));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
            <p className="text-muted-foreground">Timeline of tickets and activities assigned to you.</p>
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

        <Card className="shadow-card border-card-border">
          <CardHeader>
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <CardTitle>Schedule</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    {/* "Verified" is represented by the allowed status "completed" */}
                    <SelectItem value="completed">Verified</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Service"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="ict">ICT</SelectItem>
                    <SelectItem value="mechanical">Mechanical</SelectItem>
                    <SelectItem value="material testing">Material Testing</SelectItem>
                    <SelectItem value="architectural & civil">Architectural & Civil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-4">{error}</div>
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
            ) : groups.length === 0 ? (
              <CardDescription className="py-6">No schedule items found.</CardDescription>
            ) : (
              <div className="space-y-6">
                {groups.map(([day, list]) => (
                  <div key={day} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CalendarDays className="h-4 w-4"/>
                      <span>{format(new Date(day), "EEE, MMM d, yyyy")}</span>
                    </div>
                    <div className="space-y-2">
                      {list.map((it) => (
                        <div key={it.id} className="rounded-lg border border-border/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">{it.title}</div>
                              <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}</div>
                            </div>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="uppercase">{it.service_type}</Badge>
                              <Badge variant="secondary">{it.priority ?? '#'}</Badge>
                              <Badge variant="outline">{it.status ?? 'pending'}</Badge>
                            </div>
                          </div>
                          {it.description ? <p className="mt-2 text-sm text-muted-foreground">{it.description}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consultancy Schedule */}
        <div className="mt-6">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4"/>
                <span>Consultancy Schedule</span>
              </CardTitle>
              <CardDescription>Consultancy sessions assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
              ) : consultancy.length === 0 ? (
                <CardDescription>No consultancy sessions.</CardDescription>
              ) : (
                <div className="space-y-2">
                  {consultancy
                    .sort((a, b) => +(new Date(b.schedule_at ?? b.created_at)) - +(new Date(a.schedule_at ?? a.created_at)))
                    .map((c) => (
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
                        {c.description ? <p className="mt-2 text-sm text-muted-foreground">{c.description}</p> : null}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Interview Schedule */}
        <div className="mt-6">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4"/>
                <span>Interview Schedule</span>
              </CardTitle>
              <CardDescription>Interviews where you are the interviewer</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
              ) : interviews.length === 0 ? (
                <CardDescription>No interviews scheduled.</CardDescription>
              ) : (
                <div className="space-y-2">
                  {interviews
                    .sort((a, b) => +(new Date(b.scheduled_for)) - +(new Date(a.scheduled_for)))
                    .map((iv) => (
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
                        {iv.notes ? <p className="mt-2 text-sm text-muted-foreground">{iv.notes}</p> : null}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSchedule;

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchEmployeesByDepartment,
  EmployeeOption,
  fetchConsultancyRequestsByDepartment,
  ConsultancyRequestRow,
  updateConsultancyRequestAssignmentAndSchedule,
} from "@/lib/portalRequests";

export interface ConsultancyRequestsProps {
  departmentLabel: "ICT" | "Mechanical" | "Material Testing" | "Architectural & Civil";
}

const ConsultancyRequests = ({ departmentLabel }: ConsultancyRequestsProps) => {
  const { token } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ConsultancyRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleNote, setScheduleNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => requests.find(r => r.id === selectedId) ?? null, [requests, selectedId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchConsultancyRequestsByDepartment(departmentLabel, 100, token);
      setRequests(list);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load consultancy requests.");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const list = await fetchEmployeesByDepartment(departmentLabel, token);
      setEmployees(list);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [departmentLabel]);
  useEffect(() => { void loadEmployees(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [departmentLabel]);

  const handleSaveSchedule = async () => {
    if (!selected) return;
    if (!assigneeId) return;
    if (!scheduleDate) return;
    setSaving(true);
    try {
      await updateConsultancyRequestAssignmentAndSchedule(
        selected.id,
        assigneeId,
        new Date(scheduleDate).toISOString(),
        scheduleNote || undefined,
        token,
      );
      await load();
      toast({
        title: "Schedule saved",
        description: "Client and consultant can now view the schedule in their dashboards.",
      });
    } catch (err) {
      // handle later if necessary
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Consultancy Requests - {departmentLabel}</h1>
          <p className="text-muted-foreground">Review client consultancy requests, assign a consultant and schedule.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle>Incoming Requests</CardTitle>
              <CardDescription>Filtered to this department</CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
              ) : null}
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
              ) : requests.length === 0 ? (
                <CardDescription>No consultancy requests.</CardDescription>
              ) : (
                <div className="space-y-2">
                  {requests.map((r) => (
                    <button key={r.id} onClick={() => setSelectedId(r.id)} className={`w-full text-left rounded-lg border p-3 ${selectedId === r.id ? 'border-primary' : 'border-border'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">{r.title}</div>
                          <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="uppercase">{r.department}</Badge>
                          <Badge variant="secondary">{r.status}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-card-border">
            <CardHeader>
              <CardTitle>Schedule Consultancy</CardTitle>
              <CardDescription>{selected ? selected.title : 'Select a request to schedule'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <CardDescription>Select a request to begin.</CardDescription>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label>Consultant (employee)</Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select employee"/></SelectTrigger>
                      <SelectContent>
                        {employees.length === 0 ? (
                          <SelectItem value="__none" disabled>No employees</SelectItem>
                        ) : employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Date & Time</Label>
                    <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes (optional)</Label>
                    <Textarea value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} placeholder="Add extra details for the session" rows={4}/>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => void handleSaveSchedule()} disabled={saving || !assigneeId || !scheduleDate}>
                      {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Saving...</span> : <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4"/>Save schedule</span>}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConsultancyRequests;

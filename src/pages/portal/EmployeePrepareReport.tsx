import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import type { ServiceRequestRow } from "@/lib/portalRequests";
import { createClientServiceRequest, fetchDepartmentHeadId, fetchServiceRequestsAssignedTo, shareServiceRequestWithEmployees, updateServiceRequestStatus, uploadServiceRequestAttachments } from "@/lib/portalRequests";

const EmployeePrepareReport = () => {
  const { profile, token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchServiceRequestsAssignedTo(profile.id, 100);
        setTasks(data);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load assigned tasks.");
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const selectableTasks = useMemo(() => {
    const isCompleted = (value: string | null | undefined) => {
      const status = (value ?? "").toLowerCase();
      return ["completed", "resolved", "verified"].includes(status);
    };
    return tasks
      .filter((t) => !(t.title ?? "").toLowerCase().startsWith("report:"))
      .filter((t) => !isCompleted(t.status));
  }, [tasks]);

  const selectedTask = useMemo(
    () => selectableTasks.find((t) => t.id === selectedTaskId) ?? null,
    [selectableTasks, selectedTaskId]
  );

  const departmentLabel = useMemo(() => {
    const byTask = selectedTask?.service_type ?? null;
    if (byTask) return byTask;
    const dept = (profile?.department ?? "").trim();
    if (/ict/i.test(dept)) return "ICT";
    if (/mechanical/i.test(dept)) return "Mechanical";
    if (/material/i.test(dept)) return "Material Testing";
    if (/arch|civil/i.test(dept)) return "Architectural & Civil";
    return "ICT"; // fallback
  }, [profile?.department, selectedTask?.service_type]);

  const handleSubmit = async () => {
    if (!profile?.id) return;
    if (!selectedTask) {
      toast({ title: "Select a task", description: "Please choose the task you are reporting on.", variant: "destructive" });
      return;
    }
    if (!summary.trim()) {
      toast({ title: "Summary required", description: "Please enter a brief summary.", variant: "destructive" });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "Attachments required",
        description: "Please attach at least one file before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const title = `Report: ${selectedTask.title}`;
      const description = [`Original Task ID: ${selectedTask.id}`, summary.trim(), "", "Details:", details.trim()]
        .filter((part) => part !== "")
        .join("\n")
        .trim();

      const preparedAttachments = await uploadServiceRequestAttachments(files);

      // Create as a service request (re-using existing API) and then assign to department head
      const created = await createClientServiceRequest({
        // Important: route the report back to the original client so HR can forward it to them later
        clientId: selectedTask.client_id ?? profile.id,
        title,
        description,
        serviceType: departmentLabel,
        attachments: preparedAttachments,
        token,
      });

      if (!created?.id) {
        throw new Error("Unable to submit report (no ID). Try again.");
      }

      const headId = await fetchDepartmentHeadId(departmentLabel);
      if (headId) {
        await shareServiceRequestWithEmployees(created.id, [headId]);
      }

      await updateServiceRequestStatus(selectedTask.id, "completed");

      toast({ title: "Report submitted", description: "Your report has been sent to your department head." });
      navigate("/portal/employee");
    } catch (err: any) {
      toast({ title: "Submit failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prepare Report</h1>
            <p className="text-muted-foreground">Send a report for an assigned task directly to your department head.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/portal/employee")}>
            <ArrowLeft className="h-4 w-4 mr-2"/> Back to Dashboard
          </Button>
        </div>

        <Card className="shadow-card border-card-border">
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
            <CardDescription>Select the task and provide your report details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
            <div className="grid gap-2">
              <Label>Task title</Label>
              <Select value={selectedTaskId ?? undefined} onValueChange={(v) => setSelectedTaskId(v)}>
                <SelectTrigger><SelectValue placeholder={loading ? "Loading tasks..." : "Select a task"}/></SelectTrigger>
                <SelectContent>
                  {selectableTasks.length === 0 ? (
                    <SelectItem value="__none" disabled>{loading ? "Loading tasks..." : "No tasks assigned"}</SelectItem>
                  ) : selectableTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Summary</Label>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short summary"/>
            </div>
            <div className="grid gap-2">
              <Label>Details</Label>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe progress, blockers, and next steps" rows={6}/>
            </div>
            <div className="grid gap-2">
              <Label>Attachments (required)</Label>
              <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </div>
            <div className="flex items-center justify-end">
              <Button onClick={() => void handleSubmit()} disabled={submitting || loading}>
                {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Submitting...</span> : <span className="inline-flex items-center gap-2"><Send className="h-4 w-4"/>Submit Report</span>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeePrepareReport;

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Send, CheckCheck, MessageSquare } from "lucide-react";
import type { ServiceRequestRow, ServiceRequestAttachment } from "@/lib/portalRequests";
import { fetchServiceRequestsAssignedTo, fetchAnyHrStaffId, shareServiceRequestWithEmployees, updateServiceRequestNotes, updateServiceRequestStatus, updateServiceRequestServiceType } from "@/lib/portalRequests";
import { supabase } from "@/integrations/supabase/client";

const HeadReviewReports = () => {
  const { profile, getDashboardRoute } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [reports, setReports] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const downloadAttachment = async (attachment: ServiceRequestAttachment, identifier: string) => {
    if (typeof window === "undefined") return;
    const triggerDownloadFromUrl = (url: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    const downloadFromSupabaseStorage = async (bucket: string, objectPath: string) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60, { download: attachment.name ?? "service-request-attachment" });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "Unable to generate download link from storage.");
      }
      triggerDownloadFromUrl(data.signedUrl);
    };
    setDownloadingId(identifier);
    try {
      if (attachment.content?.startsWith("data:")) {
        triggerDownloadFromUrl(attachment.content);
        return;
      }
      const pathParts = inferStorageLocationFromPath(attachment.path);
      if (pathParts) {
        await downloadFromSupabaseStorage(pathParts.bucket, pathParts.objectPath);
        return;
      }
      if (attachment.url) {
        // Prefer direct open for public buckets; avoids signed URL inconsistencies across environments
        triggerDownloadFromUrl(attachment.url);
        return;
      }
      throw new Error("Attachment does not include downloadable content.");
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message ?? "Please try again later.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceRequestsAssignedTo(profile.id, 100);
      const onlyReports = data
        .filter((r) => (r.title ?? "").toLowerCase().startsWith("report:"))
        .filter((r) => (r.service_type ?? "").toLowerCase() !== "hr coordination");
      setReports(onlyReports);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load submitted tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.id]);

  const extractOriginalTaskId = (description?: string | null) => {
    if (!description) return null;
    const match = description.match(/Original Task ID:\s*([0-9a-fA-F-]{10,})/);
    return match?.[1] ?? null;
  };

  const handleVerify = async (id: string) => {
    setUpdatingId(id);
    try {
      const target = reports.find((r) => r.id === id);
      if (!target) return;
      // Use an allowed status value to represent "Verified"
      await updateServiceRequestStatus(id, "completed");
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "completed" } : r));
      toast({ title: "Verified", description: "Report marked as verified." });
    } catch (err: any) {
      toast({ title: "Verify failed", description: err?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequestChanges = async (id: string) => {
    setUpdatingId(id);
    try {
      const draft = (noteDraft[id] ?? "").trim();
      const text = draft ? `Feedback: ${draft}` : "Feedback requested";
      await updateServiceRequestNotes(id, text);
      const target = reports.find((r) => r.id === id);

      const originalTaskId = extractOriginalTaskId(target?.description);
      if (originalTaskId) {
        await updateServiceRequestStatus(originalTaskId, "in_progress");
      }

      if (target?.client_id) {
        await shareServiceRequestWithEmployees(id, [target.client_id]);
      }
      await updateServiceRequestStatus(id, "in_progress");
      toast({ title: "Feedback sent", description: "Report sent back to employee." });
      setNoteDraft((prev) => ({ ...prev, [id]: "" }));
      void load();
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendToHr = async (id: string) => {
    setUpdatingId(id);
    try {
      const target = reports.find((r) => r.id === id);
      if (!target) return;
      // Require the allowed status that we use to represent "Verified"
      if ((target.status ?? "").toLowerCase() !== "completed") {
        toast({ title: "Not verified", description: "Verify the report before sending to HR.", variant: "destructive" });
        return;
      }
      const hrId = await fetchAnyHrStaffId();
      if (hrId) {
        await shareServiceRequestWithEmployees(id, [hrId]);
      }
      // Route to HR Coordination for visibility (HR dashboard will pick this up under Verified Tasks)
      const updatedRow = await updateServiceRequestServiceType(id, "HR Coordination");
      // Reflect immediately in local state so the button disables without waiting for reload
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, service_type: updatedRow.service_type } : r)));
      if (hrId) {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, assigned_to: hrId } : r)));
      }
      const who = profile?.full_name ?? "Department Head";
      const appendix = hrId ? "" : " (no HR staff available; forwarded unassigned)";
      await updateServiceRequestNotes(id, `${target.notes ? target.notes + "\n\n" : ""}Forwarded to HR by ${who}${appendix}`);
      toast({ title: "Sent to HR", description: "Report forwarded to HR dashboard." });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast({ title: "Forward failed", description: err?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Check Submitted Tasks</h1>
            <p className="text-muted-foreground">Review reports prepared by your employees, provide feedback, verify, and forward to HR.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate(getDashboardRoute())}>
            <ArrowLeft className="h-4 w-4 mr-2"/> Back to Dashboard
          </Button>
        </div>

        <Card className="shadow-card border-card-border">
          <CardHeader>
            <CardTitle>Submitted Reports</CardTitle>
            <CardDescription>Reports assigned to you as department head.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-4">{error}</div> : null}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Loading ...</div>
            ) : reports.length === 0 ? (
              <CardDescription className="py-6">No submitted reports.</CardDescription>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="uppercase">{r.service_type}</Badge>
                        <Badge variant="secondary">{r.priority ?? '#'}</Badge>
                        <Badge variant="outline">{r.status ?? 'pending'}</Badge>
                      </div>
                    </div>
                    {r.description ? <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{r.description}</p> : null}
                    {Array.isArray((r as any).attachments) && (r as any).attachments.length > 0 ? (
                      <div className="mt-3">
                        <h5 className="text-xs font-semibold text-foreground">Attachments</h5>
                        <ul className="mt-1 space-y-1 text-sm">
                          {(r as any).attachments.map((a: ServiceRequestAttachment, idx: number) => {
                            const id = a.path ?? a.url ?? `${r.id}-att-${idx}`;
                            const canDownload = Boolean(a.content || a.path || a.url);
                            return (
                              <li key={id}>
                                {canDownload ? (
                                  <Button variant="link" className="h-auto p-0" onClick={() => void downloadAttachment(a, id)} disabled={downloadingId === id}>
                                    {downloadingId === id ? (
                                      <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Downloading...</span>
                                    ) : (
                                      a.name ? `Download ${a.name}` : 'Download file'
                                    )}
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">{a.name ?? `Attachment ${idx + 1}`} (unavailable)</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      <Label>Feedback (optional)</Label>
                      <Textarea value={noteDraft[r.id] ?? ""} onChange={(e) => setNoteDraft((prev) => ({ ...prev, [r.id]: e.target.value }))} placeholder="Write feedback for the employee..." />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 justify-end">
                      <Button variant="outline" onClick={() => void handleRequestChanges(r.id)} disabled={updatingId === r.id}>
                        {updatingId === r.id ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending...</span> : <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4"/>Request Changes</span>}
                      </Button>
                      <Button
                        variant={(r.status ?? '').toLowerCase() === 'completed' ? 'secondary' : undefined}
                        onClick={() => void handleVerify(r.id)}
                        disabled={updatingId === r.id || (r.status ?? '').toLowerCase() === 'completed'}
                      >
                        {updatingId === r.id ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Verifying...</span> : <span className="inline-flex items-center gap-2"><CheckCheck className="h-4 w-4"/>Verify</span>}
                      </Button>
                      <Button
                        onClick={() => void handleSendToHr(r.id)}
                        disabled={
                          updatingId === r.id || (r.service_type ?? '').toLowerCase() === 'hr coordination'
                        }
                        variant={(r.service_type ?? '').toLowerCase() === 'hr coordination' ? 'secondary' : undefined}
                      >
                        {updatingId === r.id ? (
                          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending...</span>
                        ) : (
                          <span className="inline-flex items-center gap-2"><Send className="h-4 w-4"/>Send to HR</span>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HeadReviewReports;

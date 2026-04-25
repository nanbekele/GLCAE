import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, RefreshCcw } from "lucide-react";
import type { ServiceRequestRow } from "@/lib/portalRequests";
import { fetchServiceRequestsAssignedTo, updateServiceRequestPriority, updateServiceRequestStatus } from "@/lib/portalRequests";
import { supabase } from "@/integrations/supabase/client";

const EmployeeTasks = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingPriorityId, setUpdatingPriorityId] = useState<string | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
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
      const base = SUPABASE_URL ? new URL(rawUrl, SUPABASE_URL) : new URL(rawUrl, window.location.origin);
      const segments = base.pathname.split("/").filter(Boolean);
      const objectIndex = segments.findIndex((segment) => segment === "object");
      if (objectIndex === -1) return null;
      const scope = segments[objectIndex + 1];
      const bucket = segments[objectIndex + 2];
      const remainder = segments.slice(objectIndex + 3).join("/");
      if (!bucket || !remainder) return null;
      return { bucket, objectPath: remainder, scope };
    } catch (_err) {
      return null;
    }
  };

  const downloadFromSupabaseStorage = async (
    bucket: string,
    objectPath: string,
    suggestedName: string,
  ) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 60, { download: suggestedName });
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Unable to generate download link from Supabase storage.");
    }
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAttachment = async (
    attachment: { name?: string | null; path?: string | null; url?: string | null; content?: string | null },
    identifier: string,
  ) => {
    if (typeof window === "undefined") return;
    const filename = attachment.name ?? "service-request-attachment";
    setDownloadingId(identifier);
    try {
      if (attachment.content?.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = attachment.content;
        link.download = filename;
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const parts = inferStorageLocationFromPath(attachment.path);
      if (parts) {
        await downloadFromSupabaseStorage(parts.bucket, parts.objectPath, filename);
        return;
      }

      if (attachment.url) {
        // Prefer direct open for public buckets; avoids signed URL inconsistencies across environments
        const link = document.createElement("a");
        link.href = attachment.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      throw new Error("Attachment does not include downloadable content.");
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[EmployeeTasks] Failed to download attachment", err);
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
      setTasks(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const handleUpdateStatus = async (req: ServiceRequestRow, status: string) => {
    setUpdatingStatusId(req.id);
    try {
      const updated = await updateServiceRequestStatus(req.id, status);
      setTasks((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: updated.status } : r)));
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleUpdatePriority = async (req: ServiceRequestRow, priority: string) => {
    setUpdatingPriorityId(req.id);
    try {
      const updated = await updateServiceRequestPriority(req.id, priority);
      setTasks((prev) => prev.map((r) => (r.id === req.id ? { ...r, priority: updated.priority } : r)));
      toast({ title: "Priority updated" });
    } catch (err: any) {
      toast({ title: "Failed to update priority", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUpdatingPriorityId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
            <p className="text-muted-foreground">Tickets assigned to you by department heads.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/portal/employee")}> 
              <ArrowLeft className="h-4 w-4 mr-2"/> Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? (<span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/> Refreshing</span>) : (<span className="inline-flex items-center gap-1"><RefreshCcw className="h-4 w-4"/> Refresh</span>)}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-4">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading your tasks...
          </div>
        ) : tasks.length === 0 ? (
          <Card className="shadow-card border-card-border">
            <CardContent className="p-6 text-muted-foreground text-sm">No tasks assigned yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id} className="shadow-card border-card-border">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <CardDescription>
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="uppercase">{task.service_type}</Badge>
                    <Badge variant="secondary">Priority {task.priority ?? "#"}</Badge>
                    <Badge variant="outline">{task.status ?? "pending"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {task.description ? (
                    <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="grid gap-1">
                      <Label>Status</Label>
                      <Select
                        value={(task.status ?? "pending").toLowerCase()}
                        onValueChange={(v) => void handleUpdateStatus(task, v)}
                        disabled={updatingStatusId === task.id}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label>Priority</Label>
                      <Select
                        value={(task.priority ?? "").toLowerCase() || "medium"}
                        onValueChange={(v) => void handleUpdatePriority(task, v)}
                        disabled={updatingPriorityId === task.id}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {Array.isArray(task.attachments) && task.attachments.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-foreground">Attachments</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {task.attachments.map((attachment, index) => {
                          const attachmentId = attachment.path ?? attachment.url ?? `${task.id}-attachment-${index}`;
                          const canDownload = Boolean(attachment.content || attachment.path || attachment.url);
                          return (
                            <li key={attachmentId}>
                              {canDownload ? (
                                <Button
                                  variant="link"
                                  className="h-auto p-0"
                                  onClick={() => downloadAttachment(attachment, attachmentId)}
                                  disabled={downloadingId === attachmentId}
                                >
                                  {downloadingId === attachmentId ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Downloading...
                                    </span>
                                  ) : (
                                    attachment.name ? `Download ${attachment.name}` : "Download file"
                                  )}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">{attachment.name ?? `Attachment ${index + 1}`} (unavailable)</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  {/* Placeholder for future: open detailed task view */}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeTasks;

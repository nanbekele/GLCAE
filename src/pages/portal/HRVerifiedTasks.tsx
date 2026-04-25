import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ServiceRequestAttachment, ServiceRequestRow } from "@/lib/portalRequests";
import { createClientServiceRequest, updateServiceRequestNotes } from "@/lib/portalRequests";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, Home, ArrowLeft } from "lucide-react";

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
        return (val as string[]).filter(Boolean).map((u) => ({ name: deriveNameFromUrl(u), url: u }));
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

type VerifiedFilter = "all" | "submitted" | "not_submitted";

const SUBMITTED_MARKER = "[SENT_TO_CLIENT]";
const DELIVERY_SCHEDULED_MARKER = "[DELIVERY_SCHEDULED]";

const isSubmittedToClient = (row: ServiceRequestRow) => {
  const notes = String((row as any)?.notes ?? "");
  return notes.includes(SUBMITTED_MARKER);
};

const isDeliveryScheduled = (row: ServiceRequestRow) => {
  const notes = String((row as any)?.notes ?? "");
  return notes.includes(DELIVERY_SCHEDULED_MARKER);
};

const HRVerifiedTasks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token } = useAuth();

  const [verifiedReports, setVerifiedReports] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forwardingClientId, setForwardingClientId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VerifiedFilter>("all");

  const sortedReports = useMemo(
    () =>
      [...verifiedReports].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      ),
    [verifiedReports],
  );

  const filteredReports = useMemo(() => {
    if (filter === "all") return sortedReports;
    if (filter === "submitted") return sortedReports.filter((r) => isSubmittedToClient(r));
    return sortedReports.filter((r) => !isSubmittedToClient(r));
  }, [filter, sortedReports]);

  const loadVerifiedReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("service_requests")
        .select("*")
        .eq("service_type", "HR Coordination")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      setVerifiedReports((data ?? []) as unknown as ServiceRequestRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load verified tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVerifiedReports();
  }, [loadVerifiedReports]);

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
      const { data, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60, { download: filename });
      if (signError || !data?.signedUrl) throw new Error(signError?.message ?? "Unable to generate download link");
      const resp = await fetch(data.signedUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      saveBlob(blob);
    };

    setDownloadingAttachmentId(identifier);
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
          const { data, error: downloadError } = await supabase.storage.from(pathParts.bucket).download(pathParts.objectPath);
          if (downloadError || !data) throw new Error(downloadError?.message ?? "Unable to download file from storage");
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
            const { data, error: downloadError } = await supabase.storage
              .from(publicParts.bucket)
              .download(publicParts.objectPath);
            if (downloadError || !data) throw new Error(downloadError?.message ?? "Unable to download file from storage");
            saveBlob(data);
          }
          return;
        }

        const resp = await fetch(attachment.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        saveBlob(blob);
        return;
      }

      throw new Error("Attachment does not include downloadable content.");
    } catch (e: any) {
      toast({
        title: "Download failed",
        description: e?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleSendToClient = async (req: ServiceRequestRow) => {
    if (!req?.client_id) {
      toast({ title: "Missing client", description: "This report has no client to send to.", variant: "destructive" });
      return;
    }

    if (isSubmittedToClient(req)) {
      toast({ title: "Already submitted", description: "This task was already sent to the client." });
      return;
    }

    setForwardingClientId(req.id);
    try {
      const normalized = normalizeVerifiedAttachments(req);
      const prepared: ServiceRequestAttachment[] = (normalized ?? []).map((a) => ({
        name: a.name,
        url: a.url,
        type: null,
        size: null,
        path: null,
        content: null,
      }));

      const baseDescription = req.description || "Forwarded report from HR";
      const linkedDescription = `${baseDescription}${baseDescription.trim() ? "\n\n" : ""}[ORIGINAL_TASK_ID] ${req.id}`;

      await createClientServiceRequest({
        clientId: req.client_id,
        title: req.title || "Report",
        description: linkedDescription,
        serviceType: "Client Delivery",
        attachments: prepared,
        token,
      });

      const nextNotes = `${String((req as any)?.notes ?? "").trim()}${String((req as any)?.notes ?? "").trim() ? "\n\n" : ""}${SUBMITTED_MARKER} ${new Date().toISOString()}`;
      await updateServiceRequestNotes(req.id, nextNotes);
      setVerifiedReports((prev) => prev.map((r) => (r.id === req.id ? ({ ...(r as any), notes: nextNotes } as any) : r)));

      toast({ title: "Sent to client", description: "A copy of the report was forwarded to the original client." });
    } catch (e: any) {
      toast({ title: "Forward failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setForwardingClientId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Verified Tasks</h1>
              <p className="opacity-90">Reports verified by department heads and forwarded to HR.</p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="bg-white/20 hover:bg-white/30" onClick={() => navigate("/portal/hr")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to HR Dashboard
            </Button>
            <Button variant="secondary" className="bg-white/20 hover:bg-white/30" onClick={() => void loadVerifiedReports()} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Refreshing…</span>
              ) : (
                "Refresh"
              )}
            </Button>
            <div className="ml-auto min-w-[210px]">
              <Select value={filter} onValueChange={(value) => setFilter(value as VerifiedFilter)}>
                <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All verified tasks</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="not_submitted">Not-submitted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ClipboardList size={20} />
              <span>Verified Tasks List</span>
            </CardTitle>
            <CardDescription>Newest items appear first.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-4">{error}</div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading verified tasks…
              </div>
            ) : filteredReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verified tasks yet.</p>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((req) => {
                  const attachments = normalizeVerifiedAttachments(req as any);
                  const submitted = isSubmittedToClient(req);
                  const scheduled = isDeliveryScheduled(req);
                  const isSending = forwardingClientId === req.id;
                  const deliveryButtonVariant = scheduled ? "default" : "outline";
                  const deliveryButtonClassName = scheduled
                    ? "mr-2 bg-success text-success-foreground border-success/30 hover:bg-success/90"
                    : "mr-2";
                  return (
                    <div key={req.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-medium text-foreground">{req.title}</h4>
                          <p className="text-xs text-muted-foreground">Verified · {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                        </div>
                        <Badge variant="outline" className="uppercase">{req.service_type ?? "HR Coordination"}</Badge>
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
                                  <Button
                                    variant="link"
                                    className="h-auto p-0"
                                    onClick={() =>
                                      void downloadAttachment({ name: a.name, url: a.url } as any, id)
                                    }
                                    disabled={downloadingAttachmentId === id}
                                  >
                                    {downloadingAttachmentId === id
                                      ? "Downloading…"
                                      : a.name
                                        ? `Download ${a.name}`
                                        : "Download file"}
                                  </Button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant={deliveryButtonVariant as any}
                          className={deliveryButtonClassName}
                          onClick={() => navigate(`/portal/hr/verified-tasks/${req.id}/delivery-scheduling`)}
                        >
                          {scheduled ? "Scheduled" : "Delivery scheduling"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleSendToClient(req)}
                          disabled={isSending || submitted}
                          className={submitted ? "bg-foreground text-background hover:bg-foreground/90" : undefined}
                        >
                          {isSending ? (
                            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending…</span>
                          ) : submitted ? (
                            "Submitted"
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
    </div>
  );
};

export default HRVerifiedTasks;

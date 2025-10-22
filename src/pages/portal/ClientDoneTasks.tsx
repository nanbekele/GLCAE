import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, RefreshCcw } from "lucide-react";
import type { ServiceRequestAttachment, ServiceRequestRow } from "@/lib/portalRequests";

const DEFAULT_SERVICE_REQUEST_BUCKET = "service-request-files";

const ClientDoneTasks = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const normalizeAttachments = (raw: any): ServiceRequestAttachment[] => {
    const source = (raw as any)?.attachment_urls ?? (raw as any)?.attachments ?? raw;
    if (source === null || typeof source === "undefined") return [];
    if (typeof source === "string") {
      const url = source.trim();
      if (!url) return [];
      return [{ name: deriveNameFromUrl(url), url, type: null, size: null, path: null, content: null }];
    }
    if (Array.isArray(source) && source.every((x) => typeof x === "string")) {
      return (source as string[]).map((url) => ({
        name: deriveNameFromUrl(url),
        url,
        type: null,
        size: null,
        path: null,
        content: null,
      }));
    }
    if (Array.isArray(source)) return source as ServiceRequestAttachment[];
    return [];
  };

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

  const downloadAttachment = async (attachment: ServiceRequestAttachment, identifier: string) => {
    if (typeof window === "undefined") return;
    const filename = attachment.name ?? (attachment.url ? deriveNameFromUrl(attachment.url) : "service-request-attachment");

    const triggerOpen = (url: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const signedOpen = async (bucket: string, objectPath: string) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60, { download: filename });
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Unable to generate download link");
      triggerOpen(data.signedUrl);
    };

    setDownloadingId(identifier);
    try {
      if (attachment.content?.startsWith("data:")) {
        triggerOpen(attachment.content);
        return;
      }
      const parts = inferStorageLocationFromPath(attachment.path);
      if (parts) {
        await signedOpen(parts.bucket, parts.objectPath);
        return;
      }
      if (attachment.url) {
        // Prefer direct open for public buckets
        triggerOpen(attachment.url);
        return;
      }
      throw new Error("Attachment does not include downloadable content.");
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Please try again later.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("client_id", profile.id)
        .eq("service_type", "Client Delivery")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems((data ?? []) as unknown as ServiceRequestRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load delivered tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.id]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Done Task</h1>
            <p className="text-muted-foreground">Reports shared to you by HR.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/client-portal")}>
              <ArrowLeft className="h-4 w-4 mr-2"/> Back to Dashboard
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/> Refreshing</span>
              ) : (
                <span className="inline-flex items-center gap-1"><RefreshCcw className="h-4 w-4"/> Refresh</span>
              )}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive mb-4">{error}</div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin"/> Loading delivered tasks...
          </div>
        ) : items.length === 0 ? (
          <Card className="shadow-card border-card-border">
            <CardContent className="p-6 text-muted-foreground text-sm">No delivered tasks yet.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((req) => {
              const attachments = normalizeAttachments(req as any);
              return (
                <Card key={req.id} className="shadow-card border-card-border">
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{req.title}</CardTitle>
                      <CardDescription>{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="uppercase">{req.service_type}</Badge>
                      <Badge variant="secondary">Priority {req.priority ?? '#'}</Badge>
                      <Badge variant="outline">{req.status ?? 'pending'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {req.description ? (
                      <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{req.description}</p>
                    ) : null}
                    {attachments.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-foreground">Attachments</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {attachments.map((a, idx) => {
                            const id = a.path ?? a.url ?? `${req.id}-att-${idx}`;
                            const canDownload = Boolean(a.content || a.path || a.url);
                            return (
                              <li key={id}>
                                {canDownload ? (
                                  <Button
                                    variant="link"
                                    className="h-auto p-0"
                                    onClick={() => void downloadAttachment(a, id)}
                                    disabled={downloadingId === id}
                                  >
                                    {downloadingId === id ? (
                                      <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/>Downloading...</span>
                                    ) : (
                                      a.name ? `Download ${a.name}` : "Download file"
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDoneTasks;

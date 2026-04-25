import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, RefreshCcw } from "lucide-react";
import type { ServiceRequestAttachment, ServiceRequestRow } from "@/lib/portalRequests";

const DEFAULT_SERVICE_REQUEST_BUCKET = "service-request-files";

type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string;
  client_id: string | null;
  created_at: string;
};

const DELIVERY_SCHEDULED_MARKER = "[DELIVERY_SCHEDULED]";

const parseScheduledDateFromNotes = (notes: string | null | undefined) => {
  const src = String(notes ?? "");
  const idx = src.indexOf(DELIVERY_SCHEDULED_MARKER);
  if (idx === -1) return null;
  const rest = src.slice(idx + DELIVERY_SCHEDULED_MARKER.length).trim();
  const firstToken = rest.split(/\s+/).find(Boolean) ?? "";
  if (!firstToken) return null;
  const parsed = new Date(firstToken);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const originalTaskIdFromDescription = (description: string | null | undefined) => {
  const src = String(description ?? "");
  const markerMatch = src.match(/\[ORIGINAL_TASK_ID\]\s*([0-9a-fA-F-]{10,})/);
  if (markerMatch?.[1]) return markerMatch[1];

  const labeledMatch = src.match(/Original\s*Task\s*ID\s*:?\s*([0-9a-fA-F-]{10,})/i);
  if (labeledMatch?.[1]) return labeledMatch[1];

  const uuidMatch = src.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return uuidMatch?.[0] ?? null;
};

const deliverySubjectForTask = (taskId: string) => `[DELIVERY_SCHEDULING:${taskId}]`;

const ClientDoneTasks = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [activeTask, setActiveTask] = useState<ServiceRequestRow | null>(null);
  const [chatMessages, setChatMessages] = useState<ContactMessageRow[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const [previewUrlById, setPreviewUrlById] = useState<Record<string, string>>({});
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);

  const activeOriginalTaskId = useMemo(() => {
    if (!activeTask) return null;
    return originalTaskIdFromDescription((activeTask as any)?.description ?? null) ?? activeTask.id;
  }, [activeTask]);

  const threadCandidates = useMemo(() => {
    if (!activeTask) return [] as string[];
    const original = originalTaskIdFromDescription((activeTask as any)?.description ?? null);
    const delivered = activeTask.id;
    const set = new Set<string>();
    if (original) set.add(original);
    if (delivered) set.add(delivered);
    return Array.from(set);
  }, [activeTask]);

  const activeSubjects = useMemo(() => {
    return threadCandidates.map(deliverySubjectForTask);
  }, [threadCandidates]);

  const activeSubject = useMemo(() => {
    if (activeThreadId) return deliverySubjectForTask(activeThreadId);
    if (!activeOriginalTaskId) return null;
    return deliverySubjectForTask(activeOriginalTaskId);
  }, [activeOriginalTaskId, activeThreadId]);

  const activeScheduled = useMemo(() => {
    if (!activeTask) return null;
    return parseScheduledDateFromNotes((activeTask as any)?.notes ?? null);
  }, [activeTask]);

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

  const getAttachmentPreviewUrl = (attachment: ServiceRequestAttachment, identifier: string) => {
    if (attachment.content?.startsWith("data:")) return attachment.content;
    if (previewUrlById[identifier]) return previewUrlById[identifier];
    if (attachment.url) return attachment.url;
    return null;
  };

  const detectAttachmentKind = (attachment: ServiceRequestAttachment) => {
    const name = String(attachment.name ?? "");
    const url = String(attachment.url ?? "");
    const content = String(attachment.content ?? "");
    const src = `${name} ${url} ${content}`.toLowerCase();

    const hasExt = (ext: string) => src.includes(`.${ext}`);
    if (content.startsWith("data:image/")) return "image" as const;
    if (content.startsWith("data:video/")) return "video" as const;
    if (content.startsWith("data:application/pdf")) return "pdf" as const;

    if (hasExt("png") || hasExt("jpg") || hasExt("jpeg") || hasExt("gif") || hasExt("webp") || hasExt("bmp") || hasExt("svg")) {
      return "image" as const;
    }
    if (hasExt("mp4") || hasExt("webm") || hasExt("mov") || hasExt("m4v") || hasExt("avi")) {
      return "video" as const;
    }
    if (hasExt("pdf")) return "pdf" as const;
    return "file" as const;
  };

  const loadPreviewUrl = async (attachment: ServiceRequestAttachment, identifier: string) => {
    if (previewUrlById[identifier]) return;
    if (attachment.content?.startsWith("data:")) return;
    if (attachment.url) return;
    const parts = inferStorageLocationFromPath(attachment.path);
    if (!parts) return;

    setLoadingPreviewId(identifier);
    try {
      const { data, error } = await supabase.storage
        .from(parts.bucket)
        .createSignedUrl(parts.objectPath, 60);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Unable to generate preview link");
      setPreviewUrlById((prev) => ({ ...prev, [identifier]: data.signedUrl }));
    } catch (e: any) {
      toast({ title: "Preview failed", description: e?.message ?? "Please try again later.", variant: "destructive" });
    } finally {
      setLoadingPreviewId(null);
    }
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

  useEffect(() => {
    if (!activeTask?.id) return;
    const deliveredId = activeTask.id;

    const channel = supabase
      .channel(`client-done-task-${deliveredId.slice(0, 8)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_requests", filter: `id=eq.${deliveredId}` },
        (payload) => {
          const row = payload.new as any;
          setActiveTask((prev) => (prev ? ({ ...(prev as any), ...row } as any) : prev));
          setItems((prev) => prev.map((it) => (it.id === deliveredId ? ({ ...(it as any), ...row } as any) : it)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTask?.id]);

  useEffect(() => {
    if (!profile?.id || activeSubjects.length === 0) return;
    const channel = supabase
      .channel(`client-delivery-scheduling-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages", filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as any as ContactMessageRow;
          if (!row?.subject || !activeSubjects.includes(row.subject)) return;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSubjects, profile?.id]);

  const openDeliveryChat = async (task: ServiceRequestRow) => {
    setActiveTask(task);
    setChatMessages([]);
    setChatInput("");
    setActiveThreadId(null);

    const original = originalTaskIdFromDescription((task as any)?.description ?? null);
    const delivered = task.id;
    const candidates = Array.from(new Set([original, delivered].filter(Boolean) as string[]));
    const subjects = candidates.map(deliverySubjectForTask);
    if (!profile?.id) return;

    setChatLoading(true);
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .eq("client_id", profile.id)
        .in("subject", subjects)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      const rows = (data ?? []) as unknown as ContactMessageRow[];
      setChatMessages(rows);

      const subjectCount = new Map<string, number>();
      for (const r of rows) {
        if (!r.subject) continue;
        subjectCount.set(r.subject, (subjectCount.get(r.subject) ?? 0) + 1);
      }

      const pickedSubject = subjects.find((s) => (subjectCount.get(s) ?? 0) > 0) ?? subjects[0] ?? null;
      if (pickedSubject) {
        const match = String(pickedSubject).match(/^\[DELIVERY_SCHEDULING:(.+)\]$/);
        const pickedThread = match?.[1] ?? null;
        setActiveThreadId(pickedThread ?? (original ?? delivered ?? null));
      } else {
        setActiveThreadId(original ?? delivered ?? null);
      }
    } catch (e: any) {
      toast({ title: "Load failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  const sendDeliveryChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) {
      toast({ title: "Message required", description: "Enter a message before sending.", variant: "destructive" });
      return;
    }
    if (!profile?.id) return;
    if (!activeTask) return;

    const threadId = activeThreadId
      ?? originalTaskIdFromDescription((activeTask as any)?.description ?? null)
      ?? activeTask.id;
    const subject = deliverySubjectForTask(threadId);

    setChatSending(true);
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .insert({
          name: profile.full_name ?? "Client",
          email: profile.email ?? "client@local",
          phone: profile.phone ?? null,
          subject,
          message: trimmed,
          status: "new",
          client_id: profile.id,
        })
        .select("*")
        .single();

      if (error) throw error;
      setChatInput("");
      if (data) {
        const row = data as unknown as ContactMessageRow;
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setChatSending(false);
    }
  };

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
              const originalId = originalTaskIdFromDescription((req as any)?.description ?? null);
              const threadId = originalId ?? req.id;
              return (
                <Card key={req.id} className="shadow-card border-card-border">
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{req.title}</CardTitle>
                      <CardDescription>{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {parseScheduledDateFromNotes((req as any)?.notes ?? null)
                          ? `Delivery scheduled: ${parseScheduledDateFromNotes((req as any)?.notes ?? null)!.toLocaleString()}`
                          : "Delivery not scheduled yet."}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openDeliveryChat(req)}
                          >
                            Delivery scheduling
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Delivery scheduling conversation</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="rounded-md border border-border bg-muted/20 p-3">
                              <div className="text-sm font-medium text-foreground">Scheduled delivery</div>
                              <div className="text-sm text-muted-foreground">
                                {activeScheduled ? activeScheduled.toLocaleString() : "Not scheduled yet"}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Thread: {threadId}
                              </div>
                            </div>

                            <div className="rounded-md border border-border bg-muted/10 p-3">
                              {chatLoading ? (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading messages…
                                </div>
                              ) : chatMessages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No messages yet.</p>
                              ) : (
                                <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                                  {chatMessages.map((m) => {
                                    const sender = String(m.email ?? "").toLowerCase();
                                    const isSelf = !!profile?.email && sender === String(profile.email).toLowerCase();
                                    return (
                                      <div key={m.id} className={`rounded-md border border-border bg-background px-3 py-2 ${isSelf ? "border-primary/30" : ""}`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-xs font-medium text-foreground">{isSelf ? "You" : m.email}</div>
                                          <div className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="mt-1 text-sm text-foreground whitespace-pre-line break-words">{m.message}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                rows={3}
                                placeholder="Write a message to HR…"
                                disabled={chatSending}
                              />
                              <div className="flex justify-end">
                                <Button onClick={() => void sendDeliveryChat()} disabled={chatSending}>
                                  {chatSending ? "Sending…" : "Send"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {req.description ? (
                      <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{req.description}</p>
                    ) : null}
                    {attachments.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-foreground">Attachments</p>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {attachments.map((a, idx) => {
                            const id = a.path ?? a.url ?? `${req.id}-att-${idx}`;
                            const canDownload = Boolean(a.content || a.path || a.url);
                            const kind = detectAttachmentKind(a);
                            const previewUrl = getAttachmentPreviewUrl(a, id);
                            const showLoadPreview = !previewUrl && Boolean(a.path);

                            return (
                              <div key={id} className="rounded-md border border-border bg-background overflow-hidden">
                                <div className="p-3 border-b border-border">
                                  <div className="text-sm font-medium text-foreground truncate">{a.name ?? `Attachment ${idx + 1}`}</div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {showLoadPreview ? (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => void loadPreviewUrl(a, id)}
                                        disabled={loadingPreviewId === id}
                                      >
                                        {loadingPreviewId === id ? (
                                          <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</span>
                                        ) : (
                                          "Load preview"
                                        )}
                                      </Button>
                                    ) : null}
                                    {canDownload ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void downloadAttachment(a, id)}
                                        disabled={downloadingId === id}
                                      >
                                        {downloadingId === id ? (
                                          <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/>Downloading…</span>
                                        ) : (
                                          "Download"
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Unavailable</span>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-muted/20">
                                  {previewUrl && kind === "image" ? (
                                    <img src={previewUrl} alt={a.name ?? "attachment"} className="w-full h-36 object-contain bg-background" />
                                  ) : previewUrl && kind === "video" ? (
                                    <video src={previewUrl} controls className="w-full h-36 bg-background" />
                                  ) : previewUrl && kind === "pdf" ? (
                                    <iframe title={a.name ?? "pdf"} src={previewUrl} className="w-full h-44 bg-background" />
                                  ) : (
                                    <div className="p-4 text-sm text-muted-foreground">
                                      {previewUrl ? "Preview not available for this file type." : "Preview not loaded."}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
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

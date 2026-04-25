import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { updateServiceRequestNotes } from "@/lib/portalRequests";
import { callFunction } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, Home, ArrowLeft, MessageSquare } from "lucide-react";

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

type ServiceRequestRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  service_type: string | null;
  client_id: string | null;
  notes?: string | null;
  created_at: string;
};

const deliverySubjectForTask = (taskId: string) => `[DELIVERY_SCHEDULING:${taskId}]`;

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

const formatDateTimeLocal = (value: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

const HRDeliveryScheduling = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, token } = useAuth();
  const { taskId } = useParams();

  const [task, setTask] = useState<ServiceRequestRow | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [clientEmailError, setClientEmailError] = useState<string | null>(null);

  const subject = useMemo(() => (taskId ? deliverySubjectForTask(taskId) : null), [taskId]);

  const load = useCallback(async () => {
    const id = typeof taskId === "string" ? taskId.trim() : "";
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: taskRow, error: taskError } = await supabase
        .from("service_requests")
        .select("id, title, description, status, service_type, client_id, notes, created_at")
        .eq("id", id)
        .maybeSingle();

      if (taskError) throw taskError;
      if (!taskRow) {
        toast({ title: "Not found", description: "Verified task not found.", variant: "destructive" });
        setTask(null);
        setClientEmail(null);
        setMessages([]);
        return;
      }

      setTask(taskRow as unknown as ServiceRequestRow);

      const existingScheduled = parseScheduledDateFromNotes((taskRow as any)?.notes ?? null);
      setScheduledFor(existingScheduled ? formatDateTimeLocal(existingScheduled) : "");

      const clientId = (taskRow as any)?.client_id ?? null;
      if (clientId) {
        setClientEmailError(null);
        let resolvedEmail: string | null = null;
        if (token) {
          try {
            const response = await callFunction<{ profile?: { id: string; email: string }; error?: string }>(
              "marketing-manage",
              { action: "hr-get-profile-email", profileId: clientId },
              { token, useAnonAuth: false },
            );
            if (response?.error) {
              throw new Error(response.error);
            }
            resolvedEmail = response?.profile?.email ?? null;
          } catch (e: any) {
            setClientEmailError(e?.message ?? "Unable to load client email.");
          }
        }

        if (!resolvedEmail) {
          try {
            const { data: clientProfile, error: profileError } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", clientId)
              .maybeSingle();

            if (profileError) throw profileError;
            resolvedEmail = (clientProfile as any)?.email ?? null;
          } catch (e: any) {
            setClientEmailError((prev) => prev ?? (e?.message ?? "Unable to load client email."));
          }
        }

        setClientEmail(resolvedEmail);
      } else {
        setClientEmail(null);
        setClientEmailError(null);
      }

      if (clientId && subject) {
        const { data: msgRows, error: msgError } = await supabase
          .from("contact_messages")
          .select("*")
          .eq("client_id", clientId)
          .eq("subject", subject)
          .order("created_at", { ascending: true })
          .limit(200);

        if (msgError) throw msgError;
        setMessages((msgRows ?? []) as unknown as ContactMessageRow[]);
      } else {
        setMessages([]);
      }
    } catch (e: any) {
      console.error("[HRDeliveryScheduling] load failed", e);
      toast({ title: "Load failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [subject, taskId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const clientId = task?.client_id ?? null;
    if (!clientId || !subject) return;

    const channel = supabase
      .channel(`hr-delivery-scheduling-${String(taskId ?? "").slice(0, 8)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages", filter: `client_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as any as ContactMessageRow;
          if (row?.subject !== subject) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [subject, task?.client_id, taskId]);

  const handleSend = useCallback(async () => {
    const trimmed = messageInput.trim();
    if (!trimmed) {
      toast({ title: "Message required", description: "Enter a message before sending.", variant: "destructive" });
      return;
    }

    const clientId = task?.client_id ?? null;
    if (!clientId || !subject) {
      toast({ title: "Client missing", description: "This task does not have a linked client.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const senderName = profile?.full_name ?? "HR";
      const senderEmail = profile?.email ?? "hr@local";

      const { data, error } = await supabase
        .from("contact_messages")
        .insert({
          name: senderName,
          email: senderEmail,
          phone: null,
          subject,
          message: trimmed,
          status: "new",
          client_id: clientId,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      setMessageInput("");
      if (data) {
        const row = data as unknown as ContactMessageRow;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      } else {
        void load();
      }
    } catch (e: any) {
      console.error("[HRDeliveryScheduling] send failed", e);
      toast({ title: "Send failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [load, messageInput, profile?.email, profile?.full_name, subject, task?.client_id, toast]);

  const handleSaveSchedule = useCallback(async () => {
    const id = task?.id ?? null;
    if (!id) return;

    const trimmed = scheduledFor.trim();
    if (!trimmed) {
      toast({ title: "Delivery date required", description: "Select a delivery date & time.", variant: "destructive" });
      return;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      toast({ title: "Invalid date", description: "Please provide a valid delivery date.", variant: "destructive" });
      return;
    }

    setSavingSchedule(true);
    try {
      const prevNotes = String(task?.notes ?? "");
      const cleaned = prevNotes
        ? prevNotes
            .split("\n")
            .filter((line) => !line.includes(DELIVERY_SCHEDULED_MARKER))
            .join("\n")
            .trim()
        : "";

      const nextNotes = `${cleaned}${cleaned ? "\n\n" : ""}${DELIVERY_SCHEDULED_MARKER} ${parsed.toISOString()}`;
      await updateServiceRequestNotes(id, nextNotes);
      setTask((prev) => (prev ? { ...prev, notes: nextNotes } : prev));

      const clientId = task?.client_id ?? null;
      if (clientId) {
        try {
          const { data: copies } = await supabase
            .from("service_requests")
            .select("id, notes, description")
            .eq("client_id", clientId)
            .eq("service_type", "Client Delivery")
            .ilike("description", `%[ORIGINAL_TASK_ID] ${id}%`)
            .limit(5);

          const copy = (copies ?? [])[0] as any;
          if (copy?.id) {
            const prevCopyNotes = String(copy?.notes ?? "");
            const cleanedCopy = prevCopyNotes
              ? prevCopyNotes
                  .split("\n")
                  .filter((line) => !line.includes(DELIVERY_SCHEDULED_MARKER))
                  .join("\n")
                  .trim()
              : "";
            const nextCopyNotes = `${cleanedCopy}${cleanedCopy ? "\n\n" : ""}${DELIVERY_SCHEDULED_MARKER} ${parsed.toISOString()}`;
            await updateServiceRequestNotes(copy.id, nextCopyNotes);
          }
        } catch (e) {
          // Best effort only; the HR schedule save should still succeed.
        }
      }
      toast({ title: "Scheduled", description: "Delivery date saved." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSavingSchedule(false);
    }
  }, [scheduledFor, task?.id, task?.notes, toast]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Delivery scheduling</h1>
              <p className="opacity-90">Chat with the original client to arrange delivery.</p>
            </div>
            <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-primary-foreground">
              <a href="/">
                <Home className="h-4 w-4 mr-2" /> Back to Homepage
              </a>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="bg-white/20 hover:bg-white/30"
              onClick={() => navigate("/portal/hr/verified-tasks")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Verified Tasks
            </Button>
          </div>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <span>Client conversation</span>
            </CardTitle>
            <CardDescription>
              {task ? (
                <span>
                  Task: <strong>{task.title}</strong>
                </span>
              ) : (
                "Loading task…"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-foreground">Client email</p>
                  <p className="text-sm text-muted-foreground">{clientEmail ?? "—"}</p>
                  {clientEmailError ? (
                    <p className="mt-1 text-xs text-destructive">{clientEmailError}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Delivery date</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
                    <Button onClick={() => void handleSaveSchedule()} disabled={savingSchedule || loading || !task?.id}>
                      {savingSchedule ? "Saving…" : "Schedule"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation…
              </div>
            ) : !taskId ? (
              <p className="text-sm text-muted-foreground">Missing task id.</p>
            ) : !task ? (
              <p className="text-sm text-muted-foreground">Task not found.</p>
            ) : !task.client_id ? (
              <p className="text-sm text-muted-foreground">This task has no linked client.</p>
            ) : (
              <>
                <div className="h-[360px] rounded-lg border border-border bg-muted/30">
                  <ScrollArea className="h-[360px] p-3">
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((m) => {
                          const senderEmail = String(m.email ?? "").toLowerCase();
                          const isSelf = profile?.email && senderEmail === String(profile.email).toLowerCase();
                          return (
                            <div key={m.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                                  isSelf ? "bg-primary text-primary-foreground" : "bg-background border"
                                }`}
                              >
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                                  {isSelf ? "HR" : clientEmail ? clientEmail : "Client"}
                                </div>
                                <div className="whitespace-pre-line break-words">{m.message}</div>
                                <div className="mt-1 text-[10px] opacity-70">
                                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="space-y-2">
                  <Textarea
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    placeholder="Write a message to the client…"
                    rows={3}
                    disabled={sending}
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => void handleSend()} disabled={sending}>
                      {sending ? "Sending…" : "Send"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HRDeliveryScheduling;

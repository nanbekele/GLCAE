import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

import { ChevronLeft, Loader2, MessageCircle, Send } from "lucide-react";

type ContactMessageRow = Database["public"]["Tables"]["contact_messages"]["Row"];

type SupportThread = {
  clientId: string;
  clientEmail: string | null;
  clientName: string | null;
  lastMessage: string;
  lastAt: string;
};

const HR_SUPPORT_SUBJECT = "[HR_SUPPORT]";

const HRSupportChat = () => {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages],
  );

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("id, client_id, name, email, subject, message, created_at")
        .eq("subject", HR_SUPPORT_SUBJECT)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      const byClient = new Map<string, SupportThread>();
      for (const row of (data ?? []) as any as ContactMessageRow[]) {
        const clientId = (row as any).client_id as string | null;
        if (!clientId) continue;
        if (byClient.has(clientId)) continue;
        byClient.set(clientId, {
          clientId,
          clientEmail: row.email ?? null,
          clientName: row.name ?? null,
          lastMessage: row.message ?? "",
          lastAt: row.created_at,
        });
      }

      const next = Array.from(byClient.values()).sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
      setThreads(next);

      if (!activeClientId && next.length > 0) {
        setActiveClientId(next[0].clientId);
      } else if (activeClientId && !next.some((t) => t.clientId === activeClientId)) {
        setActiveClientId(next[0]?.clientId ?? null);
      }
    } catch (e: any) {
      console.error("[HRSupportChat] loadThreads failed", e);
      toast({ title: "Unable to load support threads", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoadingThreads(false);
    }
  }, [activeClientId, toast]);

  const loadMessages = useCallback(async (clientId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .eq("client_id", clientId)
        .eq("subject", HR_SUPPORT_SUBJECT)
        .order("created_at", { ascending: true })
        .limit(300);

      if (error) throw error;
      setMessages((data ?? []) as ContactMessageRow[]);
    } catch (e: any) {
      console.error("[HRSupportChat] loadMessages failed", e);
      toast({ title: "Unable to load messages", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setLoadingMessages(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!activeClientId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeClientId);
  }, [activeClientId, loadMessages]);

  useEffect(() => {
    const channel = supabase
      .channel("hr-support-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages" },
        (payload) => {
          const row = payload.new as any as ContactMessageRow;
          if ((row as any)?.subject !== HR_SUPPORT_SUBJECT) return;

          void loadThreads();

          const clientId = (row as any)?.client_id ?? null;
          if (!clientId || !activeClientId || clientId !== activeClientId) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClientId, loadThreads]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      toast({ title: "Message required", description: "Enter a message before sending.", variant: "destructive" });
      return;
    }
    if (!activeClientId) return;

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
          subject: HR_SUPPORT_SUBJECT,
          message: trimmed,
          status: "new",
          client_id: activeClientId,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      setInput("");
      if (data) {
        const row = data as unknown as ContactMessageRow;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
      } else {
        void loadMessages(activeClientId);
      }
    } catch (e: any) {
      console.error("[HRSupportChat] send failed", e);
      toast({ title: "Send failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [activeClientId, input, loadMessages, profile?.email, profile?.full_name, toast]);

  const activeThread = useMemo(
    () => (activeClientId ? threads.find((t) => t.clientId === activeClientId) ?? null : null),
    [activeClientId, threads],
  );

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/portal/hr">HR Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <span>Support Chat</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Client Support Chat</h1>
            <p className="text-muted-foreground">Communicate with clients about service requests using the shared chat thread.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/portal/hr">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-card-border shadow-card lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Threads
              </CardTitle>
              <CardDescription>Clients who messaged HR support</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  {loadingThreads ? "Loading…" : `${threads.length} thread(s)`}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void loadThreads()} disabled={loadingThreads}>
                  {loadingThreads ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
              </div>

              <div className="space-y-2">
                {threads.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No support conversations yet.</div>
                ) : (
                  threads.map((t) => (
                    <button
                      key={t.clientId}
                      type="button"
                      onClick={() => setActiveClientId(t.clientId)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        t.clientId === activeClientId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-foreground truncate">
                          {t.clientName ?? t.clientEmail ?? t.clientId.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(t.lastAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.lastMessage}</div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                {activeThread?.clientEmail ? `Client email: ${activeThread.clientEmail}` : "Select a thread to view messages."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[420px] rounded-lg border border-border bg-muted/20">
                <ScrollArea className="h-[420px] p-4">
                  {loadingMessages && messages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Loading messages…</div>
                  ) : sortedMessages.length > 0 ? (
                    <div className="space-y-3">
                      {sortedMessages.map((m) => {
                        const isSelf = (m.email ?? "") === (profile?.email ?? "");
                        return (
                          <div key={m.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                                isSelf ? "bg-primary text-primary-foreground" : "bg-background border"
                              }`}
                            >
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                                {isSelf ? "HR" : (m.name ?? m.email ?? "Client")}
                              </div>
                              <div className="whitespace-pre-line break-words">{m.message}</div>
                              <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No messages in this thread yet.</div>
                  )}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={activeClientId ? "Write a message to the client..." : "Select a thread first"}
                  rows={4}
                  disabled={!activeClientId || sending}
                />
                <div className="flex items-center justify-end">
                  <Button type="button" onClick={() => void handleSend()} disabled={!activeClientId || sending}>
                    {sending ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><Send className="h-4 w-4"/>Send</span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HRSupportChat;

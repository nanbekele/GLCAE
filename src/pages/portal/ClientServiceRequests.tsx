import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { PortalRequestManager, type SentRequest } from "@/components/portal/PortalRequestManager";
import { ChevronLeft, Inbox, Loader2, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { createClientServiceRequest, uploadServiceRequestAttachments } from "@/lib/portalRequests";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type ServiceRequestRow = Database["public"]["Tables"]["service_requests"]["Row"];

type ContactMessageRow = Database["public"]["Tables"]["contact_messages"]["Row"];

const HR_SUPPORT_SUBJECT = "[HR_SUPPORT]";

const ClientServiceRequests = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ContactMessageRow[]>([]);

  const handleSubmit = useCallback(
    async (request: SentRequest) => {
      if (!profile?.id) {
        toast({
          title: "Not signed in",
          description: "Please sign in to submit a service request.",
          variant: "destructive",
        });
        throw new Error("Not authenticated");
      }

      try {
        setSaving(true);

        const attachmentsMetadata = request.originalFiles && request.originalFiles.length > 0
          ? await uploadServiceRequestAttachments(request.originalFiles)
          : [];

        await createClientServiceRequest({
          clientId: profile.id,
          title: request.title,
          description: request.details,
          serviceType: "HR",
          priority: "medium",
          attachments: attachmentsMetadata,
        });
      } catch (error: any) {
        console.error("[ClientServiceRequests] Failed to submit", error);
        toast({
          title: "Failed to submit",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [profile?.id, toast],
  );

  const sortedChatMessages = useMemo(
    () => [...chatMessages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [chatMessages],
  );

  const loadChat = useCallback(async () => {
    if (!profile?.id) return;
    setChatLoading(true);
    try {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .eq("client_id", profile.id)
        .eq("subject", HR_SUPPORT_SUBJECT)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      setChatMessages((data ?? []) as ContactMessageRow[]);
    } catch (e: any) {
      console.error("[ClientServiceRequests] loadChat failed", e);
      toast({ title: "Unable to load chat", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  }, [profile?.id, toast]);

  useEffect(() => {
    if (!chatOpen) return;
    void loadChat();
  }, [chatOpen, loadChat]);

  useEffect(() => {
    if (!profile?.id || !chatOpen) return;

    const channel = supabase
      .channel(`client-hr-support-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages", filter: `client_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as any as ContactMessageRow;
          if ((row as any)?.subject !== HR_SUPPORT_SUBJECT) return;
          setChatMessages((prev) => {
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
  }, [chatOpen, profile?.id]);

  const handleSendChat = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) {
      toast({ title: "Message required", description: "Enter a message before sending.", variant: "destructive" });
      return;
    }
    if (!profile?.id) return;

    setChatSending(true);
    try {
      const senderName = profile.full_name ?? "Client";
      const senderEmail = profile.email ?? "client@local";

      const { data, error } = await supabase
        .from("contact_messages")
        .insert({
          name: senderName,
          email: senderEmail,
          phone: profile.phone ?? null,
          subject: HR_SUPPORT_SUBJECT,
          message: trimmed,
          status: "new",
          client_id: profile.id,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      setChatInput("");
      if (data) {
        const row = data as unknown as ContactMessageRow;
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
        });
      } else {
        void loadChat();
      }
    } catch (e: any) {
      console.error("[ClientServiceRequests] sendChat failed", e);
      toast({ title: "Send failed", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setChatSending(false);
    }
  }, [chatInput, loadChat, profile, toast]);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/client-portal">Client Portal</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <span>Service Requests</span>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-3xl font-bold text-foreground">Service Requests</h1>
            <p className="text-muted-foreground">
              Submit support tickets to the HR coordination team, share with other departments, and keep track of your recent submissions.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/client-portal">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Create & Track Requests
            </CardTitle>
            <CardDescription>
              Use the request center below to send new service requests, attach supporting documents, and review previously submitted items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <PortalRequestManager
                trigger={
                  <Button className="w-full justify-center" size="lg" disabled={saving}>
                    <Inbox className="mr-2 h-4 w-4" />
                    {saving ? "Submitting..." : "New service request"}
                  </Button>
                }
                actorLabel="Client"
                actorDepartment="Client"
                departments={["HR"]}
                enableReceived={false}
                initialSent={[]}
                sendToDepartment="HR"
                allowShareSelection={false}
                onSendRequest={handleSubmit}
              />

              <Dialog
                open={chatOpen}
                onOpenChange={(open) => {
                  setChatOpen(open);
                  if (open) {
                    void loadChat();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="w-full justify-center" size="lg" variant="outline">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Send message to HR
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[760px]">
                  <DialogHeader>
                    <DialogTitle>HR conversation</DialogTitle>
                    <DialogDescription>
                      Use this chat to communicate with HR about your service requests and tasks.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="h-[360px] rounded-lg border border-border bg-muted/20">
                      <ScrollArea className="h-[360px] p-4">
                        {chatLoading && chatMessages.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Loading messages…</div>
                        ) : sortedChatMessages.length > 0 ? (
                          <div className="space-y-3">
                            {sortedChatMessages.map((m) => {
                              const self = (m.email ?? "") === (profile?.email ?? "");
                              return (
                                <div key={m.id} className={`flex ${self ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                                      self ? "bg-primary text-primary-foreground" : "bg-background border"
                                    }`}
                                  >
                                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                                      {self ? "You" : (m.name ?? m.email ?? "HR")}
                                    </div>
                                    <div className="whitespace-pre-line break-words">{m.message}</div>
                                    <div className="mt-1 text-[10px] opacity-70">
                                      {new Date(m.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No messages yet. Start the conversation below.</div>
                        )}
                      </ScrollArea>
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Write a message to HR..."
                        rows={4}
                        disabled={chatSending}
                      />
                      <div className="flex items-center justify-end">
                        <Button type="button" onClick={() => void handleSendChat()} disabled={chatSending}>
                          {chatSending ? (
                            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Sending...</span>
                          ) : (
                            <span className="inline-flex items-center gap-2"><Send className="h-4 w-4"/>Send</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientServiceRequests;

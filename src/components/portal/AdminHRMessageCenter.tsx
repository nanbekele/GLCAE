import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEventHandler } from "react";
import { formatDistanceToNow } from "date-fns";

import { callFunction } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface AdminHrMessage {
  id: string;
  sender_role: "admin" | "hr";
  sender_id: string | null;
  message: string;
  created_at: string;
}

interface AdminHRMessageCenterProps {
  token: string | null;
  actorRole: "admin" | "hr";
  canReset?: boolean;
  className?: string;
  embedded?: boolean;
}

const roleLabels: Record<"admin" | "hr", string> = {
  admin: "Admin",
  hr: "HR",
};

export const AdminHRMessageCenter = ({
  token,
  actorRole,
  canReset = false,
  className,
  embedded = false,
}: AdminHRMessageCenterProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AdminHrMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  const loadMessages = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await callFunction<{ messages?: AdminHrMessage[]; error?: string }>(
        "marketing-manage",
        { action: "admin-hr-list-messages" },
        { token, useAnonAuth: false },
      );

      if (!response || response.error) {
        throw new Error(response?.error ?? "Unable to load messages");
      }

      setMessages(response.messages ?? []);
    } catch (error: any) {
      console.error("[AdminHRMessageCenter] Failed to load messages", error);
      toast({
        title: "Unable to load messages",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  const handleSend = useCallback<FormEventHandler<HTMLFormElement>>( 
    async (event) => {
      event.preventDefault();
      if (!token) {
        toast({
          title: "No session",
          description: "Please sign in again before sending messages.",
          variant: "destructive",
        });
        return;
      }

      const trimmed = messageInput.trim();
      if (!trimmed) {
        toast({
          title: "Message required",
          description: "Enter a message before sending.",
          variant: "destructive",
        });
        return;
      }

      setSending(true);
      try {
        const response = await callFunction<{ message?: AdminHrMessage; error?: string }>(
          "marketing-manage",
          {
            action: "admin-hr-send-message",
            message: trimmed,
          },
          {
            token,
            useAnonAuth: false,
          },
        );

        if (!response || response.error) {
          throw new Error(response?.error ?? "Failed to send message");
        }

        setMessageInput("");
        if (response.message) {
          setMessages((prev) => [...prev, response.message]);
        } else {
          void loadMessages();
        }
      } catch (error: any) {
        console.error("[AdminHRMessageCenter] Failed to send message", error);
        toast({
          title: "Failed to send",
          description: error?.message ?? "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setSending(false);
      }
    },
    [loadMessages, messageInput, toast, token],
  );

  const handleReset = useCallback(async () => {
    if (!canReset || !token) return;

    const confirmed = window.confirm("Reset the entire message history? This cannot be undone.");
    if (!confirmed) return;

    setResetting(true);
    try {
      const response = await callFunction<{ success?: boolean; error?: string }>(
        "marketing-manage",
        { action: "admin-hr-reset-messages" },
        { token, useAnonAuth: false },
      );

      if (!response || response.error) {
        throw new Error(response?.error ?? "Failed to reset history");
      }

      setMessages([]);
      toast({
        title: "History cleared",
        description: "All messages were removed.",
      });
    } catch (error: any) {
      console.error("[AdminHRMessageCenter] Failed to reset messages", error);
      toast({
        title: "Failed to reset",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  }, [canReset, toast, token]);

  useEffect(() => {
    if (!token) return;
    void loadMessages();
    const interval = window.setInterval(() => {
      void loadMessages();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadMessages, token]);

  const content = (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border bg-muted/20">
        <ScrollArea className="h-[340px] px-4 py-3">
          {loading && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading messages…</p>
          ) : sortedMessages.length > 0 ? (
            <div className="space-y-4">
              {sortedMessages.map((message) => {
                const isSelf = message.sender_role === actorRole;
                return (
                  <div key={message.id} className={cn("flex", isSelf ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%]", isSelf ? "text-right" : "text-left")}>
                      <div className={cn("flex items-end gap-2", isSelf ? "justify-end" : "justify-start")}>
                        {!isSelf ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                            {roleLabels[message.sender_role].slice(0, 1)}
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2 text-sm shadow-sm",
                            isSelf
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-foreground border",
                          )}
                        >
                          <div className={cn("mb-1 flex items-center gap-2", isSelf ? "justify-end" : "justify-start")}>
                            <span className={cn(
                              "text-[11px] font-semibold uppercase tracking-wide",
                              isSelf ? "text-primary-foreground/80" : "text-muted-foreground",
                            )}>
                              {roleLabels[message.sender_role]}
                            </span>
                          </div>
                          <div className="whitespace-pre-line break-words leading-relaxed">{message.message}</div>
                          <div className={cn(
                            "mt-1 text-[11px]",
                            isSelf ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}>
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </div>
                        </div>

                        {isSelf ? (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {roleLabels[message.sender_role].slice(0, 1)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
            </div>
          )}
        </ScrollArea>
      </div>

      <form onSubmit={handleSend} className="space-y-2">
        <div className="rounded-xl border bg-background p-3">
          <Textarea
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            placeholder="Write a message…"
            rows={5}
            disabled={!token || sending}
            className="min-h-[132px] resize-none border-0 p-0 focus-visible:ring-0"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              You are chatting as {roleLabels[actorRole]}
            </div>
            <div className="flex items-center gap-2">
              {canReset ? (
                <Button type="button" variant="destructive" onClick={handleReset} disabled={resetting || !token}>
                  {resetting ? "Clearing…" : "Reset History"}
                </Button>
              ) : null}
              <Button type="submit" disabled={sending || !token}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card className={cn("border-card-border shadow-card", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Admin ↔ HR Messages</span>
          <span className="text-sm font-normal text-muted-foreground">Live</span>
        </CardTitle>
        <CardDescription>Secure internal updates between Admin and HR.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

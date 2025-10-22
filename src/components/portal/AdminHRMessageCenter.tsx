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
}

const roleLabels: Record<"admin" | "hr", string> = {
  admin: "Admin",
  hr: "HR",
};

export const AdminHRMessageCenter = ({ token, actorRole, canReset = false, className }: AdminHRMessageCenterProps) => {
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

  return (
    <Card className={cn("border-card-border shadow-card", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Admin ↔ HR Messages</span>
          <span className="text-sm font-normal text-muted-foreground">You are chatting as {roleLabels[actorRole]}</span>
        </CardTitle>
        <CardDescription>Collaborate with the HR team in real time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64 rounded-lg border border-border bg-muted/30">
          <ScrollArea className="h-64 p-3">
            {loading && messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading messages…</p>
            ) : sortedMessages.length > 0 ? (
              <div className="space-y-3">
                {sortedMessages.map((message) => {
                  const isSelf = message.sender_role === actorRole;
                  return (
                    <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                          isSelf ? "bg-primary text-primary-foreground" : "bg-background border"
                        }`}
                      >
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                          {roleLabels[message.sender_role]}
                        </div>
                        <div className="whitespace-pre-line break-words">{message.message}</div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
            )}
          </ScrollArea>
        </div>
        <form onSubmit={handleSend} className="space-y-2">
          <Textarea
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            placeholder="Share an update with the team…"
            rows={3}
            disabled={!token || sending}
          />
          <div className="flex items-center justify-between gap-2">
            <Button type="submit" disabled={sending || !token}>
              {sending ? "Sending…" : "Send Message"}
            </Button>
            {canReset ? (
              <Button type="button" variant="destructive" onClick={handleReset} disabled={resetting || !token}>
                {resetting ? "Clearing…" : "Reset History"}
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

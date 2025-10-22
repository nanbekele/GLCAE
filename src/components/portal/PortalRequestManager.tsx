import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type ReceivedStatus = "pending" | "in_progress" | "completed" | "cancelled";

type Attachment = {
  id: string;
  name: string;
  type: string;
  url: string;
  content?: string | null;
};

export type ReceivedRequest = {
  id: string;
  title: string;
  from: string;
  department: string;
  details: string;
  status: ReceivedStatus;
  sharedWith: string[];
  createdAt: string;
  attachments: Attachment[];
};

export type SentRequest = {
  id: string;
  title: string;
  to: string;
  details: string;
  sharedWith: string[];
  createdAt: string;
  attachments: Attachment[];
  originalFiles?: File[];
};

const RECEIVED_STATUS_OPTIONS: { value: ReceivedStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const getStatusBadgeClasses = (status: ReceivedStatus) => {
  switch (status) {
    case "completed":
      return "bg-success/10 text-success border-success/20";
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "pending":
      return "bg-warning/10 text-warning border-warning/20";
    case "in_progress":
    default:
      return "bg-info/10 text-info border-info/20";
  }
};

const fileToDataUrl = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
};

const blobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
};

interface PortalRequestManagerProps {
  trigger: React.ReactNode;
  actorLabel: string;
  actorDepartment: string;
  departments: string[];
  initialReceived?: ReceivedRequest[];
  initialSent?: SentRequest[];
  enableReceived?: boolean;
  onSendRequest?: (request: SentRequest) => void;
  sendToDepartment?: string;
  allowShareSelection?: boolean;
}

export const PortalRequestManager = ({
  trigger,
  actorLabel,
  actorDepartment,
  departments,
  initialReceived,
  initialSent,
  enableReceived = true,
  onSendRequest,
  sendToDepartment,
  allowShareSelection = true,
}: PortalRequestManagerProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [receivedRequests, setReceivedRequests] = useState<ReceivedRequest[]>(
    () => (enableReceived ? initialReceived ?? [] : [])
  );
  const [sentRequests, setSentRequests] = useState<SentRequest[]>(
    () => initialSent ?? []
  );

  useEffect(() => {
    if (enableReceived) {
      setReceivedRequests(initialReceived ?? []);
    }
  }, [initialReceived, enableReceived]);

  useEffect(() => {
    setSentRequests(initialSent ?? []);
  }, [initialSent]);

  const [activeTab, setActiveTab] = useState(enableReceived ? "received" : "sent");

  const [newRequest, setNewRequest] = useState({
    title: "",
    to: sendToDepartment ?? "",
    details: "",
    sharedWith: [] as string[],
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formattedDepartments = useMemo(() => {
    const excluded = new Set([actorDepartment]);
    if (sendToDepartment) excluded.add(sendToDepartment);
    return departments.filter((department) => !excluded.has(department));
  }, [departments, actorDepartment, sendToDepartment]);

  const handleStatusChange = (id: string, status: ReceivedStatus) => {
    setReceivedRequests((previous) =>
      previous.map((request) =>
        request.id === id ? { ...request, status } : request,
      ),
    );

    toast({
      title: "Status updated",
      description: `Request marked as "${
        RECEIVED_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
      }"`,
    });
  };

  const handleShareToggle = (
    type: "received" | "sent",
    id: string,
    department: string,
    checked: boolean,
  ) => {
    if (type === "received") {
      setReceivedRequests((previous) =>
        previous.map((request) =>
          request.id === id
            ? {
                ...request,
                sharedWith: checked
                  ? Array.from(new Set([...request.sharedWith, department]))
                  : request.sharedWith.filter((item) => item !== department),
              }
            : request,
        ),
      );
    } else {
      setSentRequests((previous) =>
        previous.map((request) =>
          request.id === id
            ? {
                ...request,
                sharedWith: checked
                  ? Array.from(new Set([...request.sharedWith, department]))
                  : request.sharedWith.filter((item) => item !== department),
              }
            : request,
        ),
      );
    }
  };

  const handleSendRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const destination = sendToDepartment ?? newRequest.to;

    if (!newRequest.title.trim() || !destination) {
      toast({
        title: "Missing information",
        description: "Provide a title and destination department to send the request.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const attachments: Attachment[] = pendingFiles.map((file, index) => ({
      id: `${now.getTime()}-${index}-${file.name}`,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    const request: SentRequest = {
      id: `REQ-${actorLabel.toUpperCase()}-${now.getTime()}`,
      title: newRequest.title.trim(),
      to: destination,
      details: newRequest.details.trim() || "No additional details provided.",
      sharedWith: newRequest.sharedWith,
      createdAt: now.toISOString(),
      attachments,
      originalFiles: pendingFiles,
    };

    try {
      if (onSendRequest) {
        await onSendRequest(request);
      }

      const attachmentsWithContent: Attachment[] = await Promise.all(
        request.attachments.map(async (attachment, index) => {
          const file = request.originalFiles?.[index];
          if (file) {
            return {
              ...attachment,
              content: await fileToDataUrl(file),
            };
          }
          if (attachment.url && attachment.url.startsWith("blob:")) {
            return {
              ...attachment,
              content: await blobUrlToDataUrl(attachment.url),
            };
          }
          return attachment;
        })
      );

      const requestForState: SentRequest = {
        ...request,
        originalFiles: undefined,
        attachments: attachmentsWithContent,
      };

      setSentRequests((previous) => [requestForState, ...previous]);
      setNewRequest({ title: "", to: sendToDepartment ?? "", details: "", sharedWith: [] });
      setPendingFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast({
        title: "Request sent",
        description: `New request dispatched to ${request.to}.`,
      });
      setActiveTab("sent");
    } catch (error: any) {
      console.error("[PortalRequestManager] Failed to send request", error);
      toast({
        title: "Failed to send request",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setPendingFiles(files);
  };

  const toggleNewRequestShare = (department: string, checked: boolean) => {
    setNewRequest((previous) => ({
      ...previous,
      sharedWith: checked
        ? Array.from(new Set([...previous.sharedWith, department]))
        : previous.sharedWith.filter((item) => item !== department),
    }));
  };

  const renderShareDropdown = (
    type: "received" | "sent",
    requestId: string,
    current: string[],
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {formattedDepartments.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No other departments available
          </div>
        ) : null}
        {formattedDepartments.map((department) => (
          <DropdownMenuCheckboxItem
            key={`${requestId}-${department}`}
            checked={current.includes(department)}
            onCheckedChange={(checked) =>
              handleShareToggle(type, requestId, department, Boolean(checked))
            }
          >
            {department}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{actorLabel} Portal Requests</DialogTitle>
          <DialogDescription>
            Receive, review, and dispatch interdepartmental requests in one place.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            {enableReceived ? <TabsTrigger value="received">Received</TabsTrigger> : null}
            <TabsTrigger value="sent">Sent</TabsTrigger>
          </TabsList>

          {enableReceived ? (
            <TabsContent value="received" className="space-y-4">
              {receivedRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No incoming requests yet.
                </p>
              ) : (
                receivedRequests.map((request) => (
                  <div key={request.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{request.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          From {request.from} • {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeClasses(request.status)}>
                        {RECEIVED_STATUS_OPTIONS.find((option) => option.value === request.status)?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{request.details}</p>
                    {request.attachments.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Attachments</p>
                        <div className="flex flex-wrap gap-2">
                          {request.attachments.map((attachment) => (
                            <a
                              key={`${request.id}-attachment-${attachment.id}`}
                              href={attachment.url}
                              download={attachment.name}
                              className="text-xs font-medium text-primary underline underline-offset-2"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {attachment.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value={request.status}
                        onValueChange={(value) => handleStatusChange(request.id, value as ReceivedStatus)}
                      >
                        <SelectTrigger className="w-[170px]">
                          <SelectValue placeholder="Update status" />
                        </SelectTrigger>
                        <SelectContent>
                          {RECEIVED_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {allowShareSelection ? (
                        <>
                          {renderShareDropdown("received", request.id, request.sharedWith)}
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Share2 size={14} />
                            {request.sharedWith.length > 0 ? (
                              request.sharedWith.map((department) => (
                                <Badge variant="outline" key={`${request.id}-${department}`}>
                                  {department}
                                </Badge>
                              ))
                            ) : (
                              <span>Not shared</span>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          ) : null}

          <TabsContent value="sent" className="space-y-4">
            <form onSubmit={handleSendRequest} className="space-y-3 rounded-lg border border-border p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Request title</label>
                <Input
                  id="request-title"
                  placeholder="Describe the request"
                  value={newRequest.title}
                  onChange={(event) => setNewRequest((previous) => ({ ...previous, title: event.target.value }))}
                  required
                />
              </div>
              {sendToDepartment ? (
                <div className="p-3 rounded-md border border-dashed border-muted text-sm text-muted-foreground bg-muted/30">
                  Requests will be routed to <strong className="text-foreground">{sendToDepartment}</strong>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Send to</label>
                    <Select
                      value={newRequest.to}
                      onValueChange={(value) => setNewRequest((previous) => ({ ...previous, to: value }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose department" />
                      </SelectTrigger>
                      <SelectContent>
                        {formattedDepartments
                          .filter((department) => department !== actorDepartment)
                          .map((department) => (
                            <SelectItem key={`send-${department}`} value={department}>
                              {department}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Details</label>
                <Textarea
                  rows={4}
                  placeholder="Add context, attachments, or next steps for the receiving team."
                  value={newRequest.details}
                  onChange={(event) => setNewRequest((previous) => ({ ...previous, details: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="request-files">
                  Attachments
                </label>
                <Input
                  ref={fileInputRef}
                  id="request-files"
                  type="file"
                  multiple
                  accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileSelection}
                />
                {pendingFiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Share2 size={14} />
                    {pendingFiles.map((file) => (
                      <Badge key={`pending-${file.name}`} variant="outline">
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Add documents, images, or videos to include with this request.</p>
                )}
              </div>
              {allowShareSelection ? (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Share with additional departments</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Manage recipients
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      {formattedDepartments.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No other departments available</div>
                      ) : null}
                      {formattedDepartments.map((department) => (
                        <DropdownMenuCheckboxItem
                          key={`new-${department}`}
                          checked={newRequest.sharedWith.includes(department)}
                          onCheckedChange={(checked) => toggleNewRequestShare(department, Boolean(checked))}
                        >
                          {department}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Share2 size={14} />
                    {newRequest.sharedWith.length > 0 ? (
                      newRequest.sharedWith.map((department) => (
                        <Badge variant="outline" key={`new-shared-${department}`}>
                          {department}
                        </Badge>
                      ))
                    ) : (
                      <span>No additional recipients</span>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit">Send request</Button>
              </div>
            </form>

            {sentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests sent yet.</p>
            ) : (
              sentRequests.map((request) => (
                <div key={request.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{request.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        Sent to {request.to} • {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.details}</p>
                  {request.attachments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Attachments</p>
                      <div className="flex flex-wrap gap-2">
                        {request.attachments.map((attachment) => (
                          <a
                            key={`${request.id}-sent-attachment-${attachment.id}`}
                            href={attachment.url}
                            download={attachment.name}
                            className="text-xs font-medium text-primary underline underline-offset-2"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {attachment.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {allowShareSelection ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {renderShareDropdown("sent", request.id, request.sharedWith)}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Share2 size={14} />
                        {request.sharedWith.length > 0 ? (
                          request.sharedWith.map((department) => (
                            <Badge variant="outline" key={`${request.id}-sent-${department}`}>
                              {department}
                            </Badge>
                          ))
                        ) : (
                          <span>Not shared</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

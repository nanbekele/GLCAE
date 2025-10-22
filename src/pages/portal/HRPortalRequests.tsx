import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchHrServiceRequests,
  updateServiceRequestStatus,
  updateServiceRequestPriority,
  deleteServiceRequest,
  updateServiceRequestServiceType,
  fetchDepartmentHeadId,
  shareServiceRequestWithEmployees,
  type ServiceRequestRow,
  type ServiceRequestAttachment,
} from "@/lib/portalRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Match DB check constraint: ('pending','reviewing','approved','in_progress','completed','rejected')
const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Needs Review" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  // Map UI label "Cancelled" to DB value "rejected"
  { value: "rejected", label: "Cancelled" },
];

// Match DB check constraint: ('low','medium','high','urgent')
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const statusBadgeClass = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-success/10 text-success border-success/20";
    case "approved":
      return "bg-success/10 text-success border-success/20";
    case "in_progress":
      return "bg-primary/10 text-primary border-primary/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "reviewing":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-warning/10 text-warning border-warning/20";
  }
};

const formatStatusLabel = (status: string) => {
  const match = STATUS_OPTIONS.find((o) => o.value === status);
  return match ? match.label : status;
};

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

const HRPortalRequests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  const departmentDestinations = [
    { label: "ICT Service Tickets", path: "/portal/ict/service-tickets", serviceType: "ICT", key: "ict" },
    { label: "Mechanical Service Tickets", path: "/portal/mechanical/service-tickets", serviceType: "Mechanical", key: "mech" },
    { label: "Architectural & Civil Service Tickets", path: "/portal/architectural/service-tickets", serviceType: "Architectural & Civil", key: "arch" },
    { label: "Material Testing Service Tickets", path: "/portal/material-testing/service-tickets", serviceType: "Material Testing", key: "mtl" },
  ];

  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [priorityUpdatingId, setPriorityUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  const sortedRequests = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      ),
    [requests],
  );

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchHrServiceRequests(100);
      // Exclude employee task reports from HR Quick Actions (they follow employee -> head -> HR Verified flow)
      const filtered = (data ?? []).filter((r) => !((r.title ?? "").toLowerCase().startsWith("report:")));
      setRequests(filtered);
    } catch (error: any) {
      console.error("[HRPortalRequests] Failed to fetch service requests", error);
      toast({
        title: "Failed to load requests",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentDownload = async (attachment: ServiceRequestAttachment, identifier: string) => {
    if (typeof window === "undefined") return;
    const filename = attachment.name ?? (attachment.url ? deriveNameFromUrl(attachment.url) : "service-request-attachment");

    const triggerAnchorDownload = (url: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const saveBlob = (blob: Blob) => {
      const objectUrl = window.URL.createObjectURL(blob);
      try { triggerAnchorDownload(objectUrl); } finally { window.URL.revokeObjectURL(objectUrl); }
    };

    const signedFetchToBlob = async (bucket: string, objectPath: string) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60, { download: filename });
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Unable to generate download link");
      const resp = await fetch(data.signedUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      saveBlob(blob);
    };

    const attemptDataUrlDownload = (dataUrl: string) => {
      const parts = dataUrl.split(",");
      if (parts.length !== 2) {
        throw new Error("Invalid attachment data URL format.");
      }
      const meta = parts[0];
      const base64Data = parts[1];
      const mimeMatch = meta.match(/data:(.*?);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
      const binary = window.atob(base64Data);
      const length = binary.length;
      const buffer = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }
      const objectUrl = window.URL.createObjectURL(new Blob([buffer], { type: mimeType }));
      try { triggerAnchorDownload(objectUrl); } finally { window.URL.revokeObjectURL(objectUrl); }
    };

    setDownloadingAttachmentId(identifier);
    try {
      if (attachment.content?.startsWith("data:")) {
        attemptDataUrlDownload(attachment.content);
        return;
      }

      // Prefer: signed URL -> fetch to Blob (avoids IDM and CORS quirks)
      const pathParts = inferStorageLocationFromPath(attachment.path);
      if (pathParts) {
        try {
          await signedFetchToBlob(pathParts.bucket, pathParts.objectPath);
        } catch (_signedErr) {
          // Fallback: storage.download
          const { data, error } = await supabase.storage
            .from(pathParts.bucket)
            .download(pathParts.objectPath);
          if (error || !data) throw new Error(error?.message ?? "Unable to download file from storage");
          saveBlob(data);
        }
        return;
      }

      if (attachment.url) {
        // If URL is a Supabase public URL, try signed fetch-to-blob first
        const parsed = parseSupabasePublicUrl(attachment.url);
        if (parsed) {
          try {
            await signedFetchToBlob(parsed.bucket, parsed.objectPath);
          } catch (_signedErr) {
            const { data, error } = await supabase.storage
              .from(parsed.bucket)
              .download(parsed.objectPath);
            if (error || !data) throw new Error(error?.message ?? "Unable to download file from storage");
            saveBlob(data);
          }
          return;
        }

        // Fallbacks for non-Supabase URLs
        try {
          const resp = await fetch(attachment.url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          saveBlob(blob);
        } catch (_err) {
          // Last fallback: direct anchor to the URL
          triggerAnchorDownload(attachment.url);
        }
        return;
      }

      throw new Error("Attachment does not include downloadable content.");
    } catch (error: any) {
      console.error("[HRPortalRequests] Failed to download attachment", error);
      toast({
        title: "Download failed",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const handleShareRequest = async (
    request: ServiceRequestRow,
    destination: { label: string; path: string; serviceType: string; key?: string },
  ) => {
    setSharingId(request.id);
    try {
      // 1) Retag to the chosen department
      let updated = await updateServiceRequestServiceType(request.id, destination.serviceType);

      // 2) Assign to the department head when available
      const headId = await fetchDepartmentHeadId(destination.serviceType);
      if (headId) {
        await shareServiceRequestWithEmployees(updated.id, [headId]);
        // Locally reflect the new assignee
        updated = { ...updated, assigned_to: headId } as ServiceRequestRow;
      }

      // 4) Update local state
      setRequests((previous) => previous.map((item) => (item.id === request.id ? updated : item)));

      // 5) Notify without redirecting (avoid unauthorized route)
      toast({
        title: "Request shared",
        description: `Sent to ${destination.label}${headId ? " and assigned to the head" : ""}.`,
      });
    } catch (error: any) {
      console.error("[HRPortalRequests] Failed to share request", error);
      toast({
        title: "Unable to share request",
        description: error?.message ?? "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSharingId(null);
    }
  };

  const handlePriorityChange = async (id: string, priority: string) => {
    setPriorityUpdatingId(id);
    try {
      const updated = await updateServiceRequestPriority(id, priority);
      setRequests((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast({
        title: "Priority updated",
        description: `Request priority set to ${priority}.`,
      });
    } catch (error: any) {
      console.error("[HRPortalRequests] Failed to update priority", error);
      toast({
        title: "Unable to update priority",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPriorityUpdatingId(null);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const updated = await updateServiceRequestStatus(id, status);
      setRequests((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast({
        title: "Status updated",
        description: `Request marked as ${status}.`,
      });
    } catch (error: any) {
      console.error("[HRPortalRequests] Failed to update status", error);
      toast({
        title: "Unable to update status",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this request? This action cannot be undone.");
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await deleteServiceRequest(id);
      setRequests((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Service request deleted",
        description: "The request has been removed successfully.",
      });
    } catch (error: any) {
      console.error("[HRPortalRequests] Failed to delete service request", error);
      toast({
        title: "Unable to delete",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Portal Service Requests</h1>
            <p className="text-muted-foreground">
              Review, update, and archive requests submitted by clients through the portal.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/portal/hr")}>Back to dashboard</Button>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader>
            <CardTitle>Received Requests</CardTitle>
            <CardDescription>
              {profile?.full_name ? `Managed by ${profile.full_name}` : "Manage all incoming client requests."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading requests...
              </div>
            ) : sortedRequests.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">No service requests found.</p>
            ) : (
              <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                {sortedRequests.map((request) => {
                  const createdLabel = request.created_at
                    ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true })
                    : "Unknown";
                  const attachments = request.attachments ?? [];
                  const forwardedPrefix = "Forwarded by ";
                  const cleanNotes = (request.notes ?? "")
                    .split("\n")
                    .filter((line) => !line.trim().startsWith(forwardedPrefix))
                    .join("\n")
                    .trim();

                  return (
                    <div key={request.id} className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-foreground">{request.title || "Untitled request"}</h2>
                            <Badge className={cn("capitalize border", statusBadgeClass(request.status ?? "pending"))}>
                              {formatStatusLabel(request.status ?? "pending")}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            From client <span className="font-medium">{request.client_id ?? "Unknown"}</span> · {createdLabel}
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <p>{request.description || "No description provided."}</p>
                            {request.service_type ? <p><strong>Service:</strong> {request.service_type}</p> : null}
                            <p>
                              <strong>Priority:</strong> {request.priority ?? "#"}
                            </p>
                            {cleanNotes ? <p><strong>Notes:</strong> {cleanNotes}</p> : null}
                          </div>
                          {attachments.length > 0 ? (
                            <div className="mt-3 space-y-1">
                              <p className="text-sm font-medium text-foreground">Attachments</p>
                              <ul className="space-y-1 text-sm">
                                {attachments.map((attachment, index) => {
                                  const attachmentId = attachment.path ?? attachment.url ?? `${request.id}-attachment-${index}`;
                                  return (
                                    <li key={attachmentId}>
                                      <Button
                                        variant="link"
                                        className="h-auto p-0"
                                        onClick={() => handleAttachmentDownload(attachment, attachmentId)}
                                        disabled={downloadingAttachmentId === attachmentId}
                                      >
                                        {downloadingAttachmentId === attachmentId ? (
                                          <span className="inline-flex items-center gap-1">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Downloading...
                                          </span>
                                        ) : (
                                          attachment.name ?? `Attachment ${index + 1}`
                                        )}
                                      </Button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex w-full flex-col items-stretch gap-3 md:w-56">
                          <Select
                            value={request.priority ?? "medium"}
                            onValueChange={(value) => handlePriorityChange(request.id, value)}
                            disabled={priorityUpdatingId === request.id || deletingId === request.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Set priority" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={request.status ?? "pending"}
                            onValueChange={(value) => handleStatusChange(request.id, value)}
                            disabled={updatingId === request.id || deletingId === request.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Update status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={
                                  deletingId === request.id ||
                                  updatingId === request.id ||
                                  sharingId === request.id
                                }
                              >
                                {sharingId === request.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sharing...
                                  </>
                                ) : (
                                  <>
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share request
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64">
                              {departmentDestinations.map((destination) => (
                                <DropdownMenuItem
                                  key={`${request.id}-share-${destination.path}`}
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    void handleShareRequest(request, destination);
                                  }}
                                >
                                  {destination.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(request.id)}
                            disabled={deletingId === request.id || updatingId === request.id}
                          >
                            {deletingId === request.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete request
                              </>
                            )}
                          </Button>
                        </div>
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

export default HRPortalRequests;

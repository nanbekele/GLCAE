import { useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { EmployeeOption, ServiceRequestAttachment, ServiceRequestRow } from "@/lib/portalRequests";
import { fetchEmployeesByDepartment, fetchServiceRequestsByServiceType, shareServiceRequestWithEmployees, updateServiceRequestNotes, updateServiceRequestPriority, updateServiceRequestStatus } from "@/lib/portalRequests";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface LocationState {
  sharedRequestId?: string;
  sharedRequestTitle?: string | null;
  sharedRequestDescription?: string | null;
  sharedRequestPriority?: string;
  sharedRequestServiceType?: string | null;
  sharedRequestAttachments?: ServiceRequestAttachment[] | null;
  sharedRequestCreatedAt?: string | null;
}

const DEFAULT_SERVICE_REQUEST_BUCKET = "service-request-files";

const ArchitecturalServiceTickets = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const { toast } = useToast();
  const { token } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<Record<string, string | null>>({});
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Page tools
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("newest");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkSharing, setBulkSharing] = useState(false);

  // Drawer state
  const [activeRequest, setActiveRequest] = useState<ServiceRequestRow | null>(null);
  const [drawerNote, setDrawerNote] = useState("");
  const [drawerPrimary, setDrawerPrimary] = useState<string | null>(null);
  const [drawerCcs, setDrawerCcs] = useState<Record<string, boolean>>({});
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingPriorityId, setUpdatingPriorityId] = useState<string | null>(null);

  const stored = typeof window !== "undefined" ? window.sessionStorage.getItem("portal-shared-request::arch") : null;

  let parsedStored: LocationState | null = null;
  if (stored) {
    try { parsedStored = JSON.parse(stored) as LocationState; } catch {}
  }

  const sharedPayloadRef = useRef<LocationState | null>(null);
  if (!sharedPayloadRef.current) {
    const candidate = state?.sharedRequestId ? state : parsedStored;
    sharedPayloadRef.current = candidate?.sharedRequestId ? candidate : null;
  }
  const sharedPayload = sharedPayloadRef.current;

  if (typeof window !== "undefined" && state.sharedRequestId) {
    window.sessionStorage.removeItem("portal-shared-request::arch");
  }

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceRequestsByServiceType("Architectural & Civil", 50);
      // Exclude employee task reports ("Report:") from generic service tickets
      const filtered = (data ?? []).filter((r) => !((r.title ?? "").toLowerCase().startsWith("report:")));
      setRequests(filtered);
      setSelectedAssignees((previous) => {
        const next = { ...previous };
        filtered.forEach((request) => {
          if (typeof next[request.id] === "undefined") {
            next[request.id] = (request as { assigned_to?: string | null })?.assigned_to ?? null;
          }
        });
        return next;
      });
    } catch (error: any) {
      console.error("[ArchitecturalServiceTickets] Failed to load Architectural service requests", error);
      setError(error?.message ?? "Unable to load Architectural service requests.");
      toast({ title: "Failed to load requests", description: error?.message ?? "Please try again later.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [sharedPayload?.sharedRequestId, toast]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  useEffect(() => {
    const loadEmployees = async () => {
      setEmployeesLoading(true);
      try {
        const results = await fetchEmployeesByDepartment("Architectural & Civil", token);
        setEmployees(results);
      } catch (fetchError: any) {
        console.error("[ArchitecturalServiceTickets] Failed to load Architectural employees", fetchError);
        toast({ title: "Unable to load employees", description: fetchError?.message ?? "Please try again later.", variant: "destructive" });
      } finally {
        setEmployeesLoading(false);
      }
    };
    void loadEmployees();
  }, [toast, token]);

  const handleBack = () => { navigate("/portal/architectural"); };

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
      const base = new URL(rawUrl, window.location.origin);
      const segments = base.pathname.split("/").filter(Boolean);
      const objectIndex = segments.findIndex((segment) => segment === "object");
      if (objectIndex === -1) return null;
      const bucket = segments[objectIndex + 2];
      const remainder = segments.slice(objectIndex + 3).join("/");
      if (!bucket || !remainder) return null;
      return { bucket, objectPath: remainder };
    } catch { return null; }
  };

  const downloadAttachment = async (attachment: ServiceRequestAttachment, identifier: string) => {
    if (typeof window === "undefined") return;

    const triggerDownloadFromUrl = (url: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const downloadFromSupabaseStorage = async (bucket: string, objectPath: string) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60, { download: attachment.name ?? "service-request-attachment" });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "Unable to generate download link from Supabase storage.");
      }
      triggerDownloadFromUrl(data.signedUrl);
    };

    setDownloadingId(identifier);
    try {
      if (attachment.content?.startsWith("data:")) {
        triggerDownloadFromUrl(attachment.content);
        return;
      }
      const pathParts = inferStorageLocationFromPath(attachment.path);
      if (pathParts) {
        await downloadFromSupabaseStorage(pathParts.bucket, pathParts.objectPath);
        return;
      }
      if (attachment.url) {
        // Prefer direct open for public buckets; avoids signed URL inconsistencies across environments
        triggerDownloadFromUrl(attachment.url);
        return;
      }
      throw new Error("Attachment does not include downloadable content.");
    } catch (error: any) {
      console.error("[ArchitecturalServiceTickets] Failed to download attachment", error);
      toast({ title: "Download failed", description: error?.message ?? "Please try again later.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleAssigneeChange = (requestId: string, employeeId: string | null) => {
    setSelectedAssignees((previous) => ({ ...previous, [requestId]: employeeId }));
  };

  const handleShareWithEmployees = async (request: ServiceRequestRow) => {
    const selected = selectedAssignees[request.id];
    if (!selected) {
      toast({ title: "No employee selected", description: "Choose an Architectural employee before sharing the request.", variant: "destructive" });
      return;
    }
    setSharingId(request.id);
    try {
      await shareServiceRequestWithEmployees(request.id, [selected]);
      setRequests((previous) => previous.map((item) => (item.id === request.id ? { ...item, assigned_to: selected } : item)));
      toast({ title: "Request shared", description: "The ticket has been assigned to the selected employee." });
    } catch (error: any) {
      console.error("[ArchitecturalServiceTickets] Failed to share request", error);
      toast({ title: "Share failed", description: error?.message ?? "Unable to assign the selected employee.", variant: "destructive" });
    } finally {
      setSharingId(null);
    }
  };

  const assignedLabel = useMemo(() => {
    const lookup = new Map<string, EmployeeOption>();
    employees.forEach((employee) => lookup.set(employee.id, employee));
    return lookup;
  }, [employees]);

  const displayedRequests = useMemo(() => {
    const prepared = [...requests];
    if (sharedPayload?.sharedRequestId) {
      const exists = prepared.some((item) => item.id === sharedPayload.sharedRequestId);
      if (!exists) {
        prepared.unshift({
          id: sharedPayload.sharedRequestId,
          title: sharedPayload.sharedRequestTitle ?? "Shared HR request",
          description: sharedPayload.sharedRequestDescription ?? "No additional description provided.",
          priority: sharedPayload.sharedRequestPriority ?? "#",
          service_type: sharedPayload.sharedRequestServiceType ?? "Architectural & Civil",
          attachments: sharedPayload.sharedRequestAttachments ?? [],
          created_at: sharedPayload.sharedRequestCreatedAt ?? new Date().toISOString(),
          updated_at: sharedPayload.sharedRequestCreatedAt ?? new Date().toISOString(),
          status: "pending",
          client_id: "hr",
          assigned_to: null,
          estimated_cost: null,
          notes: null,
        } as ServiceRequestRow);
      }
    }
    return prepared;
  }, [requests, sharedPayload]);

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = displayedRequests.filter((r) => {
      const matchesQuery = !query || `${r.title} ${r.description}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || (r.status ?? '').toLowerCase() === statusFilter;
      const matchesPriority = priorityFilter === "all" || (r.priority ?? '').toLowerCase() === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });
    if (sortKey === "newest") list = list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortKey === "oldest") list = list.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sortKey === "priority") {
      const rank = (p?: string | null) => ({ high: 3, medium: 2, low: 1 }[(p ?? '').toLowerCase() as 'high'|'medium'|'low'] ?? 0);
      list = list.sort((a, b) => rank(b.priority) - rank(a.priority));
    }
    return list;
  }, [displayedRequests, search, statusFilter, priorityFilter, sortKey]);

  const toggleSelect = (id: string, value?: boolean) => setSelected((prev) => ({ ...prev, [id]: typeof value === 'boolean' ? value : !prev[id] }));
  const isAnySelected = useMemo(() => Object.values(selected).some(Boolean), [selected]);
  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  const openDetails = (req: ServiceRequestRow) => {
    setActiveRequest(req);
    setDrawerNote(req.notes ?? "");
    setDrawerPrimary(req.assigned_to ?? null);
    setDrawerCcs({});
  };

  const shareFromDrawer = async () => {
    if (!activeRequest) return;
    const ccList = Object.entries(drawerCcs).filter(([, v]) => v).map(([k]) => k);
    const assignees = [drawerPrimary, ...ccList].filter(Boolean) as string[];
    if (assignees.length === 0) {
      toast({ title: "No employees selected", description: "Select at least one employee to share with.", variant: "destructive" });
      return;
    }
    setSharingId(activeRequest.id);
    try {
      await shareServiceRequestWithEmployees(activeRequest.id, assignees);
      const ccNames = employees.filter((e) => ccList.includes(e.id)).map((e) => e.fullName).join(", ");
      const primaryName = employees.find((e) => e.id === drawerPrimary)?.fullName ?? null;
      const composed = `${drawerNote || ""}${drawerNote ? "\n\n" : ""}Shared to: ${[primaryName, ccNames].filter(Boolean).join(", ")}`.trim();
      const updated = await updateServiceRequestNotes(activeRequest.id, composed);
      setRequests((prev) => prev.map((r) => r.id === activeRequest.id ? { ...r, assigned_to: drawerPrimary ?? r.assigned_to, notes: updated.notes } : r));
      toast({ title: "Request shared", description: "Details and assignment have been updated." });
      setActiveRequest(null);
    } catch (error: any) {
      toast({ title: "Share failed", description: error?.message ?? "Unable to share with selected employees.", variant: "destructive" });
    } finally {
      setSharingId(null);
    }
  };

  const bulkShare = async () => {
    if (selectedIds.length === 0) return;
    const primary = prompt("Enter primary assignee employee ID for selected requests:")?.trim();
    if (!primary) return;
    const note = prompt("Optional note to include with the selected requests:") ?? "";
    setBulkSharing(true);
    try {
      for (const id of selectedIds) {
        await shareServiceRequestWithEmployees(id, [primary]);
        const composed = note ? `Bulk share note: ${note}` : null;
        if (composed !== null) await updateServiceRequestNotes(id, composed);
      }
      toast({ title: "Shared selected", description: `${selectedIds.length} request(s) shared.` });
      setSelected({});
      void loadRequests();
    } catch (error: any) {
      toast({ title: "Bulk share failed", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setBulkSharing(false);
    }
  };

  const handleUpdateStatus = async (req: ServiceRequestRow, status: string) => {
    setUpdatingStatusId(req.id);
    try {
      const updated = await updateServiceRequestStatus(req.id, status);
      setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: updated.status } : r));
      toast({ title: "Status updated" });
    } catch (error: any) {
      toast({ title: "Failed to update status", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleUpdatePriority = async (req: ServiceRequestRow, priority: string) => {
    setUpdatingPriorityId(req.id);
    try {
      const updated = await updateServiceRequestPriority(req.id, priority);
      setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, priority: updated.priority } : r));
      toast({ title: "Priority updated" });
    } catch (error: any) {
      toast({ title: "Failed to update priority", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setUpdatingPriorityId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6 animate-fade-in">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="rounded-xl bg-gradient-hero p-6 text-primary-foreground shadow-hero">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold">Architectural & Civil Service Tickets</h1>
              <p className="opacity-90">Review requests shared by HR and assign actions for the Architectural team.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => void loadRequests()} disabled={loading} className="bg-white/10 text-primary-foreground hover:bg-white/20">
                {loading ? (
                  <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Refreshing</span>
                ) : (
                  "Refresh"
                )}
              </Button>
              <Button variant="secondary" onClick={handleBack} className="bg-white/10 text-primary-foreground hover:bg-white/20">Back to dashboard</Button>
            </div>
          </div>
        </div>

        <Card className="border-card-border shadow-card">
          <CardHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-lg">All Architectural & Civil service requests</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Input placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortKey} onValueChange={setSortKey}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading requests...</div>
            ) : filteredSorted.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No Architectural service tickets are currently queued.</p>
            ) : (
              <div className="space-y-3">
                {isAnySelected ? (
                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
                    <div>{selectedIds.length} selected</div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected({})}>Clear</Button>
                      <Button size="sm" onClick={() => void bulkShare()} disabled={bulkSharing}>{bulkSharing ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sharing...</span> : "Share selected"}</Button>
                    </div>
                  </div>
                ) : null}
                {filteredSorted.map((request) => {
                  const attachments = Array.isArray(request.attachments) ? request.attachments : [];
                  const badgeItems = [
                    { label: "Service", value: request.service_type ?? "Architectural & Civil" },
                    { label: "Status", value: request.status ?? "Pending" },
                    { label: "Priority", value: request.priority ?? "#" },
                  ];
                  return (
                    <Card key={request.id} className="border border-border/60">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-3">
                            <Checkbox checked={!!selected[request.id]} onCheckedChange={(v) => toggleSelect(request.id, Boolean(v))} />
                            <h3 className="text-lg font-semibold text-foreground">{request.title}</h3>
                          </div>
                          <Badge variant="outline" className="uppercase">Priority {request.priority ?? "#"}</Badge>
                        </div>

                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p>{request.description}</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {badgeItems.map((badge) => (
                              <Badge key={badge.label} variant="outline" className="border-border/60 bg-muted/40">
                                <span className="font-semibold text-foreground/90">{badge.label}:</span> {badge.value}
                              </Badge>
                            ))}
                            {request.assigned_to ? (
                              <Badge variant="secondary">Assigned to {assignedLabel.get(request.assigned_to)?.fullName ?? "Employee"}</Badge>
                            ) : null}
                          </div>
                        </div>

                        {attachments.length > 0 ? (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">Attachments</h4>
                            <ul className="mt-2 space-y-1 text-sm">
                              {attachments.map((attachment, index) => {
                                const attachmentId = attachment.path ?? attachment.url ?? `${request.id}-attachment-${index}`;
                                const canDownload = Boolean(attachment.content || attachment.path || attachment.url);
                                return (
                                  <li key={attachmentId}>
                                    {canDownload ? (
                                      <Button variant="link" className="h-auto p-0" onClick={() => downloadAttachment(attachment, attachmentId)} disabled={downloadingId === attachmentId}>
                                        {downloadingId === attachmentId ? (
                                          <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Downloading...</span>
                                        ) : (
                                          attachment.name ? `Download ${attachment.name}` : "Download file"
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground">{attachment.name ?? `Attachment ${index + 1}`} (unavailable)</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select value={request.status ?? undefined} onValueChange={(v) => void handleUpdateStatus(request, v)}>
                              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={request.priority ?? undefined} onValueChange={(v) => void handleUpdatePriority(request, v)}>
                              <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={selectedAssignees[request.id] ?? undefined}
                              onValueChange={(v) => handleAssigneeChange(request.id, v)}
                            >
                              <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Select employee" /></SelectTrigger>
                              <SelectContent>
                                {employeesLoading ? (
                                  <SelectItem value="__loading" disabled>
                                    Loading employees...
                                  </SelectItem>
                                ) : employees.length === 0 ? (
                                  <SelectItem value="__empty" disabled>
                                    No employees found for this department
                                  </SelectItem>
                                ) : (
                                  employees.map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                      {e.fullName} — {e.email}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => void handleShareWithEmployees(request)}
                              disabled={sharingId === request.id || !selectedAssignees[request.id]}
                              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
                            >
                              {sharingId === request.id ? (
                                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sharing...</span>
                              ) : (
                                "Share"
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Details Drawer */}
      <Drawer open={!!activeRequest} onOpenChange={(open) => !open && setActiveRequest(null)}>
        <DrawerContent className="md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:w-[900px] md:max-w-[95vw] md:rounded-xl md:h-[80vh] overflow-y-auto shadow-elevated">
          <DrawerHeader>
            <DrawerTitle>{activeRequest?.title ?? "Request details"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4">
            {activeRequest ? (
              <>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{activeRequest.description}</div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={activeRequest.status ?? undefined} onValueChange={async (v) => { await handleUpdateStatus(activeRequest, v); setActiveRequest((r) => r ? { ...r, status: v } : r); }}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={activeRequest.priority ?? undefined} onValueChange={async (v) => { await handleUpdatePriority(activeRequest, v); setActiveRequest((r) => r ? { ...r, priority: v } : r); }}>
                      <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Primary assignee</Label>
                    <Select value={drawerPrimary ?? undefined} onValueChange={(v) => setDrawerPrimary(v)}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        {employeesLoading ? (
                          <SelectItem value="__loading" disabled>
                            Loading employees...
                          </SelectItem>
                        ) : employees.length === 0 ? (
                          <SelectItem value="__empty" disabled>
                            No employees found for this department
                          </SelectItem>
                        ) : (
                          employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.fullName} — {e.email}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>CC employees</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto p-2 border rounded-md">
                    {employees.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={!!drawerCcs[e.id]} onCheckedChange={(v) => setDrawerCcs((prev) => ({ ...prev, [e.id]: Boolean(v) }))} />
                        <span>{e.fullName} <span className="text-muted-foreground">— {e.email}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Share note</Label>
                  <Textarea placeholder="Add instructions or context for the assignees..." value={drawerNote} onChange={(e) => setDrawerNote(e.target.value)} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" onClick={() => activeRequest && (async () => { const attachments = (activeRequest.attachments ?? []).map((a) => a.name).join(", "); const text = `Service Request\nTitle: ${activeRequest.title}\nPriority: ${activeRequest.priority}\nStatus: ${activeRequest.status}\nService: ${activeRequest.service_type}\nCreated: ${new Date(activeRequest.created_at).toLocaleString()}\n\nDescription:\n${activeRequest.description}\n\nAttachments: ${attachments}`; await navigator.clipboard.writeText(text); toast({ title: "Copied", description: "Request details copied to clipboard." }); })()}>Copy details</Button>
                  <div className="flex items-center gap-2">
                    <DrawerClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                    <Button onClick={() => void shareFromDrawer()} disabled={sharingId === activeRequest?.id}>{sharingId === activeRequest?.id ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sharing...</span> : <span className="inline-flex items-center gap-2"><Share2 className="h-4 w-4" />Share</span>}</Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ArchitecturalServiceTickets;

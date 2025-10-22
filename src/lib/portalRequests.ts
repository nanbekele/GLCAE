import { supabase } from "@/integrations/supabase/client";
import { callFunction, decodeJwt } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

export type ServiceRequestAttachment = {
  name: string;
  url: string;
  type?: string | null;
  size?: number | null;
  path?: string | null;
  content?: string | null;
};

// Resolve department head profile by department label
export const fetchDepartmentHeadId = async (department: string): Promise<string | null> => {
  const dept = (department ?? "").toLowerCase();
  let role: Database["public"]["Enums"]["user_role"] | null = null;
  if (dept.includes("ict")) role = "ict_head";
  else if (dept.includes("mechanical")) role = "mechanical_head";
  else if (dept.includes("material")) role = "material_testing_head";
  else if (dept.includes("architectural") || dept.includes("civil")) role = "architectural_civil_head";

  if (!role) return null;

  // First, try to find an active head whose department matches the provided label
  const { data: deptMatch, error: deptErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", role)
    .eq("is_active", true)
    .ilike("department", `${department}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deptErr) {
    throw new Error(deptErr.message);
  }
  if (deptMatch?.id) return deptMatch.id;

  // Fallback: any active head for the role
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", role)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
};

// Pick any available HR staff profile ID
export const fetchAnyHrStaffId = async (): Promise<string | null> => {
  // Prefer any active HR staff
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "hr_staff")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data?.id) return data.id;

  // Fallback: super admin can receive if no HR is present
  const { data: superAdmin, error: superErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (superErr) {
    throw new Error(superErr.message);
  }

  return superAdmin?.id ?? null;
};

type ServiceRequestsTable = Database["public"]["Tables"]["service_requests"];

export type ServiceRequestRow = ServiceRequestsTable["Row"] & {
  attachments?: ServiceRequestAttachment[] | null;
};

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type EmployeeOption = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
};

// --------------- Consultancy Request (custom table) -----------------
export type ConsultancyRequestRow = {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  department: "ICT" | "Mechanical" | "Material Testing" | "Architectural & Civil";
  title: string;
  description: string;
  status: "pending" | "scheduled" | "completed" | "cancelled";
  assigned_employee: string | null;
  schedule_at: string | null;
  notes: string | null;
  contact_email?: string | null;
};

export const createConsultancyRequest = async (args: {
  clientId: string;
  department: ConsultancyRequestRow["department"];
  title: string;
  description: string;
  assignedEmployeeId?: string | null;
  scheduleAt?: string | null;
  token?: string | null;
  contactEmail?: string | null;
}): Promise<ConsultancyRequestRow> => {
  const response = await callFunction<{ success?: boolean; request?: ConsultancyRequestRow; error?: string }>(
    "marketing-manage",
    {
      action: "client-submit-consultancy-request",
      clientId: args.clientId,
      department: args.department,
      title: args.title,
      description: args.description,
      contactEmail: args.contactEmail ?? null,
    },
    // Prefer verifying JWT at the Edge. If no token, function still accepts client-provided clientId.
    args.token ? { token: args.token, useAnonAuth: false } : undefined,
  );

  if (!response?.success || !response.request) {
    throw new Error(response?.error ?? "Failed to create consultancy request");
  }

  return response.request;
};

export const fetchConsultancyRequestsByDepartment = async (
  department: ConsultancyRequestRow["department"],
  limit = 100,
  token?: string | null,
): Promise<ConsultancyRequestRow[]> => {
  // Prefer secure Edge Function with service role so heads bypass RLS
  if (token) {
    try {
      const response = await callFunction<{ requests?: ConsultancyRequestRow[] }>(
        "marketing-manage",
        { action: "list-consultancy-requests", department, limit },
        { token, useAnonAuth: false },
      );
      return (response?.requests ?? []) as ConsultancyRequestRow[];
    } catch (e) {
      // Fall back to client query on failure
    }
  }
  const { data, error } = await supabase
    .from("consultancyrequest")
    .select("*")
    .eq("department", department)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsultancyRequestRow[];
};

export const fetchConsultancyRequestsForClient = async (
  clientId: string,
  limit = 100,
  token?: string | null,
): Promise<ConsultancyRequestRow[]> => {
  // Prefer Edge Function so it uses authenticated profile mapping and bypasses any RLS mismatch
  if (token) {
    try {
      const response = await callFunction<{ requests?: ConsultancyRequestRow[] }>(
        "marketing-manage",
        { action: "client-list-consultancy-requests", limit },
        { token, useAnonAuth: false },
      );
      return (response?.requests ?? []) as ConsultancyRequestRow[];
    } catch (e) {
      // Fallback to client query on failure
    }
  }
  const { data, error } = await supabase
    .from("consultancyrequest")
    .select("*")
    .eq("client_id", clientId)
    .order("schedule_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsultancyRequestRow[];
};

export const fetchConsultancyRequestsForEmployee = async (
  assigneeId: string,
  limit = 100,
  token?: string | null,
): Promise<ConsultancyRequestRow[]> => {
  if (token) {
    try {
      const response = await callFunction<{ requests?: ConsultancyRequestRow[] }>(
        "marketing-manage",
        { action: "employee-list-consultancy-requests", limit },
        { token, useAnonAuth: false },
      );
      return (response?.requests ?? []) as ConsultancyRequestRow[];
    } catch (e) {
      // Fallback to client query on failure
    }
  }
  const { data, error } = await supabase
    .from("consultancyrequest")
    .select("*")
    .eq("assigned_employee", assigneeId)
    .order("schedule_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsultancyRequestRow[];
};

export const updateConsultancyRequestAssignmentAndSchedule = async (
  id: string,
  assignedEmployeeId: string,
  scheduleAtISO: string,
  newNote?: string,
  token?: string | null,
): Promise<ConsultancyRequestRow> => {
  // Prefer Edge Function so it can send email notifications and bypass RLS
  if (token) {
    try {
      const response = await callFunction<{ request: ConsultancyRequestRow; emailWarnings?: string[] }>(
        "marketing-manage",
        { action: "consultancy-schedule", id, assignedEmployeeId, scheduleAtISO, note: newNote ?? null },
        { token, useAnonAuth: false },
      );
      if (response?.emailWarnings && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[consultancy-schedule] warnings", response.emailWarnings);
      }
      return response.request;
    } catch (e) {
      // Fall back to client-side update if function is not available
    }
  }

  // Fallback: client-side (no emails)
  let updatedNotes: string | null = newNote ?? null;
  if (newNote) {
    const { data: current } = await supabase
      .from("consultancyrequest")
      .select("notes")
      .eq("id", id)
      .maybeSingle<{ notes: string | null }>();
    if (current?.notes) updatedNotes = `${current.notes}\n\n${newNote}`;
  }
  const { data, error } = await supabase
    .from("consultancyrequest")
    .update({
      assigned_employee: assignedEmployeeId,
      schedule_at: scheduleAtISO,
      status: "scheduled",
      notes: updatedNotes ?? undefined,
    })
    .eq("id", id)
    .select("*")
    .single<ConsultancyRequestRow>();
  if (error) throw new Error(error.message);
  return data as ConsultancyRequestRow;
};

export const updateConsultancyRequestStatus = async (
  id: string,
  status: ConsultancyRequestRow["status"],
): Promise<ConsultancyRequestRow> => {
  const { data, error } = await supabase
    .from("consultancyrequest")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single<ConsultancyRequestRow>();
  if (error) throw new Error(error.message);
  return data as ConsultancyRequestRow;
};

export const updateConsultancyRequestNotes = async (
  id: string,
  notes: string | null,
): Promise<ConsultancyRequestRow> => {
  const { data, error } = await supabase
    .from("consultancyrequest")
    .update({ notes })
    .eq("id", id)
    .select("*")
    .single<ConsultancyRequestRow>();
  if (error) throw new Error(error.message);
  return data as ConsultancyRequestRow;
};

export const fetchEmployeesByDepartment = async (
  department: string,
  token?: string | null,
): Promise<EmployeeOption[]> => {
  // Prefer secure Edge Function (bypasses RLS with service role) when token is available
  if (token) {
    try {
      const response = await callFunction<{
        employees?: Array<{ id: string; fullName: string; email: string; department?: string | null }>;
      }>(
        "marketing-manage",
        { action: "list-employees-by-department", department },
        { token, useAnonAuth: false },
      );

      const list = response?.employees ?? [];
      return list.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        department: p.department ?? null,
      }));
    } catch (error) {
      // Fall through to RLS-backed client-side query on failure (e.g., 403 Forbidden)
    }
  }

  // Fallback to client-side query (subject to RLS)
  const normalized = (department ?? "").toString().trim().toLowerCase();
  const clauses: string[] = [];
  const push = (pattern: string) => clauses.push(`department.ilike.${pattern}`);
  if (normalized.includes("architect") || normalized.includes("civil")) {
    push("*architect*");
    push("*architecture*");
    push("*civil*");
    push("*engineer*");
    push("*engineering*");
  }
  if (normalized.includes("material") || normalized.includes("testing")) {
    push("*material*");
    push("*materials*");
    push("*testing*");
  }
  if (normalized.includes("electro") || normalized.includes("mechanical")) {
    push("*electro*");
    push("*electro-mech*");
    push("*electromech*");
    push("*mechanical*");
  }
  if (normalized.length > 0) {
    push(`*${normalized}*`);
  }

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, department")
    .eq("role", "employee")
    .eq("is_active", true);

  if (clauses.length === 0) {
    query = query.ilike("department", `%${department}%`);
  } else if (clauses.length === 1) {
    const single = clauses[0].replace("department.ilike.", "");
    query = query.ilike("department", single.replace(/\*/g, "%"));
  } else {
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query.order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    department: profile.department?.trim() ?? null,
  }));
};

export const shareServiceRequestWithEmployees = async (
  requestId: string,
  employeeIds: string[],
): Promise<void> => {
  if (!requestId) {
    throw new Error("Request ID is required to share the service request.");
  }

  const primaryAssignee = employeeIds[0] ?? null;

  const { error } = await supabase
    .from("service_requests")
    .update({ assigned_to: primaryAssignee })
    .eq("id", requestId);

  if (error) {
    throw new Error(error.message);
  }
};

const fileToBase64 = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const deriveNameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "file";
    return decodeURIComponent(last);
  } catch {
    const parts = String(url).split("/");
    return decodeURIComponent(parts[parts.length - 1] || "file");
  }
};

const normalizeAttachments = (raw: any): ServiceRequestAttachment[] | null => {
  if (raw === null || typeof raw === "undefined") return null;
  // Single string URL stored in DB
  if (typeof raw === "string") {
    const url = raw;
    return [
      {
        name: deriveNameFromUrl(url),
        url,
        type: null,
        size: null,
        path: null,
        content: null,
      },
    ];
  }
  // Array of string URLs stored in DB
  if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
    return (raw as string[]).map((url) => ({
      name: deriveNameFromUrl(url),
      url,
      type: null,
      size: null,
      path: null,
      content: null,
    }));
  }
  // Already in object format
  if (Array.isArray(raw)) {
    return raw as ServiceRequestAttachment[];
  }
  return null;
};

const mapServiceRequestRow = (row: ServiceRequestsTable["Row"]): ServiceRequestRow => ({
  ...row,
  attachments: normalizeAttachments((row as any).attachment_urls ?? (row as any).attachments),
});

export const uploadServiceRequestAttachments = async (
  files: File[],
): Promise<ServiceRequestAttachment[]> => {
  if (files.length === 0) {
    return [];
  }

  const prepared = await Promise.all(
    files.map(async (file) => {
      const base64 = await fileToBase64(file);
      return {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        url: "",
        path: null,
        content: `data:${file.type || "application/octet-stream"};base64,${base64}`,
      } satisfies ServiceRequestAttachment;
    }),
  );

  return prepared;
};

export type CreateClientServiceRequestInput = {
  clientId: string;
  title: string;
  description: string;
  serviceType?: string;
  priority?: string;
  attachments?: ServiceRequestAttachment[] | null;
  token?: string | null;
};

export const createClientServiceRequest = async ({
  clientId,
  title,
  description,
  serviceType = "HR Coordination",
  priority = "low",
  attachments = null,
  token = null,
}: CreateClientServiceRequestInput): Promise<ServiceRequestRow | null> => {
  const payload = {
    action: "client-submit-service-request",
    serviceType,
    title,
    description,
    priority,
    clientId,
    attachment: attachments ?? [],
  };

  const response = await callFunction<{ success: boolean; request?: ServiceRequestRow }>(
    "marketing-manage",
    payload,
    token
      ? {
          token,
          useAnonAuth: false,
        }
      : undefined,
  );

  return response.request ?? null;
};

export const fetchHrServiceRequests = async (limit = 10): Promise<ServiceRequestRow[]> => {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  return rows.map((row) => mapServiceRequestRow(row));
};

export const updateServiceRequestStatus = async (id: string, status: string): Promise<ServiceRequestRow> => {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single<ServiceRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapServiceRequestRow(data);
};

export const updateServiceRequestNotes = async (id: string, notes: string | null): Promise<ServiceRequestRow> => {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ notes })
    .eq("id", id)
    .select("*")
    .single<ServiceRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapServiceRequestRow(data);
};

export const updateServiceRequestPriority = async (id: string, priority: string): Promise<ServiceRequestRow> => {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ priority })
    .eq("id", id)
    .select("*")
    .single<ServiceRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapServiceRequestRow(data);
};

export const updateServiceRequestServiceType = async (id: string, serviceType: string): Promise<ServiceRequestRow> => {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ service_type: serviceType })
    .eq("id", id)
    .select("*")
    .single<ServiceRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapServiceRequestRow(data);
};

export const updateServiceRequestTitleAndDescription = async (
  id: string,
  title: string,
  description: string | null,
): Promise<ServiceRequestRow> => {
  const { data, error } = await supabase
    .from("service_requests")
    .update({ title, description })
    .eq("id", id)
    .select("*")
    .single<ServiceRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapServiceRequestRow(data);
};

export const updateServiceRequestEstimatedCost = async (
  id: string,
  estimatedCost: number | string | null,
): Promise<ServiceRequestRow> => {
  const value: string | null = estimatedCost === null ? null : String(estimatedCost);
  const payload: Database["public"]["Tables"]["service_requests"]["Update"] = {
    estimated_cost: value,
  };

  const { data, error } = await supabase
    .from("service_requests")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single<ServiceRequestRow>();

  if (error) {
    throw new Error(error.message);
  }

  return mapServiceRequestRow(data);
};

export const fetchServiceRequestsByServiceType = async (
  serviceType: string,
  limit = 20,
): Promise<ServiceRequestRow[]> => {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("service_type", serviceType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapServiceRequestRow(row));
};

export const fetchServiceRequestsAssignedTo = async (
  assigneeId: string,
  limit = 20,
  departmentFilter?: string | null,
): Promise<ServiceRequestRow[]> => {
  let query = supabase
    .from("service_requests")
    .select("*")
    .eq("assigned_to", assigneeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (departmentFilter && departmentFilter.trim().length > 0) {
    query = query.eq("service_type", departmentFilter.trim());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapServiceRequestRow(row));
};

export const deleteServiceRequest = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("service_requests")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
};

// ---------------- Interview Schedules -----------------
export type InterviewScheduleLog = {
  id: string;
  applicant_name: string;
  applicant_email: string;
  interviewer: string;
  interviewer_email: string;
  position: string;
  scheduled_for: string;
  location: string;
  notes: string | null;
  organized_by: string | null;
  created_at: string;
};

export const fetchInterviewSchedulesForEmployee = async (
  email: string,
  limit = 100,
  token?: string | null,
): Promise<InterviewScheduleLog[]> => {
  if (!email && !token) return [];
  // Prefer service-side listing to avoid RLS and casing issues
  if (token) {
    try {
      const response = await callFunction<{ schedules?: InterviewScheduleLog[] }>(
        "marketing-manage",
        { action: "employee-list-interview-schedules", limit },
        { token, useAnonAuth: false },
      );
      return (response?.schedules ?? []) as InterviewScheduleLog[];
    } catch (_) {
      // fall back to client-side query
    }
  }
  const lookup = (email ?? "").trim().toLowerCase();
  if (!lookup) return [];
  const { data, error } = await (supabase as any)
    .from("interview_schedule_logs")
    .select("*")
    .ilike("interviewer_email", lookup)
    .order("scheduled_for", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InterviewScheduleLog[];
};

export const fetchInterviewSchedulesForClient = async (
  email: string,
  limit = 100,
  token?: string | null,
): Promise<InterviewScheduleLog[]> => {
  if (!email && !token) return [];
  // Prefer service-side listing to avoid RLS and casing issues
  if (token) {
    try {
      const response = await callFunction<{ schedules?: InterviewScheduleLog[] }>(
        "marketing-manage",
        { action: "client-list-interview-schedules", limit },
        { token, useAnonAuth: false },
      );
      return (response?.schedules ?? []) as InterviewScheduleLog[];
    } catch (_) {
      // fall back to client-side query
    }
  }
  const lookup = (email ?? "").trim().toLowerCase();
  if (!lookup) return [];
  const { data, error } = await (supabase as any)
    .from("interview_schedule_logs")
    .select("*")
    .ilike("applicant_email", lookup)
    .order("scheduled_for", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InterviewScheduleLog[];
};

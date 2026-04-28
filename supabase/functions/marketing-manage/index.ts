// @ts-nocheck
// Deno Edge Function for marketing management flows
// Handles posts, newsletter subscribers, and contact messages using service role access

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { decode, verify } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gcae-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const base64UrlEncode = (input: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < input.length; i++) binary += String.fromCharCode(input[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const getGmailAccessToken = async (params: { clientId: string; clientSecret: string; refreshToken: string }) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Gmail token error (${response.status}): ${JSON.stringify(data)}`);
  }

  const token = data?.access_token;
  if (!token) throw new Error("Gmail token error: missing access_token");
  return String(token);
};

const sendContactReplyEmailViaGmail = async (
  config: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    senderEmail: string | null;
  },
  to: string,
  subject: string,
  body: string,
  recipientName?: string | null,
  senderName?: string | null,
) => {
  const accessToken = await getGmailAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: config.refreshToken,
  });

  const from = config.senderEmail;
  if (!from) {
    throw new Error("Gmail sender email is not configured");
  }

  const greetingName = recipientName || "there";
  const finalSender = senderName || "GCAE Marketing Team";
  const safeText = `Hello ${greetingName},\n\n${body}\n\nBest regards,\n${finalSender}`;

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    safeText,
  ].join("\r\n");

  const raw = base64UrlEncode(new TextEncoder().encode(mime));

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }
};

const sendHtmlEmailViaGmail = async (
  config: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    senderEmail: string | null;
  },
  to: string,
  subject: string,
  htmlBody: string,
  replyTo?: string | null,
) => {
  const accessToken = await getGmailAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken: config.refreshToken,
  });

  const from = config.senderEmail;
  if (!from) {
    throw new Error("Gmail sender email is not configured");
  }

  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
  ].join("\r\n");

  const raw = base64UrlEncode(new TextEncoder().encode(mime));

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }
};

// List consultancy requests for the authenticated client
const listClientConsultancyRequests = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  clientProfileId: string,
  limit = 100,
) => {
  const { data, error } = await supabaseAdmin
    .from("consultancyrequest")
    .select("*")
    .eq("client_id", clientProfileId)
    .order("schedule_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 200,
    body: { requests: data ?? [] },
  } as const;
};

// List consultancy requests assigned to the authenticated employee
const listEmployeeConsultancyRequests = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  employeeProfileId: string,
  limit = 100,
) => {
  const { data, error } = await supabaseAdmin
    .from("consultancyrequest")
    .select("*")
    .eq("assigned_employee", employeeProfileId)
    .order("schedule_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 200,
    body: { requests: data ?? [] },
  } as const;
};

const updateEmployeeConsultancyStatus = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  payload: any,
) => {
  const { id, status } = payload ?? {};
  const requestId = typeof id === "string" ? id.trim() : null;
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : null;

  if (!requestId) {
    return { status: 400, body: { error: "id is required" } } as const;
  }

  const allowed = new Set(["pending", "scheduled", "completed", "cancelled", "in_progress"]);
  if (!normalizedStatus || !allowed.has(normalizedStatus)) {
    return { status: 400, body: { error: "Invalid status" } } as const;
  }

  const profileId = profile?.id ?? null;
  if (!profileId) {
    return { status: 401, body: { error: "Profile not found" } } as const;
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("consultancyrequest")
    .select("id, assigned_employee")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) {
    return { status: 400, body: { error: fetchError.message } } as const;
  }

  if (!existing) {
    return { status: 404, body: { error: "Request not found" } } as const;
  }

  if (existing.assigned_employee !== profileId) {
    return { status: 403, body: { error: "Forbidden" } } as const;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("consultancyrequest")
    .update({ status: normalizedStatus })
    .eq("id", requestId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return { status: 400, body: { error: updateError.message } } as const;
  }

  if (!updated) {
    return { status: 404, body: { error: "Request not found" } } as const;
  }

  return { status: 200, body: { success: true, request: updated } } as const;
};

const NEWS_BUCKET = "news-media";
const PROJECT_BUCKET = "project-media";
const SERVICE_REQUEST_BUCKET = "service-request-files";
const SERVICE_REQUEST_FOLDER = "service-requests";
const SOCIAL_TABLE = "social_campaigns";

const NEWS_CATEGORIES = [
  { value: "company", label: "Company" },
  { value: "projects", label: "Projects" },
  { value: "awards", label: "Awards" },
  { value: "technology", label: "Technology" },
  { value: "sustainability", label: "Sustainability" },
  { value: "partnerships", label: "Partnerships" },
];

const NEWS_CATEGORY_VALUES = new Set(NEWS_CATEGORIES.map((category) => category.value));
const PROJECT_STATUSES = new Set(["planning", "in_progress", "completed"]);
const JOB_EMPLOYMENT_TYPES = new Set(["Full-time", "Part-time", "Contract", "Internship"]);
const JOB_STATUS_VALUES = new Set(["active", "inactive", "closed", "draft"]);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:");

const parseDataUrl = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return { mimeType, bytes };
};

const uploadDataUrlToStorage = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  folder: string,
  dataUrl: string,
) => {
  const { mimeType, bytes } = parseDataUrl(dataUrl);
  const extension = mimeType.split("/")[1] ?? "bin";
  const fileName = `${folder}/${crypto.randomUUID()}.${extension}`;

  const storageClient = supabaseAdmin.storage.from(bucket);
  const { error: uploadError } = await storageClient.upload(fileName, bytes, {
    contentType: mimeType,
    upsert: true,
  });

  if (uploadError) {
    throw new Error(`Failed to upload media: ${uploadError.message}`);
  }

  return fileName;
};

const deleteStorageObject = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  objectPath: string | null | undefined,
) => {
  if (!objectPath) return;
  if (objectPath.includes("://")) return;

  const cleanPath = objectPath.replace(/^\/+/, "");
  if (!cleanPath || cleanPath === bucket) return;

  const storageClient = supabaseAdmin.storage.from(bucket);
  const { error } = await storageClient.remove([cleanPath]);
  if (error) {
    console.warn(`[marketing-manage] Failed to remove storage object ${cleanPath}`, error);
  }
};

const NEWS_MEDIA_BUCKET = "news-media";

const resolveStoragePublicUrl = (
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  objectPath: string | null | undefined,
) => {
  if (!objectPath) return null;
  if (objectPath.includes("://")) return objectPath;
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
  return data?.publicUrl ?? null;
};

// Normalize URLs for client consumption in local dev.
// In some setups, getPublicUrl may return host.docker.internal which isn't reachable from the browser.
// Replace with 127.0.0.1 only when detected, leave other hosts intact (production unaffected).
const normalizePublicUrlHost = (url: string | null) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "host.docker.internal") {
      u.hostname = "127.0.0.1";
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
};

const getCategoryLabel = (category: string | null | undefined) =>
  NEWS_CATEGORIES.find((item) => item.value === category)?.label ?? null;

const buildPostResponse = (
  supabaseAdmin: ReturnType<typeof createClient>,
  row: any,
) => {
  const coverImagePath = row.cover_image_url ?? null;
  const coverImageUrl = resolveStoragePublicUrl(supabaseAdmin, NEWS_BUCKET, coverImagePath);

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    slug: row.slug,
    status: row.status,
    category: row.category,
    categoryLabel: getCategoryLabel(row.category),
    summary: row.summary,
    coverImagePath,
    coverImageUrl,
    authorId: row.author_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const buildCampaignResponse = (row: any) => ({
  id: row.id,
  platform: row.platform,
  title: row.title,
  copy: row.copy,
  imageUrl: row.image_url,
  scheduledAt: row.scheduled_at,
  approved: row.approved ?? false,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildProjectResponse = (
  supabaseAdmin: ReturnType<typeof createClient>,
  row: any,
) => {
  let mediaUrl: string | null = row.media_url ?? null;
  if (mediaUrl && !mediaUrl.includes("://")) {
    mediaUrl = resolveStoragePublicUrl(supabaseAdmin, PROJECT_BUCKET, mediaUrl);
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    summary: row.summary,
    status: row.status,
    featured: row.featured ?? false,
    mediaType: row.media_type ?? "image",
    mediaPath: row.media_type === "image" ? row.media_url ?? null : null,
    mediaUrl,
    visibility: row.visibility,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const submitServiceRequest = async (payload: any, fallbackProfile: any | null) => {
  const { clientId: rawClientId, serviceType, title, description, priority, attachment } = payload ?? {};
  const emailErrors: string[] = [];

  const clientId = rawClientId ?? fallbackProfile?.id ?? null;
  if (!clientId) {
    return {
      status: 401,
      body: { error: "Client authentication required" },
    };
  }

  if (!serviceType || typeof serviceType !== "string" || !serviceType.trim()) {
    return {
      status: 400,
      body: { error: "serviceType is required" },
    };
  }

  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  if (!trimmedTitle || !trimmedDescription) {
    return {
      status: 400,
      body: { error: "title and description are required" },
    };
  }

  const allowedPriorities = new Set(["#", "low", "medium", "high", "urgent"]);
  const priorityValue = typeof priority === "string" && priority.trim()
    ? priority.toLowerCase().trim()
    : "#";
  if (!allowedPriorities.has(priorityValue)) {
    return {
      status: 400,
      body: { error: "Invalid priority" },
    };
  }

  let serviceClient: ReturnType<typeof createClient>;
  try {
    serviceClient = getServiceClient();
  } catch (err) {
    return {
      status: 500,
      body: { error: (err as Error).message },
    };
  }

  const { data: clientProfile, error: clientProfileError } = await serviceClient
    .from("profiles")
    .select("id, user_id, role, department")
    .or(`id.eq.${clientId},user_id.eq.${clientId}`)
    .maybeSingle();

  if (clientProfileError) {
    return {
      status: 400,
      body: { error: clientProfileError.message },
    };
  }

  if (!clientProfile) {
    return {
      status: 404,
      body: { error: "Client profile not found" },
    };
  }

  const rawAttachments = Array.isArray(attachment)
    ? attachment
    : attachment
      ? [attachment]
      : [];

  const processedAttachments = [] as Array<{
    name: string | null;
    type: string | null;
    size: number | null;
    path: string | null;
    url: string | null;
  }>;

  for (const item of rawAttachments) {
    if (!item) continue;

    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Attachment";
    const type = typeof item.type === "string" ? item.type : null;
    const size = typeof item.size === "number" ? item.size : null;
    const hasContent = typeof item.content === "string" && item.content.startsWith("data:");

    if (hasContent) {
      try {
        const folder = `${SERVICE_REQUEST_FOLDER}/${clientProfile.id}`;
        const storedPath = await uploadDataUrlToStorage(serviceClient, SERVICE_REQUEST_BUCKET, folder, item.content);
        const publicUrl = normalizePublicUrlHost(
          resolveStoragePublicUrl(serviceClient, SERVICE_REQUEST_BUCKET, storedPath),
        );
        processedAttachments.push({
          name,
          type,
          size,
          path: storedPath,
          url: publicUrl,
        });
      } catch (uploadError) {
        console.error("[marketing-manage] Failed to upload service request attachment", uploadError);
        return {
          status: 400,
          body: { error: "Failed to upload attachment" },
        };
      }
    } else {
      const existingPath = typeof item.path === "string" ? item.path : null;
      const url = typeof item.url === "string" && item.url
        ? normalizePublicUrlHost(item.url)
        : existingPath
          ? normalizePublicUrlHost(resolveStoragePublicUrl(serviceClient, SERVICE_REQUEST_BUCKET, existingPath))
          : null;
      processedAttachments.push({
        name,
        type,
        size,
        path: existingPath,
        url,
      });
    }
  }

  // Determine department head for employee task reports (titles starting with "Report:")
  let assignedTo: string | null = null;
  try {
    if (trimmedTitle.toLowerCase().startsWith("report:")) {
      const deptLabel = String(serviceType ?? "").trim();
      const lower = deptLabel.toLowerCase();
      let headRole: string | null = null;
      if (lower.includes("ict")) headRole = "ict_head";
      else if (lower.includes("mechanical")) headRole = "mechanical_head";
      else if (lower.includes("material")) headRole = "material_testing_head";
      else if (lower.includes("architectural") || lower.includes("civil")) headRole = "architectural_civil_head";

      if (headRole) {
        // Prefer a head whose department matches the serviceType label
        const { data: match } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("role", headRole)
          .eq("is_active", true)
          .ilike("department", `${deptLabel}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (match?.id) {
          assignedTo = match.id;
        } else {
          const { data: anyHead } = await serviceClient
            .from("profiles")
            .select("id")
            .eq("role", headRole)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          assignedTo = anyHead?.id ?? null;
        }
      }
    }
  } catch (resolveErr) {
    console.warn("[marketing-manage] Failed to resolve department head for report assignment", resolveErr);
  }

  // Fallback: if still not assigned and this is a report, try deriving the head from the employee's own department
  if (!assignedTo && trimmedTitle.toLowerCase().startsWith("report:")) {
    try {
      const employeeDept = typeof (clientProfile as any)?.department === "string"
        ? String((clientProfile as any).department)
        : null;
      if (employeeDept) {
        const d = employeeDept.toLowerCase();
        let headRoleFallback: string | null = null;
        if (d.includes("ict")) headRoleFallback = "ict_head";
        else if (d.includes("mechanical")) headRoleFallback = "mechanical_head";
        else if (d.includes("material")) headRoleFallback = "material_testing_head";
        else if (d.includes("architectural") || d.includes("civil")) headRoleFallback = "architectural_civil_head";

        if (headRoleFallback) {
          const { data: anyHead2 } = await serviceClient
            .from("profiles")
            .select("id")
            .eq("role", headRoleFallback)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          assignedTo = anyHead2?.id ?? assignedTo;
        }
      }
    } catch (fallbackErr) {
      console.warn("[marketing-manage] Fallback head resolution failed", fallbackErr);
    }
  }

  // Persist attachments like CV uploads:
  // - If one file: store a single public URL string
  // - If multiple: store an array of public URL strings
  let attachmentsField: string | string[] | null = null;
  if (processedAttachments.length === 1) {
    attachmentsField = processedAttachments[0].url ?? null;
  } else if (processedAttachments.length > 1) {
    attachmentsField = processedAttachments.map((a) => a.url!).filter(Boolean) as string[];
  }

  // New normalized array column (text[]): attachment_urls
  const attachmentUrls: string[] | null = processedAttachments.length > 0
    ? processedAttachments.map((a) => a.url).filter((u): u is string => Boolean(u))
    : null;

  const { data: createdRequest, error } = await serviceClient
    .from("service_requests")
    .insert({
      client_id: clientProfile.id,
      service_type: serviceType.trim(),
      title: trimmedTitle,
      description: trimmedDescription,
      priority: priorityValue,
      status: "pending",
      attachments: attachmentsField,
      attachment_urls: attachmentUrls,
      assigned_to: assignedTo ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[marketing-manage] Failed to create service request", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  if (emailErrors.length > 0) {
    return {
      status: 207,
      body: { success: true, emailWarnings: emailErrors },
    };
  }

  return {
    status: 200,
    body: { success: true, request: createdRequest, emailWarnings: emailErrors.length > 0 ? emailErrors : undefined },
  };
};

const submitConsultancyRequest = async (payload: any, fallbackProfile: any | null) => {
  const { clientId: rawClientId, department, title, description, contactEmail } = payload ?? {};

  // Prefer authenticated profile ID when available to prevent spoofing
  const clientId = (fallbackProfile?.id ?? null) || rawClientId || null;
  if (!clientId) {
    return {
      status: 401,
      body: { error: "Client authentication required" },
    };
  }

  if (!department || typeof department !== "string" || !department.trim()) {
    return {
      status: 400,
      body: { error: "department is required" },
    };
  }

  const allowedDepartments = new Set(["ICT", "Mechanical", "Material Testing", "Architectural & Civil"]);
  const normalizedDepartment = department.trim();
  if (!allowedDepartments.has(normalizedDepartment)) {
    return {
      status: 400,
      body: { error: "Invalid department" },
    };
  }

  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  if (!trimmedTitle || !trimmedDescription) {
    return {
      status: 400,
      body: { error: "title and description are required" },
    };
  }

  let serviceClient: ReturnType<typeof createClient>;
  try {
    serviceClient = getServiceClient();
  } catch (err) {
    return {
      status: 500,
      body: { error: (err as Error).message },
    };
  }

  const { data: clientProfile, error: clientProfileError } = await serviceClient
    .from("profiles")
    .select("id, user_id, role")
    .or(`id.eq.${clientId},user_id.eq.${clientId}`)
    .maybeSingle();

  if (clientProfileError) {
    return {
      status: 400,
      body: { error: clientProfileError.message },
    };
  }

  if (!clientProfile) {
    return {
      status: 404,
      body: { error: "Client profile not found" },
    };
  }

  const { data: createdRequest, error } = await serviceClient
    .from("consultancyrequest")
    .insert({
      client_id: clientProfile.id,
      department: normalizedDepartment,
      title: trimmedTitle,
      description: trimmedDescription,
      status: "pending",
      contact_email: contactEmail ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[marketing-manage] Failed to create consultancy request", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true, request: createdRequest },
  };
};

// List consultancy requests for a department (service role)
const listConsultancyRequests = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  department: string,
  limit = 100,
) => {
  const { data, error } = await supabaseAdmin
    .from("consultancyrequest")
    .select("*")
    .eq("department", department)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 200,
    body: { requests: data ?? [] },
  } as const;
};

// Schedule consultancy: assign employee, set schedule, append note, send emails to client and employee
const scheduleConsultancy = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  body: any,
) => {
  const { id, assignedEmployeeId, scheduleAtISO, note } = body ?? {};
  if (!id || !assignedEmployeeId || !scheduleAtISO) {
    return { status: 400, body: { error: "Missing parameters" } } as const;
  }

  // Append note if present
  let updatedNotes: string | null = note ?? null;
  try {
    const { data: current } = await supabaseAdmin
      .from("consultancyrequest")
      .select("notes")
      .eq("id", id)
      .maybeSingle<{ notes: string | null }>();
    if (current?.notes && note) updatedNotes = `${current.notes}\n\n${note}`;
  } catch {}

  const { data, error } = await supabaseAdmin
    .from("consultancyrequest")
    .update({
      assigned_employee: assignedEmployeeId,
      schedule_at: scheduleAtISO,
      status: "scheduled",
      notes: updatedNotes ?? undefined,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return { status: 400, body: { error: error.message } } as const;
  }

  // Fetch contact emails
  const requestRow = data as any;
  let clientEmail: string | null = requestRow?.contact_email ?? null;
  let employeeEmail: string | null = null;
  let employeeName: string | null = null;
  let clientName: string | null = null;

  try {
    if (!clientEmail && requestRow?.client_id) {
      const { data: cprof } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", requestRow.client_id)
        .maybeSingle();
      clientEmail = cprof?.email ?? null;
      clientName = cprof?.full_name ?? null;
    }
  } catch {}

  try {
    const { data: eprof } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", assignedEmployeeId)
      .maybeSingle();
    employeeEmail = eprof?.email ?? null;
    employeeName = eprof?.full_name ?? null;
  } catch {}

  const warnings: string[] = [];
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "no-reply@gcae.local";
  const scheduleText = new Date(scheduleAtISO).toLocaleString();

  const sendResend = async (to: string[], subject: string, html: string) => {
    if (!RESEND_API_KEY) {
      warnings.push("Missing RESEND_API_KEY; emails not sent");
      return;
    }
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    }).catch((e) => warnings.push(`Email send failed: ${String(e)}`));
  };

  const subject = `Consultancy Scheduled: ${requestRow?.title ?? "Consultancy"}`;
  const htmlClient = `
    <p>Dear ${clientName ?? "Client"},</p>
    <p>Your consultancy request has been scheduled.</p>
    <p><strong>Topic:</strong> ${requestRow?.title ?? "Consultancy"}<br/>
       <strong>Department:</strong> ${requestRow?.department}<br/>
       <strong>Date/Time:</strong> ${scheduleText}
    </p>
    <p>You will be contacted by ${employeeName ?? "our consultant"}.</p>
  `;
  const htmlEmployee = `
    <p>Dear ${employeeName ?? "Consultant"},</p>
    <p>You have been assigned to a consultancy.</p>
    <p><strong>Topic:</strong> ${requestRow?.title ?? "Consultancy"}<br/>
       <strong>Department:</strong> ${requestRow?.department}<br/>
       <strong>Date/Time:</strong> ${scheduleText}
    </p>
    <p>Please reach out to the client at ${clientEmail ?? "their portal"}.</p>
  `;

  const toClients: string[] = [];
  if (clientEmail) toClients.push(clientEmail);
  const toEmployees: string[] = [];
  if (employeeEmail) toEmployees.push(employeeEmail);

  if (toClients.length > 0) {
    await sendResend(toClients, subject, htmlClient);
  } else {
    warnings.push("Client email missing; client not notified");
  }

  if (toEmployees.length > 0) {
    await sendResend(toEmployees, subject, htmlEmployee);
  } else {
    warnings.push("Employee email missing; employee not notified");
  }

  return {
    status: 200,
    body: { request: data, emailWarnings: warnings.length ? warnings : undefined },
  } as const;
};

const sendInterviewSchedule = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  payload: any,
) => {
  const {
    jobId,
    applicantName,
    applicantEmail,
    position,
    interviewer,
    interviewerEmail,
    scheduledFor,
    location,
    notes,
    sendApplicantEmail,
    sendInterviewerEmail,
  } = payload ?? {};

  if (!jobId || !applicantName || !applicantEmail || !position || !interviewer || !interviewerEmail || !scheduledFor || !location) {
    return {
      status: 400,
      body: { error: "Missing interview details" },
    };
  }

  const scheduleDate = new Date(scheduledFor);
  if (Number.isNaN(scheduleDate.getTime())) {
    return {
      status: 400,
      body: { error: "Invalid interview date" },
    };
  }

  let scheduleRow: any = null;
  try {
    const normalizedApplicantEmail = typeof applicantEmail === "string" ? applicantEmail.trim().toLowerCase() : applicantEmail;
    const normalizedInterviewerEmail = typeof interviewerEmail === "string" ? interviewerEmail.trim().toLowerCase() : interviewerEmail;

    // Try to resolve linked profiles for applicant and interviewer (best-effort)
    let applicantProfileId: string | null = null;
    let interviewerProfileId: string | null = null;
    try {
      if (typeof normalizedApplicantEmail === "string") {
        const { data: a, error: ae } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", normalizedApplicantEmail)
          .maybeSingle();
        if (!ae && a?.id) applicantProfileId = a.id;
      }
      if (typeof normalizedInterviewerEmail === "string") {
        const { data: i, error: ie } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", normalizedInterviewerEmail)
          .maybeSingle();
        if (!ie && i?.id) interviewerProfileId = i.id;
      }
    } catch (_) {
      // best-effort only
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("interview_schedule_logs")
      .insert({
        job_id: jobId,
        applicant_name: applicantName,
        applicant_email: normalizedApplicantEmail,
        interviewer,
        interviewer_email: normalizedInterviewerEmail,
        position,
        scheduled_for: scheduleDate.toISOString(),
        location,
        notes,
        organized_by: profile?.id ?? null,
        applicant_profile_id: applicantProfileId,
        interviewer_profile_id: interviewerProfileId,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      return { status: 400, body: { error: insertError.message } } as const;
    }

    scheduleRow = data ?? null;
  } catch (e) {
    return { status: 500, body: { error: String(e) } } as const;
  }

  const shouldEmailApplicant = sendApplicantEmail !== false;
  const shouldEmailInterviewer = sendInterviewerEmail !== false;

  const organizerName = profile?.full_name ?? "HR Team";
  const organizerEmail = profile?.email ?? null;
  const organizerContact = organizerEmail ? ` (${organizerEmail})` : "";
  const formattedDate = scheduleDate.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  let interviewerScheduledTotal = 1;
  try {
    const { count, error: countError } = await supabaseAdmin
      .from("interview_schedule_logs")
      .select("id", { count: "exact", head: true })
      .eq("interviewer_email", interviewerEmail);

    if (!countError && typeof count === "number") {
      interviewerScheduledTotal = count + 1;
    } else if (countError) {
      console.warn("[marketing-manage] Could not read interviewer schedule count", countError);
    }
  } catch (countException) {
    console.warn("[marketing-manage] Unexpected error counting interviewer schedules", countException);
  }

  const applicantBody = `
    <p>Hi ${applicantName},</p>
    <p>Your interview has been scheduled. Here are the details:</p>
    <ul style="padding-left: 16px;">
      <li><strong>Position:</strong> ${position}</li>
      <li><strong>Date & Time:</strong> ${formattedDate}</li>
      <li><strong>Location:</strong> ${location}</li>
    </ul>
    ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
    <p>Please reply to this email if you have any questions.</p>
  `;

  const interviewerBody = `
    <p>Hello ${interviewer},</p>
    <p>You have a new interview scheduled. Summary:</p>
    <ul style="padding-left: 16px;">
      <li><strong>Candidate:</strong> ${applicantName} (${applicantEmail})</li>
      <li><strong>Position:</strong> ${position}</li>
      <li><strong>Date & Time:</strong> ${formattedDate}</li>
      <li><strong>Location:</strong> ${location}</li>
      <li><strong>HR Contact:</strong> ${organizerName}${organizerContact}</li>
    </ul>
    ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
    <p><strong>Applicants scheduled with you (including this one):</strong> ${interviewerScheduledTotal}</p>
    <p>Please confirm your availability by replying to this email.</p>
  `;

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const envFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? null;
  const envFromName = Deno.env.get("RESEND_FROM_NAME") ?? organizerName;
  const candidateFromEmail = envFromEmail ?? organizerEmail ?? null;
  const resolvedFromName = envFromEmail ? envFromName : organizerName;

  const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
  const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const gmailRefreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  const gmailSenderEmail = Deno.env.get("GMAIL_SENDER_EMAIL") ?? null;
  const gmailConfigured = Boolean(gmailClientId && gmailClientSecret && gmailRefreshToken);

  const sendWithFallback = async (to: string, subject: string, body: string, label: string) => {
    if (gmailConfigured) {
      try {
        await sendHtmlEmailViaGmail(
          {
            clientId: gmailClientId,
            clientSecret: gmailClientSecret,
            refreshToken: gmailRefreshToken,
            senderEmail: gmailSenderEmail ?? organizerEmail ?? null,
          },
          to,
          subject,
          body,
          organizerEmail,
        );
        return null;
      } catch (error) {
        console.warn(`[marketing-manage] ${label} Gmail attempt failed`, error);
        return `${label}: ${String(error)}`;
      }
    }

    if (!resendApiKey) {
      return `${label}: Email service not configured`;
    }

    const attempts: Array<[string, string | null]> = [
      ["primary", candidateFromEmail],
      ["fallback", null],
    ];

    let lastError: unknown = null;
    for (const [attemptLabel, override] of attempts) {
      if (attemptLabel === "primary" && !override) continue;
      try {
        await sendSystemEmail(resendApiKey, {
          to,
          subject,
          body,
          senderName: resolvedFromName,
          fromOverride: override,
          replyTo: organizerEmail,
        });
        return null;
      } catch (error) {
        lastError = error;
        console.warn(`[marketing-manage] ${label} email ${attemptLabel} attempt failed`, error);
      }
    }

    return lastError ? `${label}: ${String(lastError)}` : `${label}: unknown error`;
  };

  const [applicantSendError, interviewerSendError] = await Promise.all([
    shouldEmailApplicant ? sendWithFallback(applicantEmail, `Interview Scheduled: ${position}`, applicantBody, "applicant") : null,
    shouldEmailInterviewer ? sendWithFallback(interviewerEmail, `Interview Assignment: ${position}`, interviewerBody, "interviewer") : null,
  ]);

  const sendErrors = [applicantSendError, interviewerSendError].filter((value): value is string => Boolean(value));

  if (sendErrors.length > 0) {
    console.warn("[marketing-manage] Interview emails completed with warnings", sendErrors);
    return {
      status: 207,
      body: { success: true, schedule: scheduleRow ?? undefined, emailWarnings: sendErrors },
    };
  }

  return {
    status: 200,
    body: { success: true, schedule: scheduleRow ?? undefined },
  };
};

const listGalleryImages = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from("gallery_images")
    .select("id, title, description, image_url, is_featured, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[marketing-manage] Failed to list gallery images", error);
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 200,
    body: { images: data ?? [] },
  } as const;
};

const submitClientFeedback = async (payload: any, fallbackProfile: any | null) => {
  const { clientId: rawClientId, subject, message, rating, projectId } = payload ?? {};

  const clientId = rawClientId ?? fallbackProfile?.id ?? null;
  if (!clientId) {
    return {
      status: 401,
      body: { error: "Client authentication required" },
    };
  }

  const trimmedSubject = typeof subject === "string" ? subject.trim() : "";
  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  if (!trimmedSubject || !trimmedMessage) {
    return {
      status: 400,
      body: { error: "subject and message are required" },
    };
  }

  let serviceClient: ReturnType<typeof createClient>;
  try {
    serviceClient = getServiceClient();
  } catch (err) {
    return {
      status: 500,
      body: { error: (err as Error).message },
    };
  }

  const { data: clientProfile, error: clientProfileError } = await serviceClient
    .from("profiles")
    .select("id, user_id, role")
    .or(`id.eq.${clientId},user_id.eq.${clientId}`)
    .maybeSingle();

  if (clientProfileError) {
    return {
      status: 400,
      body: { error: clientProfileError.message },
    };
  }

  if (!clientProfile) {
    return {
      status: 404,
      body: { error: "Client profile not found" },
    };
  }

  const numericRating = typeof rating === "string" ? Number.parseInt(rating, 10) : rating;
  const ratingValue = Number.isFinite(numericRating) && numericRating !== null
    ? Math.min(5, Math.max(1, Number(numericRating)))
    : null;

  const { error } = await serviceClient
    .from("client_feedback")
    .insert({
      client_id: clientProfile.id,
      project_id: projectId ?? null,
      subject: trimmedSubject,
      message: trimmedMessage,
      rating: ratingValue,
      status: "new",
    });

  if (error) {
    console.error("[marketing-manage] Failed to create client feedback", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

interface AuthContext {
  supabaseAdmin: ReturnType<typeof createClient>;
  profile: any;
  token: string;
}

const getAuthContext = async (req: Request, allowedRoles?: string[]): Promise<AuthContext> => {
  const explicitToken = req.headers.get("x-gcae-auth") || req.headers.get("X-Gcae-Auth");
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

  let token = explicitToken ?? null;

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "");
  }

  if (!token) {
    throw new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("EDGE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jwtSecret = Deno.env.get("EDGE_JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    throw new Response(JSON.stringify({ error: "Missing server configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  let payload: Record<string, unknown>;
  try {
    payload = (await verify(token, key, "HS256")) as Record<string, unknown>;
  } catch (verifyError) {
    console.warn("[marketing-manage] JWT verification failed, attempting decode", verifyError);
    const decoded = decode(token);
    if (!decoded) {
      throw new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    payload = decoded[1] as Record<string, unknown>;
  }

  const sub = payload.sub as string | undefined;
  if (!sub) {
    throw new Response(JSON.stringify({ error: "Invalid token payload" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, user_id, role, full_name, email")
    .or(`user_id.eq.${sub},id.eq.${sub}`)
    .maybeSingle();

  if (profileError) {
    throw new Response(JSON.stringify({ error: `Profile lookup failed: ${profileError.message}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!profile) {
    throw new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { supabaseAdmin, profile, token };
};

const getServiceClient = () => {
  const supabaseUrl = Deno.env.get("EDGE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing server configuration");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const requireAuth = async (auth: AuthContext | null) => {
  if (!auth) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return auth;
};

const HR_ROLES = new Set(["hr_staff", "hr_manager"]);

const requireAdminOrHr = async (auth: AuthContext | null) => {
  const ensuredAuth = await requireAuth(auth);
  const profileRole = ensuredAuth.profile?.role;

  if (profileRole !== "super_admin" && !HR_ROLES.has(profileRole)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return ensuredAuth;
};

const getProfileEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  body: any,
) => {
  const { profileId } = body ?? {};
  const id = typeof profileId === "string" ? profileId.trim() : "";

  if (!id) {
    return {
      status: 400,
      body: { error: "profileId is required" },
    } as const;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  if (!data) {
    return {
      status: 404,
      body: { error: "Profile not found" },
    } as const;
  }

  return {
    status: 200,
    body: { success: true, profile: data },
  } as const;
};

const requireAdminRole = async (auth: AuthContext | null) => {
  const ensuredAuth = await requireAuth(auth);
  const profileRole = ensuredAuth.profile?.role;

  if (profileRole !== "super_admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return ensuredAuth;
};

const listAdminHrMessages = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from("admin_hr_messages")
    .select("id, sender_role, sender_id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[marketing-manage] Failed to list admin/hr messages", error);
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 200,
    body: { messages: data ?? [] },
  } as const;
};

const sendAdminHrMessage = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  body: any,
) => {
  const { message } = body ?? {};

  if (!isNonEmptyString(message)) {
    return {
      status: 400,
      body: { error: "Message content is required" },
    } as const;
  }

  const senderRole = profile?.role && HR_ROLES.has(profile.role) ? "hr" : "admin";

  const { data, error } = await supabaseAdmin
    .from("admin_hr_messages")
    .insert({
      sender_role: senderRole,
      sender_id: profile?.user_id ?? profile?.id ?? null,
      message: message.trim(),
    })
    .select("id, sender_role, sender_id, message, created_at")
    .maybeSingle();

  if (error) {
    console.error("[marketing-manage] Failed to send admin/hr message", error);
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 201,
    body: { message: data },
  } as const;
};

const resetAdminHrMessages = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { error } = await supabaseAdmin
    .from("admin_hr_messages")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");

  if (error) {
    console.error("[marketing-manage] Failed to reset admin/hr messages", error);
    return {
      status: 400,
      body: { error: error.message },
    } as const;
  }

  return {
    status: 200,
    body: { success: true },
  } as const;
};

const createJobPosting = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: any,
) => {
  const {
    title,
    departmentId,
    location,
    type,
    salaryRange,
    closesAt,
    description,
    requirements,
    responsibilities,
    status,
  } = payload ?? {};

  const trimmedTitle = isNonEmptyString(title) ? title.trim() : "";
  const trimmedLocation = isNonEmptyString(location) ? location.trim() : "";
  const trimmedDescription = isNonEmptyString(description) ? description.trim() : "";
  const trimmedRequirements = isNonEmptyString(requirements) ? requirements.trim() : "";
  const trimmedResponsibilities = isNonEmptyString(responsibilities) ? responsibilities.trim() : "";

  if (!trimmedTitle || !trimmedLocation || !trimmedDescription || !trimmedRequirements || !trimmedResponsibilities) {
    return {
      status: 400,
      body: {
        error: "title, location, description, requirements, and responsibilities are required",
      },
    };
  }

  const normalizedType = isNonEmptyString(type) && JOB_EMPLOYMENT_TYPES.has(type.trim())
    ? type.trim()
    : "Full-time";

  const normalizedStatus = isNonEmptyString(status) && JOB_STATUS_VALUES.has(status.trim().toLowerCase())
    ? status.trim().toLowerCase()
    : "active";

  const normalizedDepartmentId = isNonEmptyString(departmentId) ? departmentId.trim() : null;
  const normalizedSalaryRange = isNonEmptyString(salaryRange) ? salaryRange.trim() : null;

  let closesAtValue: string | null = null;
  if (isNonEmptyString(closesAt)) {
    const parsed = new Date(closesAt as string);
    if (!Number.isNaN(parsed.getTime())) {
      closesAtValue = parsed.toISOString();
    }
  }

  const insertPayload = {
    title: trimmedTitle,
    department_id: normalizedDepartmentId,
    location: trimmedLocation,
    type: normalizedType,
    salary_range: normalizedSalaryRange,
    closes_at: closesAtValue,
    description: trimmedDescription,
    requirements: trimmedRequirements,
    responsibilities: trimmedResponsibilities,
    status: normalizedStatus,
  };

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[marketing-manage] Failed to create job posting", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      job: data ?? null,
    },
  };
};

const listJobPostings = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id, title, status")
    .order("posted_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[marketing-manage] Failed to list job postings", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      jobs: data ?? [],
    },
  };
};

const updateJobPosting = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: any,
) => {
  const {
    jobId,
    title,
    status,
    location,
    type,
    salaryRange,
    closesAt,
  } = payload ?? {};

  if (!isNonEmptyString(jobId)) {
    return {
      status: 400,
      body: { error: "jobId is required" },
    };
  }

  const updatePayload: Record<string, unknown> = {};

  if (isNonEmptyString(title)) {
    updatePayload.title = title.trim();
  }

  if (isNonEmptyString(location)) {
    updatePayload.location = location.trim();
  }

  if (isNonEmptyString(type) && JOB_EMPLOYMENT_TYPES.has(type.trim())) {
    updatePayload.type = type.trim();
  }

  if (isNonEmptyString(status)) {
    const normalizedStatus = status.trim().toLowerCase();
    if (!JOB_STATUS_VALUES.has(normalizedStatus)) {
      return {
        status: 400,
        body: { error: "Invalid status value" },
      };
    }
    updatePayload.status = normalizedStatus;
  }

  if (isNonEmptyString(salaryRange)) {
    updatePayload.salary_range = salaryRange.trim();
  }

  if (typeof closesAt === "string" && closesAt.length > 0) {
    const parsed = new Date(closesAt);
    if (!Number.isNaN(parsed.getTime())) {
      updatePayload.closes_at = parsed.toISOString();
    }
  } else if (closesAt === null) {
    updatePayload.closes_at = null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      status: 400,
      body: { error: "No valid fields to update" },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .update(updatePayload)
    .eq("id", jobId)
    .select("id, title, status, location, type, salary_range, closes_at")
    .maybeSingle();

  if (error) {
    console.error("[marketing-manage] Failed to update job posting", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  if (!data) {
    return {
      status: 404,
      body: { error: "Job not found" },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      job: data,
    },
  };
};

const deleteJobPosting = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: any,
) => {
  const { jobId } = payload ?? {};

  if (!isNonEmptyString(jobId)) {
    return {
      status: 400,
      body: { error: "jobId is required" },
    };
  }

  const { error } = await supabaseAdmin.from("jobs").delete().eq("id", jobId);

  if (error) {
    console.error("[marketing-manage] Failed to delete job posting", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const getDashboardData = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(startOfToday.getDate() + 1);

  // Count total newsletter subscribers from the correct table.
  let newsletterActiveCount = 0;
  try {
    const totalAttempt = await supabaseAdmin
      .from("newsletter_subscriptions")
      .select("*", { count: "exact", head: true });
    if (!totalAttempt.error && typeof totalAttempt.count === "number") {
      newsletterActiveCount = totalAttempt.count;
    }
  } catch (_) {
    // ignore; value remains 0
  }

  // Contact messages: total, replied, and by-status counts
  let contactTotal = 0;
  let contactReplied = 0;
  const contactByStatus: Record<string, number> = { new: 0, read: 0, replied: 0, archived: 0 };
  try {
    const [totalRes, repliedRes, newRes, readRes, archivedRes] = await Promise.all([
      supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "replied"),
      supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "read"),
      supabaseAdmin.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "archived"),
    ]);
    contactTotal = totalRes.count ?? 0;
    contactReplied = repliedRes.count ?? 0;
    contactByStatus.new = newRes.count ?? 0;
    contactByStatus.read = readRes.count ?? 0;
    contactByStatus.replied = repliedRes.count ?? 0;
    contactByStatus.archived = archivedRes.count ?? 0;
  } catch (_) {
    // keep defaults
  }

  // Users: total and by role from profiles
  let usersCount = 0;
  const usersByRole: Record<string, number> = {};
  try {
    const totalUsers = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
    usersCount = totalUsers.count ?? 0;
    const roles = [
      "super_admin",
      "hr_staff",
      "marketing_communications",
      "architectural_civil_head",
      "mechanical_head",
      "ict_head",
      "material_testing_head",
      "employee",
      "client",
    ];
    const roleCounts = await Promise.all(
      roles.map((r) => supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", r))
    );
    roles.forEach((r, i) => { usersByRole[r] = roleCounts[i].count ?? 0; });
  } catch (_) {
    // keep defaults
  }

  const [
    jobsResult,
    applicationsTodayResult,
    interviewsTodayResult,
    offersPendingResult,
    recentApplicationsResult,
    todaysInterviewsResult,
  ] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString()),
    supabaseAdmin
      .from("interview_schedule_logs")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString()),
    supabaseAdmin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .in("status", ["offer", "offered"]),
    supabaseAdmin
      .from("applications")
      .select(
        // Use explicit FK join to jobs; remove invalid interview join
        `id, name, status, created_at, job:jobs!applications_job_id_fkey(title)`
      )
      .order("created_at", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("interview_schedule_logs")
      .select("id, applicant_name, position, scheduled_for, interviewer")
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true }),
  ]);

  const recentApplications = (recentApplicationsResult.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    position: row.job?.title ?? "",
    status: row.status,
    created_at: row.created_at,
    next_interview: null as string | null,
  }));

  const todaysInterviews = (todaysInterviewsResult.data ?? []).map((row: any) => ({
    id: row.id,
    applicant: row.applicant_name,
    position: row.position,
    scheduled_for: row.scheduled_for,
    interviewer: row.interviewer,
  }));

  return {
    newsletterActiveCount,
    jobCount: jobsResult.count ?? 0,
    applicationsToday: applicationsTodayResult.count ?? 0,
    interviewsScheduled: interviewsTodayResult.count ?? 0,
    offersPending: offersPendingResult.count ?? 0,
    recentApplications,
    todaysInterviews,
    usersCount,
    usersByRole,
    stats: {
      contactMessages: Math.max(0, (contactTotal ?? 0) - (contactReplied ?? 0)),
      contactMessagesByStatus: contactByStatus,
    },
  };
};

// Returns active employee profiles for a given department (case-insensitive, robust matching)
const listEmployeesByDepartment = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  department: string,
) => {
  const normalized = (department ?? "").toString().trim().toLowerCase();

  // Build flexible search terms to handle naming variations in profiles.department
  const terms = new Set<string>();
  if (normalized.includes("architect") || normalized.includes("civil")) {
    terms.add("%architect%");
    terms.add("%architecture%");
    terms.add("%civil%");
    // often stored as engineering in some orgs
    terms.add("%engineer%");
    terms.add("%engineering%");
  }
  if (normalized.includes("material") || normalized.includes("testing")) {
    terms.add("%material%");
    terms.add("%materials%");
    terms.add("%testing%");
  }
  if (normalized.includes("electro") || normalized.includes("mechanical")) {
    terms.add("%electro%");
    terms.add("%electro-mech%");
    terms.add("%electromech%");
    terms.add("%mechanical%");
  }
  // Always include a contains check on the raw label as a fallback
  if (normalized.length > 0) {
    terms.add(`%${normalized}%`);
  }

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, department, is_active, role")
    .eq("role", "employee")
    .eq("is_active", true);

  const patterns = Array.from(terms.values());
  if (patterns.length === 0) {
    // Fallback to a safer contains check on the provided label
    query = query.ilike("department", `%${department}%`);
  } else if (patterns.length === 1) {
    query = query.ilike("department", patterns[0]);
  } else {
    // Build PostgREST or() clause: department.ilike.%foo%,department.ilike.%bar%
    const orClause = patterns.map((pat) => `department.ilike.${pat}`).join(",");
    query = query.or(orClause);
  }

  const { data, error } = await query.order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    department: row.department,
  }));
};

// List interview schedules for the authenticated client (by profile id or email)
const listClientInterviewSchedules = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  limit = 100,
) => {
  const email = (profile?.email ?? "").toLowerCase();
  const profileId = profile?.id ?? null;

  let query = supabaseAdmin
    .from("interview_schedule_logs")
    .select("*")
    .order("scheduled_for", { ascending: false })
    .limit(limit);

  if (profileId) {
    query = query.eq("applicant_profile_id", profileId);
  } else if (email) {
    query = query.ilike("applicant_email", email);
  } else {
    return { status: 200, body: { schedules: [] } } as const;
  }

  const { data, error } = await query;

  if (error) {
    return { status: 400, body: { error: error.message } } as const;
  }
  return { status: 200, body: { schedules: data ?? [] } } as const;
};

// List interview schedules for HR staff (all schedules, newest first)
const listHrInterviewSchedules = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  limit = 100,
  status?: string | null,
) => {
  let query = supabaseAdmin
    .from("interview_schedule_logs")
    .select("*")
    .order("scheduled_for", { ascending: false })
    .limit(limit);

  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalizedStatus) {
    query = query.eq("status", normalizedStatus);
  }

  const { data, error } = await query;
  if (error) {
    return { status: 400, body: { error: error.message } } as const;
  }
  return { status: 200, body: { schedules: data ?? [] } } as const;
};

// HR can update interview schedule status without the employee ownership restriction
// NOTE: HR update is intentionally not exposed. Only the interviewer (employee) can update status.

const updateInterviewScheduleStatus = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  payload: any,
) => {
  const { id, status } = payload ?? {};
  const scheduleId = typeof id === "string" ? id.trim() : null;
  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : null;

  if (!scheduleId) {
    return { status: 400, body: { error: "id is required" } } as const;
  }

  const allowed = new Set(["waiting", "confirmed", "completed", "cancelled"]);
  if (!normalizedStatus || !allowed.has(normalizedStatus)) {
    return { status: 400, body: { error: "Invalid status" } } as const;
  }

  const profileId = profile?.id ?? null;
  const email = String(profile?.email ?? "").toLowerCase();
  if (!profileId && !email) {
    return { status: 401, body: { error: "Profile not found" } } as const;
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("interview_schedule_logs")
    .select("id, interviewer_profile_id, interviewer_email")
    .eq("id", scheduleId)
    .maybeSingle();

  if (fetchError) {
    return { status: 400, body: { error: fetchError.message } } as const;
  }

  if (!existing) {
    return { status: 404, body: { error: "Schedule not found" } } as const;
  }

  const matchesProfile = profileId && existing.interviewer_profile_id && existing.interviewer_profile_id === profileId;
  const matchesEmail = email && String(existing.interviewer_email ?? "").toLowerCase() === email;
  if (!matchesProfile && !matchesEmail) {
    return { status: 403, body: { error: "Forbidden" } } as const;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("interview_schedule_logs")
    .update({ status: normalizedStatus })
    .eq("id", scheduleId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return { status: 400, body: { error: updateError.message } } as const;
  }

  if (!updated) {
    return { status: 404, body: { error: "Schedule not found" } } as const;
  }

  return { status: 200, body: { success: true, schedule: updated } } as const;
};

// List interview schedules for the authenticated employee (interviewer) by profile id or email
const listEmployeeInterviewSchedules = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  limit = 100,
) => {
  const email = (profile?.email ?? "").toLowerCase();
  const profileId = profile?.id ?? null;

  let query = supabaseAdmin
    .from("interview_schedule_logs")
    .select("*")
    .order("scheduled_for", { ascending: false })
    .limit(limit);

  if (profileId) {
    query = query.eq("interviewer_profile_id", profileId);
  } else if (email) {
    query = query.ilike("interviewer_email", email);
  } else {
    return { status: 200, body: { schedules: [] } } as const;
  }

  const { data, error } = await query;

  if (error) {
    return { status: 400, body: { error: error.message } } as const;
  }
  return { status: 200, body: { schedules: data ?? [] } } as const;
};

const normalizeCategory = (rawCategory: unknown) => {
  if (!isNonEmptyString(rawCategory)) return null;
  const category = rawCategory.trim().toLowerCase();
  return NEWS_CATEGORY_VALUES.has(category) ? category : null;
};

const createPost = async (supabaseAdmin: ReturnType<typeof createClient>, profile: any, payload: any) => {
  const { title, content, slug, category, summary, coverImageDataUrl } = payload ?? {};

  const trimmedTitle = isNonEmptyString(title) ? title.trim() : "";
  const trimmedContent = isNonEmptyString(content) ? content.trim() : "";
  if (!trimmedTitle || !trimmedContent) {
    return {
      status: 400,
      body: { error: "Title and content are required" },
    };
  }

  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    return {
      status: 400,
      body: { error: "A valid category is required" },
    };
  }

  const trimmedSummary = isNonEmptyString(summary) ? summary.trim() : null;

  let coverImagePath: string | null = null;
  if (coverImageDataUrl) {
    if (!isDataUrl(coverImageDataUrl)) {
      return {
        status: 400,
        body: { error: "coverImageDataUrl must be a valid data URL" },
      };
    }

    try {
      coverImagePath = await uploadDataUrlToStorage(supabaseAdmin, NEWS_BUCKET, "posts", coverImageDataUrl);
    } catch (err) {
      return {
        status: 400,
        body: { error: (err as Error).message },
      };
    }
  }

  const fallbackSlug = trimmedTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const finalSlug = isNonEmptyString(slug) ? slug.trim() : fallbackSlug;

  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      title: trimmedTitle,
      content: trimmedContent,
      slug: finalSlug,
      status: "draft",
      author_id: profile.id,
      category: normalizedCategory,
      summary: trimmedSummary,
      cover_image_url: coverImagePath,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (coverImagePath) {
      await deleteStorageObject(supabaseAdmin, NEWS_BUCKET, coverImagePath);
    }
    return {
      status: 400,
      body: { error: error?.message ?? "Failed to create post" },
    };
  }

  const post = buildPostResponse(supabaseAdmin, data);

  return {
    status: 201,
    body: { success: true, post },
  };
};

const updatePostDetails = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { postId, title, content, slug, category, summary, coverImageDataUrl, removeCoverImage } = payload ?? {};

  if (!postId) {
    return {
      status: 400,
      body: { error: "postId is required" },
    };
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError) {
    return {
      status: 400,
      body: { error: `Failed to load post: ${fetchError.message}` },
    };
  }

  if (!existing) {
    return {
      status: 404,
      body: { error: "Post not found" },
    };
  }

  const trimmedTitle = isNonEmptyString(title) ? title.trim() : existing.title;
  const trimmedContent = isNonEmptyString(content) ? content.trim() : existing.content;
  if (!trimmedTitle || !trimmedContent) {
    return {
      status: 400,
      body: { error: "Title and content are required" },
    };
  }

  const normalizedCategory = normalizeCategory(category ?? existing.category);
  if (!normalizedCategory) {
    return {
      status: 400,
      body: { error: "A valid category is required" },
    };
  }

  const trimmedSummary = typeof summary === "string" ? summary.trim() : existing.summary;
  const finalSlug = isNonEmptyString(slug) ? slug.trim() : existing.slug;

  let newCoverPath: string | null = null;
  let coverPathToUse: string | null = existing.cover_image_url ?? null;
  const shouldRemoveCover = Boolean(removeCoverImage);

  if (shouldRemoveCover) {
    coverPathToUse = null;
  } else if (typeof coverImageDataUrl === "string") {
    if (!isDataUrl(coverImageDataUrl)) {
      return {
        status: 400,
        body: { error: "coverImageDataUrl must be a valid data URL" },
      };
    }

    try {
      newCoverPath = await uploadDataUrlToStorage(supabaseAdmin, NEWS_BUCKET, "posts", coverImageDataUrl);
      coverPathToUse = newCoverPath;
    } catch (err) {
      return {
        status: 400,
        body: { error: (err as Error).message },
      };
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("posts")
    .update({
      title: trimmedTitle,
      content: trimmedContent,
      slug: finalSlug,
      category: normalizedCategory,
      summary: trimmedSummary,
      cover_image_url: coverPathToUse,
    })
    .eq("id", postId)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    if (newCoverPath) {
      await deleteStorageObject(supabaseAdmin, NEWS_BUCKET, newCoverPath);
    }

    return {
      status: 400,
      body: { error: updateError?.message ?? "Failed to update post" },
    };
  }

  if (shouldRemoveCover && existing.cover_image_url) {
    await deleteStorageObject(supabaseAdmin, NEWS_BUCKET, existing.cover_image_url);
  } else if (newCoverPath && existing.cover_image_url && existing.cover_image_url !== newCoverPath) {
    await deleteStorageObject(supabaseAdmin, NEWS_BUCKET, existing.cover_image_url);
  }

  return {
    status: 200,
    body: {
      success: true,
      post: buildPostResponse(supabaseAdmin, updated),
    },
  };
};

const listPosts = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { status } = payload ?? {};

  const query = supabaseAdmin
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (isNonEmptyString(status)) {
    query.eq("status", status.trim());
  }

  const { data, error } = await query;

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: {
      posts: (data ?? []).map((row: any) => buildPostResponse(supabaseAdmin, row)),
      categories: NEWS_CATEGORIES,
    },
  };
};

const deletePost = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { postId } = payload ?? {};

  if (!postId) {
    return {
      status: 400,
      body: { error: "postId is required" },
    };
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("posts")
    .select("id, cover_image_url")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError) {
    return {
      status: 400,
      body: { error: `Failed to load post: ${fetchError.message}` },
    };
  }

  if (!existing) {
    return {
      status: 404,
      body: { error: "Post not found" },
    };
  }

  const { error: deleteError } = await supabaseAdmin
    .from("posts")
    .delete()
    .eq("id", postId);

  if (deleteError) {
    return {
      status: 400,
      body: { error: deleteError.message },
    };
  }

  if (existing.cover_image_url) {
    await deleteStorageObject(supabaseAdmin, NEWS_BUCKET, existing.cover_image_url);
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const createCampaign = async (supabaseAdmin: ReturnType<typeof createClient>, profile: any, payload: any) => {
  const { platform, title, copy, imageUrl, scheduledAt, approved } = payload ?? {};

  if (!isNonEmptyString(platform) || !isNonEmptyString(title) || !isNonEmptyString(copy)) {
    return {
      status: 400,
      body: { error: "platform, title, and copy are required" },
    };
  }

  const normalizedPlatform = platform.trim().toLowerCase();
  if (!["facebook", "linkedin", "telegram", "twitter"].includes(normalizedPlatform)) {
    return {
      status: 400,
      body: { error: "Invalid platform" },
    };
  }

  const scheduledTimestamp = scheduledAt ? new Date(scheduledAt) : null;
  if (scheduledAt && Number.isNaN(scheduledTimestamp?.getTime())) {
    return {
      status: 400,
      body: { error: "Invalid scheduledAt timestamp" },
    };
  }

  const { data, error } = await supabaseAdmin
    .from(SOCIAL_TABLE)
    .insert({
      platform: normalizedPlatform,
      title: title.trim(),
      copy: copy.trim(),
      image_url: isNonEmptyString(imageUrl) ? imageUrl.trim() : null,
      scheduled_at: scheduledTimestamp ? scheduledTimestamp.toISOString() : null,
      approved: Boolean(approved),
      created_by: profile?.id ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      status: 400,
      body: { error: error?.message ?? "Failed to create campaign" },
    };
  }

  return {
    status: 201,
    body: { success: true, campaign: buildCampaignResponse(data) },
  };
};

const updateCampaign = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { campaignId, title, copy, imageUrl, scheduledAt, approved, platform } = payload ?? {};

  if (!campaignId) {
    return {
      status: 400,
      body: { error: "campaignId is required" },
    };
  }

  const updates: Record<string, unknown> = {};

  if (isNonEmptyString(title)) updates.title = title.trim();
  if (isNonEmptyString(copy)) updates.copy = copy.trim();
  if (typeof imageUrl === "string") updates.image_url = imageUrl.trim() || null;
  if (typeof approved === "boolean") updates.approved = approved;

  if (typeof platform === "string") {
    const normalizedPlatform = platform.trim().toLowerCase();
    if (!["facebook", "linkedin", "telegram", "twitter"].includes(normalizedPlatform)) {
      return {
        status: 400,
        body: { error: "Invalid platform" },
      };
    }
    updates.platform = normalizedPlatform;
  }

  if (typeof scheduledAt === "string") {
    const scheduledTimestamp = new Date(scheduledAt);
    if (Number.isNaN(scheduledTimestamp.getTime())) {
      return {
        status: 400,
        body: { error: "Invalid scheduledAt timestamp" },
      };
    }
    updates.scheduled_at = scheduledTimestamp.toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return {
      status: 400,
      body: { error: "No valid fields to update" },
    };
  }

  const { data, error } = await supabaseAdmin
    .from(SOCIAL_TABLE)
    .update(updates)
    .eq("id", campaignId)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  if (!data) {
    return {
      status: 404,
      body: { error: "Campaign not found" },
    };
  }

  return {
    status: 200,
    body: { success: true, campaign: buildCampaignResponse(data) },
  };
};

const deleteCampaign = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { campaignId } = payload ?? {};

  if (!campaignId) {
    return {
      status: 400,
      body: { error: "campaignId is required" },
    };
  }

  const { error } = await supabaseAdmin
    .from(SOCIAL_TABLE)
    .delete()
    .eq("id", campaignId);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const listCampaigns = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { platform } = payload ?? {};

  const query = supabaseAdmin
    .from(SOCIAL_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (isNonEmptyString(platform)) {
    query.eq("platform", platform.trim().toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { campaigns: (data ?? []).map(buildCampaignResponse) },
  };
};

const createProject = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const {
    title,
    description,
    summary,
    status,
    mediaType,
    mediaDataUrl,
    mediaUrl,
    featured,
  } = payload ?? {};

  const trimmedTitle = isNonEmptyString(title) ? title.trim() : "";
  if (!trimmedTitle) {
    return {
      status: 400,
      body: { error: "Project title is required" },
    };
  }

  const trimmedDescription = isNonEmptyString(description) ? description.trim() : null;
  const trimmedSummary = isNonEmptyString(summary) ? summary.trim() : null;

  const normalizedStatus = isNonEmptyString(status) ? status.trim().toLowerCase() : "";
  if (!PROJECT_STATUSES.has(normalizedStatus)) {
    return {
      status: 400,
      body: { error: "Invalid project status" },
    };
  }

  const resolvedMediaType = mediaType === "video" ? "video" : "image";
  let mediaPath: string | null = null;
  let mediaDirectUrl: string | null = null;

  if (resolvedMediaType === "image") {
    if (!isDataUrl(mediaDataUrl)) {
      return {
        status: 400,
        body: { error: "mediaDataUrl must be provided as a data URL for image projects" },
      };
    }

    try {
      mediaPath = await uploadDataUrlToStorage(supabaseAdmin, PROJECT_BUCKET, "projects", mediaDataUrl);
    } catch (err) {
      return {
        status: 400,
        body: { error: (err as Error).message },
      };
    }
  } else {
    if (isDataUrl(mediaDataUrl)) {
      try {
        mediaPath = await uploadDataUrlToStorage(supabaseAdmin, PROJECT_BUCKET, "projects", mediaDataUrl);
      } catch (err) {
        return {
          status: 400,
          body: { error: (err as Error).message },
        };
      }
    } else {
      if (!isNonEmptyString(mediaUrl)) {
        return {
          status: 400,
          body: { error: "mediaUrl (or mediaDataUrl) is required for video projects" },
        };
      }
      mediaDirectUrl = mediaUrl.trim();
    }
  }

  const slug = trimmedTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      title: trimmedTitle,
      description: trimmedDescription,
      summary: trimmedSummary,
      status: normalizedStatus,
      slug,
      media_type: resolvedMediaType,
      media_url: mediaPath ?? mediaDirectUrl,
      featured: Boolean(featured),
      visibility: "public",
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    if (mediaPath) {
      await deleteStorageObject(supabaseAdmin, PROJECT_BUCKET, mediaPath);
    }
    return {
      status: 400,
      body: { error: error?.message ?? "Failed to create project" },
    };
  }

  return {
    status: 201,
    body: {
      success: true,
      project: buildProjectResponse(supabaseAdmin, data),
    },
  };
};

const updateProject = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const {
    projectId,
    title,
    description,
    summary,
    status,
    mediaType,
    mediaDataUrl,
    mediaUrl,
    featured,
    visibility,
    removeMedia,
  } = payload ?? {};

  if (!projectId) {
    return {
      status: 400,
      body: { error: "projectId is required" },
    };
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchError) {
    return {
      status: 400,
      body: { error: `Failed to load project: ${fetchError.message}` },
    };
  }

  if (!existing) {
    return {
      status: 404,
      body: { error: "Project not found" },
    };
  }

  const trimmedTitle = isNonEmptyString(title) ? title.trim() : existing.title;
  if (!trimmedTitle) {
    return {
      status: 400,
      body: { error: "Project title is required" },
    };
  }

  const trimmedDescription = typeof description === "string" ? description.trim() : existing.description;
  const trimmedSummary = typeof summary === "string" ? summary.trim() : existing.summary;

  const normalizedStatus = isNonEmptyString(status) ? status.trim().toLowerCase() : existing.status;
  if (!PROJECT_STATUSES.has(normalizedStatus)) {
    return {
      status: 400,
      body: { error: "Invalid project status" },
    };
  }

  const resolvedMediaType = mediaType === "video" ? "video" : mediaType === "image" ? "image" : existing.media_type ?? "image";
  let mediaPath: string | null = existing.media_type === "image" ? existing.media_url : null;
  let mediaDirectUrl: string | null = existing.media_type === "video" ? existing.media_url : null;
  let uploadedPath: string | null = null;

  if (removeMedia) {
    if (mediaPath) {
      await deleteStorageObject(supabaseAdmin, PROJECT_BUCKET, mediaPath);
    }
    mediaPath = null;
    mediaDirectUrl = null;
  } else if (resolvedMediaType === "image" && typeof mediaDataUrl === "string") {
    if (!isDataUrl(mediaDataUrl)) {
      return {
        status: 400,
        body: { error: "mediaDataUrl must be a valid data URL" },
      };
    }

    try {
      uploadedPath = await uploadDataUrlToStorage(supabaseAdmin, PROJECT_BUCKET, "projects", mediaDataUrl);
      mediaPath = uploadedPath;
      mediaDirectUrl = null;
    } catch (err) {
      return {
        status: 400,
        body: { error: (err as Error).message },
      };
    }
  } else if (resolvedMediaType === "video" && typeof mediaDataUrl === "string") {
    if (!isDataUrl(mediaDataUrl)) {
      return {
        status: 400,
        body: { error: "mediaDataUrl must be a valid data URL" },
      };
    }

    try {
      uploadedPath = await uploadDataUrlToStorage(supabaseAdmin, PROJECT_BUCKET, "projects", mediaDataUrl);
      mediaPath = uploadedPath;
      mediaDirectUrl = null;
    } catch (err) {
      return {
        status: 400,
        body: { error: (err as Error).message },
      };
    }
  } else if (resolvedMediaType === "video" && typeof mediaUrl === "string") {
    mediaDirectUrl = mediaUrl.trim();
    mediaPath = null;
  }

  const updatePayload: Record<string, unknown> = {
    title: trimmedTitle,
    description: trimmedDescription,
    summary: trimmedSummary,
    status: normalizedStatus,
    media_type: resolvedMediaType,
    media_url: mediaPath ?? mediaDirectUrl,
  };

  if (typeof featured === "boolean") {
    updatePayload.featured = featured;
  }

  if (isNonEmptyString(visibility)) {
    updatePayload.visibility = visibility.trim();
  }

  const slug = trimmedTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  updatePayload.slug = slug;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    if (uploadedPath) {
      await deleteStorageObject(supabaseAdmin, PROJECT_BUCKET, uploadedPath);
    }

    return {
      status: 400,
      body: { error: updateError?.message ?? "Failed to update project" },
    };
  }

  if (
    uploadedPath &&
    typeof existing.media_url === "string" &&
    existing.media_url &&
    !existing.media_url.includes("://") &&
    existing.media_url !== uploadedPath
  ) {
    await deleteStorageObject(supabaseAdmin, PROJECT_BUCKET, existing.media_url);
  }

  return {
    status: 200,
    body: {
      success: true,
      project: buildProjectResponse(supabaseAdmin, updated),
    },
  };
};

const deleteProject = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { projectId } = payload ?? {};

  if (!projectId) {
    return {
      status: 400,
      body: { error: "projectId is required" },
    };
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("projects")
    .select("id, media_type, media_url")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchError) {
    return {
      status: 400,
      body: { error: `Failed to load project: ${fetchError.message}` },
    };
  }

  if (!existing) {
    return {
      status: 404,
      body: { error: "Project not found" },
    };
  }

  const { error: deleteError } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (deleteError) {
    return {
      status: 400,
      body: { error: deleteError.message },
    };
  }

  if (existing.media_type === "image" && existing.media_url) {
    await deleteStorageObject(supabaseAdmin, PROJECT_BUCKET, existing.media_url);
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const listProjects = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: {
      projects: (data ?? []).map((row: any) => buildProjectResponse(supabaseAdmin, row)),
    },
  };
};

const replyToContactMessage = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  payload: any,
) => {
  const { messageId, subject, body } = payload ?? {};

  if (!messageId || !body || typeof body !== "string" || body.trim().length === 0) {
    return {
      status: 400,
      body: { error: "messageId and body are required" },
    };
  }

  const { data: message, error } = await supabaseAdmin
    .from("contact_messages")
    .select("id, email, name, subject")
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  if (!message) {
    return {
      status: 404,
      body: { error: "Message not found" },
    };
  }

  if (!message.email) {
    return {
      status: 400,
      body: { error: "Message has no email address" },
    };
  }

  const disableEmails = (Deno.env.get("EDGE_DISABLE_OUTBOUND_EMAILS") ?? "").toLowerCase() === "true";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
  const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const gmailRefreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  const gmailSenderEmail = Deno.env.get("GMAIL_SENDER_EMAIL") ?? null;

  if (disableEmails || (!resendApiKey && !(gmailClientId && gmailClientSecret && gmailRefreshToken))) {
    // Dry-run in local/dev: mark as replied without sending email
    const { error: updateErr } = await supabaseAdmin
      .from("contact_messages")
      .update({ status: "replied" })
      .eq("id", messageId);
    if (updateErr) {
      return { status: 400, body: { error: updateErr.message } };
    }
    return { status: 200, body: { success: true, mode: "dry-run" } };
  }

  const replySubject = typeof subject === "string" && subject.trim().length > 0
    ? subject.trim()
    : `Re: ${message.subject ?? "Your inquiry"}`;

  const classifyEmailSendFailure = (value: unknown) => {
    const msg = String(value ?? "");
    const lower = msg.toLowerCase();

    const gmailStatusMatch = msg.match(/Gmail API error \((\d+)\)/i);
    const gmailStatus = gmailStatusMatch ? Number(gmailStatusMatch[1]) : null;
    const resendStatusMatch = msg.match(/Resend API error \((\d+)\)/i);
    const resendStatus = resendStatusMatch ? Number(resendStatusMatch[1]) : null;

    if (
      lower.includes("timeout") ||
      lower.includes("network is unreachable") ||
      lower.includes("enetwork") ||
      lower.includes("enetunreach") ||
      lower.includes("econn")
    ) {
      return "network_unreachable";
    }

    if (resendStatus === 401) return "email_unauthorized";
    if (resendStatus === 403) return "email_forbidden";
    if (resendStatus === 429) return "email_rate_limited";

    if (gmailStatus === 401) return "email_unauthorized";
    if (gmailStatus === 403) return "email_forbidden";
    if (gmailStatus === 429) return "email_rate_limited";

    if (
      resendStatus === 422 ||
      lower.includes("from") && (lower.includes("verify") || lower.includes("verified"))
    ) {
      return "email_sender_not_verified";
    }

    if (lower.includes("invalid_grant") || lower.includes("unauthorized_client")) return "email_unauthorized";

    if (lower.includes("invalid api key") || lower.includes("invalid_token")) return "email_invalid_api_key";

    return "email_service_error";
  };

  try {
    if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
      await sendContactReplyEmailViaGmail(
        {
          clientId: gmailClientId,
          clientSecret: gmailClientSecret,
          refreshToken: gmailRefreshToken,
          senderEmail: gmailSenderEmail ?? profile?.email ?? null,
        },
        message.email,
        replySubject,
        body.trim(),
        message.name,
        profile?.full_name ?? profile?.email ?? "GCAE Marketing Team",
      );
    } else if (resendApiKey) {
      await sendContactReplyEmail(
        resendApiKey,
        message.email,
        replySubject,
        body.trim(),
        message.name,
        profile?.full_name ?? profile?.email ?? "GCAE Marketing Team",
      );
    } else {
      throw new Error("Missing email configuration");
    }
  } catch (err) {
    return { status: 502, body: { error: classifyEmailSendFailure(err) } };
  }

  const { error: updateError } = await supabaseAdmin
    .from("contact_messages")
    .update({ status: "replied" })
    .eq("id", messageId);

  if (updateError) {
    return {
      status: 400,
      body: { error: updateError.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const submitContactMessage = async (payload: any) => {
  const { name, email, phone, subject, message } = payload ?? {};

  if (!name || !email || !message) {
    return {
      status: 400,
      body: { error: "name, email, and message are required" },
    };
  }

  let serviceClient: ReturnType<typeof createClient>;
  try {
    serviceClient = getServiceClient();
  } catch (err) {
    return {
      status: 500,
      body: { error: (err as Error).message },
    };
  }

  const { error } = await serviceClient
    .from("contact_messages")
    .insert({
      name,
      email,
      phone: phone ?? null,
      subject: subject ?? null,
      message,
    });

  if (error) {
    console.error("[marketing-manage] Failed to create contact message", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const listStaffMembers = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: { role?: string | null } = {},
) => {
  const query = supabaseAdmin
    .from("staff_registrations")
    .select(`
      id,
      user_id,
      full_name,
      email,
      phone,
      department,
      position,
      role,
      employment_date,
      is_activated,
      created_at,
      updated_at,
      profiles:user_id(
        id,
        full_name,
        email,
        phone,
        department,
        role,
        is_active
      )
    `)
    .order("created_at", { ascending: false });

  if (payload.role) {
    query.eq("role", payload.role);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[marketing-manage] Failed to list staff", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  const normalized = (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    position: row.position,
    role: row.role,
    employment_date: row.employment_date,
    is_activated: row.is_activated,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: row.profiles ?? null,
  }));

  return {
    status: 200,
    body: { staff: normalized },
  };
};

const createStaffMember = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  body: any,
) => {
  const {
    fullName,
    email,
    role,
    department,
    position,
    phone,
  } = body ?? {};

  const normalizedDepartmentRaw =
    typeof department === "string" ? department.trim() : typeof department === "undefined" ? undefined : department;
  const normalizedPositionRaw =
    typeof position === "string" ? position.trim() : typeof position === "undefined" ? undefined : position;
  const normalizedPhone =
    typeof phone === "string" ? (phone.trim().length > 0 ? phone.trim() : null) : phone ?? null;

  const staffDepartment = normalizedDepartmentRaw === undefined ? undefined : normalizedDepartmentRaw || "";
  const staffPosition = normalizedPositionRaw === undefined ? undefined : normalizedPositionRaw || "";
  const profileDepartment =
    normalizedDepartmentRaw === undefined ? undefined : normalizedDepartmentRaw && normalizedDepartmentRaw.length > 0 ? normalizedDepartmentRaw : null;
  const profilePosition =
    normalizedPositionRaw === undefined ? undefined : normalizedPositionRaw && normalizedPositionRaw.length > 0 ? normalizedPositionRaw : null;

  if (!fullName || !email || !role) {
    return {
      status: 400,
      body: { error: "Full name, email, and role are required" },
    };
  }

  // Derive default credentials
  const emailLower = String(email).toLowerCase();
  const firstName = String(fullName).trim().split(/\s+/)[0] ?? "user";
  const sanitizedFirst = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const namePassword = `${sanitizedFirst || "user"}@123`;
  const usernameBase = String(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
  const usernameSuffix = Math.random().toString(36).slice(-4);
  const generatedUsername = usernameBase ? `${usernameBase}${usernameSuffix}` : `staff${Date.now().toString(36)}`;

  const { data, error } = await supabaseAdmin.rpc("auth_register_staff", {
    p_email: emailLower,
    p_full_name: fullName,
    p_role: role,
    p_department: staffDepartment ?? "",
    p_position: staffPosition ?? "",
    p_phone: normalizedPhone,
    p_password: namePassword,
    p_username: generatedUsername,
  });

  if (error) {
    console.error("[marketing-manage] Failed to register staff", error);
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  const generatedPassword = namePassword;

  return {
    status: 201,
    body: {
      profile: (data as any)?.profile ?? null,
      password: generatedPassword,
    },
  };
};

const updateStaffMember = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  body: any,
) => {
  const {
    staffId,
    userId,
    fullName,
    email,
    phone,
    department,
    position,
    role,
    isActivated,
    isActive,
  } = body ?? {};

  const normalizedDepartmentRaw =
    typeof department === "string" ? department.trim() : typeof department === "undefined" ? undefined : department;
  const normalizedPositionRaw =
    typeof position === "string" ? position.trim() : typeof position === "undefined" ? undefined : position;
  const normalizedPhone =
    typeof phone === "string"
      ? phone.trim().length > 0
        ? phone.trim()
        : null
      : phone ?? null;

  const staffDepartment = normalizedDepartmentRaw === undefined ? undefined : normalizedDepartmentRaw || "";
  const staffPosition = normalizedPositionRaw === undefined ? undefined : normalizedPositionRaw || "";
  const profileDepartment =
    normalizedDepartmentRaw === undefined ? undefined : normalizedDepartmentRaw && normalizedDepartmentRaw.length > 0 ? normalizedDepartmentRaw : null;
  const profilePosition =
    normalizedPositionRaw === undefined ? undefined : normalizedPositionRaw && normalizedPositionRaw.length > 0 ? normalizedPositionRaw : null;

  if (!staffId) {
    return {
      status: 400,
      body: { error: "Missing staff identifiers" },
    };
  }

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { data: staffRow, error: staffLookupError } = await supabaseAdmin
      .from("staff_registrations")
      .select("user_id")
      .eq("id", staffId)
      .maybeSingle();

    if (staffLookupError) {
      console.error("[marketing-manage] Failed to lookup staff user id", staffLookupError);
      return {
        status: 400,
        body: { error: staffLookupError.message },
      };
    }

    resolvedUserId = staffRow?.user_id ?? null;
  }

  if (!resolvedUserId) {
    return {
      status: 400,
      body: { error: "Unable to resolve linked user for staff member" },
    };
  }

  const updates: Record<string, any> = {};
  if (typeof fullName === "string") updates.full_name = fullName;
  if (typeof email === "string") updates.email = email.toLowerCase();
  if (normalizedPhone !== undefined) updates.phone = normalizedPhone;
  if (staffDepartment !== undefined) updates.department = staffDepartment;
  if (staffPosition !== undefined) updates.position = staffPosition;
  if (typeof role === "string") updates.role = role;
  if (typeof isActivated === "boolean") updates.is_activated = isActivated;

  const profileUpdates: Record<string, any> = {};
  if (typeof fullName === "string") profileUpdates.full_name = fullName;
  if (typeof email === "string") profileUpdates.email = email.toLowerCase();
  if (normalizedPhone !== undefined) profileUpdates.phone = normalizedPhone;
  if (profileDepartment !== undefined) profileUpdates.department = profileDepartment;
  if (typeof role === "string") profileUpdates.role = role;
  if (typeof isActive === "boolean") profileUpdates.is_active = isActive;

  const { error: staffError } = await supabaseAdmin
    .from("staff_registrations")
    .update(updates)
    .eq("id", staffId);

  if (staffError) {
    console.error("[marketing-manage] Failed to update staff_registrations", staffError);
    return {
      status: 400,
      body: { error: staffError.message },
    };
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("user_id", resolvedUserId);

    if (profileError) {
      console.error("[marketing-manage] Failed to update profiles", profileError);
      return {
        status: 400,
        body: { error: profileError.message },
      };
    }
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const deleteStaffMember = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  body: any,
) => {
  const { staffId, userId } = body ?? {};

  if (!staffId) {
    return {
      status: 400,
      body: { error: "Missing staff identifiers" },
    };
  }

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { data: staffRow, error: staffLookupError } = await supabaseAdmin
      .from("staff_registrations")
      .select("user_id")
      .eq("id", staffId)
      .maybeSingle();

    if (staffLookupError) {
      console.error("[marketing-manage] Failed to lookup staff user id for delete", staffLookupError);
      return {
        status: 400,
        body: { error: staffLookupError.message },
      };
    }

    resolvedUserId = staffRow?.user_id ?? null;
  }

  if (!resolvedUserId) {
    return {
      status: 400,
      body: { error: "Unable to resolve linked user for staff member" },
    };
  }

  const { error: deleteStaffError } = await supabaseAdmin
    .from("staff_registrations")
    .delete()
    .eq("id", staffId);

  if (deleteStaffError) {
    console.error("[marketing-manage] Failed to delete staff registration", deleteStaffError);
    return {
      status: 400,
      body: { error: deleteStaffError.message },
    };
  }

  const { error: deleteProfileError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("user_id", userId);

  if (deleteProfileError) {
    console.error("[marketing-manage] Failed to delete profile", deleteProfileError);
    return {
      status: 400,
      body: { error: deleteProfileError.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const createGalleryImage = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  profile: any,
  payload: any,
) => {
  const { title, description, imageDataUrl, isFeatured } = payload ?? {};

  if (!title || !imageDataUrl) {
    return {
      status: 400,
      body: { error: "Title and image data are required" },
    };
  }

  if (!isDataUrl(imageDataUrl)) {
    return {
      status: 400,
      body: { error: "Invalid media payload. Expected data URL." },
    };
  }

  const { mimeType } = parseDataUrl(imageDataUrl);
  if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return {
      status: 400,
      body: { error: "Invalid media type. Expected image/* or video/*" },
    };
  }

  let storedPath: string;
  try {
    storedPath = await uploadDataUrlToStorage(supabaseAdmin, NEWS_MEDIA_BUCKET, "gallery", imageDataUrl);
  } catch (err) {
    return {
      status: 400,
      body: { error: (err as Error).message },
    };
  }

  const { error } = await supabaseAdmin
    .from("gallery_images")
    .insert({
      title,
      description: description ?? null,
      image_url: storedPath,
      is_featured: Boolean(isFeatured),
      uploaded_by: profile.id,
    });

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const updateGalleryImage = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { imageId, patch } = payload ?? {};

  if (!imageId || !patch || typeof patch !== "object") {
    return {
      status: 400,
      body: { error: "imageId and patch are required" },
    };
  }

  const allowedKeys = ["title", "description", "is_featured"] as const;
  const updatePayload: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      updatePayload[key] = patch[key as typeof allowedKeys[number]];
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      status: 400,
      body: { error: "No valid fields provided" },
    };
  }

  const { error } = await supabaseAdmin
    .from("gallery_images")
    .update(updatePayload)
    .eq("id", imageId);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const deleteGalleryImage = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { imageId } = payload ?? {};

  if (!imageId) {
    return {
      status: 400,
      body: { error: "imageId is required" },
    };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("gallery_images")
    .select("id, image_url")
    .eq("id", imageId)
    .maybeSingle();

  if (existingError) {
    return {
      status: 400,
      body: { error: existingError.message },
    };
  }

  const { error } = await supabaseAdmin
    .from("gallery_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

const sendSystemEmail = async (
  apiKey: string,
  options: {
    to: string;
    subject: string;
    body: string;
    senderName?: string | null;
    fromOverride?: string | null;
    replyTo?: string | null;
  },
) => {
  const { to, subject, body, senderName, fromOverride, replyTo } = options;
  const safeBody = body.includes('<') ? body : body.replace(/\n/g, '<br />');
  const fromEmail = fromOverride ?? Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  const fromName = senderName ?? Deno.env.get("RESEND_FROM_NAME") ?? "Vision Hub";
  const fromHeader = `${fromName} <${fromEmail}>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromHeader,
      to: [to],
      subject,
      reply_to: replyTo ?? undefined,
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; color: #111827;">
          ${safeBody}
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorText}`);
  }
};

const sendNewsletterViaGmail = async (
  config: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    senderEmail: string | null;
  },
  emails: string[],
  post: { title: string | null; content: string | null },
) => {
  const subject = `New article: ${post.title ?? "Vision Hub Update"}`;
  const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto;">
        <h1 style="color: #111827; font-size: 20px;">${post.title ?? "New update from GCAE Vision Hub"}</h1>
        <p style="color: #374151; font-size: 14px; white-space: pre-wrap;">${(post.content ?? "").slice(0, 320)}</p>
        <p style="color: #6b7280; font-size: 12px;">Visit the Vision Hub portal to read the full story.</p>
      </div>
    `;

  for (const email of emails) {
    await sendHtmlEmailViaGmail(config, email, subject, html);
  }
};

const sendNewsletter = async (
  apiKey: string,
  emails: string[],
  post: { title: string | null; content: string | null }
) => {
  // Resend requires a 'to' field. We'll send the first recipient in TO and the rest in BCC.
  const primary = emails[0];
  const bccList = emails.slice(1);

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  const fromName = Deno.env.get("RESEND_FROM_NAME") ?? "Vision Hub";
  const fromHeader = `${fromName} <${fromEmail}>`;

  const payload: Record<string, unknown> = {
    from: fromHeader,
    to: [primary],
    subject: `New article: ${post.title ?? "Vision Hub Update"}`,
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto;">
        <h1 style="color: #111827; font-size: 20px;">${post.title ?? "New update from GCAE Vision Hub"}</h1>
        <p style="color: #374151; font-size: 14px; white-space: pre-wrap;">${(post.content ?? "").slice(0, 320)}</p>
        <p style="color: #6b7280; font-size: 12px;">Visit the Vision Hub portal to read the full story.</p>
      </div>
    `,
  };
  if (bccList.length > 0) (payload as any).bcc = bccList;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorText}`);
  }
};

const sendContactReplyEmail = async (
  apiKey: string,
  to: string,
  subject: string,
  body: string,
  recipientName?: string | null,
  senderName?: string | null,
) => {
  const safeBody = body.replace(/\n/g, "<br />");
  const greetingName = recipientName || "there";
  const finalSender = senderName || "GCAE Marketing Team";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
  const fromName = Deno.env.get("RESEND_FROM_NAME") ?? "Vision Hub";
  const fromHeader = `${fromName} <${fromEmail}>`;
  const timeoutMs = Number(Deno.env.get("RESEND_TIMEOUT_MS") ?? "8000");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), Math.max(1000, timeoutMs));
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [to],
        subject,
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; color: #111827;">
            <p style="margin-bottom: 16px;">Hello ${greetingName},</p>
            <div style="color: #374151; font-size: 14px; line-height: 1.6;">${safeBody}</div>
            <p style="margin-top: 24px; color: #374151; font-size: 14px;">Best regards,<br />${finalSender}</p>
          </div>
        `,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error (${response.status}): ${errorText}`);
    }
  } catch (err: any) {
    if (err?.name === "AbortError" || String(err).includes("timeout")) {
      throw new Error("Email send timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const publishPost = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { postId } = payload ?? {};
  if (!postId) {
    return {
      status: 400,
      body: { error: "postId is required" },
    };
  }

  const publishedAt = new Date().toISOString();

  const { data: updatedPost, error: updateError } = await supabaseAdmin
    .from("posts")
    .update({
      status: "published",
      published_at: publishedAt,
    })
    .eq("id", postId)
    .select("id, title, content, slug")
    .maybeSingle();

  if (updateError) {
    return {
      status: 400,
      body: { error: updateError.message },
    };
  }

  if (!updatedPost) {
    return {
      status: 404,
      body: { error: "Post not found" },
    };
  }

  const { data: subscribers, error: subscribersError } = await supabaseAdmin
    .from("newsletter_subscriptions")
    .select("email")
    .eq("is_active", true);

  if (subscribersError) {
    return {
      status: 400,
      body: { error: `Failed to load subscribers: ${subscribersError.message}` },
    };
  }

  const emails = (subscribers ?? []).map((row: any) => row.email).filter((email: string | null) => !!email);

  const sendSummary: Record<string, unknown> = {
    sent: false,
    recipients: emails.length,
  };

  if (emails.length === 0) {
    sendSummary.reason = "no-subscribers";
  }

  const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID") ?? "";
  const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET") ?? "";
  const gmailRefreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "";
  const gmailSenderEmail = Deno.env.get("GMAIL_SENDER_EMAIL") ?? null;

  const hasGmail = !!(gmailClientId && gmailClientSecret && gmailRefreshToken && gmailSenderEmail);

  if (hasGmail && emails.length > 0) {
    try {
      await sendNewsletterViaGmail(
        {
          clientId: gmailClientId,
          clientSecret: gmailClientSecret,
          refreshToken: gmailRefreshToken,
          senderEmail: gmailSenderEmail,
        },
        emails,
        {
          title: updatedPost.title,
          content: updatedPost.content,
        },
      );
      sendSummary.sent = true;
      sendSummary.mode = "gmail";
    } catch (err) {
      console.error("[marketing-manage] Failed to send newsletter via Gmail", err);
      sendSummary.sent = false;
      sendSummary.mode = "gmail";
      sendSummary.reason = "email_service_error";
    }
  } else {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && emails.length > 0) {
      try {
        await sendNewsletter(resendApiKey, emails, {
          title: updatedPost.title,
          content: updatedPost.content,
        });
        sendSummary.sent = true;
        sendSummary.mode = "resend";
      } catch (err) {
        console.error("[marketing-manage] Failed to send newsletter via Resend", err);
        sendSummary.sent = false;
        sendSummary.mode = "resend";
        const msg = String(err ?? "");
        if (
          msg.includes("Network is unreachable") ||
          msg.includes("connect error") ||
          msg.includes("ENETUNREACH") ||
          msg.includes("ECONN")
        ) {
          sendSummary.reason = "network_unreachable";
        } else {
          sendSummary.reason = "email_service_error";
        }
      }
    } else if (emails.length > 0) {
      sendSummary.mode = "dry-run";
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      newsletter: sendSummary,
    },
  };
};

const listMessages = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { messages: data ?? [] },
  };
};

const updateMessageStatus = async (supabaseAdmin: ReturnType<typeof createClient>, payload: any) => {
  const { messageId, status } = payload ?? {};

  if (!messageId || !status) {
    return {
      status: 400,
      body: { error: "messageId and status are required" },
    };
  }

  const { error } = await supabaseAdmin
    .from("contact_messages")
    .update({ status })
    .eq("id", messageId);

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { success: true },
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_err) {
    body = {};
  }

  const action = body?.action;
  if (!action) {
    return new Response(JSON.stringify({ error: "Missing action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const publicActions = new Set([
    "public-submit-contact",
    "client-submit-service-request",
    "client-submit-feedback",
    "client-submit-consultancy-request",
  ]);
  const requiresAuth = !publicActions.has(action);

  const roleRequirements: Record<string, string[]> = {
    "get-dashboard": ["hr_staff", "hr_manager", "super_admin", "marketing_communications"],
    "list-consultancy-requests": ["architectural_civil_head", "mechanical_head", "ict_head", "material_testing_head", "super_admin"],
    "consultancy-schedule": ["architectural_civil_head", "mechanical_head", "ict_head", "material_testing_head", "super_admin"],
    "client-list-consultancy-requests": ["client", "super_admin"],
    "employee-list-consultancy-requests": ["employee", "super_admin"],
    "employee-update-consultancy-status": ["employee", "super_admin"],
    "client-list-interview-schedules": ["client", "super_admin"],
    "employee-list-interview-schedules": ["employee", "super_admin"],
    "employee-update-interview-schedule-status": ["employee", "super_admin"],
    "hr-list-interview-schedules": ["hr_staff", "hr_manager", "super_admin"],
    "hr-create-job": ["hr_staff", "hr_manager", "super_admin"],
    "hr-list-jobs": ["hr_staff", "hr_manager", "super_admin"],
    "hr-update-job": ["hr_staff", "hr_manager", "super_admin"],
    "hr-delete-job": ["hr_staff", "hr_manager", "super_admin"],
    "hr-send-interview-schedule": ["hr_staff", "hr_manager", "super_admin"],
    "hr-list-staff": ["hr_staff", "hr_manager", "super_admin"],
    "hr-create-staff": ["hr_staff", "hr_manager", "super_admin"],
    "hr-update-staff": ["hr_staff", "hr_manager", "super_admin"],
    "hr-delete-staff": ["hr_staff", "hr_manager", "super_admin"],
    "admin-hr-list-messages": ["super_admin", "hr_staff", "hr_manager"],
    "admin-hr-send-message": ["super_admin", "hr_staff", "hr_manager"],
    "admin-hr-reset-messages": ["super_admin"],
    "hr-get-profile-email": ["super_admin", "hr_staff", "hr_manager"],
    "list-employees-by-department": [
      "ict_head",
      "mechanical_head",
      "material_testing_head",
      "architectural_civil_head",
      "super_admin",
      "hr_staff",
      "hr_manager",
    ],
  };
  const defaultRoles = ["marketing_communications", "super_admin"];

  let auth: AuthContext | null = null;
  if (requiresAuth) {
    try {
      const allowedRoles = roleRequirements[action] ?? defaultRoles;
      auth = await getAuthContext(req, allowedRoles);
    } catch (responseOrError) {
      if (responseOrError instanceof Response) {
        return responseOrError;
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    switch (action) {
      
      case "client-list-consultancy-requests": {
        const ensuredAuth = await requireAuth(auth);
        const limit = typeof body?.limit === "number" ? body.limit : 100;
        const profileId = ensuredAuth.profile?.id;
        if (!profileId) {
          return new Response(JSON.stringify({ error: "Profile not found" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await listClientConsultancyRequests(ensuredAuth.supabaseAdmin, profileId, limit);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "employee-list-consultancy-requests": {
        const ensuredAuth = await requireAuth(auth);
        const limit = typeof body?.limit === "number" ? body.limit : 100;
        const profileId = ensuredAuth.profile?.id;
        if (!profileId) {
          return new Response(JSON.stringify({ error: "Profile not found" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await listEmployeeConsultancyRequests(ensuredAuth.supabaseAdmin, profileId, limit);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "employee-update-consultancy-status": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateEmployeeConsultancyStatus(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "client-list-interview-schedules": {
        const ensuredAuth = await requireAuth(auth);
        const limit = typeof body?.limit === "number" ? body.limit : 100;
        const result = await listClientInterviewSchedules(ensuredAuth.supabaseAdmin, ensuredAuth.profile, limit);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "employee-list-interview-schedules": {
        const ensuredAuth = await requireAuth(auth);
        const limit = typeof body?.limit === "number" ? body.limit : 100;
        const result = await listEmployeeInterviewSchedules(ensuredAuth.supabaseAdmin, ensuredAuth.profile, limit);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "employee-update-interview-schedule-status": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateInterviewScheduleStatus(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "hr-list-interview-schedules": {
        const ensuredAuth = await requireAuth(auth);
        const limit = typeof body?.limit === "number" ? body.limit : 100;
        const status = typeof body?.status === "string" ? body.status : null;
        const result = await listHrInterviewSchedules(ensuredAuth.supabaseAdmin, limit, status);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list-consultancy-requests": {
        const ensuredAuth = await requireAuth(auth);
        const department = typeof body?.department === "string" ? body.department.trim() : null;
        const limit = typeof body?.limit === "number" ? body.limit : 100;
        if (!department) {
          return new Response(JSON.stringify({ error: "department is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await listConsultancyRequests(ensuredAuth.supabaseAdmin, department, limit);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "consultancy-schedule": {
        const ensuredAuth = await requireAuth(auth);
        const result = await scheduleConsultancy(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list-employees-by-department": {
        const ensuredAuth = await requireAuth(auth);
        const department = typeof body?.department === "string" ? body.department : null;
        if (!department || !department.trim()) {
          return new Response(JSON.stringify({ error: "department is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          const employees = await listEmployeesByDepartment(ensuredAuth.supabaseAdmin, department.trim());
          return new Response(JSON.stringify({ employees }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      case "get-dashboard": {
        const ensuredAuth = await requireAuth(auth);
        const data = await getDashboardData(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "create-post": {
        const ensuredAuth = await requireAuth(auth);
        const result = await createPost(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "update-post": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updatePostDetails(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "delete-post": {
        const ensuredAuth = await requireAuth(auth);
        const result = await deletePost(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "create-campaign": {
        const ensuredAuth = await requireAuth(auth);
        const result = await createCampaign(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "update-campaign": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateCampaign(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "delete-campaign": {
        const ensuredAuth = await requireAuth(auth);
        const result = await deleteCampaign(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "list-campaigns": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listCampaigns(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "list-posts": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listPosts(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "publish-post": {
        const ensuredAuth = await requireAuth(auth);
        const result = await publishPost(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "list-messages": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listMessages(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "update-message-status": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateMessageStatus(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "list-gallery-images": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listGalleryImages(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "admin-hr-list-messages": {
        const ensuredAuth = await requireAdminOrHr(auth);
        const result = await listAdminHrMessages(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "hr-get-profile-email": {
        const ensuredAuth = await requireAdminOrHr(auth);
        const result = await getProfileEmail(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "admin-hr-send-message": {
        const ensuredAuth = await requireAdminOrHr(auth);
        const result = await sendAdminHrMessage(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body ?? {});
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "admin-hr-reset-messages": {
        const ensuredAuth = await requireAdminRole(auth);
        const result = await resetAdminHrMessages(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "create-gallery-image": {
        const ensuredAuth = await requireAuth(auth);
        const result = await createGalleryImage(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "update-gallery-image": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateGalleryImage(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "delete-gallery-image": {
        const ensuredAuth = await requireAuth(auth);
        const result = await deleteGalleryImage(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "reply-contact-message": {
        const ensuredAuth = await requireAuth(auth);
        const result = await replyToContactMessage(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-create-job": {
        const ensuredAuth = await requireAuth(auth);
        const { action: _ignored, ...jobPayload } = body ?? {};
        const result = await createJobPosting(ensuredAuth.supabaseAdmin, jobPayload);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-list-jobs": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listJobPostings(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-update-job": {
        const ensuredAuth = await requireAuth(auth);
        const { action: _ignored, ...jobPayload } = body ?? {};
        const result = await updateJobPosting(ensuredAuth.supabaseAdmin, jobPayload);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-delete-job": {
        const ensuredAuth = await requireAuth(auth);
        const { action: _ignored, ...jobPayload } = body ?? {};
        const result = await deleteJobPosting(ensuredAuth.supabaseAdmin, jobPayload);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-send-interview-schedule": {
        const ensuredAuth = await requireAuth(auth);
        const result = await sendInterviewSchedule(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-list-staff": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listStaffMembers(ensuredAuth.supabaseAdmin, body ?? {});
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-create-staff": {
        const ensuredAuth = await requireAuth(auth);
        const result = await createStaffMember(ensuredAuth.supabaseAdmin, ensuredAuth.profile, body ?? {});
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-update-staff": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateStaffMember(ensuredAuth.supabaseAdmin, body ?? {});
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "hr-delete-staff": {
        const ensuredAuth = await requireAuth(auth);
        const result = await deleteStaffMember(ensuredAuth.supabaseAdmin, body ?? {});
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "client-submit-service-request": {
        const result = await submitServiceRequest(body, auth?.profile ?? null);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "client-submit-consultancy-request": {
        const result = await submitConsultancyRequest(body, auth?.profile ?? null);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "client-submit-feedback": {
        const result = await submitClientFeedback(body, auth?.profile ?? null);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "public-submit-contact": {
        const result = await submitContactMessage(body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "create-project": {
        const ensuredAuth = await requireAuth(auth);
        const result = await createProject(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "update-project": {
        const ensuredAuth = await requireAuth(auth);
        const result = await updateProject(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "delete-project": {
        const ensuredAuth = await requireAuth(auth);
        const result = await deleteProject(ensuredAuth.supabaseAdmin, body);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "list-projects": {
        const ensuredAuth = await requireAuth(auth);
        const result = await listProjects(ensuredAuth.supabaseAdmin);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("[marketing-manage] Unexpected error", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
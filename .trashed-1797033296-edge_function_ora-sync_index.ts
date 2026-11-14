import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;

const TABLES = [
  "ora_departments", "ora_members", "ora_projects", "ora_meetings",
  "ora_decisions", "ora_records", "ora_goals", "ora_audits",
  "ora_audit_findings", "ora_corrective_actions", "ora_inventory",
  "ora_ideas", "ora_knowledge_documents", "ora_activity_log"
] as const;

const WRITABLE: Record<string, string[]> = {
  ora_projects: ["title","description","responsible_department_id","status","progress","approved_by","approved_at","target_date","metadata"],
  ora_meetings: ["title","meeting_type","status","scheduled_at","agenda","minutes","decisions_summary"],
  ora_decisions: ["title","proposal","decision","status","decided_by","decided_at","meeting_id","responsible_department_id"],
  ora_records: ["category","title","content","status","version"],
  ora_goals: ["title","description","department_id","target_value","current_value","unit","due_date","status"],
  ora_audits: ["title","audit_type","scope","auditor","status","scheduled_at","completed_at","summary"],
  ora_audit_findings: ["audit_id","department_id","finding","classification","evidence"],
  ora_corrective_actions: ["finding_id","description","responsible_department_id","corrective_measure","due_date","status","evidence","validated_by","validated_at"],
  ora_inventory: ["item_name","description","quantity","unit","condition","responsible_department_id"],
  ora_ideas: ["title","description","proposed_by","assigned_department_id","status","analysis"],
  ora_knowledge_documents: ["title","document_type","body","version","status","approved_by","approved_at"]
};

const CORS_ORIGINS = new Set(["https://chatgpt.com", "https://chat.openai.com"]);
const headersFor = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Vary": "Origin",
  ...(origin && CORS_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600"
});
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !CORS_ORIGINS.has(origin)) return reply({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin) });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405, origin);
  if (!KEY) return reply({ error: "Server configuration unavailable" }, 500, origin);

  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return reply({ error: "Authentication required" }, 401, origin);
  const token = match[1];

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 65536) return reply({ error: "Request too large" }, 413, origin);
    body = JSON.parse(raw);
  } catch {
    return reply({ error: "Invalid JSON body" }, 400, origin);
  }

  const supabase = createClient(URL, KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return reply({ error: "Invalid or expired session" }, 401, origin);

  const { data: isFounder, error: roleError } = await supabase.rpc("ora_sync_is_founder");
  if (roleError || isFounder !== true) return reply({ error: "Founder access required" }, 403, origin);

  const { action, table } = body ?? {};
  if (!TABLES.includes(table)) return reply({ error: "Table not allowed" }, 400, origin);

  if (action === "read") {
    const requestedLimit = Number(body.limit ?? 50);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.floor(requestedLimit))) : 50;
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (error) return reply({ error: "Read failed", detail: error.message }, 400, origin);
    return reply({ ok: true, table, count: data?.length ?? 0, data }, 200, origin);
  }

  if (action !== "insert" && action !== "update") {
    return reply({ error: "Action must be read, insert, or update" }, 400, origin);
  }
  const allowed = WRITABLE[table];
  if (!allowed) return reply({ error: "This table is read-only through sync" }, 403, origin);
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return reply({ error: "data must be an object" }, 400, origin);
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.data)) {
    if (!allowed.includes(key)) return reply({ error: `Field not allowed: ${key}` }, 400, origin);
    clean[key] = value;
  }
  if (Object.keys(clean).length === 0) return reply({ error: "No permitted fields supplied" }, 400, origin);

  if (table === "ora_records" || table === "ora_knowledge_documents") {
    if (action === "insert" && clean.status === "approved") {
      return reply({ error: "Approved documents must be created through the formal approval workflow" }, 403, origin);
    }
    if (action === "update") {
      if (typeof body.id !== "string" || body.id.length > 100) return reply({ error: "Valid id required" }, 400, origin);
      const { data: existing, error: lookupError } = await supabase.from(table).select("status").eq("id", body.id).maybeSingle();
      if (lookupError) return reply({ error: "Could not verify document status" }, 400, origin);
      if (!existing) return reply({ error: "Record not found" }, 404, origin);
      if (existing.status === "approved") return reply({ error: "Approved records are immutable through sync" }, 409, origin);
    }
  }

  if (action === "insert") {
    const { data, error } = await supabase.from(table).insert(clean).select().single();
    if (error) return reply({ error: "Insert failed", detail: error.message }, 400, origin);
    return reply({ ok: true, action, table, data }, 201, origin);
  }

  if (typeof body.id !== "string" || body.id.length > 100) return reply({ error: "Valid id required" }, 400, origin);
  const { data, error } = await supabase.from(table).update(clean).eq("id", body.id).select().maybeSingle();
  if (error) return reply({ error: "Update failed", detail: error.message }, 400, origin);
  if (!data) return reply({ error: "Record not found or not accessible" }, 404, origin);
  return reply({ ok: true, action, table, data }, 200, origin);
});

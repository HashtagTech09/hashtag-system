import { LosslessNumber, stringify } from "lossless-json";

export const PRODUCTION_PROJECT = "cughejedfefvblxyodtm";
export const PRODUCTION_DATASET = "666763039533944";
const stages = new Set(["Intake", "In-Progress", "Qualified", "Converted", "Lost"]);

export interface QueuedEvent {
  event_id: string;
  lead_id: string;
  version: number;
  stage: string;
  occurred_at: string;
  meta_lead_id: string;
  email: string | null;
  phone: string | null;
  attempts: number;
  lease_id: string;
}

export interface DispatchConfig {
  projectRef: string;
  datasetId: string;
  graphVersion: string;
  token: string;
  testCode?: string;
}

export function readConfig(get: (key: string) => string | undefined): DispatchConfig | null {
  if (get("CRM_META_ENABLED") !== "true") return null;
  const mode = get("CRM_META_MODE");
  const projectRef = get("CRM_DEPLOYMENT_PROJECT_REF") || "";
  const actualRef = new URL(get("SUPABASE_URL") || "https://invalid.local").hostname.split(".")[0];
  const datasetId = get("CRM_META_DATASET_ID") || "";
  const graphVersion = get("CRM_META_GRAPH_VERSION") || "";
  const token = get("CRM_META_ACCESS_TOKEN") || "";
  const testCode = get("CRM_META_TEST_EVENT_CODE");
  if (!projectRef || actualRef !== projectRef || !/^\d+$/.test(datasetId) || !/^v\d+\.\d+$/.test(graphVersion) || !token) {
    throw new Error("CRM_CONFIG_INVALID");
  }
  if (mode === "production") {
    if (projectRef !== PRODUCTION_PROJECT || datasetId !== PRODUCTION_DATASET ||
        get("CRM_META_LIVE_APPROVED") !== "true" || testCode) throw new Error("CRM_LIVE_GATE_CLOSED");
  } else if (mode === "test") {
    if (projectRef === PRODUCTION_PROJECT || datasetId === PRODUCTION_DATASET || !testCode) {
      throw new Error("CRM_TEST_ISOLATION_REQUIRED");
    }
  } else throw new Error("CRM_MODE_INVALID");
  return { projectRef, datasetId, graphVersion, token, testCode };
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validWorkerToken(header: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const expected = await digest(secret);
  const provided = await digest(header.slice(7));
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return difference === 0;
}

export function eventProblem(event: QueuedEvent, nowSeconds: number): string | null {
  const time = Math.floor(Date.parse(event.occurred_at) / 1000);
  if (!Number.isFinite(time) || time > nowSeconds + 300) return "INVALID_EVENT_TIME";
  if (time < nowSeconds - 7 * 86400) return "EVENT_EXPIRED";
  if (!stages.has(event.stage)) return "INVALID_STAGE";
  if (!/^[1-9][0-9]{0,29}$/.test(event.meta_lead_id)) return "INVALID_META_LEAD_ID";
  if (!/^[0-9a-f-]{36}$/i.test(event.event_id)) return "INVALID_EVENT_ID";
  return null;
}

export async function buildPayload(event: QueuedEvent, testCode?: string): Promise<string> {
  // Meta IDs exceed JS safe integers. Preserve the exact numeric JSON value.
  const userData: Record<string, unknown> = { lead_id: new LosslessNumber(event.meta_lead_id) };
  const email = event.email?.trim().toLowerCase();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) userData.em = [await digest(email)];
  // Intake must normalize to international format. Do not guess a country code.
  const phone = event.phone?.trim();
  if (phone && /^\+[1-9][0-9 ()-]{6,20}$/.test(phone)) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) userData.ph = [await digest(digits)];
  }
  const payload = {
    data: [{
      event_name: event.stage,
      event_time: Math.floor(Date.parse(event.occurred_at) / 1000),
      event_id: `crm:${event.event_id}`,
      action_source: "system_generated",
      user_data: userData,
      custom_data: { event_source: "crm", lead_event_source: "Hashtag Management System" },
    }],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
  return stringify(payload)!;
}

export function deliveryResult(status: number, body: unknown, attempts: number) {
  const response = body as { events_received?: unknown; error?: { code?: unknown; is_transient?: unknown } } | null;
  if (status >= 200 && status < 300 && response?.events_received === 1 && !response?.error) {
    return { status: "delivered", code: null, delay: 0 };
  }
  const code = response?.error?.code;
  const retryable = status === 0 || status === 408 || status === 429 || status >= 500 || response?.error?.is_transient === true;
  return {
    status: retryable && attempts < 8 ? "retry" : "failed",
    code: Number.isSafeInteger(code) && Number(code) >= 0 ? `META_${code}` : status === 0 ? "NETWORK_ERROR" : `HTTP_${status}`,
    delay: Math.min(21600, 60 * 2 ** Math.min(attempts, 9)),
  };
}

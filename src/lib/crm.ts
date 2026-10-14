import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const CRM_ENABLED = import.meta.env.VITE_CRM_LEADS_ENABLED === "true";
export const STAGES = ["Intake", "In-Progress", "Qualified", "Converted", "Lost"] as const;
export type LeadStage = typeof STAGES[number];
export type CrmLead = {
  id: string; organization_id: number; studio_id: number; meta_lead_id: string;
  name: string; email: string | null; phone: string | null; style: string | null;
  stage: LeadStage; version: number; created_at: string; changed_at: string;
  actor_id: string | null; change_note: string | null; is_correction: boolean;
};
export type CrmHistory = {
  id: string; lead_id: string; organization_id: number; studio_id: number; version: number;
  from_stage: LeadStage | null; to_stage: LeadStage; changed_at: string; actor_id: string | null;
  note: string | null; is_correction: boolean;
  delivery_status: "queued" | "sending" | "retry" | "delivered" | "failed" | "expired" | "held";
  delivery_code: string | null; attempts: number;
};
export type CrmScope = { studio_id: number; studio_name: string; organization_id: number; is_admin: boolean };
type ReadTable<T> = { Row: T; Insert: never; Update: never; Relationships: [] };
type CrmDatabase = {
  public: {
    Tables: { crm_leads: ReadTable<CrmLead>; crm_lead_history: ReadTable<CrmHistory> };
    Views: Record<string, never>;
    Functions: {
      crm_my_scope: { Args: Record<string, never>; Returns: CrmScope[] };
      crm_change_stage: { Args: { p_lead: string; p_version: number; p_stage: LeadStage; p_note: string | null; p_correction: boolean }; Returns: CrmLead };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
// Reuse the authenticated client; never create a second browser session or use a server key.
export const crm = supabase as unknown as SupabaseClient<CrmDatabase>;

export function nextStages(stage: LeadStage): LeadStage[] {
  if (stage === "Intake") return ["In-Progress", "Lost"];
  if (stage === "In-Progress") return ["Qualified", "Lost"];
  if (stage === "Qualified") return ["Lost"];
  return [];
}

export function crmError(error: unknown): string {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (message.includes("CRM_VERSION_CONFLICT")) return "This lead changed. Refresh and try again.";
  if (/CRM_(ACCESS_DENIED|AUTH_REQUIRED|ADMIN_REQUIRED)/.test(message)) return "You do not have access to this lead.";
  if (message.includes("CRM_VERIFIED_PAYMENT_REQUIRED")) return "Conversion requires a verified payment.";
  if (message.includes("CRM_INVALID_TRANSITION")) return "This stage change is not allowed.";
  return "Unable to save. Your changes have not been confirmed.";
}

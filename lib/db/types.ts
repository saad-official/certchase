/**
 * Row-level aliases for the generated database types (snake_case, ISO
 * strings). Domain models in lib/domain are camelCase; map at the edge.
 */
import type { Database, Enums, Tables, TablesInsert, TablesUpdate } from "@/lib/db/database.types";

export type { Database, Json } from "@/lib/db/database.types";

export type Organization = Tables<"organizations">;
export type Membership = Tables<"memberships">;
export type RequirementTemplate = Tables<"requirement_templates">;
export type Vendor = Tables<"vendors">;
export type Certificate = Tables<"certificates">;
export type ChaseCadence = Tables<"chase_cadences">;
export type ChaseTouch = Tables<"chase_touches">;
export type OutboxItem = Tables<"outbox">;
export type AgentEvent = Tables<"agent_events">;
export type VendorOverview = Tables<"vendor_overview">;

export type OrganizationUpdate = TablesUpdate<"organizations">;
export type RequirementTemplateInsert = TablesInsert<"requirement_templates">;
export type RequirementTemplateUpdate = TablesUpdate<"requirement_templates">;
export type VendorInsert = TablesInsert<"vendors">;
export type VendorUpdate = TablesUpdate<"vendors">;
export type CertificateInsert = TablesInsert<"certificates">;
export type CertificateUpdate = TablesUpdate<"certificates">;
export type ChaseCadenceInsert = TablesInsert<"chase_cadences">;
export type ChaseCadenceUpdate = TablesUpdate<"chase_cadences">;
export type ChaseTouchInsert = TablesInsert<"chase_touches">;
export type ChaseTouchUpdate = TablesUpdate<"chase_touches">;
export type OutboxInsert = TablesInsert<"outbox">;
export type AgentEventInsert = TablesInsert<"agent_events">;

export type Plan = Enums<"plan">;
export type Autonomy = Enums<"autonomy">;
export type EvaluationStatusDb = Enums<"evaluation_status">;
export type CertificateStatus = Enums<"certificate_status">;
export type ChaseKindDb = Enums<"chase_kind">;
export type TouchStatus = Enums<"touch_status">;
export type CadenceStatus = Enums<"cadence_status">;

export type MembershipRole = "owner" | "member";
export type CertificateSource = "upload" | "email" | "demo";
export type OutboxProvider = "outbox" | "resend";
export type OutboxStatus = "queued" | "sent" | "delivered" | "failed";
export type AgentEventActor = "agent" | "user" | "system" | "cron" | "webhook";

/** Shape of organizations.voice (jsonb). Every key optional in storage. */
export type OrgVoiceJson = {
  business_name?: string;
  signature?: string;
  tone_notes?: string;
};

export type PublicSchema = Database["public"];

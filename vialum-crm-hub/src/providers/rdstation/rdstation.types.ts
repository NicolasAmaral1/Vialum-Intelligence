export interface RDStationConfig {
  clientId: string;
  clientSecret: string;
}

export interface RDStationContact {
  id: string;
  name: string;
  emails: Array<{ email: string }>;
  phones: Array<{ phone: string }>;
  job_title?: string;
  organization_id?: string;
  custom_fields?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface RDStationDeal {
  id: string;
  name: string;
  amount_total: number;
  deal_stage: { id: string; name: string };
  deal_status: string; // won | lost | pending
  contact?: { id: string; name: string };
  organization?: { id: string; name: string };
  custom_fields?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface RDStationOrganization {
  id: string;
  name: string;
  custom_fields?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

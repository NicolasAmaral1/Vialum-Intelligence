export interface PipedriveConfig {
  apiToken: string;
  domain?: string; // e.g. "yourcompany" → yourcompany.pipedrive.com
}

export interface PipedrivePerson {
  id: number;
  name: string;
  phone: Array<{ value: string; primary: boolean }>;
  email: Array<{ value: string; primary: boolean }>;
  org_id?: { name: string; value: number } | null;
}

export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string; // open | won | lost | deleted
  stage_id: number;
  person_id?: { name: string; value: number } | null;
  org_id?: { name: string; value: number } | null;
}

export interface PipedriveStage {
  id: number;
  name: string;
  pipeline_id: number;
}

export interface PipedriveSearchResult {
  persons: PipedrivePerson[];
  deals: PipedriveDeal[];
}

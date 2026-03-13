export interface GDriveConfig {
  serviceAccountKey?: Record<string, unknown>; // JSON key file contents
  accessToken?: string;                         // OAuth2 access token (simpler)
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

export type Profile = {
  name: string;
  alias: string;
  createdAt: string;
  updatedAt: string;
};

export type AppConfig = {
  version: 1;
  claudePath: string;
  sharedClaudeDir: string;
  sharedClaudeJson: string;
  profilesDir: string;
  shellIntegrationPath: string;
  profiles: Profile[];
};

export type DoctorCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export type SyncResult = {
  profileDir: string;
  sharedEntries: string[];
  warnings: string[];
};


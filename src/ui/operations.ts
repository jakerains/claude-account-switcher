import type { AppConfig, DoctorCheck, Profile } from "../lib/types";
import { addProfile, doctor, findProfile, initConfig, loadConfig, removeProfile } from "../lib/config";
import { writeShellIntegration } from "../lib/shell";
import { collectProfileChanges, materializeProfile } from "../lib/sync";

export type UiState = {
  config: AppConfig;
  checks: DoctorCheck[];
};

export async function loadUiState(): Promise<UiState> {
  const config = await initConfig();
  await writeShellIntegration(config);
  return { config, checks: await doctor(config) };
}

export async function refreshUiState(): Promise<UiState> {
  const config = await loadConfig();
  return { config, checks: await doctor(config) };
}

export async function createProfile(name: string, alias: string) {
  const { config, profile } = await addProfile(name, alias);
  await materializeProfile(config, profile);
  await writeShellIntegration(config);
  return profile;
}

export async function deleteProfile(name: string) {
  const config = await removeProfile(name);
  await writeShellIntegration(config);
}

export async function repairProfile(config: AppConfig, profile: Profile) {
  await materializeProfile(config, profile);
  await collectProfileChanges(config, profile);
  await writeShellIntegration(config);
}

export async function profileAuthStatus(config: AppConfig, profile: Profile) {
  const prepared = await materializeProfile(config, profile);
  const proc = Bun.spawn([config.claudePath, "auth", "status"], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: prepared.profileDir },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  await collectProfileChanges(config, profile);
  return { code, output: `${stdout}${stderr}`.trim() };
}

export async function runProfileLogin(config: AppConfig, profile: Profile, onLine: (line: string) => void) {
  const prepared = await materializeProfile(config, profile);
  onLine(`Starting Claude login for ${profile.name}`);
  const proc = Bun.spawn([config.claudePath, "auth", "login"], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: prepared.profileDir },
    stdin: "inherit",
    stdout: "pipe",
    stderr: "pipe",
  });

  const pump = async (stream: ReadableStream<Uint8Array> | null) => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (part.trim()) onLine(part);
      }
    }
    if (buffer.trim()) onLine(buffer);
  };

  await Promise.all([pump(proc.stdout), pump(proc.stderr)]);
  const code = await proc.exited;
  await collectProfileChanges(config, profile);
  onLine(`Claude login exited with ${code}`);
  return code;
}

export function selectedProfile(config: AppConfig, name?: string) {
  if (name) return findProfile(config, name);
  return config.profiles[0];
}


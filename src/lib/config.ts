import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AppConfig, DoctorCheck, Profile } from "./types";
import { defaultConfigPath, defaultProfilesDir, defaultSharedClaudeDir, defaultSharedClaudeJson, defaultShellIntegrationPath } from "./paths";
import { readJsonObject, writeJsonObject } from "./json";

export const CONFIG_PATH = defaultConfigPath();

export function validateProfileName(name: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/.test(name)) {
    throw new Error("Profile names must start with a letter and use only letters, numbers, _ or -.");
  }
}

export function validateAlias(alias: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,63}$/.test(alias)) {
    throw new Error("Aliases must start with a letter and use only letters, numbers, _ or -.");
  }
}

async function commandExists(command: string) {
  const proc = Bun.spawn(["zsh", "-lc", `command -v ${JSON.stringify(command)}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output.trim();
}

export async function createDefaultConfig(): Promise<AppConfig> {
  const claudePath = process.env.CCA_CLAUDE_PATH || await commandExists("claude");
  if (!claudePath) throw new Error("Could not find Claude Code. Install it or set CCA_CLAUDE_PATH.");
  return {
    version: 1,
    claudePath,
    sharedClaudeDir: defaultSharedClaudeDir(),
    sharedClaudeJson: defaultSharedClaudeJson(),
    profilesDir: defaultProfilesDir(),
    shellIntegrationPath: defaultShellIntegrationPath(),
    profiles: [],
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const raw = await readJsonObject(CONFIG_PATH);
  if (!raw.version) {
    const config = await createDefaultConfig();
    await saveConfig(config);
    return config;
  }
  return raw as AppConfig;
}

export async function saveConfig(config: AppConfig) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await mkdir(config.profilesDir, { recursive: true });
  await writeJsonObject(CONFIG_PATH, config as unknown as Record<string, unknown>);
}

export async function initConfig() {
  const config = await loadConfig();
  await mkdir(config.profilesDir, { recursive: true });
  await mkdir(dirname(config.shellIntegrationPath), { recursive: true });
  return config;
}

export async function addProfile(name: string, alias = `claude-${name}`) {
  validateProfileName(name);
  validateAlias(alias);
  const config = await loadConfig();
  if (config.profiles.some((profile) => profile.name === name)) throw new Error(`Profile already exists: ${name}`);
  if (config.profiles.some((profile) => profile.alias === alias)) throw new Error(`Alias already exists: ${alias}`);
  const now = new Date().toISOString();
  const profile: Profile = { name, alias, createdAt: now, updatedAt: now };
  config.profiles.push(profile);
  await saveConfig(config);
  return { config, profile };
}

export async function removeProfile(name: string) {
  const config = await loadConfig();
  const next = config.profiles.filter((profile) => profile.name !== name);
  if (next.length === config.profiles.length) throw new Error(`Profile not found: ${name}`);
  config.profiles = next;
  await saveConfig(config);
  return config;
}

export function findProfile(config: AppConfig, name: string) {
  const profile = config.profiles.find((candidate) => candidate.name === name || candidate.alias === name);
  if (!profile) throw new Error(`Unknown profile: ${name}`);
  return profile;
}

export function profileDir(config: AppConfig, name: string) {
  return join(config.profilesDir, name);
}

export async function doctor(config: AppConfig): Promise<DoctorCheck[]> {
  const exists = async (path: string) => {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  };
  return [
    { label: "Claude CLI", ok: await exists(config.claudePath), detail: config.claudePath },
    { label: "Shared Claude dir", ok: await exists(config.sharedClaudeDir), detail: config.sharedClaudeDir },
    { label: "Shared Claude JSON", ok: await exists(config.sharedClaudeJson), detail: config.sharedClaudeJson },
    { label: "Profiles dir", ok: await exists(config.profilesDir), detail: config.profilesDir },
    { label: "Shell integration", ok: await exists(config.shellIntegrationPath), detail: config.shellIntegrationPath },
  ];
}


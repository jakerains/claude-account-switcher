import { constants } from "node:fs";
import { access, copyFile, lstat, mkdir, readdir, readlink, rm, symlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { AppConfig, Profile, SyncResult } from "./types";
import { readJsonObject, writeJsonObject, type JsonObject } from "./json";
import { profileDir } from "./config";
import { withLock } from "./lock";

const PROFILE_CREDENTIAL_KEYS = new Set(["claudeAiOauth"]);
const SHARED_CREDENTIAL_KEYS = new Set(["mcpOAuth"]);

const SHARED_DOT_CLAUDE_ENTRIES = [
  "CLAUDE.md",
  "settings.json",
  "settings.local.json",
  "skills",
  "commands",
  "agents",
  "hooks",
  "plugins",
  "projects",
  "sessions",
  "session-env",
  "history.jsonl",
  "tasks",
  "plans",
  "mcp-needs-auth-cache.json",
  "statusline-base.sh",
  "statusline-command.sh",
];

const PROFILE_JSON_KEYS = [
  "oauthAccount",
  "userID",
  "hasAvailableSubscription",
  "recommendedSubscription",
  "subscriptionNoticeCount",
  "subscriptionUpsellShownCount",
  "overageCreditGrantCache",
  "passesEligibilityCache",
  "passesLastSeenRemaining",
  "passesUpsellSeenCount",
  "cachedExtraUsageDisabledReason",
  "hasVisitedExtraUsage",
  "hasVisitedPasses",
  "modelAccessCache",
  "s1mAccessCache",
  "hasOpusPlanDefault",
  "opusProMigrationComplete",
  "opus45MigrationComplete",
  "opus46FeedSeenCount",
  "hasShownOpus45Notice",
  "hasShownOpus46Notice",
  "sonnet45MigrationComplete",
  "sonnet45MigrationTimestamp",
  "sonnet1m45MigrationComplete",
  "claudeCodeFirstTokenDate",
];

const PROFILE_JSON_KEY_SET = new Set(PROFILE_JSON_KEYS);

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function splitObject(input: JsonObject, profileKeys: Set<string>) {
  const shared: JsonObject = {};
  const profile: JsonObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (profileKeys.has(key)) profile[key] = value;
    else shared[key] = value;
  }
  return { shared, profile };
}

export function splitCredentials(input: JsonObject) {
  const profile: JsonObject = {};
  const shared: JsonObject = {};
  const unknown: JsonObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (PROFILE_CREDENTIAL_KEYS.has(key)) profile[key] = value;
    else if (SHARED_CREDENTIAL_KEYS.has(key)) shared[key] = value;
    else unknown[key] = value;
  }
  return { profile, shared, unknown };
}

export function mergeCredentials(shared: JsonObject, profile: JsonObject, unknown: JsonObject = {}) {
  return { ...unknown, ...shared, ...profile };
}

export function splitClaudeJson(input: JsonObject) {
  return splitObject(input, PROFILE_JSON_KEY_SET);
}

export function mergeClaudeJson(shared: JsonObject, profile: JsonObject) {
  return { ...shared, ...profile };
}

function hasKeys(value: JsonObject) {
  return Object.keys(value).length > 0;
}

async function safeLink(source: string, target: string, warnings: string[]) {
  if (!await exists(source)) return;
  if (await exists(target)) {
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) {
      const current = await readlink(target);
      if (current === source) return;
    }
    warnings.push(`Skipped existing profile entry: ${basename(target)}`);
    return;
  }
  await symlink(source, target);
}

async function saveProfilePrivate(profileRoot: string, name: string, value: JsonObject) {
  await writeJsonObject(join(profileRoot, name), value);
}

async function readProfilePrivate(profileRoot: string, name: string) {
  return readJsonObject(join(profileRoot, name));
}

export async function materializeProfile(config: AppConfig, profile: Profile): Promise<SyncResult> {
  const lockPath = join(config.profilesDir, ".sync.lock");
  return withLock(lockPath, async () => {
    const root = profileDir(config, profile.name);
    const warnings: string[] = [];
    await mkdir(root, { recursive: true });
    await mkdir(dirname(config.sharedClaudeJson), { recursive: true });

    for (const entry of SHARED_DOT_CLAUDE_ENTRIES) {
      await safeLink(join(config.sharedClaudeDir, entry), join(root, entry), warnings);
    }

    const profileCredentialsPath = join(root, ".credentials.json");
    const sharedCredentialsPath = join(config.sharedClaudeDir, ".credentials.json");
    const sharedCredentials = splitCredentials(await readJsonObject(sharedCredentialsPath));
    const existingProfileCredentials = splitCredentials(await readJsonObject(profileCredentialsPath));
    const privateCredentials = await readProfilePrivate(root, "account-credentials.json");
    const profileCredentials = hasKeys(privateCredentials) ? privateCredentials : existingProfileCredentials.profile;
    await writeJsonObject(profileCredentialsPath, mergeCredentials(sharedCredentials.shared, profileCredentials, { ...sharedCredentials.unknown, ...existingProfileCredentials.unknown }));

    const profileClaudeJsonPath = join(root, ".claude.json");
    const sharedClaudeJson = await readJsonObject(config.sharedClaudeJson);
    const sharedJsonSplit = splitClaudeJson(sharedClaudeJson);
    const existingProfileJson = splitClaudeJson(await readJsonObject(profileClaudeJsonPath));
    const privateJson = await readProfilePrivate(root, "account-state.json");
    const profileJson = hasKeys(privateJson) ? privateJson : existingProfileJson.profile;
    await writeJsonObject(profileClaudeJsonPath, mergeClaudeJson(sharedJsonSplit.shared, profileJson));

    return { profileDir: root, sharedEntries: SHARED_DOT_CLAUDE_ENTRIES, warnings };
  });
}

export async function collectProfileChanges(config: AppConfig, profile: Profile): Promise<SyncResult> {
  const lockPath = join(config.profilesDir, ".sync.lock");
  return withLock(lockPath, async () => {
    const root = profileDir(config, profile.name);
    const warnings: string[] = [];

    const mergedCredentials = splitCredentials(await readJsonObject(join(root, ".credentials.json")));
    await saveProfilePrivate(root, "account-credentials.json", mergedCredentials.profile);
    const sharedCredentialsPath = join(config.sharedClaudeDir, ".credentials.json");
    const currentSharedCredentials = splitCredentials(await readJsonObject(sharedCredentialsPath));
    await writeJsonObject(
      sharedCredentialsPath,
      mergeCredentials({ ...currentSharedCredentials.shared, ...mergedCredentials.shared }, {}, { ...currentSharedCredentials.unknown, ...mergedCredentials.unknown }),
    );

    const mergedJson = splitClaudeJson(await readJsonObject(join(root, ".claude.json")));
    await saveProfilePrivate(root, "account-state.json", mergedJson.profile);
    const currentSharedJson = splitClaudeJson(await readJsonObject(config.sharedClaudeJson));
    await writeJsonObject(config.sharedClaudeJson, { ...currentSharedJson.shared, ...mergedJson.shared });

    for (const entry of await readdir(root).catch(() => [])) {
      if (entry.startsWith("account-") || entry === ".credentials.json" || entry === ".claude.json") continue;
      const target = join(root, entry);
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) continue;
      const sharedTarget = join(config.sharedClaudeDir, entry);
      if (!await exists(sharedTarget)) {
        await copyFile(target, sharedTarget).catch(() => warnings.push(`Could not copy new shared entry: ${entry}`));
        await rm(target, { recursive: true, force: true });
        await safeLink(sharedTarget, target, warnings);
      }
    }

    return { profileDir: root, sharedEntries: SHARED_DOT_CLAUDE_ENTRIES, warnings };
  });
}

export async function syncRoundTrip(config: AppConfig, profile: Profile) {
  await materializeProfile(config, profile);
  return collectProfileChanges(config, profile);
}

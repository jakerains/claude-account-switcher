import { homedir } from "node:os";
import { join } from "node:path";

export function homePath(...parts: string[]) {
  return join(process.env.HOME || homedir(), ...parts);
}

export function defaultConfigPath() {
  return process.env.CCA_CONFIG_PATH || homePath(".config", "claude-account-switcher", "config.json");
}

export function defaultProfilesDir() {
  return process.env.CCA_PROFILES_DIR || homePath(".claude-account-switcher", "profiles");
}

export function defaultSharedClaudeDir() {
  return process.env.CCA_SHARED_CLAUDE_DIR || homePath(".claude");
}

export function defaultSharedClaudeJson() {
  return process.env.CCA_SHARED_CLAUDE_JSON || homePath(".claude.json");
}

export function defaultShellIntegrationPath() {
  return process.env.CCA_SHELL_INTEGRATION || homePath(".config", "claude-account-switcher", "aliases.zsh");
}

export function expandHome(path: string) {
  if (path === "~") return process.env.HOME || homedir();
  if (path.startsWith("~/")) return join(process.env.HOME || homedir(), path.slice(2));
  return path;
}


import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { materializeProfile, mergeClaudeJson, mergeCredentials, splitClaudeJson, splitCredentials } from "../src/lib/sync";
import { shellIntegration } from "../src/lib/shell";
import type { AppConfig, Profile } from "../src/lib/types";

describe("credential sync policy", () => {
  test("keeps Claude account auth profile-specific and MCP OAuth shared", () => {
    const split = splitCredentials({
      claudeAiOauth: { account: "work" },
      mcpOAuth: { github: "shared" },
      futureCredential: { keep: true },
    });

    expect(split.profile).toEqual({ claudeAiOauth: { account: "work" } });
    expect(split.shared).toEqual({ mcpOAuth: { github: "shared" } });
    expect(split.unknown).toEqual({ futureCredential: { keep: true } });
    expect(mergeCredentials(split.shared, split.profile, split.unknown)).toEqual({
      futureCredential: { keep: true },
      mcpOAuth: { github: "shared" },
      claudeAiOauth: { account: "work" },
    });
  });
});

describe("claude json sync policy", () => {
  test("isolates first-party account fields and shares MCP/project state", () => {
    const split = splitClaudeJson({
      oauthAccount: { email: "me@example.com" },
      userID: "user-1",
      mcpServers: { github: { type: "http" } },
      projects: { "/tmp/project": { mcpServers: {} } },
      skillUsage: { opentui: 1 },
    });

    expect(split.profile).toEqual({
      oauthAccount: { email: "me@example.com" },
      userID: "user-1",
    });
    expect(split.shared).toEqual({
      mcpServers: { github: { type: "http" } },
      projects: { "/tmp/project": { mcpServers: {} } },
      skillUsage: { opentui: 1 },
    });
    expect(mergeClaudeJson(split.shared, split.profile).oauthAccount).toEqual({ email: "me@example.com" });
  });
});

describe("shell integration", () => {
  test("generates direct passthrough shell functions for normal commands", () => {
    const config: AppConfig = {
      version: 1,
      claudePath: "/usr/local/bin/claude",
      sharedClaudeDir: "/tmp/.claude",
      sharedClaudeJson: "/tmp/.claude.json",
      profilesDir: "/tmp/profiles",
      shellIntegrationPath: "/tmp/aliases.zsh",
      profiles: [
        { name: "work", alias: "claude-work", createdAt: "now", updatedAt: "now" },
      ],
    };

    expect(shellIntegration(config)).toContain("claude-work() {");
    expect(shellIntegration(config)).toContain("CLAUDE_CONFIG_DIR='/tmp/profiles/work' '/usr/local/bin/claude' \"$@\"");
  });

  test("routes MCP commands through the managed sync path", () => {
    const config: AppConfig = {
      version: 1,
      claudePath: "/usr/local/bin/claude",
      sharedClaudeDir: "/tmp/.claude",
      sharedClaudeJson: "/tmp/.claude.json",
      profilesDir: "/tmp/profiles",
      shellIntegrationPath: "/tmp/aliases.zsh",
      profiles: [
        { name: "work", alias: "claude-work", createdAt: "now", updatedAt: "now" },
      ],
    };

    expect(shellIntegration(config)).toContain("mcp) cca run-managed 'work' -- \"$@\" ;;");
  });
});

describe("materializeProfile", () => {
  test("preserves Claude auth written by direct alias login", async () => {
    const root = await mkdtemp(join(tmpdir(), "cca-test-"));
    const sharedClaudeDir = join(root, "shared");
    const profilesDir = join(root, "profiles");
    const profileRoot = join(profilesDir, "work");
    await mkdir(sharedClaudeDir, { recursive: true });
    await mkdir(profileRoot, { recursive: true });
    await writeFile(join(sharedClaudeDir, ".credentials.json"), JSON.stringify({ mcpOAuth: { github: "shared" } }));
    await writeFile(join(root, ".claude.json"), JSON.stringify({ mcpServers: { github: { type: "http" } } }));
    await writeFile(join(profileRoot, ".credentials.json"), JSON.stringify({ claudeAiOauth: { account: "work" } }));

    const profile: Profile = { name: "work", alias: "claude-work", createdAt: "now", updatedAt: "now" };
    const config: AppConfig = {
      version: 1,
      claudePath: "/usr/local/bin/claude",
      sharedClaudeDir,
      sharedClaudeJson: join(root, ".claude.json"),
      profilesDir,
      shellIntegrationPath: join(root, "aliases.zsh"),
      profiles: [profile],
    };

    await materializeProfile(config, profile);
    const merged = JSON.parse(await readFile(join(profileRoot, ".credentials.json"), "utf8"));
    expect(merged.claudeAiOauth).toEqual({ account: "work" });
    expect(merged.mcpOAuth).toEqual({ github: "shared" });
  });
});

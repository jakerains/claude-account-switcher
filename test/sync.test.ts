import { describe, expect, test } from "bun:test";
import { mergeClaudeJson, mergeCredentials, splitClaudeJson, splitCredentials } from "../src/lib/sync";
import { shellIntegration } from "../src/lib/shell";
import type { AppConfig } from "../src/lib/types";

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
  test("generates passthrough shell functions", () => {
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
    expect(shellIntegration(config)).toContain("cca run 'work' -- \"$@\"");
  });
});


import { collectProfileChanges, materializeProfile } from "./sync";
import { findProfile, loadConfig } from "./config";

export async function runClaude(profileName: string, args: string[]) {
  const config = await loadConfig();
  const profile = findProfile(config, profileName);
  const prepared = await materializeProfile(config, profile);
  const proc = Bun.spawn([config.claudePath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: prepared.profileDir,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const code = await proc.exited;
  await collectProfileChanges(config, profile);
  return code;
}


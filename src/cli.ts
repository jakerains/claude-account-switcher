import { addProfile, doctor, findProfile, initConfig, loadConfig, removeProfile } from "./lib/config";
import { writeShellIntegration } from "./lib/shell";
import { materializeProfile, syncRoundTrip } from "./lib/sync";
import { runManagedClaude } from "./lib/runner";

function printHelp() {
  console.log(`Claude Account Switcher

Usage:
  cca                         Open the OpenTUI manager
  cca init                    Initialize config and shell integration
  cca add <name> [--alias x]  Add a Claude account profile
  cca list                    List profiles
  cca doctor                  Check installation health
  cca remove <name>           Remove a profile alias from config
  cca run-managed <name> -- [args]
                              Run Claude with pre/post shared-state sync
`);
}

function readAlias(args: string[]) {
  const index = args.indexOf("--alias");
  if (index === -1) return undefined;
  return args[index + 1];
}

export async function handleCli(args: string[]) {
  const command = args[0];
  if (!command || command === "tui") return false;
  if (command === "-h" || command === "--help" || command === "help") {
    printHelp();
    return true;
  }
  if (command === "init") {
    const config = await initConfig();
    await writeShellIntegration(config);
    console.log(`Initialized ${config.shellIntegrationPath}`);
    console.log(`Add this to ~/.zshrc: source "${config.shellIntegrationPath}"`);
    return true;
  }
  if (command === "add") {
    const name = args[1];
    if (!name) throw new Error("Usage: cca add <name> [--alias alias]");
    const { config, profile } = await addProfile(name, readAlias(args) || `claude-${name}`);
    await materializeProfile(config, profile);
    await writeShellIntegration(config);
    console.log(`Added ${profile.name} as ${profile.alias}`);
    console.log(`Login with: ${profile.alias} auth login`);
    console.log(`Run normal commands directly through the alias: ${profile.alias} --version`);
    return true;
  }
  if (command === "list") {
    const config = await loadConfig();
    if (config.profiles.length === 0) {
      console.log("No profiles configured.");
      return true;
    }
    for (const profile of config.profiles) {
      console.log(`${profile.name}\t${profile.alias}`);
    }
    return true;
  }
  if (command === "doctor") {
    const config = await loadConfig();
    const checks = await doctor(config);
    for (const check of checks) {
      console.log(`${check.ok ? "✓" : "✗"} ${check.label}: ${check.detail}`);
    }
    return true;
  }
  if (command === "remove") {
    const name = args[1];
    if (!name) throw new Error("Usage: cca remove <name>");
    const config = await removeProfile(name);
    await writeShellIntegration(config);
    console.log(`Removed ${name} from shell integration. Profile files were preserved.`);
    return true;
  }
  if (command === "sync") {
    const name = args[1];
    if (!name) throw new Error("Usage: cca sync <name>");
    const config = await loadConfig();
    const profile = findProfile(config, name);
    const result = await syncRoundTrip(config, profile);
    console.log(`Synced ${profile.name}: ${result.profileDir}`);
    return true;
  }
  if (command === "run-managed" || command === "run") {
    const name = args[1];
    if (!name) throw new Error("Usage: cca run-managed <name> -- [claude args]");
    const marker = args.indexOf("--");
    const claudeArgs = marker === -1 ? args.slice(2) : args.slice(marker + 1);
    const code = await runManagedClaude(name, claudeArgs);
    process.exitCode = code;
    return true;
  }
  throw new Error(`Unknown command: ${command}`);
}

import { useEffect, useMemo, useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import type { AppConfig, DoctorCheck, Profile } from "../lib/types";
import { createProfile, deleteProfile, loadUiState, profileAuthStatus, refreshUiState, repairProfile, runProfileLogin } from "./operations";

type View = "dashboard" | "profiles" | "mcp" | "logs";
type Mode = "normal" | "add";

const colors = {
  bg: "#101418",
  panel: "#151b21",
  border: "#35414c",
  accent: "#7dd3fc",
  good: "#86efac",
  warn: "#facc15",
  bad: "#fca5a5",
  text: "#e5edf3",
  dim: "#91a0aa",
};

function nowLog(message: string) {
  return `${new Date().toLocaleTimeString()}  ${message}`;
}

function Header({ view }: { view: View }) {
  return (
    <box height={3} paddingX={2} alignItems="center" justifyContent="space-between" backgroundColor={colors.bg}>
      <text fg={colors.accent}>
        <strong>Claude Account Switcher</strong>
      </text>
      <text fg={colors.dim}>tab: {view}  a add  l login  d doctor  r repair  q quit</text>
    </box>
  );
}

function Sidebar({ config, selected, onSelect }: { config: AppConfig; selected?: string; onSelect: (name: string) => void }) {
  const options = config.profiles.length
    ? config.profiles.map((profile) => ({
        name: profile.name,
        description: profile.alias,
        value: profile.name,
      }))
    : [{ name: "No profiles", description: "Press a to add one", value: "" }];

  return (
    <box width={28} flexShrink={0} border padding={1} borderColor={colors.border} backgroundColor={colors.panel} flexDirection="column">
      <text fg={colors.dim}>Profiles</text>
      <select
        height={Math.max(6, Math.min(12, options.length + 2))}
        options={options}
        selectedIndex={Math.max(0, config.profiles.findIndex((profile) => profile.name === selected))}
        onSelect={(_, option) => {
          if (option?.value) onSelect(String(option.value));
        }}
        focused
        showScrollIndicator
        selectedBackgroundColor="#263543"
        selectedTextColor={colors.text}
      />
    </box>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return <text fg={ok ? colors.good : colors.bad}>{ok ? "OK" : "ERR"} {label}</text>;
}

function Dashboard({ profile, checks }: { profile?: Profile; checks: DoctorCheck[] }) {
  return (
    <box flexDirection="column" gap={1}>
      <box border borderColor={colors.border} padding={1} flexDirection="column">
        <text fg={colors.accent}>Selected profile</text>
        {profile ? (
          <>
            <text fg={colors.text}>Name: {profile.name}</text>
            <text fg={colors.text}>Alias: {profile.alias}</text>
            <text fg={colors.dim}>Login: press l to run Claude auth login in this profile.</text>
          </>
        ) : (
          <text fg={colors.warn}>No profile configured. Press a to create one.</text>
        )}
      </box>
      <box border borderColor={colors.border} padding={1} flexDirection="column">
        <text fg={colors.accent}>Health</text>
        {checks.map((check) => (
          <StatusBadge key={check.label} ok={check.ok} label={`${check.label}: ${check.detail}`} />
        ))}
      </box>
    </box>
  );
}

function ProfilesView({ config }: { config: AppConfig }) {
  return (
    <box flexDirection="column" border borderColor={colors.border} padding={1}>
      <text fg={colors.accent}>Configured profile commands</text>
      {config.profiles.length === 0 ? (
        <text fg={colors.dim}>No profiles yet.</text>
      ) : (
        config.profiles.map((profile) => (
          <text key={profile.name} fg={colors.text}>
            {profile.alias} {"->"} direct Claude route, managed MCP sync
          </text>
        ))
      )}
      <text fg={colors.dim}>Shell file: {config.shellIntegrationPath}</text>
    </box>
  );
}

function McpView() {
  return (
    <box flexDirection="column" border borderColor={colors.border} padding={1}>
      <text fg={colors.accent}>Shared MCP behavior</text>
      <text fg={colors.text}>MCP server config and MCP OAuth are shared across all profiles.</text>
      <text fg={colors.text}>Authorize once in any profile, then use the same MCP from other profiles.</text>
      <text fg={colors.dim}>Use a generated alias, for example: claude-work mcp list</text>
      <text fg={colors.dim}>If a provider binds tokens to a specific external account, that provider may still require re-auth.</text>
    </box>
  );
}

function LogsView({ logs }: { logs: string[] }) {
  return (
    <scrollbox border borderColor={colors.border} padding={1} flexGrow={1}>
      {logs.length === 0 ? (
        <text fg={colors.dim}>No operations yet.</text>
      ) : (
        logs.map((line, index) => <text key={`${index}-${line}`} fg={colors.text}>{line}</text>)
      )}
    </scrollbox>
  );
}

function AddProfileForm({ onCreate, onCancel, busy }: { onCreate: (name: string, alias: string) => void; onCancel: () => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  useKeyboard((key) => {
    if (key.name === "escape") onCancel();
    if (key.name === "return" && name.trim()) {
      onCreate(name.trim(), alias.trim() || `claude-${name.trim()}`);
    }
  });

  return (
    <box position="absolute" left="20%" top="25%" width="60%" height={11} border borderColor={colors.accent} backgroundColor="#0f1720" padding={1} flexDirection="column">
      <text fg={colors.accent}>Add profile</text>
      <text fg={colors.dim}>Profile name</text>
      <input value={name} onChange={setName} placeholder="work" focused={!busy} width="100%" />
      <text fg={colors.dim}>Alias command</text>
      <input value={alias} onChange={setAlias} placeholder={name ? `claude-${name}` : "claude-work"} width="100%" />
      <text fg={colors.dim}>Enter creates, Esc cancels.</text>
    </box>
  );
}

export function App() {
  const renderer = useRenderer();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [checks, setChecks] = useState<DoctorCheck[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [view, setView] = useState<View>("dashboard");
  const [mode, setMode] = useState<Mode>("normal");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (message: string) => setLogs((current) => [...current.slice(-200), nowLog(message)]);

  const reload = async () => {
    const state = await refreshUiState();
    setConfig(state.config);
    setChecks(state.checks);
    if (!selected && state.config.profiles[0]) setSelected(state.config.profiles[0].name);
  };

  useEffect(() => {
    loadUiState()
      .then((state) => {
        setConfig(state.config);
        setChecks(state.checks);
        setSelected(state.config.profiles[0]?.name);
        log("Initialized manager");
      })
      .catch((error) => log(`Init failed: ${(error as Error).message}`));
  }, []);

  const profile = useMemo(() => config?.profiles.find((candidate) => candidate.name === selected), [config, selected]);

  useKeyboard((key) => {
    if (mode !== "normal") return;
    if (key.name === "q" || key.name === "escape") renderer.destroy();
    if (key.name === "tab") {
      setView((current) => {
        const views: View[] = ["dashboard", "profiles", "mcp", "logs"];
        return views[(views.indexOf(current) + 1) % views.length] || "dashboard";
      });
    }
    if (key.name === "a") setMode("add");
    if (key.name === "d") {
      setBusy(true);
      refreshUiState()
        .then((state) => {
          setConfig(state.config);
          setChecks(state.checks);
          log("Doctor refreshed");
        })
        .catch((error) => log(`Doctor failed: ${(error as Error).message}`))
        .finally(() => setBusy(false));
    }
    if (key.name === "r" && config && profile) {
      setBusy(true);
      repairProfile(config, profile)
        .then(() => {
          log(`Repaired ${profile.name}`);
          return reload();
        })
        .catch((error) => log(`Repair failed: ${(error as Error).message}`))
        .finally(() => setBusy(false));
    }
    if (key.name === "l" && config && profile) {
      setBusy(true);
      setView("logs");
      runProfileLogin(config, profile, log)
        .then(() => profileAuthStatus(config, profile))
        .then((status) => log(`Auth status: ${status.output || status.code}`))
        .catch((error) => log(`Login failed: ${(error as Error).message}`))
        .finally(() => setBusy(false));
    }
    if (key.name === "delete" && profile) {
      setBusy(true);
      deleteProfile(profile.name)
        .then(() => {
          log(`Removed ${profile.name}`);
          setSelected(undefined);
          return reload();
        })
        .catch((error) => log(`Remove failed: ${(error as Error).message}`))
        .finally(() => setBusy(false));
    }
  });

  const handleCreate = (name: string, alias: string) => {
    setBusy(true);
    createProfile(name, alias)
      .then((created) => {
        setMode("normal");
        setSelected(created.name);
        log(`Created ${created.name} (${created.alias})`);
        return reload();
      })
      .catch((error) => log(`Create failed: ${(error as Error).message}`))
      .finally(() => setBusy(false));
  };

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.bg}>
      <Header view={view} />
      <box flexGrow={1} flexDirection="row" gap={1} paddingX={1} paddingBottom={1}>
        {config ? <Sidebar config={config} selected={selected} onSelect={setSelected} /> : null}
        <box flexGrow={1} flexDirection="column" backgroundColor={colors.panel} border borderColor={colors.border} padding={1}>
          {busy ? <text fg={colors.warn}>Operation running...</text> : null}
          {!config ? <text fg={colors.dim}>Loading...</text> : null}
          {config && view === "dashboard" ? <Dashboard profile={profile} checks={checks} /> : null}
          {config && view === "profiles" ? <ProfilesView config={config} /> : null}
          {view === "mcp" ? <McpView /> : null}
          {view === "logs" ? <LogsView logs={logs} /> : null}
        </box>
      </box>
      {mode === "add" ? <AddProfileForm onCreate={handleCreate} onCancel={() => setMode("normal")} busy={busy} /> : null}
    </box>
  );
}

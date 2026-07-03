import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { handleCli } from "./cli";
import { App } from "./ui/App";

try {
  const handled = await handleCli(Bun.argv.slice(2));
  if (!handled) {
    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
      useMouse: true,
    });
    createRoot(renderer).render(<App />);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}


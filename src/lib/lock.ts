import { mkdir, rm } from "node:fs/promises";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  while (true) {
    try {
      await mkdir(lockPath, { recursive: false });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() - started > 15000) {
        throw new Error(`Timed out waiting for lock: ${lockPath}`);
      }
      await delay(100);
    }
  }

  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}


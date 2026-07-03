import { describe, expect, test } from "bun:test";
import { validateAlias, validateProfileName } from "../src/lib/config";

describe("profile validation", () => {
  test("accepts simple names and aliases", () => {
    expect(() => validateProfileName("work")).not.toThrow();
    expect(() => validateAlias("claude-work")).not.toThrow();
  });

  test("rejects shell-hostile names", () => {
    expect(() => validateProfileName("../work")).toThrow();
    expect(() => validateAlias("claude work")).toThrow();
  });
});


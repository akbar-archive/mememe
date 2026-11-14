import { existsSync } from "node:fs";

/** Loads .env for local runs; in Actions the variables come from secrets. */
export function loadLocalEnv(): void {
  if (existsSync(".env")) process.loadEnvFile(".env");
}

export function requireEnv(names: string[]): Record<string, string> {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name]!]));
}

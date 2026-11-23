// Hosts such as Bolt run a plain `npm install` at the repository root. This workspace uses pnpm
// (workspace: dependencies and a pinned React override), so npm alone would install only the root
// tools. When npm is the installer, hand off to the pinned pnpm so the whole workspace installs.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const agent = process.env.npm_config_user_agent ?? "";
if (agent.startsWith("pnpm") || process.env.FUNKTY_BOOTSTRAPPING === "1") {
  process.exit(0);
}

const { packageManager } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const pnpmVersion = packageManager.split("@")[1];

console.log(`[funkty] npm detected; installing the workspace with pnpm@${pnpmVersion}`);
const result = spawnSync(
  "npx",
  ["--yes", `pnpm@${pnpmVersion}`, "install", "--frozen-lockfile"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, FUNKTY_BOOTSTRAPPING: "1" },
  },
);
process.exit(result.status ?? 1);

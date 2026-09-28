import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { vi } from "vitest";

const ROOT = join(__dirname, "../..");

/**
 * Stubs fetch() to serve the package's asset URLs ("/src/data/keywords/en.json" under Vite) from
 * disk, as the app's server does. Returns the URLs requested.
 */
export function serveFromDisk(): string[] {
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input).split("?")[0]!;
    requests.push(url);
    const path = url.startsWith("/@fs/") ? url.slice("/@fs/".length) : join(ROOT, url);
    try {
      return new Response(await readFile(path, "utf8"), { headers: { "content-type": "application/json" } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  return requests;
}

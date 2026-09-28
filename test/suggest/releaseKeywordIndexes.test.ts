/**
 * Suggestions can be switched off: releaseKeywordIndexes() lets go of every index so its data can be
 * collected, and a later load fetches it again.
 */

import { test, expect, vi, beforeEach } from "vitest";
import { loadKeywordIndex, releaseKeywordIndexes } from "../../src/core/suggest";
import { serveFromDisk } from "./serveFromDisk";

let requests: string[];

beforeEach(() => {
  releaseKeywordIndexes();
  requests = serveFromDisk();
});

test("a released index loads again, as a new instance", async () => {
  const first = await loadKeywordIndex("en");
  expect(await loadKeywordIndex("en")).toBe(first);
  releaseKeywordIndexes();
  const second = await loadKeywordIndex("en");
  expect(second).not.toBe(first);
  expect(second.matchExact("fire")[0]?.hexcode).toBe("1f525");
  expect(requests).toEqual(["/src/data/keywords/en.json", "/src/data/keywords/en.json"]);
});

test("a load in flight when released does not come back into the cache", async () => {
  const inFlight = loadKeywordIndex("ru");
  releaseKeywordIndexes();
  const stale = await inFlight;
  const fresh = await loadKeywordIndex("ru");
  expect(fresh).not.toBe(stale);
  expect(await loadKeywordIndex("ru")).toBe(fresh);
  expect(requests).toHaveLength(2);
});

test("a failed load is retried on the next call", async () => {
  vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
  await expect(loadKeywordIndex("ja")).rejects.toThrow("503");
  serveFromDisk();
  expect((await loadKeywordIndex("ja")).locale).toBe("ja");
});

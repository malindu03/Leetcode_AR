/**
 * Runs in the page's own JavaScript world (MAIN)
 * 
 * LeetCode's judge is asynchronous. The page POSTs the code to
 * /problems/{slug}/submit/, gets a numeric submission id back, then polls
 * /submissions/detail/{id}/v2/check/ until state flips to SUCCESS. Reading
 * that poll response gives the verdict, runtime, memory and percentiles as structured data.
 * 
 * These are the requests we intercept:
 * - POST /problems/{slug}/submit/
 * - GET /submissions/detail/{id}/v2/check/
 */

import { CHANNEL, type AcceptedSubmission } from '../domain/types';

// The regexes for the two requests we want to match.
const SUBMIT_RE = /^\/problems\/([a-z0-9-]+)\/submit\/?$/;
const CHECK_RE = /^\/submissions\/detail\/(\d+)\/(?:v\d+\/)?check\/?$/;

function pathOf(url: string): string {
  return new URL(url, location.href).pathname;
}

// monkey-patch the page's fetch() to intercept requests. 
function hookFetch(): void {
  const nativeFetch = window.fetch;

  // `this` is whatever fetch was called on, normally window. Passing it through
  // keeps the native fetch's behaviour identical, including its errors.
  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const promise = nativeFetch.call(this, input, init);

    try {
      const path = pathOf(input instanceof Request ? input.url : String(input));
      const slug = SUBMIT_RE.exec(path)?.[1];
      const id = CHECK_RE.exec(path)?.[1];

      if (slug !== undefined || id !== undefined) {
        // LeetCode passes the body in init.
        const requestBody = init?.body;
        // Registered before the page gets the promise, so this runs before LeetCode's own .then reads the body, and clone() still works.
        promise.then((response) => response.clone().text())
          .then((text) => {
            if (slug !== undefined) {
              handleSubmit(slug, requestBody, text);
            }
            else if (id !== undefined) {
              handleCheck(id, text);
            }
          })
          .catch((error: unknown) => console.warn('[LC-SR] could not read a judge response', { path, error }));
      }
    } catch {
      // ignore errors in our own code, don't break the page's fetch() behavior
    }

    return promise;
  };
}


// Parse a string as JSON and return the object if it's a plain object, otherwise return null.
function parseObject(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') {
    return null;
  }

  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Keep the pending submissions in memory so we can match them with the check responses. 
type PendingSubmit = {slug: string, code: string | null};
const pending = new Map<string, PendingSubmit>();

// Entries leave the map when their verdict arrives, so only submissions whose verdict never came stay behind.
const PENDING_LIMIT = 20;

function remember(id: string, entry: PendingSubmit): void {
  pending.set(id, entry);
  if (pending.size > PENDING_LIMIT) {
    const oldest = pending.keys().next().value;
    if (oldest !== undefined) {
      pending.delete(oldest);
    }
  }
}

function handleSubmit(slug: string, requestBody: unknown, responseText: string): void {
  const id = parseObject(responseText)?.submission_id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    console.warn('[LC-SR] submit response had no numeric submission_id', { slug, responseText });
    return;
  }
  remember(String(id), { slug, code: asString(parseObject(requestBody)?.typed_code) });
}

function handleCheck(id: string, responseText: string): void {
  const verdict = parseObject(responseText);
  // The page polls until the judge finishes with earlier answers say PENDING.
  if (verdict?.state !== 'SUCCESS') return;

  const entry = pending.get(id);
  pending.delete(id);

  if (verdict.status_code !== 10 || verdict.status_msg !== 'Accepted') return;

  if (entry === undefined) {
    console.warn('[LC-SR] accepted verdict with no matching submit', { id });
    return;
  }

  const submission: AcceptedSubmission = {
    submissionId: id,
    slug: entry.slug,
    lang: asString(verdict.lang),
    code: entry.code,
    runtime: asString(verdict.status_runtime),
    memory: asString(verdict.status_memory),
    runtimePercentile: asNumber(verdict.runtime_percentile),
    memoryPercentile: asNumber(verdict.memory_percentile),
  };
  console.log('[LC-SR] accepted', submission);
  window.postMessage({ source: CHANNEL, type: 'ACCEPTED', payload: submission }, location.origin);
}


// If patching fails, the page keeps the real fetch and we say so. 
try {
  hookFetch();
  // readyState should be "loading": proof we ran before LeetCode's own scripts
  // document is a global object representing the HTML document loaded in the browser.
  console.log('[LC-SR] interceptor ready', { readyState: document.readyState });
  window.postMessage({ source: CHANNEL, type: 'INTERCEPTOR_READY' }, location.origin);
} catch (error) {
  console.warn('[LC-SR] could not hook fetch', error);
}




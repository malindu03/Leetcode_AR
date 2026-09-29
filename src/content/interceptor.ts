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

import { CHANNEL } from '../domain/types';

// The regexes for the two requests we want to match.
const SUBMIT_RE = /^\/problems\/([a-z0-9-]+)\/submit\/?$/;
const CHECK_RE = /^\/submissions\/detail\/(\d+)\/(?:v\d+\/)?check\/?$/;

function pathOf(url: string): string {
  return new URL(url, location.href).pathname;
}

// Every request the page makes passes through the hooks, so this runs first and everything else is skipped.
function isInteresting(path: string): boolean {
  return SUBMIT_RE.test(path) || CHECK_RE.test(path);
}

// monkey-patch the page's fetch() to intercept requests. 
function hookFetch(): void {
  const nativeFetch = window.fetch;

  // Captures and forwards the execution context (`this`) to `nativeFetch.call(...)` so native DOM methods maintain their expected global binding.
  // RequestInit is a type that describes the options for the request, such as method, headers, body, etc.
  window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Call the original fetch() and get the promise for the response.
    const promise = nativeFetch.call(this, input, init);

    try {
      const path = pathOf(input instanceof Request ? input.url : String(input));
      if (isInteresting(path)) {
        promise.then(() => console.log('[LC-SR] matched', { path })).catch(() => {});
      }
    } catch {
      // ignore errors in our own code, don't break the page's fetch() behavior
    }

    return promise;
  };
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




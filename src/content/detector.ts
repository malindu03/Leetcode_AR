/**
 * Runs in the ISOLATED world: same DOM and same window events as the page, but
 * its own JavaScript globals and access to chrome.* APIs.
 *
 * The interceptor can see LeetCode's network traffic but can't use chrome.*,
 * so it posts what it finds here. Anything else on the page can post the same
 * messages, so nothing that arrives is trusted until it has been checked.
 */

import { CHANNEL, type AcceptedSubmission } from "../domain/types";
import { asNumber, asObject, asString } from "../shared/guards";

// Regex is used as these two become storage keys and URLs, so a bad one rejects the message.
const ID_RE = /^\d{1,20}$/;
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

const MAX_CODE_LENGTH = 200_000; // Real solutions are few KB.

// Validates the payload of an ACCEPTED message. Returns null if it fails validation.
function validateAccepted(value: unknown): AcceptedSubmission | null {
  const payload = asObject(value);
  if (payload === null) return null;

  const { submissionId, slug } = payload;
  if (typeof submissionId !== "string" || !ID_RE.test(submissionId))
    return null;
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;

  // The rest of the fields are optional, so we can use the as* guards to validate them.

  return {
    submissionId,
    slug,
    lang: asString(payload.lang),
    code: asString(payload.code)?.slice(0, MAX_CODE_LENGTH) ?? null,
    runtime: asString(payload.runtime),
    memory: asString(payload.memory),
    runtimePercentile: asNumber(payload.runtimePercentile),
    memoryPercentile: asNumber(payload.memoryPercentile),
  };
}

// The interceptors messages are received and processed.
window.addEventListener("message", (event: MessageEvent<unknown>) => {
  // Only accepts messages from the same page.
  if (event.source !== window || event.origin !== location.origin) return;

  const data = asObject(event.data);
  if (data === null || data.source !== CHANNEL) return;

  if (data.type === "INTERCEPTOR_READY") {
    console.log("[LC-SR] detector: interceptor is ready");
  } else if (data.type === "ACCEPTED") {
    const submission = validateAccepted(data.payload);
    if (submission === null) {
      console.warn(
        "[LC-SR] dropped an ACCEPTED message that failed validation",
        data.payload,
      );
      return;
    }
    console.log("[LC-SR] solve detected", {
      detectedBy: "interceptor",
      ...submission,
    });
  }
});

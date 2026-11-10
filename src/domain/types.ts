export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Every message carries this tag, so the detector can ignore the page's own
// postMessage traffic without looking any further.
export const CHANNEL = 'leetcode-sr';

export type AcceptedSubmission = {
  submissionId: string;
  slug: string;
  lang: string | null;
  code: string | null;
  runtime: string | null;
  memory: string | null;
  runtimePercentile: number | null;
  memoryPercentile: number | null;
};





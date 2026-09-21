// Runs in the page's own JavaScript world(MAIN).

const hasRuntime = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;

console.log('[LC-SR] interceptor', {
  world: 'MAIN',
  hasRuntime,
  readyState: document.readyState,
  hasBody: document.body !== null,
});

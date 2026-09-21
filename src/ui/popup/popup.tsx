import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/tailwind.css';

function Popup() {
  return (
    <main className="w-64 bg-surface p-4 text-ink">
      <h1 className="text-accent">LeetCode Spaced Repetition</h1>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('popup: no root element in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);

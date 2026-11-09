import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/sidepanel/App';
import '../../src/sidepanel/styles.css';

// `?window`: opened as the floating window (src/lib/floating-window.ts). `?overlay`: framed
// inside an X tab as the panel overlay (src/content/overlay.ts).
const params = new URLSearchParams(location.search);
const mode = params.has('window') ? 'window' : params.has('overlay') ? 'overlay' : 'panel';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App mode={mode} />
  </React.StrictMode>,
);

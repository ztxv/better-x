import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/sidepanel/App';
import '../../src/sidepanel/styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* `?window`: opened as the floating window (src/lib/floating-window.ts). */}
    <App mode={new URLSearchParams(location.search).has('window') ? 'window' : 'panel'} />
  </React.StrictMode>,
);

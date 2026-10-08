import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/sidepanel/App';
import '../../src/sidepanel/styles.css';

// The same application as the side panel, laid out for the toolbar popup.
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App mode="popup" />
  </React.StrictMode>,
);

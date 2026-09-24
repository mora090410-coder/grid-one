
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css'; // Tailwind
import App from './App';
import { installStaleChunkReload } from './utils/staleChunkReload';

// Each route loads its code on demand; recover a tab left open across a deploy.
installStaleChunkReload(window);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Remove splash screen
const splash = document.getElementById('splash');
if (splash) {
  splash.style.opacity = '0';
  setTimeout(() => {
    splash.remove();
  }, 300); // Match transition duration
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

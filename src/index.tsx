import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { debugError, debugLog, refreshDebugFlags } from './utils/debugLog';

refreshDebugFlags();
debugLog('react', 'renderer boot', { href: window.location.href });

window.addEventListener('error', (event) => {
  debugError('react', 'window.error', event.message, event.filename, event.lineno, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  debugError('react', 'unhandledrejection', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);

debugLog('react', 'root.render called', {
  rootChildren: rootElement.childElementCount,
});

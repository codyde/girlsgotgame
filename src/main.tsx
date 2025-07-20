import * as Sentry from "@sentry/react";
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

Sentry.init({
  dsn: "https://51856680ec2b534a15da7d5cc5730a41@o4508130833793024.ingest.us.sentry.io/4509699673948160",

  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] })
  ],

  _experiments: {
    enableLogs: true,
  },

  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

createRoot(document.getElementById('root')!).render(
    <App />
);

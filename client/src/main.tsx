import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { applyDocumentLocale } from './i18n';
import { useStore } from './store/useStore';

const persisted = localStorage.getItem('localtube-store');
if (persisted) {
  try {
    const parsed = JSON.parse(persisted) as { state?: { locale?: 'en' | 'ar' } };
    if (parsed.state?.locale) {
      applyDocumentLocale(parsed.state.locale);
    }
  } catch {
    /* ignore */
  }
} else {
  applyDocumentLocale(useStore.getState().locale);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:            1,
      staleTime:        60_000,    // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import { MainDataProvider } from './hooks/useMainData';
import App from './App.jsx';
import './index.css';

// Registrar Service Worker para PWA (cacheo offline + notificaciones background)
// Si llega un nuevo SW activo (tras deploy), recarga la página automáticamente
// para evitar pantalla en blanco por chunks JS desactualizados.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'activated' && navigator.serviceWorker.controller) {
            // Un nuevo SW reemplazó al anterior — recargar para tomar el HTML/JS nuevo
            window.location.reload();
          }
        });
      });
    }).catch(() => {});
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainDataProvider>
          <ToastProvider>
            <App/>
          </ToastProvider>
        </MainDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);

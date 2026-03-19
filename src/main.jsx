import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import { MainDataProvider } from './hooks/useMainData';
import App from './App.jsx';
import './index.css';

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

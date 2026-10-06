import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { Tooltip } from 'radix-ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { KonfirmasiProvider } from './context/KonfirmasiContext';
import { ThemeProvider, useTema } from './context/ThemeContext';
import { ApiError } from './lib/api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      // Jangan ulangi error 4xx (mis. 403/404) — hanya error jaringan/server.
      retry: (jumlah, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && jumlah < 2,
    },
  },
});

function ToasterTema() {
  const { tema } = useTema();
  return (
    <Toaster
      theme={tema === 'gelap' ? 'dark' : 'light'}
      position="top-center"
      richColors
      closeButton
      // Di bawah topbar & di tengah: tidak menutupi lonceng/menu akun, tombol aksi halaman (kanan), maupun bar simpan (bawah).
      offset={{ top: 92 }}
      mobileOffset={{ top: 88, left: 12, right: 12 }}
      toastOptions={{ duration: 4000 }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <MotionConfig reducedMotion="user">
            <Tooltip.Provider delayDuration={250}>
              <AuthProvider>
                <KonfirmasiProvider>
                  <App />
                </KonfirmasiProvider>
              </AuthProvider>
            </Tooltip.Provider>
          </MotionConfig>
          <ToasterTema />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);

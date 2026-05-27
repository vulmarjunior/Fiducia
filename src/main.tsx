import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

const updateSW = registerSW({
  onNeedRefresh() {
    toast('Nova versão disponível', {
      description: 'Clique em "Atualizar" para obter as últimas funcionalidades.',
      duration: Infinity,
      action: {
        label: 'Atualizar',
        onClick: () => updateSW(true),
      },
    });
  },
  onOfflineReady() {
    toast.success('App pronto para uso offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

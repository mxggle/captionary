import '@/ui/styles.css';
import '@/ui/pages.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initPageTheme } from '@/ui/theme';
import { App } from './App';

initPageTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

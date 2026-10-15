import '@/ui/styles.css';
import '@/ui/pages.css';
import { createRoot } from 'react-dom/client';
import { initPageTheme } from '@/ui/theme';
import { ReaderApp } from './ReaderApp';

initPageTheme();
createRoot(document.getElementById('root')!).render(<ReaderApp />);

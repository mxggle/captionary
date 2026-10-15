import '@/ui/styles.css';
import '@/ui/pages.css';
import { createRoot } from 'react-dom/client';
import { initPageTheme } from '@/ui/theme';
import { VocabApp } from './VocabApp';

initPageTheme();
createRoot(document.getElementById('root')!).render(<VocabApp />);

import '@/ui/styles.css';
import '@/ui/pages.css';
import { createRoot } from 'react-dom/client';
import { initPageTheme } from '@/ui/theme';
import { SidePanelApp } from './SidePanelApp';

initPageTheme();
createRoot(document.getElementById('root')!).render(<SidePanelApp />);

import '@/ui/styles.css';
import '@/ui/pages.css';
import { createRoot } from 'react-dom/client';
import { initPageTheme } from '@/ui/theme';
import { Popup } from './Popup';

initPageTheme();
createRoot(document.getElementById('root')!).render(<Popup />);

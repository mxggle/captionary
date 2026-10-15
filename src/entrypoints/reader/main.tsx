import '@/ui/styles.css';
import '@/ui/pages.css';
import { createRoot } from 'react-dom/client';
import { ReaderApp } from './ReaderApp';

createRoot(document.getElementById('root')!).render(<ReaderApp />);

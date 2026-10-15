import '@/ui/styles.css';
import '@/ui/pages.css';
import { createRoot } from 'react-dom/client';
import { VocabApp } from './VocabApp';

createRoot(document.getElementById('root')!).render(<VocabApp />);

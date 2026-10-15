import { storage } from '#imports';
import type { SidePanelPayload } from './messaging';

/** What the side panel should show; written by the background, read by the panel. */
export const sidePanelPayload = storage.defineItem<SidePanelPayload | null>('session:sidePanelPayload', {
  fallback: null,
});

export interface ReaderImport {
  title: string;
  url: string;
  text: string;
  lang: string;
}

/** Text extracted from a web page, handed to the reader page. */
export const readerImport = storage.defineItem<ReaderImport | null>('session:readerImport', { fallback: null });

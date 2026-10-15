/**
 * Messaging between the isolated content script and the page ("MAIN" world) scripts
 * that read player state. window.postMessage is visible to the page, so nothing
 * sensitive is ever sent across; data received is treated as untrusted page data.
 */
export const FROM_MAIN = 'lr-main';
export const FROM_ISOLATED = 'lr-iso';

export interface BridgeMessage {
  source?: string;
  type: string;
  reqId?: string;
  [key: string]: unknown;
}

export function postToMain(msg: BridgeMessage) {
  window.postMessage({ ...msg, source: FROM_ISOLATED }, location.origin);
}

export function postToIsolated(msg: BridgeMessage) {
  window.postMessage({ ...msg, source: FROM_MAIN }, location.origin);
}

export function onMessageFrom(source: string, cb: (msg: BridgeMessage) => void): () => void {
  const listener = (e: MessageEvent) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const data = e.data as BridgeMessage | undefined;
    if (!data || data.source !== source || typeof data.type !== 'string') return;
    cb(data);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

/** Ask the MAIN-world script for something and wait for the reply with the same reqId. */
export function requestMain<T>(msg: BridgeMessage, timeoutMs = 3000): Promise<T> {
  const reqId = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const off = onMessageFrom(FROM_MAIN, (reply) => {
      if (reply.reqId !== reqId) return;
      off();
      clearTimeout(timer);
      resolve(reply.data as T);
    });
    const timer = setTimeout(() => {
      off();
      reject(new Error(`No reply to ${msg.type}`));
    }, timeoutMs);
    postToMain({ ...msg, reqId });
  });
}

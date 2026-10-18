import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a: ({ href, children }) => {
    const safe = href && /^https?:\/\//i.test(href) ? href : undefined;
    return safe ? (
      <a href={safe} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
};

/**
 * Renders model output. Raw HTML is never rendered (react-markdown escapes it) and
 * images are dropped: a prompt-injected subtitle must not be able to make the page load
 * an attacker URL (which could carry data in its query string).
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="cap-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} disallowedElements={['img']} unwrapDisallowed={false} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
});

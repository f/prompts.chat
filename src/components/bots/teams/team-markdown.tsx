import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const ALLOWED_ELEMENTS = [
  "p", "br", "strong", "em", "del", "a", "code", "pre", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
];

const heading = ({ children }: { children?: React.ReactNode }) => <p className="mb-1 mt-3 font-semibold text-foreground first:mt-0">{children}</p>;

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-primary underline underline-offset-2 wrap-anywhere">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mb-2 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 pl-3 italic last:mb-0">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-3 text-xs last:mb-0 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  hr: () => <hr className="my-3" />,
  table: ({ children }) => <div className="mb-2 overflow-x-auto"><table className="text-left text-xs">{children}</table></div>,
  th: ({ children }) => <th className="border-b px-2 py-1 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
};

/** A team description written in markdown; raw HTML and images are not rendered */
export function TeamMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-muted-foreground wrap-anywhere", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

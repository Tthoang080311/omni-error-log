// File: src/components/MathText.tsx
'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  content: string;
  className?: string;
}

export default function MathText({ content, className = '' }: MathTextProps) {
  const renderedSegments = useMemo(() => {
    if (!content) return null;

    // Tách khối code ```...``` trước
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textSlice = content.slice(lastIndex, match.index);
        segments.push(renderLatexAndInlineText(textSlice, `txt-${lastIndex}`));
      }

      const lang = match[1] || 'code';
      const codeBody = match[2];
      segments.push(
        <div
          key={`code-${match.index}`}
          className="my-2 overflow-hidden rounded-md border border-botanical-border bg-[#E6ECE2]/70 font-mono text-xs"
        >
          <div className="flex items-center justify-between border-b border-botanical-border bg-[#D8E6DF]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-botanical-chipText">
            <span>{lang}</span>
            <span>Syntax Block</span>
          </div>
          <pre className="overflow-x-auto p-3 leading-relaxed text-botanical-ink">
            <code>{codeBody}</code>
          </pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      segments.push(
        renderLatexAndInlineText(content.slice(lastIndex), `txt-end-${lastIndex}`)
      );
    }

    return segments;
  }, [content]);

  return (
    <div className={`leading-relaxed text-botanical-ink ${className}`}>
      {renderedSegments}
    </div>
  );
}

function renderLatexAndInlineText(rawText: string, keyPrefix: string): React.ReactNode {
  // Bắt cả $$...$$ (display mode) và $...$ (inline mode)
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  const parts = rawText.split(tokenRegex);

  return (
    <span key={keyPrefix} className="whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          const formula = part.slice(2, -2).trim();
          try {
            const html = katex.renderToString(formula, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <span
                key={`${keyPrefix}-blk-${idx}`}
                className="my-1.5 block overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return <code key={`${keyPrefix}-blk-${idx}`}>{part}</code>;
          }
        }

        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const formula = part.slice(1, -1).trim();
          try {
            const html = katex.renderToString(formula, {
              displayMode: false,
              throwOnError: false,
            });
            return (
              <span
                key={`${keyPrefix}-inl-${idx}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return <code key={`${keyPrefix}-inl-${idx}`}>{part}</code>;
          }
        }

        return <React.Fragment key={`${keyPrefix}-str-${idx}`}>{part}</React.Fragment>;
      })}
    </span>
  );
}
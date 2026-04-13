'use client';
import { useState, useMemo } from 'react';
import { BlockNoteEditor } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { cn } from '@/lib/utils';

interface Props {
  initialContent: string;
  editable?: boolean;
  onChange?: (markdown: string) => void;
  className?: string;
}

/**
 * Artifact editor using BlockNote.
 * Renders markdown as Notion-style blocks.
 * Supports toggle between visual and raw view.
 */
export function ArtifactEditor({ initialContent, editable = true, onChange, className }: Props) {
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(initialContent);

  const editor = useCreateBlockNote({
    initialContent: undefined,
  });

  // Load markdown content on mount
  useMemo(() => {
    if (editor && initialContent) {
      (async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
          editor.replaceBlocks(editor.document, blocks);
        } catch {
          // Fallback: just set as paragraph
        }
      })();
    }
  }, [editor, initialContent]);

  const handleRawToggle = async () => {
    if (rawMode) {
      // Switching from raw to visual — parse markdown
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(rawText);
        editor.replaceBlocks(editor.document, blocks);
      } catch {}
      setRawMode(false);
    } else {
      // Switching from visual to raw — export markdown
      const md = await editor.blocksToMarkdownLossy(editor.document);
      setRawText(md);
      setRawMode(true);
    }
  };

  const handleEditorChange = async () => {
    if (onChange && editor) {
      const md = await editor.blocksToMarkdownLossy(editor.document);
      onChange(md);
    }
  };

  const handleRawChange = (text: string) => {
    setRawText(text);
    onChange?.(text);
  };

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {rawMode ? 'Markdown' : 'Visual'}
        </span>
        <button
          onClick={handleRawToggle}
          className="px-2 py-0.5 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {rawMode ? 'Visual' : 'Codigo'}
        </button>
      </div>

      {/* Editor */}
      {rawMode ? (
        <textarea
          value={rawText}
          onChange={(e) => handleRawChange(e.target.value)}
          readOnly={!editable}
          className="w-full min-h-[300px] p-4 bg-background text-foreground text-xs font-mono resize-y focus:outline-none"
        />
      ) : (
        <div className="min-h-[300px] bg-background" data-theming-css-variables-demo>
          <BlockNoteView
            editor={editor}
            editable={editable}
            onChange={handleEditorChange}
            theme="dark"
          />
        </div>
      )}
    </div>
  );
}

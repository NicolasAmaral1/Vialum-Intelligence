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

  const [expanded, setExpanded] = useState(false);

  const editorContent = (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {rawMode ? 'Markdown' : 'Visual'}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={handleRawToggle}
            className="px-2 py-0.5 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {rawMode ? 'Visual' : 'Codigo'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-2 py-0.5 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? 'Fechar' : 'Expandir'}
          </button>
        </div>
      </div>

      {/* Editor */}
      {rawMode ? (
        <textarea
          value={rawText}
          onChange={(e) => handleRawChange(e.target.value)}
          readOnly={!editable}
          className={cn('w-full p-4 bg-background text-foreground text-xs font-mono resize-y focus:outline-none', expanded ? 'flex-1 min-h-0' : 'min-h-[350px]')}
        />
      ) : (
        <div className={cn('bg-background', expanded ? 'flex-1 min-h-0 overflow-y-auto' : 'min-h-[350px]')} data-theming-css-variables-demo>
          <BlockNoteView
            editor={editor}
            editable={editable}
            onChange={handleEditorChange}
            theme="dark"
          />
        </div>
      )}
    </>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8">
        <div className="w-full max-w-3xl h-full max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-background shadow-2xl flex flex-col">
          {editorContent}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      <div className="max-h-[400px] overflow-y-auto">
        {editorContent}
      </div>
    </div>
  );
}

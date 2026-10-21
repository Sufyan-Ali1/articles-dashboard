import { useEffect, useState } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link as LinkIcon,
  ImagePlus,
  Table2,
  Undo2,
  Redo2,
  Code,
  Minus,
  Unlink,
  Trash2,
  Columns3,
  Rows3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Field, Notice } from '@/components/shared';
import { cn } from '@/lib/utils';
import { safeUrl } from './validation';

export function unsupportedMarkup(html: string): boolean {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const supported = new Set([
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'blockquote',
    'pre',
    'code',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ]);
  return [...document.body.querySelectorAll('*')].some(
    (node) =>
      !supported.has(node.tagName.toLowerCase()) ||
      [...node.attributes].some(
        (attribute) =>
          ![
            'href',
            'target',
            'rel',
            'title',
            'src',
            'alt',
            'width',
            'height',
            'loading',
            'colspan',
            'rowspan',
            'class',
            'data-language',
          ].includes(attribute.name),
      ),
  );
}
export function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  id = 'article-content',
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  id?: string;
}) {
  const [source, setSource] = useState(() => unsupportedMarkup(value));
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [urlError, setUrlError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: false,
          isAllowedUri: (uri) => safeUrl(uri, true),
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: { default: null },
            height: { default: null },
            loading: { default: 'lazy' },
          };
        },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: 'Tell a story worth reading…' }),
    ],
    content: value,
    editable: !readOnly,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-label': 'Article content',
        'aria-multiline': 'true',
        class:
          'prose prose-slate dark:prose-invert max-w-none min-h-[420px] outline-none px-6 py-7 sm:px-9 break-words',
      },
    },
    onUpdate: ({ editor: updated }) => onChange(updated.getHTML()),
  });
  useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            from: current.state.selection.from,
            to: current.state.selection.to,
            active: [
              'bold',
              'italic',
              'underline',
              'strike',
              'bulletList',
              'orderedList',
              'blockquote',
              'code',
              'codeBlock',
              'table',
              'link',
            ].map((name) => current.isActive(name)),
            heading: current.getAttributes('heading').level,
            undo: current.can().undo(),
            redo: current.can().redo(),
          }
        : null,
  });
  useEffect(() => {
    if (editor && editor.getHTML() !== value)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  if (!editor) return <div className="min-h-96 animate-pulse bg-muted/20" />;
  const toolbar = [
    {
      label: 'Bold',
      icon: Bold,
      active: 'bold',
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: Italic,
      active: 'italic',
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Underline',
      icon: Underline,
      active: 'underline',
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: 'Strikethrough',
      icon: Strikethrough,
      active: 'strike',
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: 'Bullet list',
      icon: List,
      active: 'bulletList',
      action: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      active: 'orderedList',
      action: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Block quote',
      icon: Quote,
      active: 'blockquote',
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Inline code',
      icon: Code,
      active: 'code',
      action: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: 'Code block',
      icon: Code2,
      active: 'codeBlock',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {!readOnly && (
        <div
          className="flex flex-wrap items-center gap-0.5 border-b bg-muted/20 px-2 py-2"
          role="toolbar"
          aria-label="Text formatting"
        >
          <Select
            className="mr-2 h-8 w-28 border-0 bg-transparent text-xs shadow-none"
            aria-label="Text style"
            value={
              editor.isActive('heading')
                ? String(editor.getAttributes('heading').level)
                : 'paragraph'
            }
            disabled={source}
            onChange={(e) =>
              e.target.value === 'paragraph'
                ? editor.chain().focus().setParagraph().run()
                : editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 })
                    .run()
            }
          >
            <option value="paragraph">Paragraph</option>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <option key={level} value={level}>
                Heading {level}
              </option>
            ))}
          </Select>
          {toolbar.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="icon"
              className={cn('size-8', editor.isActive(item.active) && 'bg-primary/10 text-primary')}
              aria-label={item.label}
              aria-pressed={editor.isActive(item.active)}
              disabled={source}
              onClick={item.action}
            >
              <item.icon className="size-3.5" />
            </Button>
          ))}
          <span className="mx-1 h-5 border-l" />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Insert link"
            disabled={source}
            onClick={() => {
              setUrl(String(editor.getAttributes('link').href ?? ''));
              setUrlError('');
              setDialog('link');
            }}
          >
            <LinkIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Remove link"
            disabled={source || !editor.isActive('link')}
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Unlink />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Insert image"
            disabled={source}
            onClick={() => {
              setUrl('');
              setAlt('');
              setUrlError('');
              setDialog('image');
            }}
          >
            <ImagePlus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Insert table"
            disabled={source}
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Horizontal rule"
            disabled={source}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus />
          </Button>
          <span className="mx-1 h-5 border-l" />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Undo"
            disabled={source || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Redo"
            disabled={source || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('ml-auto', source && 'text-primary')}
            aria-pressed={source}
            onClick={() => {
              if (source && unsupportedMarkup(value)) return;
              setSource(!source);
            }}
          >
            HTML
          </Button>
        </div>
      )}
      {source ? (
        <div className="p-4">
          <Notice>
            HTML source mode preserves markup that the visual editor cannot safely round-trip.
            Preview before saving. The backend sanitizes saved HTML.
          </Notice>
          <Textarea
            id={id}
            aria-label="Article content HTML"
            className="mt-3 min-h-[420px] font-mono text-xs leading-6"
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
          />
          {unsupportedMarkup(value) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Keep source mode to preserve unsupported formatting.
            </p>
          )}
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
      {!source && editor.isActive('table') && !readOnly && (
        <div className="flex flex-wrap gap-1 border-t p-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            <Columns3 />
            Add column
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            <Rows3 />
            Add row
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            Delete column
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            Delete row
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            Toggle header
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 />
            Delete table
          </Button>
        </div>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={dialog === 'image' ? 'Insert image' : 'Insert link'}
        description="Use a safe HTTP(S) URL or root-relative path. Image uploads are not supported."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!safeUrl(url, true) || (dialog === 'image' && url.startsWith('#'))) {
              setUrlError('Enter an HTTP(S) URL or a root-relative path.');
              return;
            }
            if (dialog === 'image') editor.chain().focus().setImage({ src: url, alt }).run();
            else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            setDialog(null);
          }}
        >
          <Field label="URL" htmlFor="insert-url" error={urlError}>
            <Input
              autoFocus
              id="insert-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              maxLength={2048}
            />
          </Field>
          {dialog === 'image' && (
            <Field
              label="Alt text"
              htmlFor="insert-alt"
              hint="Describe the image for readers using assistive technology."
            >
              <Input
                id="insert-alt"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                maxLength={300}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit">Insert {dialog}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

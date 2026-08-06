import React, { useCallback, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  Link2,
  Table,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { applyEdit, TABLE_SKELETON, type EditAction } from "./markdown-insert";
import { cn } from "@/lib/utils";
import { api } from "@/lib/mvp3-api";

/** Where a pasted image is filed. Omit to disable image upload entirely. */
export type UploadTarget = {
  linkedObjectType: "document" | "meeting" | "project";
  linkedObjectId: number;
};

type ToolItem = {
  icon: LucideIcon;
  label: string;
  action: EditAction;
  /** Rendered in the tooltip; also wired up in onKeyDown. */
  shortcut?: string;
};

type ToolGroup = ToolItem[];

/**
 * Checklists are a first-class button, not buried: the event-prep and
 * recruitment checklists that Ops v3 §6 asks for are all `- [ ]` syntax. If it
 * is hard to reach, the checklist document feature goes unused.
 */
const GROUPS: ToolGroup[] = [
  [
    { icon: Bold, label: "굵게", shortcut: "⌘B", action: { kind: "wrap", before: "**", after: "**", placeholder: "굵게" } },
    { icon: Italic, label: "기울임", shortcut: "⌘I", action: { kind: "wrap", before: "_", after: "_", placeholder: "기울임" } },
    { icon: Strikethrough, label: "취소선", action: { kind: "wrap", before: "~~", after: "~~", placeholder: "취소선" } },
    { icon: Code, label: "코드", shortcut: "⌘E", action: { kind: "wrap", before: "`", after: "`", placeholder: "코드" } },
  ],
  [
    { icon: Heading2, label: "제목 2", action: { kind: "linePrefix", prefix: "## ", placeholder: "제목" } },
    { icon: Heading3, label: "제목 3", action: { kind: "linePrefix", prefix: "### ", placeholder: "제목" } },
    { icon: Quote, label: "인용", action: { kind: "linePrefix", prefix: "> ", placeholder: "인용" } },
    { icon: Minus, label: "구분선", action: { kind: "block", text: "---" } },
  ],
  [
    { icon: List, label: "목록", action: { kind: "linePrefix", prefix: "- ", placeholder: "항목" } },
    { icon: ListOrdered, label: "번호 목록", action: { kind: "orderedList", placeholder: "항목" } },
    { icon: ListChecks, label: "체크리스트", action: { kind: "linePrefix", prefix: "- [ ] ", placeholder: "할 일" } },
  ],
  [
    { icon: Link2, label: "링크", shortcut: "⌘K", action: { kind: "wrap", before: "[", after: "](url)", placeholder: "링크 텍스트" } },
    { icon: Table, label: "표", action: { kind: "block", text: TABLE_SKELETON } },
  ],
];

export function MarkdownEditor({
  value,
  onChange,
  rows = 14,
  placeholder,
  className,
  /** Off when the surrounding layout already shows a side-by-side preview. */
  showPreviewToggle = true,
  uploadTarget,
  "data-testid": testId,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  showPreviewToggle?: boolean;
  uploadTarget?: UploadTarget;
  "data-testid"?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const run = useCallback(
    (action: EditAction) => {
      const el = ref.current;
      if (!el) return;
      const result = applyEdit(value, el.selectionStart, el.selectionEnd, action);
      onChange(result.value);
      // Restore selection after React commits the new value.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [value, onChange],
  );

  /**
   * Upload a pasted/dropped image and insert a markdown reference.
   * Files land in `attachments` with a PRIVATE ACL, so the inserted URL is the
   * authenticated download route — never a public storage path.
   */
  const uploadImage = useCallback(
    async (file: File) => {
      if (!uploadTarget) return;
      setUploading(true);
      setUploadError(null);
      try {
        const { uploadUrl } = await api<{ uploadUrl: string }>(
          "/admin/attachments/upload-url",
          { method: "POST" },
        );
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`업로드 실패 (${put.status})`);

        const objectPath = new URL(uploadUrl).pathname;
        const row = await api<{ id: number; fileName: string }>(
          "/admin/attachments",
          {
            method: "POST",
            body: {
              objectPath,
              fileName: file.name || "image.png",
              mimeType: file.type || null,
              sizeBytes: file.size,
              ...uploadTarget,
            },
          },
        );
        run({
          kind: "wrap",
          before: `![${row.fileName}](/api/attachments/${row.id}/download`,
          after: ")",
          placeholder: "",
        });
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.",
        );
      } finally {
        setUploading(false);
      }
    },
    [uploadTarget, run],
  );

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!uploadTarget) return;
    const file = Array.from(e.clipboardData.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return;
    e.preventDefault();
    void uploadImage(file);
  };

  const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (!uploadTarget) return;
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return;
    e.preventDefault();
    void uploadImage(file);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    const map: Record<string, EditAction | undefined> = {
      b: { kind: "wrap", before: "**", after: "**", placeholder: "굵게" },
      i: { kind: "wrap", before: "_", after: "_", placeholder: "기울임" },
      e: { kind: "wrap", before: "`", after: "`", placeholder: "코드" },
      k: { kind: "wrap", before: "[", after: "](url)", placeholder: "링크 텍스트" },
    };
    const action = map[key];
    if (!action) return;
    e.preventDefault();
    run(action);
  };

  return (
    <div className={cn("rounded border border-border", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-1 h-4 w-px bg-border" aria-hidden />}
            {group.map((t) => (
              <Button
                key={t.label}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
                aria-label={t.label}
                disabled={tab === "preview"}
                onClick={() => run(t.action)}
              >
                <t.icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        ))}

        {uploadTarget && (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <span className="text-[11px] text-muted-foreground">
              {uploading ? "이미지 업로드 중…" : "이미지 붙여넣기 가능"}
            </span>
          </>
        )}

        {showPreviewToggle && (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            className="ml-auto"
          >
            <TabsList className="h-7">
              <TabsTrigger value="write" className="h-6 px-2 text-xs">
                작성
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-6 px-2 text-xs">
                미리보기
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {tab === "write" || !showPreviewToggle ? (
        <Textarea
          ref={ref}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onDrop={onDrop}
          data-testid={testId}
          className="border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none p-3">
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-sm text-muted-foreground">내용이 없습니다.</p>
          )}
        </div>
      )}
      {uploadError && (
        <p className="border-t border-border px-3 py-1.5 text-xs text-destructive">
          {uploadError}
        </p>
      )}
    </div>
  );
}

/** Read-only render. Replaces ad-hoc <ReactMarkdown> usages. */
export function MarkdownView({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  if (!source.trim()) {
    return <p className="text-sm text-muted-foreground">내용이 없습니다.</p>;
  }
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown>{source}</ReactMarkdown>
    </div>
  );
}

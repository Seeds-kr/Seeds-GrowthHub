import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminSiteContents, saveSiteContent, type SiteContentRow } from "@/lib/site-content";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

const PREVIEW_PATH: Record<string, string> = {
  "page.home": "/",
  "page.recruit": "/recruit",
  "page.about": "/about",
  "page.program": "/program",
  "page.faq": "/faq",
};

export default function AdminSiteContent() {
  const { data, isLoading, refetch } = useAdminSiteContents();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const items: SiteContentRow[] = data?.items ?? [];
  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? null,
    [items, selectedKey],
  );

  useEffect(() => {
    if (!selectedKey && items.length > 0) {
      setSelectedKey(items[0].key);
    }
  }, [items, selectedKey]);

  useEffect(() => {
    if (selected) {
      setDraft(JSON.stringify(selected.value ?? {}, null, 2));
      setParseError(null);
    }
  }, [selected?.key]);

  function onDraftChange(v: string) {
    setDraft(v);
    try {
      JSON.parse(v);
      setParseError(null);
    } catch (e: any) {
      setParseError(e?.message ?? "Invalid JSON");
    }
  }

  async function onSave() {
    if (!selected) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e: any) {
      toast({ title: "JSON 형식 오류", description: e?.message ?? "JSON을 확인해주세요.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveSiteContent(selected.key, parsed);
      toast({ title: "저장되었습니다" });
      await Promise.all([
        refetch(),
        qc.invalidateQueries({ queryKey: ["site-content", selected.key] }),
      ]);
    } catch (e: any) {
      toast({ title: "저장 실패", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    if (!selected) return;
    setDraft(JSON.stringify(selected.value ?? {}, null, 2));
    setParseError(null);
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold">홈페이지 콘텐츠</h1>
          <p className="text-sm text-muted-foreground mt-1">
            공개 페이지(홈/소개/프로그램/FAQ)의 텍스트를 직접 수정합니다. 저장 즉시 모든 방문자에게 반영됩니다.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            <aside className="border border-border bg-card">
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setSelectedKey(it.key)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 ${
                    selectedKey === it.key ? "bg-muted font-semibold" : ""
                  }`}
                >
                  <div className="text-sm">{it.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {it.updatedAt
                      ? `최근 수정: ${new Date(it.updatedAt).toLocaleString("ko-KR")}`
                      : "기본값"}
                  </div>
                </button>
              ))}
            </aside>

            <section className="border border-border bg-card p-6 space-y-4">
              {selected ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">{selected.label}</h2>
                      <code className="text-xs text-muted-foreground">{selected.key}</code>
                    </div>
                    {PREVIEW_PATH[selected.key] && (
                      <Link href={PREVIEW_PATH[selected.key]}>
                        <Button variant="outline" size="sm" className="">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          미리보기
                        </Button>
                      </Link>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/30 border border-border p-3">
                    JSON 구조를 그대로 유지하면서 값(따옴표 안의 텍스트)만 수정하세요. 새 항목을 배열에 추가하거나 삭제해도 됩니다. 저장 전에 JSON 형식이 올바른지 자동으로 검사됩니다.
                  </div>
                  <Textarea
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    className="font-mono text-xs min-h-[480px]"
                    spellCheck={false}
                  />
                  {parseError && (
                    <div className="text-sm text-destructive border border-destructive/40 bg-destructive/5 p-3">
                      JSON 오류: {parseError}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={onSave}
                      disabled={saving || !!parseError}
                      className=""
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      저장
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onReset}
                      disabled={saving}
                      className=""
                    >
                      변경 취소
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">왼쪽에서 페이지를 선택하세요.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

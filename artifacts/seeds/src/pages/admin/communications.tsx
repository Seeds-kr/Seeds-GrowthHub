import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/mvp3-api";
import { formatKoreanDateTime } from "@/lib/admin-labels";

type Row = {
  id: number;
  channel: string;
  status: string;
  templateId: string | null;
  subject: string | null;
  recipientType: string | null;
  recipientAddress: string | null;
  relatedObjectType: string | null;
  relatedObjectId: number | null;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
  createdByName: string | null;
};
type Resp = {
  items: Row[];
  total: number;
  page: number;
  totalPages: number;
  summary: Record<string, number>;
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "이메일",
  sms: "문자",
  discord: "디스코드",
  manual: "수동 기록",
};
const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  sent: "발송됨",
  failed: "실패",
  bounced: "반송",
};
const STATUS_STYLE: Record<string, string> = {
  queued: "text-muted-foreground",
  sent: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  failed: "border-destructive text-destructive",
  bounced: "border-amber-500 text-amber-700 dark:text-amber-400",
};

const ALL = "__all__";

/**
 * 발송 이력 (설계 00 §3.2).
 *
 * 읽기 전용이다. 일어난 일의 기록이라 고칠 것이 아니고, 재발송은 새 발송이지
 * 기존 행의 수정이 아니다.
 *
 * 이 화면을 여는 이유는 대개 "뭐가 안 갔지"라서, 실패·반송 건수를 맨 위에
 * 먼저 세워 두고 한 번에 그 필터로 갈 수 있게 했다.
 */
export default function AdminCommunications() {
  const [channel, setChannel] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-communications", channel, status, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (channel !== ALL) qs.set("channel", channel);
      if (status !== ALL) qs.set("status", status);
      return api<Resp>(`/admin/communications?${qs.toString()}`);
    },
  });

  const failed = (data?.summary.failed ?? 0) + (data?.summary.bounced ?? 0);

  return (
    <>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold">
          <Send className="h-7 w-7 text-primary" />
          발송 이력
        </h1>
        <p className="text-sm text-muted-foreground">
          시스템이 내보낸 알림·안내의 기록입니다. 읽기 전용이며, 다시 보내는 것은
          각 화면에서 합니다.
        </p>
      </div>

      {failed > 0 && (
        <button
          type="button"
          onClick={() => {
            setStatus("failed");
            setPage(1);
          }}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-left text-sm"
          data-testid="comms-failure-banner"
        >
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>
            실패·반송 <strong>{failed}건</strong>이 있습니다. 눌러서 확인하세요.
          </span>
        </button>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select
          value={channel}
          onValueChange={(v) => {
            setChannel(v);
            setPage(1); // 3페이지에서 좁히면 빈 화면이 된다
          }}
        >
          <SelectTrigger className="h-8 w-40" data-testid="filter-channel">
            <SelectValue placeholder="채널" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>채널 전체</SelectItem>
            {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-40" data-testid="filter-status">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>상태 전체</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(channel !== ALL || status !== ALL) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setChannel(ALL);
              setStatus(ALL);
              setPage(1);
            }}
          >
            필터 지우기
          </Button>
        )}
        {data && (
          <span className="ml-auto text-xs text-muted-foreground">
            {data.total}건
          </span>
        )}
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {channel !== ALL || status !== ALL
            ? "조건에 맞는 기록이 없습니다."
            : "아직 발송된 것이 없습니다. 알림을 보내면 여기에 남습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">보낸 때</th>
                <th className="px-3 py-2 text-left">채널</th>
                <th className="px-3 py-2 text-left">내용</th>
                <th className="px-3 py-2 text-left">받는 곳</th>
                <th className="px-3 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="border-t" data-testid={`comm-${r.id}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatKoreanDateTime(r.sentAt ?? r.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{CHANNEL_LABEL[r.channel] ?? r.channel}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.subject ?? r.templateId ?? "—"}</div>
                    {r.relatedObjectType && (
                      <div className="text-xs text-muted-foreground">
                        {r.relatedObjectType} #{r.relatedObjectId}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.recipientAddress ?? r.recipientType ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={STATUS_STYLE[r.status]}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {/* 실패 이유는 목록에서 바로 보여야 한다. 이걸 보려고
                        상세를 또 열게 만들면 아무도 안 본다. */}
                    {r.failureReason && (
                      <div className="mt-0.5 text-xs text-destructive">{r.failureReason}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </>
  );
}

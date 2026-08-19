import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/mvp3-api";

/**
 * 프로필 사진 입력.
 *
 * 두 가지 길을 한 칸에 둔다 — **파일 올리기**(대부분)와 **주소 붙여넣기**(이미
 * 깃허브·노션 등에 사진이 있는 사람). 주소 칸을 늘 펼쳐 두면 올리기가 기본이라는
 * 게 흐려지므로 접어 둔다.
 *
 * 업로드는 폼 저장과 **따로** 즉시 반영된다. 사진은 서버가 경로를 정하고
 * 돌려주는 값이라 폼 상태에 담아 두었다가 함께 보내는 모양이 안 된다. 대신
 * 성공하면 부모에게 새 주소를 알려 화면이 곧바로 바뀐다.
 */
export function PhotoField({
  value,
  name,
  uploadPath,
  onChange,
  disabled,
}: {
  value: string;
  /** 사진이 없을 때 보여줄 이름 첫 글자. */
  name?: string;
  /** `POST` 로 바이트를 받고 `DELETE` 로 지우는 경로. */
  uploadPath: string;
  onChange: (photoUrl: string) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const initial = (name ?? "").trim().slice(0, 1) || "?";

  async function upload(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("이미지 파일만 올릴 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("사진이 너무 큽니다. 5MB 이하만 올릴 수 있습니다.");
      return;
    }
    setBusy(true);
    try {
      // 원시 바이트를 그대로 보낸다. `Content-Type` 이 곧 형식이라 서버가
      // 파서를 하나 더 들일 이유가 없다(routes/profile-photo.ts).
      const row = await api<{ photoUrl: string | null }>(uploadPath, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type },
      });
      onChange(row.photoUrl ?? "");
    } catch (e: any) {
      setErr(e?.data?.error ?? e?.message ?? "올리지 못했습니다.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clear() {
    setErr(null);
    setBusy(true);
    try {
      await api(uploadPath, { method: "DELETE" });
      onChange("");
    } catch (e: any) {
      setErr(e?.data?.error ?? e?.message ?? "지우지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label className="text-xs">프로필 사진</Label>
      <div className="mt-1.5 flex items-start gap-3">
        {/* 미리보기. 사진이 깨지거나 없으면 이름 첫 글자를 대신 보여준다 —
            빈 네모만 있으면 안 올린 건지 못 불러온 건지 알 수 없다. */}
        {value ? (
          <img
            src={value}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xl font-semibold text-muted-foreground"
          >
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
              data-testid="button-photo-upload"
            >
              {busy ? "처리 중…" : value ? "사진 바꾸기" : "사진 올리기"}
            </Button>
            {value ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || busy}
                onClick={() => void clear()}
                data-testid="button-photo-clear"
              >
                지우기
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setShowUrl((v) => !v)}
            >
              {showUrl ? "주소 입력 닫기" : "주소로 넣기"}
            </Button>
          </div>

          {showUrl ? (
            <Input
              placeholder="https://..."
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              data-testid="input-photo-url"
            />
          ) : null}

          <p className="text-xs text-muted-foreground">
            PNG · JPEG · GIF · WebP, 5MB 이하. 올린 사진은 공개 사람들 목록에
            그대로 보입니다.
          </p>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}

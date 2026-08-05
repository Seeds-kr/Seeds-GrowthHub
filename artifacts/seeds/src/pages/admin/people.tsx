import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  PEOPLE_KINDS,
  PEOPLE_KIND_LABEL,
  type PeopleKind,
  type PeopleProfile,
} from "@/lib/mvp3-api";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type FormState = {
  kind: PeopleKind;
  name: string;
  roleTitle: string;
  affiliation: string;
  bio: string;
  photoUrl: string;
  phone: string;
  tagsCsv: string;
  displayOrder: number;
  isPublic: boolean;
};

const blank = (kind: PeopleKind): FormState => ({
  kind,
  name: "",
  roleTitle: "",
  affiliation: "",
  bio: "",
  photoUrl: "",
  phone: "",
  tagsCsv: "",
  displayOrder: 0,
  isPublic: false,
});

export default function AdminPeople() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<PeopleKind>("mentor");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PeopleProfile | null>(null);
  const [form, setForm] = useState<FormState>(blank("mentor"));

  const { data, isLoading } = useQuery({
    queryKey: ["admin-people", kind],
    queryFn: () =>
      api<{ items: PeopleProfile[] }>(`/admin/people?kind=${kind}`),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        kind: form.kind,
        name: form.name.trim(),
        roleTitle: form.roleTitle.trim() || null,
        affiliation: form.affiliation.trim() || null,
        bio: form.bio.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        phone: form.phone.trim() || null,
        tags: form.tagsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        displayOrder: Number.isFinite(form.displayOrder) ? form.displayOrder : 0,
        isPublic: form.isPublic,
      };
      return editing
        ? api(`/admin/people/${editing.id}`, { method: "PATCH", body: payload })
        : api(`/admin/people`, { method: "POST", body: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-people"] });
      setOpen(false);
      setEditing(null);
      toast({ title: "저장됨" });
    },
    onError: (e: any) =>
      toast({
        title: "실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      api(`/admin/people/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-people"] }),
  });

  const togglePublic = useMutation({
    mutationFn: ({ id, isPublic }: { id: number; isPublic: boolean }) =>
      api(`/admin/people/${id}`, { method: "PATCH", body: { isPublic } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-people"] }),
  });

  const [avatarTarget, setAvatarTarget] = useState<PeopleProfile | null>(null);

  // 프로필과 로그인 계정은 별개다. 계정이 없으면 프로젝트 배정도 로그인도 안 되는데,
  // 그동안 화면 두 개(/admin/users → /admin/people)를 오가야 했다.
  const [accountTarget, setAccountTarget] = useState<PeopleProfile | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [activation, setActivation] = useState<{ name: string; path: string } | null>(null);

  const createAccount = useMutation({
    mutationFn: (vars: { id: number; email: string }) =>
      api<{ activationPath: string }>(`/admin/people/${vars.id}/create-account`, {
        method: "POST",
        body: { email: vars.email },
      }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-people"] });
      // 비밀번호는 본인이 정한다. 관리자에게는 전달할 링크만 준다.
      setActivation({
        name: accountTarget?.name ?? "",
        path: res.activationPath,
      });
      setAccountTarget(null);
      setAccountEmail("");
      void vars;
    },
    onError: (e: any) =>
      toast({
        title: "계정 생성 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const generateAvatar = useMutation({
    mutationFn: (vars: { id: number; body: Record<string, unknown> }) =>
      api<PeopleProfile>(`/admin/people/${vars.id}/generate-avatar`, {
        method: "POST",
        body: vars.body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-people"] });
      setAvatarTarget(null);
      toast({ title: "AI 아바타 생성 완료" });
    },
    onError: (e: any) =>
      toast({
        title: "아바타 생성 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  function openCreate() {
    setEditing(null);
    setForm(blank(kind));
    setOpen(true);
  }
  function openEdit(p: PeopleProfile) {
    setEditing(p);
    setForm({
      kind: p.kind,
      name: p.name,
      roleTitle: p.roleTitle ?? "",
      affiliation: p.affiliation ?? "",
      bio: p.bio ?? "",
      photoUrl: p.photoUrl ?? "",
      phone: p.phone ?? "",
      tagsCsv: p.tags.join(", "),
      displayOrder: p.displayOrder,
      isPublic: p.isPublic,
    });
    setOpen(true);
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">사람들</h1>
        <Button className="" onClick={openCreate}>
          + 새 항목 ({PEOPLE_KIND_LABEL[kind]})
        </Button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-border">
        {PEOPLE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              k === kind
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {PEOPLE_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">순서</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>직함</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>태그</TableHead>
              <TableHead className="w-24">공개</TableHead>
              <TableHead className="w-40"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  항목이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {p.displayOrder}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.name}
                    {/* 프로필과 로그인 계정은 별개다. mentor-seed.ts가 넣는
                        멘토 프로필은 userId가 비어 있어, 여기서는 멘토가
                        보이는데 정작 프로젝트에 배정할 수도 로그인할 수도 없다.
                        그 상태가 화면 어디에도 드러나지 않아 원인을 찾기 어려웠다. */}
                    {p.userId == null && p.kind !== "member" ? (
                      <button
                        type="button"
                        onClick={() => setAccountTarget(p)}
                        className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                        title="로그인 계정이 없어 프로젝트 배정·로그인이 불가합니다. 눌러서 계정을 만들고 연결합니다."
                        data-testid={`btn-create-account-${p.id}`}
                      >
                        계정 미연결 · 만들기
                      </button>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.roleTitle ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.affiliation ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.tags.length > 0 ? p.tags.join(", ") : "-"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.isPublic}
                      onCheckedChange={(v) =>
                        togglePublic.mutate({ id: p.id, isPublic: v })
                      }
                    />
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className=""
                      onClick={() => openEdit(p)}
                    >
                      수정
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className=""
                      onClick={() => setAvatarTarget(p)}
                      title="AI 캐릭터 아바타 생성 (Gemini)"
                    >
                      AI 아바타
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className=""
                      onClick={() => {
                        if (confirm("삭제?")) del.mutate(p.id);
                      }}
                    >
                      삭제
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "프로필 수정" : "새 프로필"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">분류</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm({ ...form, kind: v as PeopleKind })
                }
              >
                <SelectTrigger className="">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PEOPLE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {PEOPLE_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">이름</Label>
              <Input
                className=""
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">직함 / 직책</Label>
                <Input
                  className=""
                  placeholder="예: 시니어 엔지니어, 3기 학생"
                  value={form.roleTitle}
                  onChange={(e) =>
                    setForm({ ...form, roleTitle: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">소속</Label>
                <Input
                  className=""
                  placeholder="예: ABC회사, OO대학교"
                  value={form.affiliation}
                  onChange={(e) =>
                    setForm({ ...form, affiliation: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">사진 URL</Label>
              <Input
                className=""
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) =>
                  setForm({ ...form, photoUrl: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">전화번호 (로그인 회원에게만 표시)</Label>
              <Input
                className=""
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">소개</Label>
              <Textarea
                className="min-h-[120px]"
                maxLength={5000}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">태그 (쉼표로 구분)</Label>
              <Input
                className=""
                placeholder="예: 백엔드, 디자인, 창업"
                value={form.tagsCsv}
                onChange={(e) =>
                  setForm({ ...form, tagsCsv: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">표시 순서 (작을수록 먼저)</Label>
                <Input
                  type="number"
                  className=""
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      displayOrder: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
                />
                <Label className="text-sm">공개</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className=""
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              className=""
              disabled={!form.name || save.isPending}
              onClick={() => save.mutate()}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvatarDialog
        target={avatarTarget}
        onClose={() => setAvatarTarget(null)}
        isPending={generateAvatar.isPending}
        onGenerate={(body) =>
          avatarTarget &&
          generateAvatar.mutate({ id: avatarTarget.id, body })
        }
      />

      {/* 계정 생성 — 비밀번호를 관리자가 정하지 않는다. 비활성 계정 + 활성화
          링크로 만들고 본인이 첫 로그인 때 정한다(학생 전환과 같은 방식). */}
      <Dialog
        open={accountTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAccountTarget(null);
            setAccountEmail("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{accountTarget?.name} — 로그인 계정 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              프로필만으로는 프로젝트에 배정하거나 로그인할 수 없습니다. 계정을
              만들면 이 프로필에 자동으로 연결됩니다.
            </p>
            <div>
              <Label htmlFor="acct-email">이메일 *</Label>
              <Input
                id="acct-email"
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="mentor@example.com"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              비밀번호는 설정하지 않습니다. 계정은 비활성 상태로 만들어지고 본인이
              활성화 링크로 직접 정합니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountTarget(null)}>
              취소
            </Button>
            <Button
              disabled={!accountEmail.trim() || createAccount.isPending}
              onClick={() =>
                accountTarget &&
                createAccount.mutate({
                  id: accountTarget.id,
                  email: accountEmail.trim(),
                })
              }
              data-testid="btn-confirm-create-account"
            >
              {createAccount.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : null}
              계정 만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 활성화 링크는 지금만 보인다 — 서버는 해시만 저장한다. */}
      <Dialog
        open={activation !== null}
        onOpenChange={(o) => !o && setActivation(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정이 생성되었습니다</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{activation?.name}</strong> 님에게 아래 활성화 링크를
              전달하세요. 본인이 비밀번호를 정하면 로그인과 프로젝트 배정이
              가능해집니다.
            </p>
            <code className="block break-all rounded bg-muted p-3 text-xs">
              {typeof window !== "undefined" ? window.location.origin : ""}
              {activation?.path}
            </code>
            <p className="text-xs text-muted-foreground">
              이 링크는 <strong>지금만 확인할 수 있습니다.</strong> 서버는 해시만
              저장하므로 창을 닫으면 다시 볼 수 없고, 필요하면 사용자 화면에서
              다시 발급해야 합니다.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const url =
                  (typeof window !== "undefined" ? window.location.origin : "") +
                  (activation?.path ?? "");
                navigator.clipboard?.writeText(url).then(
                  () => toast({ title: "링크를 복사했습니다." }),
                  () => toast({ title: "복사 실패", variant: "destructive" }),
                );
              }}
            >
              링크 복사
            </Button>
            <Button onClick={() => setActivation(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// ---------- AI avatar dialog ----------

type AvatarFormState = {
  gender: "" | "male" | "female" | "androgynous";
  hairLength: "" | "short" | "medium" | "long";
  hairStyle: "" | "straight" | "wavy" | "curly";
  hairColor: "" | "black" | "dark_brown" | "brown";
  glasses: "" | "none" | "round" | "rectangular";
  top:
    | ""
    | "mint_hoodie"
    | "white_tee"
    | "grey_sweater"
    | "navy_jacket"
    | "black_turtleneck"
    | "mint_tee";
  expression: "" | "smile" | "calm" | "confident";
  notes: string;
  refImage: { base64: string; mimeType: string; name: string } | null;
};

const AVATAR_BLANK: AvatarFormState = {
  gender: "",
  hairLength: "",
  hairStyle: "",
  hairColor: "",
  glasses: "",
  top: "",
  expression: "",
  notes: "",
  refImage: null,
};

const SELECT_AUTO = "__auto__";

function AvatarSelect<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: "" | V;
  options: { value: V; label: string }[];
  onChange: (v: "" | V) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select
        value={value === "" ? SELECT_AUTO : value}
        onValueChange={(v) =>
          onChange(v === SELECT_AUTO ? "" : (v as V))
        }
      >
        <SelectTrigger className="">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_AUTO}>자동 (이름 기반)</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AvatarDialog({
  target,
  onClose,
  isPending,
  onGenerate,
}: {
  target: PeopleProfile | null;
  onClose: () => void;
  isPending: boolean;
  onGenerate: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<AvatarFormState>(AVATAR_BLANK);
  const [refErr, setRefErr] = useState<string | null>(null);

  // Reset form when target changes.
  const lastTargetId = target?.id ?? null;
  if (lastTargetId !== null && form === AVATAR_BLANK) {
    // no-op; React-friendly reset done in onOpenChange below
  }

  function handleFile(file: File | null) {
    setRefErr(null);
    if (!file) {
      setForm((f) => ({ ...f, refImage: null }));
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setRefErr("JPEG / PNG / WebP 만 지원합니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setRefErr("이미지는 5MB 이하여야 합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      setForm((f) => ({
        ...f,
        refImage: { base64, mimeType: file.type, name: file.name },
      }));
    };
    reader.onerror = () => setRefErr("파일을 읽지 못했습니다.");
    reader.readAsDataURL(file);
  }

  function submit() {
    const body: Record<string, unknown> = {};
    if (form.gender) body.gender = form.gender;
    if (form.hairLength) body.hairLength = form.hairLength;
    if (form.hairStyle) body.hairStyle = form.hairStyle;
    if (form.hairColor) body.hairColor = form.hairColor;
    if (form.glasses) body.glasses = form.glasses;
    if (form.top) body.top = form.top;
    if (form.expression) body.expression = form.expression;
    const notes = form.notes.trim();
    if (notes) body.notes = notes;
    if (form.refImage) {
      body.referenceImage = {
        base64: form.refImage.base64,
        mimeType: form.refImage.mimeType,
      };
    }
    onGenerate(body);
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setForm(AVATAR_BLANK);
          setRefErr(null);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            AI 아바타 생성{target ? ` — ${target.name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Apple Memoji 스타일의 3D 캐릭터 아바타를 생성합니다. 각 항목을
            비워두면 이름을 기반으로 자동 선택됩니다.
            {target?.photoUrl
              ? " 기존 아바타는 새 아바타로 교체됩니다."
              : ""}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <AvatarSelect
              label="성별"
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v })}
              options={[
                { value: "male", label: "남성" },
                { value: "female", label: "여성" },
                { value: "androgynous", label: "중성적" },
              ]}
            />
            <AvatarSelect
              label="머리 길이"
              value={form.hairLength}
              onChange={(v) => setForm({ ...form, hairLength: v })}
              options={[
                { value: "short", label: "짧음" },
                { value: "medium", label: "중간" },
                { value: "long", label: "김" },
              ]}
            />
            <AvatarSelect
              label="머리 스타일"
              value={form.hairStyle}
              onChange={(v) => setForm({ ...form, hairStyle: v })}
              options={[
                { value: "straight", label: "생머리" },
                { value: "wavy", label: "웨이브" },
                { value: "curly", label: "곱슬" },
              ]}
            />
            <AvatarSelect
              label="머리 색상"
              value={form.hairColor}
              onChange={(v) => setForm({ ...form, hairColor: v })}
              options={[
                { value: "black", label: "검정" },
                { value: "dark_brown", label: "흑갈색" },
                { value: "brown", label: "갈색" },
              ]}
            />
            <AvatarSelect
              label="안경"
              value={form.glasses}
              onChange={(v) => setForm({ ...form, glasses: v })}
              options={[
                { value: "none", label: "없음" },
                { value: "round", label: "둥근 테" },
                { value: "rectangular", label: "사각 테" },
              ]}
            />
            <AvatarSelect
              label="표정"
              value={form.expression}
              onChange={(v) => setForm({ ...form, expression: v })}
              options={[
                { value: "smile", label: "따뜻한 미소" },
                { value: "confident", label: "차분한 미소" },
                { value: "calm", label: "평온함" },
              ]}
            />
            <div className="col-span-2">
              <AvatarSelect
                label="상의"
                value={form.top}
                onChange={(v) => setForm({ ...form, top: v })}
                options={[
                  { value: "mint_hoodie", label: "민트 후드티" },
                  { value: "white_tee", label: "흰 티셔츠" },
                  { value: "grey_sweater", label: "회색 스웨터" },
                  { value: "navy_jacket", label: "네이비 집업" },
                  { value: "black_turtleneck", label: "검정 터틀넥" },
                  { value: "mint_tee", label: "민트 티셔츠" },
                ]}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">추가 지시사항 (선택, 한/영 모두 가능)</Label>
            <Input
              className=""
              maxLength={300}
              placeholder="예: 수염 있음, 모자 착용, 친근한 인상"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">참고 이미지 (선택)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className=""
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              얼굴 형태·머리 길이·안경 여부 등을 참고용으로만 사용합니다.
              실제 인물을 닮은 사진은 생성되지 않으며, 원본 사진은 저장되지
              않습니다 (단체사진도 사용 가능 — 중앙 인물만 참고).
            </p>
            {form.refImage ? (
              <p className="text-[11px] text-foreground mt-1">
                선택됨: {form.refImage.name}
              </p>
            ) : null}
            {refErr ? (
              <p className="text-[11px] text-destructive mt-1">{refErr}</p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className=""
            onClick={onClose}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            className=""
            disabled={isPending}
            onClick={submit}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

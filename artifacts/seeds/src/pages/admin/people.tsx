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
        <Button className="rounded-none" onClick={openCreate}>
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

      <div className="bg-card border border-border">
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
                  <TableCell className="font-medium">{p.name}</TableCell>
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
                      className="rounded-none"
                      onClick={() => openEdit(p)}
                    >
                      수정
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none"
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
        <DialogContent className="rounded-none max-w-2xl">
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
                <SelectTrigger className="rounded-none">
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
                className="rounded-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">직함 / 직책</Label>
                <Input
                  className="rounded-none"
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
                  className="rounded-none"
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
                className="rounded-none"
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) =>
                  setForm({ ...form, photoUrl: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs">소개</Label>
              <Textarea
                className="rounded-none min-h-[120px]"
                maxLength={5000}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">태그 (쉼표로 구분)</Label>
              <Input
                className="rounded-none"
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
                  className="rounded-none"
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
              className="rounded-none"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              className="rounded-none"
              disabled={!form.name || save.isPending}
              onClick={() => save.mutate()}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

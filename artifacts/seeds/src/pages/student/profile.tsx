import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PeopleProfile } from "@/lib/mvp3-api";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhotoField } from "@/components/PhotoField";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

export default function StudentProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["student-profile"],
    queryFn: () => api<PeopleProfile>("/student/profile"),
  });

  const [form, setForm] = useState({
    name: "",
    roleTitle: "",
    affiliation: "",
    bio: "",
    photoUrl: "",
    tagsCsv: "",
    isPublic: false,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      roleTitle: data.roleTitle ?? "",
      affiliation: data.affiliation ?? "",
      bio: data.bio ?? "",
      photoUrl: data.photoUrl ?? "",
      tagsCsv: data.tags.join(", "),
      isPublic: data.isPublic,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api<PeopleProfile>("/student/profile", {
        method: "PATCH",
        body: {
          name: form.name.trim(),
          roleTitle: form.roleTitle.trim() || null,
          affiliation: form.affiliation.trim() || null,
          bio: form.bio.trim() || null,
          photoUrl: form.photoUrl.trim() || null,
          tags: form.tagsCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isPublic: form.isPublic,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-profile"] });
      qc.invalidateQueries({ queryKey: ["public-people", "member"] });
      toast({ title: "저장됨" });
    },
    onError: (e: any) =>
      toast({
        title: "실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-serif font-bold mb-2">내 공개 프로필</h1>
        <p className="text-sm text-muted-foreground mb-6">
          공개 ON으로 두면 <code>/members</code> 페이지에 카드로 노출됩니다.
          기본값은 비공개입니다.
        </p>

        {isLoading || !data ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-lg bg-card border border-border p-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border">
              <div>
                <div className="font-medium">공개 여부</div>
                <div className="text-xs text-muted-foreground">
                  {form.isPublic
                    ? "내 카드가 /members 페이지에 표시됩니다."
                    : "비공개 상태입니다."}
                </div>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
              />
            </div>

            <div>
              <Label className="text-xs">표시 이름</Label>
              <Input
                className=""
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">직함 / 기수</Label>
                <Input
                  className=""
                  placeholder="예: 3기 학생"
                  value={form.roleTitle}
                  onChange={(e) =>
                    setForm({ ...form, roleTitle: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">소속 (학교 등)</Label>
                <Input
                  className=""
                  value={form.affiliation}
                  onChange={(e) =>
                    setForm({ ...form, affiliation: e.target.value })
                  }
                />
              </div>
            </div>
            <PhotoField
              value={form.photoUrl}
              name={form.name}
              uploadPath="/student/profile/photo"
              onChange={(photoUrl) => setForm({ ...form, photoUrl })}
            />
<div>
              <Label className="text-xs">한 줄 소개 / 자기소개</Label>
              <Textarea
                className="min-h-[140px]"
                maxLength={5000}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
              <div className="text-xs text-muted-foreground text-right mt-1">
                {form.bio.length} / 5000
              </div>
            </div>
            <div>
              <Label className="text-xs">태그 (쉼표로 구분)</Label>
              <Input
                className=""
                placeholder="예: 프론트엔드, UX, 창업"
                value={form.tagsCsv}
                onChange={(e) =>
                  setForm({ ...form, tagsCsv: e.target.value })
                }
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                className=""
                disabled={!form.name || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                저장
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { api, type PeopleProfile } from "@/lib/mvp3-api";
import { toast } from "@/hooks/use-toast";

type Form = {
  name: string;
  roleTitle: string;
  affiliation: string;
  bio: string;
  photoUrl: string;
  phone: string;
  tagsCsv: string;
  isPublic: boolean;
};

export default function MentorProfile() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mentor-profile"],
    queryFn: () => api<PeopleProfile>("/mentor/profile"),
    retry: false,
  });

  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        roleTitle: data.roleTitle ?? "",
        affiliation: data.affiliation ?? "",
        bio: data.bio ?? "",
        photoUrl: data.photoUrl ?? "",
        phone: (data as any).phone ?? "",
        tagsCsv: (data.tags ?? []).join(", "),
        isPublic: data.isPublic,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      if (!form) return Promise.resolve(null);
      return api(`/mentor/profile`, {
        method: "PATCH",
        body: {
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
          isPublic: form.isPublic,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-profile"] });
      toast({ title: "저장 완료" });
    },
    onError: (e: any) =>
      toast({
        title: "저장 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <MentorLayout>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </MentorLayout>
    );
  }

  if (isError) {
    const msg = (error as any)?.data?.error ?? "프로필을 불러올 수 없습니다.";
    return (
      <MentorLayout>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>프로필 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {msg}
          </CardContent>
        </Card>
      </MentorLayout>
    );
  }

  if (!form) return null;

  return (
    <MentorLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-[-0.02em] mb-6">내 프로필</h1>
        <Card className="">
          <CardHeader>
            <CardTitle>공개 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <Label className="text-xs">직함</Label>
                <Input
                  className=""
                  placeholder="예: 시니어 엔지니어"
                  value={form.roleTitle}
                  onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">소속</Label>
                <Input
                  className=""
                  placeholder="예: ABC회사"
                  value={form.affiliation}
                  onChange={(e) =>
                    setForm({ ...form, affiliation: e.target.value })
                  }
                />
              </div>
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
              <Label className="text-xs">사진 URL</Label>
              <Input
                className=""
                placeholder="https://..."
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">소개</Label>
              <Textarea
                className="min-h-[120px]"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">태그 (쉼표로 구분)</Label>
              <Input
                className=""
                placeholder="예: 백엔드, 창업"
                value={form.tagsCsv}
                onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
              />
              <Label className="text-sm">공개 페이지에 표시</Label>
            </div>
            <div className="pt-2">
              <Button
                className=""
                disabled={save.isPending || !form.name.trim()}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                저장
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MentorLayout>
  );
}

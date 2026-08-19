import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhotoField } from "@/components/PhotoField";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserRoundX } from "lucide-react";
import { api, ApiError, type PeopleProfile } from "@/lib/mvp3-api";
import { EmptyState } from "@/components/EmptyState";
import { opsMailto } from "@/lib/contact";
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
  const { data, isLoading, isError, error, refetch } = useQuery({
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
      <>
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (isError) {
    // 서버가 돌려주는 문구는 영어다("Mentor profile not set up. Please ask an
    // admin…"). 그대로 띄우면 한국어 화면에 영어 한 줄이 박히고, 그 안의
    // `/admin/people` 은 멘토가 열 수도 없는 경로다. 상태 코드로 갈라 우리 말로
    // 적는다 — 아직 안 만들어진 것과 진짜 고장 난 것은 다른 사건이다.
    const notSetUp = (error as ApiError | null)?.status === 404;
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold tracking-[-0.02em]">내 프로필</h1>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UserRoundX}
              title={notSetUp ? "아직 프로필이 없습니다" : "프로필을 불러오지 못했습니다"}
              hint={
                notSetUp
                  ? "운영진이 프로필을 만들어 드리면 여기서 직접 고칠 수 있습니다. 아래로 요청을 보내세요."
                  : "잠시 후 다시 시도해 주세요. 계속 같으면 운영진에게 알려주세요."
              }
              action={
                notSetUp ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={opsMailto("멘토 프로필 생성 요청")}>
                      운영진에게 요청하기
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    다시 시도
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!form) return null;

  return (
    <>
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
            <PhotoField
              value={form.photoUrl}
              name={form.name}
              uploadPath="/mentor/profile/photo"
              onChange={(photoUrl) => setForm({ ...form, photoUrl })}
            />
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
    </>
  );
}

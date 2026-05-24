import { Link } from "wouter";
import { MentorLayout } from "@/components/layout/MentorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCircle, ClipboardList } from "lucide-react";

export default function MentorDashboard() {
  return (
    <MentorLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em]">멘토 홈</h1>
          <p className="text-muted-foreground mt-2">
            Seeds 멘토를 위한 공간입니다. 학생 회원 디렉터리를 열람하고, 본인 프로필을 관리하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle className="w-4 h-4 text-primary" /> 내 프로필
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>공개 페이지에 표시되는 내 소개·연락처를 수정합니다.</p>
              <Link href="/mentor/profile">
                <Button size="sm" className="rounded-none">프로필 편집</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" /> 회원 디렉터리
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>멘토 · 운영진 · 학생 명단과 연락처를 볼 수 있습니다.</p>
              <Link href="/people">
                <Button size="sm" variant="outline" className="rounded-none">디렉터리 열기</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="w-4 h-4 text-primary" /> 평가 배정
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>운영진이 배정한 지원자 평가가 있다면 여기서 확인합니다.</p>
              <Link href="/evaluator">
                <Button size="sm" variant="outline" className="rounded-none">평가 화면</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </MentorLayout>
  );
}

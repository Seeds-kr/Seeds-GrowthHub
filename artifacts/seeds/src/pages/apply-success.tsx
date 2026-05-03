import { PublicLayout } from "@/components/layout/PublicLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function ApplySuccess() {
  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-24">
        <div className="max-w-md w-full bg-card border border-border p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-4">지원서 제출 완료</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Seeds 프로그램에 지원해 주셔서 감사합니다.<br />
            제출하신 지원서는 꼼꼼히 검토한 후,<br />
            작성해주신 이메일로 결과를 안내해 드리겠습니다.
          </p>
          <Link href="/">
            <Button className="w-full rounded-none h-12">메인으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}

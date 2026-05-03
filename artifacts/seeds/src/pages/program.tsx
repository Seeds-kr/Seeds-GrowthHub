import { PublicLayout } from "@/components/layout/PublicLayout";

export default function Program() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-serif font-bold mb-12 text-center">프로그램 안내</h1>
        
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div className="bg-card border border-border p-8">
            <h2 className="text-2xl font-serif font-bold mb-4">커리큘럼</h2>
            <ul className="space-y-4 text-muted-foreground">
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">1주차: 리더십 기초</span>
                <span>자아 탐색 및 리더십 이론 학습</span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">2주차: 문제 해결 방법론</span>
                <span>디자인 씽킹과 데이터 분석 기반 의사결정</span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">3주차: 팀 프로젝트</span>
                <span>사회 문제 해결을 위한 협업 프로젝트 기획</span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">4주차: 최종 발표</span>
                <span>프로젝트 결과물 발표 및 멘토 피드백</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-card border border-border p-8 bg-primary text-primary-foreground">
            <h2 className="text-2xl font-serif font-bold mb-4">참여 혜택</h2>
            <ul className="space-y-4 opacity-90">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>프로그램 전 과정 전액 무상 지원</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>업계 최고 수준의 전문가 1:1 멘토링</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>우수 수료자 대상 장학금 지급</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>수료증 및 활동 증명서 발급</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>알룸나이 네트워크 가입 자격 부여</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

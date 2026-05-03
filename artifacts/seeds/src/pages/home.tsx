import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-24 md:py-32 flex flex-col items-center justify-center text-center px-4 bg-gradient-to-b from-muted/50 to-background">
        <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-6 font-medium">
          Seeds Leadership Program
        </div>
        <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight text-foreground max-w-3xl mb-6 leading-tight">
          차세대를 이끌어갈<br />리더들의 첫 걸음
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          Seeds는 뛰어난 잠재력을 가진 학생들을 발굴하고 육성하는 프리미엄 교육 프로그램입니다.
          최고의 멘토진과 함께 당신의 한계를 넘어보세요.
        </p>
        <Link href="/apply">
          <Button size="lg" className="text-lg px-8 h-14 rounded-none">
            지원하기
          </Button>
        </Link>
      </section>

      {/* What is Seeds? */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            What is Seeds
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
            Seeds는 어떤 프로그램인가요?
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-12 max-w-3xl">
            Seeds는 사회적 임팩트를 만들고자 하는 고등학생과 대학생을 선발하여, 6개월간
            체계적인 멘토링·프로젝트 실습·동료 네트워크를 제공하는 비영리 리더십 프로그램입니다.
            매기수 소수정예로 운영되며, 졸업생들은 다양한 분야에서 변화를 만들어가고 있습니다.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "1:1 멘토링", desc: "각 분야 전문가와 함께하는 개인 맞춤 멘토링 세션" },
              { title: "임팩트 프로젝트", desc: "팀 단위로 사회 문제를 정의하고 해결책을 실행" },
              { title: "글로벌 네트워크", desc: "국내외 졸업생, 파트너 기관과의 지속적 연결" },
            ].map((f, i) => (
              <div key={i} className="border border-border bg-card p-8">
                <div className="text-sm text-primary font-semibold mb-3">0{i + 1}</div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who should apply? */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            Who Should Apply
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            이런 분들을 찾고 있습니다
          </h2>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
            {[
              "사회 문제에 대한 자신만의 관점과 실행 의지가 있는 학생",
              "학교·동아리·지역사회에서 주도적으로 활동해 본 경험이 있는 학생",
              "단기 결과보다 깊이 있는 성장을 추구하는 학생",
              "팀워크와 다양성을 존중하고, 함께 배워나갈 준비가 된 학생",
              "고등학교 1학년부터 대학교 4학년까지 (만 16–24세 권장)",
              "프로그램 일정에 성실히 참여할 수 있는 학생",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 py-3 border-b border-border/60">
                <span className="font-serif text-primary font-bold text-lg leading-none mt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-foreground leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program flow */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            Program Flow
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            6개월의 여정
          </h2>
          <div className="grid md:grid-cols-4 gap-px bg-border border border-border">
            {[
              { month: "Month 1", title: "온보딩", desc: "오리엔테이션, 동료 매칭, 자기 진단" },
              { month: "Month 2-3", title: "기초 역량", desc: "리더십·문제정의·커뮤니케이션 워크숍" },
              { month: "Month 4-5", title: "프로젝트 실행", desc: "팀 기반 임팩트 프로젝트 + 멘토링" },
              { month: "Month 6", title: "발표 & 졸업", desc: "최종 발표회와 알럼나이 네트워크 합류" },
            ].map((step, i) => (
              <div key={i} className="bg-card p-8">
                <div className="text-sm text-primary font-semibold mb-2">{step.month}</div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recruitment schedule */}
      <section className="py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            Recruitment Schedule
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            모집 일정
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { phase: "서류 접수", date: "10.01 — 10.15", desc: "온라인 지원서 제출" },
              { phase: "서류 심사", date: "10.16 — 10.20", desc: "지원서 종합 평가" },
              { phase: "심층 면접", date: "10.25 — 10.27", desc: "1:1 온라인 면접" },
              { phase: "최종 합격", date: "11.01", desc: "개별 안내 및 OT" },
            ].map((step, i) => (
              <div key={i} className="flex flex-col p-6 border border-border bg-card">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Step {i + 1}
                </div>
                <div className="text-sm font-semibold text-primary mb-2">{step.date}</div>
                <div className="text-xl font-bold mb-3">{step.phase}</div>
                <div className="text-sm text-muted-foreground">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="py-24 px-4 border-t border-border">
        <div className="container mx-auto max-w-4xl">
          <div className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-3 font-medium">
            FAQ
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12">
            자주 묻는 질문
          </h2>
          <div className="space-y-4 mb-10">
            {[
              {
                q: "참가비가 있나요?",
                a: "Seeds는 비영리 프로그램으로, 선발된 모든 참가자에게 참가비를 받지 않습니다.",
              },
              {
                q: "온라인으로만 진행되나요?",
                a: "주요 세션은 온라인으로 진행되며, 일부 워크숍과 발표회는 오프라인으로 운영됩니다.",
              },
              {
                q: "재지원이 가능한가요?",
                a: "이전 기수에 합격하지 못한 경우에도 재지원이 가능합니다. 새로운 경험과 성장을 담아주세요.",
              },
            ].map((item, i) => (
              <div key={i} className="border border-border bg-card p-6">
                <h3 className="font-bold mb-2">Q. {item.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
          <Link href="/faq">
            <Button variant="outline" className="rounded-none">
              전체 FAQ 보기
            </Button>
          </Link>
        </div>
      </section>

      {/* Apply CTA */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
            준비된 당신의 첫 걸음을 기다립니다
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-10 leading-relaxed">
            지원서 작성에 30분이면 충분합니다. 형식보다는 당신의 진솔한 이야기를 담아주세요.
          </p>
          <Link href="/apply">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 h-14 rounded-none"
            >
              지원하기
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

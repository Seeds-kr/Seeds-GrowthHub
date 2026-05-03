import { PublicLayout } from "@/components/layout/PublicLayout";

export default function About() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-24 max-w-3xl">
        <h1 className="text-4xl font-serif font-bold mb-8">Seeds 소개</h1>
        <div className="prose prose-lg prose-neutral dark:prose-invert">
          <p>
            Seeds는 대한민국의 우수한 학생들을 선발하여 글로벌 리더로 성장할 수 있도록 지원하는 프리미엄 교육 프로그램입니다.
          </p>
          <h2>우리의 미션</h2>
          <p>
            단순한 학업 성취를 넘어, 사회적 문제에 공감하고 이를 해결할 수 있는 실천적 리더를 양성합니다. 
            다양한 분야의 전문가 멘토링과 실무 프로젝트를 통해 학생들의 잠재력을 최대한 끌어냅니다.
          </p>
          <h2>핵심 가치</h2>
          <ul>
            <li><strong>탁월함:</strong> 끊임없는 학습과 성장을 추구합니다.</li>
            <li><strong>책임감:</strong> 자신이 속한 공동체에 긍정적인 영향을 미칩니다.</li>
            <li><strong>혁신:</strong> 새로운 관점으로 문제를 바라보고 해결책을 제시합니다.</li>
          </ul>
        </div>
      </div>
    </PublicLayout>
  );
}

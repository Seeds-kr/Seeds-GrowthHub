import { PublicLayout } from "@/components/layout/PublicLayout";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateApplicationBody } from "@workspace/api-zod";
import { useCreateApplication } from "@workspace/api-client-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { koErrorMap } from "@/lib/zod-ko";

type ApplyFormValues = z.input<typeof CreateApplicationBody>;

export default function Apply() {
  const [, setLocation] = useLocation();
  const createMutation = useCreateApplication();
  const { toast } = useToast();

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(CreateApplicationBody, { errorMap: koErrorMap }),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      school: "",
      grade: "",
      birthYear: 2005,
      interestArea: "",
      motivation: "",
      experience: "",
      problemAwareness: "",
      expectation: "",
      privacyConsent: false as unknown as true,
    },
  });

  const onSubmit = (data: ApplyFormValues) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        setLocation("/apply/success");
      },
      onError: () => {
        toast({
          title: "제출 실패",
          description: "지원서 제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <PublicLayout>
      <div className="bg-muted/30 border-b border-border py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">지원서 작성</h1>
          <p className="text-muted-foreground">
            모든 문항은 꼼꼼히 검토됩니다. 본인의 이야기와 열정을 진솔하게 담아주세요.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
            
            {/* 기본 정보 */}
            <div className="space-y-6">
              <h2 className="text-2xl font-serif font-bold border-b border-border pb-2">기본 정보</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름 *</FormLabel>
                    <FormControl><Input placeholder="홍길동" className="" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일 *</FormLabel>
                    <FormControl><Input type="email" placeholder="example@email.com" className="" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>연락처 *</FormLabel>
                    <FormControl><Input type="tel" placeholder="010-0000-0000" className="" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="birthYear" render={({ field }) => (
                  <FormItem>
                    <FormLabel>출생연도 *</FormLabel>
                    <FormControl>
                      <Input type="number" min={1950} max={2025} className="" 
                        {...field} 
                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="school" render={({ field }) => (
                  <FormItem>
                    <FormLabel>학교 *</FormLabel>
                    <FormControl><Input placeholder="ㅇㅇ고등학교 / ㅇㅇ대학교" className="" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="grade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>학년 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="">
                          <SelectValue placeholder="학년 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="고1">고1</SelectItem>
                        <SelectItem value="고2">고2</SelectItem>
                        <SelectItem value="고3">고3</SelectItem>
                        <SelectItem value="대학생(1-2학년)">대학생(1-2학년)</SelectItem>
                        <SelectItem value="대학생(3-4학년)">대학생(3-4학년)</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="interestArea" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>주요 관심 분야 *</FormLabel>
                    <FormControl><Input placeholder="예: 환경, 교육, 기술, 사회적 기업 등" className="" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* 서술형 문항 */}
            <div className="space-y-6">
              <h2 className="text-2xl font-serif font-bold border-b border-border pb-2">서술형 문항</h2>
              
              <FormField control={form.control} name="motivation" render={({ field }) => (
                <FormItem>
                  <FormLabel>1. 지원 동기 *</FormLabel>
                  <p className="text-sm text-muted-foreground mb-2">Seeds 프로그램에 지원하게 된 계기와 이를 통해 이루고 싶은 목표를 서술해 주세요.</p>
                  <FormControl>
                    <Textarea className="min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="experience" render={({ field }) => (
                <FormItem>
                  <FormLabel>2. 관련 경험 *</FormLabel>
                  <p className="text-sm text-muted-foreground mb-2">지금까지 사이드 프로젝트·해커톤·스터디 등에서 무언가를 직접 만들어 본 경험을 구체적으로 서술해 주세요. 사용한 기술, 맡은 역할, 배운 점을 함께 적어주시면 좋습니다.</p>
                  <FormControl>
                    <Textarea className="min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="problemAwareness" render={({ field }) => (
                <FormItem>
                  <FormLabel>3. 문제 인식 *</FormLabel>
                  <p className="text-sm text-muted-foreground mb-2">현재 우리 사회에서 가장 시급하게 해결해야 한다고 생각하는 문제는 무엇이며, 그 이유는 무엇인가요?</p>
                  <FormControl>
                    <Textarea className="min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="expectation" render={({ field }) => (
                <FormItem>
                  <FormLabel>4. 프로그램 기대사항 *</FormLabel>
                  <p className="text-sm text-muted-foreground mb-2">본 프로그램을 통해 본인에게 어떤 변화가 일어나기를 기대하시나요?</p>
                  <FormControl>
                    <Textarea className="min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* 동의 및 제출 */}
            <div className="space-y-6 pt-6 border-t border-border">
              <FormField control={form.control} name="privacyConsent" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border border-border bg-muted/30">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>개인정보 수집 및 이용 동의 *</FormLabel>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      지원서 평가 및 선발 전형 진행을 위해 이름, 연락처, 학교 등 제공해주신 개인정보를 수집 및 이용합니다. 
                      수집된 정보는 선발 전형 종료 후 6개월 이내에 파기됩니다. 귀하는 동의를 거부할 권리가 있으나, 
                      거부 시 프로그램 지원이 불가능합니다.
                    </p>
                  </div>
                </FormItem>
              )} />

              <Button type="submit" size="lg" className="w-full text-lg h-14" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
                지원서 제출하기
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </PublicLayout>
  );
}

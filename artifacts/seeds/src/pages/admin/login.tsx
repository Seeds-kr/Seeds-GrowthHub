import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminLogin } from "@workspace/api-client-react";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, ArrowRight, Loader2, Code2, Users, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const HIGHLIGHTS = [
  {
    icon: Code2,
    title: "함께 만드는 사이드 프로젝트",
    desc: "한 학기 동안 팀을 이뤄 제품을 기획·디자인·개발합니다.",
  },
  {
    icon: Users,
    title: "주 1회 정기 스터디",
    desc: "프론트·백엔드·CS 트랙별로 매주 모여 함께 학습합니다.",
  },
  {
    icon: Sparkles,
    title: "선배 개발자 멘토링",
    desc: "현직으로 일하는 졸업생들의 코드 리뷰와 커리어 멘토링을 받습니다.",
  },
];

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useAdminLogin();
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    setErrorMsg("");
    loginMutation.mutate(
      { data },
      {
        onSuccess: (user) => {
          queryClient.invalidateQueries({ queryKey: getAdminMeQueryKey() });
          const effective: string[] = (user as any).roles ?? [user.role];
          if (effective.includes("admin")) setLocation("/admin");
          else if (effective.includes("mentor")) setLocation("/mentor");
          else if (effective.includes("student")) setLocation("/student");
          else setLocation("/admin");
        },
        onError: (err: any) => {
          if (err.status === 401) {
            setErrorMsg("이메일 또는 비밀번호가 올바르지 않습니다.");
          } else {
            setErrorMsg("로그인 중 오류가 발생했습니다.");
          }
        },
      },
    );
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel — hidden on small screens */}
      <aside className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12 xl:p-16 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-20 w-[360px] h-[360px] rounded-full bg-white/5 blur-3xl pointer-events-none"
        />

        <div className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />홈으로
          </Link>
        </div>

        <div className="relative max-w-md">
          <div className="text-[11px] uppercase tracking-[0.22em] mb-4 text-primary-foreground/70">
            Seeds · Student Developer Club
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6 tracking-[-0.03em]">
            함께 코드를 심고,<br />함께 자랍니다
          </h2>
          <p className="text-primary-foreground/85 leading-[1.85] mb-10">
            Seeds는 학생 개발자들이 모여 매 학기 함께 스터디하고, 사이드 프로젝트를 만들고, 해커톤에 나가는 동아리입니다.
          </p>

          <ul className="space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-md bg-white/10 flex items-center justify-center">
                  <h.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold mb-1">{h.title}</div>
                  <div className="text-sm text-primary-foreground/75 leading-relaxed">{h.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} Seeds Student Developer Club
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col">
        <header className="flex items-center justify-between px-6 lg:px-12 py-6 border-b border-border lg:border-b-0">
          <Link href="/" className="text-xl font-bold text-primary tracking-tight">
            Seeds
          </Link>
          <Link
            href="/recruit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            모집 알아보기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <h1 className="text-3xl font-bold tracking-[-0.03em] mb-3">로그인</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                운영진 · 멘토 · 학생 모두 같은 계정으로 로그인합니다.
                <br />
                역할에 따라 자동으로 알맞은 화면으로 이동해요.
              </p>
            </div>

            {errorMsg && (
              <Alert variant="destructive" className="mb-6 rounded-md">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  로그인
                </Button>
              </form>
            </Form>

            <div className="mt-8 pt-6 border-t border-border space-y-3 text-sm">
              <p className="text-muted-foreground">
                계정이 아직 없으신가요?{" "}
                <Link href="/recruit" className="text-primary font-medium hover:underline">
                  다음 기수 모집 보기
                </Link>
              </p>
              <p className="text-muted-foreground">
                합격 안내 메일에 포함된{" "}
                <span className="text-foreground font-medium">활성화 링크</span>로 처음 비밀번호를 설정하실 수 있어요.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

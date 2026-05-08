import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminLogin } from "@workspace/api-client-react";
import { getAdminMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useAdminLogin();
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setErrorMsg("");
    loginMutation.mutate(
      { data },
      {
        onSuccess: (user) => {
          queryClient.invalidateQueries({ queryKey: getAdminMeQueryKey() });
          if (user.role === "evaluator") {
            setLocation("/evaluator");
          } else {
            setLocation("/admin");
          }
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-bold text-primary mb-2">Seeds</h1>
          <p className="text-muted-foreground text-sm">관리자 또는 평가자 계정으로 로그인하세요.</p>
        </div>

        {errorMsg && (
          <Alert variant="destructive" className="mb-6 rounded-none">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" className="rounded-none" {...field} />
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
                    <Input type="password" placeholder="••••••••" className="rounded-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full rounded-none" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              로그인
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

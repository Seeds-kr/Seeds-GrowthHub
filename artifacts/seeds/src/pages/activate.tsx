import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ActivationInfo = {
  status: "ok";
  email: string;
  name: string;
  expiresAt: string;
};

export default function ActivatePage() {
  const [, params] = useRoute("/activate/:token");
  const [, setLocation] = useLocation();
  const token = params?.token ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["activation", token],
    queryFn: () => api<ActivationInfo>(`/activation/${token}`),
    enabled: !!token,
    retry: false,
  });

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);

  const consume = useMutation({
    mutationFn: (password: string) =>
      api(`/activation/${token}`, { method: "POST", body: { password } }),
    onSuccess: () => setDone(true),
  });

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setLocation("/login"), 2500);
    return () => clearTimeout(t);
  }, [done, setLocation]);

  const errStatus = (error as any)?.data?.status as string | undefined;
  const errMessage =
    errStatus === "expired"
      ? "이 활성화 링크는 만료되었습니다. 운영진에게 새 링크를 요청해주세요."
      : errStatus === "used"
        ? "이 활성화 링크는 이미 사용되었습니다. 로그인 페이지에서 로그인해주세요."
        : error
          ? "유효하지 않은 활성화 링크입니다."
          : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 mb-3">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary mb-1">계정 활성화</h1>
          <p className="text-muted-foreground text-sm">
            Seeds 학생 계정의 비밀번호를 설정합니다.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : errMessage ? (
          <Alert variant="destructive" className="rounded-none">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              {errMessage}
              <div className="mt-3">
                <Button variant="outline" className="rounded-none" onClick={() => setLocation("/login")}>로그인 페이지로</Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : done ? (
          <Alert className="rounded-none">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>
              활성화가 완료되었습니다. 잠시 후 로그인 페이지로 이동합니다…
            </AlertDescription>
          </Alert>
        ) : data ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pw1.length < 8) return;
              if (pw1 !== pw2) return;
              consume.mutate(pw1);
            }}
            className="space-y-5"
          >
            <div className="bg-muted border border-border p-3 text-sm">
              <div><span className="text-muted-foreground">이름:</span> <strong>{data.name}</strong></div>
              <div><span className="text-muted-foreground">이메일:</span> <strong>{data.email}</strong></div>
              <div className="text-xs text-muted-foreground mt-1">만료: {new Date(data.expiresAt).toLocaleString()}</div>
            </div>
            <div>
              <Label htmlFor="pw1">새 비밀번호 (8자 이상)</Label>
              <Input
                id="pw1"
                type="password"
                className="rounded-none mt-1"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="pw2">새 비밀번호 확인</Label>
              <Input
                id="pw2"
                type="password"
                className="rounded-none mt-1"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                minLength={8}
                required
              />
              {pw2.length > 0 && pw1 !== pw2 && (
                <p className="text-xs text-destructive mt-1">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            {consume.isError && (
              <Alert variant="destructive" className="rounded-none">
                <AlertDescription>활성화에 실패했습니다. 링크가 만료되었거나 이미 사용되었을 수 있습니다.</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full rounded-none" disabled={pw1.length < 8 || pw1 !== pw2 || consume.isPending}>
              {consume.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              비밀번호 설정 후 활성화
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

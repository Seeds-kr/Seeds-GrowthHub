import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";

export default function AdminEvaluators() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListUsers({ role: "mentor" });
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const handleCreate = () => {
    setErrMsg("");
    if (name.trim().length === 0 || email.trim().length === 0 || password.length < 8) {
      setErrMsg("이름·이메일·8자 이상의 비밀번호를 입력하세요.");
      return;
    }
    createUser.mutate(
      {
        data: {
          name: name.trim(),
          email: email.trim(),
          password,
          role: "mentor",
        },
      },
      {
        onSuccess: () => {
          toast({ title: "평가자 추가 완료" });
          setName("");
          setEmail("");
          setPassword("");
          setOpen(false);
          queryClient.invalidateQueries({
            queryKey: getListUsersQueryKey({ role: "mentor" }),
          });
        },
        onError: (err: any) => {
          if (err?.status === 409) {
            setErrMsg("이미 사용 중인 이메일입니다.");
          } else {
            setErrMsg("평가자 추가에 실패했습니다.");
          }
        },
      },
    );
  };

  const toggleActive = (id: number, isActive: boolean) => {
    updateUser.mutate(
      { id, data: { isActive: !isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListUsersQueryKey({ role: "mentor" }),
          });
        },
      },
    );
  };

  return (
    <>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-serif font-bold">평가자 관리</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="" data-testid="button-new-evaluator">
              <Plus className="w-4 h-4 mr-2" />
              평가자 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="">
            <DialogHeader>
              <DialogTitle>새 평가자 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>이름</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className=""
                  data-testid="input-evaluator-name"
                />
              </div>
              <div>
                <Label>이메일</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className=""
                  data-testid="input-evaluator-email"
                />
              </div>
              <div>
                <Label>임시 비밀번호 (8자 이상)</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className=""
                  data-testid="input-evaluator-password"
                />
              </div>
              {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={createUser.isPending}
                className=""
                data-testid="button-create-evaluator"
              >
                {createUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                등록
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>배정 / 완료</TableHead>
              <TableHead className="text-right">동작</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : (data?.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                <EmptyState title="등록된 평가자가 없습니다." />
              </TableCell>
              </TableRow>
            ) : (
              data?.items.map((u) => (
                <TableRow key={u.id} data-testid={`row-evaluator-${u.id}`}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.isActive ? "default" : "outline"}
                      className="font-normal"
                    >
                      {u.isActive ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.completedCount} / {u.assignedCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className=""
                      onClick={() => toggleActive(u.id, u.isActive)}
                      data-testid={`button-toggle-${u.id}`}
                    >
                      {u.isActive ? "비활성화" : "활성화"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

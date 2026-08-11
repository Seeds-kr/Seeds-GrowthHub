import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * 옛 출석 입력 화면. 이제 모임 상세 안에 있다.
 *
 * 라우트를 지우지 않고 넘겨보내는 이유: 이 주소가 북마크·메모·디스코드 메시지에
 * 남아 있을 수 있다. 지우면 404 가 뜨는데, 사용자 입장에서는 기능이 사라진 것과
 * 구분이 안 된다. 상세로 보내면 찾던 것이 거기 있다.
 *
 * `replace` 인 것도 의도다. push 로 넣으면 뒤로 가기가 이 화면으로 돌아와
 * 다시 상세로 튕겨 나가는 고리에 갇힌다.
 */
export default function AdminSessionAttendanceRedirect() {
  const [, params] = useRoute("/admin/sessions/:id/attendance");
  const [, navigate] = useLocation();
  const id = params?.id;

  useEffect(() => {
    if (id) navigate(`/admin/sessions/${id}`, { replace: true });
  }, [id, navigate]);

  return (
    <div className="flex justify-center py-12 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      모임 상세로 이동합니다 — 출석 입력이 그 안으로 들어왔습니다.
    </div>
  );
}

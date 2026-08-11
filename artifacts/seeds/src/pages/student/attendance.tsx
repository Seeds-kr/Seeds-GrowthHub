import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * 옛 출석 화면. 이제 모임 화면 안에 있다.
 *
 * `/admin/sessions/:id/attendance` 와 같은 이유로 라우트를 남겨 넘겨보낸다 —
 * 이 주소가 어딘가에 적혀 있을 수 있고, 404 는 기능이 사라진 것과 구분되지
 * 않는다. replace 라 뒤로 가기가 고리에 갇히지 않는다.
 */
export default function StudentAttendanceRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/student/sessions", { replace: true });
  }, [navigate]);
  return (
    <div className="flex justify-center py-12 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      모임 화면으로 이동합니다 — 출석이 그 안으로 들어왔습니다.
    </div>
  );
}

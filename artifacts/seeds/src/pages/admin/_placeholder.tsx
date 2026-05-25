import { useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";
import { findPlaceholderItem } from "@/lib/admin-nav";

export default function AdminPlaceholderPage() {
  const [location] = useLocation();
  const item = findPlaceholderItem(location);

  const label = item?.label ?? "준비 중인 화면";
  const description =
    item?.description ?? "이 화면은 GrowthHub IA 정렬에 따라 추가된 자리입니다.";
  const futureScope = item?.futureScope ?? "";

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto py-4">
        <div className="mb-6 flex items-center gap-3">
          <Badge variant="secondary" className="rounded-full">
            <Construction className="w-3 h-3 mr-1" />
            준비 중
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">개요</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </CardContent>
        </Card>

        {futureScope ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">향후 범위</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              {futureScope}
            </CardContent>
          </Card>
        ) : null}

        <p className="mt-6 text-xs text-muted-foreground">
          경로: <code className="font-mono">{location}</code>
        </p>
      </div>
    </AdminLayout>
  );
}

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 배지는 **상태 라벨이지 컨트롤이 아니다.** 이 코드베이스에서 배지는 전부 표시용이다.
 *
 * 이전 버전은 정의된 적 없는 `hover-elevate`를 달고 있었다. 되살리지 않고 지운다 —
 * 누를 수 없는 것에 호버 반응을 주면 버튼에 반응이 없는 것과 정확히 반대되는 거짓말이
 * 된다. 배지가 실제로 클릭 대상이 되는 날에는 그 자리에서 `<button>`으로 감싼다.
 *
 * 색만으로 상태를 전하지 않는다는 원칙(PRODUCT.md 접근성) 때문에 배지 안에는 항상
 * 텍스트가 함께 들어간다.
 */
const badgeVariants = cva(
  // Whitespace-nowrap: 배지는 줄바꿈하지 않는다.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        outline: "text-foreground border [border-color:var(--badge-outline)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

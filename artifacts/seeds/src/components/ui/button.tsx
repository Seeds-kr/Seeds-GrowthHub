import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 상태(hover/active/disabled)는 장식이 아니라 **이게 누를 수 있는 것이라는 유일한 신호**다.
 *
 * 이전 버전은 모든 variant에서 hover를 제거하고(`@replit: no hover`) 그 자리를
 * `hover-elevate` · `active-elevate-2`에 맡겼는데, 두 클래스는 이 프로젝트 CSS에
 * **정의된 적이 없다**(빌드 산출물 검색 0건). 그래서 앱 전체 버튼이 호버에 전혀
 * 반응하지 않았고, `<button>`의 기본 커서까지 화살표라 클릭 가능하다는 단서가 0이었다.
 *
 * 정의되지 않은 유틸리티를 되살리는 대신 각 variant가 자기 상태를 직접 갖는다.
 * 색은 기존 토큰에서만 파생시킨다 — 시각 세계를 바꾸는 것이 아니라 없던 피드백을
 * 채우는 작업이다.
 */
const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border shadow-xs " +
          "hover:bg-primary/90 active:bg-primary/80 active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm border-destructive-border " +
          "hover:bg-destructive/90 active:bg-destructive/80 active:shadow-none",
        outline:
          // 안에 놓인 표면(카드·사이드바)의 배경을 그대로 쓰고 글자색을 상속한다.
          // 호버는 `muted`(아주 옅은 회색)로만 올린다. 이 프로젝트의 `--accent`는
          // shadcn 기본값과 달리 `--primary`와 같은 브랜드 초록이라, 그걸 쓰면
          // 표 안 액션 버튼이 호버마다 "선택됨"처럼 채워진다.
          "border [border-color:var(--button-outline)] shadow-xs " +
          "hover:bg-muted hover:border-primary/40 " +
          "active:bg-muted active:shadow-none",
        secondary:
          "border bg-secondary text-secondary-foreground border-secondary-border " +
          "hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "border border-transparent " +
          "hover:bg-muted active:bg-muted/70",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative h-2 w-full overflow-hidden rounded-full",
  {
    variants: {
      variant: {
        default: "bg-primary/20 [&>[data-slot=progress-indicator]]:bg-primary",
        success: "bg-green-500/20 [&>[data-slot=progress-indicator]]:bg-green-500",
        warning: "bg-yellow-500/20 [&>[data-slot=progress-indicator]]:bg-yellow-500",
        destructive: "bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Progress({
  className,
  value,
  variant,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> &
  VariantProps<typeof progressVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressVariants({ variant }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressVariants }

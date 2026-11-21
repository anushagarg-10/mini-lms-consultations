"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/** shadcn/ui-style Calendar on react-day-picker v9. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col gap-4", d.months),
        month: cn("flex w-full flex-col gap-4", d.month),
        nav: cn("absolute inset-x-0 top-0 flex items-center justify-between", d.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 aria-disabled:opacity-40",
          d.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 aria-disabled:opacity-40",
          d.button_next,
        ),
        month_caption: cn("flex h-8 items-center justify-center", d.month_caption),
        caption_label: cn("text-sm font-medium", d.caption_label),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", d.weekdays),
        weekday: cn("w-9 text-[0.8rem] font-normal text-muted-foreground", d.weekday),
        week: cn("mt-1 flex w-full", d.week),
        day: cn("relative size-9 p-0 text-center text-sm", d.day),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: cls, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className={cn("size-4", cls)} {...rest} />
          ) : (
            <ChevronRightIcon className={cn("size-4", cls)} {...rest} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }

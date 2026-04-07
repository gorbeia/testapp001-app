import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  /** Tailwind classes for the scrollable options list (default: tall viewport-aware scroll area). */
  listClassName?: string;
  /** Minimum popover width in px (dropdown is at least as wide as the trigger or this). */
  minPopoverWidth?: number;
  id?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results.",
  disabled,
  className,
  contentClassName,
  listClassName,
  minPopoverWidth = 288,
  id,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [commandKey, setCommandKey] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [contentWidth, setContentWidth] = React.useState<number | undefined>();

  const selected = React.useMemo(() => options.find(o => o.value === value), [options, value]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setCommandKey(k => k + 1);
      requestAnimationFrame(() => {
        if (triggerRef.current) {
          setContentWidth(Math.max(triggerRef.current.offsetWidth, minPopoverWidth));
        }
      });
    }
  };

  /** Keep wheel/trackpad scrolling on the list when this popover is inside a modal (e.g. Radix Dialog + RemoveScroll). */
  const stopWheelBubble = React.useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          id={id}
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-controls={open ? `${id ?? "searchable-select"}-listbox` : undefined}
          disabled={disabled}
          data-testid={dataTestId}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ring-offset-background transition-[color,box-shadow,background-color] duration-150",
            "hover:bg-accent/40 hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "data-[state=open]:border-ring data-[state=open]:shadow-sm data-[state=open]:[&>svg:last-child]:rotate-180",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="line-clamp-1 min-w-0 flex-1 text-left">
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-200" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={`${id ?? "searchable-select"}-listbox`}
        className={cn("overflow-hidden border-border/80 p-0 shadow-md", contentClassName)}
        style={contentWidth ? { width: contentWidth } : undefined}
        align="start"
        sideOffset={6}
        collisionPadding={12}
        onWheel={stopWheelBubble}
      >
        <Command key={commandKey}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList
            className={cn(
              "max-h-[min(55vh,22rem)] touch-pan-y scroll-py-2 overscroll-contain",
              listClassName
            )}
            onWheel={stopWheelBubble}
          >
            <CommandEmpty className="text-muted-foreground">{emptyMessage}</CommandEmpty>
            <CommandGroup className="p-1.5">
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  disabled={option.disabled}
                  className="rounded-md py-2 pr-2"
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 text-primary",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="line-clamp-2 text-left">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  value: string;
  open: boolean;
  disabled: boolean;
  selectedLabel: React.ReactNode;
  contentId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  setOpen: (open: boolean) => void;
  setValue: (value: string) => void;
  registerItem: (value: string, label: React.ReactNode) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error(`${component} must be used inside <Select>`);
  }
  return ctx;
}

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
};

function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  disabled = false,
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({});
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const contentId = React.useId();
  const value = controlledValue ?? uncontrolledValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [controlledValue, onValueChange],
  );

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode) => {
    setLabels((prev) => {
      if (prev[itemValue] === label) return prev;
      return { ...prev, [itemValue]: label };
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      value,
      open,
      disabled,
      selectedLabel: labels[value],
      contentId,
      triggerRef,
      contentRef,
      setOpen: (next) => setOpen(disabled ? false : next),
      setValue,
      registerItem,
    }),
    [contentId, disabled, labels, open, registerItem, setValue, value],
  );

  return (
    <SelectContext.Provider value={ctx}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("py-1", className)} {...props} />
));
SelectGroup.displayName = "SelectGroup";

const SelectValue = ({
  placeholder,
}: {
  placeholder?: React.ReactNode;
}) => {
  const { selectedLabel, value } = useSelectContext("SelectValue");
  return (
    <span className="truncate">
      {selectedLabel ?? placeholder ?? value}
    </span>
  );
};
SelectValue.displayName = "SelectValue";

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, disabled, onClick, onKeyDown, ...props }, forwardedRef) => {
  const ctx = useSelectContext("SelectTrigger");

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      ctx.triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [ctx.triggerRef, forwardedRef],
  );

  return (
    <button
      ref={setRefs}
      type="button"
      role="combobox"
      aria-controls={ctx.contentId}
      aria-expanded={ctx.open}
      disabled={disabled ?? ctx.disabled}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background transition-all placeholder:text-muted-foreground/70 hover:border-input/80 focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.setOpen(!ctx.open);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          ctx.setOpen(true);
        }
      }}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

type SelectContentProps = React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
};

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, side = "bottom", align = "start", ...props }, forwardedRef) => {
    const ctx = useSelectContext("SelectContent");
    const [mounted, setMounted] = React.useState(false);
    const [style, setStyle] = React.useState<React.CSSProperties>({});

    React.useEffect(() => setMounted(true), []);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        ctx.contentRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [ctx.contentRef, forwardedRef],
    );

    React.useLayoutEffect(() => {
      if (!ctx.open) return;

      const updatePosition = () => {
        const trigger = ctx.triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const gap = 4;
        const width = rect.width;
        const maxHeight = Math.max(
          120,
          side === "top" ? rect.top - gap - 8 : window.innerHeight - rect.bottom - gap - 8,
        );
        const left =
          align === "end"
            ? rect.right - width
            : align === "center"
              ? rect.left + rect.width / 2 - width / 2
              : rect.left;

        setStyle({
          left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
          top: side === "top" ? undefined : rect.bottom + gap,
          bottom: side === "top" ? window.innerHeight - rect.top + gap : undefined,
          width,
          maxHeight,
        });
      };

      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [align, ctx.open, ctx.triggerRef, side]);

    if (!mounted) return null;

    return createPortal(
      <div
        ref={setRefs}
        id={ctx.contentId}
        role="listbox"
        tabIndex={-1}
        data-state={ctx.open ? "open" : "closed"}
        className={cn(
          "fixed z-[70] min-w-[8rem] overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
          ctx.open
            ? "animate-in fade-in-0 zoom-in-95"
            : "pointer-events-none hidden",
          className,
        )}
        style={style}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            ctx.setOpen(false);
            ctx.triggerRef.current?.focus();
          }
        }}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

type SelectItemProps = React.HTMLAttributes<HTMLButtonElement> & {
  value: string;
  disabled?: boolean;
  textValue?: string;
};

const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, children, value, disabled, textValue, onClick, onPointerDown, ...props }, forwardedRef) => {
    const ctx = useSelectContext("SelectItem");
    const localRef = React.useRef<HTMLButtonElement | null>(null);
    const selected = ctx.value === value;

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    React.useEffect(() => {
      const label = textValue ?? localRef.current?.textContent?.trim() ?? value;
      ctx.registerItem(value, label);
    }, [children, ctx, textValue, value]);

    return (
      <button
        ref={setRefs}
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
          selected && "bg-accent/70 text-accent-foreground",
          className,
        )}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (event.defaultPrevented || disabled) return;
          if (event.pointerType !== "mouse") return;
          event.preventDefault();
          ctx.setValue(value);
          ctx.setOpen(false);
          ctx.triggerRef.current?.focus();
        }}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || disabled) return;
          ctx.setValue(value);
          ctx.setOpen(false);
          ctx.triggerRef.current?.focus();
        }}
        {...props}
      >
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
          {selected ? <Check className="h-4 w-4" /> : null}
        </span>
        <span className="truncate">{children}</span>
      </button>
    );
  },
);
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
SelectSeparator.displayName = "SelectSeparator";

const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div ref={ref} {...props} />);
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => <div ref={ref} {...props} />);
SelectScrollDownButton.displayName = "SelectScrollDownButton";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};

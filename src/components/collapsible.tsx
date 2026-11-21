"use client";
import { ChevronDown } from "lucide-react";
import { ReactNode, useState } from "react";

export function CollapsibleBlock({ title, children, defaultOpen = true, className = "", titleClassName = "", action }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; titleClassName?: string; action?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible-block ${open ? "" : "is-collapsed"} ${className}`.trim()}>
      <div className="collapsible-block-head">
        <button type="button" className={`collapsible-block-toggle ${titleClassName}`.trim()} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDown size={15} className={open ? "" : "is-collapsed"} />
          <span className="collapsible-block-title">{title}</span>
        </button>
        {action}
      </div>
      {open && <div className="collapsible-block-body">{children}</div>}
    </div>
  );
}

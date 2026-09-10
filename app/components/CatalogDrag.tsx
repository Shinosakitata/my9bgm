"use client";
import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

export function SelectionDrop({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "selection-drop", disabled });
  return <div ref={setNodeRef} className={`rounded-2xl ${isOver ? "bg-sky-50 ring-2 ring-sky-400" : ""}`}>{children}</div>;
}

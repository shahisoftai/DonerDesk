"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; label: string }
interface State { failed: boolean }

/** One block that cannot be drawn must not blank the page: it says so, in its own place, and every other block carries on. */
export class BlockBoundary extends Component<Props, State> {
  override state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  override componentDidCatch(error: unknown): void { console.error(`Canvas block "${this.props.label}" could not be drawn`, error); }
  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{this.props.label} could not be drawn. The rest of the page is fine; try changing its settings or removing it.</p>;
  }
}

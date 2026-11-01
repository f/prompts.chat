import { WidgetCard } from "@/components/prompts/widget-card";
import type { InjectedWidget, WidgetPlacement } from "@/lib/plugins/widgets";

interface ListingWidgetCardProps {
  widget: InjectedWidget;
  placement: WidgetPlacement;
}

/**
 * Renders an injected widget inside a bots or teams listing. Safe to use from server components:
 * custom designs render here, and default cards get a copy without functions, which can't be
 * passed to client components.
 */
export function ListingWidgetCard({ widget, placement }: ListingWidgetCardProps) {
  if (widget.render) {
    return <>{widget.render(widget.instanceIndex, placement)}</>;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { render, shouldInject, ...data } = widget;
  return <WidgetCard prompt={data} variant="compact" />;
}

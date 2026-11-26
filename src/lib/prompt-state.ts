import { useEffect, useRef, type RefObject } from "react";

/**
 * Vote and collection changes made outside a prompt's own buttons (an agent through WebMCP).
 * A refresh alone cannot reach the buttons: when the refreshed value equals the one they were
 * rendered with, they cannot tell it from their own unchanged props.
 */
export const PROMPT_STATE_EVENT = "prompts-chat:prompt-state";

export interface PromptStateChange {
  promptId: string;
  voted?: boolean;
  voteCount?: number;
  inCollection?: boolean;
}

export function publishPromptState(target: EventTarget, change: PromptStateChange): void {
  target.dispatchEvent(new CustomEvent<PromptStateChange>(PROMPT_STATE_EVENT, { detail: change }));
}

/**
 * Calls `onChange` with changes to `promptId` published on the document; it returns whether it
 * applied anything. Returns the number of applied changes so far: a request that started before
 * one must not overwrite it when its response arrives later.
 */
export function usePromptStateChanges(
  promptId: string | undefined,
  onChange: (change: PromptStateChange) => boolean,
): RefObject<number> {
  const onChangeRef = useRef(onChange);
  const revision = useRef(0);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!promptId) return;
    const listener = (event: Event) => {
      const change = (event as CustomEvent<PromptStateChange>).detail;
      if (change?.promptId !== promptId) return;
      if (onChangeRef.current(change)) revision.current += 1;
    };
    document.addEventListener(PROMPT_STATE_EVENT, listener);
    return () => document.removeEventListener(PROMPT_STATE_EVENT, listener);
  }, [promptId]);

  return revision;
}

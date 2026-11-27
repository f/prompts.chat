import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BotPairingPicker, type BotPairingValue } from "@/components/bots/bot-pairing-picker";

function Harness({ initial = [] }: { initial?: BotPairingValue[] }) {
  const [value, setValue] = useState<BotPairingValue[]>(initial);
  return (
    <>
      <BotPairingPicker botId="self" value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value.map(({ botId, note }) => ({ botId, note })))}</output>
    </>
  );
}

const results = [
  { id: "self", name: "This bot", icon: null, color: null },
  { id: "a", name: "Inbox Digest", icon: "mail", color: "sky" },
  { id: "b", name: "Calendar Prep", icon: "calendar", color: null },
];

describe("BotPairingPicker", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bots: results }) }) as never;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches bots and offers them without the bot being edited or already paired ones", async () => {
    render(<Harness initial={[{ botId: "b", title: "Calendar Prep", icon: null, color: null, note: "" }]} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "in, box" } });

    expect(await screen.findByRole("option", { name: /Inbox Digest/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /This bot/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Calendar Prep/ })).not.toBeInTheDocument();
    const url = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(url).toContain("/api/bots?");
    expect(new URL(url, "http://localhost").searchParams.get("q")).toBe("in  box");
  });

  it("adds a bot and edits its note", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "inbox" } });
    fireEvent.click(await screen.findByRole("option", { name: /Inbox Digest/ }));

    const note = screen.getByLabelText("pairingNoteLabel");
    fireEvent.change(note, { target: { value: "Reads the same inbox" } });

    await waitFor(() =>
      expect(screen.getByTestId("value").textContent).toBe(JSON.stringify([{ botId: "a", note: "Reads the same inbox" }]))
    );
  });

  it("removes a paired bot", () => {
    render(<Harness initial={[{ botId: "b", title: "Calendar Prep", icon: null, color: null, note: "x" }]} />);
    fireEvent.click(screen.getByLabelText("removePairing"));
    expect(screen.getByTestId("value").textContent).toBe("[]");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DangerZone } from "@/components/settings/danger-zone";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DangerZone Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost:3000/mock-blob");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders the Danger Zone card with Export and Delete options", () => {
    render(<DangerZone username="testuser" />);

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
    expect(screen.getByText("exportTitle")).toBeInTheDocument();
    expect(screen.getByText("exportButton")).toBeInTheDocument();
    expect(screen.getByText("deleteTitle")).toBeInTheDocument();
    expect(screen.getByText("deleteButton")).toBeInTheDocument();
  });

  it("handles successful data export and triggers browser download", async () => {
    const mockBlob = new Blob(["{}"], { type: "application/json" });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="prompts-export-testuser.json"',
      }),
    } as Response);

    render(<DangerZone username="testuser" />);

    const exportBtn = screen.getByText("exportButton");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/user/export");
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("exportSuccess");
    });
  });

  it("shows an error toast if data export fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
    } as Response);

    render(<DangerZone username="testuser" />);

    const exportBtn = screen.getByText("exportButton");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("exportFailed");
    });
  });

  it("opens the confirmation dialog and disables delete action until username matches", async () => {
    render(<DangerZone username="testuser" />);

    const deleteBtn = screen.getByText("deleteButton");
    fireEvent.click(deleteBtn);

    // Dialog should be open
    expect(screen.getByText("dialogTitle")).toBeInTheDocument();
    expect(screen.getByText("dialogDescription")).toBeInTheDocument();

    // The confirm action inside dialog footer
    const confirmAction = screen.getAllByText("deleteButton")[1];
    expect(confirmAction).toBeDisabled();

    // Type incorrect username
    const input = screen.getByPlaceholderText("testuser");
    fireEvent.change(input, { target: { value: "wronguser" } });
    expect(confirmAction).toBeDisabled();

    // Type correct username
    fireEvent.change(input, { target: { value: "testuser" } });
    expect(confirmAction).not.toBeDisabled();
  });

  it("successfully calls DELETE /api/user and signs out user upon confirmation", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    render(<DangerZone username="testuser" />);

    // Open dialog
    fireEvent.click(screen.getByText("deleteButton"));

    // Type correct username
    const input = screen.getByPlaceholderText("testuser");
    fireEvent.change(input, { target: { value: "testuser" } });

    // Click confirm
    const confirmAction = screen.getAllByText("deleteButton")[1];
    fireEvent.click(confirmAction);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/user", { method: "DELETE" });
      expect(toast.success).toHaveBeenCalledWith("deleteSuccess");
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });
  });

  it("handles delete API failure gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "last_admin", message: "Cannot delete sole admin" }),
    } as Response);

    render(<DangerZone username="testuser" />);

    fireEvent.click(screen.getByText("deleteButton"));
    const input = screen.getByPlaceholderText("testuser");
    fireEvent.change(input, { target: { value: "testuser" } });

    const confirmAction = screen.getAllByText("deleteButton")[1];
    fireEvent.click(confirmAction);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cannot delete sole admin");
      expect(signOut).not.toHaveBeenCalled();
    });
  });
});

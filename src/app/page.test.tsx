import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

describe("Home", () => {
  it("renders the Saturday Signal product shell", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", { name: "Saturday Signal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Texas · 2026 season/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Next three" }),
    ).toBeInTheDocument();
  });

  it("derives the team palette into --team-* custom properties", async () => {
    const { container } = render(await Home());
    const root = container.querySelector("main");

    // Components consume --team-* and nothing else, so this is the seam that
    // has to hold when a new team is added as three OKLCH numbers.
    expect(root?.getAttribute("style")).toContain("--team-light-accent: oklch(");
    expect(root?.getAttribute("style")).toContain("--team-dark-accent: oklch(");
    expect(root?.getAttribute("style")).toContain("--team-light-steel: oklch(");
  });
});

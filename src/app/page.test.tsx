import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

describe("Saturday Signal home", () => {
  it("leads with the fan promise, not the product name", async () => {
    render(await HomePage());

    // The wordmark is site identity in the masthead; the page's own h1 is the
    // promise. Two competing h1s would flatten the document outline.
    expect(
      screen.getByRole("heading", { level: 1, name: /know what matters before kickoff/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saturday Signal home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("offers both a request action and a route into a live edition", async () => {
    render(await HomePage());

    expect(screen.getAllByRole("link", { name: /see a live edition/i })[0]).toHaveAttribute(
      "href",
      "/teams/texas-football",
    );
    expect(screen.getByRole("button", { name: /request this team/i })).toBeInTheDocument();
  });

  it("shows a live edition using real schedule data", async () => {
    render(await HomePage());

    const edition = screen.getByRole("link", { name: /texas football/i });

    // Pulled from the same config and schedule the edition page renders, so
    // the card cannot drift out of sync with the product it advertises.
    expect(within(edition).getByText(/days out|Today|Kickoff TBD/)).toBeInTheDocument();
    expect(within(edition).getByText(/Schedule checked/)).toBeInTheDocument();
  });

  // Scale is one edition. Claiming a network would be the first thing a fan
  // caught us on.
  it("states the honest number of live editions", async () => {
    render(await HomePage());

    expect(screen.getByText(/one edition live/i)).toBeInTheDocument();
  });

  it("carries the independence disclaimer", async () => {
    render(await HomePage());

    expect(screen.getByText(/not affiliated with any school/i)).toBeInTheDocument();
  });

  it("derives the house palette into --team-* custom properties", async () => {
    const { container } = render(await HomePage());
    const root = container.querySelector("main");

    // The home page belongs to the product rather than a team, but it uses the
    // same token bridge so light and dark work identically on both surfaces.
    expect(root?.getAttribute("style")).toContain("--team-light-accent: oklch(");
    expect(root?.getAttribute("style")).toContain("--team-dark-accent: oklch(");
    expect(root?.getAttribute("style")).toContain("--team-light-steel: oklch(");
  });
});

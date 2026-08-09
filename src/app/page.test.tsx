import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { enabledTeamSlugs } from "@/config/team";
import HomePage from "./page";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

describe("Section One home", () => {
  it("leads with the fan promise, not the product name", async () => {
    render(await HomePage());

    // The wordmark is site identity in the masthead; the page's own h1 is the
    // promise. Two competing h1s would flatten the document outline.
    expect(
      screen.getByRole("heading", { level: 1, name: /your team\. your section\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Section One home" })).toHaveAttribute(
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

  // Claiming a network would be the first thing a fan caught us on, so the
  // count is asserted against the editions that actually render rather than
  // against a sentence someone typed.
  it("states the honest number of live editions", async () => {
    const { container } = render(await HomePage());

    expect(screen.getByText(/2 editions live/i)).toBeInTheDocument();
    expect(container.querySelectorAll('#editions a[href^="/teams/"]')).toHaveLength(
      enabledTeamSlugs.length,
    );
  });

  it("gives each edition card the accent of its own team", async () => {
    const { container } = render(await HomePage());
    const accents = [...container.querySelectorAll<HTMLElement>('#editions a[href^="/teams/"]')].map(
      (card) => card.style.getPropertyValue("--edition-light-accent"),
    );

    // The page stays house-coloured; the card carries a sample. Identical
    // samples would mean the theming is not actually per team.
    expect(accents.every((accent) => accent.startsWith("oklch("))).toBe(true);
    expect(new Set(accents).size).toBe(accents.length);
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

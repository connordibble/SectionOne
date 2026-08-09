# Legal Notes

Section One is an independent fan project. It is not affiliated with, endorsed by, or sponsored by any school, athletics department, conference, or the NCAA. This covers every live edition — currently The University of Texas at Austin and Utah State University — and every edition added later.

## MVP Guardrails

- Do not use official school logos, mascot imagery, a mascot name as product branding (Bevo for Texas, Big Blue for Utah State), protected hand signs, or official-looking trade dress.
- Colour is treated differently from marks. Editions get as close to a school's real colours as contrast allows, because a hue is not a mark and hedging it protects nothing. Logos, mascots, and trade dress remain off limits.
- Use factual, source-backed sports data and link to sources instead of copying large expressive passages.
- Keep provider API keys out of the repository.
- Document provider terms before enabling commercial or hosted deployments.

## Data Sources In MVP1

- Offline schedule fixtures are derived from public 2026 team schedule pages and stored as factual schedule metadata. They are regenerated from CollegeFootballData via `pnpm schedule:build` rather than maintained by hand.
- Poll standings are stored as ranks only and attributed to the outlet that published them.
- Weekly news items carry the reporting outlet and a link to the original. Section One writes the one-sentence takeaway; it does not reproduce the reporting.
- CollegeFootballData is supported as an optional live provider when a user supplies their own API key.
- Answers should cite source documents and include freshness language when presenting schedule or game context.

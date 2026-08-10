type SectionMarkProps = {
  className?: string;
  // Decorative by default. Give it a title only where the mark is the sole
  // thing identifying the surface.
  title?: string;
};

// The Section One mark, as geometry rather than as a picture of geometry.
//
// The supplied raster has no alpha channel — its cream ground is part of the
// image — so anywhere it appeared it forced a cream tile onto the surface
// underneath. Traced to a path, the mark takes `currentColor` and can sit on a
// team's stage, the chrome, or paper in either theme without a badge around it.
//
// Two subpaths, not one shape with a hole: the numeral is the space between
// the lobes, so it stays open at the top and bottom the way the drawn mark is.
export function SectionMark({ className, title }: SectionMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      viewBox="0 0 237 344"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path d="M109 0L110 0L110 49L105 54L100 57L69 82L69 100L70 101L90 101L90 295L91 296L110 296L110 343L103 343L102 342L87 340L72 335L63 330L61 330L48 322L39 315L26 302L16 288L10 277L4 260L4 257L2 252L2 247L1 246L1 238L0 237L0 108L1 107L2 92L8 71L15 57L21 48L35 32L50 20L68 10L94 2L108 1ZM128 0L129 1L144 2L164 8L187 20L202 32L218 51L223 61L225 63L225 65L229 72L233 84L234 92L235 93L235 99L236 100L236 243L235 244L235 250L234 251L232 263L229 269L228 274L219 291L210 303L198 315L189 322L180 328L166 335L161 336L158 338L155 338L146 341L142 341L141 342L136 342L135 343L128 343L128 327L127 326L128 295L149 279L149 50L148 49L128 49L128 21L127 20Z" />
    </svg>
  );
}

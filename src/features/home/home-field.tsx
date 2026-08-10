import { SectionMark } from "@/features/brand/section-mark";
import styles from "./home.module.css";

// The home page's one piece of Field Geometry.
//
// It is the same language as an edition's kickoff object — ruled field, hash
// marks, a route that resolves — but drawn on paper in the page's own border
// and accent roles rather than on a team's stage. The home page borrows the
// signature so the pitch and the product read as one thing; it does not borrow
// the stage, because a bold colour field here would make this page look like an
// edition, and the two surfaces have to stay distinguishable.
//
// The route ends at the mark. That is the argument the page is making: a week
// of scattered coverage resolves into one read.
export function HomeField() {
  return (
    <div aria-hidden="true" className={styles.heroField}>
      <svg
        className={styles.heroFieldDrawing}
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 640 480"
      >
        <g className={styles.heroFieldLines}>
          <path d="M80 0V480" />
          <path d="M160 0V480" />
          <path d="M240 0V480" />
          <path d="M320 0V480" />
          <path d="M400 0V480" />
          <path d="M480 0V480" />
          <path d="M560 0V480" />
          <path d="M0 120H640" />
          <path d="M0 240H640" />
          <path d="M0 360H640" />
        </g>
        <g className={styles.heroFieldHashes}>
          <path d="M120 216V264M200 216V264M280 216V264" />
          <path d="M360 216V264M440 216V264M520 216V264" />
        </g>
        <path
          className={styles.heroFieldRoute}
          d="M72 404C176 404 208 356 268 286S404 168 512 152"
        />
        <path className={styles.heroFieldRouteStart} d="M72 404L44 386M72 404L44 422" />
      </svg>

      <SectionMark className={styles.heroFieldMark} />
    </div>
  );
}

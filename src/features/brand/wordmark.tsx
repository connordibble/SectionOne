import Link from "next/link";
import styles from "./brand.module.css";

type WordmarkProps = {
  // The home page's h1 is the fan promise and an edition's is the matchup, so
  // the wordmark is a paragraph on both. It is site identity, not a heading.
  tagline?: boolean;
};

// The Section One name, typeset rather than placed.
//
// The supplied wordmark raster has no alpha channel — its cream ground is baked
// into the pixels — so any surface carrying it had to be cream too. That is
// what pinned the edition masthead to paper in dark mode. Setting the name in
// the display face instead lets the house brand follow the theme while staying
// the same colour on every edition.
export function Wordmark({ tagline = true }: WordmarkProps) {
  return (
    <div className={styles.brandBlock}>
      <p className={styles.wordmark}>
        <Link aria-label="Section One home" className={styles.wordmarkLink} href="/">
          <span>Section</span>
          <span className={styles.wordmarkAccent}>One</span>
        </Link>
      </p>
      {tagline ? <p className={styles.brandTagline}>All signal. No noise.</p> : null}
    </div>
  );
}

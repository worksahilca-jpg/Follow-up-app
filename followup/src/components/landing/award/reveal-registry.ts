// One shared, rAF-throttled scroll/resize listener for every RevealAward
// instance on the page, instead of each mounted instance adding its own —
// mirrors the "single querySelectorAll('.reveal') pass" the original
// vanilla exploration used, translated into a React-friendly pub/sub.
type Check = () => void;

const checks = new Set<Check>();
let listening = false;
let ticking = false;

function runAll() {
  ticking = false;
  checks.forEach((check) => check());
}

function onScrollOrResize() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(runAll);
}

/**
 * Registers a callback that re-checks one element's own position on every
 * scroll/resize (and once immediately, in case it's already in view on
 * mount — covers a page load that starts mid-scroll, e.g. a hash link).
 * Checking the element's own bounding rect on every scroll/resize tick
 * — rather than relying solely on IntersectionObserver's sampling —
 * means a fast programmatic scroll or an instant jump can't skip an
 * element between two observed instants and leave it permanently hidden.
 */
export function registerRevealCheck(check: Check): () => void {
  checks.add(check);
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    listening = true;
  }
  check();
  return () => {
    checks.delete(check);
    if (checks.size === 0 && listening) {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      listening = false;
    }
  };
}

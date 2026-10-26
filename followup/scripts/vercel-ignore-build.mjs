// Vercel's Ignored Build Step (vercel.json "ignoreCommand"). Exit 0 skips the
// build, exit 1 builds it. Only main builds: a preview copy of every pushed
// branch was most of the Vercel bill, and the spending cap paused the whole
// app on 2026-10-25.
//
// The first version was an inline `[ "$VERCEL_ENV" != "production" ]`. It
// skipped the production build of its own merge too (2026-10-26), so this
// skips only when it positively knows the build is not main, and builds
// whenever it can't tell. A wrongly skipped release is worse than one
// unneeded preview build.
const env = process.env.VERCEL_ENV ?? "";
const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";

let build;
if (env === "production" || ref === "main") build = true;
else if (env === "preview" || env === "development" || ref !== "") build = false;
else build = true;

console.log(
  `Ignored Build Step: VERCEL_ENV=${env || "(unset)"} VERCEL_GIT_COMMIT_REF=${ref || "(unset)"} -> ${build ? "build" : "skip"}`
);
process.exit(build ? 1 : 0);

// Applies database migrations during a build, but never from a Vercel
// preview. Previews build every pushed PR branch with the same DATABASE_URL
// as production, so a preview used to change the live database before
// anyone had merged (or even reviewed) the PR: PR #406's columns were added
// to production 11 minutes before its merge. Only the production deploy,
// which runs after a merge to main, applies migrations now. Local builds
// and CI (no VERCEL_ENV) behave as before.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development") {
  console.log(`Skipping prisma migrate deploy on a ${process.env.VERCEL_ENV} build: only production applies database changes.`);
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) {
  // Same as before: a failed migration doesn't stop the build.
  console.log(
    "WARNING: prisma migrate deploy failed — continuing build without applying migrations. Run `npx prisma migrate deploy` manually against DATABASE_URL/DIRECT_URL to apply them."
  );
}

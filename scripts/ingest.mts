import "dotenv/config";
import { runIngest } from "@/ingest/run";
import { jevMode } from "@/lib/env";

// npm run ingest -- [--dry] [--boards=N] [--max=N]
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"] as const;
  }),
);

const started = Date.now();
console.log(`[ingest] Jev mode: ${jevMode()}${jevMode() === "offline" ? " (dev stand-in, set TYPESAFE_API_KEY for real classification)" : ""}`);
const stats = await runIngest({
  dry: args.has("dry"),
  maxBoards: args.has("boards") ? Number(args.get("boards")) : undefined,
  maxClassify: args.has("max") ? Number(args.get("max")) : undefined,
  log: (m) => console.log(`[ingest] ${m}`),
});
console.table(stats.perSource);
console.log(`[ingest] finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(0);

import { runIngest } from "@/ingest/run";
import { cronAuthorized } from "@/lib/cron";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const stats = await runIngest({ log: (m) => console.log(`[ingest] ${m}`) });
  return Response.json(stats);
}

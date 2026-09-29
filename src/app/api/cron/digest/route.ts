import { runDigests } from "@/email/runDigests";
import { cronAuthorized } from "@/lib/cron";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await runDigests((m) => console.log(`[digest] ${m}`));
  return Response.json(result);
}

import "server-only";
import { computeDibRoutes } from "./dib-route";
import { computeDrivingRoute } from "./google-route";

export async function computeTravelRoutes(origin: string, destination: string, fuel: string, date: string, time: string, autoPass: boolean, returnTrip?: { date: string; time: string }) {
  if (process.env.DIB_TOLL_API_KEY) return computeDibRoutes(origin, destination, fuel, date, time, autoPass, returnTrip);
  const outbound = await computeDrivingRoute(origin, destination, fuel);
  const inbound = returnTrip ? await computeDrivingRoute(destination, origin, fuel) : undefined;
  return { ...outbound, source: "GOOGLE" as const, returnRoute: inbound ? { ...inbound, source: "GOOGLE" as const } : undefined };
}

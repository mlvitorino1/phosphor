export const newsChannels = [
  { name: "CNN", domains: ["cnn.com"] },
  { name: "BBC News", domains: ["bbc.com", "bbc.co.uk"] },
  { name: "Globo / g1", domains: ["g1.globo.com"] },
] as const;

export type NewsChannel = (typeof newsChannels)[number];

export function newsChannelForUrl(value: string): NewsChannel | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    return (
      newsChannels.find((channel) =>
        channel.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function newsChannelQuery(enabled: readonly NewsChannel[]) {
  if (!enabled.length) return null;
  const domains = enabled.flatMap((channel) => [...channel.domains]);
  const publishers = domains.map((domain) => `domain:${domain}`).join(" OR ");
  const events = [
    "tornado",
    "earthquake",
    "flood",
    "wildfire",
    "hurricane",
    "tsunami",
    "evacuation",
    "outbreak",
    "explosion",
    "eruption",
    "landslide",
    "drought",
    '"port closure"',
    '"power outage"',
    '"transport strike"',
    '"supply chain"',
    "refinery",
    "railway",
    '"oil spill"',
    "sanctions",
    "blockade",
    "protest",
  ].join(" OR ");
  return `(${publishers}) (${events})`;
}

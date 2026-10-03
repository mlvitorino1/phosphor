import { getDomain } from "tldts";
import { newsChannelForUrl } from "./news-channels";

/** A root domain/channel groups obvious copies; it does not establish editorial independence. */
export function publisherIdentity(value: string): string | null {
  try {
    const url = new URL(value);
    const channel = newsChannelForUrl(value);
    return channel?.name ?? getDomain(url.hostname, { allowPrivateDomains: true });
  } catch {
    return null;
  }
}

export function distinctPublishers(left: string, right: string): boolean {
  const a = publisherIdentity(left),
    b = publisherIdentity(right);
  return Boolean(a && b && a !== b);
}

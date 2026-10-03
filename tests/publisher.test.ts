import { expect, it } from "vitest";
import { distinctPublishers, publisherIdentity } from "@/lib/domain/publisher";

it("groups subdomains and known channel domains without claiming editorial independence", () => {
  expect(distinctPublishers("https://edition.cnn.com/story", "https://www.cnn.com/story")).toBe(
    false,
  );
  expect(distinctPublishers("https://bbc.com/story", "https://bbc.co.uk/story")).toBe(false);
  expect(distinctPublishers("https://a.example.co.uk/story", "https://b.example.co.uk/story")).toBe(
    false,
  );
  expect(distinctPublishers("https://example.co.uk/story", "https://example.org/story")).toBe(true);
  expect(publisherIdentity("invalid")).toBeNull();
});

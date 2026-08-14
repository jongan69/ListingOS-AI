const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeXmlText(value: string): string {
  const text = value.startsWith("<![CDATA[") && value.endsWith("]]>")
    ? value.slice(9, -3)
    : value;
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (entity, name) => (
    XML_ENTITIES[name] ?? entity
  ));
}

export function isAllowedEbayImageUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  return url.protocol === "https:" && (
    hostname === "ebayimg.com" || hostname.endsWith(".ebayimg.com")
  );
}

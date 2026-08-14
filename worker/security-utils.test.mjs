import { describe, expect, test } from "bun:test";

import { decodeXmlText, isAllowedEbayImageUrl } from "./security-utils.ts";

describe("worker security utilities", () => {
  test("decodes XML entities exactly once", () => {
    expect(decodeXmlText("&amp;lt;safe&amp;gt;")).toBe("&lt;safe&gt;");
    expect(decodeXmlText("<![CDATA[Rock &amp; Roll]]>")).toBe("Rock & Roll");
  });

  test("accepts only HTTPS eBay image hosts", () => {
    expect(isAllowedEbayImageUrl(new URL("https://i.ebayimg.com/image.jpg"))).toBe(true);
    expect(isAllowedEbayImageUrl(new URL("https://ebayimg.com/image.jpg"))).toBe(true);
    expect(isAllowedEbayImageUrl(new URL("https://evil-ebayimg.com/image.jpg"))).toBe(false);
    expect(isAllowedEbayImageUrl(new URL("http://i.ebayimg.com/image.jpg"))).toBe(false);
  });
});

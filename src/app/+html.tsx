import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import { Children, isValidElement, type ReactNode } from "react";

const DEFAULT_TITLE = "ListingOS | Photos in. Listing out.";
const DEFAULT_DESCRIPTION = "Camera-first AI listing workflow for eBay sellers.";

export default function RootHtml({ children }: { children: ReactNode }) {
  const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } = useServerDocumentContext();
  const resolvedHeadNodes = Children.toArray(headNodes).filter((node) => (
    !isValidElement(node) || node.type !== "title"
  ));
  const hasDescription = hasMeta(resolvedHeadNodes, "description");
  const hasRobots = hasMeta(resolvedHeadNodes, "robots");

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <title>{DEFAULT_TITLE}</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="dark light" />
        {!hasDescription ? <meta name="description" content={DEFAULT_DESCRIPTION} /> : null}
        {!hasRobots ? <meta name="robots" content="noindex,nofollow" /> : null}
        <ScrollViewStyleReset />
        {resolvedHeadNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

function hasMeta(nodes: ReactNode[], name: string) {
  return nodes.some((node) => (
    isValidElement<{ name?: string }>(node)
    && node.type === "meta"
    && node.props.name === name
  ));
}

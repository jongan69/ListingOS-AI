#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const markdownFiles = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.md"],
  {
    cwd: root,
    encoding: "utf8",
  },
);

if (markdownFiles.status !== 0) {
  process.stderr.write(markdownFiles.stderr);
  process.exit(markdownFiles.status ?? 1);
}

const broken = [];
const files = [...new Set(markdownFiles.stdout.split("\n").filter(Boolean))];
for (const file of files) {
  const absoluteFile = resolve(root, file);
  const contents = readFileSync(absoluteFile, "utf8");
  const targets = [
    ...contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g),
    ...contents.matchAll(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1].trim());

  for (const rawTarget of targets) {
    const target = rawTarget.replace(/^<|>$/g, "").split(/\s+["']/)[0];
    if (!target || target.startsWith("#") || target.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

    const pathOnly = decodeURIComponent(target.split("#")[0].split("?")[0]);
    if (!pathOnly) continue;
    const absoluteTarget = resolve(dirname(absoluteFile), pathOnly);
    if (!existsSync(absoluteTarget)) broken.push(`${file}: ${target}`);
  }
}

if (broken.length > 0) {
  console.error("Broken local documentation links:\n" + broken.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Checked ${files.length} source-controlled Markdown files.`);

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();
const sourcePath = process.env.GOOGLE_SERVICES_JSON;

if (!sourcePath) {
  console.log("GOOGLE_SERVICES_JSON is not set; using any local Firebase config already present.");
  process.exit(0);
}

const resolvedSource = path.resolve(projectRoot, sourcePath);

if (!fs.existsSync(resolvedSource)) {
  throw new Error(`GOOGLE_SERVICES_JSON does not point to a readable file: ${resolvedSource}`);
}

const targets = [
  path.join(projectRoot, "google-services.json"),
  path.join(projectRoot, "android", "app", "google-services.json"),
];

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(resolvedSource, target);
  console.log(`Prepared Firebase config: ${path.relative(projectRoot, target)}`);
}

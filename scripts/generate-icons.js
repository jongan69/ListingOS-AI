#!/usr/bin/env node
/* global __dirname */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "assets/listingos-mark.png");
const shiftDownPx = 96;

async function makeShiftedIcon(size) {
  // Sharp may reorder extend/resize in a single pipeline, so keep these as
  // explicit stages to guarantee square launcher outputs.
  const cropped = await sharp(source)
    .extract({ left: 0, top: 0, width: 1024, height: 1024 - shiftDownPx })
    .png()
    .toBuffer();

  const shifted = await sharp(cropped)
    .extend({ top: shiftDownPx, bottom: 0, left: 0, right: 0, extendWith: "copy" })
    .png()
    .toBuffer();

  return sharp(shifted).resize(size, size, { fit: "fill" }).png().toBuffer();
}

async function makeAdaptiveBackground(size) {
  const background = await sharp(source)
    .resize(1024, 1024, { fit: "cover" })
    .blur(36)
    .modulate({ brightness: 0.62, saturation: 0.85 })
    .png()
    .toBuffer();

  return sharp(background).resize(size, size, { fit: "cover" }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing launcher source: ${source}`);
  }

  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });

  const icon1024 = await makeShiftedIcon(1024);
  await sharp(icon1024).toFile(path.join(root, "assets/icon.png"));
  await sharp(icon1024).resize(48, 48).toFile(path.join(root, "assets/favicon.png"));
  await sharp(icon1024).toFile(path.join(root, "artifacts/icon-recentered-preview.png"));

  const adaptiveBackground = await makeAdaptiveBackground(432);
  const adaptiveForeground = await makeShiftedIcon(432);
  await sharp(adaptiveBackground).toFile(path.join(root, "assets/android-icon-background.png"));
  await sharp(adaptiveForeground).toFile(path.join(root, "assets/android-icon-foreground.png"));
  await sharp(adaptiveForeground)
    .grayscale()
    .linear(1.15, -12)
    .toFile(path.join(root, "assets/android-icon-monochrome.png"));

  const files = [
    "assets/icon.png",
    "assets/android-icon-foreground.png",
    "assets/android-icon-background.png",
    "assets/android-icon-monochrome.png",
    "assets/favicon.png",
  ];

  const dimensions = await Promise.all(
    files.map(async (file) => {
      const metadata = await sharp(path.join(root, file)).metadata();
      return `${file} ${metadata.width}x${metadata.height}`;
    }),
  );

  console.log(`Generated centered launcher assets from ${path.relative(root, source)}`);
  console.log(dimensions.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

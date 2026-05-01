import sharp from "sharp";
import { mkdirSync, rmSync } from "fs";

async function run() {
  // Clean and recreate Assets folder every run
  rmSync("dist/msix-staging/Assets", { recursive: true, force: true });
  mkdirSync("dist/msix-staging/Assets", { recursive: true });

  const sizes = [
    { name: "StoreLogo.png", w: 50, h: 50 },
    { name: "Square44x44Logo.png", w: 44, h: 44 },
    { name: "Square150x150Logo.png", w: 150, h: 150 },
    { name: "Square310x310Logo.png", w: 310, h: 310 },
    { name: "Wide310x150Logo.png", w: 310, h: 150 },
    { name: "Square71x71Logo.png", w: 71, h: 71 },
    { name: "Square44x44Logo.scale-200.png", w: 88, h: 88 },
    { name: "Square150x150Logo.scale-200.png", w: 300, h: 300 },
  ];

  await Promise.all(
    sizes.map(({ name, w, h }) =>
      sharp("icon.png")
        .resize(w, h, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(`msix/Assets/${name}`)
        .then(() => console.log(`✅ ${name} (${w}x${h})`)),
    ),
  );

  console.log("\n🎉 All icons generated successfully.");
}

run();

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import JSZip from "jszip";

// Release packaging copies the reviewed runtime files; it never compiles source.
const files = [
  "host.js",
  "panel.js",
  "panel.html",
  "panel.css",
  "textus-plugin.json",
  "README.md",
  "README.zh.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];
const manifest = JSON.parse(await readFile("textus-plugin.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (manifest.version !== pkg.version) throw new Error("Version mismatch");
const tag = `v${manifest.version}`;
const verifyTag = process.argv.includes("--verify-tag");
const directory = `dist/${manifest.id}`;
await mkdir(directory, { recursive: true });
const zip = new JSZip();
for (const file of files) {
  const bytes = await readFile(file);
  if (verifyTag) {
    const tagged = execFileSync("git", ["show", `${tag}:${file}`]);
    if (!bytes.equals(tagged)) throw new Error(`${file} differs from ${tag}`);
  }
  await copyFile(file, `${directory}/${file}`);
  zip.file(file, bytes, { date: new Date("1980-01-01T00:00:00Z") });
}
const bytes = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
  platform: "UNIX",
});
const path = `dist/${manifest.id}-${manifest.version}.zip`;
await writeFile(path, bytes);
console.log(`${createHash("sha256").update(bytes).digest("hex")}  ${path}`);
console.log(
  `${files.length} files, ${bytes.length} bytes${verifyTag ? `; identical to ${tag}` : ""}.`,
);

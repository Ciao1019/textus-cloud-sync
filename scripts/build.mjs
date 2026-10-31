import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

const id = "ciao1019.cloud-sync";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const check = process.argv.includes("--check");
const generated = new Map();
const host = await build({
  entryPoints: ["src/host.ts"],
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: "es2020",
  outfile: "host.js",
  write: false,
  legalComments: "inline",
});
const panel = await build({
  entryPoints: ["src/panel.ts"],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  outfile: "panel.js",
  write: false,
  legalComments: "inline",
});
const translations = JSON.parse(await readFile("locales.json", "utf8"));
const l10n = Object.fromEntries(
  ["en", "zh", "zh-Hant", "ja", "ko", "es", "fr", "de", "ru", "pt"].map(
    (language) => [
      language,
      { ...translations.en, ...(translations[language] ?? {}) },
    ],
  ),
);
const manifest = {
  id,
  name: "%name%",
  description: "%description%",
  version,
  publisher: "ciao1019",
  author: "Ciao1019",
  license: "MIT",
  engines: { textus: ">=1.3.0-beta.6" },
  icon: "icon.svg",
  platforms: ["desktop"],
  main: "host.js",
  permissions: ["files.read", "files.write", "network:*"],
  activationEvents: ["onStartupFinished"],
  contributes: {
    commands: [
      { command: `${id}.open`, title: "%open%" },
      { command: `${id}.sync`, title: "%sync%" },
    ],
    menus: {
      "app/plugins": [{ command: `${id}.open` }, { command: `${id}.sync` }],
    },
    views: [{ id: `${id}.panel`, title: "%name%", type: "webview" }],
    settingsPage: { title: "%name%" },
  },
  l10n,
};
generated.set("host.js", Buffer.from(host.outputFiles[0].contents));
generated.set("panel.js", Buffer.from(panel.outputFiles[0].contents));
generated.set(
  "textus-plugin.json",
  Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
);
for (const file of ["panel.html", "panel.css"])
  generated.set(file, await readFile(`ui/${file}`));
for (const [file, bytes] of generated) {
  if (check) {
    const existing = await readFile(file).catch(() => null);
    if (!existing?.equals(bytes))
      throw new Error(
        `${file} is stale; run npm run build and commit the output.`,
      );
  } else await writeFile(file, bytes);
}
console.log(
  `${check ? "Verified" : "Updated"} ${generated.size} readable runtime files.`,
);

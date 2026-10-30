import type { Config, Result } from "./model";

const api = acquireTextusApi();
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const buttons = ["sync", "test", "unlock"];
const secretFields = [
  "account",
  "secret",
  "token",
  "sync-password",
  "confirm-password",
];
let initialized = false;
let dirty = false;
let root: string | null = null;
let busy = false;
let configured = false;

document.documentElement.lang = api.language;
for (const item of document.querySelectorAll<HTMLElement>("[data-t]"))
  item.textContent = api.t(item.dataset.t!);
document
  .querySelector("section.sync-status")
  ?.setAttribute("aria-label", api.t("name"));

function toggles() {
  const provider = input("provider").value;
  element("s3-fields").hidden = provider !== "s3";
  element("token-field").hidden = provider !== "s3";
  element("nutstore-help").hidden = provider !== "nutstore";
  input("endpoint").readOnly = provider === "nutstore";
  input("endpoint").required = provider !== "s3";
  if (provider === "nutstore")
    input("endpoint").value = "https://dav.jianguoyun.com/dav";
  input("bucket").required = provider === "s3";
  element("interval-field").hidden = !input("automatic").checked;
  for (const id of buttons)
    element<HTMLButtonElement>(id).disabled =
      busy || !root || !configured || dirty;
}
function fill(config: Config) {
  for (const id of [
    "provider",
    "endpoint",
    "region",
    "bucket",
    "prefix",
    "interval",
  ] as const)
    input(id).value = String(config[id]);
  for (const id of ["pathStyle", "automatic"] as const)
    input(id).checked = config[id];
  toggles();
}
element("connection").addEventListener("input", () => {
  dirty = true;
  toggles();
});
element("connection").addEventListener("change", () => {
  dirty = true;
  toggles();
});
input("provider").addEventListener("change", () => {
  input("endpoint").value = "";
  for (const id of secretFields) input(id).value = "";
  toggles();
});
function save() {
  if (busy) return;
  if (!element<HTMLFormElement>("connection").reportValidity()) return;
  const config = {
    provider: input("provider").value,
    endpoint: input("endpoint").value,
    region: input("region").value,
    bucket: input("bucket").value,
    prefix: input("prefix").value,
    pathStyle: input("pathStyle").checked,
    automatic: input("automatic").checked,
    interval: Number(input("interval").value),
  };
  api.postMessage({
    type: "save",
    config,
    credentials: {
      account: input("account").value,
      secret: input("secret").value,
      sessionToken: input("token").value,
      syncPassword: input("sync-password").value,
      confirmPassword: input("confirm-password").value,
    },
  });
}
// Textus intentionally omits allow-forms from webview sandboxes. Submit
// through the message bridge, including Enter, without native form submission.
element("save").onclick = save;
element("connection").addEventListener("submit", (event) =>
  event.preventDefault(),
);
element("connection").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    save();
  }
});
for (const id of [...buttons, "cancel"])
  element(id).onclick = () => api.postMessage({ type: id });

function showResult(result?: Result) {
  const container = element("results");
  container.replaceChildren();
  for (const key of ["conflicts", "deferred"] as const) {
    const entries = result?.[key];
    if (!entries?.length) continue;
    const title = document.createElement("h2");
    title.textContent = api.t(key);
    const list = document.createElement("ul");
    for (const path of entries) {
      const row = document.createElement("li");
      row.textContent = path;
      list.append(row);
    }
    container.append(title, list);
  }
}
api.onMessage((value) => {
  const m = value as {
    type: string;
    root: string | null;
    config: Config;
    busy: boolean;
    configured: boolean;
    message: string;
    error: boolean;
    progress: number | null;
    result?: Result;
    lastRun?: string;
  };
  if (m.type === "saved") {
    dirty = false;
    initialized = false;
    for (const id of secretFields) input(id).value = "";
    api.postMessage({ type: "ready" });
    return;
  }
  if (m.type !== "state") return;
  busy = m.busy;
  configured = m.configured;
  if (!initialized || root !== m.root) {
    if (root !== m.root) for (const id of secretFields) input(id).value = "";
    fill(m.config);
    initialized = true;
    dirty = false;
  }
  root = m.root;
  element("root").textContent = root ?? "";
  element("status").textContent = m.message || api.t("loading");
  element("status").dataset.error = String(m.error);
  element<HTMLFieldSetElement>("fields").disabled = busy || !root;
  element("cancel").hidden = !busy;
  const progress = element<HTMLProgressElement>("progress");
  progress.hidden = !busy;
  if (m.progress == null) progress.removeAttribute("value");
  else {
    progress.max = 1;
    progress.value = m.progress;
  }
  element("credentials-state").textContent = api.t(
    configured ? "credentialsSaved" : "credentialsMissing",
  );
  const last = element("last-run");
  last.hidden = !m.lastRun;
  last.textContent = m.lastRun
    ? `${api.t("lastRun")} · ${new Date(m.lastRun).toLocaleString(api.language)}`
    : "";
  showResult(m.result);
  toggles();
});
api.postMessage({ type: "ready" });

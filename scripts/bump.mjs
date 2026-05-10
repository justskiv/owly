#!/usr/bin/env node
// Bumps the version in package.json + src-tauri/Cargo.toml in lockstep,
// then refreshes Cargo.lock so CI doesn't carry the old version.
// tauri.conf.json reads version from Cargo.toml when omitted, so it's
// not a third source of truth — see tauri-apps/tauri#8265.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/bump.mjs <x.y.z>");
  process.exit(1);
}

execSync(
  `npm version --no-git-tag-version --allow-same-version ${version}`,
  { stdio: "inherit" },
);

const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8");
const updated = cargo.replace(
  /^version = "[^"]+"$/m,
  `version = "${version}"`,
);
if (cargo === updated) {
  console.error("error: did not find version line in Cargo.toml");
  process.exit(1);
}
writeFileSync(cargoPath, updated);

execSync(
  `cargo update -p owly --manifest-path ${cargoPath}`,
  { stdio: "inherit" },
);

console.log(`✓ bumped to ${version}`);

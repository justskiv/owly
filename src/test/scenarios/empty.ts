import { ROOT, VirtualFS } from "../virtual-fs";
import { DEFAULT_CONFIG } from "../../services/defaults";

// First-run state: only config.json on disk + empty commands/
// directories. Everything else (entities/schedule/pool/horizon) is
// created lazily by the boot path's readJsonFileOrCreate helpers.
export function empty(): VirtualFS {
  const fs = new VirtualFS();
  fs.write(`${ROOT}/config.json`, JSON.stringify(DEFAULT_CONFIG, null, 2));
  fs.ensureDir(`${ROOT}/commands/pending`);
  fs.ensureDir(`${ROOT}/commands/done`);
  fs.ensureDir(`${ROOT}/commands/failed`);
  return fs;
}

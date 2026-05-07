export { buildTask, resetTaskCounter } from "./task";
export { buildProject, resetProjectCounter } from "./project";
export { buildDirection, resetDirectionCounter } from "./direction";
export { buildBlock, resetBlockCounter } from "./block";
export { buildPoolItem, resetPoolItemCounter } from "./pool";
export { buildHorizonProject, resetHorizonCounter } from "./horizon";
export { buildCommand, resetCommandCounter } from "./command";
export * from "./traits";

import { resetTaskCounter } from "./task";
import { resetProjectCounter } from "./project";
import { resetDirectionCounter } from "./direction";
import { resetBlockCounter } from "./block";
import { resetPoolItemCounter } from "./pool";
import { resetHorizonCounter } from "./horizon";
import { resetCommandCounter } from "./command";

export function resetBuilderCounters(): void {
  resetTaskCounter();
  resetProjectCounter();
  resetDirectionCounter();
  resetBlockCounter();
  resetPoolItemCounter();
  resetHorizonCounter();
  resetCommandCounter();
}

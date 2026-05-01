import type { Area, DirectionEntity } from "../../schemas";
import { DirectionCard } from "./DirectionCard";

interface Props {
  directions: DirectionEntity[];
  areas: readonly Area[];
}

export function DirectionGrid({ directions, areas }: Props) {
  return (
    <div className="dir-grid">
      {directions.map((d) => (
        <DirectionCard key={d.id} direction={d} areas={areas} />
      ))}
    </div>
  );
}

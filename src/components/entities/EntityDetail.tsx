import type { Entity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { DetailHeader } from "./detail/parts/DetailHeader";
import { DetailActions } from "./detail/parts/DetailActions";
import { EmptyState } from "./detail/parts/EmptyState";
import { TaskDetail } from "./detail/TaskDetail";
import { ProjectDetail } from "./detail/ProjectDetail";
import { RoutineDetail } from "./detail/RoutineDetail";
import { EventDetail } from "./detail/EventDetail";
import { ContactDetail } from "./detail/ContactDetail";
import { GoalDetail } from "./detail/GoalDetail";
import { MetricDetail } from "./detail/MetricDetail";
import { NoteDetail } from "./detail/NoteDetail";

function renderBody(entity: Entity) {
  switch (entity.type) {
    case "task":
      return <TaskDetail entity={entity} />;
    case "project":
      return <ProjectDetail entity={entity} />;
    case "routine":
      return <RoutineDetail entity={entity} />;
    case "event":
      return <EventDetail entity={entity} />;
    case "contact":
      return <ContactDetail entity={entity} />;
    case "goal":
      return <GoalDetail entity={entity} />;
    case "metric":
      return <MetricDetail entity={entity} />;
    case "note":
      return <NoteDetail entity={entity} />;
  }
}

export function EntityDetail() {
  const selectedId = useUIStore((s) => s.selectedEntityId);
  const entities = useEntityStore((s) => s.entities);
  const entity = selectedId
    ? (entities.find((e) => e.id === selectedId) ?? null)
    : null;

  if (!entity) {
    return (
      <div className="edp">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="edp">
      <DetailHeader entity={entity} />
      {entity.description && (
        <section className="edp-sec">
          <div className="edp-sec-title">Описание</div>
          <div className="edp-desc">{entity.description}</div>
        </section>
      )}
      {renderBody(entity)}
      <DetailActions entity={entity} />
    </div>
  );
}

interface Props {
  onClick: () => void;
}

export function AddDashboardCard({ onClick }: Props) {
  return (
    <button type="button" className="dcard dcard-add" onClick={onClick}>
      <div className="dcard-add-plus">+</div>
      <div className="dcard-add-label">Добавить</div>
    </button>
  );
}

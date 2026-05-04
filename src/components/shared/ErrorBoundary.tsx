import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Top-level boundary so a render exception in any page / popup /
// dashboard JSX doesn't leave the user staring at a blank window.
// Without this, the React tree throws all the way up to the root
// and unmounts everything — the menu still works (Cmd+Q exits)
// but the body is empty and there's no visible recovery path.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="error-boundary">
        <div className="eb-card">
          <div className="eb-title">Произошла ошибка</div>
          <div className="eb-msg">
            {this.state.error?.message ?? "Неизвестная ошибка"}
          </div>
          <button
            type="button"
            className="eb-reload"
            onClick={() => window.location.reload()}
          >
            Перезапустить
          </button>
        </div>
      </div>
    );
  }
}

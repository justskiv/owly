import React from "react";

interface Props {
  children: React.ReactNode;
  // Recompiles the dashboard from disk. Without this, "Try again"
  // re-renders the SAME compiled component instance with stale
  // closures over props from the previous render — a transient
  // error would just throw again on the next render.
  onRetry: () => void;
}

interface State {
  error: Error | null;
}

// React error boundary scoped to a single dashboard render. Catches
// runtime exceptions thrown inside the user-authored component (or
// the React tree it returns). Compile-time errors are surfaced
// separately via DashboardCompileErrorPanel before this boundary
// even mounts.
export class DashboardErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Dashboard runtime]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div className="dash-err">
          <div className="dash-err-title">Ошибка во время рендеринга</div>
          <pre className="dash-err-msg">{err.message}</pre>
          {err.stack && (
            <details>
              <summary>Стек</summary>
              <pre>{err.stack}</pre>
            </details>
          )}
          <button
            type="button"
            className="hdr-btn"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry();
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

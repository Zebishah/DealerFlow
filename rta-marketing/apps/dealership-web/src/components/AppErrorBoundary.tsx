import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled application render error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary" role="alert">
          <span className="boot-logo">RTA</span>
          <h1>Something went wrong</h1>
          <p>This workspace view could not be rendered safely.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload workspace
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

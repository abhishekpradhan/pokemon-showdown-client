import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Without this, a single render throw anywhere in the tree unmounts the whole
 * app and leaves the user staring at a blank page mid-battle.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <span className="eyebrow">Something broke</span>
          <h1>The interface hit an unexpected error</h1>
          <p>
            Your connection to the battle server is separate from this screen, so reloading
            usually recovers the session.
          </p>
          <pre className="crash-detail">{error.message}</pre>
          <div className="button-row">
            <button className="primary-action" type="button" onClick={() => window.location.reload()}>
              Reload client
            </button>
            <button className="secondary-action" type="button" onClick={() => this.setState({ error: null })}>
              Try to continue
            </button>
          </div>
        </div>
      </div>
    );
  }
}

import * as React from 'react';
import { StartupDiagnostics } from './StartupDiagnostics';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class StartupErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[StartupErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <StartupDiagnostics
          simulateFailure={true}
          onReady={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

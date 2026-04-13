import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 8, color: '#f87171', fontSize: 12 }}>
          {this.props.label} crashed: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px'
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f43f5e', marginBottom: '12px' }}>
              Application Error
            </h1>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.5' }}>
              The application encountered an unexpected runtime error. This can happen if browser storage contains outdated data.
            </p>
            {this.state.error && (
              <pre style={{
                backgroundColor: '#0f172a',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e2e8f0',
                overflowX: 'auto',
                marginBottom: '20px',
                border: '1px solid #1e293b'
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear Storage & Reload
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Retry Page Load
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

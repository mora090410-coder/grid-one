import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-ink flex items-center justify-center p-4">
                    <div className="oa-root bg-broadcast-white text-ink border border-cardinal p-8 max-w-md w-full text-center space-y-6">
                        <div className="w-16 h-16 bg-cardinal flex items-center justify-center mx-auto border border-ink">
                            <svg className="w-8 h-8 text-broadcast-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <div className="space-y-2">
                            <h2 className="oa-headline !text-2xl text-ink">GridOne needs to reload.</h2>
                            <p className="oa-body text-sm text-ink/65">The application encountered an unexpected state. Your saved board data has not been intentionally changed.</p>
                        </div>

                        {this.state.error && (
                            <div className="bg-newsprint p-3 text-[10px] font-mono text-cardinal text-left overflow-auto max-h-32 border border-newsprint">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="oa-btn oa-btn-primary w-full"
                        >
                            Reload GridOne
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

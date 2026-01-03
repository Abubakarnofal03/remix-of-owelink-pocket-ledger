import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './button';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackAction?: 'back' | 'home' | 'retry';
    fallbackRoute?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundaryClass extends Component<Props & { navigate: (path: string) => void }, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    private handleBack = () => {
        this.props.navigate(-1 as any);
    };

    private handleHome = () => {
        this.props.navigate('/');
    };

    public render() {
        if (this.state.hasError) {
            const { fallbackAction = 'back', fallbackRoute } = this.props;

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <div className="max-w-md w-full space-y-6 text-center">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-destructive/10 p-4">
                                <AlertCircle className="h-12 w-12 text-destructive" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
                            <p className="text-muted-foreground">
                                We encountered an unexpected error. Don't worry, your data is safe.
                            </p>
                            {this.state.error && (
                                <details className="mt-4 text-left">
                                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                        Technical details
                                    </summary>
                                    <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                                        {this.state.error.message}
                                    </pre>
                                </details>
                            )}
                        </div>

                        <div className="flex gap-3 justify-center">
                            {(fallbackAction === 'retry') && (
                                <Button onClick={this.handleRetry} className="gap-2">
                                    <RefreshCw className="h-4 w-4" />
                                    Try Again
                                </Button>
                            )}

                            {(fallbackAction === 'back' || !fallbackAction) && (
                                <Button onClick={this.handleBack} variant="outline" className="gap-2">
                                    <ArrowLeft className="h-4 w-4" />
                                    Go Back
                                </Button>
                            )}

                            {(fallbackAction === 'home') && (
                                <Button onClick={this.handleHome} className="gap-2">
                                    Go to Dashboard
                                </Button>
                            )}

                            {fallbackRoute && (
                                <Button onClick={() => this.props.navigate(fallbackRoute)} variant="outline">
                                    Go to {fallbackRoute}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Wrapper to use React Router's navigate
export function ErrorBoundary(props: Props) {
    const navigate = useNavigate();
    return <ErrorBoundaryClass {...props} navigate={navigate} />;
}

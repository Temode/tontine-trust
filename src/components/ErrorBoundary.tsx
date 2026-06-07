import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  resetKey?: string | number;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surfaces le crash dans la console pour debug.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, error.stack, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReset = () => this.setState({ error: null });
  handleReload = () => window.location.reload();

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-foreground">
                {this.props.fallbackTitle ?? "Une erreur est survenue"}
              </p>
              <p className="mt-1 text-muted-foreground">
                L'écran a rencontré un problème inattendu. Vos données saisies ne sont pas perdues si vous rechargez.
              </p>
              <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-card p-3 font-mono text-[11px] text-destructive">
                {String(this.state.error.message || this.state.error)}
              </pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Recharger la page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
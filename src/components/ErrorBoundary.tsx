import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, RotateCw } from "lucide-react";
import { Copy } from "lucide-react";
import { formatCrashForClipboard, getLastCrash, logCrash } from "@/lib/diagnostics/crashLogger";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  resetKey?: string | number;
  boundaryName?: string;
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
    const componentStack =
      info && typeof info === "object" && "componentStack" in info
        ? String((info as { componentStack?: string }).componentStack ?? "")
        : undefined;
    logCrash({
      source: "ErrorBoundary",
      error,
      componentStack,
      extra: { boundary: this.props.boundaryName ?? this.props.fallbackTitle ?? "anonymous" },
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReset = () => this.setState({ error: null });
  handleReload = () => window.location.reload();
  handleCopyReport = async () => {
    const last = getLastCrash();
    if (!last) return;
    try {
      await navigator.clipboard.writeText(formatCrashForClipboard(last));
    } catch {
      /* clipboard refusé : on ignore */
    }
  };

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
                <button
                  type="button"
                  onClick={this.handleCopyReport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-foreground transition hover:bg-secondary"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copier le rapport
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
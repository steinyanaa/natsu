import type * as React from "react";
import { Component, Fragment } from "react";
import type { createTranslator } from "../i18n";

type Translator = ReturnType<typeof createTranslator>;

interface ReaderErrorBoundaryState {
  error?: Error;
  resetCounter: number;
}

export function readerBoundaryFallbackText(t: Translator) {
  return {
    title: t("readerCrashed"),
    retry: t("retryReader"),
    back: t("returnToLibrary")
  };
}

export class ReaderErrorBoundary extends Component<
  {
    children: React.ReactNode;
    resetKey: string;
    t: Translator;
    onBack: () => void;
  },
  ReaderErrorBoundaryState
> {
  state: ReaderErrorBoundaryState = {
    error: undefined,
    resetCounter: 0
  };

  componentDidCatch(error: Error) {
    this.setState({ error });
  }

  componentDidUpdate(previousProps: Readonly<ReaderErrorBoundary["props"]>) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: undefined, resetCounter: this.state.resetCounter + 1 });
    }
  }

  private retry = () => {
    this.setState((state) => ({ error: undefined, resetCounter: state.resetCounter + 1 }));
  };

  render() {
    if (!this.state.error) {
      // A keyed Fragment (not a wrapping <div>) preserves remount-on-reset
      // without inserting an element. A real <div> here would become the
      // `.reader-workspace` grid item instead of `.text-reader`, and since grid
      // items default to `min-height: auto` it would expand to full content
      // height — breaking the scroll viewport so paging/scrolling stops working.
      return <Fragment key={`${this.props.resetKey}-${this.state.resetCounter}`}>{this.props.children}</Fragment>;
    }

    const text = readerBoundaryFallbackText(this.props.t);

    return (
      <div className="reader-error-panel" role="alert">
        <div className="reader-error-card">
          <div className="reader-error-icon" aria-hidden="true">!</div>
          <h2>{text.title}</h2>
          <p>{this.state.error.message || this.props.t("readerCrashed")}</p>
          <div className="reader-error-actions">
            <button className="primary-button pressable" type="button" onClick={this.retry}>
              {text.retry}
            </button>
            <button className="soft-button pressable" type="button" onClick={this.props.onBack}>
              {text.back}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

import type { ReaderApi } from "./types";
import type * as React from "react";

declare global {
  interface Window {
    readerApi: ReaderApi;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    "md-filled-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
    "md-icon-button": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    >;
  }
}

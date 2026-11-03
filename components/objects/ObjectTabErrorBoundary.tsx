"use client";

import {
  Component,
} from "react";

import type {
  ReactNode,
} from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ObjectTabErrorBoundary extends Component<
  Props,
  State
> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="min-w-0 rounded-lg border border-border bg-[var(--vc-danger-bg)] p-4 sm:p-5"
        >
          <h2 className="font-semibold text-[var(--vc-danger-text)]">
            Не вдалося завантажити розділ
          </h2>
          <p className="mt-1 text-sm text-[var(--vc-danger-text)]">
            Паспорт об’єкта залишається доступним. Спробуй оновити дані розділу.
          </p>
          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 min-h-11 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-[var(--vc-danger-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-muted"
          >
            Спробувати ще раз
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

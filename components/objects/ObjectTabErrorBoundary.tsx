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
          className="min-w-0 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5"
        >
          <h2 className="font-semibold text-red-800">
            Не вдалося завантажити розділ
          </h2>
          <p className="mt-1 text-sm text-red-700">
            Паспорт об’єкта залишається доступним. Спробуй оновити дані розділу.
          </p>
          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            Спробувати ще раз
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

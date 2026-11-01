"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";

const options: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Світла тема", icon: Sun },
  { value: "dark", label: "Темна тема", icon: Moon },
  { value: "system", label: "Системна тема", icon: Monitor },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const activeIndex = options.findIndex((option) => option.value === theme);
  const activeOption = options[activeIndex] ?? options[2];
  const nextOption = options[(activeIndex + 1) % options.length] ?? options[0];
  const ActiveIcon = activeOption.icon;

  return <>
    <button
      type="button"
      onClick={() => setTheme(nextOption.value)}
      aria-label={`${activeOption.label}. Перемкнути на: ${nextOption.label}`}
      title={activeOption.label}
      className="vc-theme-mobile"
    >
      <ActiveIcon aria-hidden="true" className="size-4" />
    </button>
    <div className="vc-theme-switcher" role="group" aria-label="Тема оформлення">
      {options.map(({ value, label, icon: Icon }) => <button
        key={value}
        type="button"
        aria-label={label}
        aria-pressed={theme === value}
        title={label}
        onClick={() => setTheme(value)}
        className="vc-theme-option"
      >
        <Icon aria-hidden="true" className="size-3.5" />
      </button>)}
    </div>
  </>;
}

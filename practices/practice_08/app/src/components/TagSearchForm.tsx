import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateTag } from "@/lib/validation";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (tag: string) => void;
  onReset: () => void;
  pending: boolean;
  suggestions: string[];
  inputRef: RefObject<HTMLInputElement | null>;
};

/** Форма «Поиск по тегу». Правила 1–4 и 9 spec.md. */
export function TagSearchForm({
  value,
  onValueChange,
  onSubmit,
  onReset,
  pending,
  suggestions,
  inputRef,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  // Синхронная защита: второй клик или Enter до перерисовки не уйдут на сервер (правило 4).
  const locked = useRef(false);

  useEffect(() => {
    if (!pending) locked.current = false;
  }, [pending]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || locked.current) return;
    const result = validateTag(value);
    if (!result.ok) {
      setError(result.message);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    locked.current = true;
    onSubmit(result.value);
  }

  function handleReset() {
    setError(null);
    onReset();
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Поиск по тегу" className="flex flex-col gap-2">
      <Label htmlFor="tag-input">Тег</Label>
      <div className="flex flex-col gap-2 min-[720px]:flex-row">
        <Input
          id="tag-input"
          ref={inputRef}
          value={value}
          list="tag-suggestions"
          placeholder="Например, ужин"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "tag-error" : undefined}
          onChange={(event) => {
            onValueChange(event.target.value);
            if (error) setError(null);
          }}
        />
        <datalist id="tag-suggestions">
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        <Button type="submit" disabled={pending}>
          <Search aria-hidden="true" />
          Найти
        </Button>
        <Button type="button" variant="outline" onClick={handleReset}>
          <RotateCcw aria-hidden="true" />
          Сбросить
        </Button>
      </div>
      {error && (
        <p id="tag-error" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
    </form>
  );
}

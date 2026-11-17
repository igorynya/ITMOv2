import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "error";
  children?: ReactNode;
};

/** Пустые состояния (S3–S5) и ошибки (S6, S7) с одним действием. */
export function StateMessage({ title, description, actionLabel, onAction, tone = "neutral" }: Props) {
  const isError = tone === "error";
  return (
    <Alert variant={isError ? "destructive" : "default"} role={isError ? "alert" : "status"}>
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
      {actionLabel && onAction && (
        <Button type="button" variant="outline" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Alert>
  );
}

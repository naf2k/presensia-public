import type * as React from "react";
import { cn } from "@presensia/utils";

export function Field({
  label,
  required,
  hint,
  error,
  full,
  children,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cn("field-group", full && "full")}>
      <label htmlFor={htmlFor}>
        {label}{" "}
        {required ? (
          <span className="required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <small>{hint}</small> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn("input-ui", props["aria-invalid"] && "input-invalid", props.className)}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn("select-ui", props["aria-invalid"] && "input-invalid", props.className)}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn("textarea-ui", props["aria-invalid"] && "input-invalid", props.className)}
    />
  );
}

export function Switch({
  label,
  description,
  ...props
}: { label: string; description?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="switch-line">
      <div className="switch-copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </div>
      <label className="switch">
        <input type="checkbox" {...props} />
        <span aria-hidden="true" />
        <span className="sr-only">{props["aria-label"] ?? label}</span>
      </label>
    </div>
  );
}

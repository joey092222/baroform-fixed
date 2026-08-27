"use client";

import { useEffect, useRef } from "react";

export function QuestionTitleField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    field.style.height = "0px";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={fieldRef}
      className="question-title-input"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\r?\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onFocus={() => {
        const field = fieldRef.current;
        if (!field) return;
        field.style.height = "0px";
        field.style.height = `${field.scrollHeight}px`;
      }}
      rows={1}
      aria-label={label}
      maxLength={200}
    />
  );
}


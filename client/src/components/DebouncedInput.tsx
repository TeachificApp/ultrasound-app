/**
 * DebouncedInput / DebouncedTextarea
 * Maintains local state to prevent focus loss when parent re-renders on every change.
 * Syncs value back to parent via onChange on every keystroke but keeps its own state
 * so React doesn't unmount/remount the DOM element.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
}

export function DebouncedInput({ value, onChange, className, placeholder, type }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const isTyping = useRef(false);

  // Sync from parent only when not actively typing
  useEffect(() => {
    if (!isTyping.current) {
      setLocalValue(value ?? "");
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    isTyping.current = true;
    const newVal = e.target.value;
    setLocalValue(newVal);
    onChange(newVal);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    isTyping.current = false;
    // Ensure parent has latest value
    onChange(localValue);
  }, [localValue, onChange]);

  return (
    <Input
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      type={type}
    />
  );
}

interface DebouncedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function DebouncedTextarea({ value, onChange, className, placeholder }: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const isTyping = useRef(false);

  useEffect(() => {
    if (!isTyping.current) {
      setLocalValue(value ?? "");
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    isTyping.current = true;
    const newVal = e.target.value;
    setLocalValue(newVal);
    onChange(newVal);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    isTyping.current = false;
    onChange(localValue);
  }, [localValue, onChange]);

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
}

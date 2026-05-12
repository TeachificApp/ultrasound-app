/**
 * DebouncedInput / DebouncedTextarea
 * 
 * These components solve the "focus loss on keystroke" problem by:
 * 1. Maintaining their own local state for immediate UI responsiveness
 * 2. DEBOUNCING the parent onChange callback (default 400ms)
 *    - This prevents the parent from re-rendering on every keystroke
 *    - The parent only updates after the user pauses typing
 * 3. Syncing from parent when the value changes externally (not during typing)
 */
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
  debounceMs?: number;
}

export function DebouncedInput({ value, onChange, className, placeholder, type, debounceMs = 400 }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  const isFocusedRef = useRef(false);

  // Keep onChange ref current without causing re-renders
  onChangeRef.current = onChange;

  // Sync from parent ONLY when not focused (external changes like load/reset)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value ?? "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Debounce the parent update
    timerRef.current = setTimeout(() => {
      onChangeRef.current(newVal);
    }, debounceMs);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // Flush any pending debounced value immediately on blur
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onChangeRef.current(localValue);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Input
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
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
  debounceMs?: number;
}

export function DebouncedTextarea({ value, onChange, className, placeholder, debounceMs = 400 }: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  const isFocusedRef = useRef(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value ?? "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      onChangeRef.current(newVal);
    }, debounceMs);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onChangeRef.current(localValue);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
}

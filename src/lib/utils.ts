import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(value: string | Date | null) {
  if (!value) return "";
  try {
    // Se è solo orario tipo "08:00", lo ritorna senza crash
    if (/^\d{2}:\d{2}/.test(String(value))) return String(value);
    const date = new Date(value);
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  } catch {
    return "";
  }
}

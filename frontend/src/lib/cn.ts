import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combines conditional classes and resolves Tailwind class conflicts (last wins). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

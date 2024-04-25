import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Attention it overrides classes !!!
export const merge = (...classes: ClassValue[]) => twMerge([clsx(...classes)]);

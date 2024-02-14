import clsx from 'clsx';
import { ClassNameValue, twMerge } from 'tailwind-merge';

// Attention it overrides classes !!!
export const merge = (...classes: ClassNameValue[]) => twMerge(clsx(...classes));

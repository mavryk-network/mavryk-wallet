import clsx from 'clsx';
import { ClassNameValue, twMerge } from 'tailwind-merge';

export const merge = (...classes: ClassNameValue[]) => twMerge(clsx(...classes));

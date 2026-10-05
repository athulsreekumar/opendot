import { type ClassValue, clsx } from "clsx";

export function cn(...a: ClassValue[]): string {
	return clsx(a);
}

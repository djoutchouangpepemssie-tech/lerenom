import clsx from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Assemble des classes en laissant la dernière gagner sur les conflits Tailwind. */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

/**
 * Retard d'apparition d'un élément dans une liste, pour l'entrée échelonnée.
 * Plafonné : au-delà d'une dizaine d'éléments, attendre devient de l'attente.
 */
export function retardApparition(index: number, pasMs = 60, plafondMs = 480): string {
  return `${Math.min(index * pasMs, plafondMs)}ms`;
}

/**
 * Importers Module
 * =================
 * Re-exports all importer functionality.
 */

export * from './pipeline';
export * from './eightSleep';
export * from './orangetheory';
export * from './generic';

// Built-in importer profiles
import { EIGHT_SLEEP_PROFILE } from './eightSleep';
import { ORANGETHEORY_PROFILE } from './orangetheory';
import type { ImporterProfile, VendorType } from '../types/schema';

export const BUILT_IN_PROFILES: ImporterProfile[] = [
  EIGHT_SLEEP_PROFILE,
  ORANGETHEORY_PROFILE,
];

export function getBuiltInProfile(vendor: VendorType): ImporterProfile | undefined {
  return BUILT_IN_PROFILES.find(p => p.vendor === vendor);
}

export function getAllBuiltInProfiles(): ImporterProfile[] {
  return [...BUILT_IN_PROFILES];
}

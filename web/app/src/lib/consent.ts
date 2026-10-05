import { consentVersions } from './env';

/** Document version strings shown on the legal pages; they equal authservice's ConsentVersions. */
export function legalVersions(): { terms: string; privacy: string } {
  return consentVersions();
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface DetectedPhoneNumber {
  /** E.164, e.g. +2348012345678 — the canonical form passed to every downstream call. */
  msisdn: string;
  /** ISO 3166-1 alpha-2, e.g. NG. Drives all routing — the user is never asked for this. */
  countryIso: string;
  nationalNumber: string;
}

/**
 * Detects country + national number from any phone number shape the user types
 * (with or without +, spaces, leading 0). This is the single source of truth for
 * "which country is this number in" — routing, catalog, and purchase all depend
 * on it instead of a user-supplied country picker.
 */
@Injectable()
export class PhoneNumberService {
  detect(rawInput: string): DetectedPhoneNumber {
    const parsed = parsePhoneNumberFromString(rawInput.trim());
    if (!parsed || !parsed.isValid() || !parsed.country) {
      throw new BadRequestException(
        "Could not detect a valid country or mobile operator for this phone number."
      );
    }

    return {
      msisdn: parsed.number,
      countryIso: parsed.country,
      nationalNumber: parsed.nationalNumber
    };
  }
}

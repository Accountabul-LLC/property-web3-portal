import { z } from 'zod';

export const XRPL_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
export const STANDARD_DECIMAL_REGEX = /^\d+(\.\d+)?$/;

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .max(254, 'Email must be 254 characters or fewer');

export const xrplAddressSchema = z
  .string()
  .trim()
  .regex(XRPL_ADDRESS_REGEX, 'Enter a valid XRPL wallet address');

export const plainDecimalSchema = (label: string, maxLength = 40) =>
  z
    .string()
    .trim()
    .regex(STANDARD_DECIMAL_REGEX, `${label} must be a plain decimal number`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`);

export const textSchema = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${label} must be at most ${maxLength} characters`);

export const requiredTextSchema = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} must be at most ${maxLength} characters`);

export const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{3,20}$/, 'Currency code must be 3 to 20 letters or numbers'),
  );

export const sanitizeDecimalInput = (value: string) =>
  value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

export const sanitizeCurrencyCodeInput = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

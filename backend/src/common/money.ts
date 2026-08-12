import { Prisma } from '@prisma/client';

export type DecimalInput = Prisma.Decimal.Value;

export function decimal(value: DecimalInput | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

export function roundMoney(
  value: DecimalInput,
  scale = 3,
): Prisma.Decimal {
  return decimal(value).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateTaxLine(
  input: {
    quantity: DecimalInput;
    unitPrice: DecimalInput;
    discount?: DecimalInput;
    taxRate?: DecimalInput;
  },
  scale = 3,
) {
  const subtotal = decimal(input.quantity)
    .times(decimal(input.unitPrice))
    .minus(decimal(input.discount));
  const taxRate = decimal(input.taxRate ?? 0);
  const taxAmount = roundMoney(subtotal.times(taxRate).dividedBy(100), scale);
  const total = roundMoney(subtotal.plus(taxAmount), scale);
  return {
    lineSubtotal: roundMoney(subtotal, scale),
    taxRate,
    taxAmount,
    total,
  };
}


import { BadRequestException } from '@nestjs/common';
import { PaymentGatewaySlug } from '@prisma/client';
import { GATEWAY_META } from './gateway.constants';

const MAX_CONFIG_VALUE_LENGTH = 4_096;

export function validateGatewayConfigUpdate(
  slug: PaymentGatewaySlug | string,
  config: Record<string, string>,
): Record<string, string> {
  const meta = GATEWAY_META[slug as PaymentGatewaySlug];
  if (!meta) throw new BadRequestException('Unsupported payment gateway');
  const allowed = new Set(meta.configKeys.map((key) => key.key));
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(config || {})) {
    if (!allowed.has(key)) {
      throw new BadRequestException(`Unsupported gateway configuration key: ${key}`);
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`Gateway configuration ${key} must be a string`);
    }
    if (value.length > MAX_CONFIG_VALUE_LENGTH) {
      throw new BadRequestException(`Gateway configuration ${key} is too long`);
    }
    out[key] = value.trim();
  }
  return out;
}


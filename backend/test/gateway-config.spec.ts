import { BadRequestException } from '@nestjs/common';
import { validateGatewayConfigUpdate } from '../src/payments/gateway-config';

describe('payment gateway config validation', () => {
  it('rejects arbitrary URL and unknown configuration keys', () => {
    expect(() =>
      validateGatewayConfigUpdate('THAWANI', {
        baseUrl: 'http://169.254.169.254/latest/meta-data',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts only declared gateway keys', () => {
    expect(
      validateGatewayConfigUpdate('THAWANI', {
        publishableKey: ' pk_test ',
        secretKey: ' sk_test ',
      }),
    ).toEqual({ publishableKey: 'pk_test', secretKey: 'sk_test' });
  });
});

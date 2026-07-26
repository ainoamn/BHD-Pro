import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { PlanFeatureKey } from '../plan-features';
import { PLAN_FEATURE_KEY } from '../decorators/require-plan-feature.decorator';

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptions: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeatureKey>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const req = context.switchToHttp().getRequest();
    const companyId = req.user?.companyId as string | undefined;
    if (!companyId) return false;

    await this.subscriptions.assertFeature(companyId, feature);
    return true;
  }
}

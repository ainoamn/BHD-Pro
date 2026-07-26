import { SetMetadata } from '@nestjs/common';
import { PlanFeatureKey } from '../plan-features';

export const PLAN_FEATURE_KEY = 'planFeature';

export const RequirePlanFeature = (feature: PlanFeatureKey) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);

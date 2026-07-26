import { SetMetadata } from '@nestjs/common';
import { ModuleKey } from '../module-permissions';

export const MODULE_ACCESS_KEY = 'moduleAccess';

export type ModuleAccessMeta = {
  module: ModuleKey;
  /** If omitted, GET/HEAD=view and mutations=edit */
  level?: 'view' | 'edit';
};

export const RequireModuleAccess = (module: ModuleKey, level?: 'view' | 'edit') =>
  SetMetadata(MODULE_ACCESS_KEY, { module, level } satisfies ModuleAccessMeta);

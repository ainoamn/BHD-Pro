import { SetMetadata } from '@nestjs/common';
import { PlatformPermission } from '../guards/platform-admin.guard';

export const PLATFORM_PERMS_KEY = 'platformPerms';

export const RequirePlatformPermission = (...perms: PlatformPermission[]) =>
  SetMetadata(PLATFORM_PERMS_KEY, perms);

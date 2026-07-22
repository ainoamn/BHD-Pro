import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

export const DEFAULT_COST_CENTERS = [
  {
    code: 'CC-001',
    name: 'الإدارة العامة',
    nameEn: 'General Administration',
    description: 'مصاريف إدارية ومكتبية — للتجربة',
  },
  {
    code: 'CC-002',
    name: 'المبيعات والتسويق',
    nameEn: 'Sales & Marketing',
    description: 'إيرادات وتكاليف المبيعات — للتجربة',
  },
  {
    code: 'CC-003',
    name: 'العمليات والمشتريات',
    nameEn: 'Operations & Procurement',
    description: 'تشغيل ومشتريات — للتجربة',
  },
  {
    code: 'CC-004',
    name: 'الموارد البشرية',
    nameEn: 'Human Resources',
    description: 'رواتب ومزايا — للتجربة',
  },
  {
    code: 'CC-005',
    name: 'تقنية المعلومات',
    nameEn: 'Information Technology',
    description: 'أنظمة وصيانة — للتجربة',
  },
] as const;

export const DEFAULT_PROJECTS = [
  {
    code: 'PRJ-001',
    name: 'مشروع تجريبي — مبيعات',
    nameEn: 'Demo — Sales',
    description: 'مشروع افتراضي لاختبار فواتير المبيعات ومركز تكلفة المبيعات',
    costCenterCode: 'CC-002',
    budget: 10000,
    status: ProjectStatus.ACTIVE,
  },
  {
    code: 'PRJ-002',
    name: 'مشروع تجريبي — تطوير',
    nameEn: 'Demo — Development',
    description: 'مشروع افتراضي لاختبار الميزانية ومركز تكلفة تقنية المعلومات',
    costCenterCode: 'CC-005',
    budget: 25000,
    status: ProjectStatus.ACTIVE,
  },
  {
    code: 'PRJ-003',
    name: 'مشروع تجريبي — عمليات',
    nameEn: 'Demo — Operations',
    description: 'مشروع افتراضي لاختبار المشتريات والتشغيل',
    costCenterCode: 'CC-003',
    budget: 15000,
    status: ProjectStatus.PLANNED,
  },
] as const;

/** Idempotent: creates missing default cost centers & projects by code (never deletes user data). */
export async function ensureDefaultCostCentersAndProjects(
  prisma: PrismaService,
  companyId: string,
) {
  const centerIdByCode = new Map<string, string>();

  for (const cc of DEFAULT_COST_CENTERS) {
    const existing = await prisma.costCenter.findFirst({
      where: { companyId, code: cc.code },
      select: { id: true, code: true },
    });
    if (existing) {
      centerIdByCode.set(existing.code, existing.id);
      continue;
    }
    const created = await prisma.costCenter.create({
      data: {
        companyId,
        code: cc.code,
        name: cc.name,
        nameEn: cc.nameEn,
        description: cc.description,
        isActive: true,
      },
      select: { id: true, code: true },
    });
    centerIdByCode.set(created.code, created.id);
  }

  let projectsCreated = 0;
  for (const prj of DEFAULT_PROJECTS) {
    const exists = await prisma.project.findFirst({
      where: { companyId, code: prj.code },
      select: { id: true },
    });
    if (exists) continue;

    const costCenterId = centerIdByCode.get(prj.costCenterCode) ?? null;
    await prisma.project.create({
      data: {
        companyId,
        code: prj.code,
        name: prj.name,
        nameEn: prj.nameEn,
        description: prj.description,
        costCenterId,
        budget: prj.budget,
        status: prj.status,
        isActive: true,
        startDate: new Date(),
      },
    });
    projectsCreated += 1;
  }

  return {
    costCentersEnsured: DEFAULT_COST_CENTERS.length,
    projectsCreated,
  };
}

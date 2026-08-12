import type { SectorTemplatePack, Sector } from "@donordesk/domain";

export interface SectorTemplatePackRepository {
  findById(id: string, tenantId: string): Promise<SectorTemplatePack | null>;
  findByOrganization(tenantId: string, organizationId: string): Promise<SectorTemplatePack[]>;
  findBySector(tenantId: string, sector: Sector): Promise<SectorTemplatePack[]>;
  findByDonor(tenantId: string, donorName: string): Promise<SectorTemplatePack[]>;
  findPublished(tenantId: string, options?: { sector?: Sector; donorName?: string }): Promise<SectorTemplatePack[]>;
  save(pack: SectorTemplatePack): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}

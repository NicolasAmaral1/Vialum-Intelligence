import { BaseProvider } from '../provider.base.js';
import { apiGet } from '../../lib/http.js';
import type { ProviderCapabilities, ProviderSearchParams, ProviderResource } from '../provider.interface.js';
import type { PipedriveConfig, PipedrivePerson, PipedriveDeal } from './pipedrive.types.js';

export class PipedriveProvider extends BaseProvider<PipedriveConfig> {
  readonly name = 'pipedrive';
  readonly capabilities: ProviderCapabilities = {
    searchByPhone: true,
    searchByEmail: false,
    searchByName: false,
    hasOAuth: false,
    resourceTypes: ['person', 'deal'],
    category: 'crm',
  };

  private baseUrl(config: PipedriveConfig): string {
    const domain = config.domain ?? 'api';
    return `https://${domain}.pipedrive.com/api/v1`;
  }

  async testConnection(accountId: string): Promise<boolean> {
    const config = await this.getConfig(accountId);
    const url = `${this.baseUrl(config)}/users/me?api_token=${config.apiToken}`;
    try {
      const result = await apiGet<{ data: { id: number } }>(url);
      return !!result.data?.id;
    } catch {
      return false;
    }
  }

  async search(accountId: string, params: ProviderSearchParams): Promise<ProviderResource[]> {
    if (!params.phone) return [];

    const config = await this.getConfig(accountId);
    const base = this.baseUrl(config);
    const resources: ProviderResource[] = [];

    // Build phone variants to search (Pipedrive stores phones inconsistently)
    const phoneVariants = this.getPhoneVariants(params.phone);
    const seenPersonIds = new Set<number>();
    let persons: PipedrivePerson[] = [];

    for (const variant of phoneVariants) {
      const searchUrl = `${base}/persons/search?term=${encodeURIComponent(variant)}&fields=phone&api_token=${config.apiToken}`;
      try {
        const result = await apiGet<{ data: { items: Array<{ item: PipedrivePerson }> } }>(searchUrl);
        for (const item of result.data?.items ?? []) {
          if (!seenPersonIds.has(item.item.id)) {
            seenPersonIds.add(item.item.id);
            persons.push(item.item);
          }
        }
      } catch { /* skip variant */ }
      if (persons.length > 0) break; // found results, stop trying variants
    }

    for (const person of persons.slice(0, 5)) {
      resources.push({
        externalId: `person-${person.id}`,
        resourceType: 'person',
        resourceName: person.name,
        rawData: person as unknown as Record<string, unknown>,
      });

      // Get deals for each person
      const dealsUrl = `${base}/persons/${person.id}/deals?api_token=${config.apiToken}&status=all_not_deleted`;
      try {
        const dealsResult = await apiGet<{ data: PipedriveDeal[] | null }>(dealsUrl);
        if (dealsResult.data) {
          for (const deal of dealsResult.data.slice(0, 10)) {
            const stageName = await this.getStageName(config, deal.stage_id);
            const domain = config.domain ?? 'app';
            resources.push({
              externalId: `deal-${deal.id}`,
              externalUrl: `https://${domain}.pipedrive.com/deal/${deal.id}`,
              resourceType: 'deal',
              resourceName: deal.title,
              status: deal.status,
              stage: stageName ?? undefined,
              value: deal.value,
              rawData: deal as unknown as Record<string, unknown>,
            });
          }
        }
      } catch {
        // Skip if no deals
      }
    }

    return resources;
  }

  async getResource(accountId: string, resourceType: string, externalId: string): Promise<ProviderResource | null> {
    if (resourceType !== 'deal') return null;

    const dealId = parseInt(externalId.replace('deal-', ''), 10);
    if (isNaN(dealId)) return null;

    const config = await this.getConfig(accountId);
    const url = `${this.baseUrl(config)}/deals/${dealId}?api_token=${config.apiToken}`;

    try {
      const result = await apiGet<{ data: PipedriveDeal }>(url);
      const deal = result.data;
      if (!deal) return null;

      const stageName = await this.getStageName(config, deal.stage_id);
      const domain = config.domain ?? 'app';

      return {
        externalId: `deal-${deal.id}`,
        externalUrl: `https://${domain}.pipedrive.com/deal/${deal.id}`,
        resourceType: 'deal',
        resourceName: deal.title,
        status: deal.status,
        stage: stageName ?? undefined,
        value: deal.value,
        rawData: deal as unknown as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  // ── Helpers ──

  /**
   * Generate phone variants for Pipedrive search.
   * Pipedrive stores phones inconsistently (with/without country code, with/without formatting).
   */
  private getPhoneVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    const variants: string[] = [digits];

    // If starts with 55 (Brazil), also try without country code
    if (digits.startsWith('55') && digits.length >= 12) {
      variants.push(digits.slice(2));
    }
    // If doesn't start with 55 and looks like Brazilian number, also try with 55
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
      variants.push(`55${digits}`);
    }

    return variants;
  }

  async searchByPhone(accountId: string, phone: string) {
    const config = await this.getConfig(accountId);
    const base = this.baseUrl(config);

    const phoneVariants = this.getPhoneVariants(phone);
    let persons: PipedrivePerson[] = [];

    for (const variant of phoneVariants) {
      const url = `${base}/persons/search?term=${encodeURIComponent(variant)}&fields=phone&api_token=${config.apiToken}`;
      try {
        const result = await apiGet<{ data: { items: Array<{ item: PipedrivePerson }> } }>(url);
        persons = result.data?.items?.map((i) => i.item) ?? [];
      } catch { /* skip */ }
      if (persons.length > 0) break;
    }

    const deals: PipedriveDeal[] = [];
    for (const person of persons.slice(0, 3)) {
      const dealsUrl = `${base}/persons/${person.id}/deals?api_token=${config.apiToken}&status=all_not_deleted`;
      try {
        const dealsResult = await apiGet<{ data: PipedriveDeal[] | null }>(dealsUrl);
        if (dealsResult.data) deals.push(...dealsResult.data);
      } catch { /* skip */ }
    }

    return { persons, deals };
  }

  async getDeal(accountId: string, dealId: number): Promise<PipedriveDeal | null> {
    const config = await this.getConfig(accountId);
    const url = `${this.baseUrl(config)}/deals/${dealId}?api_token=${config.apiToken}`;
    try {
      const result = await apiGet<{ data: PipedriveDeal }>(url);
      return result.data;
    } catch {
      return null;
    }
  }

  async getStageName(configOrAccountId: PipedriveConfig | string, stageId: number): Promise<string | null> {
    let config: PipedriveConfig;
    if (typeof configOrAccountId === 'string') {
      config = await this.getConfig(configOrAccountId);
    } else {
      config = configOrAccountId;
    }
    const url = `${this.baseUrl(config)}/stages/${stageId}?api_token=${config.apiToken}`;
    try {
      const result = await apiGet<{ data: { name: string } }>(url);
      return result.data?.name ?? null;
    } catch {
      return null;
    }
  }
}

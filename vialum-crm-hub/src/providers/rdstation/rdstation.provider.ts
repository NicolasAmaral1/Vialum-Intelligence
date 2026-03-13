import { BaseProvider } from '../provider.base.js';
import { oauthHelper } from '../../lib/oauth.js';
import { enforceRateLimit } from '../../lib/rate-limiter.js';
import type { ProviderCapabilities, ProviderSearchParams, ProviderResource } from '../provider.interface.js';
import type { RDStationConfig, RDStationContact, RDStationDeal } from './rdstation.types.js';

const BASE_URL = 'https://api.rd.services/crm/v2';
const RATE_LIMIT = 120; // 120 req/min per RD Station docs

export class RDStationProvider extends BaseProvider<RDStationConfig> {
  readonly name = 'rdstation';
  readonly capabilities: ProviderCapabilities = {
    searchByPhone: true,
    searchByEmail: true,
    searchByName: false,
    hasOAuth: true,
    resourceTypes: ['contact', 'deal', 'organization'],
    category: 'crm',
  };

  private async getAccessToken(accountId: string): Promise<string> {
    const config = await this.getConfig(accountId);
    return oauthHelper.getValidToken(accountId, 'rdstation', {
      tokenUrl: 'https://api.rd.services/auth/token',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  private headers(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private rateLimitKey(accountId: string): string {
    return `${accountId}:rdstation`;
  }

  private async apiGet<T>(accountId: string, url: string): Promise<T> {
    enforceRateLimit(this.rateLimitKey(accountId), RATE_LIMIT);
    const token = await this.getAccessToken(accountId);

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers(token),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`RD Station API error (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async testConnection(accountId: string): Promise<boolean> {
    try {
      const result = await this.apiGet<{ data: RDStationContact[] }>(
        accountId,
        `${BASE_URL}/contacts?page[size]=1`,
      );
      return Array.isArray(result.data);
    } catch {
      return false;
    }
  }

  async search(accountId: string, params: ProviderSearchParams): Promise<ProviderResource[]> {
    const resources: ProviderResource[] = [];

    // Search contacts by phone or email using RDQL filter
    let filter = '';
    if (params.phone) {
      filter = `phone:${params.phone}`;
    } else if (params.email) {
      filter = `email:${params.email}`;
    } else {
      return [];
    }

    try {
      const contactsResult = await this.apiGet<{ data: RDStationContact[] }>(
        accountId,
        `${BASE_URL}/contacts?filter=${encodeURIComponent(filter)}&page[size]=5`,
      );

      const contacts = contactsResult.data ?? [];

      for (const contact of contacts) {
        resources.push({
          externalId: `contact-${contact.id}`,
          externalUrl: `https://crm.rdstation.com/contacts/${contact.id}`,
          resourceType: 'contact',
          resourceName: contact.name,
          rawData: contact as unknown as Record<string, unknown>,
        });

        // Get deals for each contact
        try {
          const dealsResult = await this.apiGet<{ data: RDStationDeal[] }>(
            accountId,
            `${BASE_URL}/deals?filter=${encodeURIComponent(`contact_id:${contact.id}`)}&page[size]=10`,
          );

          for (const deal of dealsResult.data ?? []) {
            resources.push({
              externalId: `deal-${deal.id}`,
              externalUrl: `https://crm.rdstation.com/deals/${deal.id}`,
              resourceType: 'deal',
              resourceName: deal.name,
              status: deal.deal_status,
              stage: deal.deal_stage?.name ?? undefined,
              value: deal.amount_total ?? undefined,
              rawData: deal as unknown as Record<string, unknown>,
            });
          }
        } catch {
          // Skip deals fetch failure
        }
      }
    } catch {
      // Provider API error — return empty
    }

    return resources;
  }

  async getResource(accountId: string, resourceType: string, externalId: string): Promise<ProviderResource | null> {
    const id = externalId.replace(/^(contact|deal|organization)-/, '');

    try {
      if (resourceType === 'contact') {
        const result = await this.apiGet<RDStationContact>(accountId, `${BASE_URL}/contacts/${id}`);
        return {
          externalId: `contact-${result.id}`,
          externalUrl: `https://crm.rdstation.com/contacts/${result.id}`,
          resourceType: 'contact',
          resourceName: result.name,
          rawData: result as unknown as Record<string, unknown>,
        };
      }

      if (resourceType === 'deal') {
        const result = await this.apiGet<RDStationDeal>(accountId, `${BASE_URL}/deals/${id}`);
        return {
          externalId: `deal-${result.id}`,
          externalUrl: `https://crm.rdstation.com/deals/${result.id}`,
          resourceType: 'deal',
          resourceName: result.name,
          status: result.deal_status,
          stage: result.deal_stage?.name ?? undefined,
          value: result.amount_total ?? undefined,
          rawData: result as unknown as Record<string, unknown>,
        };
      }
    } catch {
      return null;
    }

    return null;
  }
}

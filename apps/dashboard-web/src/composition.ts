import type { AnalyticsRepository } from './domain/analytics/repositories/AnalyticsRepository';
import type { SiteRepository } from './domain/sites/repositories/SiteRepository';
import { HttpAnalyticsRepository } from './infrastructure/analytics/repositories/HttpAnalyticsRepository';
import { httpClient } from './infrastructure/http/httpClient';
import { HttpSiteRepository } from './infrastructure/sites/repositories/HttpSiteRepository';

/** Composition root : seul endroit qui connait les implementations concretes. */
export const siteRepository: SiteRepository = new HttpSiteRepository(httpClient);
export const analyticsRepository: AnalyticsRepository = new HttpAnalyticsRepository(httpClient);
export { httpClient };

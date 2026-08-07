import { Injectable } from "@nestjs/common";
import type { TelecomAirtimeProduct, TelecomDataBundle, TelecomOperator } from "@fliptrybe/providers";

import { TelecomRoutingService } from "./telecom-routing.service";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Operators and bundle catalogs rarely change — cache aggressively, refresh on TTL.
const OPERATORS_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const PRODUCTS_TTL_MS = 30 * 60 * 1000; // 30min

/**
 * Caches operator + product catalogs behind the routing engine so repeated
 * detect/list-products calls don't hit ClubKonnect/Reloadly on every request.
 */
@Injectable()
export class TelecomCatalogService {
  private readonly operatorsCache = new Map<string, CacheEntry<TelecomOperator[]>>();
  private readonly airtimeCache = new Map<string, CacheEntry<TelecomAirtimeProduct[]>>();
  private readonly dataCache = new Map<string, CacheEntry<TelecomDataBundle[]>>();

  constructor(private readonly routing: TelecomRoutingService) {}

  private read<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.value;
  }

  private write<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOperators(countryIso: string): Promise<TelecomOperator[]> {
    const key = countryIso.toUpperCase();
    const cached = this.read(this.operatorsCache, key);
    if (cached) return cached;

    const adapter = await this.routing.selectAdapter(countryIso);
    const operators = await adapter.getOperators(countryIso);
    this.write(this.operatorsCache, key, operators, OPERATORS_TTL_MS);
    return operators;
  }

  async getAirtimeProducts(countryIso: string, operatorId: string): Promise<TelecomAirtimeProduct[]> {
    const cached = this.read(this.airtimeCache, operatorId);
    if (cached) return cached;

    const adapter = await this.routing.selectAdapter(countryIso);
    const products = await adapter.getAirtimeProducts(operatorId);
    this.write(this.airtimeCache, operatorId, products, PRODUCTS_TTL_MS);
    return products;
  }

  async getDataBundles(countryIso: string, operatorId: string): Promise<TelecomDataBundle[]> {
    const cached = this.read(this.dataCache, operatorId);
    if (cached) return cached;

    const adapter = await this.routing.selectAdapter(countryIso);
    const bundles = await adapter.getDataBundles(operatorId);
    this.write(this.dataCache, operatorId, bundles, PRODUCTS_TTL_MS);
    return bundles;
  }

  invalidateAll() {
    this.operatorsCache.clear();
    this.airtimeCache.clear();
    this.dataCache.clear();
  }
}

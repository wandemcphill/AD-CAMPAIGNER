-- Adds TELECOM to ProviderDomain so telecom-gateway (international airtime/data)
-- can carry its own ProviderConfig/PricingRule rows, same as every other
-- provider-routed vertical.

ALTER TYPE "ProviderDomain" ADD VALUE 'TELECOM';

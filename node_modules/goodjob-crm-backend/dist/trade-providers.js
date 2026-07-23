import { EUROSTAT_COMEXT_PROVIDER } from "./eurostat-comext-provider.js";
import { UN_COMTRADE_PROVIDER } from "./un-comtrade-provider.js";
import { US_CENSUS_TRADE_PROVIDER } from "./us-census-trade-provider.js";
export const TRADE_PROVIDERS = [
    UN_COMTRADE_PROVIDER,
    US_CENSUS_TRADE_PROVIDER,
    EUROSTAT_COMEXT_PROVIDER
];
export function getTradeProvider(id) {
    return TRADE_PROVIDERS.find((provider) => provider.id === id);
}

import { onRequestOptions as __api_pools_login_ts_onRequestOptions } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools/login.ts"
import { onRequestPost as __api_pools_login_ts_onRequestPost } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools/login.ts"
import { onRequestGet as __api_pools__id__ts_onRequestGet } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools/[id].ts"
import { onRequestOptions as __api_pools__id__ts_onRequestOptions } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools/[id].ts"
import { onRequestPost as __api_pools__id__ts_onRequestPost } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools/[id].ts"
import { onRequestPut as __api_pools__id__ts_onRequestPut } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools/[id].ts"
import { onRequestOptions as __api_pools_ts_onRequestOptions } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools.ts"
import { onRequestPost as __api_pools_ts_onRequestPost } from "/Users/amm13/Library/Mobile Documents/com~apple~CloudDocs/[98] GitHub/[01] SBXPRO/functions/api/pools.ts"

export const routes = [
    {
      routePath: "/api/pools/login",
      mountPath: "/api/pools",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_pools_login_ts_onRequestOptions],
    },
  {
      routePath: "/api/pools/login",
      mountPath: "/api/pools",
      method: "POST",
      middlewares: [],
      modules: [__api_pools_login_ts_onRequestPost],
    },
  {
      routePath: "/api/pools/:id",
      mountPath: "/api/pools",
      method: "GET",
      middlewares: [],
      modules: [__api_pools__id__ts_onRequestGet],
    },
  {
      routePath: "/api/pools/:id",
      mountPath: "/api/pools",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_pools__id__ts_onRequestOptions],
    },
  {
      routePath: "/api/pools/:id",
      mountPath: "/api/pools",
      method: "POST",
      middlewares: [],
      modules: [__api_pools__id__ts_onRequestPost],
    },
  {
      routePath: "/api/pools/:id",
      mountPath: "/api/pools",
      method: "PUT",
      middlewares: [],
      modules: [__api_pools__id__ts_onRequestPut],
    },
  {
      routePath: "/api/pools",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_pools_ts_onRequestOptions],
    },
  {
      routePath: "/api/pools",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_pools_ts_onRequestPost],
    },
  ]
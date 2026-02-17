'use strict'

/**
 * Organization Cache Helper
 *
 * FIX: Created this wrapper to break circular dependency
 *
 * ROOT CAUSE: Circular dependency chain caused "getDefaults is not a function" error:
 *   cacheHelper.js → getDefaultOrgId.js → user.js → cacheHelper.js
 *
 * When Node.js loads these modules:
 * 1. cacheHelper.js starts loading, imports getDefaultOrgId.js
 * 2. getDefaultOrgId.js imports user.js (for userRequests.fetchOrgDetails)
 * 3. user.js imports cacheHelper.js
 * 4. cacheHelper.js is not fully loaded yet, returns partial/empty exports
 * 5. getDefaults function is undefined at this point
 *
 * SOLUTION: user.js now imports this wrapper instead of cacheHelper directly.
 * This breaks the cycle because:
 *   cacheHelper.js → getDefaultOrgId.js → user.js → organizationCache.js → cacheHelper.js
 *
 * Even though there's still a path to cacheHelper, the actual cacheHelper functions
 * are only called at RUNTIME (inside set/get functions), not at MODULE LOAD TIME.
 * By the time these functions are called, all modules are fully loaded.
 */

const cacheHelper = require('@generics/cacheHelper')

/**
 * Set organization details in cache
 */
exports.set = async (tenantCode, orgCode, orgId, data) => {
	return await cacheHelper.organizations.set(tenantCode, orgCode, orgId, data)
}

/**
 * Get organization details from cache
 */
exports.get = async (tenantCode, orgCode, orgId) => {
	return await cacheHelper.organizations.get(tenantCode, orgCode, orgId)
}

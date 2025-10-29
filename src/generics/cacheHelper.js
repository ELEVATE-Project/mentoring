// src/generics/cacheHelper.js
/* eslint-disable no-console */
const { RedisCache, InternalCache } = require('elevate-node-cache')
const md5 = require('md5')
const common = require('@constants/common')

/** CONFIG */
const CACHE_CONFIG = (() => {
	try {
		if (process.env.CACHE_CONFIG) return JSON.parse(process.env.CACHE_CONFIG)
		return common.CACHE_CONFIG
	} catch {
		return common.CACHE_CONFIG
	}
})()

const ENABLE_CACHE = pickBool(CACHE_CONFIG.enableCache, true)
const SHARDS = toInt(CACHE_CONFIG.shards, 32)
const BATCH = toInt(CACHE_CONFIG.scanBatch, 1000)
const SHARD_RETENTION_DAYS = toInt(CACHE_CONFIG.shardRetentionDays, 7)

/** Helpers */
function toInt(v, d) {
	const n = parseInt(v, 10)
	return Number.isFinite(n) ? n : d
}
function pickBool(v, d) {
	if (typeof v === 'boolean') return v
	if (typeof v === 'string') return ['1', 'true', 'yes'].includes(v.toLowerCase())
	return d
}

function tenantKey(tenantCode, parts = []) {
	return ['tenant', tenantCode, ...parts].join(':')
}
function orgKey(tenantCode, orgId, parts = []) {
	return ['tenant', tenantCode, 'org', orgId, ...parts].join(':')
}
function namespaceEnabled(ns) {
	if (!ns) return true
	const nsCfg = CACHE_CONFIG.namespaces && CACHE_CONFIG.namespaces[ns]
	return !(nsCfg && nsCfg.enabled === false)
}

/**
 * TTL resolution for namespace.
 * callerTtl (explicit) wins.
 * fallback to namespace.defaultTtl.
 * fallback to undefined (no expiry).
 */
function nsTtl(ns, callerTtl) {
	if (callerTtl != null) return Number(parseInt(callerTtl, 10))
	const nsCfg = CACHE_CONFIG.namespaces && CACHE_CONFIG.namespaces[ns]
	const v = nsCfg && nsCfg.defaultTtl
	return v != null ? Number(parseInt(v, 10)) : undefined
}

/**
 * Determine whether to use internal (in-memory) cache for this namespace.
 * callerUseInternal (explicit param) wins.
 * Otherwise check namespace.useInternal, then global CACHE_CONFIG.useInternal, then false.
 */
function nsUseInternal(ns, callerUseInternal) {
	if (typeof callerUseInternal === 'boolean') return callerUseInternal
	const nsCfg = CACHE_CONFIG.namespaces && CACHE_CONFIG.namespaces[ns]
	if (nsCfg && typeof nsCfg.useInternal === 'boolean') return nsCfg.useInternal
	if (typeof CACHE_CONFIG.useInternal === 'boolean') return CACHE_CONFIG.useInternal
	return false
}

function namespacedKey({ tenantCode, orgId, ns, id }) {
	const base = orgId ? orgKey(tenantCode, orgId, []) : tenantKey(tenantCode, [])
	return [base, ns, id].filter(Boolean).join(':')
}

/** New simple key builder (no version tokens) */
async function buildKey({ tenantCode, orgId, ns, id, key }) {
	// If caller provided ns or id, treat as namespaced.
	const isNamespaced = Boolean(ns || id)
	if (isNamespaced) {
		const effNs = ns || 'ns'
		const base = orgId ? orgKey(tenantCode, orgId, []) : tenantKey(tenantCode, [])
		const final = [base, effNs, id || key].filter(Boolean).join(':')
		return final
	}
	// tenant-level key
	const base = tenantKey(tenantCode, [])
	const final = [base, key].filter(Boolean).join(':')
	return final
}

function shardOf(key) {
	const h = md5(key)
	const asInt = parseInt(h.slice(0, 8), 16)
	return (asInt >>> 0) % SHARDS
}

/** Low-level redis client (best-effort) */
function getRedisClient() {
	try {
		if (RedisCache && typeof RedisCache.native === 'function') return RedisCache.native()
	} catch (err) {
		console.log(err, 'error in getting native redis client')
	}
}

/** Base ops (Exclusive cache usage based on useInternal flag) */
async function get(key, { useInternal = false } = {}) {
	if (!ENABLE_CACHE) return null

	if (useInternal) {
		// Use ONLY InternalCache when useInternal=true
		console.log(`📋 [CACHE GET] Using ONLY InternalCache for key: ${key}`)
		if (InternalCache && InternalCache.getKey) {
			try {
				return InternalCache.getKey(key)
			} catch (e) {
				console.error('InternalCache get error', e)
			}
		}
		return null
	} else {
		// Use ONLY Redis when useInternal=false
		console.log(`📋 [CACHE GET] Using ONLY Redis for key: ${key}`)
		try {
			const val = await RedisCache.getKey(key)
			if (val !== null && val !== undefined) return val
		} catch (e) {
			console.error('redis get error', e)
		}
		return null
	}
}

async function set(key, value, ttlSeconds, { useInternal = false } = {}) {
	if (!ENABLE_CACHE) return false

	if (useInternal) {
		// Use ONLY InternalCache when useInternal=true
		console.log(`💾 [CACHE SET] Using ONLY InternalCache for key: ${key}`)
		if (InternalCache && InternalCache.setKey) {
			try {
				InternalCache.setKey(key, value)
				return true
			} catch (e) {
				console.error('InternalCache set error', e)
				return false
			}
		}
		return false
	} else {
		// Use ONLY Redis when useInternal=false
		console.log(`💾 [CACHE SET] Using ONLY Redis for key: ${key}`)
		try {
			if (ttlSeconds) await RedisCache.setKey(key, value, ttlSeconds)
			else await RedisCache.setKey(key, value)
			return true
		} catch (e) {
			console.error('redis set error', e)
			return false
		}
	}
}

async function del(key, { useInternal = false } = {}) {
	if (useInternal) {
		// Use ONLY InternalCache when useInternal=true
		console.log(`🗑️ [CACHE DEL] Using ONLY InternalCache for key: ${key}`)
		if (InternalCache && InternalCache.delKey) {
			try {
				InternalCache.delKey(key)
				console.log(`✅ [CACHE DEL] Successfully deleted InternalCache key: ${key}`)
			} catch (e) {
				console.error('❌ [CACHE DEL] InternalCache del error for key:', key, e)
			}
		}
	} else {
		// Use ONLY Redis when useInternal=false
		console.log(`🗑️ [CACHE DEL] Using ONLY Redis for key: ${key}`)
		try {
			await RedisCache.deleteKey(key)
			console.log(`✅ [CACHE DEL] Successfully deleted Redis key: ${key}`)
		} catch (e) {
			console.error('❌ [CACHE DEL] Redis del error for key:', key, e)
		}
	}
}

/**
 * getOrSet
 * - key (fallback id)
 * - tenantCode
 * - ttl (optional): explicit TTL seconds
 * - fetchFn: function that returns value
 * - orgId, ns, id: for namespaced keys
 * - useInternal: optional boolean override. If omitted, resolved from namespace/config.
 */
async function getOrSet({ key, tenantCode, ttl = undefined, fetchFn, orgId, ns, id, useInternal = undefined }) {
	if (!namespaceEnabled(ns)) return await fetchFn()

	const resolvedUseInternal = nsUseInternal(ns, useInternal)
	// build simple key (no version token)
	const fullKey =
		ns || id
			? await buildKey({ tenantCode, orgId, ns: ns || 'ns', id: id || key })
			: await buildKey({ tenantCode, key })

	const cached = await get(fullKey, { useInternal: resolvedUseInternal })
	if (cached !== null && cached !== undefined) return cached

	const value = await fetchFn()
	if (value !== undefined) {
		await set(fullKey, value, nsTtl(ns, ttl), { useInternal: resolvedUseInternal })
	}
	return value
}

/** Scoped set that uses namespace TTL and namespace useInternal setting
 * Returns the key that was written.
 */
async function setScoped({ tenantCode, orgId, ns, id, value, ttl = undefined, useInternal = undefined }) {
	if (!namespaceEnabled(ns)) return null
	const resolvedUseInternal = nsUseInternal(ns, useInternal)
	const fullKey = await buildKey({ tenantCode, orgId, ns, id })
	await set(fullKey, value, nsTtl(ns, ttl), { useInternal: resolvedUseInternal })
	return fullKey
}

/** Scoped delete that uses namespace config (TTL/useInternal)
 * Returns the key that was deleted.
 */
async function delScoped({ tenantCode, orgId, ns, id, useInternal = undefined }) {
	if (!namespaceEnabled(ns)) return null
	const resolvedUseInternal = nsUseInternal(ns, useInternal)
	const fullKey = await buildKey({ tenantCode, orgId, ns, id })
	await del(fullKey, { useInternal: resolvedUseInternal })
	return fullKey
}

/**
 * Evict all keys for a namespace.
 * If orgId is provided will target org-level keys, otherwise tenant-level keys.
 * patternSuffix defaults to '*' (delete all keys under the namespace).
 */
async function evictNamespace({ tenantCode, orgId = null, ns, patternSuffix = '*' } = {}) {
	if (!tenantCode || !ns) return
	if (!namespaceEnabled(ns)) return
	const base = orgId ? `tenant:${tenantCode}:org:${orgId}` : `tenant:${tenantCode}`
	const pattern = `${base}:${ns}:${patternSuffix}`
	await scanAndDelete(pattern)
}

/**
 * Eviction helpers using SCAN by pattern.
 * These do not require any tracked sets. Caller should build patterns to match keys to remove.
 *
 * - scanAndDelete(pattern, opts)
 *    pattern: glob-style pattern for SCAN (e.g. "tenant:acme:org:123:*")
 *    opts.batchSize: number of keys to fetch per SCAN iteration (default BATCH)
 *    opts.unlink: if true will attempt UNLINK when available
 */
async function scanAndDelete(pattern, { batchSize = BATCH, unlink = true } = {}) {
	const redis = getRedisClient()
	if (!redis) return
	let cursor = '0'
	do {
		const res = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize)
		cursor = res && res[0] ? res[0] : '0'
		const keys = res && res[1] ? res[1] : []
		if (keys.length) {
			try {
				if (unlink && typeof redis.unlink === 'function') await redis.unlink(...keys)
				else await redis.del(...keys)
			} catch (e) {
				for (const k of keys) {
					try {
						if (unlink && typeof redis.unlink === 'function') await redis.unlink(k)
						else await redis.del(k)
					} catch (__) {}
				}
			}
		}
	} while (cursor !== '0')
}

/** Evict all keys for a tenant + org by pattern */
async function evictOrgByPattern(tenantCode, orgId, { patternSuffix = '*' } = {}) {
	if (!tenantCode || !orgId) return
	const pattern = `tenant:${tenantCode}:org:${orgId}:${patternSuffix}`
	await scanAndDelete(pattern)
}

/** Evict tenant-level keys by pattern */
async function evictTenantByPattern(tenantCode, { patternSuffix = '*' } = {}) {
	if (!tenantCode) return
	const pattern = `tenant:${tenantCode}:${patternSuffix}`
	await scanAndDelete(pattern)
}

// === NAMESPACE-SPECIFIC HELPERS ===

/**
 * Sessions Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:sessions:id
 */
const sessions = {
	async get(tenantCode, orgId, sessionId) {
		return getOrSet({
			tenantCode,
			orgId,
			ns: 'sessions',
			id: sessionId,
			fetchFn: () => null, // Return null if not in cache, caller handles DB fetch
		})
	},

	async set(tenantCode, orgId, sessionId, sessionData, customTtl = null) {
		// Calculate special TTL for sessions based on end_date + 1 day
		let ttl = customTtl
		if (!ttl && sessionData.end_date) {
			const endDate = new Date(parseInt(sessionData.end_date) * 1000)
			const oneDayAfterEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
			const now = new Date()
			const ttlMs = Math.max(oneDayAfterEnd.getTime() - now.getTime(), 0)
			ttl = Math.floor(ttlMs / 1000) || 86400 // fallback to 1 day
		}

		return setScoped({
			tenantCode,
			orgId,
			ns: 'sessions',
			id: sessionId,
			value: sessionData,
			ttl,
		})
	},

	async delete(tenantCode, orgId, sessionId) {
		return delScoped({ tenantCode, orgId, ns: 'sessions', id: sessionId })
	},

	async reset(tenantCode, orgId, sessionId, sessionData, customTtl = null) {
		return this.set(tenantCode, orgId, sessionId, sessionData, customTtl)
	},
}

/**
 * EntityTypes Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:entityTypes:model:${modelName}:${entityValue}
 * Stores individual entity types WITH their entities, TTL: 1 day
 */
const entityTypes = {
	async get(tenantCode, orgId, modelName, entityValue) {
		const compositeId = `model:${modelName}:${entityValue}`
		const key = await buildKey({ tenantCode, orgId, ns: 'entityTypes', id: compositeId })
		return get(key)
	},

	async set(tenantCode, orgId, modelName, entityValue, entityTypeData) {
		const compositeId = `model:${modelName}:${entityValue}`
		return setScoped({
			tenantCode,
			orgId,
			ns: 'entityTypes',
			id: compositeId,
			value: entityTypeData,
			ttl: 86400, // 1 day TTL
		})
	},

	async delete(tenantCode, orgId, modelName, entityValue) {
		const compositeId = `model:${modelName}:${entityValue}`
		return delScoped({ tenantCode, orgId, ns: 'entityTypes', id: compositeId })
	},

	// Clear all entityTypes cache for a tenant/org (useful after cache key format changes)
	async clearAll(tenantCode, orgId) {
		return await evictNamespace({ tenantCode, orgId, ns: 'entityTypes' })
	},
}

/**
 * Forms Cache Helpers
 * Unified Pattern: tenant:${tenantCode}:org:${orgCode}:forms:${type}:${subtype}
 * Single cache pattern for all form operations
 */
const forms = {
	/**
	 * Get specific form by type and subtype
	 */
	async get(tenantCode, orgId, type, subtype) {
		const compositeId = `${type}:${subtype}`
		return get(await buildKey({ tenantCode, orgId, ns: 'forms', id: compositeId }))
	},

	/**
	 * Set specific form with 1-day TTL
	 */
	async set(tenantCode, orgId, type, subtype, formData) {
		const compositeId = `${type}:${subtype}`
		return setScoped({
			tenantCode,
			orgId,
			ns: 'forms',
			id: compositeId,
			value: formData,
			ttl: 86400, // 1 day TTL
		})
	},

	/**
	 * Delete specific form cache
	 */
	async delete(tenantCode, orgId, type, subtype) {
		const compositeId = `${type}:${subtype}`
		return delScoped({ tenantCode, orgId, ns: 'forms', id: compositeId })
	},

	/**
	 * Invalidate all form-related cache for a tenant/org
	 */
	async evictAll(tenantCode, orgId) {
		return await evictNamespace({ tenantCode, orgId, ns: 'forms' })
	},
}

/**
 * Organizations Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:organizations:id
 */
const organizations = {
	async get(tenantCode, orgId, organizationId) {
		return get(await buildKey({ tenantCode, orgId, ns: 'organizations', id: organizationId }))
	},

	async set(tenantCode, orgId, organizationId, orgData) {
		return setScoped({
			tenantCode,
			orgId,
			ns: 'organizations',
			id: organizationId,
			value: orgData,
		})
	},

	async delete(tenantCode, orgId, organizationId) {
		return delScoped({ tenantCode, orgId, ns: 'organizations', id: organizationId })
	},
}

/**
 * Mentor Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:mentor:id
 */
const mentor = {
	async get(tenantCode, orgId, mentorId) {
		return get(await buildKey({ tenantCode, orgId, ns: 'mentor', id: mentorId }))
	},

	async set(tenantCode, orgId, mentorId, mentorData) {
		// Remove displayProperties and Permissions before caching
		const sanitizedData = { ...mentorData }
		delete sanitizedData.displayProperties
		delete sanitizedData.Permissions

		// Don't cache downloadable image URLs
		if (sanitizedData.image && typeof sanitizedData.image === 'string' && sanitizedData.image.includes('http')) {
			delete sanitizedData.image
		}

		return setScoped({
			tenantCode,
			orgId,
			ns: 'mentor',
			id: mentorId,
			value: sanitizedData,
		})
	},

	async delete(tenantCode, orgId, mentorId) {
		return delScoped({ tenantCode, orgId, ns: 'mentor', id: mentorId })
	},
}

/**
 * Mentee Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:mentee:id
 */
const mentee = {
	async get(tenantCode, orgId, menteeId) {
		return get(await buildKey({ tenantCode, orgId, ns: 'mentee', id: menteeId }))
	},

	async set(tenantCode, orgId, menteeId, menteeData) {
		// Remove displayProperties and Permissions before caching
		const sanitizedData = { ...menteeData }
		delete sanitizedData.displayProperties
		delete sanitizedData.Permissions

		// Don't cache downloadable image URLs
		if (sanitizedData.image && typeof sanitizedData.image === 'string' && sanitizedData.image.includes('http')) {
			delete sanitizedData.image
		}

		return setScoped({
			tenantCode,
			orgId,
			ns: 'mentee',
			id: menteeId,
			value: sanitizedData,
		})
	},

	async delete(tenantCode, orgId, menteeId) {
		return delScoped({ tenantCode, orgId, ns: 'mentee', id: menteeId })
	},
}

/**
 * Platform Config Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:platformConfig
 */
const platformConfig = {
	async get(tenantCode, orgId) {
		return get(await buildKey({ tenantCode, orgId, ns: 'platformConfig', id: '' }))
	},

	async set(tenantCode, orgId, configData) {
		return setScoped({
			tenantCode,
			orgId,
			ns: 'platformConfig',
			id: '',
			value: configData,
		})
	},

	async delete(tenantCode, orgId) {
		return delScoped({ tenantCode, orgId, ns: 'platformConfig', id: '' })
	},
}

/**
 * Notification Templates Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:templateCode:code
 */
const notificationTemplates = {
	async get(tenantCode, orgId, templateCode) {
		const compositeId = `templateCode:${templateCode}`
		return get(await buildKey({ tenantCode, orgId, ns: 'notificationTemplates', id: compositeId }))
	},

	async set(tenantCode, orgId, templateCode, templateData) {
		const compositeId = `templateCode:${templateCode}`
		return setScoped({
			tenantCode,
			orgId,
			ns: 'notificationTemplates',
			id: compositeId,
			value: templateData,
		})
	},

	async delete(tenantCode, orgId, templateCode) {
		const compositeId = `templateCode:${templateCode}`
		return delScoped({ tenantCode, orgId, ns: 'notificationTemplates', id: compositeId })
	},
}

/**
 * Display Properties Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:displayProperties
 */
const displayProperties = {
	async get(tenantCode, orgId) {
		return get(await buildKey({ tenantCode, orgId, ns: 'displayProperties', id: '' }))
	},

	async set(tenantCode, orgId, propertiesData) {
		return setScoped({
			tenantCode,
			orgId,
			ns: 'displayProperties',
			id: '',
			value: propertiesData,
		})
	},

	async delete(tenantCode, orgId) {
		return delScoped({ tenantCode, orgId, ns: 'displayProperties', id: '' })
	},
}

/**
 * Permissions Cache Helpers
 * Pattern: permissions:role:${role}
 * Global permissions (no tenant/org context) - Individual role-based caching
 */
const permissions = {
	async get(role) {
		const key = `permissions:role:${role}`
		return get(key)
	},

	async set(role, permissionsData) {
		const key = `permissions:role:${role}`
		return set(key, permissionsData)
	},

	async delete(role) {
		const key = `permissions:role:${role}`
		return del(key)
	},

	/**
	 * Evict all permissions for a specific role
	 */
	async evictRole(role) {
		const pattern = `permissions:role:${role}`
		await scanAndDelete(pattern)
	},

	/**
	 * Evict all permissions cache
	 */
	async evictAll() {
		const pattern = `permissions:*`
		await scanAndDelete(pattern)
	},
}

/**
 * API Permissions Cache Helpers
 * Pattern: apiPermissions:role:${role}:module:${module}:api_path:${api_path}
 * Global permissions (no tenant/org context) - Individual role-based caching
 */
const apiPermissions = {
	/**
	 * Get permissions for a single role-module-path combination
	 */
	async getSingleRole(role, module, apiPath) {
		const key = `apiPermissions:role:${role}:module:${module}:api_path:${apiPath}`
		return get(key)
	},

	/**
	 * Set permissions for a single role-module-path combination
	 * Data format: { "request_type": ["GET", "POST", "DELETE", "PUT", "PATCH"] }
	 */
	async setSingleRole(role, module, apiPath, requestTypes) {
		const key = `apiPermissions:role:${role}:module:${module}:api_path:${apiPath}`
		const permissionData = { request_type: requestTypes }
		return set(key, permissionData)
	},

	/**
	 * Delete permissions for a single role-module-path combination
	 */
	async deleteSingleRole(role, module, apiPath) {
		const key = `apiPermissions:role:${role}:module:${module}:api_path:${apiPath}`
		return del(key)
	},

	/**
	 * Get permissions for multiple roles and combine them
	 * Returns array of permission objects for backwards compatibility
	 */
	async getMultipleRoles(roles, module, apiPaths) {
		const permissions = []

		for (const role of roles) {
			for (const apiPath of apiPaths) {
				const cachedData = await this.getSingleRole(role, module, apiPath)
				if (cachedData && cachedData.request_type) {
					permissions.push({
						request_type: cachedData.request_type,
						api_path: apiPath,
						module: module,
						role_title: role,
					})
				}
			}
		}

		return permissions
	},

	/**
	 * Set permissions for multiple role-module-path combinations from database results
	 */
	async setFromDatabaseResults(module, apiPaths, dbPermissions) {
		const cachePromises = []

		// Group permissions by role and api_path
		const groupedPermissions = {}
		for (const permission of dbPermissions) {
			const key = `${permission.role_title}:${permission.api_path}`
			if (!groupedPermissions[key]) {
				groupedPermissions[key] = []
			}
			groupedPermissions[key] = permission.request_type
		}

		// Cache each role-api_path combination
		for (const [key, requestTypes] of Object.entries(groupedPermissions)) {
			const [role, apiPath] = key.split(':')
			cachePromises.push(this.setSingleRole(role, module, apiPath, requestTypes))
		}

		await Promise.all(cachePromises)
	},

	/**
	 * Evict all permissions for a specific role across all modules and paths
	 */
	async evictRole(role) {
		const pattern = `apiPermissions:role:${role}:*`
		await scanAndDelete(pattern)
	},

	/**
	 * Evict all permissions for a specific module across all roles and paths
	 */
	async evictModule(module) {
		const pattern = `apiPermissions:*:module:${module}:*`
		await scanAndDelete(pattern)
	},

	/**
	 * Evict all API permissions cache
	 */
	async evictAll() {
		const pattern = `apiPermissions:*`
		await scanAndDelete(pattern)
	},

	// Legacy methods for backwards compatibility (DEPRECATED - use individual role methods)
	async get(tenantCode, orgId, roleTitle, module, apiPath) {
		console.warn('apiPermissions.get() is deprecated. Use getMultipleRoles() instead.')
		const roles = Array.isArray(roleTitle) ? roleTitle : [roleTitle]
		const paths = Array.isArray(apiPath) ? apiPath : [apiPath]
		return this.getMultipleRoles(roles, module, paths)
	},

	async set(tenantCode, orgId, roleTitle, module, apiPath, permissionsData) {
		console.warn('apiPermissions.set() is deprecated. Use setFromDatabaseResults() instead.')
		return this.setFromDatabaseResults(module, apiPath, permissionsData)
	},

	async delete(tenantCode, orgId, roleTitle, module, apiPath) {
		console.warn('apiPermissions.delete() is deprecated. Use deleteSingleRole() instead.')
		const roles = Array.isArray(roleTitle) ? roleTitle : [roleTitle]
		const paths = Array.isArray(apiPath) ? apiPath : [apiPath]
		const deletePromises = []

		for (const role of roles) {
			for (const path of paths) {
				deletePromises.push(this.deleteSingleRole(role, module, path))
			}
		}

		await Promise.all(deletePromises)
	},
}

/**
 * User Existence Cache Helpers
 * Pattern: tenant:${tenantCode}:userExistence:${userId}
 */
const userExistence = {
	async get(tenantCode, userId) {
		return get(await buildKey({ tenantCode, ns: 'userExistence', id: userId }))
	},

	async set(tenantCode, userId, exists) {
		return setScoped({
			tenantCode,
			ns: 'userExistence',
			id: userId,
			value: { exists, timestamp: Date.now() },
		})
	},

	async delete(tenantCode, userId) {
		return delScoped({ tenantCode, ns: 'userExistence', id: userId })
	},
}

/**
 * User Extensions Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgId}:userExtensions:${userId}
 */
const userExtensions = {
	async get(tenantCode, orgId, userId) {
		return get(await buildKey({ tenantCode, orgId, ns: 'userExtensions', id: userId }))
	},

	async set(tenantCode, orgId, userId, extensionData) {
		// Don't cache sensitive data like email
		const sanitizedData = { ...extensionData }
		if (sanitizedData.email) delete sanitizedData.email

		return setScoped({
			tenantCode,
			orgId,
			ns: 'userExtensions',
			id: userId,
			value: sanitizedData,
		})
	},

	async delete(tenantCode, orgId, userId) {
		return delScoped({ tenantCode, orgId, ns: 'userExtensions', id: userId })
	},
}

/** Public API */
module.exports = {
	// Base ops
	get,
	set,
	del,
	getOrSet,
	tenantKey,

	// Scoped helpers
	setScoped,
	namespacedKey,
	buildKey,

	// Eviction (pattern based)
	delScoped,
	evictNamespace,
	evictOrgByPattern,
	evictTenantByPattern,
	scanAndDelete,

	// Namespace-specific helpers
	sessions,
	entityTypes,
	forms,
	organizations,
	mentor,
	mentee,
	platformConfig,
	notificationTemplates,
	displayProperties,
	permissions,
	apiPermissions,

	// Introspection
	_internal: {
		getRedisClient,
		SHARDS,
		BATCH,
		ENABLE_CACHE,
		CACHE_CONFIG,
	},
}

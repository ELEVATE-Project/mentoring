// src/generics/cacheHelper.js
/* eslint-disable no-console */
const { RedisCache, InternalCache } = require('elevate-node-cache')
const md5 = require('md5')
const common = require('@constants/common')

// Import database queries for fallback
const { Op } = require('sequelize')
const mentorQueries = require('@database/queries/mentorExtension')
const userQueries = require('@database/queries/userExtension')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const entityTypeQueries = require('@database/queries/entityType')
const notificationTemplateQueries = require('@database/queries/notificationTemplate')
const sessionQueries = require('@database/queries/sessions')
const permissionQueries = require('@database/queries/permissions')
const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const { getDefaults } = require('@helpers/getDefaultOrgId')

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
function orgKey(tenantCode, orgCode, parts = []) {
	return ['tenant', tenantCode, 'org', orgCode, ...parts].join(':')
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

function namespacedKey({ tenantCode, orgCode, ns, id }) {
	const base = orgCode ? orgKey(tenantCode, orgCode, []) : tenantKey(tenantCode, [])
	return [base, ns, id].filter(Boolean).join(':')
}

/** New simple key builder (no version tokens) */
async function buildKey({ tenantCode, orgCode, ns, id, key }) {
	// If caller provided ns or id, treat as namespaced.
	const isNamespaced = Boolean(ns || id)
	if (isNamespaced) {
		const effNs = ns || 'ns'
		const base = orgCode ? orgKey(tenantCode, orgCode, []) : tenantKey(tenantCode, [])
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
 * - orgCode, ns, id: for namespaced keys
 * - useInternal: optional boolean override. If omitted, resolved from namespace/config.
 */
async function getOrSet({ key, tenantCode, ttl = undefined, fetchFn, orgCode, ns, id, useInternal = undefined }) {
	if (!namespaceEnabled(ns)) return await fetchFn()

	const resolvedUseInternal = nsUseInternal(ns, useInternal)
	// build simple key (no version token)
	const fullKey =
		ns || id
			? await buildKey({ tenantCode, orgCode, ns: ns || 'ns', id: id || key })
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
async function setScoped({ tenantCode, orgCode, ns, id, value, ttl = undefined, useInternal = undefined }) {
	if (!namespaceEnabled(ns)) return null
	const resolvedUseInternal = nsUseInternal(ns, useInternal)
	const fullKey = await buildKey({ tenantCode, orgCode, ns, id })
	await set(fullKey, value, nsTtl(ns, ttl), { useInternal: resolvedUseInternal })
	return fullKey
}

/** Scoped delete that uses namespace config (TTL/useInternal)
 * Returns the key that was deleted.
 */
async function delScoped({ tenantCode, orgCode, ns, id, useInternal = undefined }) {
	if (!namespaceEnabled(ns)) return null
	const resolvedUseInternal = nsUseInternal(ns, useInternal)
	const fullKey = await buildKey({ tenantCode, orgCode, ns, id })
	await del(fullKey, { useInternal: resolvedUseInternal })
	return fullKey
}

/**
 * Evict all keys for a namespace.
 * If orgCode is provided will target org-level keys, otherwise tenant-level keys.
 * patternSuffix defaults to '*' (delete all keys under the namespace).
 */
async function evictNamespace({ tenantCode, orgCode = null, ns, patternSuffix = '*' } = {}) {
	if (!tenantCode || !ns) return
	if (!namespaceEnabled(ns)) return
	const base = orgCode ? `tenant:${tenantCode}:org:${orgCode}` : `tenant:${tenantCode}`
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
	async get(tenantCode, orgCode, sessionId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'sessions', id: sessionId })
			const useInternal = nsUseInternal('sessions')
			const cachedSession = await get(cacheKey, { useInternal })
			if (cachedSession) {
				console.log(`💾 Session ${sessionId} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`)
				return cachedSession
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 Session ${sessionId} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)
			const sessionFromDb = await sessionQueries.findById(sessionId, tenantCode)

			if (sessionFromDb) {
				// Cache the fetched data for future requests
				await this.set(tenantCode, orgCode, sessionId, sessionFromDb)
				console.log(
					`💾 Session ${sessionId} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
				)
			}

			return sessionFromDb
		} catch (error) {
			console.error(`❌ Failed to get session ${sessionId} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, sessionId, sessionData, customTtl = null) {
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
			orgCode: orgCode,
			ns: 'sessions',
			id: sessionId,
			value: sessionData,
			ttl,
		})
	},

	async delete(tenantCode, orgCode, sessionId) {
		const useInternal = nsUseInternal('sessions')
		const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'sessions', id: sessionId })
		return del(cacheKey, { useInternal })
	},

	async reset(tenantCode, orgCode, sessionId, sessionData, customTtl = null) {
		return this.set(tenantCode, orgCode, sessionId, sessionData, customTtl)
	},
}

/**
 * EntityTypes Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:entityTypes:model:${modelName}:${entityValue}
 * Stores individual entity types WITH their entities, TTL: 1 day
 */
const entityTypes = {
	async get(tenantCode, orgCode, modelName, entityValue) {
		try {
			const compositeId = `model:${modelName}:${entityValue}`

			// Step 1: Check cache for user's tenant/org
			const userKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'entityTypes', id: compositeId })
			const useInternal = nsUseInternal('entityTypes')
			const cachedEntityType = await get(userKey, { useInternal })
			if (cachedEntityType) {
				console.log(
					`💾 EntityType ${modelName}:${entityValue} retrieved from user cache: tenant:${tenantCode}:org:${orgCode}`
				)
				return cachedEntityType
			}

			// Step 2: Check cache for default tenant/org
			const defaults = await getDefaults()
			if (
				defaults.orgCode &&
				defaults.tenantCode &&
				(defaults.orgCode !== orgCode || defaults.tenantCode !== tenantCode)
			) {
				const defaultKey = await buildKey({
					tenantCode: defaults.tenantCode,
					orgCode: defaults.orgCode,
					ns: 'entityTypes',
					id: compositeId,
				})
				const defaultCachedEntityType = await get(defaultKey, { useInternal })
				if (defaultCachedEntityType) {
					console.log(
						`💾 EntityType ${modelName}:${entityValue} retrieved from default cache: tenant:${defaults.tenantCode}:org:${defaults.orgCode}`
					)
					// Cache in user's tenant/org for future requests
					await this.set(tenantCode, orgCode, modelName, entityValue, defaultCachedEntityType)
					return defaultCachedEntityType
				}
			}

			// Step 3: Cache miss - fallback to database query with both user and default tenant/org
			console.log(
				`💾 EntityType ${modelName}:${entityValue} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)

			if (!defaults.orgCode || !defaults.tenantCode) {
				console.warn('⚠️ Default org/tenant codes not set, using only user tenant/org for database query')
			}

			const filter = {
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: defaults.orgCode ? [orgCode, defaults.orgCode] : [orgCode],
				},
				model_names: { [Op.contains]: [modelName] },
				value: entityValue,
			}
			const entityTypeFromDb = await entityTypeQueries.findUserEntityTypesAndEntities(filter, {
				[Op.in]: defaults.tenantCode ? [tenantCode, defaults.tenantCode] : [tenantCode],
			})

			if (entityTypeFromDb && entityTypeFromDb.length > 0) {
				// Cache the fetched data for future requests in user's tenant/org
				await this.set(tenantCode, orgCode, modelName, entityValue, entityTypeFromDb)
				console.log(
					`💾 EntityType ${modelName}:${entityValue} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
				)
				return entityTypeFromDb
			}

			return null
		} catch (error) {
			console.error(`❌ Failed to get entityType ${modelName}:${entityValue} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, modelName, entityValue, entityTypeData) {
		const compositeId = `model:${modelName}:${entityValue}`
		return setScoped({
			tenantCode,
			orgCode: orgCode,
			ns: 'entityTypes',
			id: compositeId,
			value: entityTypeData,
			ttl: 86400, // 1 day TTL
		})
	},

	async delete(tenantCode, orgCode, modelName, entityValue) {
		const compositeId = `model:${modelName}:${entityValue}`
		const useInternal = nsUseInternal('entityTypes')
		const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'entityTypes', id: compositeId })
		return del(cacheKey, { useInternal })
	},

	// Clear all entityTypes cache for a tenant/org (useful after cache key format changes)
	async clearAll(tenantCode, orgCode) {
		return await evictNamespace({ tenantCode, orgCode: orgCode, ns: 'entityTypes' })
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
	async get(tenantCode, orgCode, type, subtype) {
		const compositeId = `${type}:${subtype}`
		const useInternal = nsUseInternal('forms')
		return get(await buildKey({ tenantCode, orgCode: orgCode, ns: 'forms', id: compositeId }), { useInternal })
	},

	/**
	 * Set specific form with 1-day TTL
	 */
	async set(tenantCode, orgCode, type, subtype, formData) {
		const compositeId = `${type}:${subtype}`
		return setScoped({
			tenantCode,
			orgCode: orgCode,
			ns: 'forms',
			id: compositeId,
			value: formData,
			ttl: 86400, // 1 day TTL
		})
	},

	/**
	 * Delete specific form cache
	 */
	async delete(tenantCode, orgCode, type, subtype) {
		const compositeId = `${type}:${subtype}`
		const useInternal = nsUseInternal('forms')
		const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'forms', id: compositeId })
		return del(cacheKey, { useInternal })
	},

	/**
	 * Invalidate all form-related cache for a tenant/org
	 */
	async evictAll(tenantCode, orgCode) {
		return await evictNamespace({ tenantCode, orgCode: orgCode, ns: 'forms' })
	},
}

/**
 * Organizations Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:organizations:id
 */
const organizations = {
	async get(tenantCode, orgCode, organizationId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'organizations', id: organizationId })
			const useInternal = nsUseInternal('organizations')
			const cachedOrg = await get(cacheKey, { useInternal })
			if (cachedOrg) {
				console.log(
					`💾 Organization ${organizationId} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`
				)
				return cachedOrg
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 Organization ${organizationId} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)
			const orgFromDb = await organisationExtensionQueries.findOne(
				{ organization_id: organizationId },
				tenantCode
			)

			if (orgFromDb) {
				// Cache the fetched data for future requests
				await this.set(tenantCode, orgCode, organizationId, orgFromDb)
				console.log(
					`💾 Organization ${organizationId} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
				)
			}

			return orgFromDb
		} catch (error) {
			console.error(`❌ Failed to get organization ${organizationId} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, organizationId, orgData) {
		return setScoped({
			tenantCode,
			orgCode: orgCode,
			ns: 'organizations',
			id: organizationId,
			value: orgData,
		})
	},

	async delete(tenantCode, orgCode, organizationId) {
		const useInternal = nsUseInternal('organizations')
		const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'organizations', id: organizationId })
		return del(cacheKey, { useInternal })
	},
}

/**
 * Mentor Profile Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:mentor:${id}
 * TTL: 1 day (86400 seconds)
 */
const mentor = {
	async get(tenantCode, orgCode, mentorId, raw = true) {
		try {
			// If raw is true, skip cache and return direct database query
			if (raw) {
				console.log(
					`🔄 Raw mode: Fetching fresh mentor profile ${mentorId} from database: tenant:${tenantCode}:org:${orgCode}`
				)
				return await mentorQueries.getMentorExtension(mentorId, [], false, tenantCode)
			}

			// Cache mode: Check cache first
			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'mentor', id: mentorId })
			const useInternal = nsUseInternal('mentor')
			const cachedProfile = await get(cacheKey, { useInternal })
			if (cachedProfile) {
				console.log(`💾 Mentor profile ${mentorId} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`)
				return cachedProfile
			}

			// Cache miss - will be handled by service layer to cache complete response
			console.log(
				`💾 Mentor profile ${mentorId} cache miss, returning null for service layer handling: tenant:${tenantCode}:org:${orgCode}`
			)
			return null
		} catch (error) {
			console.error(`❌ Failed to get mentor profile ${mentorId} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, mentorId, profileData) {
		try {
			// Sanitize profile data - remove fields that are cached separately
			const sanitizedData = this._sanitizeProfileData(profileData)

			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'mentor', id: mentorId })
			const useInternal = nsUseInternal('mentor')
			await set(cacheKey, sanitizedData, 86400, { useInternal }) // 1 day TTL
			console.log(`💾 Mentor profile ${mentorId} cached: tenant:${tenantCode}:org:${orgCode}`)
		} catch (error) {
			console.error(`❌ Failed to cache mentor profile ${mentorId}:`, error)
		}
	},

	async delete(tenantCode, orgCode, mentorId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'mentor', id: mentorId })
			const useInternal = nsUseInternal('mentor')
			await del(cacheKey, { useInternal })
			// Mentor cache deleted
		} catch (error) {
			console.error(`❌ Failed to delete mentor profile ${mentorId} cache:`, error)
		}
	},

	_sanitizeProfileData(profileData) {
		const sanitized = { ...profileData }

		// Remove fields that are cached separately - get from existing caches
		delete sanitized.displayProperties // Get from displayProperties cache
		delete sanitized.Permissions // Get from permissions cache
		delete sanitized.connectedUsers // Will implement separate cache
		delete sanitized.email // Security: don't cache email
		delete sanitized.email_verified // Security: don't cache email verification

		// Handle image URL - don't cache downloadable URLs
		if (sanitized.image && typeof sanitized.image === 'string' && sanitized.image.includes('download')) {
			delete sanitized.image
		}

		return sanitized
	},
}

/**
 * Mentee Profile Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:mentee:${id}
 * TTL: 1 day (86400 seconds)
 */
const mentee = {
	async get(tenantCode, orgCode, menteeId, raw = true) {
		try {
			// If raw is true, skip cache and return direct database query
			if (raw) {
				console.log(
					`🔄 Raw mode: Fetching fresh mentee profile ${menteeId} from database: tenant:${tenantCode}:org:${orgCode}`
				)
				return await userQueries.getMenteeExtension(menteeId, [], false, tenantCode)
			}

			// Cache mode: Check cache first
			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'mentee', id: menteeId })
			const useInternal = nsUseInternal('mentee')
			const cachedProfile = await get(cacheKey, { useInternal })
			if (cachedProfile) {
				console.log(`💾 Mentee profile ${menteeId} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`)
				return cachedProfile
			}

			// Cache miss - will be handled by service layer to cache complete response
			console.log(
				`💾 Mentee profile ${menteeId} cache miss, returning null for service layer handling: tenant:${tenantCode}:org:${orgCode}`
			)
			return null
		} catch (error) {
			console.error(`❌ Failed to get mentee profile ${menteeId} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, menteeId, profileData) {
		try {
			// Sanitize profile data - remove fields that are cached separately
			const sanitizedData = this._sanitizeProfileData(profileData)

			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'mentee', id: menteeId })
			const useInternal = nsUseInternal('mentee')
			await set(cacheKey, sanitizedData, 86400, { useInternal }) // 1 day TTL
			console.log(`💾 Mentee profile ${menteeId} cached: tenant:${tenantCode}:org:${orgCode}`)
		} catch (error) {
			console.error(`❌ Failed to cache mentee profile ${menteeId}:`, error)
		}
	},

	async delete(tenantCode, orgCode, menteeId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'mentee', id: menteeId })
			const useInternal = nsUseInternal('mentee')
			await del(cacheKey, { useInternal })
			// Mentee cache deleted
		} catch (error) {
			console.error(`❌ Failed to delete mentee profile ${menteeId} cache:`, error)
		}
	},

	_sanitizeProfileData(profileData) {
		const sanitized = { ...profileData }

		// Remove fields that are cached separately - get from existing caches
		delete sanitized.displayProperties // Get from displayProperties cache
		delete sanitized.Permissions // Get from permissions cache
		delete sanitized.connectedUsers // Will implement separate cache
		delete sanitized.email // Security: don't cache email
		delete sanitized.email_verified // Security: don't cache email verification

		// Handle image URL - don't cache downloadable URLs
		if (sanitized.image && typeof sanitized.image === 'string' && sanitized.image.includes('download')) {
			delete sanitized.image
		}

		return sanitized
	},
}

/**
 * Platform Config Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:platformConfig
 */
const platformConfig = {
	async get(tenantCode, orgCode) {
		const useInternal = nsUseInternal('platformConfig')
		return get(await buildKey({ tenantCode, orgCode: orgCode, ns: 'platformConfig', id: '' }), { useInternal })
	},

	async set(tenantCode, orgCode, configData) {
		return setScoped({
			tenantCode,
			orgCode: orgCode,
			ns: 'platformConfig',
			id: '',
			value: configData,
		})
	},

	async delete(tenantCode, orgCode) {
		const useInternal = nsUseInternal('platformConfig')
		const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'platformConfig', id: '' })
		return del(cacheKey, { useInternal })
	},
}

/**
 * Notification Templates Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:templateCode:code
 */
const notificationTemplates = {
	async get(tenantCodes, orgCodes, templateCode) {
		try {
			const compositeId = `templateCode:${templateCode}`

			// Ensure arrays
			const tenantCodesArray = Array.isArray(tenantCodes) ? tenantCodes : [tenantCodes]
			const orgCodesArray = Array.isArray(orgCodes) ? orgCodes : [orgCodes]

			// First check user-specific cache combinations
			const useInternal = nsUseInternal('notificationTemplates')
			for (const tenantCode of tenantCodesArray) {
				for (const orgCode of orgCodesArray) {
					const userCacheKey = await buildKey({
						tenantCode,
						orgCode,
						ns: 'notificationTemplates',
						id: compositeId,
					})
					const cachedTemplate = await get(userCacheKey, { useInternal })
					if (cachedTemplate) {
						console.log(
							`💾 NotificationTemplate ${templateCode} retrieved from user cache: tenant:${tenantCode}:org:${orgCode}`
						)
						return cachedTemplate
					}
				}
			}

			// Get defaults for fallback cache and database query
			const defaults = await getDefaults()

			// Check default cache if defaults are available
			if (defaults && defaults.orgCode && defaults.tenantCode) {
				const defaultCacheKey = await buildKey({
					tenantCode: defaults.tenantCode,
					orgCode: defaults.orgCode,
					ns: 'notificationTemplates',
					id: compositeId,
				})
				const defaultCachedTemplate = await get(defaultCacheKey, { useInternal })
				if (defaultCachedTemplate) {
					console.log(
						`💾 NotificationTemplate ${templateCode} retrieved from default cache: tenant:${defaults.tenantCode}:org:${defaults.orgCode}`
					)
					// Cache in first user combination for faster future access
					await this.set(tenantCodesArray[0], orgCodesArray[0], templateCode, defaultCachedTemplate)
					return defaultCachedTemplate
				}
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 NotificationTemplate ${templateCode} cache miss, fetching from database with codes: tenants:[${tenantCodesArray.join(
					','
				)}] orgs:[${orgCodesArray.join(',')}]`
			)

			// Combine user codes with defaults for database query
			let allOrgCodes = [...orgCodesArray]
			let allTenantCodes = [...tenantCodesArray]

			if (defaults && defaults.orgCode && defaults.tenantCode) {
				if (!allOrgCodes.includes(defaults.orgCode)) {
					allOrgCodes.push(defaults.orgCode)
				}
				if (!allTenantCodes.includes(defaults.tenantCode)) {
					allTenantCodes.push(defaults.tenantCode)
				}
			}

			// Use combination of user and default codes for database query
			const templateFromDb = await notificationTemplateQueries.findOneEmailTemplate(
				templateCode,
				{ [Op.in]: allOrgCodes },
				{ [Op.in]: allTenantCodes }
			)

			if (templateFromDb) {
				// Cache the result under the matching tenant/org combination
				const matchingTenant = templateFromDb.tenant_code
				const matchingOrg = templateFromDb.organization_code

				await this.set(matchingTenant, matchingOrg, templateCode, templateFromDb)
				console.log(
					`💾 NotificationTemplate ${templateCode} fetched from database and cached: tenant:${matchingTenant}:org:${matchingOrg}`
				)
			}

			return templateFromDb
		} catch (error) {
			console.error(`❌ Failed to get notificationTemplate ${templateCode} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, templateCode, templateData) {
		const compositeId = `templateCode:${templateCode}`
		return setScoped({
			tenantCode,
			orgCode: orgCode,
			ns: 'notificationTemplates',
			id: compositeId,
			value: templateData,
		})
	},

	async delete(tenantCode, orgCode, templateCode) {
		const compositeId = `templateCode:${templateCode}`
		const useInternal = nsUseInternal('notificationTemplates')
		const cacheKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'notificationTemplates', id: compositeId })
		return del(cacheKey, { useInternal })
	},
}

/**
 * Display Properties Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:displayProperties
 * Fallback Pattern: tenant:${tenantCode}:displayProperties
 */
const displayProperties = {
	async get(tenantCode, orgCode) {
		try {
			const useInternal = nsUseInternal('displayProperties')

			// Try org-specific cache first
			const orgSpecific = await get(
				await buildKey({ tenantCode, orgCode: orgCode, ns: 'displayProperties', id: '' }),
				{ useInternal }
			)
			if (orgSpecific) {
				console.log(`💾 Display properties found in org-specific cache: tenant:${tenantCode}:org:${orgCode}`)
				return orgSpecific
			}

			// Fallback to tenant-only cache
			const tenantOnly = await get(await buildKey({ tenantCode, orgCode: '', ns: 'displayProperties', id: '' }), {
				useInternal,
			})
			if (tenantOnly) {
				console.log(`💾 Display properties found in tenant-only cache: tenant:${tenantCode}`)
				return tenantOnly
			}

			// Cache miss - fallback to building display properties from entity types
			console.log(
				`💾 Display properties cache miss for tenant:${tenantCode} org:${orgCode}, building from entity types`
			)

			// This is a complex fallback - display properties are typically built from entity types
			// We'll return null here and let the calling service handle the fallback
			// This ensures we don't duplicate the complex entity type processing logic
			console.log(
				`❌ Display properties cache miss for tenant:${tenantCode} org:${orgCode} - caller should handle fallback`
			)
			return null
		} catch (error) {
			console.error(`❌ Failed to get display properties from cache:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, propertiesData) {
		// Cache at org-specific level
		await setScoped({
			tenantCode,
			orgCode: orgCode,
			ns: 'displayProperties',
			id: '',
			value: propertiesData,
		})

		// Also cache at tenant-only level as fallback
		await setScoped({
			tenantCode,
			orgCode: '',
			ns: 'displayProperties',
			id: '',
			value: propertiesData,
		})

		console.log(
			`💾 Display properties cached at both levels: tenant:${tenantCode}:org:${orgCode} and tenant:${tenantCode}`
		)
	},

	async delete(tenantCode, orgCode) {
		const useInternal = nsUseInternal('displayProperties')

		// Delete both org-specific and tenant-only caches
		const orgKey = await buildKey({ tenantCode, orgCode: orgCode, ns: 'displayProperties', id: '' })
		const tenantKey = await buildKey({ tenantCode, orgCode: '', ns: 'displayProperties', id: '' })

		await del(orgKey, { useInternal })
		await del(tenantKey, { useInternal })

		console.log(
			`🗑️ Display properties cache deleted at both levels: tenant:${tenantCode}:org:${orgCode} and tenant:${tenantCode}`
		)
	},
}

/**
 * Permissions Cache Helpers
 * Pattern: permissions:role:${role}
 * Global permissions (no tenant/org context) - Individual role-based caching
 */
const permissions = {
	async get(role) {
		try {
			const key = `permissions:role:${role}`
			const useInternal = nsUseInternal('permissions')
			const cachedPermissions = await get(key, { useInternal })
			if (cachedPermissions) {
				console.log(`💾 Permissions for role ${role} retrieved from cache`)
				return cachedPermissions
			}

			// Cache miss - fallback to database query
			console.log(`💾 Permissions for role ${role} cache miss, fetching from database`)
			const filter = { role_title: [role] }
			const attributes = ['module', 'request_type', 'api_path']
			const rolePermissionsData = await rolePermissionMappingQueries.findAll(filter, attributes)

			// Format to match expected structure with service field
			const permissionsFromDb = rolePermissionsData.map((permission) => ({
				module: permission.module,
				request_type: permission.request_type,
				service: common.MENTORING_SERVICE,
			}))

			if (permissionsFromDb && permissionsFromDb.length > 0) {
				// Cache the fetched data for future requests
				await this.set(role, permissionsFromDb)
				console.log(`💾 Permissions for role ${role} fetched from database and cached`)
			}

			return permissionsFromDb || []
		} catch (error) {
			console.error(`❌ Failed to get permissions for role ${role} from cache/database:`, error)
			return []
		}
	},

	async set(role, permissionsData) {
		const key = `permissions:role:${role}`
		const useInternal = nsUseInternal('permissions')
		return set(key, permissionsData, undefined, { useInternal })
	},

	async delete(role) {
		const key = `permissions:role:${role}`
		const useInternal = nsUseInternal('permissions')
		return del(key, { useInternal })
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
		const useInternal = nsUseInternal('apiPermissions')
		return get(key, { useInternal })
	},

	/**
	 * Set permissions for a single role-module-path combination
	 * Data format: { "request_type": ["GET", "POST", "DELETE", "PUT", "PATCH"] }
	 */
	async setSingleRole(role, module, apiPath, requestTypes) {
		const key = `apiPermissions:role:${role}:module:${module}:api_path:${apiPath}`
		const permissionData = { request_type: requestTypes }
		const useInternal = nsUseInternal('apiPermissions')
		return set(key, permissionData, undefined, { useInternal })
	},

	/**
	 * Delete permissions for a single role-module-path combination
	 */
	async deleteSingleRole(role, module, apiPath) {
		const key = `apiPermissions:role:${role}:module:${module}:api_path:${apiPath}`
		const useInternal = nsUseInternal('apiPermissions')
		return del(key, { useInternal })
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

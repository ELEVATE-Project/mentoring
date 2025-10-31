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
	async get(tenantCode, orgCode, sessionId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'sessions', id: sessionId })
			const cachedSession = await get(cacheKey)
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
			orgId: orgCode,
			ns: 'sessions',
			id: sessionId,
			value: sessionData,
			ttl,
		})
	},

	async delete(tenantCode, orgCode, sessionId) {
		return delScoped({ tenantCode, orgId: orgCode, ns: 'sessions', id: sessionId })
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
			const key = await buildKey({ tenantCode, orgId: orgCode, ns: 'entityTypes', id: compositeId })
			const cachedEntityType = await get(key)
			if (cachedEntityType) {
				console.log(
					`💾 EntityType ${modelName}:${entityValue} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`
				)
				return cachedEntityType
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 EntityType ${modelName}:${entityValue} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)
			const filter = {
				status: 'ACTIVE',
				organization_code: orgCode,
				model_names: { [Op.contains]: [modelName] },
				value: entityValue,
			}
			const entityTypeFromDb = await entityTypeQueries.findUserEntityTypesAndEntities(filter, {
				[Op.in]: [tenantCode],
			})

			if (entityTypeFromDb) {
				// Cache the fetched data for future requests
				await this.set(tenantCode, orgCode, modelName, entityValue, entityTypeFromDb)
				console.log(
					`💾 EntityType ${modelName}:${entityValue} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
				)
			}

			return entityTypeFromDb
		} catch (error) {
			console.error(`❌ Failed to get entityType ${modelName}:${entityValue} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, modelName, entityValue, entityTypeData) {
		const compositeId = `model:${modelName}:${entityValue}`
		return setScoped({
			tenantCode,
			orgId: orgCode,
			ns: 'entityTypes',
			id: compositeId,
			value: entityTypeData,
			ttl: 86400, // 1 day TTL
		})
	},

	async delete(tenantCode, orgCode, modelName, entityValue) {
		const compositeId = `model:${modelName}:${entityValue}`
		return delScoped({ tenantCode, orgId: orgCode, ns: 'entityTypes', id: compositeId })
	},

	// Clear all entityTypes cache for a tenant/org (useful after cache key format changes)
	async clearAll(tenantCode, orgCode) {
		return await evictNamespace({ tenantCode, orgId: orgCode, ns: 'entityTypes' })
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
		return get(await buildKey({ tenantCode, orgId: orgCode, ns: 'forms', id: compositeId }))
	},

	/**
	 * Set specific form with 1-day TTL
	 */
	async set(tenantCode, orgCode, type, subtype, formData) {
		const compositeId = `${type}:${subtype}`
		return setScoped({
			tenantCode,
			orgId: orgCode,
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
		return delScoped({ tenantCode, orgId: orgCode, ns: 'forms', id: compositeId })
	},

	/**
	 * Invalidate all form-related cache for a tenant/org
	 */
	async evictAll(tenantCode, orgCode) {
		return await evictNamespace({ tenantCode, orgId: orgCode, ns: 'forms' })
	},
}

/**
 * Organizations Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:organizations:id
 */
const organizations = {
	async get(tenantCode, orgCode, organizationId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'organizations', id: organizationId })
			const cachedOrg = await get(cacheKey)
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
			orgId: orgCode,
			ns: 'organizations',
			id: organizationId,
			value: orgData,
		})
	},

	async delete(tenantCode, orgCode, organizationId) {
		return delScoped({ tenantCode, orgId: orgCode, ns: 'organizations', id: organizationId })
	},
}

/**
 * Mentor Profile Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:mentor:${id}
 * TTL: 1 day (86400 seconds)
 */
const mentor = {
	async get(tenantCode, orgCode, mentorId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'mentor', id: mentorId })
			const cachedProfile = await get(cacheKey)
			if (cachedProfile) {
				console.log(`💾 Mentor profile ${mentorId} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`)
				return cachedProfile
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 Mentor profile ${mentorId} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)
			const profileFromDb = await mentorQueries.getMentorExtension(mentorId, [], false, tenantCode)

			if (profileFromDb) {
				// Cache the fetched data for future requests
				await this.set(tenantCode, orgCode, mentorId, profileFromDb)
				console.log(
					`💾 Mentor profile ${mentorId} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
				)
			}

			return profileFromDb
		} catch (error) {
			console.error(`❌ Failed to get mentor profile ${mentorId} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, mentorId, profileData) {
		try {
			// Sanitize profile data - remove fields that are cached separately
			const sanitizedData = this._sanitizeProfileData(profileData)

			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'mentor', id: mentorId })
			await set(cacheKey, sanitizedData, 86400) // 1 day TTL
			console.log(`💾 Mentor profile ${mentorId} cached: tenant:${tenantCode}:org:${orgCode}`)
		} catch (error) {
			console.error(`❌ Failed to cache mentor profile ${mentorId}:`, error)
		}
	},

	async delete(tenantCode, orgCode, mentorId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'mentor', id: mentorId })
			await del(cacheKey)
			console.log(`🗑️ Mentor profile ${mentorId} cache deleted: tenant:${tenantCode}:org:${orgCode}`)
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
	async get(tenantCode, orgCode, menteeId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'mentee', id: menteeId })
			const cachedProfile = await get(cacheKey)
			if (cachedProfile) {
				console.log(`💾 Mentee profile ${menteeId} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`)
				return cachedProfile
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 Mentee profile ${menteeId} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)
			const profileFromDb = await userQueries.getUserExtensionByUserId(menteeId, tenantCode)

			if (profileFromDb) {
				// Cache the fetched data for future requests
				await this.set(tenantCode, orgCode, menteeId, profileFromDb)
				console.log(
					`💾 Mentee profile ${menteeId} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
				)
			}

			return profileFromDb
		} catch (error) {
			console.error(`❌ Failed to get mentee profile ${menteeId} from cache/database:`, error)
			return null
		}
	},

	async set(tenantCode, orgCode, menteeId, profileData) {
		try {
			// Sanitize profile data - remove fields that are cached separately
			const sanitizedData = this._sanitizeProfileData(profileData)

			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'mentee', id: menteeId })
			await set(cacheKey, sanitizedData, 86400) // 1 day TTL
			console.log(`💾 Mentee profile ${menteeId} cached: tenant:${tenantCode}:org:${orgCode}`)
		} catch (error) {
			console.error(`❌ Failed to cache mentee profile ${menteeId}:`, error)
		}
	},

	async delete(tenantCode, orgCode, menteeId) {
		try {
			const cacheKey = await buildKey({ tenantCode, orgId: orgCode, ns: 'mentee', id: menteeId })
			await del(cacheKey)
			console.log(`🗑️ Mentee profile ${menteeId} cache deleted: tenant:${tenantCode}:org:${orgCode}`)
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
		return get(await buildKey({ tenantCode, orgId: orgCode, ns: 'platformConfig', id: '' }))
	},

	async set(tenantCode, orgCode, configData) {
		return setScoped({
			tenantCode,
			orgId: orgCode,
			ns: 'platformConfig',
			id: '',
			value: configData,
		})
	},

	async delete(tenantCode, orgCode) {
		return delScoped({ tenantCode, orgId: orgCode, ns: 'platformConfig', id: '' })
	},
}

/**
 * Notification Templates Cache Helpers
 * Pattern: tenant:${tenantCode}:org:${orgCode}:templateCode:code
 */
const notificationTemplates = {
	async get(tenantCode, orgCode, templateCode) {
		try {
			const compositeId = `templateCode:${templateCode}`
			const cacheKey = await buildKey({
				tenantCode,
				orgId: orgCode,
				ns: 'notificationTemplates',
				id: compositeId,
			})
			const cachedTemplate = await get(cacheKey)
			if (cachedTemplate) {
				console.log(
					`💾 NotificationTemplate ${templateCode} retrieved from cache: tenant:${tenantCode}:org:${orgCode}`
				)
				return cachedTemplate
			}

			// Cache miss - fallback to database query
			console.log(
				`💾 NotificationTemplate ${templateCode} cache miss, fetching from database: tenant:${tenantCode}:org:${orgCode}`
			)
			const filter = {
				code: templateCode,
				organization_code: orgCode,
				type: 'email',
				status: 'active',
			}
			const templateFromDb = await notificationTemplateQueries.findOne(filter, tenantCode)

			if (templateFromDb) {
				// Cache the fetched data for future requests
				await this.set(tenantCode, orgCode, templateCode, templateFromDb)
				console.log(
					`💾 NotificationTemplate ${templateCode} fetched from database and cached: tenant:${tenantCode}:org:${orgCode}`
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
			orgId: orgCode,
			ns: 'notificationTemplates',
			id: compositeId,
			value: templateData,
		})
	},

	async delete(tenantCode, orgCode, templateCode) {
		const compositeId = `templateCode:${templateCode}`
		return delScoped({ tenantCode, orgId: orgCode, ns: 'notificationTemplates', id: compositeId })
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
			// Try org-specific cache first
			const orgSpecific = await get(
				await buildKey({ tenantCode, orgId: orgCode, ns: 'displayProperties', id: '' })
			)
			if (orgSpecific) {
				console.log(`💾 Display properties found in org-specific cache: tenant:${tenantCode}:org:${orgCode}`)
				return orgSpecific
			}

			// Fallback to tenant-only cache
			const tenantOnly = await get(await buildKey({ tenantCode, orgId: '', ns: 'displayProperties', id: '' }))
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
			orgId: orgCode,
			ns: 'displayProperties',
			id: '',
			value: propertiesData,
		})

		// Also cache at tenant-only level as fallback
		await setScoped({
			tenantCode,
			orgId: '',
			ns: 'displayProperties',
			id: '',
			value: propertiesData,
		})

		console.log(
			`💾 Display properties cached at both levels: tenant:${tenantCode}:org:${orgCode} and tenant:${tenantCode}`
		)
	},

	async delete(tenantCode, orgCode) {
		// Delete both org-specific and tenant-only caches
		await delScoped({ tenantCode, orgId: orgCode, ns: 'displayProperties', id: '' })
		await delScoped({ tenantCode, orgId: '', ns: 'displayProperties', id: '' })
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
			const cachedPermissions = await get(key)
			if (cachedPermissions) {
				console.log(`💾 Permissions for role ${role} retrieved from cache`)
				return cachedPermissions
			}

			// Cache miss - fallback to database query
			console.log(`💾 Permissions for role ${role} cache miss, fetching from database`)
			const permissionsFromDb = await permissionQueries.findAllPermissions({ role_title: role })

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
 * Pattern: tenant:${tenantCode}:org:${orgCode}:userExtensions:${userId}
 */
const userExtensions = {
	async get(tenantCode, orgCode, userId) {
		return get(await buildKey({ tenantCode, orgId: orgCode, ns: 'userExtensions', id: userId }))
	},

	async set(tenantCode, orgCode, userId, extensionData) {
		// Don't cache sensitive data like email
		const sanitizedData = { ...extensionData }
		if (sanitizedData.email) delete sanitizedData.email

		return setScoped({
			tenantCode,
			orgId: orgCode,
			ns: 'userExtensions',
			id: userId,
			value: sanitizedData,
		})
	},

	async delete(tenantCode, orgCode, userId) {
		return delScoped({ tenantCode, orgId: orgCode, ns: 'userExtensions', id: userId })
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

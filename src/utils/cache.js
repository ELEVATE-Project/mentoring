// cacheUtils.js

const { RedisCache, InternalCache } = require('elevate-node-cache')

/**
 * Set a key-value pair in the internal cache.
 * @param {string} key - The key to set.
 * @param {any} value - The value to set.
 * @returns {boolean} Returns true if the key-value pair is successfully set, otherwise false.
 */
const internalSet = (key, value) => InternalCache.setKey(key, value)

/**
 * Delete a key from the internal cache.
 * @param {string} key - The key to delete.
 * @returns {boolean} Returns true if the key is successfully deleted, otherwise false.
 */
const internalDel = (key) => InternalCache.delKey(key)

/**
 * Get the value associated with a key from the internal cache.
 * @param {string} key - The key to get the value for.
 * @returns {any} The value associated with the key, or undefined if the key does not exist.
 */
const internalGet = (key) => InternalCache.getKey(key)

/**
 * Set a key-value pair in the Redis cache.
 * @param {string} key - The key to set.
 * @param {any} value - The value to set.
 * @param {number} exp - The expiration time for the key-value pair (in seconds).
 * @returns {boolean} Returns true if the key-value pair is successfully set, otherwise false.
 */
const redisSet = (key, value, exp) => RedisCache.setKey(key, value, exp)

/**
 * Delete a key from the Redis cache.
 * @param {string} key - The key to delete.
 * @returns {boolean} Returns true if the key is successfully deleted, otherwise false.
 */
const redisDel = (key) => RedisCache.deleteKey(key)

/**
 * Get the value associated with a key from the Redis cache.
 * @param {string} key - The key to get the value for.
 * @returns {any} The value associated with the key, or undefined if the key does not exist.
 */
const redisGet = (key) => RedisCache.getKey(key)

const cache = {
	internalSet,
	internalDel,
	internalGet,
	redisSet,
	redisDel,
	redisGet,
}

module.exports = cache

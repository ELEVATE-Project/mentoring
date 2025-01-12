/**
 * name : utils.js
 * author : Aman
 * created-date : 04-Nov-2021
 * Description : Utils helper function.
 */

const bcryptJs = require('bcryptjs')
const { cloudClient } = require('@configs/cloud-service')
const momentTimeZone = require('moment-timezone')
const moment = require('moment')
const path = require('path')
const md5 = require('md5')
const fs = require('fs')
const { RedisCache, InternalCache } = require('elevate-node-cache')
const startCase = require('lodash/startCase')
const common = require('@constants/common')
const crypto = require('crypto')
const _ = require('lodash')

const hash = (str) => {
	const salt = bcryptJs.genSaltSync(10)
	let hashstr = bcryptJs.hashSync(str, salt)
	return hashstr
}

const elapsedMinutes = (date1, date2) => {
	var difference = date1 - date2
	let result = difference / 60000
	return result
}

const getIstDate = () => {
	return new Date(new Date().getTime() + (5 * 60 + 30) * 60000)
}

const getCurrentMonthRange = () => {
	const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
	let month = new Date().getMonth()
	const year = new Date().getFullYear()
	let dayInMonth = monthDays[month]
	if (month === 1 && year % 4 === 0) {
		// Feb for leap year
		dayInMonth = 29
	}
	month += 1
	month = month < 10 ? '0' + month : month
	return [new Date(`${year}-${month}-01`), new Date(`${year}-${month}-${dayInMonth}`)]
}

const getCurrentWeekRange = () => {
	const currentDate = new Date().getTime() // in ms
	const currentDay = new Date().getDay() * 24 * 60 * 60 * 1000 // in ms
	const firstDay = currentDate - currentDay
	const lastDay = firstDay + 6 * 24 * 60 * 60 * 1000
	return [new Date(firstDay), new Date(lastDay)]
}

const getCurrentQuarterRange = () => {
	const today = new Date()
	const quarter = Math.floor(today.getMonth() / 3)
	const startFullQuarter = new Date(today.getFullYear(), quarter * 3, 1)
	const endFullQuarter = new Date(startFullQuarter.getFullYear(), startFullQuarter.getMonth() + 3, 0)
	return [startFullQuarter, endFullQuarter]
}

const composeEmailBody = (body, params) => {
	return body.replace(/{([^{}]*)}/g, (a, b) => {
		var r = params[b]
		return typeof r === 'string' || typeof r === 'number' ? r : a
	})
}

const extractEmailTemplate = (input, conditions) => {
	const allConditionsRegex = /{{(.*?)}}(.*?){{\/\1}}/g
	let result = input

	for (const match of input.matchAll(allConditionsRegex)) {
		result = conditions.includes(match[1]) ? result.replace(match[0], match[2]) : result.replace(match[0], '')
	}

	return result
}

const getDownloadableUrl = async (filePath) => {
	let bucketName = process.env.CLOUD_STORAGE_BUCKETNAME
	let expiryInSeconds = parseInt(process.env.SIGNED_URL_EXPIRY_DURATION) || 300
	let updatedExpiryTime = convertExpiryTimeToSeconds(expiryInSeconds)
	let response = await cloudClient.getSignedUrl(bucketName, filePath, updatedExpiryTime, common.READ_ACCESS)
	return Array.isArray(response) ? response[0] : response
}

const getPublicDownloadableUrl = async (bucketName, filePath) => {
	let downloadableUrl = await cloudClient.getDownloadableUrl(bucketName, filePath)
	return downloadableUrl
}

const getTimeZone = (date, format, tz = null) => {
	let timeZone = typeof date === 'number' || !isNaN(date) ? moment.unix(date) : moment(date)

	if (tz) {
		timeZone.tz(tz)
	}
	timeZone = moment(timeZone).format(format)
	return timeZone
}

const utcFormat = () => {
	return momentTimeZone().utc().format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * md5 hash
 * @function
 * @name md5Hash
 * @returns {String} returns uuid.
 */

function md5Hash(value) {
	return md5(value)
}

function internalSet(key, value) {
	return InternalCache.setKey(key, value)
}
function internalGet(key) {
	return InternalCache.getKey(key)
}
function internalDel(key) {
	return InternalCache.delKey(key)
}

function redisSet(key, value, exp) {
	return RedisCache.setKey(key, value, exp)
}
function redisGet(key) {
	return RedisCache.getKey(key)
}
function redisDel(key) {
	return RedisCache.deleteKey(key)
}
const capitalize = (str) => {
	return startCase(str)
}
const isAMentor = (roles) => {
	return roles.some((role) => role.title == common.MENTOR_ROLE)
}
function isNumeric(value) {
	return /^\d+$/.test(value)
}

function validateInput(input, validationData, modelName, skipValidation = false) {
	const errors = []

	function addError(param, value, dataType, message) {
		errors.push({
			param,
			msg: `${value} is invalid for data type ${dataType}. ${message}`,
		})
	}

	for (const field of validationData) {
		const fieldValue = input[field.value]

		if (!skipValidation && field.required && !(field.value in input)) {
			errors.push({
				param: field.value,
				msg: `${field.value} is required but missing in the input data.`,
			})
			continue
		}

		if (modelName && !field.model_names.includes(modelName) && fieldValue) {
			errors.push({
				param: field.value,
				msg: `${field.value} is not allowed for the ${modelName} model.`,
			})
			continue
		}

		if (fieldValue !== undefined) {
			switch (field.data_type) {
				case 'ARRAY[STRING]':
					if (!Array.isArray(fieldValue)) {
						addError(field.value, field.value, 'ARRAY[STRING]', 'It should be an array.')
						break
					}
					for (const element of fieldValue) {
						if (typeof element !== 'string')
							addError(field.value, element, 'STRING', 'It should be a string.')
						else if (field.allow_custom_entities) validateCustomEntity(element, field)
					}
					break

				case 'STRING':
					if (typeof fieldValue !== 'string')
						addError(field.value, fieldValue, 'STRING', 'It should be a string.')
					else if (field.allow_custom_entities) validateCustomEntity(fieldValue, field)
					break

				case 'INTEGER':
				case 'NUMBER':
					if (typeof fieldValue !== 'number')
						addError(field.value, fieldValue, field.data_type, 'It should be a number.')
					break
			}
		}

		if (fieldValue && !field.allow_custom_entities && field.has_entities !== false)
			input[field.value] = validateEntities(fieldValue, field)
	}

	return errors.length === 0 ? { success: true, message: 'Validation successful' } : { success: false, errors }

	function validateCustomEntity(value, field) {
		if (field.regex && !new RegExp(field.regex).test(value))
			addError(field.value, value, 'STRING', `Does not match the required pattern: ${field.regex}`)
		else if (!field.regex && /[^A-Za-z0-9\s_]/.test(value))
			addError(field.value, value, 'STRING', 'It should not contain special characters except underscore.')
	}

	function validateEntities(value, field) {
		let values = Array.isArray(value) ? value : [value]
		values = values.filter((val) => field.entities.some((entity) => entity.value === val))
		return Array.isArray(value) ? values : values[0]
	}
}

const entityTypeMapGenerator = (entityTypeData) => {
	try {
		const entityTypeMap = new Map()
		entityTypeData.forEach((entityType) => {
			const labelsMap = new Map()
			const entities = entityType.entities.map((entity) => {
				labelsMap.set(entity.value, entity.label)
				return entity.value
			})
			if (!entityTypeMap.has(entityType.value)) {
				const entityMap = new Map()
				entityMap.set('allow_custom_entities', entityType.allow_custom_entities)
				entityMap.set('entities', new Set(entities))
				entityMap.set('labels', labelsMap)
				entityTypeMap.set(entityType.value, entityMap)
			}
		})
		return entityTypeMap
	} catch (err) {
		console.log(err)
	}
}

function restructureBody(requestBody, entityData, allowedKeys) {
	try {
		const entityTypeMap = entityTypeMapGenerator(entityData)
		const doesAffectedFieldsExist = Object.keys(requestBody).some((element) => entityTypeMap.has(element))
		// if request body doesn't have field to restructure break the operation return requestBody
		if (!doesAffectedFieldsExist) return requestBody
		// add object custom_entity_text to request body
		requestBody.custom_entity_text = {}
		// If request body does not contain meta add meta object
		if (!requestBody.meta) requestBody.meta = {}
		// Iterate through each key in request body
		for (const currentFieldName in requestBody) {
			// store correct key's value
			const [currentFieldValue, isFieldValueAnArray] = Array.isArray(requestBody[currentFieldName])
				? [[...requestBody[currentFieldName]], true] //If the requestBody[currentFieldName] is array, make a copy in currentFieldValue than a reference
				: [requestBody[currentFieldName], false]
			// Get entity type mapped to current data
			const entityType = entityTypeMap.get(currentFieldName)
			// Check if the current data have any entity type associated with and if allow_custom_entities= true enter to if case
			if (entityType && entityType.get('allow_custom_entities')) {
				// If current field value is of type Array enter to this if condition
				if (isFieldValueAnArray) {
					requestBody[currentFieldName] = [] //Set the original field value as empty array so that it can be re-populated again
					const recognizedEntities = []
					const customEntities = []
					// Iterate though correct fields value of type Array
					for (const value of currentFieldValue) {
						// If entity has entities which matches value push the data into recognizedEntities array
						// Else push to customEntities as { value: 'other', label: value }
						if (entityType.get('entities').has(value)) recognizedEntities.push(value)
						else customEntities.push({ value: 'other', label: value })
					}
					// If we have data in recognizedEntities
					if (recognizedEntities.length > 0)
						if (allowedKeys.includes(currentFieldName))
							// If the current field have a concrete column in db assign recognizedEntities to requestBody[currentFieldName]
							// Else add that into meta
							requestBody[currentFieldName] = recognizedEntities
						else requestBody.meta[currentFieldName] = recognizedEntities
					if (customEntities.length > 0) {
						requestBody[currentFieldName].push('other') //This should cause error at DB write
						requestBody.custom_entity_text[currentFieldName] = customEntities
					}
				} else {
					if (!entityType.get('entities').has(currentFieldValue)) {
						requestBody.custom_entity_text[currentFieldName] = {
							value: 'other',
							label: currentFieldValue,
						}
						if (allowedKeys.includes(currentFieldName))
							requestBody[currentFieldName] = 'other' //This should cause error at DB write
						else requestBody.meta[currentFieldName] = 'other'
					} else if (!allowedKeys.includes(currentFieldName))
						requestBody.meta[currentFieldName] = currentFieldValue
				}
			}

			if (entityType && !entityType.get('allow_custom_entities') && !entityType.get('has_entities')) {
				// check allow = false has entiy false
				if (!allowedKeys.includes(currentFieldName))
					requestBody.meta[currentFieldName] = requestBody[currentFieldName]
			}
		}
		if (Object.keys(requestBody.meta).length === 0) requestBody.meta = null
		if (Object.keys(requestBody.custom_entity_text).length === 0) requestBody.custom_entity_text = null
		return requestBody
	} catch (error) {
		console.error(error)
	}
}

function processDbResponse(responseBody, entityType) {
	// Check if the response body has a "meta" property
	if (responseBody.meta) {
		entityType.forEach((entity) => {
			const entityTypeValue = entity.value
			if (responseBody?.meta?.hasOwnProperty(entityTypeValue)) {
				// Move the key from responseBody.meta to responseBody root level
				responseBody[entityTypeValue] = responseBody.meta[entityTypeValue]
				// Delete the key from responseBody.meta
				delete responseBody.meta[entityTypeValue]
			}
		})
	}

	const output = { ...responseBody } // Create a copy of the responseBody object
	// Iterate through each key in the output object
	for (const key in output) {
		// Check if the key corresponds to an entity type and is not null
		if (entityType.some((entity) => entity.value === key) && output[key] !== null) {
			// Find the matching entity type for the current key
			const matchingEntity = entityType.find((entity) => entity.value === key)
			// Filter and map the matching entity values
			const matchingValues = matchingEntity.entities
				.filter((entity) => (Array.isArray(output[key]) ? output[key].includes(entity.value) : true))
				.map((entity) => ({
					value: entity.value,
					label: entity.label,
				}))
			// Check if there are matching values
			if (matchingValues.length > 0)
				output[key] = Array.isArray(output[key])
					? matchingValues
					: matchingValues.find((entity) => entity.value === output[key])
			else if (Array.isArray(output[key])) output[key] = output[key].filter((item) => item.value && item.label)
		}

		if (output.meta && output.meta[key] && entityType.some((entity) => entity.value === output.meta[key].value)) {
			const matchingEntity = entityType.find((entity) => entity.value === output.meta[key].value)
			output.meta[key] = {
				value: matchingEntity.value,
				label: matchingEntity.label,
			}
		}
	}

	const data = output

	// Merge "custom_entity_text" into the respective arrays
	for (const key in data.custom_entity_text) {
		if (Array.isArray(data[key])) data[key] = [...data[key], ...data.custom_entity_text[key]]
		else data[key] = data.custom_entity_text[key]
	}
	delete data.custom_entity_text

	// Check if the response body has a "meta" property
	if (data.meta && Object.keys(data.meta).length > 0) {
		// Merge properties of data.meta into the top level of data
		Object.assign(data, data.meta)
		// Remove the "meta" property from the output
		delete output.meta
	}

	return data
}

function removeParentEntityTypes(data) {
	const parentIds = data.filter((item) => item.parent_id !== null).map((item) => item.parent_id)
	return data.filter((item) => !parentIds.includes(item.id))
}
const epochFormat = (date, format) => {
	return moment.unix(date).utc().format(format)
}
function processQueryParametersWithExclusions(query) {
	const queryArrays = {}
	const excludedKeys = common.excludedQueryParams
	for (const queryParam in query) {
		if (query.hasOwnProperty(queryParam) && !excludedKeys.includes(queryParam)) {
			queryArrays[queryParam] = query[queryParam].split(',').map((item) => item.trim())
		}
	}

	return queryArrays
}

/**
 * Calculate the time difference in milliseconds between a current date
 * and a modified date obtained by subtracting a specified time value and unit from startDate.
 *
 * @param {string} startDate - The start date.
 * @param {number} timeValue - The amount of time to subtract.
 * @param {string} timeUnit - The unit of time to subtract (e.g., 'hours', 'days').
 * @returns {number} The time difference in milliseconds.
 */
function getTimeDifferenceInMilliseconds(startDate, timeValue, timeUnit) {
	// Get current date
	const currentUnixTimestamp = moment().unix()

	// Subtract the specified time value and unit
	const modifiedDate = moment.unix(startDate).subtract(timeValue, timeUnit).unix()

	// Calculate the duration and get the time difference in milliseconds
	const duration = moment.duration(moment.unix(modifiedDate).diff(moment.unix(currentUnixTimestamp)))

	return duration.asMilliseconds()
}

function deleteProperties(obj, propertiesToDelete) {
	try {
		return Object.keys(obj).reduce((result, key) => {
			if (!propertiesToDelete.includes(key)) {
				result[key] = obj[key]
			}
			return result
		}, {})
	} catch (error) {
		return obj
	}
}
/**
 * Generate security checksum.
 * @method
 * @name generateCheckSum
 * @param {String} queryHash - Query hash.
 * @returns {Number} - checksum key.
 */

function generateCheckSum(queryHash) {
	var shasum = crypto.createHash('sha1')
	shasum.update(queryHash)
	const checksum = shasum.digest('hex')
	return checksum
}
/**
 * validateRoleAccess.
 * @method
 * @name validateRoleAccess
 * @param {Array} roles - roles array.
 * @param {String} requiredRole - role to check.
 * @returns {Number} - checksum key.
 */

const validateRoleAccess = (roles, requiredRoles) => {
	if (!roles || roles.length === 0) return false

	if (!Array.isArray(requiredRoles)) {
		requiredRoles = [requiredRoles]
	}

	// Check the type of the first element.
	const firstElementType = typeof roles[0]
	if (firstElementType === 'object') {
		return roles.some((role) => requiredRoles.includes(role.title))
	} else {
		return roles.some((role) => requiredRoles.includes(role))
	}
}

const removeDefaultOrgEntityTypes = (entityTypes, orgId) => {
	const entityTypeMap = new Map()
	entityTypes.forEach((entityType) => {
		if (!entityTypeMap.has(entityType.value)) entityTypeMap.set(entityType.value, entityType)
		else if (entityType.organization_id === orgId) entityTypeMap.set(entityType.value, entityType)
	})
	return Array.from(entityTypeMap.values())
}
const generateWhereClause = (tableName) => {
	let whereClause = ''

	switch (tableName) {
		case 'sessions':
			const currentEpochDate = Math.floor(new Date().getTime() / 1000) // Get current date in epoch format
			whereClause = `deleted_at IS NULL AND start_date >= ${currentEpochDate}`
			break
		case 'mentor_extensions':
			whereClause = `deleted_at IS NULL`
			break
		case 'user_extensions':
			whereClause = `deleted_at IS NULL`
			break
		default:
			whereClause = 'deleted_at IS NULL'
	}

	return whereClause
}

/**
 * Validates the input against validation data and builds a SQL query filter.
 *
 * @param {Object} input - The input object containing filters.
 * @param {Array} validationData - Array of objects containing entity type and data type information.
 * @returns {Object} An object containing the SQL query string and replacements for Sequelize.
 */
function validateAndBuildFilters(input, validationData) {
	const entityTypes = {}

	// Build the entityTypes dictionary
	validationData.forEach((entityType) => {
		entityTypes[entityType.value] = entityType.data_type
	})

	const queryParts = [] // Array to store parts of the query
	const replacements = {} // Object to store replacements for Sequelize

	// Function to handle string types
	function handleStringType(key, values) {
		const orConditions = values
			.map((value, index) => {
				replacements[`${key}_${index}`] = value
				return `${key} = :${key}_${index}`
			})
			.join(' OR ')
		queryParts.push(`(${orConditions})`)
	}

	// Function to handle array types
	function handleArrayType(key, values) {
		const arrayValues = values
			.map((value, index) => {
				replacements[`${key}_${index}`] = value
				return `:${key}_${index}`
			})
			.join(', ')
		queryParts.push(`"${key}" @> ARRAY[${arrayValues}]::character varying[]`)
	}

	// Iterate over each key in the input object
	for (const key in input) {
		if (input.hasOwnProperty(key)) {
			const dataType = entityTypes[key]

			if (dataType) {
				if (common.ENTITY_TYPE_DATA_TYPES.STRING_TYPES.includes(dataType)) {
					handleStringType(key, input[key])
				} else if (common.ENTITY_TYPE_DATA_TYPES.ARRAY_TYPES.includes(dataType)) {
					handleArrayType(key, input[key])
				}
			} else {
				// Remove keys that are not in the validationData
				delete input[key]
			}
		}
	}

	// Join all query parts with AND
	const query = queryParts.join(' AND ')

	return { query, replacements }
}

function validateFilters(input, validationData, modelName) {
	const entityTypes = []
	validationData.forEach((entityType) => {
		// Extract the 'value' property from the main object
		entityTypes.push(entityType.value)

		// Extract the 'value' property from the 'entities' array
	})

	for (const key in input) {
		if (input.hasOwnProperty(key)) {
			if (entityTypes.includes(key)) {
				continue
			} else {
				delete input[key]
			}
		}
	}
	return input
}

function extractFilename(fileString) {
	const match = fileString.match(/([^/]+)(?=\.\w+$)/)
	return match ? match[0] : null
}

const generateRedisConfigForQueue = () => {
	const parseURL = new URL(process.env.REDIS_HOST)
	return {
		connection: {
			host: parseURL.hostname,
			port: parseURL.port,
		},
	}
}

const generateFileName = (name, extension) => {
	const currentDate = new Date()
	const fileExtensionWithTime = moment(currentDate).tz('Asia/Kolkata').format('YYYY_MM_DD_HH_mm') + extension
	return name + fileExtensionWithTime
}

function generateCSVContent(data) {
	if (data.length === 0) {
		return 'No Data Found'
	}

	const headers = Object.keys(data[0])

	const csvRows = data.map((row) => {
		return headers
			.map((fieldName) => {
				const value = row[fieldName]
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					// Stringify object values and enclose them in double quotes
					return '"' + JSON.stringify(value) + '"'
				} else if (Array.isArray(value)) {
					// Join array values with comma and space, and enclose them in double quotes
					return '"' + value.join(', ') + '"'
				} else {
					return JSON.stringify(value)
				}
			})
			.join(',')
	})
	return [headers.join(','), ...csvRows].join('\n')
}

const clearFile = (filePath) => {
	fs.unlink(filePath, (err) => {
		if (err) logger.error(err)
	})
}
function convertKeysToSnakeCase(obj) {
	if (Array.isArray(obj)) {
		return obj.map(convertKeysToSnakeCase)
	} else if (typeof obj === 'object' && obj !== null) {
		return Object.fromEntries(
			Object.entries(obj).map(([key, value]) => [_.snakeCase(key), convertKeysToSnakeCase(value)])
		)
	}
	return obj
}

function isValidEmail(email) {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

function transformCustomFields(customFields) {
	const customEntities = {}

	for (const [key, value] of Object.entries(customFields)) {
		customEntities[key] = value
			? value
					.replace(/"/g, '')
					.split(',')
					.map((item) => item.trim())
			: []
	}

	return customEntities
}

function validateProfileData(profileData, validationData) {
	const profileMandatoryFields = []
	for (const field of validationData) {
		if (profileData.hasOwnProperty(field.value)) {
			if (field.required === true && profileData[field.value] === null) {
				profileMandatoryFields.push(field.value)
			}
		} else {
			if (field.required === true) {
				profileMandatoryFields.push(field.value)
			}
		}
	}
	return profileMandatoryFields
}

function convertExpiryTimeToSeconds(expiryTime) {
	expiryTime = String(expiryTime)
	const match = expiryTime.match(/^(\d+)([m]?)$/)
	if (match) {
		const value = parseInt(match[1], 10) // Numeric value
		const unit = match[2]
		if (unit === 'm') {
			return Math.floor(value / 60)
		} else {
			return value
		}
	}
}

function convertEntitiesForFilter(entityTypes) {
	const result = {}

	entityTypes.forEach((entityType) => {
		const key = entityType.value

		if (!result[key]) {
			result[key] = []
		}

		const newObj = {
			id: entityType.id,
			label: entityType.label,
			value: entityType.value,
			parent_id: entityType.parent_id,
			organization_id: entityType.organization_id,
			entities: entityType.entities || [],
		}

		result[key].push(newObj)
	})
	return result
}

function filterEntitiesBasedOnParent(data, defaultOrgId, doNotRemoveDefaultOrg) {
	let result = {}

	for (let key in data) {
		let countWithParentId = 0
		let countOfEachKey = data[key].length
		data[key].forEach((obj) => {
			if (obj.parent_id !== null && obj.organization_id != defaultOrgId) {
				countWithParentId++
			}
		})

		let outputArray = data[key]
		if (countOfEachKey > 1 && countWithParentId == countOfEachKey - 1 && !doNotRemoveDefaultOrg) {
			outputArray = data[key].filter((obj) => !(obj.organization_id === defaultOrgId && obj.parent_id === null))
		}

		result[key] = outputArray
	}
	return result
}

function convertToTitleCase(str) {
	return str.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function removeLimitAndOffset(sql) {
	return sql.replace(/\s*LIMIT\s+\S+\s+OFFSET\s+\S+/, '')
}

function calculateStartOfWeek(startDate) {
	const dayOfWeek = startDate.getDay()
	const startOfWeek = new Date(startDate * 1000) // Convert epoch seconds to milliseconds for Date object
	startOfWeek.setDate(startDate.getDate() - dayOfWeek)
	startOfWeek.setHours(0, 0, 1, 0) // Set time to 00:00:01
	return startOfWeek
}

function calculateEndOfWeek(startOfWeek) {
	const endOfWeek = new Date(startOfWeek)
	endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday
	endOfWeek.setHours(23, 59, 59, 999) // Set time to 23:59:59
	return endOfWeek
}

function calculateStartOfMonth(startDate) {
	const startOfMonth = new Date(startDate * 1000) // Convert epoch seconds to milliseconds for Date object
	startOfMonth.setFullYear(startDate.getFullYear(), startDate.getMonth(), 1) // First day of the month
	startOfMonth.setHours(0, 0, 1, 0) // Set time to 00:00:01
	return startOfMonth
}

function calculateEndOfMonth(startOfMonth) {
	const endOfMonth = new Date(startOfMonth)
	endOfMonth.setMonth(startOfMonth.getMonth() + 1)
	endOfMonth.setDate(0) // Last day of the current month
	endOfMonth.setHours(23, 59, 59, 999) // Set time to 23:59:59
	return endOfMonth
}

function calculateStartOfDay(startDate) {
	const startOfDay = new Date(startDate * 1000) // Convert epoch seconds to milliseconds for Date object
	startOfDay.setHours(0, 0, 1, 0) // Set time to 00:00:01
	return startOfDay
}

function calculateEndOfDay(startOfDay) {
	const endOfDay = new Date(startOfDay)
	endOfDay.setHours(23, 59, 59, 999) // Set time to 23:59:59
	return endOfDay
}

function getEpochDates(startDateEpoch, option) {
	const startDate = new Date(startDateEpoch * 1000) // Convert epoch seconds to Date object

	let fromDateEpoch, toDateEpoch

	switch (option) {
		case 'week':
			const startOfWeek = calculateStartOfWeek(startDate)
			const endOfWeek = calculateEndOfWeek(startOfWeek)
			fromDateEpoch = Math.floor(startOfWeek.getTime() / 1000) // Convert to seconds
			toDateEpoch = Math.floor(endOfWeek.getTime() / 1000) // Convert to seconds
			break

		case 'month':
			const startOfMonth = calculateStartOfMonth(startDate)
			const endOfMonth = calculateEndOfMonth(startOfMonth)
			fromDateEpoch = Math.floor(startOfMonth.getTime() / 1000) // Convert to seconds
			toDateEpoch = Math.floor(endOfMonth.getTime() / 1000) // Convert to seconds
			break

		case 'day':
			const startOfDay = calculateStartOfDay(startDate)
			const endOfDay = calculateEndOfDay(startOfDay)
			fromDateEpoch = Math.floor(startOfDay.getTime() / 1000) // Convert to seconds
			toDateEpoch = Math.floor(endOfDay.getTime() / 1000) // Convert to seconds
			break
	}

	return {
		start_date: fromDateEpoch,
		end_date: toDateEpoch,
	}
}

function getAllEpochDates(startDateEpoch, endDateEpoch, option) {
	const dateArray = []
	let currentStartDate = startDateEpoch

	// Loop until we reach the end date
	while (currentStartDate <= endDateEpoch) {
		const { start_date, end_date } = getEpochDates(currentStartDate, option)
		dateArray.push({ start_date, end_date })

		// Move the currentStartDate to the next interval (week, month, or day)
		currentStartDate = end_date + 1 // Increment by 1 second to move to next interval
	}

	return dateArray
}

const generateFilters = (data, entityTypeKeys, DefaultValueKeys, ColumnConfig) => {
	const filters = {}

	const entityTypeKeySet = entityTypeKeys
		? new Set(entityTypeKeys.split(',')) // Convert entityTypeKeys to a Set if provided
		: null // Set to null if not provided

	const defaultValueKeySet = DefaultValueKeys
		? new Set(DefaultValueKeys.split(',')) // Convert DefaultValueKeys to a Set if provided
		: null // Set to null if not provided

	// Loop through keys in the first item of data
	for (const key in data[0]) {
		if (!entityTypeKeySet || !entityTypeKeySet.has(key)) {
			if (defaultValueKeySet && defaultValueKeySet.has(key)) {
				const columnConfig = ColumnConfig.find((col) => col.key === key)
				if (columnConfig && columnConfig.defaultValues) {
					filters[key] = columnConfig.defaultValues.map((value) => ({
						value: value, // Use value from defaultValues
						label: ['<=', '>='].includes(columnConfig.filterType)
							? `${columnConfig.filterType} ${value}` // Add filterType to label if it's '<=' or '>='
							: value, // Otherwise, just use the value
					}))
				} else {
					// If no defaultValues found, use unique values from data
					const uniqueValues = [...new Set(data.map((item) => item[key]))]
					filters[key] = uniqueValues.map((value) => ({
						value: value,
						label: value,
					}))
				}
			} else {
				// If not in DefaultValueKeys, use unique values from data
				const uniqueValues = [...new Set(data.map((item) => item[key]))]
				filters[key] = uniqueValues.map((value) => ({
					value: value,
					label: value,
				}))
			}
		}
	}

	return filters
}

const mapEntityTypesToData = (data, entityTypes) => {
	return data.map((item) => {
		const newItem = { ...item }
		entityTypes.forEach((entityType) => {
			const key = entityType.value
			if (newItem[key]) {
				const values = newItem[key].split(',').map((val) => val.trim())
				const mappedValues = values
					.map((value) => {
						const entity = entityType.entities.find((e) => e.value === value)
						return entity ? entity.label : value
					})
					.join(', ')

				newItem[key] = mappedValues
			}
		})
		return newItem
	})
}

function extractColumnMappings(sqlQuery) {
	// Match the SELECT part of the query
	const selectMatch = sqlQuery.match(/SELECT\s+(.*?)\s+FROM /is)
	if (!selectMatch) return {} // Return an empty object if no match is found

	const selectPart = selectMatch[1]

	// Split columns by commas, but ignore commas inside parentheses (to avoid splitting function calls)
	const columns = selectPart.split(/,(?![^\(\)]*\))/).map((col) => col.trim())

	const columnMappings = {}

	columns.forEach((column) => {
		// Match alias expressions like 'TO_TIMESTAMP(s.start_date)::DATE AS "date_of_session"'
		const aliasMatch = column.match(/(.*?)\s+AS\s+"(.*?)"/i)

		if (aliasMatch) {
			const original = aliasMatch[1].trim()
			const alias = aliasMatch[2].trim()

			// If the original expression contains complex SQL like CASE, ROUND, or EXTRACT, preserve the format
			if (
				original.includes('\n') ||
				original.includes('CASE') ||
				original.includes('ROUND') ||
				original.includes('EXTRACT')
			) {
				columnMappings[alias] = `\n    ${original.replace(/\n/g, '\n    ')}\n`
			} else {
				columnMappings[alias] = original
			}
		} else {
			// Handle case where there is no alias (if any)
			let cleanColumn = column.trim()

			// Remove 'subquery.' and quotes around column names using a regex
			cleanColumn = cleanColumn.replace(/^subquery\."(.*?)"$/, '$1') // Remove 'subquery.' and quotes

			// Save the cleaned column
			columnMappings[cleanColumn] = column.trim()
		}
	})

	// Clean up spaces and trim extra spaces from column mappings
	Object.keys(columnMappings).forEach((key) => {
		columnMappings[key] = columnMappings[key].replace(/\s+/g, ' ').trim()
	})

	return columnMappings
}

function getDynamicFilterCondition(filters, columnMappings, baseQuery, columnConfig) {
	if (!filters || typeof filters !== 'object') {
		console.log('Filters is not an object or is empty')
		return '' // Early exit if filters are not valid
	}
	if (filters.session_type && filters.session_type.includes('ALL')) {
		filters.session_type = ['PUBLIC', 'PRIVATE']
	}
	const conditions = Object.entries(filters)
		.map(([column, value]) => {
			const mappedColumn = columnMappings[column]
			if (!mappedColumn) {
				console.log(`No mapping found for column: ${column}`)
				return null // Skip if no mapping is found for the column
			}

			// Find the filterType for the column from columnConfig
			const columnConfigEntry = columnConfig.find((config) => config.key === column)
			const filterType = columnConfigEntry ? columnConfigEntry.filterType || '=' : '=' // Default to '=' if not found

			// Special case: Handle the column with ROUND(EXTRACT...) logic
			if (mappedColumn.includes('ROUND(EXTRACT')) {
				if (typeof value !== 'string') {
					console.error(
						`Invalid filter value for column ${column}. Expected a string but received ${typeof value}.`
					)
					return null
				}
				return `${mappedColumn} ${filterType} '${value}'`
			}

			if (value) {
				if (Array.isArray(value)) {
					// If value is an array, combine with OR for multiple values
					const arrayConditions = value
						.map((val) => {
							if (val instanceof Date) {
								// Handle Date objects
								return `${mappedColumn} ${filterType} TO_TIMESTAMP('${val.toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS')`
							} else if (typeof val === 'string' && isStrictValidDate(val)) {
								// Handle string-based date values
								return `${mappedColumn} ${filterType} TO_TIMESTAMP('${val}', 'YYYY-MM-DD')`
							} else if (typeof val === 'number') {
								// Handle numeric values
								return `${mappedColumn} ${filterType} ${val}`
							}
							// Handle general string values
							return `${mappedColumn} ${filterType} '${val}'`
						})
						.join(' OR ') // Join array conditions with OR
					return `(${arrayConditions})`
				} else if (value instanceof Date) {
					// Handle single Date object
					return `${mappedColumn} ${filterType} TO_TIMESTAMP('${value.toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS')`
				} else if (typeof value === 'string' && isStrictValidDate(value)) {
					// Handle single string-based date values
					return `${mappedColumn} ${filterType} TO_TIMESTAMP('${value}', 'YYYY-MM-DD')`
				} else if (typeof value === 'number') {
					// Handle single numeric values
					return `${mappedColumn} ${filterType} ${value}`
				}
				// Handle other value types as strings
				return `${mappedColumn} ${filterType} '${value}'`
			}

			return null // Return null if no valid value exists for the filter
		})
		.filter(Boolean) // Remove null entries (where no condition was generated)

	const conditionsString = conditions.join('\nAND ') // Join all conditions with AND

	// Check if baseQuery already has WHERE conditions
	const hasWhereClause = baseQuery.includes('WHERE')
	const hasGroupBy = baseQuery.includes('GROUP BY')

	// Append conditions to the query
	if (conditionsString) {
		if (hasGroupBy) {
			// Append before GROUP BY clause if it exists
			return `${hasWhereClause ? 'AND' : 'WHERE'} ${conditionsString}`
		} else {
			// Standard WHERE clause logic
			return `${hasWhereClause ? 'AND' : 'WHERE'} ${conditionsString}`
		}
	}

	// Return an empty string if no conditions were generated
	return ''
}

// Utility function to check strict date validity
function isStrictValidDate(dateString) {
	// Match dates in 'YYYY-MM-DD' format
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/
	return dateRegex.test(dateString) && !isNaN(new Date(dateString).getTime())
}

function getDynamicSearchCondition(search, columnMappings, baseQuery) {
	if (!search || typeof search !== 'object') {
		console.log('Search is not an object or is empty')
		return '' // Early exit if search is not valid
	}

	if (search.session_type && search.session_type.includes('ALL')) {
		search.session_type = ['PUBLIC', 'PRIVATE']
	}

	const conditions = Object.entries(search)
		.map(([column, value]) => {
			const mappedColumn = columnMappings[column]
			if (!mappedColumn) {
				console.log(`No mapping found for column: ${column}`)
				return null // Skip if no mapping is found for the column
			}

			if (value) {
				if (Array.isArray(value)) {
					// If value is an array, combine with OR for multiple values
					const arrayConditions = value
						.map((val) => {
							if (mappedColumn === 's.seats_limit-s.seats_remaining') {
								// Ensure both seats_limit and seats_remaining are treated as integers and subtract
								return `((s.seats_limit - s.seats_remaining)::TEXT ILIKE '%${val}%')`
							} else if (val instanceof Date) {
								return `${mappedColumn} = TO_TIMESTAMP('${val.toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS')`
							} else if (typeof val === 'string' && isStrictValidDate(val)) {
								return `${mappedColumn} = TO_TIMESTAMP('${val}', 'YYYY-MM-DD')`
							} else if (typeof val === 'string') {
								return `${mappedColumn}::TEXT ILIKE '%${val}%'` // Partial text match
							} else {
								return `${mappedColumn} = '${val}'` // Exact match for other types
							}
						})
						.join(' OR ')
					return `(${arrayConditions})`
				} else {
					// If it's a single value, handle accordingly
					if (mappedColumn === 's.seats_limit-s.seats_remaining') {
						return `((s.seats_limit - s.seats_remaining)::TEXT ILIKE '%${value}%')`
					} else if (value instanceof Date) {
						return `${mappedColumn} = TO_TIMESTAMP('${value.toISOString()}', 'YYYY-MM-DD"T"HH24:MI:SS')`
					} else if (typeof value === 'string' && isStrictValidDate(value)) {
						return `${mappedColumn} = TO_TIMESTAMP('${value}', 'YYYY-MM-DD')`
					} else if (typeof value === 'string') {
						return `${mappedColumn}::TEXT ILIKE '%${value}%'` // Partial text match
					} else {
						return `${mappedColumn} = '${value}'` // Exact match for other types
					}
				}
			}

			return null // Return null if no valid value exists for the search
		})
		.filter(Boolean) // Remove null entries

	const conditionsString = conditions.join('\nAND ') // Join all conditions with AND

	// Check if baseQuery already has WHERE conditions
	const hasWhereClause = baseQuery.includes('WHERE')
	const hasGroupBy = baseQuery.includes('GROUP BY')

	// Append conditions to the query
	if (conditionsString) {
		if (hasGroupBy === false) {
			return `${hasWhereClause ? 'AND' : 'WHERE'} ${conditionsString}`
		} else {
			return `${hasWhereClause ? 'WHERE' : 'AND'} ${conditionsString}`
		}
	}

	// Return an empty string if no conditions were generated
	return ''
}

function extractFiltersAndEntityType(data) {
	let filters = []
	let entityType = []
	let defaultValues = []

	data.forEach((item) => {
		if (item.filter) {
			if (item.isEntityType) {
				// Add to entityType if filter is true and isEntityType is true
				entityType.push(item.key)
			} else if (item.defaultValues && Array.isArray(item.defaultValues)) {
				// Check if defaultValues is present and an array
				defaultValues.push(item.key)
			} else {
				// Add to filters if filter is true and not an entityType
				filters.push(item.key)
			}
		}
	})

	// Join arrays into comma-separated strings
	filters = filters.join(',')
	entityType = entityType.join(',')
	defaultValues = defaultValues.join(',')

	return { filters, entityType, defaultValues }
}

module.exports = {
	hash: hash,
	getCurrentMonthRange,
	getCurrentWeekRange,
	getCurrentQuarterRange,
	elapsedMinutes,
	getIstDate,
	composeEmailBody,
	getDownloadableUrl,
	getPublicDownloadableUrl,
	getTimeZone,
	utcFormat,
	md5Hash,
	internalSet,
	internalDel,
	internalGet,
	redisSet,
	redisGet,
	redisDel,
	extractEmailTemplate,
	capitalize,
	isAMentor,
	isNumeric,
	epochFormat,
	processDbResponse,
	restructureBody,
	validateInput,
	removeParentEntityTypes,
	getTimeDifferenceInMilliseconds,
	deleteProperties,
	generateCheckSum,
	validateRoleAccess,
	removeDefaultOrgEntityTypes,
	generateWhereClause,
	validateFilters,
	processQueryParametersWithExclusions,
	extractFilename,
	generateRedisConfigForQueue,
	generateFileName,
	generateCSVContent,
	clearFile,
	convertKeysToSnakeCase,
	isValidEmail,
	transformCustomFields,
	validateProfileData,
	validateAndBuildFilters,
	convertExpiryTimeToSeconds,
	convertEntitiesForFilter,
	filterEntitiesBasedOnParent,
	convertToTitleCase,
	removeLimitAndOffset,
	getAllEpochDates,
	generateFilters,
	mapEntityTypesToData,
	extractColumnMappings,
	getDynamicFilterCondition,
	getDynamicSearchCondition,
	extractFiltersAndEntityType,
}

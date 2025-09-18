'use strict'
const entityTypeQueries = require('@database/queries/entityType')
const { sequelize } = require('@database/models/index')
const models = require('@database/models/index')
const { Op } = require('sequelize')
const utils = require('@generics/utils')
const common = require('@constants/common')
const searchConfig = require('@configs/search.json')
const indexQueries = require('@generics/mViewsIndexQueries')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const userExtensionQueries = require('@database/queries/userExtension')

let refreshInterval

const groupByModelNames = async (entityTypes) => {
	const groupedData = new Map()
	entityTypes.forEach((item) => {
		item.model_names.forEach((modelName) => {
			if (groupedData.has(modelName)) {
				groupedData.get(modelName).entityTypes.push(item)
				groupedData.get(modelName).entityTypeValueList.push(item.value)
			} else
				groupedData.set(modelName, {
					modelName: modelName,
					entityTypes: [item],
					entityTypeValueList: [item.value],
				})
		})
	})

	return [...groupedData.values()]
}

const filterConcreteAndMetaAttributes = async (modelAttributes, attributesList) => {
	try {
		const concreteAttributes = []
		const metaAttributes = []
		attributesList.forEach((attribute) => {
			if (modelAttributes.includes(attribute)) concreteAttributes.push(attribute)
			else metaAttributes.push(attribute)
		})
		return { concreteAttributes, metaAttributes }
	} catch (err) {}
}

const rawAttributesTypeModifier = async (rawAttributes) => {
	try {
		const outputArray = []
		for (const key in rawAttributes) {
			const columnInfo = rawAttributes[key]
			const type = columnInfo.type.key
			const subField = columnInfo.type.options?.type?.key
			const typeMap = {
				ARRAY: {
					JSON: 'json[]',
					STRING: 'character varying[]',
					INTEGER: 'integer[]',
				},
				INTEGER: 'integer',
				DATE: 'timestamp with time zone',
				BOOLEAN: 'boolean',
				JSONB: 'jsonb',
				JSON: 'json',
				STRING: 'character varying',
				BIGINT: 'bigint',
				TEXT: 'text',
			}
			const conversion = typeMap[type]
			if (conversion) {
				if (type === 'DATE' && (key === 'createdAt' || key === 'updatedAt')) {
					continue
				}
				outputArray.push({
					key: key,
					type: subField ? typeMap[type][subField] : conversion,
				})
			}
		}
		return outputArray
	} catch (err) {}
}
const metaAttributesTypeModifier = (data) => {
	try {
		const typeMap = {
			'ARRAY[STRING]': 'character varying[]',
			'ARRAY[INTEGER]': 'integer[]',
			'ARRAY[TEXT]': 'text[]',
			INTEGER: 'integer',
			DATE: 'timestamp with time zone',
			BOOLEAN: 'boolean',
			JSONB: 'jsonb',
			JSON: 'json',
			STRING: 'character varying',
			BIGINT: 'bigint',
			TEXT: 'text',
		}

		const outputArray = data.map((field) => {
			const { data_type, model_names, ...rest } = field
			const convertedDataType = typeMap[data_type]

			return convertedDataType
				? {
						...rest,
						data_type: convertedDataType,
						model_names: Array.isArray(model_names)
							? model_names.map((modelName) => `'${modelName}'`).join(', ')
							: model_names,
				  }
				: field
		})

		return outputArray
	} catch (err) {}
}

const generateRandomCode = (length) => {
	const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let result = ''
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * charset.length)
		result += charset[randomIndex]
	}
	return result
}

const materializedViewQueryBuilder = async (model, concreteFields, metaFields, tenantCode) => {
	try {
		const tableName = model.tableName
		const temporaryMaterializedViewName = `${common.getTenantViewName(tenantCode, tableName)}_${generateRandomCode(
			8
		)}`
		const concreteFieldsQuery = await concreteFields
			.map((data) => {
				return `${data.key}::${data.type} as ${data.key}`
			})
			.join(',\n')
		const metaFieldsQuery =
			metaFields.length > 0
				? await metaFields
						.map((data) => {
							if (data.data_type == 'character varying[]') {
								return `transform_jsonb_to_text_array(meta->'${data.value}')::${data.data_type} as ${data.value}`
							} else {
								return `(meta->>'${data.value}')::${data.data_type} as ${data.value}`
							}
						})
						.join(',\n')
				: '' // Empty string if there are no meta fields

		const whereClause = utils.generateWhereClause(tableName)
		// Add tenant-specific filtering to the WHERE clause
		const tenantWhereClause = `${whereClause} AND tenant_code = '${tenantCode}'`

		const materializedViewGenerationQuery = `CREATE MATERIALIZED VIEW ${temporaryMaterializedViewName} AS
		  SELECT 
			  ${concreteFieldsQuery}${metaFieldsQuery && `,`}${metaFieldsQuery}
		  FROM public."${tableName}"
		  WHERE ${tenantWhereClause};`

		return { materializedViewGenerationQuery, temporaryMaterializedViewName }
	} catch (err) {}
}

const createIndexesOnAllowFilteringFields = async (model, modelEntityTypes, fieldsWithDatatype, tenantCode) => {
	try {
		const uniqueEntityTypeValueList = [...new Set(modelEntityTypes.entityTypeValueList)]
		const viewName = common.getTenantViewName(tenantCode, model.tableName)

		await Promise.all(
			uniqueEntityTypeValueList.map(async (attribute) => {
				const item = fieldsWithDatatype.find(
					(element) => element.key === attribute || element.value === attribute
				)

				// Retrieve the type
				const type = item ? item.type || item.data_type : undefined

				if (!type) return false
				// Determine the query based on the type
				let query
				if (type === 'character varying' || type === 'character text') {
					query = `CREATE INDEX ${tenantCode}_idx_${model.tableName}_${attribute} ON ${viewName} USING gin (${attribute} gin_trgm_ops);`
				} else {
					query = `CREATE INDEX ${tenantCode}_idx_${model.tableName}_${attribute} ON ${viewName} USING gin (${attribute});`
				}

				return await sequelize.query(query)
			})
		)
	} catch (err) {}
}
const createViewGINIndexOnSearch = async (model, config, fields, tenantCode) => {
	try {
		const modelName = model.name
		const searchType = modelName === 'Session' ? 'session' : modelName === 'MentorExtension' ? 'mentor' : null

		if (!searchType) {
			return
		}

		const fieldsConfig = config.search[searchType].fields
		const fieldsForIndex = fieldsConfig.filter((field) => !field.isAnEntityType).map((field) => field.name)

		if (fieldsForIndex.length === 0) {
			return
		}

		const viewName = common.getTenantViewName(tenantCode, model.tableName)

		for (const field of fieldsForIndex) {
			try {
				await sequelize.query(`
                    CREATE INDEX ${tenantCode}_gin_index_${model.tableName}_${field}
                    ON ${viewName}
                    USING gin(${field} gin_trgm_ops);
                `)
			} catch (err) {}
		}
	} catch (err) {}
}
// Function to execute index queries for a specific model
const executeIndexQueries = async (modelName) => {
	// Find the index queries for the specified model
	const modelQueries = indexQueries.find((item) => item.modelName === modelName)

	if (modelQueries) {
		for (const query of modelQueries.queries) {
			try {
				await sequelize.query(query)
			} catch (error) {}
		}
	} else {
	}
}
const deleteMaterializedView = async (viewName) => {
	try {
		await sequelize.query(`DROP MATERIALIZED VIEW ${viewName};`)
	} catch (err) {}
}

const renameMaterializedView = async (temporaryMaterializedViewName, tableName, tenantCode) => {
	const t = await sequelize.transaction()
	try {
		const finalViewName = common.getTenantViewName(tenantCode, tableName)
		let randomViewName = `${finalViewName}_${generateRandomCode(8)}`

		const checkOriginalViewQuery = `SELECT COUNT(*) from pg_matviews where matviewname = '${finalViewName}';`
		const renameOriginalViewQuery = `ALTER MATERIALIZED VIEW ${finalViewName} RENAME TO ${randomViewName};`
		const renameNewViewQuery = `ALTER MATERIALIZED VIEW ${temporaryMaterializedViewName} RENAME TO ${finalViewName};`

		const temp = await sequelize.query(checkOriginalViewQuery)

		if (temp[0][0].count > 0) await sequelize.query(renameOriginalViewQuery, { transaction: t })
		else randomViewName = null
		await sequelize.query(renameNewViewQuery, { transaction: t })
		await t.commit()

		return randomViewName
	} catch (error) {
		await t.rollback()
	}
}

const createViewUniqueIndexOnPK = async (model, tenantCode) => {
	try {
		const primaryKeys = model.primaryKeyAttributes
		const viewName = common.getTenantViewName(tenantCode, model.tableName)

		const result = await sequelize.query(`
            CREATE UNIQUE INDEX ${tenantCode}_unique_index_${model.tableName}_${primaryKeys.map((key) => `_${key}`)} 
            ON ${viewName} (${primaryKeys.map((key) => `${key}`).join(', ')});`)
	} catch (err) {}
}

const generateMaterializedView = async (modelEntityTypes, tenantCode) => {
	try {
		const model = models[modelEntityTypes.modelName]

		const { concreteAttributes, metaAttributes } = await filterConcreteAndMetaAttributes(
			Object.keys(model.rawAttributes),
			modelEntityTypes.entityTypeValueList
		)

		const concreteFields = await rawAttributesTypeModifier(model.rawAttributes)

		const metaFields = await modelEntityTypes.entityTypes
			.map((entity) => {
				if (metaAttributes.includes(entity.value)) return entity
				else null
			})
			.filter(Boolean)

		const modifiedMetaFields = await metaAttributesTypeModifier(metaFields)

		const { materializedViewGenerationQuery, temporaryMaterializedViewName } = await materializedViewQueryBuilder(
			model,
			concreteFields,
			modifiedMetaFields,
			tenantCode
		)

		await sequelize.query(materializedViewGenerationQuery)
		const allFields = [...modifiedMetaFields, ...concreteFields]
		const randomViewName = await renameMaterializedView(temporaryMaterializedViewName, model.tableName, tenantCode)
		if (randomViewName) await deleteMaterializedView(randomViewName)
		await createIndexesOnAllowFilteringFields(model, modelEntityTypes, allFields, tenantCode)
		await createViewUniqueIndexOnPK(model, tenantCode)
		await createViewGINIndexOnSearch(model, searchConfig, allFields, tenantCode)
		await executeIndexQueries(model.name)
	} catch (err) {}
}

const getAllowFilteringEntityTypes = async (tenantCode) => {
	try {
		// Validate tenantCode parameter
		if (!tenantCode || tenantCode === 'undefined') {
			console.error('Invalid tenantCode provided:', tenantCode)
			return []
		}

		const defaults = await getDefaults()
		if (!defaults.orgCode) {
			return responses.failureResponse({
				message: 'DEFAULT_ORG_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
		if (!defaults.tenantCode) {
			return responses.failureResponse({
				message: 'DEFAULT_TENANT_CODE_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		// Use combination of given tenant + default tenant with default org code
		// Entity types with allow_filtering=true are global configurations from default org
		// but support tenant-specific customizations through tenant code combination
		const entities = await entityTypeQueries.findAllEntityTypes(
			defaults.orgCode, // Use default org code (global configurations)
			{ [Op.in]: [tenantCode, defaults.tenantCode] }, // Combination of tenant codes
			['id', 'value', 'label', 'data_type', 'organization_id', 'has_entities', 'model_names'],
			{
				allow_filtering: true,
			}
		)

		return entities
	} catch (err) {
		console.error('Error in getAllowFilteringEntityTypes:', err)
		return []
	}
}

const triggerViewBuild = async (tenantCode) => {
	try {
		const allowFilteringEntityTypes = await getAllowFilteringEntityTypes(tenantCode)
		const entityTypesGroupedByModel = await groupByModelNames(allowFilteringEntityTypes)

		await Promise.all(
			entityTypesGroupedByModel.map(async (modelEntityTypes) => {
				return generateMaterializedView(modelEntityTypes, tenantCode)
			})
		)

		return entityTypesGroupedByModel
	} catch (err) {}
}

//Refresh Flow

const modelNameCollector = async (entityTypes) => {
	try {
		const modelSet = new Set()
		await Promise.all(
			entityTypes.map(async ({ model_names }) => {
				if (model_names && Array.isArray(model_names))
					await Promise.all(
						model_names.map((model) => {
							if (!modelSet.has(model)) modelSet.add(model)
						})
					)
			})
		)
		return [...modelSet.values()]
	} catch (err) {}
}

const refreshMaterializedView = async (modelName, tenantCode) => {
	try {
		const model = models[modelName]
		const viewName = common.getTenantViewName(tenantCode, model.tableName)

		// Check if a REFRESH MATERIALIZED VIEW query is already running
		const [activeQueries] = await sequelize.query(`
		SELECT * FROM pg_stat_activity
		WHERE query LIKE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}%'
		  AND state = 'active';
	  `)

		// If there are active refresh queries, skip refreshing the materialized view
		if (activeQueries.length > 0) {
			return
		}

		// If no active refresh queries, proceed with refreshing the materialized view
		const [result, metadata] = await sequelize.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`)
		return { message: 'Materialized view refreshed successfully', result, metadata }
	} catch (err) {}
}

const refreshNextView = (currentIndex, modelNames, tenantCode) => {
	try {
		if (currentIndex < modelNames.length) {
			refreshMaterializedView(modelNames[currentIndex], tenantCode)
			currentIndex++
		} else {
			console.info('All views refreshed. Stopping further refreshes.')
			clearInterval(refreshInterval) // Stop the setInterval loop
		}
		return currentIndex
	} catch (err) {}
}

const triggerPeriodicViewRefresh = async (tenantCode) => {
	try {
		const allowFilteringEntityTypes = await getAllowFilteringEntityTypes(tenantCode)
		const modelNames = await modelNameCollector(allowFilteringEntityTypes)
		const interval = process.env.REFRESH_VIEW_INTERVAL
		let currentIndex = 0

		// Using the mockSetInterval function to simulate setInterval
		refreshInterval = setInterval(() => {
			currentIndex = refreshNextView(currentIndex, modelNames, tenantCode)
		}, interval / modelNames.length)

		// Immediately trigger the first refresh
		currentIndex = refreshNextView(currentIndex, modelNames, tenantCode)
	} catch (err) {}
}
const checkAndCreateMaterializedViews = async (tenantCode) => {
	const allowFilteringEntityTypes = await getAllowFilteringEntityTypes(tenantCode)
	const entityTypesGroupedByModel = await groupByModelNames(allowFilteringEntityTypes)

	await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;', {
		type: sequelize.QueryTypes.SELECT,
	})

	const query = 'select matviewname from pg_matviews;'
	const [result, metadata] = await sequelize.query(query)

	await Promise.all(
		entityTypesGroupedByModel.map(async (modelEntityTypes) => {
			const model = models[modelEntityTypes.modelName]
			const expectedViewName = common.getTenantViewName(tenantCode, model.tableName)

			const mViewExits = result.some(({ matviewname }) => matviewname === expectedViewName)
			if (!mViewExits) {
				return generateMaterializedView(modelEntityTypes, tenantCode)
			}
			return true
		})
	)

	return entityTypesGroupedByModel
}

const triggerViewBuildForAllTenants = async () => {
	try {
		const tenants = await userExtensionQueries.getDistinctTenantCodes()
		const results = []

		for (const tenant of tenants) {
			const tenantCode = tenant.code

			// Skip tenants with undefined or empty tenant codes
			if (!tenantCode || tenantCode === 'undefined') {
				console.log(`⚠️  Skipping tenant with invalid code:`, tenant)
				continue
			}

			console.log(`🔄 Building materialized views for tenant: ${tenantCode}`)
			const result = await triggerViewBuild(tenantCode)
			results.push({
				tenantCode,
				result: result || 'Success',
			})
		}

		return {
			success: true,
			message: `Built materialized views for ${results.length} tenants`,
			results,
		}
	} catch (err) {
		console.error('Error in triggerViewBuildForAllTenants:', err)
		return {
			success: false,
			message: 'Failed to build views for all tenants',
			error: err.message,
		}
	}
}

const triggerPeriodicViewRefreshForAllTenants = async () => {
	try {
		const tenants = await userExtensionQueries.getDistinctTenantCodes()
		const results = []

		for (const tenant of tenants) {
			const tenantCode = tenant.code

			// Skip tenants with undefined or empty tenant codes
			if (!tenantCode || tenantCode === 'undefined') {
				console.log(`⚠️  Skipping tenant with invalid code:`, tenant)
				continue
			}

			console.log(`🔄 Starting periodic refresh for tenant: ${tenantCode}`)
			const result = await triggerPeriodicViewRefresh(tenantCode)
			results.push({
				tenantCode,
				result: result || 'Success',
			})
		}

		return {
			success: true,
			message: `Started periodic refresh for ${results.length} tenants`,
			results,
		}
	} catch (err) {
		console.error('Error in triggerPeriodicViewRefreshForAllTenants:', err)
		return {
			success: false,
			message: 'Failed to start refresh for all tenants',
			error: err.message,
		}
	}
}

const adminService = {
	triggerViewBuild,
	triggerPeriodicViewRefresh,
	refreshMaterializedView,
	checkAndCreateMaterializedViews,
	triggerViewBuildForAllTenants,
	triggerPeriodicViewRefreshForAllTenants,
}

module.exports = adminService

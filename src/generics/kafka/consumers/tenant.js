'use strict'

const tenantQueries = require('@database/queries/tenants')
const tenantService = require('@services/tenant')
const materializedViewsService = require('@generics/materializedViews')

var messageReceived = function (message) {
	return new Promise(async function (resolve, reject) {
		try {
			const {
				entity,
				eventType,
				code,
				name,
				status,
				description,
				logo,
				meta,
				theming,
				created_by,
				updated_by,
				org_id,
				org_code,
			} = message

			if (entity !== 'tenant') {
				console.warn(`Non-tenant entity received in tenant consumer: ${entity}`)
				return resolve(`Skipped non-tenant entity: ${entity}`)
			}

			switch (eventType) {
				case 'create': {
					const tenantData = {
						code,
						name,
						status: status || 'ACTIVE',
						description: description || null,
						logo: logo || null,
						meta: meta || null,
						theming: theming || null,
						created_by: created_by ? created_by.toString() : null,
						updated_by: created_by ? created_by.toString() : null,
					}
					const { created } = await tenantQueries.upsert(tenantData)
					if (created) {
						await tenantService.replicateConfigFromDefaultTenant(code, org_id, org_code)

						// Build materialized views for the new tenant
						const entityTypesGroupedByModel = await materializedViewsService.triggerViewBuild(code)

						// Register periodic refresh jobs in scheduler service for the new tenant
						const baseInterval = process.env.REFRESH_VIEW_INTERVAL

						for (const { modelName } of entityTypesGroupedByModel) {
							const interval =
								(modelName === 'UserExtension' && process.env.USER_EXTENSION_REFRESH_VIEW_INTERVAL) ||
								(modelName === 'Session' && process.env.SESSION_REFRESH_VIEW_INTERVAL) ||
								baseInterval

							materializedViewsService.scheduleViewRefreshJob(code, modelName, interval)
						}
					}
					break
				}

				case 'update': {
					const { newValues = {} } = message
					if (!message.entityId) {
						console.warn(`[TENANT] Update event missing entityId, skipping`)
						return resolve(`Skipped update: missing entityId`)
					}

					const allowedFields = ['name', 'status', 'description', 'logo', 'meta', 'theming']
					const updateData = allowedFields.reduce((acc, field) => {
						if (newValues[field] !== undefined) acc[field] = newValues[field]
						return acc
					}, {})
					if (updated_by !== undefined) updateData.updated_by = updated_by ? updated_by.toString() : null

					if (Object.keys(updateData).length > 0) {
						await tenantQueries.update(message.entityId, updateData)
					}
					break
				}

				default:
					console.warn(`Unknown tenant event type: ${eventType}`)
					return resolve(`Unknown event type: ${eventType}`)
			}

			return resolve(`Tenant ${eventType} event processed for: ${code || message.entityId}`)
		} catch (error) {
			console.error(`Error processing tenant event: ${error.message}`, {
				eventType: message.eventType,
				entityId: message.entityId,
				error: error.stack,
			})
			return reject(error)
		}
	})
}

var errorTriggered = function (error) {
	return new Promise(function (resolve, reject) {
		try {
			console.error('Tenant Kafka consumer error:', error)
			return resolve('Tenant Error Processed')
		} catch (error) {
			return reject(error)
		}
	})
}

module.exports = {
	messageReceived: messageReceived,
	errorTriggered: errorTriggered,
}

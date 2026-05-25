// Dependencies
require('module-alias/register')
const request = require('request')
require('dotenv').config({ path: '../.env' })
const entityTypeQueries = require('../database/queries/entityType')
const userExtensionQueries = require('../database/queries/userExtension')

// Data
const schedulerServiceUrl = process.env.SCHEDULER_SERVICE_HOST // Port address on which the scheduler service is running
const mentoringBaseurl = `http://${process.env.APPLICATION_HOST}:${process.env.APPLICATION_PORT}`
const apiEndpoints = require('../constants/endpoints')
const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE
const defaultTenantCode = process.env.DEFAULT_TENANT_CODE

// Validate required environment variables
if (!schedulerServiceUrl) {
	console.error('❌ SCHEDULER_SERVICE_HOST environment variable is not set')
	process.exit(1)
}
if (!process.env.APPLICATION_HOST || !process.env.APPLICATION_PORT) {
	console.error('❌ APPLICATION_HOST or APPLICATION_PORT environment variable is not set')
	process.exit(1)
}
if (!process.env.INTERNAL_ACCESS_TOKEN) {
	console.error('❌ INTERNAL_ACCESS_TOKEN environment variable is not set')
	process.exit(1)
}
if (!process.env.SCHEDULER_SERVICE_BASE_URL) {
	console.error('❌ SCHEDULER_SERVICE_BASE_URL environment variable is not set')
	process.exit(1)
}

/**
 * Create a scheduler job.
 *
 * @param {string} jobId - The unique identifier for the job.
 * @param {number} interval - The delay in milliseconds before the job is executed.
 * @param {string} jobName - The name of the job.
 * @param {string} modelName - The template for the notification.
 */
const createSchedulerJob = function (jobId, interval, jobName, repeat, url, offset) {
	// URL already has tenant_code and model_name encoded in the path
	// Format: /mentoring/v1/admin/triggerPeriodicViewRefreshInternal/{tenantCode|modelName}
	// The scheduler will call this URL, and the path parameter will be preserved
	const bodyData = {
		jobName: jobName,
		email: [process.env.SCHEDULER_SERVICE_ERROR_REPORTING_EMAIL_ID],
		request: {
			url: url, // Use the full URL with path parameters
			method: 'get', // Scheduler converts to GET anyway, so use GET
			header: {
				internal_access_token: process.env.INTERNAL_ACCESS_TOKEN,
			},
		},
		jobOptions: {
			jobId: jobId,
			repeat: repeat
				? { every: Number(interval), offset }
				: { every: Number(interval), limit: 1, immediately: true }, // Add limit only if repeat is false
			removeOnComplete: 50,
			removeOnFail: 200,
		},
	}

	const options = {
		headers: {
			'Content-Type': 'application/json',
		},
		json: bodyData,
	}

	const apiUrl = schedulerServiceUrl + process.env.SCHEDULER_SERVICE_BASE_URL + apiEndpoints.CREATE_SCHEDULER_JOB

	if (!apiUrl || !apiUrl.includes('http')) {
		console.error(`❌ Invalid scheduler service URL: ${apiUrl}`)
		return
	}
	try {
		request.post(apiUrl, options, (err, data) => {
			if (err) {
				console.error(`❌ Error in createSchedulerJob POST request for ${jobName}:`, err.message || err)
				return
			}
			if (!data || !data.body) {
				console.error(`❌ Invalid response from scheduler service for ${jobName}`)
				return
			}
			if (data.body.success) {
				console.log(`✅ Scheduler job created successfully: ${jobName} (${jobId})`)
			} else {
				console.error(`❌ Error in createSchedulerJob response for ${jobName}:`, JSON.stringify(data.body))
			}
		})
	} catch (error) {
		console.error(`❌ Error in createSchedulerJob for ${jobName}:`, error.message || error)
	}
}

const getAllowFilteringEntityTypes = async () => {
	try {
		const entityTypes = await entityTypeQueries.findAllEntityTypes(
			defaultOrgCode,
			defaultTenantCode,
			['id', 'value', 'label', 'data_type', 'organization_id', 'has_entities', 'model_names'],
			{
				allow_filtering: true,
			}
		)

		return entityTypes
	} catch (err) {
		return []
	}
}

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
	} catch (err) {
		return []
	}
}

/**
 * Trigger periodic view refresh for allowed entity types across all tenants.
 */
const triggerPeriodicViewRefresh = async () => {
	try {
		const allowFilteringEntityTypes = await getAllowFilteringEntityTypes()
		const modelNames = await modelNameCollector(allowFilteringEntityTypes)
		console.log('Model names collected:', modelNames)

		if (!modelNames || modelNames.length === 0) {
			console.log('⚠️  No model names found. Skipping periodic view refresh setup.')
			return
		}
		const tenants = await userExtensionQueries.getDistinctTenantCodes()
		console.log(`Starting periodic refresh for ${tenants.length} tenants`)
		if (!tenants || tenants.length === 0) {
			console.log('⚠️  No tenants found. Skipping periodic view refresh setup.')
			return
		}

		// Create unique timestamp for this batch of jobs
		const timestamp = Date.now()

		let globalOffset = 0
		const baseInterval = process.env.REFRESH_VIEW_INTERVAL

		if (!baseInterval) {
			console.error('❌ REFRESH_VIEW_INTERVAL environment variable is not set')
			return
		}
		let jobsCreated = 0
		// Create scheduler jobs for each tenant and model combination
		for (const tenant of tenants) {
			const tenantCode = tenant.code

			// Skip tenants with undefined or empty tenant codes
			if (!tenantCode || tenantCode === 'undefined') {
				console.log(`⚠️  Skipping tenant with invalid code in refresh:`, tenant)
				continue
			}

			let offset = baseInterval / (modelNames.length * tenants.length)
			modelNames.forEach((model, index) => {
				let refreshInterval = baseInterval
				if (model == 'UserExtension') {
					refreshInterval = process.env.USER_EXTENSION_REFRESH_VIEW_INTERVAL || baseInterval
				} else if (model == 'Session') {
					refreshInterval = process.env.SESSION_REFRESH_VIEW_INTERVAL || baseInterval
				}

				const uniqueJobId = `repeatable_view_job_${tenantCode}_${model}_${timestamp}`
				const jobName = `repeatable_view_job_${tenantCode}_${model}`

				// Encode tenant_code and model_name in the URL path using :id parameter
				// Format: /mentoring/v1/admin/triggerPeriodicViewRefreshInternal/{tenantCode|modelName}
				// Encode the entire segment to make | URL-safe (%7C)
				const encodedParams = encodeURIComponent(`${tenantCode}|${model}`)
				const url = `${mentoringBaseurl}/mentoring/v1/admin/triggerPeriodicViewRefreshInternal/${encodedParams}`

				createSchedulerJob(uniqueJobId, refreshInterval, jobName, true, url, globalOffset)

				jobsCreated++
				globalOffset += offset
			})
		}

		console.log(`✅ triggerPeriodicViewRefresh completed - Created ${jobsCreated} scheduler jobs`)
	} catch (err) {
		console.error('❌ Error in triggerPeriodicViewRefresh:', err)
	}
}
const buildMaterializedViews = async () => {
	try {
		console.log('=== Starting buildMaterializedViews ===')

		const tenants = await userExtensionQueries.getDistinctTenantCodes()
		console.log(`Starting materialized view build for ${tenants.length} tenants`)

		if (!tenants || tenants.length === 0) {
			console.log('⚠️  No tenants found. Skipping materialized view build.')
			return
		}
		// Create unique timestamp for this job
		const timestamp = Date.now()

		// Create single job to build ALL materialized views for ALL tenants
		const uniqueJobId = `BuildMaterializedViews_All_Tenants_${timestamp}`
		const jobName = `BuildMaterializedViews_Complete`

		const url = `${mentoringBaseurl}/mentoring/v1/admin/triggerViewRebuildInternal`
		createSchedulerJob(
			uniqueJobId,
			10000, // 10 seconds delay
			jobName,
			false,
			url
		)

		console.log('✅ buildMaterializedViews completed - Scheduler job created')
	} catch (err) {
		console.error('❌ Error in buildMaterializedViews:', err)
	}
}
// Triggering the starting function
buildMaterializedViews()
triggerPeriodicViewRefresh()

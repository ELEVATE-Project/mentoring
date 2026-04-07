'use strict'

const { Op } = require('sequelize')
const db = require('@database/models/index')
const NotificationTemplateQueries = require('@database/queries/notificationTemplate')
const FormQueries = require('@database/queries/form')
const EntityTypeQueries = require('@database/queries/entityType')
const EntityQueries = require('@database/queries/entity')
const QuestionQueries = require('@database/queries/questions')
const QuestionSetQueries = require('@database/queries/question-set')
const ReportTypeQueries = require('@database/queries/reportTypes')
const ReportQueries = require('@database/queries/reports')
const ReportQueryQueries = require('@database/queries/reportQueries')
const ReportRoleMappingQueries = require('@database/queries/reportRoleMapping')
const RoleExtensionQueries = require('@database/queries/roleExtentions')

const KEYS_TO_STRIP = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by']

function stripMeta(record) {
	const copy = { ...record }
	KEYS_TO_STRIP.forEach((key) => delete copy[key])
	return copy
}

async function replicateResource({ label, fetchSource, filter, transform, bulkCreate, transaction }) {
	const items = await fetchSource()
	const eligible = filter ? items.filter(filter) : items
	if (!eligible.length) return
	const newItems = eligible.map(transform)
	await bulkCreate(newItems, { transaction })
	console.log(`[TENANT REPLICATION] ${label} copied: ${newItems.length}`)
}

async function replicateWithIdMap({ label, fetchSource, transform, bulkCreate, fetchExisting, matchKey, transaction }) {
	const sourceItems = await fetchSource()
	if (!sourceItems.length) return {}

	const newItems = sourceItems.map(transform)
	const created = await bulkCreate(newItems, { transaction })

	let toMap = created
	if (created.length < newItems.length) {
		console.log(
			`[TENANT REPLICATION] ${label}: ${
				newItems.length - created.length
			} duplicate(s) skipped — fetching existing records to complete ID mapping`
		)
		toMap = await fetchExisting()
	}

	const idMap = {}
	if (created.length === newItems.length) {
		// All items inserted in order — index-based mapping is exact and avoids
		// false matches when multiple items share the same field values
		for (let i = 0; i < sourceItems.length; i++) {
			idMap[sourceItems[i].id] = created[i].id
		}
	} else {
		// Some duplicates were skipped — fall back to field-based matching
		for (const oldItem of sourceItems) {
			const newItem = toMap.find(matchKey(oldItem))
			if (newItem) idMap[oldItem.id] = newItem.id
		}
	}
	console.log(`[TENANT REPLICATION] ${label} copied: ${created.length}`)
	return idMap
}

module.exports = class TenantService {
	static async fetchDefaultTenantConfig() {
		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE

		if (!defaultTenantCode || !defaultOrgCode) {
			throw new Error('DEFAULT_TENANT_CODE and DEFAULT_ORGANISATION_CODE env vars are required for replication')
		}

		const [
			notificationTemplates,
			forms,
			entityTypes,
			questions,
			questionSets,
			reportTypes,
			reports,
			reportQueries,
			reportRoleMappings,
			roleExtensions,
		] = await Promise.all([
			NotificationTemplateQueries.findTemplatesByFilter({
				organization_code: defaultOrgCode,
				tenant_code: defaultTenantCode,
			}),
			FormQueries.findFormsByFilter({ organization_code: defaultOrgCode }, defaultTenantCode),
			EntityTypeQueries.findAllEntityTypes([defaultOrgCode], defaultTenantCode, null),
			QuestionQueries.find({ organization_code: defaultOrgCode, tenant_code: defaultTenantCode }),
			QuestionSetQueries.findQuestionSets({ organization_code: defaultOrgCode, tenant_code: defaultTenantCode }),
			ReportTypeQueries.findAllByFilter({ organization_code: defaultOrgCode }, defaultTenantCode),
			ReportQueries.findAllReports({ organization_code: defaultOrgCode }, defaultTenantCode),
			ReportQueryQueries.findReportQueries({ organization_code: defaultOrgCode }, defaultTenantCode),
			ReportRoleMappingQueries.findAllByFilter({ organization_code: defaultOrgCode }, defaultTenantCode),
			RoleExtensionQueries.findAllByFilter({ organization_code: defaultOrgCode }, defaultTenantCode),
		])

		const entityTypeIds = entityTypes.map((et) => et.id)
		const entities = entityTypeIds.length
			? await EntityQueries.findAllEntities({ entity_type_id: { [Op.in]: entityTypeIds } }, defaultTenantCode)
			: []

		return {
			notificationTemplates,
			forms,
			entityTypes,
			entities,
			questions,
			questionSets,
			reportTypes,
			reports,
			reportQueries,
			reportRoleMappings,
			roleExtensions,
		}
	}

	static async replicateConfigFromDefaultTenant(newTenantCode, newOrgId, newOrgCode, defaultConfig = null) {
		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		const defaultOrgCode = process.env.DEFAULT_ORGANISATION_CODE

		if (!defaultTenantCode || !defaultOrgCode) {
			throw new Error('DEFAULT_TENANT_CODE and DEFAULT_ORGANISATION_CODE env vars are required for replication')
		}

		if (newTenantCode === defaultTenantCode) {
			console.log('[TENANT REPLICATION] Skipping — source and target are the same tenant')
			return
		}

		if (!newOrgId) {
			throw new Error('newOrgId is required for tenant config replication')
		}
		const newOrgIdStr = newOrgId.toString()
		const resolvedOrgCode = newOrgCode || defaultOrgCode
		const config = defaultConfig || (await TenantService.fetchDefaultTenantConfig())

		const baseTransform =
			(extra = {}) =>
			(record) => ({
				...stripMeta(record),
				tenant_code: newTenantCode,
				organization_code: resolvedOrgCode,
				...extra,
			})

		const transaction = await db.sequelize.transaction()
		try {
			// ── 0. Clear existing config for this tenant (ensures fresh data on re-run) ──
			const configTables = [
				'entities',
				'entity_types', // entities first (references entity_types)
				'question_sets',
				'questions',
				'notification_templates',
				'forms',
				'report_role_mapping',
				'report_queries',
				'reports',
				'report_types',
				'role_extensions',
			]
			for (const table of configTables) {
				await db.sequelize.query(`DELETE FROM "${table}" WHERE tenant_code = :tenantCode`, {
					replacements: { tenantCode: newTenantCode },
					transaction,
				})
			}

			// ── 1. Notification Templates ────────────────────────────────────────
			await replicateResource({
				label: 'Notification templates',
				fetchSource: () => Promise.resolve(config.notificationTemplates),
				transform: baseTransform({ organization_id: newOrgIdStr }),
				bulkCreate: (items, opts) => NotificationTemplateQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 2. Forms ─────────────────────────────────────────────────────────
			await replicateResource({
				label: 'Forms',
				fetchSource: () => Promise.resolve(config.forms),
				transform: baseTransform({ organization_id: newOrgIdStr, version: 0 }),
				bulkCreate: (items, opts) => FormQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 3. Entity Types ───────────────────────────────────────────────────
			const entityTypeIdMap = await replicateWithIdMap({
				label: 'Entity types',
				fetchSource: () => Promise.resolve(config.entityTypes),
				transform: baseTransform({ organization_id: newOrgIdStr, parent_id: null }),
				bulkCreate: (items, opts) => EntityTypeQueries.bulkCreate(items, newTenantCode, opts),
				fetchExisting: () => EntityTypeQueries.findAllEntityTypes([defaultOrgCode], newTenantCode, null),
				matchKey: (oldET) => (c) => c.value === oldET.value && c.organization_code === oldET.organization_code,
				transaction,
			})

			// ── 4. Entities ───────────────────────────────────────────────────────
			// Skipped automatically when entity types are skipped (entityTypeIdMap stays empty)
			const oldEntityTypeIds = Object.keys(entityTypeIdMap).map(Number)
			if (oldEntityTypeIds.length) {
				await replicateResource({
					label: 'Entities',
					fetchSource: () =>
						Promise.resolve(config.entities.filter((e) => oldEntityTypeIds.includes(e.entity_type_id))),
					filter: (e) => entityTypeIdMap[e.entity_type_id] != null,
					transform: (e) => ({
						...baseTransform()(e),
						entity_type_id: entityTypeIdMap[e.entity_type_id],
					}),
					bulkCreate: (items, opts) => EntityQueries.bulkCreate(items, newTenantCode, opts),
					transaction,
				})
			}

			// ── 5. Questions ──────────────────────────────────────────────────────
			const questionIdMap = await replicateWithIdMap({
				label: 'Questions',
				fetchSource: () => Promise.resolve(config.questions),
				transform: baseTransform(),
				bulkCreate: (items, opts) =>
					QuestionQueries.bulkCreate(items, newTenantCode, { ...opts, returning: true }),
				fetchExisting: () => QuestionQueries.find({ tenant_code: newTenantCode }),
				matchKey: (oldQ) => (c) => c.name === oldQ.name && c.organization_code === oldQ.organization_code,
				transaction,
			})

			// ── 6. Question Sets ──────────────────────────────────────────────────
			await replicateResource({
				label: 'Question sets',
				fetchSource: () => Promise.resolve(config.questionSets),
				transform: (qs) => ({
					...baseTransform()(qs),
					questions: (qs.questions || []).map((qId) => {
						const numericId = typeof qId === 'string' ? parseInt(qId, 10) : qId
						return questionIdMap[numericId] !== undefined ? questionIdMap[numericId] : qId
					}),
				}),
				bulkCreate: (items, opts) => QuestionSetQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 7. Report Types ───────────────────────────────────────────────────
			await replicateResource({
				label: 'Report types',
				fetchSource: () => Promise.resolve(config.reportTypes),
				transform: baseTransform(),
				bulkCreate: (items, opts) => ReportTypeQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 8. Reports ────────────────────────────────────────────────────────
			await replicateResource({
				label: 'Reports',
				fetchSource: () => Promise.resolve(config.reports),
				transform: baseTransform({ organization_id: newOrgIdStr }),
				bulkCreate: (items, opts) => ReportQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 9. Report Queries ─────────────────────────────────────────────────
			await replicateResource({
				label: 'Report queries',
				fetchSource: () => Promise.resolve(config.reportQueries),
				transform: baseTransform({ organization_id: newOrgIdStr }),
				bulkCreate: (items, opts) => ReportQueryQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 10. Report Role Mappings ──────────────────────────────────────────
			await replicateResource({
				label: 'Report role mappings',
				fetchSource: () => Promise.resolve(config.reportRoleMappings),
				transform: baseTransform(),
				bulkCreate: (items, opts) => ReportRoleMappingQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			// ── 11. Role Extensions ───────────────────────────────────────────────
			await replicateResource({
				label: 'Role extensions',
				fetchSource: () => Promise.resolve(config.roleExtensions),
				transform: baseTransform({ organization_id: newOrgIdStr }),
				bulkCreate: (items, opts) => RoleExtensionQueries.bulkCreate(items, newTenantCode, opts),
				transaction,
			})

			await transaction.commit()
			console.log(`[TENANT REPLICATION] Complete for tenant: ${newTenantCode}`)
		} catch (error) {
			await transaction.rollback()
			console.error(`[TENANT REPLICATION] Failed for tenant ${newTenantCode}:`, error.message)
			throw error
		}
	}
}

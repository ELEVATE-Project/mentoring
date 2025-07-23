#!/usr/bin/env node
'use strict'

require('dotenv').config({ path: '../.env' })
const { Sequelize, QueryTypes } = require('sequelize')

class CleanupImpactAnalyzer {
	constructor() {
		const databaseUrl = process.env.DATABASE_URL || process.env.DEV_DATABASE_URL
		this.sequelize = new Sequelize(databaseUrl, {
			dialect: 'postgres',
			logging: false,
			pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
		})
	}

	async analyzeOrphanedRecords() {
		console.log('🔍 Analyzing orphaned records and their potential impact...\n')

		// 1. Check entities table impact
		console.log('📊 ENTITIES TABLE ANALYSIS:')
		const entitiesAnalysis = await this.sequelize.query(
			`
			SELECT 
				COUNT(*) as total_entities,
				COUNT(CASE WHEN created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_created_by,
				COUNT(CASE WHEN updated_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_updated_by,
				COUNT(CASE WHEN entity_type_id IN (SELECT id FROM entity_types WHERE deleted_at IS NULL) THEN 1 END) as valid_entity_types
			FROM entities WHERE deleted_at IS NULL
		`,
			{ type: QueryTypes.SELECT }
		)

		console.log(`  Total entities: ${entitiesAnalysis[0].total_entities}`)
		console.log(`  With orphaned created_by: ${entitiesAnalysis[0].orphaned_created_by}`)
		console.log(`  With orphaned updated_by: ${entitiesAnalysis[0].orphaned_updated_by}`)
		console.log(`  With valid entity_types: ${entitiesAnalysis[0].valid_entity_types}`)

		// Check if any other tables reference these entities
		const entityReferences = await this.sequelize.query(
			`
			SELECT 
				'sessions' as referencing_table,
				COUNT(*) as references_count
			FROM sessions 
			WHERE custom_entity_text IS NOT NULL 
			AND custom_entity_text != '{}'
			AND deleted_at IS NULL
		`,
			{ type: QueryTypes.SELECT }
		)

		console.log(`  Referenced in sessions.custom_entity_text: ${entityReferences[0].references_count}`)

		// 2. Check entity_types table impact
		console.log('\n📊 ENTITY_TYPES TABLE ANALYSIS:')
		const entityTypesAnalysis = await this.sequelize.query(
			`
			SELECT 
				COUNT(*) as total_entity_types,
				COUNT(CASE WHEN created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_created_by,
				COUNT(CASE WHEN updated_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_updated_by
			FROM entity_types WHERE deleted_at IS NULL
		`,
			{ type: QueryTypes.SELECT }
		)

		console.log(`  Total entity_types: ${entityTypesAnalysis[0].total_entity_types}`)
		console.log(`  With orphaned created_by: ${entityTypesAnalysis[0].orphaned_created_by}`)
		console.log(`  With orphaned updated_by: ${entityTypesAnalysis[0].orphaned_updated_by}`)

		// Check entities that depend on these entity_types
		const dependentEntities = await this.sequelize.query(
			`
			SELECT et.id, et.value, et.label, COUNT(e.id) as dependent_entities_count
			FROM entity_types et
			LEFT JOIN entities e ON et.id = e.entity_type_id AND e.deleted_at IS NULL
			WHERE et.deleted_at IS NULL
			AND (et.created_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL)
				OR et.updated_by NOT IN (SELECT user_id FROM user_extensions WHERE deleted_at IS NULL))
			GROUP BY et.id, et.value, et.label
			ORDER BY dependent_entities_count DESC
		`,
			{ type: QueryTypes.SELECT }
		)

		console.log(`  Entity types with orphaned user refs that have dependent entities:`)
		dependentEntities.forEach((et) => {
			console.log(`    - ${et.value} (${et.label}): ${et.dependent_entities_count} entities depend on it`)
		})

		// 3. Check session-related impacts
		console.log('\n📊 SESSION-RELATED ANALYSIS:')
		const sessionAnalysis = await this.sequelize.query(
			`
			SELECT 
				'session_attendees' as table_name,
				COUNT(*) as total_records,
				COUNT(CASE WHEN session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_records
			FROM session_attendees
			UNION ALL
			SELECT 
				'session_enrollments' as table_name,
				COUNT(*) as total_records,
				COUNT(CASE WHEN session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_records
			FROM session_enrollments
			UNION ALL
			SELECT 
				'session_ownerships' as table_name,
				COUNT(*) as total_records,
				COUNT(CASE WHEN session_id::text NOT IN (SELECT id::text FROM sessions WHERE deleted_at IS NULL) THEN 1 END) as orphaned_records
			FROM session_ownerships
		`,
			{ type: QueryTypes.SELECT }
		)

		sessionAnalysis.forEach((table) => {
			console.log(`  ${table.table_name}: ${table.orphaned_records}/${table.total_records} orphaned records`)
		})

		// 4. Summary and recommendations
		console.log('\n🎯 CLEANUP IMPACT SUMMARY:')
		const totalOrphanedUserRefs =
			parseInt(entitiesAnalysis[0].orphaned_created_by) +
			parseInt(entitiesAnalysis[0].orphaned_updated_by) +
			parseInt(entityTypesAnalysis[0].orphaned_created_by) +
			parseInt(entityTypesAnalysis[0].orphaned_updated_by)

		console.log(`  Total orphaned user references: ${totalOrphanedUserRefs}`)
		console.log(`  Strategy: UPDATE orphaned user references to system user (preserves data)`)
		console.log(`  Risk Level: LOW - No data loss, only reference fixing`)

		if (dependentEntities.length > 0) {
			console.log(
				`  ⚠️  WARNING: ${dependentEntities.length} entity types with orphaned refs have dependent entities`
			)
			console.log(`  Recommendation: Use UPDATE strategy instead of DELETE to preserve relationships`)
		}

		return {
			totalOrphanedUserRefs,
			dependentEntities: dependentEntities.length,
			riskLevel: dependentEntities.length > 0 ? 'MEDIUM' : 'LOW',
		}
	}

	async run() {
		console.log('🔍 Cleanup Impact Analysis\n')

		try {
			await this.sequelize.authenticate()
			console.log('Connected to database\n')

			const analysis = await this.analyzeOrphanedRecords()

			console.log('\n' + '='.repeat(60))
			console.log('📋 RECOMMENDATIONS:')
			console.log('='.repeat(60))

			if (analysis.riskLevel === 'LOW') {
				console.log('✅ SAFE to proceed with cleanup migration')
				console.log('✅ Using UPDATE strategy preserves all functional data')
				console.log('✅ No cascading deletions or data loss expected')
			} else {
				console.log('⚠️  MEDIUM risk - proceed with caution')
				console.log('⚠️  Some entity types with dependencies have orphaned references')
				console.log('✅ UPDATE strategy still recommended over DELETE')
			}

			console.log('\n🚀 Next steps:')
			console.log('1. Run: sequelize-cli db:migrate')
			console.log('2. Verify: node pre-migration-integrity-check.js')
			console.log('3. Test application functionality in staging')
		} catch (error) {
			console.error(`❌ Analysis failed: ${error.message}`)
		} finally {
			await this.sequelize.close()
		}
	}
}

if (require.main === module) {
	const analyzer = new CleanupImpactAnalyzer()
	analyzer.run()
}

module.exports = CleanupImpactAnalyzer

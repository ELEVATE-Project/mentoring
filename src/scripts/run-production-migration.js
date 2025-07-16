#!/usr/bin/env node

/**
 * Production Migration Runner for Mentoring Service
 * Handles 30+ lakh records with Citus distribution
 */

require('dotenv').config({ path: '../.env' })
const MentoringDataMigrator = require('./mentoring-data-migration')
const readline = require('readline')

console.log('🎯 Production Mentoring Service Data Migration')
console.log('==============================================')

// Configuration check
console.log('\n📋 Environment Configuration:')
console.log(`   Database URL: ${process.env.DEV_DATABASE_URL ? '✅ Set' : '❌ Missing'}`)
console.log(`   Default Tenant: ${process.env.DEFAULT_ORGANISATION_CODE || 'DEFAULT_TENANT'}`)
console.log(`   Default Org Code: ${process.env.DEFAULT_ORG_CODE || 'DEFAULT_ORG'}`)
console.log(`   Default Org ID: ${process.env.DEFAULT_ORG_ID || '1'}`)

// Check CSV files
const fs = require('fs')
const path = require('path')

console.log('\n📁 CSV Files Status:')
const csvFiles = ['data_codes.csv']
let allFilesExist = true

csvFiles.forEach((file) => {
	const filePath = path.join(__dirname, '../data', file)
	const exists = fs.existsSync(filePath)
	console.log(`   ${file}: ${exists ? '✅ Found' : '❌ Missing'}`)
	if (!exists) allFilesExist = false

	if (exists) {
		const stats = fs.statSync(filePath)
		const sizeKB = Math.round(stats.size / 1024)
		console.log(`     Size: ${sizeKB}KB, Modified: ${stats.mtime.toISOString().split('T')[0]}`)
	}
})

// Migration plan
console.log('\n📋 Migration Plan:')
console.log('   Phase 1: Tables with organization_id using GROUP BY strategy')
console.log('   Phase 2: Tables with user_id using user_extensions data')
console.log('   Phase 3: Citus distribution (conditional on Citus presence)')
console.log('   Update strategy: Efficient bulk updates with JOINs')
console.log('   Estimated time: 30-60 minutes for large datasets')
console.log('   Safety: All operations are transactional')

console.log('\n⚠️  IMPORTANT WARNINGS:')
console.log('   • Uses data_codes.csv with organization_id, organization_code, tenant_code columns')
console.log('   • First updates tables with organization_id using GROUP BY')
console.log('   • Then updates tables with user_id using user_extensions')
console.log('   • Only executes Citus distribution if Citus is present')
console.log('   • Much faster than previous batch processing approach')

if (!allFilesExist) {
	console.log('\n❌ MISSING CSV FILES:')
	console.log('   Please export data_codes.csv from user service first:')
	console.log('   1. Create data_codes.csv with columns: organization_id, organization_code, tenant_code')
	console.log('   2. Save file in ./data/ directory')
	console.log('   3. Re-run this script')
	process.exit(1)
}

// Prompt for confirmation
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

rl.question('\n🤔 Proceed with production migration? (y/N): ', async (answer) => {
	if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
		console.log('\n🚀 Starting production migration...')
		console.log('   ⏰ Started at:', new Date().toISOString())
		rl.close()

		try {
			const migrator = new MentoringDataMigrator()

			// Production configuration - can be overridden via environment variables
			migrator.batchSize = parseInt(process.env.BATCH_SIZE) || 5000
			migrator.maxRetries = parseInt(process.env.MAX_RETRIES) || 5
			migrator.retryDelay = parseInt(process.env.RETRY_DELAY) || 3000
			migrator.progressInterval = parseInt(process.env.PROGRESS_INTERVAL) || 10000

			console.log('\n📊 Production Settings:')
			console.log(`   Batch size: ${migrator.batchSize}`)
			console.log(`   Max retries: ${migrator.maxRetries}`)
			console.log(`   Progress updates: Every ${migrator.progressInterval} records`)

			await migrator.execute()

			console.log('\n🎉 Production migration completed successfully!')
			console.log('   ⏰ Finished at:', new Date().toISOString())
			process.exit(0)
		} catch (error) {
			console.error('\n❌ Production migration failed:', error)
			console.log('   ⏰ Failed at:', new Date().toISOString())
			console.log('\n🔧 Troubleshooting:')
			console.log('   • Check database connectivity')
			console.log('   • Verify CSV file integrity')
			console.log('   • Check disk space for redistribution')
			console.log('   • Review error logs above')
			process.exit(1)
		}
	} else {
		console.log('\n❌ Migration cancelled by user')
		console.log('   Use test-citus-migration.js for testing')
		rl.close()
		process.exit(0)
	}
})

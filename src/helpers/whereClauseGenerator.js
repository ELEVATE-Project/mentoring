const generateWhereClause = (tableName) => {
	let whereClause = ''

	switch (tableName) {
		case 'sessions': {
			const currentEpochDate = Math.floor(new Date().getTime() / 1000) // Get current date in epoch format
			whereClause = `deleted_at IS NULL AND start_date >= ${currentEpochDate}`
			break
		}
		case 'mentor_extensions': {
			whereClause = 'deleted_at IS NULL'
			break
		}
		case 'user_extensions': {
			whereClause = 'deleted_at IS NULL'
			break
		}
		default:
			whereClause = 'deleted_at IS NULL'
	}

	return whereClause
}

const whereClauseGenerator = {
	generateWhereClause,
}

module.exports = whereClauseGenerator

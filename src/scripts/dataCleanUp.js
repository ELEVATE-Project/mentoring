const { Client } = require('pg')

// PostgreSQL config
const client = new Client({
	user: 'postgres',
	host: 'localhost',
	database: 'mentoringfeb15',
	password: 'postgres',
	port: 5432,
})

;(async () => {
	try {
		await client.connect()
		console.log('Connected to PostgreSQL')

		const deletions = [
			{ label: 'sessions', query: 'DELETE FROM sessions' },
			{ label: 'session_attendees', query: 'DELETE FROM session_attendees' },
			{ label: 'session_enrollments', query: 'DELETE FROM session_enrollments' },
			{ label: 'session_ownerships', query: 'DELETE FROM session_ownerships' },
			{ label: 'user_extensions', query: 'DELETE FROM user_extensions' },
			{
				label: 'orgnization_extension (except org 1)',
				query: "DELETE FROM organization_extension WHERE name != 'Default Organization'",
			},
			{ label: 'feedbacks', query: 'DELETE FROM feedbacks' },
		]

		for (const { label, query } of deletions) {
			const res = await client.query(query)
			console.log(`Deleted ${res.rowCount} record(s) from ${label}`)
		}
	} catch (err) {
		console.error('Error executing queries', err.stack)
	} finally {
		await client.end()
		console.log('Disconnected from PostgreSQL')
	}
})()

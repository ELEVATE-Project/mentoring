const { matchers } = require('jest-json-schema')
const { Pool } = require('pg')

expect.extend(matchers)

//PostgreSQL connection string
const connectionString = 'postgres://postgres:postgres@localhost:5432/elevate-mentoring'

// Use a Pool so connections are managed automatically and global.db stays
// usable in afterAll hooks across all test files (a Client closes permanently).
const pool = new Pool({ connectionString })

pool.on('error', (err) => {
	console.error('DB pool error:', err)
})

global.db = pool

beforeAll(async () => {
	// You can add any setup code you need here
})

afterAll(async () => {
	// Pool connections are released automatically when the Jest worker process exits.
	// Do not call pool.end() here — it runs before test-file afterAll hooks,
	// which still need global.db for their own cleanup queries.
})

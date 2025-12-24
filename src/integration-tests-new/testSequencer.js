const Sequencer = require('@jest/test-sequencer').default
const path = require('path')

class CustomSequencer extends Sequencer {
	sort(tests) {
		// Define exact execution order (must match actual filenames)
		const executionOrder = [
			'connections/connections.specs.js',
			'entity/entity.specs.js',
			'entity-type/entity-type.specs.js',
			'form/form.specs.js',
			'mentees/mentees.specs.js',
			'mentors/mentors.specs.js',
			'profile/profile.specs.js',
			'requestSessions/requestSessions.specs.js',
			'sessions/sessions.specs.js',
			'default-rule/default-rule.specs.js',
		]

		// Map tests to their relative paths
		const testMap = {}
		tests.forEach((test) => {
			const relPath = path.relative(path.join(process.cwd(), 'integration-tests-new'), test.path)
			testMap[relPath] = test
		})

		// Create ordered test array
		const orderedTests = []
		executionOrder.forEach((testPath) => {
			if (testMap[testPath]) {
				orderedTests.push(testMap[testPath])
				delete testMap[testPath]
			} else {
				console.warn(`⚠️ Test not found: ${testPath}`)
			}
		})

		// Add any remaining tests at the end
		const remainingTests = Object.values(testMap)
		if (remainingTests.length) {
			console.warn(
				'⚠️ These tests were not in the execution order:',
				remainingTests.map((t) => path.relative(path.join(process.cwd(), 'integration-tests'), t.path))
			)
			orderedTests.push(...remainingTests)
		}

		console.log('✅ Final execution order:')
		orderedTests.forEach((test, index) => {
			console.log(`${index + 1}. ${path.relative(path.join(process.cwd(), 'integration-tests'), test.path)}`)
		})

		return orderedTests
	}
}

module.exports = CustomSequencer

describe('Entity api test.', () => {
	const mongoose = require('mongoose')

	async function loadMongo() {
		let db = await mongoose.connect(global.__MONGO_URI__ + global.mongoDBName, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		})
		global.db = db
		return
	}

	describe('Create,Read,Update and Delete test', () => {
		let entitiesData
		let entitiesId

		beforeAll(async () => {
			await loadMongo()
			entitiesData = require('@db/entities/query')

			return
		})

		test('Should return true on create', async () => {
			const bodyData = {
				value: 'sqa',
				label: 'SQAA',
				type: 'categories',
				image: 'entity/SQAA.jpg',
				createdBy: '62d00b7c082b1ebc88a2a095',
				updatedBy: '62d00b7c082b1ebc88a2a095',
			}

			const actualResponse = await entitiesData.createEntity(bodyData)

			expect(actualResponse).toEqual(true)
		})

		test('Read entity test', async () => {
			const bodyData = { type: 'categories', deleted: 'false', status: 'ACTIVE' }

			const actualResponse = await entitiesData.findAllEntities(bodyData)
			entitiesId = actualResponse[0]._id
			expect(actualResponse[0].value).toEqual('sqa')
		})

		test('Should update an entity', async () => {
			let _id = '62d00b7c082b1ebc88a2a095'
			const bodyData = {
				value: 'sqaa',
				label: 'SQAA',
				type: 'categories',
				image: 'entity/SQAA.jpg',
				createdBy: '62d00b7c082b1ebc88a2a095',
				updatedBy: _id,
				updatedAt: new Date().getTime(),
			}

			const actualResponse = await entitiesData.updateOneEntity(entitiesId, bodyData)
			expect(actualResponse).toEqual('ENTITY_UPDATED')
		})

		test('Should delete an entity', async () => {
			const actualResponse = await entitiesData.deleteOneEntity(entitiesId)
			expect(actualResponse).toEqual('ENTITY_UPDATED')
		})

		afterAll(async () => {
			try {
				mongoose.connection.close()
			} catch (error) {
				console.log(`
            You did something wrong
            ${error}
          `)
				throw error
			}
		})
	})
})

/**
 * name : configs/kafka
 * author : Aman Gupta
 * Date : 07-Dec-2021
 * Description : Kafka connection configurations
 */

const utils = require('@generics/utils')
const { elevateLog } = require('elevate-logger')
const logger = elevateLog.init()
const { Kafka } = require('kafkajs')
const deleteuserConsumer = require('@generics/kafka/consumers/deleteuser')
const rolechangeConsumer = require('@generics/kafka/consumers/rolechange')
const createuserConsumer = require('@generics/kafka/consumers/createuser')
const updateuserConsumer = require('@generics/kafka/consumers/updateuser')
const organizationConsumer = require('@generics/kafka/consumers/organization')

module.exports = async () => {
	const kafkaIps = process.env.KAFKA_URL.split(',')

	const KafkaClient = new Kafka({
		clientId: 'mentoring',
		brokers: kafkaIps,
	})

	const producer = KafkaClient.producer()
	await producer.connect()

	producer.on('producer.connect', () => {
		logger.info('KafkaProvider: connected')
	})
	producer.on('producer.disconnect', () => {
		logger.error('KafkaProvider: could not connect', {
			triggerNotification: true,
		})
	})

	global.kafkaProducer = producer
	global.kafkaClient = KafkaClient

	startConsumer(KafkaClient).catch((err) => {
		logger.error('Kafka consumer failed to start', { err: err?.stack || err?.message })
	})
}

async function startConsumer(kafkaClient) {
	const consumer = kafkaClient.consumer({
		groupId: process.env.KAFKA_GROUP_ID,
		sessionTimeout: 45000, // allows slow handlers
		heartbeatInterval: 3000,
	})

	consumer.on(consumer.events.GROUP_JOIN, (e) => {
		logger.info(`Kafka Consumer: Group join – partitions assigned = ${JSON.stringify(e.payload?.memberAssignment)}`)
	})

	consumer.on(consumer.events.REBALANCING, (e) => {
		logger.warn(`Kafka Consumer: Rebalancing triggered – ${e.payload.reason}`)
	})

	consumer.on(consumer.events.HEARTBEAT, () => {
		logger.debug('Kafka Consumer: Heartbeat OK')
	})

	await consumer.connect()
	logger.info('Kafka Consumer: Connected to broker')

	const topics = [process.env.EVENTS_TOPIC, process.env.CLEAR_INTERNAL_CACHE].filter(Boolean)

	await consumer.subscribe({ topics })
	logger.info(`Kafka Consumer: Subscribed to topics = ${JSON.stringify(topics)}`)

	await consumer.run({
		autoCommit: true, // safe because processing is fast per message
		eachBatch: async ({ batch, heartbeat, resolveOffset, commitOffsetsIfNecessary, isRunning, isStale }) => {
			logger.info(
				`Kafka Batch: Received batch | topic=${batch.topic} | partition=${batch.partition} | size=${batch.messages.length}`
			)

			for (const message of batch.messages) {
				if (!isRunning() || isStale()) {
					logger.warn('Kafka Batch: Consumer is no longer running or batch is stale, stopping processing.')
					break
				}

				const rawValue = message.value?.toString()
				const offset = message.offset
				const topic = batch.topic
				const partition = batch.partition

				logger.info(`Kafka Batch: Message | topic=${topic} | partition=${partition} | offset=${offset}`)

				if (!rawValue) {
					logger.warn(`Kafka Batch: Empty message skipped`)
					resolveOffset(offset)
					continue
				}

				let payload
				try {
					payload = JSON.parse(rawValue)
				} catch (e) {
					logger.warn('Kafka Batch: Invalid JSON, skipping', {
						offset,
						err: e.message,
					})
					resolveOffset(offset)
					continue
				}

				//--------------------------------------------------------
				// ROUTE MESSAGE TO CORRECT HANDLER
				//--------------------------------------------------------
				let response

				try {
					if (topic === process.env.EVENTS_TOPIC && payload) {
						// Handle organization events
						if (
							payload.entity === 'organization' &&
							(payload.eventType === 'create' ||
								payload.eventType === 'update' ||
								payload.eventType === 'deactivate')
						) {
							response = await organizationConsumer.messageReceived(payload)
						}

						// Handle user events
						if (payload.entity === 'user') {
							if (payload.eventType === 'roleChange') {
								response = await rolechangeConsumer.messageReceived(payload)
							}

							if (payload.eventType === 'create' || payload.eventType === 'bulk-create') {
								response = await createuserConsumer.messageReceived(payload)
							}

							if (payload.eventType === 'delete') {
								response = await deleteuserConsumer.messageReceived(payload)
							}

							if (payload.eventType === 'update' || payload.eventType === 'bulk-update') {
								response = await updateuserConsumer.messageReceived(payload)
							}
						}
					} else if (topic === process.env.CLEAR_INTERNAL_CACHE && payload?.type === 'CLEAR_INTERNAL_CACHE') {
						response = await utils.internalDel(payload.value)
					}

					logger.info(`Kafka event handling response: ${response}`)
				} catch (handlerErr) {
					logger.error(`Kafka Batch: Error handling message`, {
						topic,
						partition,
						offset,
						err: handlerErr.stack || handlerErr.message,
					})
				}

				//--------------------------------------------------------
				// MARKS MESSAGE AS PROCESSED
				//--------------------------------------------------------
				resolveOffset(offset)

				//--------------------------------------------------------
				// HEARTBEAT TO PREVENT TIMEOUT
				//--------------------------------------------------------
				await heartbeat()
			}

			// commit offsets once per batch
			await commitOffsetsIfNecessary()
		},
	})
}

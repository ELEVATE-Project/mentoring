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
const userRequest = require('@services/users')
const adminService = require('@services/admin')
const orgService = require('@services/org-admin')

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

	await startConsumer(KafkaClient)

	global.kafkaProducer = producer
	global.kafkaClient = KafkaClient
}

async function startConsumer(kafkaClient) {
	const consumer = kafkaClient.consumer({ groupId: process.env.KAFKA_INTERNAL_CACHE_GROUP_ID })

	await consumer.connect()
	await consumer.subscribe({ topics: [process.env.EVENTS_TOPIC, process.env.CLEAR_INTERNAL_CACHE] })

	await consumer.run({
		eachMessage: async ({ topic, partition, message }) => {
			try {
				const rawValue = message.value?.toString()
				if (!rawValue) {
					logger.warn(`Empty Kafka message skipped on topic ${topic}`)
					return
				}
				message = JSON.parse(rawValue)

				let response
				if (message && topic === process.env.EVENTS_TOPIC) {
					if (message.eventType === 'roleChange') {
						response = await rolechangeConsumer.messageReceived(message)
					}
					if (message.eventType === 'create' || message.eventType === 'bulk-create') {
						response = await createuserConsumer.messageReceived(message)
					}
					if (message.eventType === 'delete') {
						response = await deleteuserConsumer.messageReceived(message)
					}
					if (message.eventType === 'update' || message.eventType === 'bulk-update') {
						response = await updateuserConsumer.messageReceived(message)
					}
				}
				if (message && topic === process.env.CLEAR_INTERNAL_CACHE) {
					if (message.type == 'CLEAR_INTERNAL_CACHE') {
						response = await utils.internalDel(streamingData.value)
					}
				}
				logger.info(`Kafk event handling response : ${response}`)
			} catch (err) {
				logger.error(`Error in Kafka message handler for topic ${topic}`, {
					topic,
					partition,
					offset: message.offset,
					err: err?.stack || err?.message || String(err),
				})

				if (err.topics && err.topics[0] === process.env.EVENTS_TOPIC) {
					rolechnageConsumer.errorTriggered(error)
				}

				logger.error(`Error in Kafka message handler for topic ${topic}`, {
					topic,
					partition,
					offset: message.offset,
					err: err?.stack || err?.message || String(err),
				})
			}
		},
	})
}

'use strict'
const moment = require('moment')

exports.getAvailabilitiesByDay = ({ startEpoch, endEpoch, availabilities }) => {
	try {
		if (!startEpoch || !endEpoch || !availabilities) {
			throw new Error('startEpoch, endEpoch & availabilities values are mandatory ')
		}
		const startDate = moment.unix(startEpoch).startOf('day')
		const endDate = moment.unix(endEpoch).endOf('day')

		const dates = []
		let currentDate = startDate.clone()

		while (currentDate <= endDate) {
			const epochStartOfDay = currentDate.startOf('day').unix()
			const epochEndOfDay = currentDate.endOf('day').unix()
			dates.push({ date: currentDate.format('YYYY-MM-DD'), epochStartOfDay, epochEndOfDay })
			currentDate.add(1, 'day')
		}

		const arrayOfDays = new Map()

		dates.forEach((date) => {
			arrayOfDays.set(
				date.epochStartOfDay,
				availabilities.filter(
					(availability) =>
						availability.start_time >= date.epochStartOfDay && availability.start_time <= date.epochEndOfDay
				)
			)
		})

		return Object.fromEntries(arrayOfDays)
	} catch (error) {
		console.error(error)
		return false
	}
}
exports.buildUserAvailabilities = ({ startEpoch, endEpoch, userAvailabilities }) => {
	try {
		const allEvents = []
		userAvailabilities.forEach((userAvailability) => {
			if (userAvailability.repeat_unit == null) {
				// if its a onetime event include it
				allEvents.push(userAvailability)
			} else {
				// if its a recurring event generate events in the date range
				const start = moment(startEpoch * 1000).startOf('day') // Convert start date to milliseconds and set time to start of day
				const end = moment(endEpoch * 1000).endOf('day') // Convert end date to milliseconds and set time to end of day
				let occurrenceDate = moment(userAvailability.start_time * 1000) // Convert event start time to milliseconds and set time to start of day
				let occurrenceEndDate = moment(userAvailability.end_time * 1000) // Convert event start time to milliseconds and set time to start of day

				while (occurrenceDate.isSameOrBefore(end)) {
					const occurrenceDateClone = moment(occurrenceDate) // clone of occurrenceDate

					if (
						occurrenceDate.isSameOrAfter(start) &&
						(userAvailability.repeat_on == null ||
							userAvailability.repeat_on.includes(moment.weekdays()[occurrenceDate.day()])) &&
						(userAvailability.expiration_date == null ||
							occurrenceDate.isSameOrBefore(moment.unix(userAvailability.expiration_date))) &&
						(userAvailability.exceptions == null ||
							userAvailability.exceptions[occurrenceDateClone.startOf('day').unix()] == undefined)
					) {
						allEvents.push({
							...userAvailability,
							start_time: occurrenceDate.unix(),
							end_time: occurrenceEndDate.unix(),
							start_time_date:
								occurrenceDate.clone().utcOffset('+05:30').format('DD-MMM-YYYY hh:mm A') + ' IST',
							end_time_date:
								occurrenceEndDate.clone().utcOffset('+05:30').format('DD-MMM-YYYY hh:mm A') + ' IST',
						})
					} else if (
						userAvailability?.exceptions !== null &&
						userAvailability?.exceptions[occurrenceDateClone.startOf('day').unix()] !== undefined /* &&
						userAvailability?.exceptions[occurrenceDateClone.startOf('day').unix()]?.start_time !==
							undefined */
					) {
						// if an exception exists for the occurrence date use the updated time from the exception
						const { start_time, end_time } =
							userAvailability.exceptions[occurrenceDate.startOf('day').unix()]

						if (start_time !== undefined && end_time !== undefined) {
							allEvents.push({ ...userAvailability, start_time: start_time, end_time: end_time })
						}
					}
					occurrenceDate.add(
						userAvailability.repeat_increment || 1,
						userAvailability.repeat_unit.toLowerCase()
					)
					occurrenceEndDate.add(
						userAvailability.repeat_increment || 1,
						userAvailability.repeat_unit.toLowerCase()
					)
					if (
						userAvailability.repeat_unit === 'MONTH' &&
						userAvailability.repeat_on &&
						userAvailability.occurrence_in_month
					) {
						// If repeat_on is specified for monthly events, adjust the occurrenceDate to match the specified occurrence within the month
						const dayOfWeek = moment.weekdays().indexOf(userAvailability.repeat_on[0])

						const occurrenceDateTime = occurrenceDate.clone()
						const occurrenceEndDateTime = occurrenceEndDate.clone()

						occurrenceDate = occurrenceDate.clone().startOf('month').day(dayOfWeek)
						occurrenceEndDate = occurrenceEndDate.clone().startOf('month').day(dayOfWeek)

						const occurrenceWeek = userAvailability.occurrence_in_month // Adjust occurrence_in_month to array index
						occurrenceDate.add(occurrenceWeek, 'weeks')
						occurrenceEndDate.add(occurrenceWeek, 'weeks')

						/* Set the time components of occurrenceDate to match occurrenceDateTime,
						   since it was overwritten by .clone().startOf('month').day(dayOfWeek) */
						occurrenceDate.set({
							hour: occurrenceDateTime.hour(),
							minute: occurrenceDateTime.minute(),
							second: occurrenceDateTime.second(),
						})
						occurrenceEndDate.set({
							hour: occurrenceEndDateTime.hour(),
							minute: occurrenceEndDateTime.minute(),
							second: occurrenceEndDateTime.second(),
						})
					}
				}
			}
		})
		return allEvents
	} catch (error) {
		console.error(error)
		return false
	}
}

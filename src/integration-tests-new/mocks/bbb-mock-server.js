/**
 * Minimal BigBlueButton mock server for integration tests.
 * Handles the two endpoints the mentoring service calls:
 *   GET /bigbluebutton/api/create  → returns SUCCESS XML so createMeeting resolves
 *   GET /bigbluebutton/api/join    → returns a plain-text join URL (just for logging)
 *
 * Run standalone: node bbb-mock-server.js
 * Used as a Docker service in docker-compose-dev.yml so the mentoring container
 * can reach it at http://mock-bbb:8190 instead of the real BBB server.
 */

const http = require('http')
const url = require('url')

const PORT = process.env.MOCK_BBB_PORT || 8190

function createMeetingXML(meetingID) {
	const internalID = `mock-internal-${meetingID}-${Date.now()}`
	return `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <returncode>SUCCESS</returncode>
  <meetingID>${meetingID}</meetingID>
  <internalMeetingID>${internalID}</internalMeetingID>
  <parentMeetingID>bbb-none</parentMeetingID>
  <attendeePW>mock-attendee-pw</attendeePW>
  <moderatorPW>mock-moderator-pw</moderatorPW>
  <createTime>${Date.now()}</createTime>
  <voiceBridge>12345</voiceBridge>
  <dialNumber>613-555-0000</dialNumber>
  <createDate>${new Date().toUTCString()}</createDate>
  <hasUserJoined>false</hasUserJoined>
  <duration>60</duration>
  <hasBeenForciblyEnded>false</hasBeenForciblyEnded>
  <messageKey></messageKey>
  <message></message>
</response>`
}

const server = http.createServer((req, res) => {
	const parsed = url.parse(req.url, true)
	const path = parsed.pathname
	const query = parsed.query

	console.log(`[mock-bbb] ${req.method} ${req.url}`)

	if (path === '/bigbluebutton/api/create') {
		const xml = createMeetingXML(query.meetingID || 'mock-meeting-id')
		res.writeHead(200, { 'Content-Type': 'text/xml' })
		res.end(xml)
		return
	}

	if (path === '/bigbluebutton/api/join') {
		// The mentoring service builds the join URL locally — it never actually
		// calls /api/join over HTTP. This handler is here as a safety net.
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end(`http://mock-bbb:${PORT}/mock-join-redirect`)
		return
	}

	// Catch-all: return a generic SUCCESS so nothing hard-fails
	res.writeHead(200, { 'Content-Type': 'text/xml' })
	res.end(`<?xml version="1.0" encoding="UTF-8"?><response><returncode>SUCCESS</returncode></response>`)
})

server.listen(PORT, '0.0.0.0', () => {
	console.log(`[mock-bbb] Mock BBB server listening on port ${PORT}`)
})

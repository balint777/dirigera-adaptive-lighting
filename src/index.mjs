/**
 * @typedef {import('dirigera').Light} Light
 */
import { createDirigeraClient } from 'dirigera'
import ColorTemperatureController from './ColorTemperatureController.mjs'

/**
 * @type {string}
 */
const DIRIGERA_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImI2NmY0MTMwOTYxZjliN2U4ZjcyMDdlOTM0MWRjYTVjY2RmODcyZjM2YTZlY2U0YTg1MjdkYTMzZTkzZTY3NDYifQ.eyJpc3MiOiI4MDU2Yjc5MS04MzY4LTRkNjEtYTNkZC04NmY4OTlhNGI2MTAiLCJ0eXBlIjoiYWNjZXNzIiwiYXVkIjoiaG9tZXNtYXJ0LmxvY2FsIiwic3ViIjoiMzY4ZDcwNzUtYzIxMC00ZWYwLThhMjYtNzM1NzE4ZDllMWNlIiwiaWF0IjoxNjk3NTMwNTAxLCJleHAiOjIwMTMxMDY1MDF9.M3xSFdMb_PloWvhw4ReBHwD7unP3wky2Ghg-jQME-HrisBX1Zfv7ydGLYfpyCfBJU_YaDuDFXKSVR2MGNLu4Gg'

/**
 * Async wrapper
 */
async function App () {
	const client = await createDirigeraClient({ accessToken: DIRIGERA_TOKEN })

	const ctc = new ColorTemperatureController(client)

	client.startListeningForUpdates(async (updateEvent) => {
		if (updateEvent.data.type !== 'light') return

		/**
		 * @type {Light}
		 */
		const light = await client.lights.get({ id: updateEvent.data.id })

		if (typeof updateEvent.data.attributes.isOn === 'boolean') {
			await ctc.onIsOnChanged(updateEvent.data.attributes.isOn, light)
		}

		if (typeof updateEvent.data.attributes.colorTemperature !== 'undefined') {
			await ctc.onColorTemperatureChanged(updateEvent.data.attributes.colorTemperature, light)
		}
	})
}

App()

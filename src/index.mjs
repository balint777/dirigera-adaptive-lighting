/**
 * @typedef {import('dirigera').Light} Light
 */
import { createDirigeraClient } from 'dirigera'
import LightController from './LightController.mjs'

/**
 * @type {string}
 */
const DIRIGERA_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImI2NmY0MTMwOTYxZjliN2U4ZjcyMDdlOTM0MWRjYTVjY2RmODcyZjM2YTZlY2U0YTg1MjdkYTMzZTkzZTY3NDYifQ.eyJpc3MiOiI4MDU2Yjc5MS04MzY4LTRkNjEtYTNkZC04NmY4OTlhNGI2MTAiLCJ0eXBlIjoiYWNjZXNzIiwiYXVkIjoiaG9tZXNtYXJ0LmxvY2FsIiwic3ViIjoiMzY4ZDcwNzUtYzIxMC00ZWYwLThhMjYtNzM1NzE4ZDllMWNlIiwiaWF0IjoxNjk3NTMwNTAxLCJleHAiOjIwMTMxMDY1MDF9.M3xSFdMb_PloWvhw4ReBHwD7unP3wky2Ghg-jQME-HrisBX1Zfv7ydGLYfpyCfBJU_YaDuDFXKSVR2MGNLu4Gg'

/**
 * Async wrapper for the app
 */
async function App () {
	const client = await createDirigeraClient({ accessToken: DIRIGERA_TOKEN })
	const hubStatus = await client.hub.status()

	const ctc = new LightController(client, hubStatus.attributes.coordinates.latitude, hubStatus.attributes.coordinates.longitude)

	const disconnectedLights = new Set()

	// Poll the discovered lights every 5 minutes to recognize them as off
	setInterval(async () => {
		const lights = await client.lights.list()
		lights
			.filter(light => !light.isReachable && !disconnectedLights.has(light.id))
			.forEach(async light => {
				disconnectedLights.add(light.id)
				if (ctc.isColorTemperatureCapable(light)) await ctc.onIsOnChanged(false, light)
				// if (lic.isLightLevelCapable(light)) await lic.onIsOnChanged(false, light)
			})
	}, 1000 * 60 * 5)

	client.startListeningForUpdates(async (updateEvent) => {
		if (updateEvent.data.type !== 'light') return

		if (disconnectedLights.has(updateEvent.data.id)) disconnectedLights.delete(updateEvent.data.id)

		/**
		 * @type {Light}
		 */
		const light = await client.lights.get({ id: updateEvent.data.id })

		if (typeof updateEvent.data.attributes.isOn === 'boolean') {
			if (ctc.isColorTemperatureCapable(light)) await ctc.onIsOnChanged(updateEvent.data.attributes.isOn, light)
		}

		if (typeof updateEvent.data.attributes.colorTemperature !== 'undefined') {
			await ctc.onColorTemperatureChanged(updateEvent.data.attributes.colorTemperature, light)
		}

		if (typeof updateEvent.data.attributes.lightLevel !== 'undefined') {
			await ctc.onLightLevelChanged(updateEvent.data.attributes.lightLevel, light)
		}
	})
}

App()

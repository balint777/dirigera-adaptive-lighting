/**
 * @typedef {import('dirigera').Light} Light
 * @typedef {import('dirigera').DirigeraClient} DirigeraClient
 */
import suncalc from 'suncalc'
import ControllerBase from './ControllerBase.mjs'

export default class LightLevelController extends ControllerBase {
	/**
	 * @type {Set<string>}
	 */
	temporaryExclusion = new Set()

	/**
	 * @description Updates the color temperature of a list of lights
	 * @param {Array<Light>} lights The list of lights to update the color temperature of
	 * @returns {Promise<any[]>} A promise that resolves if all lights has been set
	 */
	_updateLightLevel (lights) {
		if (lights.length === 0) return Promise.all([]);

		const now = new Date()
		const sunPosition = suncalc.getPosition(now,this._latitude, this._longitude)

		const altitude = sunPosition.altitude * 2.0 / Math.PI

		const horizon = 30
		const zenith = 600
		/**
		 * zenith    -| - - - - - - . - - - - - -
		 *            |       .           .
		 * altitude  -| -  🌞   - - - - - -  . -
		 *            |  .                     .
		 *            | .                       .
		 * horizon    |. - - - - - - - - - - - - .
		 */
		const lightLevel = Math.min(Math.max(Math.round((horizon * 1.0) + (altitude * (zenith - horizon))), 1), 100)
		console.info(`Setting ${lights.length > 1 ? `${lights.length} lights` : lights[0].attributes.customName} to ${lightLevel}% (altitude: ${altitude.toFixed(2)})`)

		return Promise.all(lights.map(l => {
			return this.client.devices.setAttributes({
				id: l.id,
				attributes: {
					lightLevel
				}
			})
		}))
	}

	isLightLevelCapable(light) {
		return light.capabilities.canReceive.indexOf('lightLevel') > -1
	}

	/**
	 * @description Gets all lights that are on and supports dimming
	 * @returns {Promise<Array<Light>>} A list of dimmable lights
	 */
	async getOnLightLevelLights () {
		const lights = await this.client.lights.list()
		const lightLevelLights = lights.filter(this.isLightLevelCapable)
		return lightLevelLights.filter(light => light.attributes.isOn)
	}

	/**
	 * @description Updates the color temperature of all lights that are on
	 * @returns {Promise<void>} A promise that resolves when all lights has been updated
	 */
	async update () {
		const onLightLevelLights = await this.getOnLightLevelLights()
		const lightsToBeUpdated = onLightLevelLights.filter(l => !this.temporaryExclusion.has(l.id))
		await this._updateLightLevel(lightsToBeUpdated)
	}

	/**
	 * @description Called when the isOn state of a light was changed
	 * @param {boolean} isOn True if the light was turned on, false if it was turned off
	 * @param {Light} light The light that was controlled
	 */
	async onIsOnChanged (isOn, light) {
		if (isOn) {
			await this._updateLightLevel([light])
		} else if (this.temporaryExclusion.has(light.id)) {
			this.temporaryExclusion.delete(light.id)
			console.log(`Removing ${light.attributes.customName} in the ${light.room.name} from temporary exclusion list for automatic light level updates`)
		}
	}

	/**
	 * @description Called when the color temperature of a light was changed
	 * @param {number} lightLevel The new color temperature value in Kelvin
	 * @param {Light} light The light that was controlled
	 */
	onLightLevelChanged (lightLevel, light) {
		if (!this.temporaryExclusion.has(light.id)) {
			this.temporaryExclusion.add(light.id)
			console.log(`Excluding ${light.attributes.customName} in the ${light.room.name} from automatic light level updates until the next power on`)
		}
	}
}

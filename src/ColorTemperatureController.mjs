/**
 * @typedef {import('dirigera').Light} Light
 * @typedef {import('dirigera').DirigeraClient} DirigeraClient
 */
import suncalc from 'suncalc'
import ControllerBase from './ControllerBase.mjs'

export default class ColorTemperatureController extends ControllerBase {
	/**
	 * @type {Set<string>}
	 */
	temporaryExclusion = new Set()

	get sunColorTemperature () {

		const now = new Date()
		const sunPosition = suncalc.getPosition(now, this._latitude, this._longitude)

		const altitude = sunPosition.altitude * 2.0 / Math.PI

		const horizon = 3000
		const zenith = 6000

		/**
		 * zenith    -| - - - - - - . - - - - - -
		 *            |       .           .
		 * altitude  -| -  🌞   - - - - - -  . -
		 *            |  .                     .
		 *            | .                       .
		 * horizon    |. - - - - - - - - - - - - .
		 */
		const temperature = Math.round((horizon * 1.0) + (altitude * (zenith - horizon)))
		return temperature
	}

	/**
	 * @description Updates the color temperature of a list of lights
	 * @param {Array<Light>} lights The list of lights to update the color temperature of
	 * @returns {Promise<any[]>} A promise that resolves if all lights has been set
	 */
	async _updateColorTemperature (lights) {
		if (lights.length === 0) return Promise.all([]);

		const currentSunColorTemperature = await this.sunColorTemperature;
		console.info(`Setting ${lights.length > 1 ? `${lights.length} lights` : lights[0].attributes.customName} to ${currentSunColorTemperature} K`)

		return Promise.all(lights.map(l => {

			return this.client.lights.setLightTemperature({
				id: l.id,
				colorTemperature: currentSunColorTemperature
			})
		}))
	}

	/**
	 * @description Checks if a light supports color temperature adjustment
	 * @param {Light} light The light to check
	 */
	isColorTemperatureCapable (light) {
		return light.capabilities.canReceive.indexOf('colorTemperature') > -1
	}

	/**
	 * @description Gets all lights that are on and supports color temperature
	 * @returns {Promise<Array<Light>>} A list of color temperature capable lights
	 */
	async getOnColorTemperatureLights () {
		const lights = await this.client.lights.list()
		const colorTemperatureLights = lights.filter(this.isColorTemperatureCapable)
		return colorTemperatureLights.filter(light => light.attributes.isOn)
	}

	/**
	 * @description Updates the color temperature of all lights that are on
	 * @returns {Promise<void>} A promise that resolves when all lights has been updated
	 */
	async update () {
		const onColorTemperatureLights = await this.getOnColorTemperatureLights()
		const lightsToBeUpdated = onColorTemperatureLights.filter(l => !this.temporaryExclusion.has(l.id))
		await this._updateColorTemperature(lightsToBeUpdated)
	}

	/**
	 * @description Called when the isOn state of a light was changed
	 * @param {boolean} isOn True if the light was turned on, false if it was turned off
	 * @param {Light} light The light that was controlled
	 */
	async onIsOnChanged (isOn, light) {
		if (isOn) {
			await this._updateColorTemperature([light])
		} else if (this.temporaryExclusion.has(light.id)) {
			this.temporaryExclusion.delete(light.id)
			console.log(`Removing ${light.attributes.customName} in the ${light.room.name} from temporary exclusion list for automatic color temperature updates`)
		}
	}

	/**
	 * @description Called when the color temperature of a light was changed
	 * @param {number} lightColorTemperature The color temperature value of the light in Kelvins
	 * @param {Light} light The light that was controlled
	 */
	async onColorTemperatureChanged (lightColorTemperature, light) {
		const currentSunColorTemperature = await this.sunColorTemperature;

		if (Math.abs(lightColorTemperature - currentSunColorTemperature) > 100) {
			if (!this.temporaryExclusion.has(light.id)) {
				this.temporaryExclusion.add(light.id)
				console.log(`Excluding ${light.attributes.customName} in the ${light.room.name} from automatic color temperature updates until the next power on`)
			}
		}

	}
}

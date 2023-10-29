/**
 * @typedef {import('dirigera').Light} Light
 * @typedef {import('dirigera').DirigeraClient} DirigeraClient
 */
import suncalc from 'suncalc'
import { ControlQueue } from './ControlQueue.mjs'

export default class LightController {
	/**
	 * @type {Set<string>}
	 */
	temporaryColorTemperatureExclusion = new Set()

	/**
	 * @type {Set<string>}
	 */
	temporaryLightLevelExclusion = new Set()

	/**
	 * @type {DirigeraClient}
	 * @description The DIRIGERA client
	 */
	client

	/**
	 * @type {number}
	 * @description The longitude of the DIRIGERA hub
	 */
	_longitude

	/**
	 * @type {number}
	 * @description The latitude of the DIRIGERA hub
	 */
	_latitude

	/**
	 * @type {ControlQueue}
	 * @description An object that controls the queue of commands sent to the DIRIGERA hub
	 */
	_controlQueue

	/**
	 * @description Creates a new instance of the color temperature controller
	 * @param {DirigeraClient} client The DIRIGERA client
	 * @param {number} latitude The latitude of the DIRIGERA hub
	 * @param {number} longitude The longitude of the DIRIGERA hub
	 */
	constructor (client, latitude, longitude) {
		this.client = client
		this._longitude = longitude
		this._latitude = latitude
		this._controlQueue = new ControlQueue(client)
		setInterval(this.update.bind(this), 1 * 60 * 1000)
		this.update()
	}

	/**
	 * Calculates the closest color temperature to the current color temperature of the
	 * sun that a specific light can produce
	 * @param {Light} light The light to calculate the color temperature for closest to the sun that the light can produce
	 * @returns {number} the closest color temperature to the current color temperature
	 *                   of the sun that the light can produce
	 */
	adaptedSunColorTemperature (light) {
		const now = new Date()
		const sunPosition = suncalc.getPosition(now, this._latitude, this._longitude)

		const altitude = sunPosition.altitude * 2.0 / Math.PI

		const horizon = 3000
		const zenith = 6000

		/**
		 * zenith    -| - - - - - - . - - - - - - -
		 *            |       .           .
		 * altitude  -|- - 🌞 - - - - - - - -.- - -
		 *            |  .                     .
		 *            | .                       .
		 * horizon   -|.- - - - - - - - - - - - -.-
		 */
		const temperature = Math.round((horizon * 1.0) + (altitude * (zenith - horizon)))
		let temp = temperature

		if (typeof light.attributes.colorTemperatureMin === 'number') {
			temp = Math.min(temp, light.attributes.colorTemperatureMin)
		}
		if (typeof light.attributes.colorTemperatureMax === 'number') {
			temp = Math.max(temp, light.attributes.colorTemperatureMax)
		}

		return temp
	}

	/**
	 * @description Updates the color temperature of a list of lights
	 * @param {Light} light The light to update the color temperature of
	 * @returns {number} The new color temperature
	 */
	_updateColorTemperature (light) {
		const temp = this.adaptedSunColorTemperature(light)
		return temp
	}

	/**
	 * @description Updates the color temperature of a list of lights
	 * @param {Light} light The light to update the color temperature of
	 * @returns {number} The new light level
	 */
	_updateLightLevel (light) {
		const now = new Date()
		const timeofday = (now.getHours() * 60 + now.getMinutes()) * 60 + now.getSeconds()

		/**
		 * f(x) = 600 * sin((timeofday-21600)*pi/(79200 - 21600))
		 * 100 |                          *******************************************
		 *     |                        **********************************************
		 *   1 |                      **************************************************
		 *     +-------------------------------------------------------------------------------->
		 *                          6:00                                              22:00
		 *                       (21'600 s)                                         (79'200 s)
		 */
		const lightLevel = Math.min(Math.max(600 * Math.sin((timeofday - 21600) * Math.PI / (79200 - 21600)), 1), 100)

		return lightLevel
	}

	/**
	 * @description Checks if a light supports color temperature adjustment
	 * @param {Light} light The light to check
	 * @returns {boolean} True if the light supports color temperature adjustment, false otherwise
	 */
	isColorTemperatureCapable (light) {
		return light.capabilities.canReceive.indexOf('colorTemperature') > -1
	}

	/**
	 * @description Checks if a light is capable of receiving light level commands
	 * @param {Light} light The light to check
	 * @returns {boolean} True if the light is capable of receiving light level commands, false otherwise
	 */
	isLightLevelCapable (light) {
		return light.capabilities.canReceive.indexOf('lightLevel') > -1
	}

	/**
	 * @description Gets all lights that are on
	 * @returns {Promise<Array<Light>>} A list of color temperature capable lights
	 */
	async getOnLights () {
		const lights = await this.client.lights.list()
		return lights
			.filter(light => light.isReachable)
			.filter(light => light.attributes.isOn)
	}

	/**
	 * @description Updates the color temperature of all lights that are on
	 * @returns {Promise<void>} A promise that resolves when all lights has been updated
	 */
	async update () {
		const onLights = await this.getOnLights()

		await Promise.all(onLights.map(light => this.updateSingleLight(light)))
	}

	/**
	 * @description Updates the attributes of a single light
	 * @param {Light} light The light to update the attributes of
	 */
	updateSingleLight (light) {
		if (this.isLightLevelCapable(light) && !this.temporaryLightLevelExclusion.has(light.id)) {
			const lightLevel = this._updateLightLevel(light)
			if (light.attributes.lightLevel !== lightLevel) {
				this._controlQueue.schedule(light, 'lightLevel', lightLevel)
			}
		}

		if (this.isColorTemperatureCapable(light) && !this.temporaryColorTemperatureExclusion.has(light.id)) {
			const colorTemperature = this._updateColorTemperature(light)
			if (light.attributes.colorTemperature !== colorTemperature) {
				this._controlQueue.schedule(light, 'colorTemperature', colorTemperature)
			}
		}
	}

	/**
	 * @description Called when the isOn state of a light was changed
	 * @param {boolean} isOn True if the light was turned on, false if it was turned off
	 * @param {Light} light The light that was controlled
	 */
	async onIsOnChanged (isOn, light) {
		if (this.temporaryColorTemperatureExclusion.has(light.id)) {
			this.temporaryColorTemperatureExclusion.delete(light.id)
			console.log(`Removing ${light.attributes.customName} in the ${light.room.name} from temporary exclusion list for automatic color temperature updates`)
		}
		if (this.temporaryLightLevelExclusion.has(light.id)) {
			this.temporaryLightLevelExclusion.delete(light.id)
			console.log(`Removing ${light.attributes.customName} in the ${light.room.name} from temporary exclusion list for automatic light level updates`)
		}

		if (isOn) await this.updateSingleLight(light)
	}

	/**
	 * @description Called when the color temperature of a light was changed
	 * @param {number} lightColorTemperature The color temperature value of the light in Kelvins
	 * @param {Light} light The light that was controlled
	 */
	async onColorTemperatureChanged (lightColorTemperature, light) {
		const currentAdaptedSunColorTemperature = this.adaptedSunColorTemperature(light)

		if (Math.abs(lightColorTemperature - currentAdaptedSunColorTemperature) > 100) {
			if (!this.temporaryColorTemperatureExclusion.has(light.id)) {
				this.temporaryColorTemperatureExclusion.add(light.id)
				console.log(`Excluding ${light.attributes.customName} in the ${light.room.name} from automatic color temperature updates`)
			}
		} else if (this.temporaryColorTemperatureExclusion.has(light.id)) {
			this.temporaryColorTemperatureExclusion.delete(light.id)
			console.log(`Removing ${light.attributes.customName} in the ${light.room.name} from temporary exclusion list for automatic color temperature updates`)
		}
	}

	/**
	 * @description Called when the color temperature of a light was changed
	 * @param {number} lightLevel The new color temperature value in Kelvin
	 * @param {Light} light The light that was controlled
	 */
	onLightLevelChanged (lightLevel, light) {
		const currentLightLevel = this._updateLightLevel(light)

		if (Math.abs(lightLevel - currentLightLevel) > 20) {
			if (!this.temporaryLightLevelExclusion.has(light.id)) {
				this.temporaryLightLevelExclusion.add(light.id)
				console.log(`Excluding ${light.attributes.customName} in the ${light.room.name} from automatic light level updates`)
			}
		} else if (this.temporaryLightLevelExclusion.has(light.id)) {
			this.temporaryLightLevelExclusion.delete(light.id)
			console.log(`Removing ${light.attributes.customName} in the ${light.room.name} from temporary exclusion list for automatic light level updates`)
		}
	}
}

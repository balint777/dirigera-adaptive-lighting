/**
 * @typedef {import('dirigera').Light} Light
 */
import suncalc from 'suncalc'

export default class ColorTemperatureController {
	/**
	 * @type {number}
	 */
	MAX_TEMP = 5500

	/**
	 * @type {number}
	 */
	MIN_TEMP = 2200

	/**
	 * @description The DIRIGERA client
	 */
	client

	/**
	 * @type {Set<string>}
	 */
	temporaryExclusion = new Set()

	/**
	 * @type {Set<string>}
	 */
	ignoreUpdate = new Set()

	constructor (client) {
		this.client = client
		setInterval(this.update.bind(this), 1 * 60 * 1000)
		this.update()
	}

	/**
	 * @param {Array<Light>} lights The list of lights to update the color temperature of
	 * @returns {Promise<any[]>} A promise that resolves if all lights has been set
	 */
	async _updateColorTemperature (lights) {
		const hubStatus = await this.client.hub.status()

		const now = new Date()
		const latitude = hubStatus.attributes.coordinates.latitude
		const longitude = hubStatus.attributes.coordinates.longitude
		const sunPosition = suncalc.getPosition(now, latitude, longitude)

		const fraction = sunPosition.altitude * 2.0 / Math.PI

		const colorTemperature = Math.round((this.MIN_TEMP * 1.0) + (Math.max(fraction, 0) * (this.MAX_TEMP - this.MIN_TEMP)))

		if (lights.length > 1) console.log(`Setting ${lights.length} lights to ${colorTemperature} K`)
		else if (lights.length === 1) console.log(`Setting ${lights[0].attributes.customName} to ${colorTemperature} K`)

		return Promise.all(lights.map(l => this.client.devices.setAttributes({
			id: l.id,
			attributes: {
				colorTemperature
			}
		}).then(() => this.ignoreUpdate.add(l.id))))
	}

	/**
	 * @returns {Promise<Array<Light>>} A list of color temperature capable lights
	 */
	async getOnColorTemperatureLights () {
		const lights = await this.client.lights.list()
		const colorTemperatureLights = lights.filter(l => l.capabilities.canReceive.indexOf('colorTemperature') > -1)
		return colorTemperatureLights.filter(light => light.attributes.isOn)
	}

	async update () {
		const onColorTemperatureLights = await this.getOnColorTemperatureLights()
		const lightsToBeUpdated = onColorTemperatureLights.filter(l => !this.temporaryExclusion.has(l.id))
		await this._updateColorTemperature(lightsToBeUpdated)
	}

	/**
	 * @param {boolean} isOn True if the light was turned on, false if it was turned off
	 * @param {Light} light The light that was controlled
	 */
	async onIsOnChanged (isOn, light) {
		if (isOn) {
			await this._updateColorTemperature([light])
		} else {
			this.temporaryExclusion.delete(light.id)
		}
	}

	/**
	 * @param {number} colorTemperature The color temperature value in Kelvin
	 * @param {Light} light The light that was controlled
	 */
	onColorTemperatureChanged (colorTemperature, light) {
		if (this.ignoreUpdate.has(light.id)) {
			this.ignoreUpdate.delete(light.id)
		} else {
			if (!this.temporaryExclusion.has(light.id)) {
				this.temporaryExclusion.add(light.id)
			}
		}
	}
}

/**
 * @typedef {import('dirigera').Light} Light
 * @typedef {import('dirigera').DirigeraClient} DirigeraClient
 */
import suncalc from 'suncalc'

export default class ColorTemperatureController {
	/**
	 * @description The DIRIGERA client
	 * @type {DirigeraClient}
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

	/**
	 * @description Creates a new instance of the color temperature controller
	 * @param {DirigeraClient} client The DIRIGERA client
	 */
	constructor (client) {
		this.client = client
		setInterval(this.update.bind(this), 1 * 60 * 1000)
		this.update()
	}

	/**
	 * @description Updates the color temperature of a list of lights
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

		return Promise.all(lights.map(l => {
			const minTemp = l.attributes.colorTemperatureMax || 2200
			const maxTemp = l.attributes.colorTemperatureMin || 5500
			const colorTemperature = Math.round((minTemp * 1.0) + (Math.max(fraction, 0) * (maxTemp - minTemp)))
			console.info(`Setting ${l.attributes.customName} in the ${l.room.name} to ${colorTemperature} K`)

			return this.client.devices.setAttributes({
				id: l.id,
				attributes: {
					colorTemperature
				}
			})
			.then(() => this.ignoreUpdate.add(l.id))
		}))
	}

	/**
	 * @description Gets all lights that are on and supports color temperature
	 * @returns {Promise<Array<Light>>} A list of color temperature capable lights
	 */
	async getOnColorTemperatureLights () {
		const lights = await this.client.lights.list()
		const colorTemperatureLights = lights.filter(l => l.capabilities.canReceive.indexOf('colorTemperature') > -1)
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
		} else {
			this.temporaryExclusion.delete(light.id)
		}
	}

	/**
	 * @description Called when the color temperature of a light was changed
	 * @param {number} colorTemperature The new color temperature value in Kelvin
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

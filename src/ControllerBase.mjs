/**
 * @typedef {import('dirigera').Light} Light
 * @typedef {import('dirigera').DirigeraClient} DirigeraClient
 */

export default class ControllerBase {
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
	 * @description Creates a new instance of the color temperature controller
	 * @param {DirigeraClient} client The DIRIGERA client
	 * @param {number} latitude The latitude of the DIRIGERA hub
	 * @param {number} longitude The longitude of the DIRIGERA hub
	 */
	constructor (client, latitude, longitude) {
		this.client = client
		this._longitude = longitude
		this._latitude = latitude
		setInterval(this.update.bind(this), 1 * 60 * 1000)
		this.update()
	}

	/**
	 * @description Updates the color temperature of all lights that are on
	 * @returns {Promise<void>} A promise that resolves when all lights has been updated
	 */
	async update () {}

	/**
	 * @description Called when the isOn state of a light was changed
	 * @param {boolean} isOn True if the light was turned on, false if it was turned off
	 * @param {Light} light The light that was controlled
	 */
	async onIsOnChanged (isOn, light) {}

	/**
	 * @description Called when the color temperature of a light was changed
	 * @param {number} colorTemperature The new color temperature value in Kelvin
	 * @param {Light} light The light that was controlled
	 */
	onColorTemperatureChanged (colorTemperature, light) {}
}

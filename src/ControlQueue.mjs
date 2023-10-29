/**
 * @typedef {import('dirigera').Device} Device
 * @typedef {import('dirigera').DirigeraClient} DirigeraClient
 */

export class ControlQueue {

	/**
	 * @type {DirigeraClient}
	 */
	client

	/**
	 * @type {Object.<string, Array.<Function>>}
	 */
	_queue = {}

	constructor(client) {
		this.client = client
	}
	
	/**
	 * @param {Device} device The device to control
	 * @param {string} attribute The attribute to control
	 * @param {any} value The value to set the attribute to
	 */
	schedule(device, attribute, value) {
		if (typeof this._queue[device.id] === 'undefined') this._queue[device.id] = new Array()

		this._queue[device.id].push(_ => {
			const attributes = {}
			attributes[attribute] = value

			console.info(`Setting ${device.attributes.customName} attributes ${JSON.stringify(attributes)}`)
			return this.client.devices.setAttributes({
				id: device.id,
				attributes
			})
			.catch(err => {
				console.error(`Failed to set attributes for ${device.attributes.customName}: ${err.message}`)
			})
		})

		if (this._queue[device.id].length < 2) {
			this._runQueue(device.id)
		}
	}

	async _runQueue(id) {
		while (this._queue[id].length > 0) {
			const ctrl = this._queue[id][0]
			if (typeof ctrl === 'undefined') break
			await ctrl()
			await new Promise(resolve => setTimeout(resolve, 500));
			this._queue[id].shift()
		}
	}
}
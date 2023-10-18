/**
 * @typedef {import('dirigera').Light} Light
 */
import { createDirigeraClient } from 'dirigera'
import suncalc from 'suncalc'

/**
 * @type {string}
 */
const DIRIGERA_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImI2NmY0MTMwOTYxZjliN2U4ZjcyMDdlOTM0MWRjYTVjY2RmODcyZjM2YTZlY2U0YTg1MjdkYTMzZTkzZTY3NDYifQ.eyJpc3MiOiI4MDU2Yjc5MS04MzY4LTRkNjEtYTNkZC04NmY4OTlhNGI2MTAiLCJ0eXBlIjoiYWNjZXNzIiwiYXVkIjoiaG9tZXNtYXJ0LmxvY2FsIiwic3ViIjoiMzY4ZDcwNzUtYzIxMC00ZWYwLThhMjYtNzM1NzE4ZDllMWNlIiwiaWF0IjoxNjk3NTMwNTAxLCJleHAiOjIwMTMxMDY1MDF9.M3xSFdMb_PloWvhw4ReBHwD7unP3wky2Ghg-jQME-HrisBX1Zfv7ydGLYfpyCfBJU_YaDuDFXKSVR2MGNLu4Gg'

/**
 * @type {number}
 */
const LATITUDE = 48.0567975201887

/**
 * @type {number}
 */
const LONGITUDE = 20.755862200951483

/**
 * @type {number}
 */
const MAX_TEMP = 5500

/**
 * @type {number}
 */
const MIN_TEMP = 2200

/**
 * @type {Set<string>}
 */
const ignoreUpdate = new Set()

/**
 * Async wrapper
 */
async function App () {
  const client = await createDirigeraClient({ accessToken: DIRIGERA_TOKEN })

  /**
   * @returns {Promise<Array<Light>>} A list of color temperature capable lights
   */
  const getOnColorTemperatureLights = async function () {
    const lights = await client.lights.list()
    const colorTemperatureLights = lights.filter(l => l.capabilities.canReceive.indexOf('colorTemperature') > -1)
    return colorTemperatureLights.filter(light => light.attributes.isOn)
  }

  /**
   * @param {Array<Light>} lights The list of lights to update the color temperature of
   * @returns {Promise<any[]>} A promise that resolves if all lights has been set
   */
  const updateColorTemperature = function (lights) {
    const now = new Date()
    const sunPosition = suncalc.getPosition(now, LATITUDE, LONGITUDE)
    const fraction = sunPosition.altitude * 2.0 / Math.PI

    const colorTemp = Math.round((MIN_TEMP * 1.0) + (Math.max(fraction, 0) * (MAX_TEMP - MIN_TEMP)))

    if (lights.length > 1) console.log(`Setting ${lights.length} lights to ${colorTemp} K`)
    else if (lights.length === 1) console.log(`Setting ${lights[0].attributes.customName} to ${colorTemp} K`)

    return Promise.all(lights.map(l => client.devices.setAttributes({
      id: l.id,
      attributes: {
        colorTemperature: colorTemp
      }
    }).then(_ => {
      ignoreUpdate.add(l.id)
    })))
  }

  /**
   * @type {Set<string>}
   */
  const temporaryExclusion = new Set()

  const updateLambda = async () => {
    const onColorTemperatureLights = await getOnColorTemperatureLights()
    const lightsToBeUpdated = onColorTemperatureLights.filter(l => !temporaryExclusion.has(l.id))
    updateColorTemperature(lightsToBeUpdated)
  }

  setInterval(updateLambda, 1 * 60 * 1000)
  updateLambda()

  client.startListeningForUpdates(async (updateEvent) => {
    if (updateEvent.data.type !== 'light') return

    /**
     * @type {Light}
     */
    const light = await client.lights.get(updateEvent.data)

    if (typeof updateEvent.data.attributes.isOn === 'boolean') {
      if (updateEvent.data.attributes.isOn) {
        updateColorTemperature([light])
      } else {
        temporaryExclusion.delete(light.id)
      }
    }

    if (typeof updateEvent.data.attributes.colorTemperature !== 'undefined') {
      if (ignoreUpdate.has(light.id)) {
        ignoreUpdate.delete(light.id)
      } else {
        if (!temporaryExclusion.has(light.id)) {
          temporaryExclusion.add(light.id)
        }
      }
    }
  })
}

App()

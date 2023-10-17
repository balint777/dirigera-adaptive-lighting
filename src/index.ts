import { Light, createDirigeraClient } from 'dirigera'
import { getPosition } from 'suncalc';

const DIRIGERA_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImI2NmY0MTMwOTYxZjliN2U4ZjcyMDdlOTM0MWRjYTVjY2RmODcyZjM2YTZlY2U0YTg1MjdkYTMzZTkzZTY3NDYifQ.eyJpc3MiOiI4MDU2Yjc5MS04MzY4LTRkNjEtYTNkZC04NmY4OTlhNGI2MTAiLCJ0eXBlIjoiYWNjZXNzIiwiYXVkIjoiaG9tZXNtYXJ0LmxvY2FsIiwic3ViIjoiMzY4ZDcwNzUtYzIxMC00ZWYwLThhMjYtNzM1NzE4ZDllMWNlIiwiaWF0IjoxNjk3NTMwNTAxLCJleHAiOjIwMTMxMDY1MDF9.M3xSFdMb_PloWvhw4ReBHwD7unP3wky2Ghg-jQME-HrisBX1Zfv7ydGLYfpyCfBJU_YaDuDFXKSVR2MGNLu4Gg';
const LATITUDE = 48.0567975201887;
const LONGITUDE = 20.755862200951483;
const MAX_TEMP = 5500;
const MIN_TEMP = 2200;

function isColorTemperatureLight(light: Light) : boolean { return light.capabilities.canReceive.indexOf('colorTemperature') > -1; }

createDirigeraClient({ accessToken: DIRIGERA_TOKEN })
.then(async client => {

  function updateColorTemperature(lights: Array<Light>) : Promise<any[]>
  {
    const now = new Date();
    const sunPosition = getPosition(now, LATITUDE, LONGITUDE);
    var fraction = sunPosition.altitude * 2.0 / Math.PI;

    const colorTemp = Math.round((MIN_TEMP * 1.0) + (Math.max(fraction,0) * (MAX_TEMP - MIN_TEMP)));
  
    if (lights.length > 1) console.log(`Setting ${lights.length} lights to ${colorTemp} K`);
    else if (lights.length == 1) console.log(`Setting ${lights[0].attributes.customName} to ${colorTemp} K`);

    return Promise.all(lights.map(light => client.devices.setAttributes({
      id: light.id,
      attributes: {
        colorTemperature: colorTemp
      },
    })));
  }

  const lights = await client.lights.list();
  const colorTemperatureLights = lights.filter(isColorTemperatureLight);
  const onColorTemperatureLights = new Set(colorTemperatureLights.filter(light => light.attributes.isOn));

  const updateLambda = () => updateColorTemperature(Array.from(onColorTemperatureLights));

  setInterval(updateLambda, 60*1000);
  updateLambda();

  client.startListeningForUpdates(async (updateEvent) => {
    const light = colorTemperatureLights.find(light => light.id == updateEvent.data.id);
    if (typeof light == 'undefined') return;

    if (typeof updateEvent.data.attributes.isOn == 'boolean') {
      if (updateEvent.data.attributes.isOn) {
        onColorTemperatureLights.add(light);
        updateColorTemperature([light]);
      } else {
        onColorTemperatureLights.delete(light);
      }
    }
  })
})



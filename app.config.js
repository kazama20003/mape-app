// Extiende app.json inyectando la API key de Google Maps desde el entorno
// (.env → GOOGLE_MAPS_API_KEY), para no dejar la clave escrita en el repo.
// Expo carga automáticamente los archivos .env en process.env al evaluar esto.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android && config.android.config),
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      },
    },
  },
  ios: {
    ...config.ios,
    config: {
      ...(config.ios && config.ios.config),
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    },
  },
});

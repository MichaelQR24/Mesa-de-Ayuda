import { app } from './app.js';
import { env } from './config/env.js';

const HOST = '0.0.0.0';
const PORT = env.PORT;

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor backend escuchando en http://${HOST}:${PORT}`);
  console.log(`📡 Entorno: ${env.NODE_ENV}`);
  console.log(`🩺 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://${HOST}:${PORT}/api/v1/test`);
});

// Manejo de apagado graceful
const handleShutdown = (signal: string) => {
  console.log(`\nCerrando servidor backend debido a ${signal}...`);
  server.close(() => {
    console.log('Servidor backend detenido correctamente.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

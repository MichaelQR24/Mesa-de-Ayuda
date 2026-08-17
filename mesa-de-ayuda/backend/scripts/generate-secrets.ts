import { randomBytes } from 'crypto';

console.log('🔑 Generador de Secretos Criptográficos Seguros para Mesa de Ayuda\n');

const accessSecret = randomBytes(32).toString('hex');
const refreshSecret = randomBytes(32).toString('hex');

console.log('Copia estos valores en las variables de entorno de Render / .env:\n');
console.log(`JWT_ACCESS_SECRET=${accessSecret}`);
console.log(`JWT_REFRESH_SECRET=${refreshSecret}`);
console.log('\n⚠️  IMPORTANTE: No compartas estos secretos ni los subas a Git.');

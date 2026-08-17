import dotenv from 'dotenv';
import { prisma } from '../src/lib/prisma.js';

dotenv.config();

async function testDatabaseConnection() {
  console.log('====================================================');
  console.log('🐘 COMPROBACIÓN DE CONEXIÓN POSTGRESQL (SUPABASE)');
  console.log('====================================================');

  try {
    const startTime = Date.now();
    // Consulta simple sin efectos secundarios
    await prisma.$queryRaw`SELECT 1 as result`;
    const latency = Date.now() - startTime;

    console.log('Database connection: OK');
    console.log(`⏱️ Latencia de base de datos: ${latency}ms`);
    console.log('====================================================');
    process.exit(0);
  } catch (error: unknown) {
    console.error('❌ Error al conectar con la base de datos PostgreSQL:');
    if (error instanceof Error) {
      console.error(`Mensaje: ${error.message}`);
    } else {
      console.error(error);
    }
    console.log('💡 Recuerda verificar que DATABASE_URL y DIRECT_URL estén configuradas en backend/.env con la contraseña correcta.');
    console.log('====================================================');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();

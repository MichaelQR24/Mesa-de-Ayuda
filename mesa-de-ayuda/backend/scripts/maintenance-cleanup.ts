import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

const isDryRun = process.argv.includes('--dry-run');

console.log(`🧹 Mantenimiento y Limpieza de Base de Datos ${isDryRun ? '[MODO SIMULACIÓN / DRY-RUN]' : '[MODO EJECUCIÓN REAL]'}\n`);

async function runMaintenance() {
  try {
    const now = new Date();

    // 1. Política de retención de historial IA
    const retentionDays = env.AI_HISTORY_RETENTION_DAYS || 90;
    const historyCutoff = new Date();
    historyCutoff.setDate(historyCutoff.getDate() - retentionDays);

    // 2. Política de sesiones revocadas antiguas (30 días)
    const sessionRevokedCutoff = new Date();
    sessionRevokedCutoff.setDate(sessionRevokedCutoff.getDate() - 30);

    console.log(`[+] Fecha actual: ${now.toISOString()}`);
    console.log(`[+] Retención de historial IA: ${retentionDays} días (Corte: ${historyCutoff.toISOString()})`);
    console.log(`[+] Retención de sesiones revocadas: 30 días (Corte: ${sessionRevokedCutoff.toISOString()})\n`);

    // Contar registros candidatos
    const [expiredSessionsCount, oldRevokedSessionsCount, oldHistoryCount] = await Promise.all([
      prisma.authSession.count({
        where: { expiresAt: { lt: now } },
      }),
      prisma.authSession.count({
        where: {
          revokedAt: { not: null, lt: sessionRevokedCutoff },
        },
      }),
      prisma.aiHistory.count({
        where: { createdAt: { lt: historyCutoff } },
      }),
    ]);

    console.log('--- Resumen de Registros a Procesar ---');
    console.log(`• Sesiones expiradas: ${expiredSessionsCount}`);
    console.log(`• Sesiones revocadas antiguas (>30d): ${oldRevokedSessionsCount}`);
    console.log(`• Registros de historial IA antiguos (>${retentionDays}d): ${oldHistoryCount}`);

    if (isDryRun) {
      console.log('\nℹ️  SIMULACIÓN COMPLETADA: No se eliminó ningún registro.');
      return;
    }

    // Ejecución real
    console.log('\n--- Ejecutando Limpieza en PostgreSQL ---');
    const [deletedExpired, deletedRevoked, deletedHistory] = await prisma.$transaction([
      prisma.authSession.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.authSession.deleteMany({
        where: {
          revokedAt: { not: null, lt: sessionRevokedCutoff },
        },
      }),
      prisma.aiHistory.deleteMany({
        where: { createdAt: { lt: historyCutoff } },
      }),
    ]);

    console.log(`✅ Sesiones expiradas eliminadas: ${deletedExpired.count}`);
    console.log(`✅ Sesiones revocadas antiguas eliminadas: ${deletedRevoked.count}`);
    console.log(`✅ Historial IA antiguo purgado: ${deletedHistory.count}`);
    console.log('\n🎉 Mantenimiento completado exitosamente.');
  } catch (error) {
    console.error('❌ Error durante el mantenimiento:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMaintenance();

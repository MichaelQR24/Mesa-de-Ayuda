import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';

console.log('🧹 [Dry Run] Verificando registros de historial antiguos para retención...\n');

async function dryRunCleanup() {
  try {
    const retentionDays = env.AI_HISTORY_RETENTION_DAYS || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`[+] Política de retención: ${retentionDays} días`);
    console.log(`[+] Fecha de corte: ${cutoffDate.toISOString()}`);

    const count = await prisma.aiHistory.count({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`\n📊 Registros de historial mayores a ${retentionDays} días que serían eliminados: ${count}`);
    console.log('ℹ️  Nota: En modo Dry-Run ningún dato fue modificado o eliminado.');
  } catch (error) {
    console.error('Error al consultar historial:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dryRunCleanup();

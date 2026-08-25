import dotenv from 'dotenv';
import { aiService } from '../src/services/ai.service.js';
import { env } from '../src/config/env.js';

dotenv.config();

async function runRealGroqTest() {
  console.log('====================================================');
  console.log('🧪 PRUEBA MANUAL DE CONEXIÓN REAL CON GROQ API');
  console.log('====================================================');

  if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim() === '') {
    console.error('❌ ERROR: Debes configurar la variable GROQ_API_KEY en backend/.env para ejecutar esta prueba real.');
    process.exit(1);
  }

  console.log(`🤖 Modelo configurado: ${env.GROQ_MODEL}`);
  console.log('📝 Texto de prueba: "estimado emerson por favor apoyar con la configuracion de una laptop"');
  console.log('🎯 Acción: paraphrase (Parafrasear) | Estilo: helpdesk (Mesa de Ayuda)\n');

  try {
    const startTime = Date.now();
    const result = await aiService.processText({
      text: 'estimado emerson por favor apoyar con la configuracion de una laptop',
      action: 'paraphrase',
      tone: 'helpdesk',
      paraphraseLevel: 'medium',
    });
    const totalTime = Date.now() - startTime;

    console.log('✅ RESPUESTA GENERADA POR LLAMA:');
    console.log('----------------------------------------------------');
    console.log(result.result);
    console.log('----------------------------------------------------');
    console.log(`⏱️ Latencia: ${totalTime}ms (API: ${result.latencyMs ?? 'N/A'}ms)`);
    if (result.usage) {
      console.log(`📊 Tokens: Input=${result.usage.inputTokens} | Output=${result.usage.outputTokens} | Total=${result.usage.totalTokens}`);
    }
    console.log('====================================================');
  } catch (error: unknown) {
    console.error('❌ Error ejecutando prueba real con Groq:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runRealGroqTest();

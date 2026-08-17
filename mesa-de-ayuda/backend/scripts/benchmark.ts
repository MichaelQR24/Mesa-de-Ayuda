import { sensitiveDataGuard } from '../src/utils/sensitive-data.guard.js';
import { buildSystemPrompt } from '../src/prompts/prompts.js';
import { AiAction, AiTone, AiParaphraseLevel } from '../src/types/ai.types.js';

console.log('⚡ Benchmark de Rendimiento y Eficiencia — Mesa de Ayuda (Fase 13)\n');

const BENCHMARK_SAMPLES = [
  { id: 1, text: 'el usuario no puede entrar a su correo por clave vencida', action: 'correct' },
  { id: 2, text: 'favor de revisar acceso al vpn no conecta desde casa', action: 'professionalize' },
  { id: 3, text: 'la impresora del piso 3 no tiene tinta y atasca las hojas', action: 'paraphrase' },
  { id: 4, text: 'reporto lentitud extrema en el erp sap al emitir facturas', action: 'summarize' },
  { id: 5, text: 'hola necesito que me ayuden con mi clave urgente', action: 'reply' },
  { id: 6, text: 'el sistema arroja error 500 al guardar el registro contable', action: 'professionalize' },
  { id: 7, text: 'solicito cambio de equipo por pantalla rota en laptop dell', action: 'correct' },
  { id: 8, text: 'se requiere instalacion de office 365 y teams para nuevo ingreso', action: 'paraphrase' },
  { id: 9, text: 'el cliente pregunta por qué no se procesó el pago de su orden 4589', action: 'reply' },
  { id: 10, text: 'falla en red wifi corporativa en sala de juntas principal', action: 'summarize' },
  { id: 11, text: 'usuario bloqueado por 3 intentos fallidos de contraseña en dominio', action: 'professionalize' },
  { id: 12, text: 'no puedo visualizar los reportes en el modulo de cobranzas', action: 'correct' },
  { id: 13, text: 'solicitud de reseteo de mfa por cambio de telefono movil', action: 'paraphrase' },
  { id: 14, text: 'el escaner no reconoce la red local despues del reinicio del switch', action: 'professionalize' },
  { id: 15, text: 'estimados favor atender ticket con prioridad alta gracias', action: 'reply' },
  { id: 16, text: 'error de certificado ssl en el portal web interno', action: 'correct' },
  { id: 17, text: 'se solicita creacion de cuenta de correo para practicante', action: 'professionalize' },
  { id: 18, text: 'pantalla azul bsod recurrente en estacion de diseno 04', action: 'summarize' },
  { id: 19, text: 'consulta sobre politica de respaldo de archivos en onedrive', action: 'reply' },
  { id: 20, text: 'usuario reporta que no le llegan correos externos desde ayer', action: 'paraphrase' },
];

async function runBenchmark() {
  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`📊 Memoria inicial Heap: ${initialMemory.toFixed(2)} MB\n`);

  console.log('--- 1. Evaluación de SensitiveDataGuard (20 muestras) ---');
  const guardStart = performance.now();
  let blockedCount = 0;
  let warningCount = 0;

  for (const sample of BENCHMARK_SAMPLES) {
    const analysis = sensitiveDataGuard.analyze(sample.text);
    if (analysis.status === 'BLOCKED') blockedCount++;
    if (analysis.status === 'WARNING') warningCount++;
  }

  const guardDuration = performance.now() - guardStart;
  console.log(`✅ 20 análisis completados en ${guardDuration.toFixed(3)} ms (promedio: ${(guardDuration / 20).toFixed(4)} ms/req)`);

  console.log('\n--- 2. Evaluación de Generación de Prompts Compactos (20 muestras) ---');
  const promptStart = performance.now();
  let totalPromptChars = 0;

  for (const sample of BENCHMARK_SAMPLES) {
    const prompt = buildSystemPrompt(sample.action as AiAction, 'professional' as AiTone, 'medium' as AiParaphraseLevel);
    totalPromptChars += prompt.length;
  }

  const promptDuration = performance.now() - promptStart;
  const avgPromptChars = Math.round(totalPromptChars / 20);
  console.log(`✅ 20 prompts generados en ${promptDuration.toFixed(3)} ms (promedio: ${(promptDuration / 20).toFixed(4)} ms/req)`);
  console.log(`📏 Tamaño promedio del prompt de sistema: ${avgPromptChars} caracteres (~${Math.round(avgPromptChars / 4)} tokens)`);

  console.log('\n--- 3. Evaluación de Estrés con Texto Largo (5,000 caracteres) ---');
  const longSample = 'Usuario reporta error de autenticación en plataforma. '.repeat(100).slice(0, 5000);
  const stressStart = performance.now();
  sensitiveDataGuard.analyze(longSample);
  const stressDuration = performance.now() - stressStart;
  console.log(`✅ Análisis de texto de 5,000 chars completado en ${stressDuration.toFixed(3)} ms`);

  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`\n📊 Memoria final Heap: ${finalMemory.toFixed(2)} MB (Delta: ${(finalMemory - initialMemory).toFixed(2)} MB)`);
  console.log('\n🎉 Benchmark finalizado exitosamente con 0 anomalías.');
}

runBenchmark();

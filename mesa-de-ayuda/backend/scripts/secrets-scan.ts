import fs from 'fs';
import path from 'path';

console.log('🔍 Escaneando archivos del repositorio en busca de posibles secretos...\n');

const SUSPICIOUS_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Groq API Key (gsk_...)', regex: /gsk_[a-zA-Z0-9]{20,}/ },
  { name: 'OpenAI API Key (sk-...)', regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'GitHub Token (ghp_...)', regex: /ghp_[a-zA-Z0-9]{20,}/ },
  { name: 'AWS Access Key (AKIA...)', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'PostgreSQL Direct URI con password real', regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_.-]+:(?!\[)[^@\s]+@[^\s]+/ },
  { name: 'Clave Privada PEM', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.env',
  '.env.local',
  'secrets-scan.ts',
  'sensitive-data.guard.ts',
  'security.test.ts',
  'package-lock.json',
];

let issues = 0;

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(process.cwd(), fullPath);

    if (IGNORED_PATHS.some((ignored) => relPath.includes(ignored))) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of SUSPICIOUS_PATTERNS) {
          const match = content.match(pattern.regex);
          if (match) {
            // Descartar si es un placeholder tipo [TU_CLAVE] o [PASSWORD]
            if (match[0].includes('[') && match[0].includes(']')) {
              continue;
            }
            console.error(`❌ Posible secreto detectado [${pattern.name}] en archivo: ${relPath}`);
            issues++;
          }
        }
      } catch {
        // Ignorar archivos binarios
      }
    }
  }
}

const rootToScan = path.resolve(process.cwd(), '..');
scanDir(rootToScan);

console.log('\n----------------------------------------');
if (issues === 0) {
  console.log('✅ Escaneo de secretos completado: No se encontraron patrones sospechosos.');
  process.exit(0);
} else {
  console.error(`⚠️ Se detectaron ${issues} posibles secretos en el código fuente.`);
  process.exit(1);
}

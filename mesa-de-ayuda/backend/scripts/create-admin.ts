import dotenv from 'dotenv';
import readline from 'readline';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/utils/crypto.js';
import { passwordPolicy } from '../src/schemas/auth.schema.js';
import { UserRole, UserStatus } from '@prisma/client';

dotenv.config();

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createAdmin() {
  console.log('====================================================');
  console.log('👑 BOOTSTRAP: CREACIÓN DE USUARIO ADMINISTRADOR');
  console.log('====================================================');

  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdmin) {
      console.log(`ℹ️ Ya existe un usuario administrador registrado en el sistema: ${existingAdmin.email}`);
      const proceed = await prompt('¿Desea crear otro usuario administrador? (s/n): ');
      if (proceed.toLowerCase() !== 's' && proceed.toLowerCase() !== 'si') {
        console.log('Operación cancelada.');
        process.exit(0);
      }
    }

    const email = process.env.ADMIN_EMAIL || (await prompt('Correo electrónico del Administrador: '));
    if (!email || !email.includes('@')) {
      console.error('❌ Correo electrónico inválido.');
      process.exit(1);
    }

    const duplicateUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (duplicateUser) {
      console.error(`❌ Ya existe un usuario registrado con el correo: ${email}`);
      process.exit(1);
    }

    const displayName = process.env.ADMIN_NAME || (await prompt('Nombre completo del Administrador: '));
    if (!displayName) {
      console.error('❌ Nombre no proporcionado.');
      process.exit(1);
    }

    const password = process.env.ADMIN_PASSWORD || (await prompt('Contraseña inicial (mín. 10 caracteres, 1 letra y 1 número): '));
    const validation = passwordPolicy.safeParse(password);
    if (!validation.success) {
      console.error(`❌ La contraseña no cumple con la política de seguridad: ${validation.error.errors[0].message}`);
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        displayName,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false, // El administrador que se crea manualmente no está obligado a cambiarla inmediatamente
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    console.log('----------------------------------------------------');
    console.log('✅ Usuario Administrador creado exitosamente:');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Nombre: ${admin.displayName}`);
    console.log(`   Rol: ${admin.role}`);
    console.log(`   Estado: ${admin.status}`);
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la creación del administrador:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

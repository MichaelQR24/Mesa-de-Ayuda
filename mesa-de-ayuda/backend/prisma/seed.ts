import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  const categoryNames = [
    'Contraseñas',
    'Accesos',
    'Cierre',
    'Redes',
    'Hardware',
    'General',
  ];

  const categories: Record<string, string> = {};

  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = cat.id;
    console.log(`  ✓ Categoría: ${name} (${cat.id})`);
  }

  // Plantillas compartidas de ejemplo
  const initialItems = [
    {
      title: 'Restablecimiento de Contraseña',
      category: 'Contraseñas',
      content: 'Se procedió con el restablecimiento de contraseña solicitado. Se enviaron las credenciales temporales al correo registrado y se solicitó su cambio en el primer inicio de sesión.',
      isShared: true,
      isFavorite: true,
    },
    {
      title: 'Asignación de Permisos en Carpeta Compartida',
      category: 'Accesos',
      content: 'Se realizaron las validaciones correspondientes y se brindó acceso al usuario a la ruta de red solicitada previa autorización del responsable del área.',
      isShared: true,
      isFavorite: false,
    },
    {
      title: 'Cierre Estándar de Ticket Resuelto',
      category: 'Cierre',
      content: 'Se atendió lo solicitado y se comprobó el correcto funcionamiento junto con el usuario. Se procede con el cierre del ticket.',
      isShared: true,
      isFavorite: true,
    },
  ];

  for (const item of initialItems) {
    const categoryId = categories[item.category];
    if (categoryId) {
      const existing = await prisma.libraryItem.findFirst({
        where: { title: item.title, categoryId },
      });

      if (!existing) {
        await prisma.libraryItem.create({
          data: {
            title: item.title,
            content: item.content,
            categoryId,
            isShared: item.isShared,
            isFavorite: item.isFavorite,
          },
        });
        console.log(`  ✓ Plantilla creada: ${item.title}`);
      }
    }
  }

  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { LibraryItem } from '../types';

export const LIBRARY_CATEGORIES = [
  'Todos',
  'Contraseñas',
  'Accesos',
  'Cierre',
  'Redes',
  'Hardware',
  'General',
] as const;

export const INITIAL_LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'lib-1',
    title: 'Restablecimiento de Contraseña',
    category: 'Contraseñas',
    content: 'Se procedió con el restablecimiento de contraseña solicitado. Se enviaron las credenciales temporales al correo registrado y se solicitó su cambio en el primer inicio de sesión.',
  },
  {
    id: 'lib-2',
    title: 'Desbloqueo de Cuenta de Usuario',
    category: 'Contraseñas',
    content: 'Se validó la identidad del usuario y se realizó el desbloqueo de la cuenta en el Directorio Activo. El usuario confirmó el ingreso exitoso al sistema.',
  },
  {
    id: 'lib-3',
    title: 'Asignación de Permisos en Carpeta Compartida',
    category: 'Accesos',
    content: 'Se realizaron las validaciones correspondientes y se brindó acceso al usuario a la ruta de red solicitada previa autorización del responsable del área.',
  },
  {
    id: 'lib-4',
    title: 'Creación de Cuenta para Nuevo Colaborador',
    category: 'Accesos',
    content: 'Se completó la creación del usuario y buzón de correo institucional conforme al requerimiento de Recursos Humanos. Se asignaron las licencias y grupos base correspondientes.',
  },
  {
    id: 'lib-5',
    title: 'Cierre Estándar de Ticket Resuelto',
    category: 'Cierre',
    content: 'Se atendió lo solicitado y se comprobó el correcto funcionamiento junto con el usuario. Se procede con el cierre del ticket.',
  },
  {
    id: 'lib-6',
    title: 'Cierre por Falta de Respuesta del Usuario',
    category: 'Cierre',
    content: 'Se realizaron múltiples intentos de contacto sin obtener respuesta del usuario. Se procede con el cierre preventivo del caso. Quedamos a su disposición en caso de requerir reapertura.',
  },
  {
    id: 'lib-7',
    title: 'Configuración y Diagnóstico de VPN',
    category: 'Redes',
    content: 'Se verificó la conectividad del túnel VPN y se reinstaló el certificado de autenticación. El usuario logró conexión estable a la red corporativa.',
  },
  {
    id: 'lib-8',
    title: 'Revisión y Configuración de Impresora de Red',
    category: 'Hardware',
    content: 'Se reinstaló el controlador de impresión y se configuró la cola de red en el equipo cliente. Se realizó impresión de página de prueba con resultado satisfactorio.',
  },
  {
    id: 'lib-9',
    title: 'Requerimiento Escalado a Soporte Nivel 2',
    category: 'General',
    content: 'Se recopilaron los registros de error y diagnósticos preliminares. El incidente fue escalado al área especializada de Nivel 2 para su atención.',
  },
];

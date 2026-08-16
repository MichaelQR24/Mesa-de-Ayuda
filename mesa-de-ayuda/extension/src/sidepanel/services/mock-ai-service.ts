import { ActionType, ParaphraseLevel, ToneOption } from '../types';

interface ProcessOptions {
  action: ActionType;
  text: string;
  tone?: ToneOption;
  paraphraseLevel?: ParaphraseLevel;
}

export class MockAiService {
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processText(options: ProcessOptions): Promise<string> {
    const { action, text, tone = 'profesional', paraphraseLevel = 'medio' } = options;
    const cleanText = text.trim();

    if (!cleanText) {
      throw new Error('Ingresa un texto antes de continuar.');
    }

    // Simulación de latencia de inferencia para validar estados visuales
    await this.sleep(350);

    switch (action) {
      case 'corregir':
        return this.mockCorregir(cleanText);
      case 'parafrasear':
        return this.mockParafrasear(cleanText, paraphraseLevel, tone);
      case 'profesionalizar':
        return this.mockProfesionalizar(cleanText, tone);
      case 'resumir':
        return this.mockResumir(cleanText);
      case 'responder':
        return this.mockResponder(cleanText, tone);
      default:
        return cleanText;
    }
  }

  private mockCorregir(text: string): string {
    let corrected = text;

    // Normalizaciones ortográficas y de puntuación típicas
    const replacements: Array<[RegExp, string]> = [
      [/\buser\b/gi, 'usuario'],
      [/\bpass\b/gi, 'contraseña'],
      [/\bpwd\b/gi, 'contraseña'],
      [/\bpc\b/gi, 'equipo'],
      [/\bapp\b/gi, 'aplicación'],
      [/\bno funciona\b/gi, 'no se encuentra operativo'],
      [/\bse cayo\b/gi, 'presenta intermitencia en el servicio'],
      [/\bno puedo entrar\b/gi, 'no es posible acceder al sistema'],
      [/\bta bien\b/gi, 'se encuentra en estado correcto'],
      [/\s+/g, ' '],
    ];

    for (const [pattern, rep] of replacements) {
      corrected = corrected.replace(pattern, rep);
    }

    // Capitalizar primera letra y asegurar punto final
    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    if (!corrected.endsWith('.')) {
      corrected += '.';
    }

    return `[Corrección ortográfica y de estilo]:\n${corrected}`;
  }

  private mockParafrasear(text: string, level: ParaphraseLevel, tone: ToneOption): string {
    const toneNote = tone !== 'profesional' ? ` (${tone})` : '';

    if (level === 'suave') {
      return `Con respecto a lo indicado: ${text.charAt(0).toLowerCase() + text.slice(1)}${text.endsWith('.') ? '' : '.'} Se procedió con el seguimiento del caso.`;
    }

    if (level === 'completo') {
      return `Se toma conocimiento de la siguiente situación reportada${toneNote}: ${text}. De acuerdo con los procedimientos establecidos, se llevaron a cabo las validaciones pertinentes para canalizar la solución correspondiente.`;
    }

    // Nivel 'medio'
    return `En relación con el reporte: ${text}. Se procedió a registrar la incidencia y se ejecutaron las acciones pertinentes para su pronta atención.`;
  }

  private mockProfesionalizar(text: string, tone: ToneOption): string {
    const lower = text.toLowerCase();

    // Caso específico común citado en requerimientos
    if (lower.includes('no puede ingresar') || lower.includes('no puede entrar')) {
      if (tone === 'formal') {
        return 'Se hace constar que el usuario se comunica solicitando asistencia técnica formal debido a una imposibilidad de autenticación en la plataforma corporativa.';
      }
      if (tone === 'amable') {
        return 'El usuario se puso en contacto con nosotros cordialmente solicitando apoyo ya que presenta inconvenientes al ingresar al sistema. Con gusto se atiende su solicitud.';
      }
      if (tone === 'tecnico') {
        return 'Incidencia de autenticación reportada por el usuario cliente. Se identificó bloqueo o fallo en las credenciales de acceso al aplicativo.';
      }
      if (tone === 'casual') {
        return 'El usuario nos avisó que no logra entrar al sistema y estamos revisando el caso para dejarlo listo.';
      }
      return 'El usuario se comunica solicitando asistencia debido a que presenta inconvenientes para acceder al sistema.';
    }

    if (lower.includes('contraseña') || lower.includes('password') || lower.includes('clave')) {
      return 'Se recibió el requerimiento del usuario solicitando la gestión y restablecimiento de sus credenciales de seguridad institucional.';
    }

    if (lower.includes('impresora') || lower.includes('imprimir')) {
      return 'Se atendió la incidencia relacionada con el dispositivo de impresión y se efectuaron las verificaciones de cola de impresión y conectividad en red.';
    }

    // Transformación profesional general
    const formatted = text.charAt(0).toLowerCase() + text.slice(1);
    return `Estimado equipo: En atención a la solicitud recibida respecto a que ${formatted}${formatted.endsWith('.') ? '' : '.'} Se procedió con la atención conforme a los lineamientos de mesa de ayuda técnica.`;
  }

  private mockResumir(text: string): string {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const mainDetail = lines[0] || text;

    return `• Incidencia: ${mainDetail.slice(0, 100)}${mainDetail.length > 100 ? '...' : ''}\n• Estado: Atendido por mesa de ayuda\n• Diagnóstico: Se procesó el reporte inicial conforme a la política operativa vigente.`;
  }

  private mockResponder(text: string, tone: ToneOption): string {
    const greetings = {
      profesional: 'Estimado/a usuario/a,\n\nGracias por ponerse en contacto con la Mesa de Ayuda.',
      formal: 'Estimado(a) colaborador(a),\n\nAcusamos recibo de su comunicación dirigida a la Mesa de Ayuda.',
      amable: '¡Hola! Espero que estés teniendo un buen día.\n\nCon gusto te ayudamos con tu solicitud.',
      tecnico: 'Reporte Técnico Mesa de Ayuda - Ref: Caso de Soporte:\n\nDiagnóstico preliminar:',
      casual: '¡Hola! Recibimos tu mensaje.\n\nTe ayudamos de inmediato con tu consulta.',
    };

    const farewells = {
      profesional: '\n\nQuedamos a su entera disposición en caso de consultas adicionales.\n\nAtentamente,\nEquipo de Mesa de Ayuda',
      formal: '\n\nSin otro particular por el momento, nos suscribimos cordialmente.\n\nAtentamente,\nCentro de Soporte Técnico y Servicios TI',
      amable: '\n\n¡Cualquier otra duda avísanos y te apoyamos enseguida! Que tengas un excelente día.\n\nSaludos afectuosos,\nSoporte TI',
      tecnico: '\n\nEstado de ticket: En seguimiento.\nMétricas de SLA activas.',
      casual: '\n\n¡Listo! Si necesitas algo más, aquí estamos.\n\nSaludos,\nSoporte',
    };

    const greeting = greetings[tone] || greetings.profesional;
    const farewell = farewells[tone] || farewells.profesional;

    return `${greeting}\n\nRespecto a su requerimiento: "${text}". Le informamos que estamos gestionando la resolución correspondiente.${farewell}`;
  }
}

export const mockAiService = new MockAiService();

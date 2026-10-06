/** Negocio de prueba totalmente distinto de la demo: sirve para comprobar que la plantilla se reutiliza cambiando solo la configuración. */
export default {
  modoDemo: false,
  sitio: { url: 'https://www.peluquerialuna.test' },
  negocio: {
    nombre: 'Peluquería Luna',
    marca: 'Luna',
    submarca: '',
    tipoSchema: 'HairSalon',
    zona: 'Centro, Málaga',
    direccion: { calle: 'Plaza de la Constitución, 3', codigoPostal: '29005', localidad: 'Málaga', provincia: 'Málaga', region: 'Andalucía', pais: 'ES' },
    mapa: 'Plaza de la Constitución, Málaga',
  },
  contacto: {
    telefono: '+34951000111',
    whatsapp: '34951000111',
    whatsappTexto: 'Hola, quiero pedir cita en Peluquería Luna.',
    email: 'hola@peluquerialuna.test',
  },
  horario: [
    { dias: ['mar', 'mie', 'jue', 'vie'], etiqueta: 'Martes a viernes', abre: '10:00', cierra: '20:00' },
    { dias: ['sab'], etiqueta: 'Sábados', abre: '09:00', cierra: '14:00' },
    { dias: ['dom', 'lun'], etiqueta: 'Domingo y lunes', cerrado: true },
  ],
  reservas: {
    cal: { usuario: 'peluquerialuna', origen: 'https://app.cal.com', base: 'https://cal.com' },
    servicios: [
      { nombre: 'Corte y peinado', categoria: 'Pelo', minutos: 50, precio: 24, slug: 'corte-peinado' },
      { nombre: 'Color completo', corto: 'Color', categoria: 'Pelo', minutos: 120, precio: 55, slug: 'color-completo' },
    ],
    condiciones: [{ titulo: 'Pago', texto: 'En el local.' }],
  },
  textos: {
    titulo: 'Peluquería Luna | Corte y color en el centro de Málaga',
    descripcion: 'Peluquería en el centro de Málaga: corte, peinado y color. Consulta precios y reserva tu cita online en pocos pasos.',
    descripcionCorta: 'Corte, peinado y color en el centro de Málaga. Reserva tu cita online.',
    imagenCompartirAlt: 'Peluquería Luna, corte y color en el centro de Málaga',
    portada: { titulo: 'Corte y color en el', destacado: 'centro de Málaga', bajada: 'Corte, peinado y color con cita online.' },
    servicios: { titulo: 'Dos servicios, sin complicaciones.', nota: 'Duración y precio de cada servicio.', pie: '¿Dudas?', pieEnlace: 'Escríbenos por WhatsApp' },
    estudio: { titulo: 'Una peluquería junto a la plaza.', texto: 'Eliges el servicio y reservas tu cita.' },
    resenas: { titulo: 'Opiniones de clientas.' },
    ubicacion: { lineas: ['Ven a vernos', 'en el centro'] },
  },
  resenas: [{ texto: 'Muy contenta con el color.', nombre: 'Elena P.', servicio: 'Color completo' }],
  fotos: {
    portada: { archivo: 'portada.webp', alt: 'Interior luminoso de la peluquería', provisional: false },
    estudio: { archivo: 'estudio.webp', alt: 'Zona de lavado y espejos', provisional: false },
    galeria: [
      { archivo: 'galeria-1.webp', alt: 'Detalle de un peinado recogido', provisional: false },
      { archivo: 'galeria-2.webp', alt: 'Productos sobre una repisa', provisional: false },
      { archivo: 'galeria-3.webp', alt: 'Luz natural en el escaparate', provisional: false },
    ],
  },
  colores: {
    marfil: '#FFFFFF', papel: '#FFFFFF', arena: '#F1EEF5', arena2: '#E4DFEC', tinta: '#14121A', tinta2: '#403B4F', gris: '#5F5A70',
    noche: '#1B1826', nocheTexto: '#E3DFEE', nocheGris: '#A8A2BC', bronce: '#5B3FA0', bronceClaro: '#B7A4E8',
  },
  legal: { titular: 'Luna Estilistas S. L. (ejemplo de prueba)', nif: 'B00000000', domicilio: 'Plaza de la Constitución, 3, 29005 Málaga', actualizado: '1 de enero de 2027' },
};

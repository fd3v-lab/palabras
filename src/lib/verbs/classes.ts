import type { StemClass } from './types.ts';
import { COMPOUNDS } from './compounds.ts';
import { IRREGULAR_CORE } from './irregular-core.ts';
import { IRREGULAR_STEMS } from './irregular-stems.ts';
import { IRREGULAR_EXTRA } from './irregular-extra.ts';

/** Verbs that carry a stem change or hiatus accent (the class drives the engine). */
export const STEM_CLASSES: Record<StemClass, string[]> = {
  'e>ie': [
    'pensar', 'empezar', 'comenzar', 'cerrar', 'despertar', 'perder', 'entender', 'sentir', 'mentir',
    'divertir', 'referir', 'advertir', 'negar', 'defender', 'encender', 'gobernar',
  ],
  'o>ue': [
    'encontrar', 'contar', 'mover', 'recordar', 'dormir', 'costar', 'probar', 'soñar', 'doler', 'oler',
    'volar', 'mostrar', 'acordar', 'almorzar', 'soler',
  ],
  'e>i': [
    'pedir', 'conseguir', 'servir', 'repetir', 'vestir', 'despedir', 'elegir', 'competir', 'medir',
    'impedir', 'seguir',
  ],
  'u>ue': ['jugar'],
  'i>ie': ['adquirir'],
  iar: ['enviar', 'confiar', 'fotografiar'],
  uar: ['actuar', 'continuar'],
};

/** Fully regular verbs (apart from automatic spelling changes such as -car/-gar/-zar, -ger, -cer). */
export const REGULAR_VERBS: string[] = [
  'dejar', 'llegar', 'pasar', 'deber', 'parecer', 'quedar', 'creer', 'llamar', 'tomar', 'conocer', 'vivir',
  'tratar', 'mirar', 'esperar', 'buscar', 'existir', 'entrar', 'trabajar', 'ocurrir', 'terminar',
  'permitir', 'aparecer', 'sacar', 'necesitar', 'resultar', 'leer', 'cambiar', 'presentar', 'crear',
  'considerar', 'recibir', 'recoger', 'aceptar', 'realizar', 'comprender', 'lograr', 'explicar',
  'preguntar', 'tocar', 'reconocer', 'estudiar', 'alcanzar', 'nacer', 'dirigir', 'correr', 'utilizar',
  'pagar', 'ayudar', 'gustar', 'escuchar', 'cumplir', 'ofrecer', 'levantar', 'intentar', 'usar', 'decidir',
  'olvidar', 'imaginar', 'subir', 'señalar', 'formar', 'desear', 'marcar', 'significar', 'indicar',
  'colocar', 'matar', 'abandonar', 'apoyar', 'asegurar', 'acompañar', 'comprar', 'vender', 'ganar',
  'faltar', 'meter', 'construir', 'establecer', 'invitar', 'viajar', 'bailar', 'cantar', 'lavar',
  'limpiar', 'cocinar', 'comer', 'beber', 'desayunar', 'cenar', 'nadar', 'caminar', 'aprender', 'enseñar',
  'llorar', 'gritar', 'callar', 'temer', 'odiar', 'amar', 'besar', 'abrazar', 'firmar', 'votar',
  'discutir', 'negociar', 'solucionar', 'evitar', 'provocar', 'causar', 'afectar', 'influir', 'depender',
  'relacionar', 'unir', 'separar', 'dividir', 'juntar', 'mezclar', 'añadir', 'quitar', 'guardar',
  'ahorrar', 'gastar', 'cobrar', 'prestar', 'robar', 'perdonar', 'castigar', 'obligar', 'autorizar',
  'avisar', 'informar', 'anunciar', 'publicar', 'imprimir', 'dibujar', 'pintar', 'grabar', 'interpretar',
  'crecer', 'desarrollar', 'mejorar', 'empeorar', 'aumentar', 'disminuir', 'bajar', 'controlar', 'dominar',
  'administrar', 'organizar', 'planear', 'preparar', 'celebrar', 'felicitar', 'agradecer', 'disculpar',
  'saludar', 'visitar', 'acercar', 'alejar', 'acostumbrar', 'preocupar', 'interesar', 'importar',
  'molestar', 'cansar', 'descansar', 'relajar', 'aburrir', 'asustar', 'sorprender', 'enfadar', 'enojar',
  'calmar', 'emocionar', 'planificar', 'calcular', 'pesar', 'sumar', 'restar', 'multiplicar', 'cortar',
  'arreglar', 'reparar', 'fabricar', 'montar', 'desmontar', 'instalar', 'conectar', 'desconectar',
  'apagar', 'funcionar', 'fallar', 'revisar', 'comprobar', 'verificar', 'confirmar', 'cancelar',
  'reservar', 'alquilar', 'mudar', 'regresar', 'hablar', 'llevar', 'cuidar', 'cometer', 'contratar',
  'cruzar', 'responder', 'dudar', 'prometer', 'parar', 'entregar', 'compartir', 'coger', 'luchar',
  'quemar',
];

export type VerbKind = 'regular' | StemClass | 'irregular' | 'compound' | 'reflexive';

const CLASS_OF = new Map<string, VerbKind>();
for (const v of REGULAR_VERBS) CLASS_OF.set(v, 'regular');
for (const [cls, list] of Object.entries(STEM_CLASSES)) for (const v of list) CLASS_OF.set(v, cls as StemClass);
for (const v of Object.keys(IRREGULAR_CORE)) CLASS_OF.set(v, 'irregular');
for (const v of Object.keys(IRREGULAR_STEMS)) CLASS_OF.set(v, 'irregular');
for (const v of Object.keys(IRREGULAR_EXTRA)) CLASS_OF.set(v, 'irregular');
for (const v of Object.keys(COMPOUNDS)) CLASS_OF.set(v, 'compound');
CLASS_OF.set('mudarse', 'reflexive');

/** Classification of a lemma, or undefined when it is not a known verb. */
export function verbKind(lemma: string): VerbKind | undefined {
  const known = CLASS_OF.get(lemma);
  if (known) return known;
  if (lemma.length > 4 && lemma.endsWith('se') && CLASS_OF.has(lemma.slice(0, -2) + '')) return 'reflexive';
  return undefined;
}

export function allKnownVerbs(): string[] {
  return [...CLASS_OF.keys()];
}

import type { Compound } from './types.ts';

const c = (prefix: string, base: string): Compound => ({ prefix, base });

/** Verbs conjugated as prefix + a base verb (mantener = man + tener). */
export const COMPOUNDS: Record<string, Compound> = {
  mantener: c('man', 'tener'), obtener: c('ob', 'tener'), contener: c('con', 'tener'),
  detener: c('de', 'tener'), retener: c('re', 'tener'), sostener: c('sos', 'tener'),
  entretener: c('entre', 'tener'), abstener: c('abs', 'tener'),
  convenir: c('con', 'venir'), prevenir: c('pre', 'venir'), intervenir: c('inter', 'venir'),
  provenir: c('pro', 'venir'),
  suponer: c('su', 'poner'), componer: c('com', 'poner'), proponer: c('pro', 'poner'),
  exponer: c('ex', 'poner'), imponer: c('im', 'poner'), oponer: c('o', 'poner'),
  disponer: c('dis', 'poner'), reponer: c('re', 'poner'), posponer: c('pos', 'poner'),
  deshacer: c('des', 'hacer'), rehacer: c('re', 'hacer'),
  devolver: c('de', 'volver'), envolver: c('en', 'volver'), revolver: c('re', 'volver'),
  descubrir: c('des', 'cubrir'), encubrir: c('en', 'cubrir'), recubrir: c('re', 'cubrir'),
  describir: c('d', 'escribir'), inscribir: c('in', 'escribir'), suscribir: c('su', 'escribir'),
  prescribir: c('pre', 'escribir'),
  atraer: c('a', 'traer'), contraer: c('con', 'traer'), distraer: c('dis', 'traer'),
  sustraer: c('sus', 'traer'), extraer: c('ex', 'traer'), abstraer: c('abs', 'traer'),
  prever: c('pre', 'ver'), rever: c('re', 'ver'),
  sonreír: c('son', 'reír'),
  desoír: c('des', 'oír'), entreoír: c('entre', 'oír'),
  recaer: c('re', 'caer'), decaer: c('de', 'caer'),
};

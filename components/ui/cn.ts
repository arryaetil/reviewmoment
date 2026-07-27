/** Voegt klassennamen samen en laat falsy waarden vallen. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

// Typed answers (Maths Pro and PLE mocks): which answers can be typed on the number keypad, and when a
// typed answer counts as right. Numbers may be written with or without commas (1,250 or 1250) and
// decimals with extra zeros (0.5 or 0.50); fractions must be in their simplest form, as in PLE marking.

const TYPABLE = /^-?\d[\d,]*(\.\d+)?$|^\d+\/\d+$|^\d{1,2}:\d{2}$/

/** Can this answer be typed? (whole numbers, decimals, negatives, fractions like 3/4, times like 4:35) */
export const typable = (answer: string) => TYPABLE.test(answer.trim())

const clean = (s: string) => s.replace(/[,\s]/g, '').replace(/−/g, '-')

/** Does a typed answer match the right answer? */
export function sameAnswer(typed: string | null | undefined, answer: string): boolean {
  const t = clean(typed ?? '')
  const a = clean(answer)
  if (!t) return false
  if (t === a) return true
  // the same number written differently: 0.50 and 0.5, 07 and 7
  const number = /^-?(\d+(\.\d*)?|\.\d+)$/
  return number.test(a) && number.test(t) && Number(t) === Number(a)
}

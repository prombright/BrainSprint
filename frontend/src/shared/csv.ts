// A small CSV reader for question spreadsheets (Excel / Google Sheets "CSV UTF-8").
// Handles quoted fields with commas, doubled quotes and line breaks inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '') // Excel's byte-order mark
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

/** Spreadsheet rows (with a heading row) → question objects the API accepts. */
export function csvToQuestions(text: string) {
  const [head, ...rows] = parseCsv(text)
  const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name)
  const need = ['subject', 'grade', 'level', 'topic', 'prompt', 'answer']
  const missing = need.filter((n) => col(n) < 0)
  if (missing.length) throw new Error(`The heading row is missing: ${missing.join(', ')}`)
  const choiceCols = ['choice1', 'choice2', 'choice3', 'choice4'].map(col).filter((i) => i >= 0)
  return rows.map((r) => ({
    subject: r[col('subject')]?.trim().toLowerCase(),
    grade: r[col('grade')]?.trim().toUpperCase(),
    level: r[col('level')]?.trim().toLowerCase(),
    topic: r[col('topic')]?.trim().toLowerCase(),
    prompt: r[col('prompt')]?.trim(),
    speak: col('speak') >= 0 ? r[col('speak')]?.trim() : '',
    choices: choiceCols.map((i) => (r[i] ?? '').trim()).filter(Boolean),
    answer: r[col('answer')]?.trim(),
    steps: col('steps') >= 0 ? (r[col('steps')] ?? '').split('|').map((x) => x.trim()).filter(Boolean) : [],
  }))
}

/** Rows → CSV text that Excel opens correctly (UTF-8 mark, quoted where needed). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v)
    // a cell starting with = + - @ would run as a formula in Excel: names are typed by children
    if (/^[=+\-@]/.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/** Saves CSV text as a file download. */
export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

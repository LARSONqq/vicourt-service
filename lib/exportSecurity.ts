const spreadsheetFormulaPrefix =
  /^[\u0000-\u0020]*[=+\-@]/;

export function sanitizeSpreadsheetText(
  value: string
) {
  return spreadsheetFormulaPrefix.test(
    value
  )
    ? `'${value}`
    : value;
}

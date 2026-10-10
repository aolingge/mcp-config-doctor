// Support JSON comments and trailing commas without evaluating JavaScript or
// accepting JSON5. Whitespace replacement retains JSON.parse offset locations.
export function parseJsonc(source) {
  const chars = source.split('')
  if (chars[0] === '\ufeff') chars[0] = ' '
  let quoted = false
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index]
    if (quoted) {
      if (char === '\\') index += 1
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === '/' && chars[index + 1] === '/') {
      while (index < chars.length && chars[index] !== '\n' && chars[index] !== '\r') chars[index++] = ' '
      index -= 1
    } else if (char === '/' && chars[index + 1] === '*') {
      chars[index++] = ' '
      chars[index++] = ' '
      while (index < chars.length && !(chars[index] === '*' && chars[index + 1] === '/')) {
        if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' '
        index += 1
      }
      if (index >= chars.length) throw new SyntaxError('Unterminated JSONC comment')
      chars[index++] = ' '
      chars[index] = ' '
    }
  }
  quoted = false
  for (let index = 0; index < chars.length; index += 1) {
    if (quoted) {
      if (chars[index] === '\\') index += 1
      else if (chars[index] === '"') quoted = false
    } else if (chars[index] === '"') {
      quoted = true
    } else if (chars[index] === ',') {
      let next = index + 1
      while (next < chars.length && /[ \t\r\n]/.test(chars[next])) next += 1
      let previous = index - 1
      while (previous >= 0 && /[ \t\r\n]/.test(chars[previous])) previous -= 1
      if ((chars[next] === '}' || chars[next] === ']') && !/[\[{:,]/.test(chars[previous] ?? '')) chars[index] = ' '
    }
  }
  return JSON.parse(chars.join(''))
}

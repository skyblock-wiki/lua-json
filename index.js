// @ts-check
const { isNull, isUndefined, isBoolean, isNumber, isString, isArray, isObject, isEmpty, fromPairs, keys, map, repeat } = require('lodash')
const { parse: parseLua } = require('luaparse')

/**
 * @link https://github.com/fstirlitz/luaparse/blob/0f525b152516bc8afa34564de2423b039aa83bc1/luaparse.js#L1414
 * @param {string} id
 * @returns {boolean}
 */
function isKeyword(id) {
  switch (id.length) {
    case 2:
      return 'do' === id || 'if' === id || 'in' === id || 'or' === id;
    case 3:
      return 'and' === id || 'end' === id || 'for' === id || 'not' === id;
    case 4:
      // TODO: configure labels "goto"
      return 'else' === id || 'then' === id || 'goto' === id;
    case 5:
      return 'break' === id || 'local' === id || 'until' === id || 'while' === id;
    case 6:
      return 'elseif' === id || 'repeat' === id || 'return' === id;
    case 8:
      return 'function' === id;
  }
  return false;
}

/**
 * @param {string} string
 * @param {boolean} singleQuote
 * @param {boolean} multilineString
 * @returns {string}
 */
const formatLuaString = (string, singleQuote, multilineString) => {
  string = string.replace(/\\/g, "\\\\")
  if (multilineString) {
    if(string.includes("]]")) throw new SyntaxError("Multiline string can't include ']]'.") // TODO: provide more information about the error
    return `[[${string}]]`
  } else {
    string = string.replace(/\n/g, "\\n")
    return (singleQuote ? `'${string.replace(/'/g, "\\'")}'` : `"${string.replace(/"/g, '\\"')}"`)
  }
}

/**
 * @type {Record<string, string>}
 */
const valueKeys = { false: 'false', true: 'true', null: 'nil' }

/**
 * @param {string} string
 * @param {boolean} singleQuote
 * @returns {string}
 */
const formatLuaKey = (string, singleQuote) =>
  valueKeys[string] ? `[${valueKeys[string]}]` : (string.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) && !isKeyword(string)) ? string : `[${formatLuaString(string, singleQuote, false)}]`

/**
 * Encodes a JS data value as a Lua return statement with that value.
 * @param {any} value The JS data value to encode
 * @param {Object} options Formatting options
 * @param {string} options.eol In a pretty-printed result, the string to join each line with. Default newline character
 * @param {boolean} options.singleQuote Whether to encode string and irregular key values with single quotes. If false, double quotes are used. Default true
 * @param {boolean} options.multilineString Whether to encode string values with `[[ ]]`. Default false
 * @param {number | string | null} options.spaces Number of spaces, or a string, to prepend at each pretty-print level. If null, returns as minimized (disables pretty print). Default 2 spaces
 * @returns {string} Lua return statement with the resulting data value
 */
const format = (value, options = { eol: '\n', singleQuote: true, multilineString: false, spaces: 2 }) => {
  const eol = (options.eol = isString(options.eol) ? options.eol : '\n')
  options.singleQuote = isBoolean(options.singleQuote) ? options.singleQuote : true
  options.spaces = isNull(options.spaces) || isNumber(options.spaces) || isString(options.spaces) ? options.spaces : 2

  /**
   * @param {any} value
   * @param {number} i
   * @returns {string}
   */
  const rec = (value, i = 0) => {
    if (isNull(value)) {
      return 'nil'
    }
    if (isBoolean(value) || isNumber(value)) {
      return value.toString()
    }
    if (isString(value)) {
      return formatLuaString(value, options.singleQuote, options.multilineString)
    }
    if (isArray(value)) {
      if (isEmpty(value)) {
        return '{}'
      }
      if (options.spaces) {
        const spaces = isNumber(options.spaces) ? repeat(' ', options.spaces * (i + 1)) : repeat(options.spaces, i + 1)
        const spacesEnd = isNumber(options.spaces) ? repeat(' ', options.spaces * i) : repeat(options.spaces, i)
        return `{${eol}${value.map(e => `${spaces}${rec(e, i + 1)},`).join(eol)}${eol}${spacesEnd}}`
      }
      return `{${value.map(e => `${rec(e, i + 1)},`).join('')}}`
    }
    if (isObject(value)) {
      // eslint-disable-next-line no-self-assign
      value = /** @type any */ value
      if (isEmpty(value)) {
        return '{}'
      }
      if (options.spaces) {
        const spaces = isNumber(options.spaces) ? repeat(' ', options.spaces * (i + 1)) : repeat(options.spaces, i + 1)
        const spacesEnd = isNumber(options.spaces) ? repeat(' ', options.spaces * i) : repeat(options.spaces, i)
        return `{${eol}${keys(value)
          .filter(key => !isUndefined(value[key]))
          .map(key => `${spaces}${formatLuaKey(key, options.singleQuote)} = ${rec(value[key], i + 1)},`)
          .join(eol)}${eol}${spacesEnd}}`
      }
      return `{${keys(value)
        .filter(key => !isUndefined(value[key]))
        .map(key => `${formatLuaKey(key, options.singleQuote)}=${rec(value[key], i + 1)},`)
        .join('')}}`
    }
    throw new Error(`can't format ${typeof value}`)
  }

  return `return${options.spaces ? ' ' : ''}${rec(value)}`
}

/**
 * @param {import('luaparse').Node} ast
 * @returns {any}
 */
const luaAstToJson = ast => {
  // literals
  if (ast.type === 'NilLiteral' || ast.type === 'BooleanLiteral' || ast.type === 'NumericLiteral' || ast.type === 'StringLiteral') {
    return ast.value
  }
  // basic expressions
  if (ast.type === 'UnaryExpression' && ast.operator === '-') {
    return -luaAstToJson(ast.argument)
  }
  if (ast.type === 'Identifier') {
    return ast.name
  }
  // tables
  if (ast.type == 'TableKey' || ast.type == 'TableKeyString') {
    return { __internal_table_key: true, key: luaAstToJson(ast.key), value: luaAstToJson(ast.value) }
  }
  if (ast.type === 'TableValue') {
    return luaAstToJson(ast.value)
  }
  if (ast.type === 'TableConstructorExpression') {
    if (ast.fields[0] && 'key' in ast.fields[0]) {
      const object = fromPairs(
        map(ast.fields, field => {
          const { key, value } = luaAstToJson(field)
          return [key, value]
        }),
      )
      return isEmpty(object) ? [] : object
    }
    return map(ast.fields, field => {
      const value = luaAstToJson(field)
      return value.__internal_table_key ? [value.key, value.value] : value
    })
  }
  // top-level statements, only looking at the first statement, either return or local
  // todo: filter until return or local?
  if (ast.type === 'LocalStatement') {
    const values = ast.init.map(luaAstToJson)
    return values.length === 1 ? values[0] : values
  }
  if (ast.type === 'ReturnStatement') {
    const values = ast.arguments.map(luaAstToJson)
    return values.length === 1 ? values[0] : values
  }
  if (ast.type === 'Chunk') {
    return luaAstToJson(ast.body[0])
  }
  throw new Error(`can't parse ${ast.type}`)
}

/**
 * Extracts a Lua data value from the first statement of a valid Lua program
 * and decodes it into a JS data value.
 * Specifically, the first statement must be one of the following:
 *
 * - `return <value>` (`<value>` is the Lua data value to be decoded)
 * - `local <id> = <value>` (`<value>` is the Lua data value to be decoded)
 *
 * @param {string} value The Lua program to parse
 * @returns {any} The resulting JS data value
 */
const parse = value => luaAstToJson(parseLua(value, { comments: false }))

module.exports = {
  format,
  parse,
}

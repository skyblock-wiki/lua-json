const { clone, mapKeys } = require('lodash')
const { equal, deepEqual } = require('assert')

const { format, parse } = require('.')

const json = {
  _null: null,
  _false: false,
  _true: true,
  _zero: 0,
  _one: 1,
  _negative: -1,
  _float: 3.14,
  _big: 1e123,
  _string: "...'...'...",
  _multilinestring: '1st line\n2nd line\n3rd line',
  _backslash: {
    _single: '\\',
    _double: '\\\\',
    _followed: '\\test',
  },
  _array0: [],
  _array1: [1],
  _array2: [1, 2],
  _object0: [],
  _object1: {
    _nested: {
      _value: 1,
    },
  },
  _object2: {
    'a b': 1,
    "...'...'...": 2,
    null: 3,
    false: 4,
    true: 5,
  },
  _keywords: {
    do: 'keyword',
    if: 'keyword',
    in: 'keyword',
    or: 'keyword',
    and: 'keyword',
    end: 'keyword',
    for: 'keyword',
    not: 'keyword',
    else: 'keyword',
    then: 'keyword',
    goto: 'keyword',
    break: 'keyword',
    local: 'keyword',
    until: 'keyword',
    while: 'keyword',
    elseif: 'keyword',
    repeat: 'keyword',
    return: 'keyword',
    function: 'keyword'
  }
}

const lua = `return {
  _null = nil,
  _false = false,
  _true = true,
  _zero = 0,
  _one = 1,
  _negative = -1,
  _float = 3.14,
  _big = 1e+123,
  _string = '...\\'...\\'...',
  _multilinestring = '1st line\\n2nd line\\n3rd line',
  _backslash = {
    _single = '\\\\',
    _double = '\\\\\\\\',
    _followed = '\\\\test',
  },
  _array0 = {},
  _array1 = {
    1,
  },
  _array2 = {
    1,
    2,
  },
  _object0 = {},
  _object1 = {
    _nested = {
      _value = 1,
    },
  },
  _object2 = {
    ['a b'] = 1,
    ['...\\'...\\'...'] = 2,
    [nil] = 3,
    [false] = 4,
    [true] = 5,
  },
  _keywords = {
    ['do'] = 'keyword',
    ['if'] = 'keyword',
    ['in'] = 'keyword',
    ['or'] = 'keyword',
    ['and'] = 'keyword',
    ['end'] = 'keyword',
    ['for'] = 'keyword',
    ['not'] = 'keyword',
    ['else'] = 'keyword',
    ['then'] = 'keyword',
    ['goto'] = 'keyword',
    ['break'] = 'keyword',
    ['local'] = 'keyword',
    ['until'] = 'keyword',
    ['while'] = 'keyword',
    ['elseif'] = 'keyword',
    ['repeat'] = 'keyword',
    ['return'] = 'keyword',
    ['function'] = 'keyword',
  },
}`

const luaMinified = `return{_null=nil,_false=false,_true=true,_zero=0,_one=1,_negative=-1,_float=3.14,_big=1e+123,_string='...\\'...\\'...',_multilinestring='1st line\\n2nd line\\n3rd line',_backslash={_single='\\\\',_double='\\\\\\\\',_followed='\\\\test',},_array0={},_array1={1,},_array2={1,2,},_object0={},_object1={_nested={_value=1,},},_object2={['a b']=1,['...\\'...\\'...']=2,[nil]=3,[false]=4,[true]=5,},_keywords={['do']='keyword',['if']='keyword',['in']='keyword',['or']='keyword',['and']='keyword',['end']='keyword',['for']='keyword',['not']='keyword',['else']='keyword',['then']='keyword',['goto']='keyword',['break']='keyword',['local']='keyword',['until']='keyword',['while']='keyword',['elseif']='keyword',['repeat']='keyword',['return']='keyword',['function']='keyword',},}`

equal(format(json), lua)
deepEqual(parse(lua), json)
equal(format(json, { spaces: null }), luaMinified)
deepEqual(parse(luaMinified), json)

const jsonDoubleQuote = clone(json)
jsonDoubleQuote._string = jsonDoubleQuote._string.replace(/'/g, '"')
jsonDoubleQuote._object2 = mapKeys(jsonDoubleQuote._object2, (_, key) => key.replace(/'/g, '"'))
const luaDoubleQuote = lua.replace(/'/g, '"')
equal(format(jsonDoubleQuote, { singleQuote: false }), luaDoubleQuote)
deepEqual(parse(luaDoubleQuote), jsonDoubleQuote)

const luaNoEol = lua.replace(/\n/g, '')
equal(format(json, { eol: '' }), luaNoEol)

const luaDoubleEol = lua.replace(/\n/g, '\n\n')
equal(format(json, { eol: '\n\n' }), luaDoubleEol)
equal(format(json, { eol: '\n\n', spaces: null }), luaMinified)

const luaIndentTab = lua.replace(/^( {2})+/gm, match => '\t'.repeat(match.length / 2))
equal(format(json, { spaces: '\t' }), luaIndentTab)

const luaIndentZeroSpace = lua.replace(/^ +/gm, '')
equal(format(json, { spaces: 0 }), luaIndentZeroSpace)

const luaIndentFourSpace = lua.replace(/^( {2})+/gm, match => '    '.repeat(match.length / 2))
equal(format(json, { spaces: 4 }), luaIndentFourSpace)

const luaLocal = lua.replace('return', 'local test =')
deepEqual(parse(luaLocal), json)
const luaLocalMinified = luaMinified.replace('return', 'local test=')
deepEqual(parse(luaLocalMinified), json)

const jsonMultiline = { "test": "1st line\n2nd line\n3rd line", "a b": "1st line" }
const luaMultiline = `return {
  test = [[1st line
2nd line
3rd line]],
  ['a b'] = [[1st line]],
}`
equal(format(jsonMultiline, { multilineString: true }), luaMultiline)
deepEqual(parse(luaMultiline), jsonMultiline)

const jsonUndefinedValue = {
  _undefined: undefined,
  _string: 'string',
}
const luaUndefinedValue = `return {
  _string = 'string',
}`
equal(format(jsonUndefinedValue), luaUndefinedValue)
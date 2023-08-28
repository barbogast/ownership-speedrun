
type Value = string | number | null | Row[]
type Row = Record<string, Value>
type Table = Row[]

function transform(tables: Table[]): Table {
  // Your code here ...
  return tables[0]
}

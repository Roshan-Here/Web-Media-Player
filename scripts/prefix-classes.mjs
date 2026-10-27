// Puts the `mp:` Tailwind prefix on every utility class in the components, so the player's
// stylesheet can never clash with the page around it. Run after writing class names without
// it; classes already prefixed, and the player's own `mp-` classes, are left alone.
//
//   node scripts/prefix-classes.mjs [--check]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

const PREFIX = 'mp:'
const check = process.argv.includes('--check')
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.tsx?$/.test(entry.name)) files.push(path)
  }
}
walk('src')

const prefixTokens = (text) =>
  text.replace(/[^\s]+/g, (token) =>
    token.startsWith(PREFIX) || token.startsWith('mp-') ? token : PREFIX + token,
  )

let changed = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []
  const literal = (node) => {
    const start = node.getStart(source) + 1
    const end = node.getEnd() - 1
    const inner = text.slice(start, end)
    const next = prefixTokens(inner)
    if (next !== inner) edits.push({ start, end, next })
  }
  const classExpr = (node) => {
    if (!node) return
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) literal(node)
    else if (ts.isParenthesizedExpression(node)) classExpr(node.expression)
    else if (ts.isConditionalExpression(node)) {
      classExpr(node.whenTrue)
      classExpr(node.whenFalse)
    } else if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      classExpr(node.right)
      if (node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) classExpr(node.left)
    } else if (ts.isTemplateExpression(node)) {
      throw new Error(`${file}: class names in a template with values; use cx() instead`)
    }
  }
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'className' && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) literal(node.initializer)
      else if (ts.isJsxExpression(node.initializer)) classExpr(node.initializer.expression)
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'cx'
    ) {
      for (const arg of node.arguments) classExpr(arg)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (edits.length === 0) continue
  changed++
  if (check) {
    console.error(`${file}: ${edits.length} class string(s) without the prefix`)
    continue
  }
  let out = text
  for (const edit of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, edit.start) + edit.next + out.slice(edit.end)
  writeFileSync(file, out)
  console.log(`${file}: ${edits.length} class string(s) prefixed`)
}
if (check && changed) process.exit(1)

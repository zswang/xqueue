const fs = require('fs')
const path = require('path')

const filename = path.join(__dirname, 'package.json')
const pkg = JSON.parse(fs.readFileSync(filename))
pkg.version = pkg.version.replace(/-?\d+$/, function(value) {
  return parseInt(value) + 1
})
fs.writeFileSync(filename, JSON.stringify(pkg, null, '  '))

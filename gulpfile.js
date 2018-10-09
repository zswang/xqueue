/*jshint globalstrict: true*/
/*global require*/

'use strict'

const gulp = require('gulp')
const typescript = require('gulp-typescript')
const linenum = require('gulp-linenum')
const jdists = require('gulp-jdists')
const merge2 = require('merge2')
const pkg = require('./package.json')
const replace = require('gulp-replace')

function build() {
  const tsResult = gulp
    .src('./src/*.ts')
    .pipe(
      linenum({
        prefix: `${pkg.name}/src/index.ts:`,
      })
    )
    .pipe(jdists())
    .pipe(gulp.dest('./lib'))
    .pipe(
      typescript({
        target: 'ES5',
        declaration: true,
      })
    )

  return merge2([
    tsResult.dts
      .pipe(replace(/^\s*private\s.*;\s*$/gm, '// $&'))
      .pipe(gulp.dest('./lib')),
    tsResult.js
      .pipe(
        replace(/^(\s*)var __assign = /m, '$1/* istanbul ignore next */\n$&')
      )
      .pipe(gulp.dest('lib')),
  ])
}

gulp.task('dist', gulp.series(build))

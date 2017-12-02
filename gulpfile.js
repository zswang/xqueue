/*jshint globalstrict: true*/
/*global require*/

'use strict'

const gulp = require('gulp')
const typescript = require('gulp-typescript')
const linenum = require('gulp-linenum')
const jdists = require('gulp-jdists')
const merge2 = require('merge2')
const pkg = require('./package.json')

gulp.task('build', function () {
  var tsResult = gulp.src('./src/*.ts')
    .pipe(linenum({
      prefix: `${pkg.name}/src/index.ts:`
    }))
    .pipe(jdists())
    .pipe(gulp.dest('./lib'))
    .pipe(typescript({
      target: 'ES5',
      declaration: true,
    }))

  return merge2([
    tsResult.dts.pipe(gulp.dest('./lib')),
    tsResult.js.pipe(gulp.dest('./lib'))
  ])
})

gulp.task('dist', ['build'])
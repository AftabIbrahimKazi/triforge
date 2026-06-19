import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'dist/index.js',
  output: {
    file: 'dist/index.js',
    format: 'es',
  },
  external: ['three'],
  plugins: [
    nodeResolve({ preferBuiltins: false }),
    commonjs(),
  ],
}

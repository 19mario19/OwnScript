import util from "util"
/**
 * A bound console.log function with extra utility.
 * @type {import('console').Console['log'] & { stringify: (...args: any[]) => void }}
 */
const log = console.log.bind(console)
/**
 * Logs arguments with deep inspection, colors, and sorted keys.
 * @param {...any} args - Values to stringify and log
 */
log.stringify = (...args) =>
  console.log(
    util.inspect(args, {
      depth: null,
      colors: true,
      showHidden: false,
      // sorted: true,
    }),
  )

const methodToTrait = {
  clone: "Clone",
  add: "Add",
  eq: "Eq",
}

export { log, methodToTrait }

import { execSync } from "child_process"
import fs from "fs"
import path from "path"

const passDir = "./src/tests/fixtures"
const errorDir = "./src/tests/fixtures/errors"

const green = "\x1b[32m"
const red = "\x1b[31m"
const reset = "\x1b[0m"

function runFixture(file, dir, expectError = false) {
  const source = path.join(dir, file)

  try {
    const output = execSync(`node cli.js ${source}`, {
      encoding: "utf8",
      stdio: "pipe",
    })

    if (expectError) {
      console.log(
        `${red}✗ FAIL${reset} ${file} — expected error but compiled clean`,
      )
    } else {
      console.log(`${green}✓ PASS${reset} ${file}`)
    }
  } catch (err) {
    const output = err.stderr || err.stdout || ""

    if (expectError) {
      const errorTypes = [
        "UseAfterMoveError",
        "MutabilityError",
        "TypeError",
        "OwnershipError",
        "ReferenceError",
      ]

      const matched = errorTypes.find(
        (e) => err.stdout?.includes(e) || output.includes(e),
      )

      if (matched) {
        console.log(
          `${green}✓ PASS${reset} ${file} — correctly threw ${matched}`,
        )
      } else {
        console.log(
          `${red}✗ FAIL${reset} ${file} — threw unexpected error: ${output.slice(
            0,
            100,
          )}`,
        )
      }
    } else {
      console.log(`${red}✗ FAIL${reset} ${file}`)
      console.log(err.stderr?.slice(0, 200))
    }
  }
}

// pass fixtures
const passFiles = fs.readdirSync(passDir).filter((f) => f.endsWith(".own"))

console.log("--- PASS FIXTURES ---")

for (let file of passFiles) {
  runFixture(file, passDir, false)
}

// error fixtures
if (fs.existsSync(errorDir)) {
  const errorFiles = fs.readdirSync(errorDir).filter((f) => f.endsWith(".own"))

  console.log("\n--- ERROR FIXTURES ---")

  for (let file of errorFiles) {
    runFixture(file, errorDir, true)
  }
}

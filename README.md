# OwnScript

OwnScript is a small programming language built around ownership, borrowing, and compile-time safety.

It is an experimental language and compiler project written in JavaScript, exploring how Rust-like ownership concepts can work in a simpler language with explicit semantics.

## Features

* Ownership and move semantics
* Explicit borrowing with `&` and `&mut`
* Mutable bindings with `let mut`
* Generic types and functions
* Trait bounds
* `Option` and `Result`
* Pattern matching
* Structs and methods
* Closures
* Control flow and loops

## Status

**OwnScript v0.1.0 — early experimental release**

The compiler is functional and covered by an automated test suite, but OwnScript is still evolving. Language syntax and semantics may change as development continues.

## Getting Started

Clone the repository:

```fish
git clone https://github.com/19mario19/OwnScript.git
cd OwnScript
```

Run the test suite:

```fish
node src/tests/run.js
```

## Why OwnScript?

OwnScript started as an experiment in bringing ownership-oriented programming to a smaller and more approachable language.

The project explores how concepts such as ownership, borrowing, generics, traits, and pattern matching can be combined into a language with a relatively small compiler.

OwnScript is not intended to reproduce Rust. It is an exploration of different language and compiler design ideas.

## License

OwnScript is released under the MIT License.

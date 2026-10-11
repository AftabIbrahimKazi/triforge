# Security Policy

## Supported Versions

Each `@triforge/*` package is versioned independently. Security fixes are applied to the
latest published version of each affected package — there is no separate long-term-support
branch per package.

## Reporting a Vulnerability

If you find a security issue in any `@triforge/*` package (for example: GLSL/shader
injection, prototype pollution, unsafe `eval`/`Function()` usage, or anything that lets
untrusted input reach a code path it shouldn't), please **do not open a public issue**.

Instead, report it privately via
[GitHub's private vulnerability reporting](https://github.com/AftabIbrahimKazi/triforge/security/advisories/new)
for this repository. Include:

- Which package and version is affected
- A minimal reproduction
- The potential impact

You should expect an initial response within a few days. Once a fix is confirmed, it will
be published as a new patch version on npm and credited in that package's `CHANGELOG.md`
(or release notes) unless you'd prefer to remain anonymous.

## Scope

This policy covers the packages published under the `@triforge/` npm scope from this
repository. The `examples/*.html` files are demo scaffolding, not shipped library code —
issues there can be reported as regular bugs.

# Security Policy

## Supported versions

Only the latest release and the `main` branch receive security fixes.

| Version | Supported |
| ------- | --------- |
| `main` and the latest `0.1.x` | Yes |
| Anything older | No |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub:
[Report a vulnerability](https://github.com/jmartintechit-blip/JM-Web-Studio/security/advisories/new)
(repository **Security** tab → **Report a vulnerability**).

Please include what you found, the steps to reproduce it, and the impact you expect.
This is a small project maintained by one person, so there is no guaranteed response
time, but reports are read and answered on a best-effort basis. Once a fix is released,
the report can be disclosed publicly with credit if you want it.

## What is in scope

- The static site generator (`scripts/`) and the templates it produces.
- The client-side scripts shipped in the built site (consent gates, booking embed loader).
- The build and CI configuration (`.github/`, `netlify.toml`).

## What is not a vulnerability

- Content that is deliberately fictional in the demo: sample address, sample reviews,
  placeholder phone number, example business data.
- The demo being served with `noindex` or as a plain static site without a backend:
  there is no server-side code, database or user account system to attack.
- Issues in third-party services embedded after explicit user consent (Cal.com booking
  widget, Google Maps). Please report those to the respective vendor.
- Missing hardening headers or a Content-Security-Policy that are already documented as
  known limitations in the README.
- Reports from automated scanners without a demonstrable impact.

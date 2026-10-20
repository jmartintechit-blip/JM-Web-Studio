# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-20

First tagged release.

### Added
- Static demo site for a fictional nail and beauty salon (*Azahar Nail Studio*, Triana, Sevilla) with services and prices, studio section, photo gallery, sample reviews, FAQ, map, contact and legal pages.
- Single configuration file (`site.config.mjs`) and a small template engine, so the whole site can be reused for another business.
- Demo mode and production mode (`modoDemo`): demo bar with personalised `?para=Name` links, `noindex` and `Disallow` in demo mode; indexable output with sitemap, `robots.txt` and schema.org data in production mode.
- Per-service online booking with Cal.com and Google Maps, both loaded only after consent; cookie banner.
- "Open now" indicator based on the configured opening hours, including split shifts.
- Real photographs from Unsplash with their alternative texts.
- Test suite (Playwright and the Node.js test runner, 134 tests) and HTML validation for both modes.
- GitHub Actions CI and Dependabot configuration.
- Screenshots and a social preview image in `docs/images/`, generated with a fictitious phone number.
- English README, complete Spanish README (`README.es.md`), `SECURITY.md` and the MIT licence.

### Changed
- Visual identity redesigned as an editorial layout with photography as the main element.
- Screenshots moved from `docs/screenshots/` to `docs/images/`.

### Known issues
See the *Known limitations* section of the [README](README.md).

[0.1.0]: https://github.com/jmartintechit-blip/JM-Web-Studio/releases/tag/v0.1.0

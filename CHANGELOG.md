# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- A device per Flipr analyzer of the account: water temperature, pH, chlorine, redox (ORP), battery, and the pH and chlorine ratings Flipr gives.
- A device per Flipr Hub: filtration on/off and filtration mode (automatic, manual, schedule), both controllable from Gladys.
- Scene triggers: new measure, water rating changed (pH or chlorine, filtered by rating), no measure for 24 hours, filtration switched by the Hub itself.
- Scene actions: read the latest measure, change the filtration mode of a Hub.
- Dashboard widget "Pool water": temperature, pH, chlorine and redox tiles colored by their rating, the history of one value, what to do, the ratings, the battery and the filtration.
- Configuration with the e-mail and the password of the Flipr app, a reading interval from 5 to 60 minutes and a "Test the connection" button.
- English, French, German and Spanish everywhere: settings, devices, widget, scenes and documentation.

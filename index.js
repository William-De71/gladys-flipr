// -----------------------------------------------------------------------------
// Entry point of the Flipr external integration.
//
// Brings Flipr pool analyzers and the Flipr Hub into Gladys:
//   - a device per analyzer (water temperature, pH, chlorine, redox, battery,
//     pH and chlorine ratings) and per Hub (filtration on/off, mode), offered
//     on the Discovery screen (see src/device.js);
//   - scene triggers: new measure, water rating changed, measures stopped,
//     filtration switched by the Hub;
//   - scene actions: read the latest measure, change the filtration mode;
//   - a dashboard widget: the pool water at a glance.
//
// Flipr has no local API: the integration reads the Flipr cloud on its own
// timer, with the e-mail and password of the Flipr account.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Flipr integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});

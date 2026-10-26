import "reflect-metadata";

import { configure } from "#lib/server/config.js";
import { configFromEnv } from "#lib/server/env.js";
import { startTelemetry } from "#lib/server/telemetry.js";

configure(configFromEnv());
startTelemetry("server");

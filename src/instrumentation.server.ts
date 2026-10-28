import "reflect-metadata";

import { configuration } from "#lib/server/core/config.js";
import { environmentConfig } from "#lib/server/core/env.js";
import { telemetry } from "#lib/server/core/telemetry.js";

configuration.set(environmentConfig.build());
telemetry.start("server");

import WebSocket from "ws";
import express from "express";

import { DEFAULT_NETWORK, DEFAULT_SERVER_PORT } from "./constants";
import { connectToLiquity } from "./connection";
import { LQTYCirculatingSupplyPoller } from "./LQTYCirculatingSupplyPoller";

Object.assign(globalThis, { WebSocket });

const PORT = process.env.PORT || DEFAULT_SERVER_PORT;
const alchemyApiKey = process.env.ALCHEMY_API_KEY || undefined; // filter out empty string

const app = express();
const liquity = connectToLiquity(DEFAULT_NETWORK, { alchemyApiKey, useWebSocket: true });
const poller = new LQTYCirculatingSupplyPoller(liquity);

app.get("/", (_req, res) => {
  res.type("text/plain").send(`${poller.latestCirculatingSupply}`);
});

poller.start().then(() =>
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`);
  })
);

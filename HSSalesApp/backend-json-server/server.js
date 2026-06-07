'use strict';
/**
 * Entry point — wires Express, GraphQL, WebSocket, and live connections.
 * Business logic lives in services/*, resolvers in resolvers/index.js,
 * and schema SDL in schema/typeDefs.js.
 */
const { parse } = require('url');
const { createServer } = require('http');
const cors = require('cors');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { createHandler } = require('graphql-http/lib/use/express');
const { useServer } = require('graphql-ws/lib/use/ws');
const { WebSocketServer } = require('ws');
const jsonServer = require('json-server');

const { router } = require('./db');
const { parseBearerUserIdFromHeader, findUserById } = require('./helpers');
const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers/index');
const { liveWsServer } = require('./live');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// ── Express app ───────────────────────────────────────────────────────────────
const app = jsonServer.create();
app.use(cors({ origin: '*' }));
app.use(jsonServer.defaults());

// ── GraphQL schema ────────────────────────────────────────────────────────────
const gqlSchema = makeExecutableSchema({ typeDefs, resolvers });

app.all('/graphql', createHandler({ schema: gqlSchema, context: (req) => ({ req }) }));

// ── HTTP + WebSocket servers ──────────────────────────────────────────────────
const httpServer = createServer(app);

// GraphQL WS (subscriptions)
const gqlWsServer = new WebSocketServer({ noServer: true });
useServer(
  {
    schema: gqlSchema,
    context: (ctx) => {
      const authHeader = ctx?.connectionParams?.Authorization || ctx?.connectionParams?.authorization || '';
      const userId = parseBearerUserIdFromHeader(authHeader);
      const actor = userId ? findUserById(userId) : null;
      return { req: { headers: { authorization: String(authHeader) } }, userId: userId ?? null, actor: actor ?? null };
    },
  },
  gqlWsServer,
);

// Route upgrades
httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url);
  if (pathname === '/graphql') {
    gqlWsServer.handleUpgrade(request, socket, head, (ws) => gqlWsServer.emit('connection', ws, request));
  } else if (pathname === '/live') {
    liveWsServer.handleUpgrade(request, socket, head, (ws) => liveWsServer.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

// Mount json-server router for REST access (used internally by db.js)
app.use(router);

httpServer.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}/graphql`);
  console.log(`Live WebSocket at  ws://localhost:${PORT}/live`);
});

# HS Sales - JSON Server Backend (Demo)

This is a temporary backend using `json-server` so the mobile app can work while you build the real PostgreSQL-backed API later.

## Start

```bash
cd HSSalesApp/backend-json-server
npm install
npm run dev
```

Server URL:
- `http://localhost:3001`

## Demo login

POST `/api/login`

Request:
```json
{ "email": "admin@hs.com", "password": "admin123" }
```

Or sales:
```json
{ "email": "sales@hs.com", "password": "sales123" }
```

Response:
```json
{ "token": "demo-token-...", "user": { "id": "...", "email": "...", "role": "admin|sales" } }
```

## Data endpoints

JSON Server exposes CRUD endpoints under `/api/*`, for example:
- `GET /api/users`
- `GET /api/products`
- `GET /api/sales`

## Admin only: add a sales user

`POST /api/users` is **not** public self-registration. It is handled by a custom route that:

- Requires `Authorization: Bearer <token>` where `<token>` is the same value returned from `/api/login` (e.g. `demo-token-<userId>`).
- Requires the authenticated user to have role **`admin`**.
- Creates a new user with role **`sales`** (role cannot be escalated from the client).

Request:

```http
POST /api/users
Authorization: Bearer demo-token-00000000-0000-0000-0000-000000000001
Content-Type: application/json

{ "email": "newrep@hs.com", "password": "changeme12" }
```

Response `201`:

```json
{ "user": { "id": "...", "email": "newrep@hs.com", "role": "sales" } }
```

## Log a sale (sales or admin)

`POST /api/sales` requires a valid Bearer token. **`sales`** and **`admin`** may create sales.

When a **`sales`** user creates a sale, the server appends an entry to **`notifications`** so admins can review it in the app (Signals tab).

Request:

```http
POST /api/sales
Authorization: Bearer demo-token-00000000-0000-0000-0000-000000000002
Content-Type: application/json

{
  "warehouseId": "20000000-0000-0000-0000-000000000001",
  "saleDate": "2026-04-16",
  "notes": "Optional",
  "items": [
    { "productId": "10000000-0000-0000-0000-000000000001", "quantity": 10, "unitPrice": 3.5 }
  ]
}
```

Response `201`: `{ "sale": { ... }, "items": [ ... ] }`

## Admin notifications

### List (admin only)

`GET /api/notifications` — returns all notifications, newest first, each with an **`unread`** boolean for the signed-in admin (from `readByUserIds`).

### Mark read (admin only)

`POST /api/notifications/:id/read` — records the admin’s user id in `readByUserIds`.

## Inventory (authenticated)

### Stock on hand

`GET /api/inventory/stock` — aggregates `lotBatches` by product + warehouse (any signed-in user).

### Receive inbound (admin only)

`POST /api/purchases` — creates a `purchases` row, `purchaseItems`, new `lots`, and `lotBatches` at the chosen warehouse.

```json
{
  "warehouseId": "20000000-0000-0000-0000-000000000001",
  "purchaseDate": "2026-04-16",
  "notes": "Vendor invoice",
  "items": [{ "productId": "10000000-0000-0000-0000-000000000001", "quantity": 50, "unitCost": 2.2 }]
}
```

### Transfer between warehouses (admin only)

`POST /api/inventory/transfers` — FIFO-decrements source `lotBatches`, creates destination lots/batches, and appends `inventoryTransfers` + `inventoryTransferLines`.

```json
{
  "fromWarehouseId": "20000000-0000-0000-0000-000000000001",
  "toWarehouseId": "20000000-0000-0000-0000-000000000002",
  "transferDate": "2026-04-16",
  "lines": [{ "productId": "10000000-0000-0000-0000-000000000001", "quantity": 5 }]
}
```

## Notes

- Passwords are plaintext for demo purposes only.
- Inventory reconciliation / FIFO allocation should be implemented in the real backend later.


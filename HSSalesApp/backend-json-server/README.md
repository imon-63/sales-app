# HS Sales GraphQL Backend (Demo)

This backend is **GraphQL-only** and runs at `/graphql`.

- No REST fallback routes are exposed.
- The data model still uses the same `db.json` collections/fields, so migration to MongoDB later can focus on storage, not API shape.

## Start

```bash
cd HSSalesApp/backend-json-server
npm install
npm run dev
```

Server URLs:
- `http://localhost:3001`
- `http://localhost:3001/graphql`

## Authentication

1. Run `login` mutation to get token.
2. Send token in header for protected operations:

```http
Authorization: Bearer demo-token-<userId>
```

Example login:

```graphql
mutation {
  login(email: "admin@hs.com", password: "admin123") {
    token
    user {
      id
      email
      name
      phone
      role
    }
  }
}
```

## Common operations

Create sales user (admin only):

```graphql
mutation {
  createSalesUser(
    input: {
      email: "newrep@hs.com"
      password: "changeme12"
      name: "New Rep"
      phone: "01700000000"
    }
  ) {
    user {
      id
      email
      role
    }
  }
}
```

Create sale (admin or sales):

```graphql
mutation {
  createSale(
    input: {
      warehouseId: "20000000-0000-0000-0000-000000000001"
      saleDate: "2026-05-05"
      notes: "GraphQL sale"
      items: [
        {
          productId: "10000000-0000-0000-0000-000000000001"
          quantity: 3
          unitPrice: 120
          currencyId: "a0000000-0000-0000-0000-000000000002"
        }
      ]
    }
  ) {
    sale {
      id
      saleDate
      warehouseId
      createdBy
    }
    items {
      id
      productId
      quantity
      unitPrice
    }
  }
}
```

Fetch notifications (admin only):

```graphql
query {
  notifications {
    id
    type
    title
    body
    createdAt
    unread
  }
}
```

Mark notification read (admin only):

```graphql
mutation {
  markNotificationRead(id: "notification-id")
}
```

Stock summary:

```graphql
query {
  inventoryStock {
    warehouseName
    productName
    quantityOnHand
    unit
    unitCost
  }
}
```

## Notes

- Passwords are plaintext for demo purposes only.
- Inventory logic (FIFO allocation and depletion notifications) is implemented in GraphQL resolvers.


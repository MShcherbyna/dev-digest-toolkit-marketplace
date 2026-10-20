# Onion Architecture — examples

Based on an example `orders` module. "Bad" snippets show a common legacy shape; "good" is the target for new/touched code. `@app/shared` stands for the project's shared types/contracts package.

## 1. Service dependencies

```ts
// BAD — service locator + concrete repository
export class OrderService {
  private repo: OrderRepository;
  constructor(private container: Container) {
    this.repo = new OrderRepository(container.db);
  }
}
```

```ts
// GOOD — ports.ts (application layer)
import type { Order } from '@app/shared';

export interface OrderStore {
  findByNumber(accountId: string, number: string): Promise<Order | undefined>;
  insert(input: NewOrder, tx?: Tx): Promise<Order>;
}

// service.ts
export class OrderService {
  constructor(
    private store: OrderStore,
    private payments: PaymentGateway,
    private jobs: JobPort,
  ) {}
}

// container.ts (composition root) — the only place that news concrete classes
get orderService() {
  return (this._orderService ??= new OrderService(
    new DrizzleOrderStore(this.db),
    this.payments,
    this.jobs,
  ));
}
```

## 2. Repository returns domain types

```ts
// BAD — DB row leaks upward
export type OrderRow = typeof t.orders.$inferSelect;
async findByNumber(...): Promise<OrderRow | undefined> { /* ... */ }
```

```ts
// GOOD — repository.ts (infrastructure) maps rows to shared/domain types
const toOrder = (row: typeof t.orders.$inferSelect): Order => ({
  id: row.id,
  number: row.number,
  // ...
});

export class DrizzleOrderStore implements OrderStore {
  constructor(private db: Db) {}
  async findByNumber(accountId: string, number: string) {
    const [row] = await this.db
      .select()
      .from(t.orders)
      .where(and(eq(t.orders.accountId, accountId), eq(t.orders.number, number)));
    return row && toOrder(row);
  }
}
```

## 3. Optional transaction parameter

```ts
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async insert(input: NewOrder, tx?: Tx): Promise<Order> {
  const [row] = await (tx ?? this.db).insert(t.orders).values(input).returning();
  return toOrder(row);
}
```

## 4. Thin route

```ts
// GOOD — parse, delegate, map status. Nothing else.
app.post('/orders', { schema: { body: OrderInput } }, async (req, reply) => {
  const { accountId, userId } = await getContext(app.container, req);
  const { order, created } = await app.container.orderService.place(accountId, userId, req.body);
  reply.status(created ? 201 : 200);
  return order;
});
```

## 5. Unit test with a fake port

```ts
class InMemoryOrderStore implements OrderStore {
  private items = new Map<string, Order>();
  async findByNumber(account: string, number: string) {
    return this.items.get(`${account}/${number}`);
  }
  async insert(input: NewOrder) { /* ... */ }
}

it('returns the existing order instead of creating a duplicate', async () => {
  const svc = new OrderService(new InMemoryOrderStore(), fakePayments, fakeJobs);
  // no DB, no Fastify
});
```

## 6. Cross-module access

```ts
// BAD — reaching into another module's internals
import { INVOICE_JOB_KIND } from '../billing/constants.js';

// GOOD — via that module's public facade (index.ts) or a port from the container
import { INVOICE_JOB_KIND } from '../billing/index.js';
```

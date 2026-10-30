import type { FastifyInstance } from "fastify";
import {
  AccountForAdvanceSchema, AddAdvanceSchema, AddCurrencyRateSchema, AddDeliverableSchema, AddDisbursementSchema, AddProjectFundingSchema, AddRegisterExpenseSchema, CreateBudgetCategorySchema,
  CreateFundingSourceSchema, DecideEntrySchema, ImportRegisterSheetSchema, PayDeliverableSchema, SetFinanceCurrenciesSchema, UpdateFundingSourceSchema,
} from "@donordesk/contracts";

/**
 * The finance register (Phase 35.F). Thin: validate, call one handler, throw its error. Who may do what is in the handlers (and the authorization table);
 * every project-scoped record is addressed through its project, so the project boundary applies and a handler refuses a record of another project.
 */
export async function registerFinanceRegisterRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;
  const send = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => { if (!r.ok) throw r.error; return r.value; };

  // Organisation lists, rates and currencies.
  app.get("/v1/finance/funding-sources", async (req) => ({ sources: send(await req.container.handlers.listFundingSources.handle(ctx(req))).map((s) => ({ id: s.id, name: s.name, ownFunding: s.ownFunding, archived: s.archived })) }));
  app.post("/v1/finance/funding-sources", async (req, reply) => reply.status(201).send(send(await req.container.handlers.createFundingSource.handle(ctx(req), CreateFundingSourceSchema.parse(req.body)))));
  app.put("/v1/finance/funding-sources/:id", async (req) => { send(await req.container.handlers.updateFundingSource.handle(ctx(req), param(req, "id"), UpdateFundingSourceSchema.parse(req.body))); return { ok: true }; });
  app.get("/v1/finance/budget-categories", async (req) => ({ categories: send(await req.container.handlers.listBudgetCategories.handle(ctx(req))).map((c) => ({ id: c.id, code: c.code, label: c.label, archived: c.archived })) }));
  app.post("/v1/finance/budget-categories", async (req, reply) => reply.status(201).send(send(await req.container.handlers.createBudgetCategory.handle(ctx(req), CreateBudgetCategorySchema.parse(req.body)))));
  app.get("/v1/finance/rates", async (req) => {
    const r = send(await req.container.handlers.listCurrencyRates.handle(ctx(req)));
    return { primaryCurrency: r.primaryCurrency, localCurrency: r.localCurrency ?? null, rates: r.rates.map((x) => ({ id: x.id, from: x.from, to: x.to, rate: x.rate, effectiveOn: x.effectiveOn, source: x.source })) };
  });
  app.post("/v1/finance/rates", async (req, reply) => reply.status(201).send(send(await req.container.handlers.addCurrencyRate.handle(ctx(req), AddCurrencyRateSchema.parse(req.body)))));
  app.put("/v1/finance/currencies", async (req) => {
    const b = SetFinanceCurrenciesSchema.parse(req.body);
    send(await req.container.handlers.setFinanceCurrencies.handle(ctx(req), { primaryCurrency: b.primaryCurrency, ...(b.localCurrency ? { localCurrency: b.localCurrency } : {}) }));
    return { ok: true };
  });

  // The money across every project the person can see (Home).
  app.get("/v1/portfolio/finance", async (req) => send(await req.container.handlers.getPortfolioFinance.handle(ctx(req))));

  // One project's finance.
  app.get("/v1/projects/:projectId/finance", async (req) => send(await req.container.handlers.getProjectFinance.handle(ctx(req), param(req, "projectId"))));
  app.post("/v1/projects/:projectId/finance/funding", async (req, reply) => reply.status(201).send(send(await req.container.handlers.addProjectFunding.handle(ctx(req), param(req, "projectId"), AddProjectFundingSchema.parse(req.body)))));
  app.delete("/v1/projects/:projectId/finance/funding/:fundingId", async (req) => { send(await req.container.handlers.removeProjectFunding.handle(ctx(req), param(req, "projectId"), param(req, "fundingId"))); return { ok: true }; });
  app.post("/v1/projects/:projectId/finance/disbursements", async (req, reply) => reply.status(201).send(send(await req.container.handlers.addDisbursement.handle(ctx(req), param(req, "projectId"), AddDisbursementSchema.parse(req.body)))));
  app.post("/v1/projects/:projectId/finance/budget-lines/:lineId/expenses", async (req, reply) => reply.status(201).send(send(await req.container.handlers.addRegisterExpense.handle(ctx(req), param(req, "projectId"), param(req, "lineId"), AddRegisterExpenseSchema.parse(req.body)))));
  app.post("/v1/projects/:projectId/finance/expenses/:id/decision", async (req) => { send(await req.container.handlers.decideFinanceEntry.handle(ctx(req), param(req, "projectId"), "EXPENSE", param(req, "id"), DecideEntrySchema.parse(req.body))); return { ok: true }; });
  app.post("/v1/projects/:projectId/finance/disbursements/:id/decision", async (req) => { send(await req.container.handlers.decideFinanceEntry.handle(ctx(req), param(req, "projectId"), "DISBURSEMENT", param(req, "id"), DecideEntrySchema.parse(req.body))); return { ok: true }; });
  app.post("/v1/projects/:projectId/finance/deliverables", async (req, reply) => reply.status(201).send(send(await req.container.handlers.addDeliverable.handle(ctx(req), param(req, "projectId"), AddDeliverableSchema.parse(req.body)))));
  app.post("/v1/projects/:projectId/finance/deliverables/:id/approve", async (req) => { send(await req.container.handlers.changeDeliverable.handle(ctx(req), param(req, "projectId"), param(req, "id"), { action: "APPROVE" })); return { ok: true }; });
  app.post("/v1/projects/:projectId/finance/deliverables/:id/pay", async (req) => { send(await req.container.handlers.changeDeliverable.handle(ctx(req), param(req, "projectId"), param(req, "id"), { action: "PAY", on: PayDeliverableSchema.parse(req.body).on })); return { ok: true }; });
  app.post("/v1/projects/:projectId/finance/advances", async (req, reply) => reply.status(201).send(send(await req.container.handlers.addAdvance.handle(ctx(req), param(req, "projectId"), AddAdvanceSchema.parse(req.body)))));
  app.post("/v1/projects/:projectId/finance/advances/:id/accounting", async (req, reply) => reply.status(201).send(send(await req.container.handlers.accountForAdvance.handle(ctx(req), param(req, "projectId"), param(req, "id"), AccountForAdvanceSchema.parse(req.body)))));
  app.post("/v1/projects/:projectId/finance/import", { bodyLimit: 3_000_000 }, async (req) => send(await req.container.handlers.importRegisterSheet.handle(ctx(req), param(req, "projectId"), ImportRegisterSheetSchema.parse(req.body))));
}

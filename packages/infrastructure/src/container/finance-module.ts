import type { PrismaClient } from "@prisma/client";
import {
  AccountForAdvanceHandler, AddAdvanceHandler, AddCurrencyRateHandler, AddDeliverableHandler, AddDisbursementHandler, AddProjectFundingHandler, AddRegisterExpenseHandler,
  ChangeDeliverableHandler, ImportRegisterSheetHandler, CreateBudgetCategoryHandler, CreateFundingSourceHandler, DecideEntryHandler, GetProjectFinanceHandler, ListBudgetCategoriesHandler, ListCurrencyRatesHandler,
  GetPortfolioFinanceHandler, ListFundingSourcesHandler, RemoveProjectFundingHandler, SetFinanceCurrenciesHandler, UpdateFundingSourceHandler,
  type IAuditLogger, type IClock, type IIdGenerator, type IProjectRepository, type VisibleProjects,
} from "@donordesk/application";
import {
  PrismaAdvanceRepository, PrismaBudgetCategoryRepository, PrismaCurrencyRateRepository, PrismaDeliverableRepository, PrismaDisbursementRepository, PrismaFinanceSettingsRepository,
  PrismaFundingSourceRepository, PrismaProjectFundingRepository, PrismaRegisterExpenseRepository,
} from "../repositories/finance-register.js";
import { PrismaBudgetRepository } from "../repositories/work-plan/budget.js";

export interface FinanceModuleDeps { prisma: PrismaClient; ids: IIdGenerator; clock: IClock; audits: IAuditLogger; projects: IProjectRepository; visible: VisibleProjects }

/** The finance register (Phase 35.F) as one module: its repositories and handlers. The container takes `handlers` as they are. */
export function createFinanceModule(deps: FinanceModuleDeps) {
  const { prisma, ids, clock, audits, projects, visible } = deps;
  const d = { audit: audits, clock, ids };
  const sources = new PrismaFundingSourceRepository(prisma);
  const fundings = new PrismaProjectFundingRepository(prisma);
  const categories = new PrismaBudgetCategoryRepository(prisma);
  const disbursements = new PrismaDisbursementRepository(prisma);
  const expenses = new PrismaRegisterExpenseRepository(prisma);
  const deliverables = new PrismaDeliverableRepository(prisma);
  const advances = new PrismaAdvanceRepository(prisma);
  const rates = new PrismaCurrencyRateRepository(prisma);
  const settings = new PrismaFinanceSettingsRepository(prisma);
  const lines = new PrismaBudgetRepository(prisma);
  return {
    handlers: {
      listFundingSources: new ListFundingSourcesHandler(sources),
      createFundingSource: new CreateFundingSourceHandler(sources, d),
      updateFundingSource: new UpdateFundingSourceHandler(sources, d),
      listBudgetCategories: new ListBudgetCategoriesHandler(categories),
      createBudgetCategory: new CreateBudgetCategoryHandler(categories, d),
      listCurrencyRates: new ListCurrencyRatesHandler(rates, settings),
      addCurrencyRate: new AddCurrencyRateHandler(rates, d),
      setFinanceCurrencies: new SetFinanceCurrenciesHandler(settings, d),
      addProjectFunding: new AddProjectFundingHandler(projects, sources, fundings, d),
      removeProjectFunding: new RemoveProjectFundingHandler(fundings, d),
      addDisbursement: new AddDisbursementHandler(projects, sources, disbursements, d),
      addRegisterExpense: new AddRegisterExpenseHandler(projects, lines, sources, expenses, d),
      decideFinanceEntry: new DecideEntryHandler(expenses, disbursements, d),
      addDeliverable: new AddDeliverableHandler(projects, deliverables, d),
      changeDeliverable: new ChangeDeliverableHandler(deliverables, d),
      addAdvance: new AddAdvanceHandler(projects, advances, d),
      accountForAdvance: new AccountForAdvanceHandler(advances, d),
      getPortfolioFinance: new GetPortfolioFinanceHandler(visible, sources, fundings, disbursements, expenses, rates, settings),
      importRegisterSheet: new ImportRegisterSheetHandler(projects, lines, sources, expenses, disbursements, settings, d),
      getProjectFinance: new GetProjectFinanceHandler(projects, lines, sources, fundings, disbursements, expenses, advances, deliverables, rates, settings, clock),
    },
  };
}

export type FinanceHandlers = ReturnType<typeof createFinanceModule>["handlers"];

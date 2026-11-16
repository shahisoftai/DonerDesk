import type { PrismaClient } from "@prisma/client";
import {
  AddPlaceInlineHandler, ConfirmPlaceWordHandler, GetIndicatorPlacesHandler, GetPlaceProfileHandler, GetRecordPlacesHandler, GetWhereWeWorkHandler,
  ListDuplicatePlacesHandler, ListProjectPlacesHandler, MergePlacesHandler, RecordPlacesAfterCreate, SetIndicatorPlacesHandler, SetProjectAreaOpenHandler,
  SetRecordPlacesHandler, TickProjectAreaHandler, UntickProjectAreaHandler,
  GetPlaceAgendaHandler, GetPlaceSheetHandler, ImportPlaceSheetHandler, ListAgendaPlacesHandler, SetPlaceCellsHandler, type PlaceEntryDeps,
  type IAuditLogger, type IClock, type IIdGenerator, type IPlaceRepository, type IProjectRepository, type VisibleProjects,
} from "@donordesk/application";
import { PrismaPlaceWordLinkRepository, PrismaProjectAreaRepository, PrismaRecordPlaceOwnerReader, PrismaRecordPlaceRepository } from "../repositories/place-tree.js";
import { PrismaAreaDependentsReader, PrismaIndicatorPlaceStore, PrismaPlaceMergeWriter, PrismaProjectTypedLocations } from "../repositories/place-tree-readers.js";

export interface PlaceTreeModuleDeps { prisma: PrismaClient; ids: IIdGenerator; clock: IClock; audits: IAuditLogger; projects: IProjectRepository; visible: VisibleProjects; places: IPlaceRepository }

/**
 * One place tree (Phase 56) as one module: the footprint, record links, confirmed words, merges and where indicators are measured.
 * `recordPlaces` is handed to the create handlers (completed activities, files) so a new record stores or inherits its places.
 */
export function createPlaceTreeModule(deps: PlaceTreeModuleDeps) {
  const { prisma, ids, clock, audits: audit, projects, visible, places } = deps;
  const areas = new PrismaProjectAreaRepository(prisma);
  const links = new PrismaRecordPlaceRepository(prisma);
  const owners = new PrismaRecordPlaceOwnerReader(prisma);
  const words = new PrismaPlaceWordLinkRepository(prisma);
  const typed = new PrismaProjectTypedLocations(prisma);
  const dependents = new PrismaAreaDependentsReader(prisma);
  const store = new PrismaIndicatorPlaceStore(prisma);
  const areaDeps = { projects, visible, places, areas, dependents, audit, clock, ids };
  const recordDeps = { projects, visible, places, areas, links, owners, audit, clock };
  const setRecordPlaces = new SetRecordPlacesHandler(recordDeps);
  const orgDeps = { visible, places, areas, links };
  const indicatorDeps = { projects, visible, places, areas, store, audit };
  return {
    areas,
    links,
    recordPlaces: new RecordPlacesAfterCreate(setRecordPlaces, links, clock),
    handlers: {
      listProjectPlaces: new ListProjectPlacesHandler({ projects, visible, places, areas, links, typed, words }),
      tickProjectArea: new TickProjectAreaHandler(areaDeps),
      untickProjectArea: new UntickProjectAreaHandler(areaDeps),
      setProjectAreaOpen: new SetProjectAreaOpenHandler(areaDeps),
      getRecordPlaces: new GetRecordPlacesHandler(recordDeps),
      setRecordPlaces,
      confirmPlaceWord: new ConfirmPlaceWordHandler({ ...recordDeps, typed, words, ids }),
      addPlaceInline: new AddPlaceInlineHandler({ projects, visible, places, areas, audit, clock, ids }),
      getWhereWeWork: new GetWhereWeWorkHandler(orgDeps),
      getPlaceProfile: new GetPlaceProfileHandler(orgDeps),
      listDuplicatePlaces: new ListDuplicatePlacesHandler(places),
      mergePlaces: new MergePlacesHandler(places, new PrismaPlaceMergeWriter(prisma), audit, clock),
      getIndicatorPlaces: new GetIndicatorPlacesHandler(indicatorDeps),
      setIndicatorPlaces: new SetIndicatorPlacesHandler(indicatorDeps),
    },
  };
}

export type PlaceTreeHandlers = ReturnType<typeof createPlaceTreeModule>["handlers"];

/** Place-first entry and the by-place sheet (Phase 57): built once the plan and the bulk save exist. */
export function createPlaceEntryHandlers(deps: PlaceEntryDeps) {
  const getPlaceSheet = new GetPlaceSheetHandler(deps);
  const setPlaceCells = new SetPlaceCellsHandler(deps);
  return {
    listAgendaPlaces: new ListAgendaPlacesHandler(deps),
    getPlaceAgenda: new GetPlaceAgendaHandler(deps),
    getPlaceSheet,
    setPlaceCells,
    importPlaceSheet: new ImportPlaceSheetHandler(getPlaceSheet, setPlaceCells),
  };
}

export type PlaceEntryHandlers = ReturnType<typeof createPlaceEntryHandlers>;

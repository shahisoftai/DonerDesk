import type { CheckConfig, ColumnDef, DatasetFigure, Finding, TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";

/** What the dataset screens receive from the API (Phase 54). Plain data, mirrored from the application handlers' answers. */
export interface UploadPreview { fileKey: string; fileName: string; sheets: Array<{ name: string; rows: number; preview: string[][] }>; sheet: string; headerRow: number }
export interface CheckResult {
  columns: ColumnDef[];
  proposals: Array<{ key: string; reasons: string[]; confidence: number; samples: string[] }>;
  personal: Array<{ header: string; label: string; reason: string }>;
  steps: string[];
  preview: { headers: string[]; rows: string[][] };
  rowCount: number;
  findings: Finding[];
  places: Array<{ value: string; status: string; rows: number }>;
  placesMatched: number;
  kit?: { key: string; title: string; sentence: string; matched: number; total: number; mapping: Record<string, string>; reviewState: string } | undefined;
  kitSuggestion?: { key: string; title: string; sentence: string } | undefined;
  diff?: { summary: string; added: number; changed: number; removed: number; newPeriods: string[] } | undefined;
  problem?: string | undefined;
}
export interface DatasetListItem { id: string; name: string; description: string; scope: string; projectId?: string; kitKey?: string; rowCount: number; columns: number; updatedAt: string; canManage: boolean; restricted: boolean; pending: number; connector?: string }
export interface DatasetDetail extends Omit<DatasetListItem, "columns"> {
  columnCount: number;
  current?: { id: string; number: number; columns: ColumnDef[]; figures: Array<DatasetFigure & { sentence: string }>; checks: CheckConfig[]; steps: string[]; rawSteps: TidyStep[]; findings: Finding[]; rowCount: number; summary: string; createdAt: string };
  versions: Array<{ id: string; number: number; status: string; rowCount: number; summary: string; createdAt: string; mine: boolean; decisionNote?: string }>;
  links: Array<{ id: string; indicatorId: string; figureRef: string; byPlace: boolean; lastSync?: { at: string; written: number; notes: string[] } }>;
  sharePolicy: { hidden: string[] };
  restriction?: { lawfulBasis: string; purpose: string; retainUntil: string; viewerIds: string[] };
  kit?: { key: string; title: string; reviewState: string; source: string; mapping: Record<string, string> };
  connectorConfig?: Record<string, unknown>;
  lastPull?: { at?: string; summary?: string };
}
export interface KitView { key: string; title: string; description: string; sector: string; reviewState: string; source: string; columns: number; pages: number; template: string[] }

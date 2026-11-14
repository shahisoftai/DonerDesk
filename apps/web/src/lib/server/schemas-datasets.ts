import { z } from "zod";
import type { CheckResult, DatasetDetail, DatasetListItem, KitView, UploadPreview } from "@/features/datasets/domain/types";

/** Answers of the dataset routes (Phase 54). The API's handlers decide the shape; the web checks it is an object and types it. */
const obj = <T>() => z.custom<T>((v) => typeof v === "object" && v !== null);
export const UploadPreviewSchema = obj<UploadPreview>();
export const CheckResultSchema = obj<CheckResult>();
export const DatasetListSchema = obj<{ datasets: DatasetListItem[]; canCreate: boolean; canCreateOrg: boolean }>();
export const DatasetDetailSchema = obj<DatasetDetail>();
export const KitListSchema = obj<{ kits: KitView[] }>();
export const SavedDatasetSchema = obj<{ id: string; versionId: string; summary: string }>();
export const AddedVersionSchema = obj<{ versionId: string; summary: string; status: string }>();
export const KitDashboardsSchema = obj<{ canvasId: string; pages: number; skipped: string[] }>();
export const LinkAddedSchema = obj<{ id: string; written: number; notes: string[] }>();
export const LinkSyncSchema = obj<{ written: number; notes: string[] }>();
export const LinkSuggestionsSchema = obj<{ suggestions: Array<{ column: string; indicatorId: string; indicator: string; reason: string }> }>();
export const PullSchema = obj<{ summary: string; versionId?: string }>();
export const OkSchema = obj<{ ok: boolean }>();

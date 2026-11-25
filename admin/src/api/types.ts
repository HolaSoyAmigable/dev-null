/**
 * Alias de los schemas generados (src/api/schema.d.ts). No se definen tipos de la API a mano:
 * solo se nombran los que genera `scripts/generate-types.sh`.
 */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ApiErrorBody = Schemas["ErrorResponse"];

export type User = Schemas["UserRead"];
export type Post = Schemas["PostRead"];
export type PostListItem = Schemas["PostListItem"];
export type PostCreate = Schemas["PostCreate"];
export type PostUpdate = Schemas["PostUpdate"];
export type PostStatus = Post["status"];
export type Revision = Schemas["RevisionRead"];
export type Tag = Schemas["TagRead"];
export type Category = Schemas["CategoryRead"];
export type Media = Schemas["MediaRead"];
export type Project = Schemas["ProjectRead"];
export type ProjectCreate = Schemas["ProjectCreate"];
export type ProjectStatus = Project["status"];
export type CareerEntry = Schemas["CareerRead"];
export type CareerCreate = Schemas["CareerCreate"];
export type CareerType = CareerEntry["type"];
export type SiteSettings = Schemas["SiteSettings"];
export type SiteSettingsUpdate = Schemas["SiteSettingsUpdate"];
export type Overview = Schemas["Overview"];
export type TimeseriesPoint = Schemas["TimeseriesPoint"];
export type TopPost = Schemas["TopPost"];
export type CountItem = Schemas["CountItem"];
export type Realtime = Schemas["Realtime"];
export type PostMetrics = Schemas["PostMetrics"];

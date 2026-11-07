import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** Dashboards are made in Visuals now (one editor for dashboards and infographics). */
export function GET(request: Request) { return NextResponse.redirect(new URL("/visuals", request.url)); }

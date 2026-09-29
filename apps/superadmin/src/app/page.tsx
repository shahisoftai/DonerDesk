import { cookies } from "next/headers";import { Login } from "./ui/Login";import { Dashboard } from "./ui/Dashboard";import { ENTERPRISE_PRICE_FLOOR_ANNUAL_USD } from "@donordesk/domain";
export default async function Page(){return (await cookies()).has("sa_session")?<Dashboard enterprisePriceFloorAnnualUsd={ENTERPRISE_PRICE_FLOOR_ANNUAL_USD}/>:<Login/>}

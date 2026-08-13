import { cookies } from "next/headers";import { Login } from "./ui/Login";import { Dashboard } from "./ui/Dashboard";
export default async function Page(){return (await cookies()).has("sa_session")?<Dashboard/>:<Login/>}

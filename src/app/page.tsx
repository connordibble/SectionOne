import { connection } from "next/server";
import { Home } from "@/features/home/home";

export default async function HomePage() {
  await connection();

  return <Home />;
}

import { redirect } from "next/navigation";

// Root page redirects to the static marketplace
// The marketplace is served from public/index.html at /index.html
// Once we port it to React, this page will render it directly
export default function Home() {
  redirect("/index.html");
}

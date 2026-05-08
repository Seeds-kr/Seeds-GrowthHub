import AdminLogin from "@/pages/admin/login";

// Reuse the shared login form (server endpoint and redirect logic already
// handle role-based routing for admin / evaluator / student).
export default function StudentLogin() {
  return <AdminLogin />;
}

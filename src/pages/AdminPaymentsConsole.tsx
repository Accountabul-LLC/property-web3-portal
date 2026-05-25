import { Navigate } from "react-router-dom";

export default function AdminPaymentsConsole() {
  return <Navigate to="/payments?debug=1" replace />;
}
